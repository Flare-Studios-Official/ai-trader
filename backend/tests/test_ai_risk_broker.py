import pytest
from app.indicators.v12_engine import V12Signal, SignalType, FuelState
from app.ai.verification_engine import AIVerificationEngine, MarketContext, AIDecision, AIVerificationResult
from app.risk.risk_manager import DeterministicRiskManager, RiskDecisionStatus
from app.broker.instruments import ContractResolver, BlackScholesPricer
from app.broker.paper_broker import CloudPaperBroker, PositionStatus
from app.market_data.base import AssetType


def test_ai_verifier_approves_strong_signal():
    engine = AIVerificationEngine()
    signal = V12Signal(
        timestamp="2026-11-23 10:00:00",
        signal=SignalType.BUY,
        confidence=75,
        trend_dir=1,
        close_price=24500.0,
        baseline=24400.0,
        fuel_state=FuelState.COILED_SPRING,
        three_bar_stretch_atr=1.1,
        pattern_text="Engulfing",
        rsi=58.0,
        chop_index=45.0,
        is_exhausted=False,
        hitting_wall=False,
        is_sideways_box=False
    )
    context = MarketContext(
        symbol="NIFTY",
        timeframe="5m",
        current_time="2026-11-23 10:00:00",
        data_timestamp="2026-11-23 10:00:00",
        adx=28.0,
        fast_ema=24520.0,
        slow_ema=24480.0,
        ema_50=24400.0,
        ema_200=24100.0,
        volume_ratio=1.4,
        data_age_seconds=60.0
    )

    result = engine.evaluate(signal, context)
    assert result.decision == AIDecision.APPROVED
    assert result.original_signal == SignalType.BUY
    assert result.ai_score >= 65.0


def test_ai_verifier_rejects_stale_data():
    engine = AIVerificationEngine(max_allowed_data_age_secs=300.0)
    signal = V12Signal(
        timestamp="2026-11-23 09:15:00",
        signal=SignalType.BUY,
        confidence=80,
        trend_dir=1,
        close_price=24500.0,
        baseline=24400.0,
        fuel_state=FuelState.FRESH_BREAKOUT,
        three_bar_stretch_atr=1.0,
        pattern_text="",
        rsi=55.0,
        chop_index=45.0,
        is_exhausted=False,
        hitting_wall=False,
        is_sideways_box=False
    )
    context = MarketContext(
        symbol="NIFTY",
        timeframe="5m",
        current_time="2026-11-23 09:40:00",
        data_timestamp="2026-11-23 09:15:00",
        adx=25.0,
        fast_ema=24500.0,
        slow_ema=24450.0,
        ema_50=24400.0,
        ema_200=24100.0,
        volume_ratio=1.0,
        data_age_seconds=1500.0
    )

    result = engine.evaluate(signal, context)
    assert result.decision == AIDecision.REJECTED
    assert "stale" in result.summary_reason.lower()


def test_deterministic_risk_manager_bitcoin_and_cooldown():
    rm = DeterministicRiskManager()
    ai_approved = AIVerificationResult(
        original_signal=SignalType.BUY,
        decision=AIDecision.APPROVED,
        ai_score=85.0,
        confidence_stage1=80,
        summary_reason="AI Approved"
    )

    # 1. Bitcoin Order evaluation
    res_btc = rm.evaluate_order(
        symbol="BTC/USDT",
        ai_result=ai_approved,
        current_price=68000.0,
        safe_atr=350.0,
        asset_type=AssetType.CRYPTO_SPOT
    )
    assert res_btc.status == RiskDecisionStatus.APPROVED
    assert res_btc.quantity > 0.0
    assert res_btc.stop_loss < 68000.0
    assert res_btc.take_profit > 68000.0

    # 2. Simulate position exit and test cooldown
    rm.register_position_exit("BTC/USDT", realized_pnl=250.0)
    assert rm.balance > 100000.0

    # Attempt immediate re-entry on same symbol -> should reject due to cooldown
    res_cooldown = rm.evaluate_order(
        symbol="BTC/USDT",
        ai_result=ai_approved,
        current_price=68050.0,
        safe_atr=350.0,
        asset_type=AssetType.CRYPTO_SPOT
    )
    assert res_cooldown.status == RiskDecisionStatus.REJECTED
    assert "Cooldown active" in res_cooldown.reason


def test_paper_broker_crypto_order_and_fees():
    """Verify virtual Bitcoin spot order execution and crypto 0.1% fee (no Indian statutory tax)."""
    broker = CloudPaperBroker(initial_capital=100000.0)
    contract = ContractResolver.resolve_contract("BTC/USDT", spot_price=68000.0, direction_is_buy=True)
    
    assert contract.symbol == "BTC/USDT"
    assert contract.asset_type == AssetType.CRYPTO_SPOT

    success, pos, msg = broker.execute_virtual_order(
        contract=contract,
        side="BUY",
        quantity=0.01,
        market_price=68000.0,
        stop_loss=67000.0,
        take_profit=70000.0
    )

    assert success is True
    assert pos is not None
    assert pos.symbol == "BTC/USDT"
    assert broker.available_balance < 100000.0
    assert pos.total_charges_paid > 0  # 0.1% crypto fee

    # Price rise to 69000
    broker.update_position_price("BTC/USDT", 69000.0)
    assert pos.unrealized_pnl > 0

    # Close
    closed = broker.close_position("BTC/USDT", 69200.0, exit_reason="Target Met")
    assert closed is not None
    assert closed.realized_pnl > 0
    assert len(broker.trade_history) == 1
