"""
V12 Indicator Engine — Pure Python Implementation
Faithfully reproduces TradingView Pine Script V12 (@version=6 by moizcity123).

Features:
- Volatility-Adaptive Supertrend Baseline
- Fuel Tank (3-Bar Stretch) Climax Exhaustion Detection
- Coiled Spring (Higher-Low / Lower-High Staircase) Structure
- 15-Bar Box Ceiling & Floor Proximity Wall Checks
- Candlestick Pattern Memory (Engulfing, Hammer, Shooting Star, Marubozu)
- 4-Pillar Confidence Scoring Engine (0-100 pts scale)
- Dynamic Index-Adaptive Chop Filter (Choppiness Index 14)
- 100% Non-Repainting Guarantee on Completed (Closed) Bars
"""

from dataclasses import dataclass, field
from enum import Enum
import math
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd


class SignalType(str, Enum):
    BUY = "BUY"
    SELL = "SELL"
    HOLD = "HOLD"


class FuelState(str, Enum):
    FRESH_BREAKOUT = "Fresh Breakout"
    FRESH_BREAKDOWN = "Fresh Breakdown"
    COILED_SPRING = "Coiled Spring (Full Fuel)"
    EXHAUSTED = "Exhausted (Low Fuel)"
    MODERATE = "Moderate Fuel"


@dataclass
class V12Signal:
    timestamp: Any
    signal: SignalType
    confidence: int
    trend_dir: int
    close_price: float
    baseline: float
    fuel_state: FuelState
    three_bar_stretch_atr: float
    pattern_text: str
    rsi: float
    chop_index: float
    is_exhausted: bool
    hitting_wall: bool
    is_sideways_box: bool
    meta: Dict[str, Any] = field(default_factory=dict)


@dataclass
class V12Parameters:
    atr_length: int = 10
    base_factor: float = 2.0
    use_adaptive: bool = True
    lock_on_close: bool = True
    block_exhausted_top: bool = True
    max_fuel_stretch_atr: float = 1.85
    wall_lookback: int = 15
    use_auto_atr_chop: bool = True
    min_points_threshold: float = 10.0
    pattern_memory_bars: int = 4
    rsi_length: int = 14
    min_confidence_show: int = 1
    mintick: float = 0.05


class V12Engine:
    def __init__(self, params: Optional[V12Parameters] = None):
        self.params = params or V12Parameters()

    @staticmethod
    def calc_rma(series: np.ndarray, length: int) -> np.ndarray:
        """Pine Script ta.rma (Wilder's moving average)."""
        rma = np.empty_like(series, dtype=float)
        alpha = 1.0 / length
        if len(series) == 0:
            return rma
        
        # Initial value is simple average over first length points
        if len(series) < length:
            rma[:] = np.nan
            return rma
        
        first_sum = np.sum(series[:length])
        rma[:length - 1] = np.nan
        rma[length - 1] = first_sum / length

        for i in range(length, len(series)):
            rma[i] = alpha * series[i] + (1.0 - alpha) * rma[i - 1]
        return rma

    @staticmethod
    def calc_ema(series: np.ndarray, length: int) -> np.ndarray:
        """Pine Script ta.ema."""
        ema = np.empty_like(series, dtype=float)
        alpha = 2.0 / (length + 1)
        if len(series) == 0:
            return ema
        if len(series) < length:
            ema[:] = np.nan
            return ema

        # In Pine Script, initial EMA is SMA
        ema[:length - 1] = np.nan
        ema[length - 1] = np.mean(series[:length])
        for i in range(length, len(series)):
            ema[i] = alpha * series[i] + (1.0 - alpha) * ema[i - 1]
        return ema

    @staticmethod
    def calc_rsi(close: np.ndarray, length: int) -> np.ndarray:
        """Pine Script ta.rsi using Wilder's RMA of gains and losses."""
        n = len(close)
        rsi = np.full(n, 50.0, dtype=float)
        if n <= length:
            return rsi

        change = np.diff(close)
        gains = np.maximum(change, 0.0)
        losses = np.maximum(-change, 0.0)

        # Pad diff with a leading zero so length matches close
        gains = np.insert(gains, 0, 0.0)
        losses = np.insert(losses, 0, 0.0)

        avg_gain = V12Engine.calc_rma(gains, length)
        avg_loss = V12Engine.calc_rma(losses, length)

        for i in range(length, n):
            loss = avg_loss[i]
            gain = avg_gain[i]
            if np.isnan(loss) or np.isnan(gain):
                rsi[i] = 50.0
            elif loss == 0.0:
                rsi[i] = 100.0 if gain > 0 else 50.0
            else:
                rs = gain / loss
                rsi[i] = 100.0 - (100.0 / (1.0 + rs))
        return rsi

    def compute(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[V12Signal]]:
        """
        Calculates all V12 indicator series and signals on historical or streaming OHLCV dataframe.
        Expects columns: ['open', 'high', 'low', 'close'] (case-insensitive) and optional ['volume', 'datetime'/'timestamp'].
        """
        df = df.copy()
        # Normalize column names
        col_map = {c: c.lower() for c in df.columns}
        df = df.rename(columns=col_map)
        
        required = ['open', 'high', 'low', 'close']
        for r in required:
            if r not in df.columns:
                raise ValueError(f"Missing required price column: {r}")

        opens = df['open'].to_numpy(dtype=float)
        highs = df['high'].to_numpy(dtype=float)
        lows = df['low'].to_numpy(dtype=float)
        closes = df['close'].to_numpy(dtype=float)
        n = len(df)

        mintick = self.params.mintick
        atr_length = self.params.atr_length
        base_factor = self.params.base_factor
        use_adaptive = self.params.use_adaptive
        block_exhausted_top = self.params.block_exhausted_top
        max_fuel_stretch_atr = self.params.max_fuel_stretch_atr
        wall_lookback = self.params.wall_lookback
        use_auto_atr_chop = self.params.use_auto_atr_chop
        min_points_threshold = self.params.min_points_threshold
        pattern_memory_bars = self.params.pattern_memory_bars
        rsi_length = self.params.rsi_length
        min_confidence_show = self.params.min_confidence_show

        # 1. True Range calculation: ta.tr(true)
        tr = np.empty(n, dtype=float)
        tr[0] = highs[0] - lows[0]
        for i in range(1, n):
            h_l = highs[i] - lows[i]
            h_pc = abs(highs[i] - closes[i - 1])
            l_pc = abs(lows[i] - closes[i - 1])
            tr[i] = max(h_l, h_pc, l_pc)

        # 2. ATR & baseline
        atr_val = self.calc_rma(tr, atr_length)
        safe_atr = np.maximum(np.nan_to_num(atr_val, nan=mintick), mintick)

        # atrBaseline = ta.sma(atrVal, 50)
        atr_baseline = np.empty(n, dtype=float)
        for i in range(n):
            if i < 50:
                atr_baseline[i] = safe_atr[i]
            else:
                window = safe_atr[i - 49 : i + 1]
                atr_baseline[i] = np.mean(window)
        
        vol_ratio = safe_atr / np.maximum(atr_baseline, mintick)

        # 3. Bar properties
        body_size = np.abs(closes - opens)
        full_range = np.maximum(highs - lows, mintick)
        body_ratio = body_size / full_range
        is_bull_bar = closes > opens
        is_bear_bar = closes < opens

        # 4. Consecutive Bars
        consec_bull = np.zeros(n, dtype=int)
        consec_bear = np.zeros(n, dtype=int)
        cb = 0
        cs = 0
        for i in range(n):
            if is_bull_bar[i]:
                cb += 1
                cs = 0
            elif is_bear_bar[i]:
                cs += 1
                cb = 0
            # if doji, unchanged
            consec_bull[i] = cb
            consec_bear[i] = cs

        # 5. 3-Bar Stretch & Climax Exhaustion
        lowest3 = np.empty(n, dtype=float)
        highest3 = np.empty(n, dtype=float)
        bull_stretch_atr = np.empty(n, dtype=float)
        bear_stretch_atr = np.empty(n, dtype=float)
        is_bull_exhausted = np.zeros(n, dtype=bool)
        is_bear_exhausted = np.zeros(n, dtype=bool)

        for i in range(n):
            l3 = np.min(lows[max(0, i - 2) : i + 1])
            h3 = np.max(highs[max(0, i - 2) : i + 1])
            lowest3[i] = l3
            highest3[i] = h3
            b_stretch = (closes[i] - l3) / safe_atr[i]
            s_stretch = (h3 - closes[i]) / safe_atr[i]
            bull_stretch_atr[i] = b_stretch
            bear_stretch_atr[i] = s_stretch

            b_ex = (consec_bull[i] >= 3 and b_stretch >= max_fuel_stretch_atr) or (b_stretch >= (max_fuel_stretch_atr * 1.30))
            s_ex = (consec_bear[i] >= 3 and s_stretch >= max_fuel_stretch_atr) or (s_stretch >= (max_fuel_stretch_atr * 1.30))
            is_bull_exhausted[i] = b_ex
            is_bear_exhausted[i] = s_ex

        # 6. Staircase Structure (Higher-Low / Lower-High)
        higher_low_staircase = np.zeros(n, dtype=bool)
        lower_high_staircase = np.zeros(n, dtype=bool)
        for i in range(n):
            if i >= 5:
                recent_low3 = lowest3[i]
                prior_low3 = lowest3[i - 3]
                recent_high3 = highest3[i]
                prior_high3 = highest3[i - 3]
                hl = (recent_low3 > prior_low3) and (closes[i] > opens[i]) and (closes[i] > highs[i - 1])
                lh = (recent_high3 < prior_high3) and (closes[i] < opens[i]) and (closes[i] < lows[i - 1])
                higher_low_staircase[i] = hl
                lower_high_staircase[i] = lh

        # 7. S/R Wall Lookback (15-bar Ceiling / Floor)
        box_ceiling = np.empty(n, dtype=float)
        box_floor = np.empty(n, dtype=float)
        room_to_ceiling_atr = np.empty(n, dtype=float)
        room_to_floor_atr = np.empty(n, dtype=float)
        hitting_ceiling_wall = np.zeros(n, dtype=bool)
        hitting_floor_wall = np.zeros(n, dtype=bool)

        for i in range(n):
            if i >= wall_lookback:
                # nz(ta.highest(high, wallLookback)[1], high)
                bc = np.max(highs[i - wall_lookback : i])
                bf = np.min(lows[i - wall_lookback : i])
            elif i > 0:
                bc = np.max(highs[:i])
                bf = np.min(lows[:i])
            else:
                bc = highs[0]
                bf = lows[0]
            box_ceiling[i] = bc
            box_floor[i] = bf
            rtc = (bc - closes[i]) / safe_atr[i]
            rtf = (closes[i] - bf) / safe_atr[i]
            room_to_ceiling_atr[i] = rtc
            room_to_floor_atr[i] = rtf
            hitting_ceiling_wall[i] = (-0.15 < rtc < 0.35) and not higher_low_staircase[i]
            hitting_floor_wall[i] = (-0.15 < rtf < 0.35) and not lower_high_staircase[i]

        # 8. EMAs & Velocity
        fast_ema = self.calc_ema(closes, 8)
        slow_ema = self.calc_ema(closes, 21)
        vel_bull = (fast_ema > slow_ema) | higher_low_staircase
        vel_bear = (fast_ema < slow_ema) | lower_high_staircase

        # 9. Adaptive Supertrend Baseline Calculation
        adaptive_factor = np.empty(n, dtype=float)
        for i in range(n):
            if use_adaptive:
                clipped = max(0.80, min(1.20, 1.0 / math.sqrt(max(0.30, vol_ratio[i]))))
                adaptive_factor[i] = base_factor * clipped
            else:
                adaptive_factor[i] = base_factor

        hl2 = (highs + lows) / 2.0
        raw_upper = hl2 + (adaptive_factor * safe_atr)
        raw_lower = hl2 - (adaptive_factor * safe_atr)

        upper_band = np.zeros(n, dtype=float)
        lower_band = np.zeros(n, dtype=float)
        trend_dir = np.ones(n, dtype=int)
        buy_flip = np.zeros(n, dtype=bool)
        sell_flip = np.zeros(n, dtype=bool)

        # Initialize first bar
        upper_band[0] = raw_upper[0]
        lower_band[0] = raw_lower[0]
        trend_dir[0] = 1

        for i in range(1, n):
            prev_lower = lower_band[i - 1]
            prev_upper = upper_band[i - 1]
            prev_close = closes[i - 1]
            prev_trend = trend_dir[i - 1]

            # Ratchet bands
            curr_lower = raw_lower[i] if (raw_lower[i] > prev_lower or prev_close < prev_lower) else prev_lower
            curr_upper = raw_upper[i] if (raw_upper[i] < prev_upper or prev_close > prev_upper) else prev_upper

            prev_upper2 = upper_band[i - 2] if i >= 2 else prev_upper
            prev_lower2 = lower_band[i - 2] if i >= 2 else prev_lower

            if prev_trend == -1 and closes[i] > prev_upper:
                valid_body_break = (
                    is_bull_bar[i]
                    and (body_ratio[i] >= 0.35)
                    and (vel_bull[i] or prev_close > prev_upper2)
                )
                pullback_confirmed = (prev_close > prev_upper2) and is_bull_bar[i] and (closes[i] > highs[i - 1])
                blocked_by_exhaustion = block_exhausted_top and is_bull_exhausted[i] and not pullback_confirmed

                if not valid_body_break or blocked_by_exhaustion:
                    trend_dir[i] = -1
                    upper_band[i] = prev_upper
                    lower_band[i] = curr_lower
                else:
                    trend_dir[i] = 1
                    lower_band[i] = raw_lower[i]
                    upper_band[i] = curr_upper

            elif prev_trend == 1 and closes[i] < prev_lower:
                valid_body_break = (
                    is_bear_bar[i]
                    and (body_ratio[i] >= 0.35)
                    and (vel_bear[i] or prev_close < prev_lower2)
                )
                pullback_confirmed = (prev_close < prev_lower2) and is_bear_bar[i] and (closes[i] < lows[i - 1])
                blocked_by_exhaustion = block_exhausted_top and is_bear_exhausted[i] and not pullback_confirmed

                if not valid_body_break or blocked_by_exhaustion:
                    trend_dir[i] = 1
                    lower_band[i] = prev_lower
                    upper_band[i] = curr_upper
                else:
                    trend_dir[i] = -1
                    upper_band[i] = raw_upper[i]
                    lower_band[i] = curr_lower
            else:
                trend_dir[i] = prev_trend
                lower_band[i] = curr_lower
                upper_band[i] = curr_upper

            buy_flip[i] = (trend_dir[i] == 1) and (prev_trend == -1)
            sell_flip[i] = (trend_dir[i] == -1) and (prev_trend == 1)

        st_baseline = np.where(trend_dir == 1, lower_band, upper_band)

        # 10. Candlestick Patterns & Memory Engine
        upper_wick = highs - np.maximum(opens, closes)
        lower_wick = np.minimum(opens, closes) - lows

        bull_engulf = np.zeros(n, dtype=bool)
        bear_engulf = np.zeros(n, dtype=bool)
        hammer = np.zeros(n, dtype=bool)
        shooting_star = np.zeros(n, dtype=bool)
        bull_marubozu = np.zeros(n, dtype=bool)
        bear_marubozu = np.zeros(n, dtype=bool)

        for i in range(1, n):
            bull_engulf[i] = (
                is_bull_bar[i]
                and is_bear_bar[i - 1]
                and closes[i] >= opens[i - 1]
                and opens[i] <= closes[i - 1]
                and body_size[i] > body_size[i - 1]
            )
            bear_engulf[i] = (
                is_bear_bar[i]
                and is_bull_bar[i - 1]
                and closes[i] <= opens[i - 1]
                and opens[i] >= closes[i - 1]
                and body_size[i] > body_size[i - 1]
            )
            hammer[i] = (lower_wick[i] >= body_size[i] * 1.8) and (upper_wick[i] <= body_size[i] * 0.65) and (body_ratio[i] >= 0.10)
            shooting_star[i] = (upper_wick[i] >= body_size[i] * 1.8) and (lower_wick[i] <= body_size[i] * 0.65) and (body_ratio[i] >= 0.10)
            bull_marubozu[i] = is_bull_bar[i] and (body_ratio[i] >= 0.70) and (body_size[i] >= safe_atr[i] * 0.45)
            bear_marubozu[i] = is_bear_bar[i] and (body_ratio[i] >= 0.70) and (body_size[i] >= safe_atr[i] * 0.45)

        # Memory lookbacks (barssince <= pattern_memory_bars)
        def calc_bars_since(cond_arr: np.ndarray) -> np.ndarray:
            bs = np.full(n, 9999, dtype=int)
            last = -9999
            for idx in range(n):
                if cond_arr[idx]:
                    last = idx
                bs[idx] = idx - last if last != -9999 else 9999
            return bs

        mem_bull_engulf = calc_bars_since(bull_engulf) <= pattern_memory_bars
        mem_hammer = calc_bars_since(hammer) <= pattern_memory_bars
        mem_bull_marubozu = calc_bars_since(bull_marubozu) <= pattern_memory_bars

        mem_bear_engulf = calc_bars_since(bear_engulf) <= pattern_memory_bars
        mem_shooting_star = calc_bars_since(shooting_star) <= pattern_memory_bars
        mem_bear_marubozu = calc_bars_since(bear_marubozu) <= pattern_memory_bars

        # 11. RSI(14)
        rsi_val = self.calc_rsi(closes, rsi_length)

        # 12. Choppiness Index (14)
        sum_tr14 = np.empty(n, dtype=float)
        range14 = np.empty(n, dtype=float)
        chop_index = np.full(n, 50.0, dtype=float)
        is_sideways_box = np.zeros(n, dtype=bool)

        log14 = math.log10(14.0)
        for i in range(n):
            if i >= 13:
                s_tr = np.sum(tr[i - 13 : i + 1])
                h_max = np.max(highs[i - 13 : i + 1])
                l_min = np.min(lows[i - 13 : i + 1])
                rng = max(h_max - l_min, mintick)
                sum_tr14[i] = s_tr
                range14[i] = rng
                ci = 100.0 * math.log10(s_tr / rng) / log14
                chop_index[i] = ci
                if use_auto_atr_chop:
                    is_sideways_box[i] = (ci > 61.8) and (body_size[i] < safe_atr[i] * 0.45) and not higher_low_staircase[i] and not lower_high_staircase[i]
                else:
                    is_sideways_box[i] = full_range[i] < min_points_threshold

        # 13. Confidence Scoring Engine (4 Pillars + Multipliers)
        buy_confidence = np.zeros(n, dtype=int)
        sell_confidence = np.zeros(n, dtype=int)
        signals: List[V12Signal] = []

        timestamps = df['datetime'].to_numpy() if 'datetime' in df.columns else (df['timestamp'].to_numpy() if 'timestamp' in df.columns else np.arange(n))

        for i in range(n):
            # Bull Pillar A
            b_fuel = 10.0
            if 0.55 <= bull_stretch_atr[i] <= 1.45:
                b_fuel = 35.0
            elif 1.45 < bull_stretch_atr[i] < max_fuel_stretch_atr:
                b_fuel = 20.0
            elif bull_stretch_atr[i] >= max_fuel_stretch_atr:
                b_fuel = 4.0

            # Bear Pillar A
            s_fuel = 10.0
            if 0.55 <= bear_stretch_atr[i] <= 1.45:
                s_fuel = 35.0
            elif 1.45 < bear_stretch_atr[i] < max_fuel_stretch_atr:
                s_fuel = 20.0
            elif bear_stretch_atr[i] >= max_fuel_stretch_atr:
                s_fuel = 4.0

            # Pillar B
            b_struct = (15.0 if higher_low_staircase[i] else 6.0) + (10.0 if fast_ema[i] > slow_ema[i] else 3.0)
            s_struct = (15.0 if lower_high_staircase[i] else 6.0) + (10.0 if fast_ema[i] < slow_ema[i] else 3.0)

            # Pillar C
            r_val = rsi_val[i]
            b_rsi = 20.0 if 50.0 <= r_val <= 64.0 else (12.0 if 64.0 < r_val <= 70.0 else 5.0)
            s_rsi = 20.0 if 36.0 <= r_val <= 50.0 else (12.0 if 30.0 <= r_val < 36.0 else 5.0)

            # Pillar D
            b_close_strength = (closes[i] - lows[i]) / full_range[i]
            b_pat_pts = (8.0 if mem_bull_marubozu[i] else 0.0) + (8.0 if mem_bull_engulf[i] else 0.0) + (6.0 if mem_hammer[i] else 0.0) + (8.0 if b_close_strength >= 0.70 else 2.0)
            b_pat_pts = min(20.0, b_pat_pts)

            s_close_strength = (highs[i] - closes[i]) / full_range[i]
            s_pat_pts = (8.0 if mem_bear_marubozu[i] else 0.0) + (8.0 if mem_bear_engulf[i] else 0.0) + (6.0 if mem_shooting_star[i] else 0.0) + (8.0 if s_close_strength >= 0.70 else 2.0)
            s_pat_pts = min(20.0, s_pat_pts)

            raw_bull = b_fuel + b_struct + b_rsi + b_pat_pts
            raw_bear = s_fuel + s_struct + s_rsi + s_pat_pts

            # Penalties
            if is_bull_exhausted[i]:
                raw_bull *= 0.22
            if hitting_ceiling_wall[i]:
                raw_bull *= 0.45

            if is_bear_exhausted[i]:
                raw_bear *= 0.22
            if hitting_floor_wall[i]:
                raw_bear *= 0.45

            if is_sideways_box[i]:
                raw_bull *= 0.35
                raw_bear *= 0.35

            b_conf = int(round(max(1.0, min(99.0, raw_bull))))
            s_conf = int(round(max(1.0, min(99.0, raw_bear))))
            buy_confidence[i] = b_conf
            sell_confidence[i] = s_conf

            # Signal Emission
            sig_type = SignalType.HOLD
            conf = 0
            fuel_state = FuelState.MODERATE
            pat_text = ""
            is_ex = False
            hit_w = False

            if buy_flip[i] and b_conf >= min_confidence_show:
                sig_type = SignalType.BUY
                conf = b_conf
                is_ex = is_bull_exhausted[i]
                hit_w = hitting_ceiling_wall[i]
                fuel_state = FuelState.EXHAUSTED if is_ex else (FuelState.COILED_SPRING if higher_low_staircase[i] else FuelState.FRESH_BREAKOUT)
                p_items = []
                if mem_bull_marubozu[i]: p_items.append("Marubozu")
                if mem_bull_engulf[i]: p_items.append("Engulfing")
                if mem_hammer[i]: p_items.append("Hammer")
                pat_text = " ".join(p_items) if p_items else "Staircase Break"

            elif sell_flip[i] and s_conf >= min_confidence_show:
                sig_type = SignalType.SELL
                conf = s_conf
                is_ex = is_bear_exhausted[i]
                hit_w = hitting_floor_wall[i]
                fuel_state = FuelState.EXHAUSTED if is_ex else (FuelState.COILED_SPRING if lower_high_staircase[i] else FuelState.FRESH_BREAKDOWN)
                p_items = []
                if mem_bear_marubozu[i]: p_items.append("Marubozu")
                if mem_bear_engulf[i]: p_items.append("Engulfing")
                if mem_shooting_star[i]: p_items.append("ShootingStar")
                pat_text = " ".join(p_items) if p_items else "Staircase Break"

            if sig_type != SignalType.HOLD:
                signals.append(
                    V12Signal(
                        timestamp=timestamps[i],
                        signal=sig_type,
                        confidence=conf,
                        trend_dir=int(trend_dir[i]),
                        close_price=float(closes[i]),
                        baseline=float(st_baseline[i]),
                        fuel_state=fuel_state,
                        three_bar_stretch_atr=float(bull_stretch_atr[i] if sig_type == SignalType.BUY else bear_stretch_atr[i]),
                        pattern_text=pat_text,
                        rsi=float(rsi_val[i]),
                        chop_index=float(chop_index[i]),
                        is_exhausted=is_ex,
                        hitting_wall=hit_w,
                        is_sideways_box=bool(is_sideways_box[i]),
                        meta={
                            "bar_index": i,
                            "safe_atr": float(safe_atr[i]),
                            "vol_ratio": float(vol_ratio[i]),
                            "fast_ema": float(fast_ema[i]),
                            "slow_ema": float(slow_ema[i]),
                        }
                    )
                )

        # Attach computed arrays to output dataframe
        df['atr'] = safe_atr
        df['vol_ratio'] = vol_ratio
        df['upper_band'] = upper_band
        df['lower_band'] = lower_band
        df['baseline'] = st_baseline
        df['trend_dir'] = trend_dir
        df['buy_flip'] = buy_flip
        df['sell_flip'] = sell_flip
        df['buy_confidence'] = buy_confidence
        df['sell_confidence'] = sell_confidence
        df['rsi'] = rsi_val
        df['chop_index'] = chop_index
        df['is_sideways_box'] = is_sideways_box

        return df, signals
