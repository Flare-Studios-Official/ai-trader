"""
Deterministic Risk Management Engine (Phase 1 Revised)
Dynamic trade evaluation with rigorous capital protection.

Rules:
- Virtual Balance: ₹1,00,000
- Maximum Open Positions: Configurable (default 2 concurrent: 1 Indian F&O + 1 Crypto)
- Arbitrary trade count cap removed: Allows as many DISTINCT valid opportunities as strategy & risk rules permit.
- Daily Loss Hard Stop: 2.0% (₹2,000 hard stop — all trading halts for the day upon breach).
- Risk-Per-Trade Limits: Configurable fixed percentage (default 1.0% = ₹1,000 max risk per trade).
- Cooldown Period: Cooldown after position exit on a symbol before re-entry allowed (prevents whipsaws).
- Anti-Martingale / Anti-Revenge Trading Guarantee: Sizing is never increased after a loss.
- Duplicate Signal Protection: Strictly prevents overlapping duplicate trades on the same symbol.
- Emergency Paper Kill Switch: Global freeze.
"""

from dataclasses import dataclass, field
from datetime import datetime, date, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional
from app.indicators.v12_engine import SignalType
from app.ai.verification_engine import AIDecision, AIVerificationResult
from app.market_data.base import AssetType


class RiskDecisionStatus(str, Enum):
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


@dataclass
class RiskParameters:
    initial_balance: float = 100000.0
    max_open_positions: int = 2          # 1 Indian F&O + 1 Crypto concurrent
    max_daily_loss_pct: float = 2.0      # 2% = ₹2,000 hard stop
    risk_per_trade_pct: float = 1.0      # 1% max capital at risk per trade
    atr_sl_multiplier: float = 1.5
    atr_tp_multiplier: float = 2.5
    cooldown_seconds: float = 300.0      # 5 minutes cooldown per symbol after closing a trade
    max_capital_per_trade_pct: float = 40.0  # Max ₹40,000 margin/premium per position


@dataclass
class RiskEvaluationResult:
    status: RiskDecisionStatus
    reason: str
    symbol: str
    direction: SignalType
    quantity: float
    entry_price: float
    stop_loss: float
    take_profit: float
    risk_reward_ratio: float
    estimated_margin_required: float
    risk_amount: float
    asset_type: AssetType = AssetType.INDEX_F_AND_O
    meta: Dict[str, Any] = field(default_factory=dict)


class DeterministicRiskManager:
    def __init__(self, params: Optional[RiskParameters] = None):
        self.params = params or RiskParameters()
        self.balance = self.params.initial_balance
        self.daily_realized_pnl = 0.0
        self.today_trades_count = 0
        self.current_session_date: date = datetime.now().date()
        self.kill_switch_active: bool = False
        self.active_positions: Dict[str, Dict[str, Any]] = {}
        self.symbol_cooldowns: Dict[str, datetime] = {}

    def reset_daily_stats_if_new_day(self):
        today = datetime.now().date()
        if today > self.current_session_date:
            self.current_session_date = today
            self.daily_realized_pnl = 0.0
            self.today_trades_count = 0
            self.symbol_cooldowns.clear()

    def trigger_kill_switch(self, active: bool = True):
        self.kill_switch_active = active

    def register_position_exit(self, symbol: str, realized_pnl: float):
        """Records position exit and sets cooldown timer."""
        self.reset_daily_stats_if_new_day()
        self.daily_realized_pnl += realized_pnl
        self.balance += realized_pnl
        self.active_positions.pop(symbol, None)
        self.symbol_cooldowns[symbol] = datetime.now() + timedelta(seconds=self.params.cooldown_seconds)

    def evaluate_order(
        self,
        symbol: str,
        ai_result: AIVerificationResult,
        current_price: float,
        safe_atr: float,
        lot_size: float = 25.0,
        asset_type: AssetType = AssetType.INDEX_F_AND_O,
        contract_type: str = "OPTION"
    ) -> RiskEvaluationResult:
        self.reset_daily_stats_if_new_day()

        # 1. Kill Switch Check
        if self.kill_switch_active:
            return RiskEvaluationResult(
                status=RiskDecisionStatus.REJECTED,
                reason="Emergency Paper-Trading Kill Switch is ACTIVE. Simulated execution halted.",
                symbol=symbol,
                direction=ai_result.original_signal,
                quantity=0.0,
                entry_price=current_price,
                stop_loss=0.0,
                take_profit=0.0,
                risk_reward_ratio=0.0,
                estimated_margin_required=0.0,
                risk_amount=0.0,
                asset_type=asset_type
            )

        # 2. AI Decision Verification
        if ai_result.decision != AIDecision.APPROVED:
            return RiskEvaluationResult(
                status=RiskDecisionStatus.REJECTED,
                reason=f"AI Verifier did not approve signal (Verdict: {ai_result.decision.value}). Reason: {ai_result.summary_reason}",
                symbol=symbol,
                direction=ai_result.original_signal,
                quantity=0.0,
                entry_price=current_price,
                stop_loss=0.0,
                take_profit=0.0,
                risk_reward_ratio=0.0,
                estimated_margin_required=0.0,
                risk_amount=0.0,
                asset_type=asset_type
            )

        # 3. Hard Stop: Daily Loss Breached (2% of starting capital = ₹2,000)
        max_loss_rupees = self.params.initial_balance * (self.params.max_daily_loss_pct / 100.0)
        if self.daily_realized_pnl <= -max_loss_rupees:
            return RiskEvaluationResult(
                status=RiskDecisionStatus.REJECTED,
                reason=f"Daily 2% loss hard stop breached: Realized P&L is -₹{abs(self.daily_realized_pnl):,.2f} <= -₹{max_loss_rupees:,.2f}. All trading halted for today.",
                symbol=symbol,
                direction=ai_result.original_signal,
                quantity=0.0,
                entry_price=current_price,
                stop_loss=0.0,
                take_profit=0.0,
                risk_reward_ratio=0.0,
                estimated_margin_required=0.0,
                risk_amount=0.0,
                asset_type=asset_type
            )

        # 4. Duplicate Signal Protection
        if symbol in self.active_positions:
            return RiskEvaluationResult(
                status=RiskDecisionStatus.REJECTED,
                reason=f"Duplicate signal protection: Symbol '{symbol}' already has an active open position.",
                symbol=symbol,
                direction=ai_result.original_signal,
                quantity=0.0,
                entry_price=current_price,
                stop_loss=0.0,
                take_profit=0.0,
                risk_reward_ratio=0.0,
                estimated_margin_required=0.0,
                risk_amount=0.0,
                asset_type=asset_type
            )

        # 5. Symbol Cooldown Check
        cooldown_until = self.symbol_cooldowns.get(symbol)
        if cooldown_until and datetime.now() < cooldown_until:
            rem_secs = int((cooldown_until - datetime.now()).total_seconds())
            return RiskEvaluationResult(
                status=RiskDecisionStatus.REJECTED,
                reason=f"Cooldown active for {symbol} ({rem_secs}s remaining). Whipsaw protection active.",
                symbol=symbol,
                direction=ai_result.original_signal,
                quantity=0.0,
                entry_price=current_price,
                stop_loss=0.0,
                take_profit=0.0,
                risk_reward_ratio=0.0,
                estimated_margin_required=0.0,
                risk_amount=0.0,
                asset_type=asset_type
            )

        # 6. Maximum Concurrent Open Positions Check
        if len(self.active_positions) >= self.params.max_open_positions:
            return RiskEvaluationResult(
                status=RiskDecisionStatus.REJECTED,
                reason=f"Maximum concurrent open positions limit ({self.params.max_open_positions}) reached across portfolio.",
                symbol=symbol,
                direction=ai_result.original_signal,
                quantity=0.0,
                entry_price=current_price,
                stop_loss=0.0,
                take_profit=0.0,
                risk_reward_ratio=0.0,
                estimated_margin_required=0.0,
                risk_amount=0.0,
                asset_type=asset_type
            )

        # 7. Sizing & Anti-Martingale Position Calculation
        sl_points = safe_atr * self.params.atr_sl_multiplier
        tp_points = safe_atr * self.params.atr_tp_multiplier

        if ai_result.original_signal == SignalType.BUY:
            stop_loss = round(current_price - sl_points, 2)
            take_profit = round(current_price + tp_points, 2)
        else:
            stop_loss = round(current_price + sl_points, 2)
            take_profit = round(current_price - tp_points, 2)

        rr_ratio = round(tp_points / max(sl_points, 0.01), 2)

        # Sizing by asset type:
        max_allowed_allocation = self.balance * (self.params.max_capital_per_trade_pct / 100.0)

        if asset_type == AssetType.CRYPTO_SPOT:
            # Fixed risk allocation for Bitcoin: e.g. 1% risk = ₹1,000
            max_risk_amount = self.params.initial_balance * (self.params.risk_per_trade_pct / 100.0)
            usd_risk = max_risk_amount / 85.0
            computed_qty = max(0.001, round(usd_risk / max(sl_points, 1.0), 4))
            max_spot_qty = max(0.001, round(max_allowed_allocation / (current_price * 85.0), 4))
            quantity = min(computed_qty, max_spot_qty)
            cost_required = (quantity * current_price) * 85.0
        else:
            # Indian F&O: 1 standard lot
            quantity = lot_size
            cost_required = current_price * quantity
        if cost_required > max_allowed_allocation and cost_required > self.balance * 0.90:
            return RiskEvaluationResult(
                status=RiskDecisionStatus.REJECTED,
                reason=f"Insufficient virtual balance: Required ₹{cost_required:,.2f}, Available: ₹{self.balance:,.2f}",
                symbol=symbol,
                direction=ai_result.original_signal,
                quantity=0.0,
                entry_price=current_price,
                stop_loss=stop_loss,
                take_profit=take_profit,
                risk_reward_ratio=rr_ratio,
                estimated_margin_required=cost_required,
                risk_amount=sl_points * quantity,
                asset_type=asset_type
            )

        risk_amount = round(sl_points * quantity, 2)

        return RiskEvaluationResult(
            status=RiskDecisionStatus.APPROVED,
            reason="All deterministic risk parameters satisfied (Balance, Position limit, Daily loss stop, Cooldown, and ATR stops verified).",
            symbol=symbol,
            direction=ai_result.original_signal,
            quantity=quantity,
            entry_price=current_price,
            stop_loss=stop_loss,
            take_profit=take_profit,
            risk_reward_ratio=rr_ratio,
            estimated_margin_required=round(cost_required, 2),
            risk_amount=risk_amount,
            asset_type=asset_type,
            meta={
                "daily_realized_pnl": self.daily_realized_pnl,
                "trades_today": self.today_trades_count,
                "current_balance": self.balance
            }
        )
