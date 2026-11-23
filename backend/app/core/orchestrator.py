"""
AI Trader Pipeline Orchestrator (Phase 1 Revised)
Coordinates Market Data Provider, Automated Paper Trader, WebSockets, and Global State.
"""

import asyncio
from datetime import datetime
import json
import logging
from typing import Any, Dict, List, Optional, Set
import numpy as np
import pandas as pd
from fastapi import WebSocket

from app.market_data.base import BaseMarketDataProvider, AssetType, DataMode
from app.market_data.factory import get_market_data_provider
from app.core.automated_trader import automated_trader
from app.core.database import SessionLocal, SignalLog, TradeRecord, init_db

logger = logging.getLogger("Orchestrator")


class PipelineOrchestrator:
    def __init__(self):
        self.provider: BaseMarketDataProvider = get_market_data_provider()
        self.automated_trader = automated_trader
        self.connected_websockets: Set[WebSocket] = set()

    async def register_websocket(self, ws: WebSocket):
        await ws.accept()
        self.connected_websockets.add(ws)
        await self.broadcast_snapshot(ws_only=ws)

    def unregister_websocket(self, ws: WebSocket):
        self.connected_websockets.discard(ws)

    async def broadcast_event(self, event_type: str, data: Any):
        if not self.connected_websockets:
            return
        payload = json.dumps({"type": event_type, "data": data, "timestamp": datetime.now().isoformat()})
        dead = []
        for ws in self.connected_websockets:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for d in dead:
            self.connected_websockets.discard(d)

    async def broadcast_snapshot(self, ws_only: Optional[WebSocket] = None):
        snapshot = await self.get_dashboard_state()
        payload = json.dumps({"type": "FULL_SNAPSHOT", "data": snapshot, "timestamp": datetime.now().isoformat()})
        if ws_only:
            try:
                await ws_only.send_text(payload)
            except Exception:
                self.connected_websockets.discard(ws_only)
        else:
            await self.broadcast_event("SNAPSHOT_UPDATE", snapshot)

    async def get_dashboard_state(self) -> Dict[str, Any]:
        broker = self.automated_trader.paper_broker
        risk_mgr = self.automated_trader.risk_manager
        portfolio = broker.get_portfolio_summary()

        open_pos = [
            {
                "position_id": p.position_id,
                "symbol": p.symbol,
                "asset_type": p.contract.asset_type.value,
                "side": p.side,
                "quantity": p.quantity,
                "entry_price": p.entry_price,
                "current_price": p.current_price,
                "stop_loss": p.stop_loss,
                "take_profit": p.take_profit,
                "unrealized_pnl": p.unrealized_pnl,
                "opened_at": p.opened_at,
                "decision_chain": p.decision_chain
            }
            for p in broker.open_positions.values()
        ]

        history = [
            {
                "position_id": p.position_id,
                "symbol": p.symbol,
                "asset_type": p.contract.asset_type.value,
                "side": p.side,
                "quantity": p.quantity,
                "entry_price": p.entry_price,
                "exit_price": p.exit_price,
                "realized_pnl": p.realized_pnl,
                "opened_at": p.opened_at,
                "closed_at": p.closed_at,
                "exit_reason": p.exit_reason,
                "total_charges": p.total_charges_paid
            }
            for p in reversed(broker.trade_history[-25:])
        ]

        # Recent signals from database
        db = SessionLocal()
        try:
            recent_db_signals = db.query(SignalLog).order_by(SignalLog.id.desc()).limit(20).all()
            sig_list = [
                {
                    "id": s.id,
                    "symbol": s.symbol,
                    "asset_type": s.asset_type,
                    "timestamp": s.timestamp,
                    "stage1_signal": s.stage1_signal,
                    "stage1_confidence": s.stage1_confidence,
                    "close_price": s.close_price,
                    "baseline": s.baseline,
                    "fuel_state": s.fuel_state,
                    "ai_decision": s.ai_decision,
                    "ai_score": s.ai_score,
                    "ai_reason": s.ai_reason,
                    "risk_status": s.risk_status,
                    "risk_reason": s.risk_reason,
                    "executed": s.executed,
                    "order_id": s.order_id,
                    "fill_price": s.fill_price,
                    "data_source": s.data_source
                }
                for s in recent_db_signals
            ]
        finally:
            db.close()

        # Build market watch for all supported instruments
        market_watch = []
        for inst in self.provider.get_supported_instruments():
            try:
                quote = await self.provider.get_quote(inst.symbol)
                df = await self.provider.get_candles(inst.symbol, timeframe="5m", bars=60)
                
                # Run V12 for baseline
                df_out, _ = self.automated_trader.v12_engine.compute(df)
                last_row = df_out.iloc[-1]
                trend = int(last_row["trend_dir"])
                conf = int(last_row["buy_confidence"] if trend == 1 else last_row["sell_confidence"])

                market_watch.append({
                    "symbol": inst.symbol,
                    "display_name": inst.display_name,
                    "asset_type": inst.asset_type.value,
                    "price": quote.price,
                    "change": quote.change_24h,
                    "change_pct": quote.change_pct_24h,
                    "baseline": float(last_row["baseline"]),
                    "trend": trend,
                    "atr": float(last_row["atr"]),
                    "rsi": float(last_row["rsi"]),
                    "chop_index": float(last_row["chop_index"]),
                    "confidence": conf,
                    "is_24_7": inst.is_24_7,
                    "base_currency": inst.base_currency,
                    "data_mode": quote.data_mode.value
                })
            except Exception as e:
                logger.error(f"Error building market watch item for {inst.symbol}: {e}")

        return {
            "portfolio": portfolio,
            "open_positions": open_pos,
            "trade_history": history,
            "recent_signals": sig_list,
            "market_watch": market_watch,
            "system_status": {
                "data_mode": self.provider.data_mode.value,
                "provider_name": self.provider.provider_name,
                "status_message": self.provider.status_message,
                "is_connected": self.provider.is_connected,
                "automated_trading_active": self.automated_trader.is_active,
                "database_status": "Supabase PostgreSQL / SQLite Connected",
                "kill_switch_active": risk_mgr.kill_switch_active,
                "today_trades": risk_mgr.today_trades_count,
                "daily_realized_pnl": risk_mgr.daily_realized_pnl,
                "max_open_positions": risk_mgr.params.max_open_positions,
                "max_daily_loss_pct": risk_mgr.params.max_daily_loss_pct,
                "risk_per_trade_pct": risk_mgr.params.risk_per_trade_pct
            }
        }


orchestrator = PipelineOrchestrator()
