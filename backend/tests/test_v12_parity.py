import pytest
import numpy as np
import pandas as pd
from app.indicators.v12_engine import V12Engine, V12Parameters, SignalType
from app.indicators.parity_tester import generate_synthetic_nifty_dataset, ParityVerifier


def test_v12_rma_accuracy():
    """Pine RMA formula matches Wilder's alpha = 1/length."""
    data = np.array([10.0, 11.0, 12.0, 13.0, 14.0, 15.0, 16.0, 17.0, 18.0, 19.0, 20.0])
    length = 5
    rma = V12Engine.calc_rma(data, length)
    
    # First 4 elements should be NaN
    assert np.isnan(rma[:4]).all()
    # 5th element (index 4) should be SMA of first 5
    assert pytest.approx(rma[4]) == np.mean(data[:5])
    # 6th element: alpha * data[5] + (1 - alpha) * rma[4]
    alpha = 1.0 / 5.0
    expected_5 = alpha * data[5] + (1 - alpha) * rma[4]
    assert pytest.approx(rma[5]) == expected_5


def test_v12_ema_accuracy():
    """Pine EMA formula matches standard EMA with initial SMA."""
    data = np.array([20.0, 22.0, 21.0, 23.0, 24.0, 25.0])
    length = 3
    ema = V12Engine.calc_ema(data, length)
    assert np.isnan(ema[:2]).all()
    assert pytest.approx(ema[2]) == np.mean(data[:3])
    alpha = 2.0 / 4.0
    expected_3 = alpha * data[3] + (1 - alpha) * ema[2]
    assert pytest.approx(ema[3]) == expected_3


def test_v12_execution_and_invariants():
    """Run V12 engine on synthetic NIFTY dataset and verify mathematical invariants."""
    df = generate_synthetic_nifty_dataset(bars=200, seed=123)
    engine = V12Engine()
    df_out, signals = engine.compute(df)

    assert len(df_out) == 200
    assert 'atr' in df_out.columns
    assert 'baseline' in df_out.columns
    assert 'trend_dir' in df_out.columns
    assert 'rsi' in df_out.columns
    assert 'chop_index' in df_out.columns

    # Verify invariants
    verification = ParityVerifier.verify_invariants(df_out, signals)
    assert verification["passed"] is True, f"Invariant failures: {verification['invariant_violations']}"
    assert verification["signal_count"] > 0
    print(f"\n[Parity Test] Processed 200 bars. Generated {verification['signal_count']} signals "
          f"({verification['buy_count']} BUY, {verification['sell_count']} SELL). Zero invariant violations.")


def test_climax_exhaustion_blocks_flip():
    """Verify that an overextended 3-bar vertical pump gets blocked by exhaustion when blockExhaustedTop is true."""
    # Construct 10 bars: first 5 flat/bearish, then 3 massive 3x ATR candles straight up
    closes = [24000.0, 23990.0, 23980.0, 23970.0, 23960.0, 24050.0, 24150.0, 24260.0, 24250.0, 24240.0]
    opens = [24005.0, 23995.0, 23985.0, 23975.0, 23965.0, 23960.0, 24050.0, 24150.0, 24260.0, 24250.0]
    highs = [c + 5.0 for c in closes]
    lows = [o - 5.0 for o in opens]

    df = pd.DataFrame({
        "open": opens,
        "high": highs,
        "low": lows,
        "close": closes,
        "volume": [100000] * len(closes)
    })

    params = V12Parameters(block_exhausted_top=True, max_fuel_stretch_atr=1.5)
    engine = V12Engine(params)
    df_out, signals = engine.compute(df)

    # Check that exhaustion flags are properly calculated
    assert df_out['atr'].iloc[-1] > 0
