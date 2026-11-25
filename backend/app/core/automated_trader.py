"""
Automated Paper Trading Background Worker
Runs 24/7 for Bitcoin and during active session/demo for Indian F&O.
Automatically executes the complete 4-stage pipeline on every completed candle without user intervention.
"""

import asyncio
from datetime import datetime
import logging
from typing import Any, Dict, List, Optional
import pandas as pd

from app.market_data.base import BaseMarketDataProvider, AssetType, DataMode
from app.market_data.factory import get_market_data_provider
from app.indicators.v12_engine import V12Engine, V12Signal, SignalType
from app.ai.verification_engine import AIVerificationEngine, MarketContext, AIDecision
from app.risk.risk_manager import DeterministicRiskManager, RiskDecisionStatus
from app.broker.instruments import ContractResolver, FNOContract, InstrumentType, BlackScholesPricer
from app.broker.paper_broker import CloudPaperBroker
from app.core.database import SessionLocal, SignalLog, TradeRecord

logger = logging.getLogger("AutomatedTrader")


class AutomatedPaperTrader:
    def __init__(
        self,
        provider: Optional[BaseMarketDataProvider] = None,
        poll_interval_seconds: float = 5.0
    ):
        self.provider = provider or get_market_data_provider()
        self.poll_interval = poll_interval_seconds
        self.is_active: bool = True
        self.v12_engine = V12Engine()
        self.ai_verifier = AIVerificationEngine()
        self.risk_manager = DeterministicRiskManager()
        self.paper_broker = CloudPaperBroker(initial_capital=100000.0)

        self.watched_symbols = ["NIFTY", "BANKNIFTY", "FINNIFTY", "SENSEX", "BANKEX", "BTC/USDT"]
        self.last_processed_timestamps: Dict[str, Any] = {}
        self.candle_tick_counter: int = 0
        self.worker_task: Optional[asyncio.Task] = None

    def start(self):
        if self.worker_task is None or self.worker_task.done():
            self.is_active = True
            self.worker_task = asyncio.create_task(self.run_loop())
            logger.info("Automated Paper Trader worker started.")

    def stop(self):
        self.is_active = False
        if self.worker_task and not self.worker_task.done():
            self.worker_task.cancel()
            logger.info("Automated Paper Trader worker stopped.")

    async def run_loop(self):
        """Continuous background execution loop."""
        while self.is_active:
            try:
                self.candle_tick_counter += 1
                await self.tick_cycle()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in automated paper trader cycle: {e}")
            await asyncio.sleep(self.poll_interval)

    async def tick_cycle(self):
        """
        1. Updates open positions MTM & checks Stop-Loss / Take-Profit
        2. In Demo mode, advances candle ticks periodically
        3. For each symbol, fetches latest candles & executes pipeline on newly completed bars
        """
        for sym_key, pos in list(self.paper_broker.open_positions.items()):
            quote = await self.provider.get_quote(pos.contract.underlying)
            curr_underlying_px = quote.price
            
            if pos.contract.asset_type == AssetType.CRYPTO_SPOT:
                contract_px = curr_underlying_px
            elif pos.contract.instrument_type == InstrumentType.INDEX_FUTURES:
                contract_px = curr_underlying_px
            else:
                opt_px, _ = BlackScholesPricer.price_option(
                    spot=curr_underlying_px,
                    strike=pos.contract.strike_price,
                    time_to_expiry_years=3.0 / 365.0,
                    volatility=0.14,
                    is_call=(pos.contract.instrument_type == InstrumentType.INDEX_OPTION_CE)
                )
                contract_px = opt_px

            closed_pos = self.paper_broker.update_position_price(sym_key, contract_px)
            if closed_pos:
                self.risk_manager.register_position_exit(pos.contract.underlying, closed_pos.realized_pnl)
                logger.info(f"Position closed automatically: {closed_pos.symbol} (PnL: ₹{closed_pos.realized_pnl})")
                self._persist_closed_trade(closed_pos)

        is_demo = hasattr(self.provider, "advance_candle_tick")
        if is_demo and (self.candle_tick_counter % 6 == 0):
            for sym in self.watched_symbols:
                self.provider.advance_candle_tick(sym)

        for sym in self.watched_symbols:
            await self._evaluate_symbol_pipeline(sym)

    async def _evaluate_symbol_pipeline(self, symbol: str):
        df = await self.provider.get_candles(symbol, timeframe="5m", bars=150)
        if df.empty or len(df) < 50:
            return

        time_col = "datetime" if "datetime" in df.columns else "timestamp"
        latest_candle_time = str(df[time_col].iloc[-1])
        if self.last_processed_timestamps.get(symbol) == latest_candle_time:
            return

        self.last_processed_timestamps[symbol] = latest_candle_time
        meta_list = [m for m in self.provider.get_supported_instruments() if m.symbol == symbol]
        inst_meta = meta_list[0] if meta_list else None
        asset_type = inst_meta.asset_type if inst_meta else AssetType.INDEX_F_AND_O

        df_out, signals = self.v12_engine.compute(df)
        if not signals:
            return

        last_signal = signals[-1]
        is_latest_bar = (last_signal.meta.get("bar_index") == (len(df_out) - 1))
        if not is_latest_bar or last_signal.signal == SignalType.HOLD:
            return

        context = MarketContext(
            symbol=symbol,
            timeframe="5m",
            current_time=datetime.now().isoformat(),
            data_timestamp=latest_candle_time,
            adx=AIVerificationEngine.calc_adx(df_out),
            fast_ema=float(last_signal.meta.get("fast_ema", df_out["close"].iloc[-1])),
            slow_ema=float(last_signal.meta.get("slow_ema", df_out["close"].iloc[-1])),
            ema_50=float(df_out["close"].ewm(span=50).mean().iloc[-1]),
            ema_200=float(df_out["close"].ewm(span=200).mean().iloc[-1] if len(df_out) >= 200 else df_out["close"].mean()),
            volume_ratio=float(df["volume"].iloc[-1] / max(1.0, df["volume"].rolling(20).mean().iloc[-1])),
            existing_open_positions=len(self.paper_broker.open_positions),
            existing_position_direction=list(self.paper_broker.open_positions.values())[0].side if self.paper_broker.open_positions else None,
            data_age_seconds=5.0
        )
        ai_res = self.ai_verifier.evaluate(last_signal, context)

        safe_atr = float(last_signal.meta.get("safe_atr", 50.0))
        contract = ContractResolver.resolve_contract(
            underlying=symbol,
            spot_price=float(last_signal.close_price),
            direction_is_buy=(last_signal.signal == SignalType.BUY),
            trade_type="SPOT" if asset_type == AssetType.CRYPTO_SPOT else "OPTION"
        )

        if asset_type == AssetType.CRYPTO_SPOT:
            entry_est_price = float(last_signal.close_price)
            eff_atr = safe_atr
        else:
            opt_px, _ = BlackScholesPricer.price_option(
                spot=float(last_signal.close_price),
                strike=contract.strike_price,
                time_to_expiry_years=3.0 / 365.0,
                volatility=0.14,
                is_call=(contract.instrument_type == InstrumentType.INDEX_OPTION_CE)
            )
            entry_est_price = opt_px
            eff_atr = safe_atr * 0.5

        risk_res = self.risk_manager.evaluate_order(
            symbol=symbol,
            ai_result=ai_res,
            current_price=entry_est_price,
            safe_atr=eff_atr,
            lot_size=contract.lot_size,
            asset_type=asset_type,
            contract_type="SPOT" if asset_type == AssetType.CRYPTO_SPOT else "OPTION"
        )

        executed = False
        order_id = None
        fill_price = None

        decision_chain = {
            "stage1_v12": {
                "signal": last_signal.signal.value,
                "confidence": last_signal.confidence,
                "fuel_state": last_signal.fuel_state.value,
                "pattern": last_signal.pattern_text
            },
            "stage2_ai": {
                "decision": ai_res.decision.value,
                "score": ai_res.ai_score,
                "reason": ai_res.summary_reason
            },
            "stage3_risk": {
                "status": risk_res.status.value,
                "reason": risk_res.reason
            }
        }

        if ai_res.decision == AIDecision.APPROVED and risk_res.status == RiskDecisionStatus.APPROVED:
            success, pos, fill_msg = self.paper_broker.execute_virtual_order(
                contract=contract,
                side="BUY",
                quantity=risk_res.quantity,
                market_price=entry_est_price,
                stop_loss=risk_res.stop_loss,
                take_profit=risk_res.take_profit,
                decision_chain=decision_chain
            )
            if success and pos:
                executed = True
                order_id = self.paper_broker.orders[-1].order_id
                fill_price = pos.entry_price
                self.risk_manager.active_positions[symbol] = {"symbol": symbol, "side": last_signal.signal.value}
                self.risk_manager.today_trades_count += 1
                logger.info(f"Automated paper order filled: {contract.symbol} @ {fill_price}")

        self._persist_signal_log(symbol, asset_type, last_signal, ai_res, risk_res, executed, order_id, fill_price)

    def _persist_signal_log(self, symbol, asset_type, sig, ai_res, risk_res, executed, order_id, fill_price):
        db = SessionLocal()
        try:
            db_log = SignalLog(
                symbol=symbol,
                asset_type=asset_type.value,
                timeframe="5m",
                timestamp=str(sig.timestamp),
                stage1_signal=sig.signal.value,
                stage1_confidence=sig.confidence,
                close_price=sig.close_price,
                baseline=sig.baseline,
                fuel_state=sig.fuel_state.value,
                rsi=sig.rsi,
                chop_index=sig.chop_index,
                ai_decision=ai_res.decision.value,
                ai_score=ai_res.ai_score,
                ai_reason=ai_res.summary_reason,
                ai_breakdown=ai_res.factor_breakdown,
                risk_status=risk_res.status.value,
                risk_reason=risk_res.reason,
                executed=executed,
                order_id=order_id,
                fill_price=fill_price,
                data_source=self.provider.data_mode.value
            )
            db.add(db_log)
            db.commit()
        except Exception as e:
            logger.error(f"Error saving signal log: {e}")
        finally:
            db.close()

    def _persist_closed_trade(self, pos):
        db = SessionLocal()
        try:
            rec = TradeRecord(
                position_id=pos.position_id,
                symbol=pos.contract.underlying,
                asset_type=pos.contract.asset_type.value,
                contract_symbol=pos.symbol,
                side=pos.side,
                quantity=pos.quantity,
                entry_price=pos.entry_price,
                exit_price=pos.exit_price,
                stop_loss=pos.stop_loss,
                take_profit=pos.take_profit,
                status=pos.status.value,
                opened_at=pos.opened_at,
                closed_at=pos.closed_at,
                realized_pnl=pos.realized_pnl,
                charges_paid=pos.total_charges_paid,
                exit_reason=pos.exit_reason,
                decision_chain=pos.decision_chain,
                data_source=self.provider.data_mode.value
            )
            db.add(rec)
            db.commit()
        except Exception as e:
            logger.error(f"Error saving closed trade: {e}")
        finally:
            db.close()


automated_trader = AutomatedPaperTrader()

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    logger.info("Starting standalone Automated Paper Trader worker...")
    asyncio.run(automated_trader.run_loop())
