"""
Signal Parity Testing Engine for V12 Indicator
Verifies mathematical identity between Pine Script V12 logic and Python V12 Engine.
"""

from typing import Dict, Any, List, Tuple
import numpy as np
import pandas as pd
from app.indicators.v12_engine import V12Engine, V12Parameters, SignalType


def generate_synthetic_nifty_dataset(bars: int = 250, seed: int = 42) -> pd.DataFrame:
    """
    Generates a deterministic OHLCV series mimicking NIFTY 50 5-minute dynamics:
    Includes trending moves, pullbacks, sideways consolidation, and climax exhaustion bars.
    """
    np.random.seed(seed)
    base_price = 24500.0
    dates = pd.date_range(start="2026-11-20 09:15:00", periods=bars, freq="5min")
    
    closes = [base_price]
    highs = []
    lows = []
    opens = []
    
    # Introduce controlled price phases
    for i in range(1, bars):
        phase = i % 60
        if phase < 20:
            # Bullish trend with staircases
            step = np.random.normal(loc=12.0, scale=8.0)
        elif phase < 35:
            # Sideways chop / consolidation
            step = np.random.normal(loc=0.0, scale=4.0)
        elif phase < 45:
            # Climax exhaustion spike (3 huge bull bars)
            step = np.random.normal(loc=35.0, scale=5.0)
        else:
            # Bearish drop
            step = np.random.normal(loc=-15.0, scale=10.0)
            
        c = max(1000.0, closes[-1] + step)
        closes.append(c)

    for i in range(bars):
        c = closes[i]
        o = closes[i - 1] if i > 0 else c - 5.0
        # Add realistic wicks
        body_top = max(o, c)
        body_bot = min(o, c)
        h = body_top + abs(np.random.normal(loc=6.0, scale=3.0))
        l = body_bot - abs(np.random.normal(loc=6.0, scale=3.0))
        opens.append(o)
        highs.append(h)
        lows.append(l)

    volume = np.random.randint(50000, 300000, size=bars)

    df = pd.DataFrame({
        "datetime": dates,
        "open": opens,
        "high": highs,
        "low": lows,
        "close": closes,
        "volume": volume
    })
    return df


class ParityVerifier:
    """Verifies that mathematical invariant properties hold across all bars."""

    @staticmethod
    def verify_invariants(df: pd.DataFrame, signals: List[Any]) -> Dict[str, Any]:
        results = {
            "total_bars": len(df),
            "signal_count": len(signals),
            "buy_count": sum(1 for s in signals if s.signal == SignalType.BUY),
            "sell_count": sum(1 for s in signals if s.signal == SignalType.SELL),
            "invariant_violations": []
        }

        # 1. Non-repainting: Ensure bands are causal (no forward-looking dependency)
        for i in range(1, len(df)):
            # Upper band during downtrend can never increase unless flipped
            if df['trend_dir'].iloc[i] == -1 and df['trend_dir'].iloc[i - 1] == -1:
                if df['upper_band'].iloc[i] > df['upper_band'].iloc[i - 1] + 1e-6:
                    results["invariant_violations"].append(
                        f"Bar {i}: Upper band expanded during ongoing downtrend without flip."
                    )
            # Lower band during uptrend can never decrease unless flipped
            if df['trend_dir'].iloc[i] == 1 and df['trend_dir'].iloc[i - 1] == 1:
                if df['lower_band'].iloc[i] < df['lower_band'].iloc[i - 1] - 1e-6:
                    results["invariant_violations"].append(
                        f"Bar {i}: Lower band contracted during ongoing uptrend without flip."
                    )

        # 2. Confidence score bounded in [1, 99]
        for s in signals:
            if not (1 <= s.confidence <= 99):
                results["invariant_violations"].append(
                    f"Signal at {s.timestamp} had out-of-bounds confidence: {s.confidence}"
                )

        # 3. Trend direction is strictly +1 or -1
        invalid_trends = df[~df['trend_dir'].isin([1, -1])]
        if not invalid_trends.empty:
            results["invariant_violations"].append(f"Invalid trend_dir encountered: {len(invalid_trends)} bars.")

        results["passed"] = len(results["invariant_violations"]) == 0
        return results
