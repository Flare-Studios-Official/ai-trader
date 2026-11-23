"""
Stage 2: Independent AI Signal Verification Engine
Evaluates Stage 1 V12 signals independently using multi-factor quantitative and regime analysis.

Decisions:
- APPROVED
- REJECTED
- WAITING

Rules:
- The AI never changes the original indicator's direction (Direction Invariance).
- Every decision includes an audited, transparent explanation string and factor breakdown.
"""

from dataclasses import dataclass, field
from enum import Enum
import math
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd
from app.indicators.v12_engine import V12Signal, SignalType


class AIDecision(str, Enum):
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    WAITING = "WAITING"


@dataclass
class MarketContext:
    symbol: str
    timeframe: str
    current_time: Any
    data_timestamp: Any
    adx: float
    fast_ema: float
    slow_ema: float
    ema_50: float
    ema_200: float
    volume_ratio: float  # Current vol / 20-SMA vol
    oi_change_pct: Optional[float] = None
    existing_open_positions: int = 0
    existing_position_direction: Optional[str] = None
    data_age_seconds: float = 0.0


@dataclass
class AIVerificationResult:
    original_signal: SignalType
    decision: AIDecision
    ai_score: float  # 0 to 100
    confidence_stage1: int
    summary_reason: str
    factor_breakdown: Dict[str, Any] = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)


class AIVerificationEngine:
    def __init__(
        self,
        min_approval_score: float = 65.0,
        min_waiting_score: float = 48.0,
        max_allowed_data_age_secs: float = 600.0  # 10 minutes
    ):
        self.min_approval_score = min_approval_score
        self.min_waiting_score = min_waiting_score
        self.max_allowed_data_age_secs = max_allowed_data_age_secs

    @staticmethod
    def calc_adx(df: pd.DataFrame, length: int = 14) -> float:
        """Computes ADX for trend strength determination."""
        if len(df) < length * 2:
            return 25.0  # fallback neutral
        highs = df['high'].to_numpy(dtype=float)
        lows = df['low'].to_numpy(dtype=float)
        closes = df['close'].to_numpy(dtype=float)
        n = len(df)

        tr = np.empty(n, dtype=float)
        plus_dm = np.zeros(n, dtype=float)
        minus_dm = np.zeros(n, dtype=float)

        tr[0] = highs[0] - lows[0]
        for i in range(1, n):
            h_l = highs[i] - lows[i]
            h_pc = abs(highs[i] - closes[i - 1])
            l_pc = abs(lows[i] - closes[i - 1])
            tr[i] = max(h_l, h_pc, l_pc)

            up_move = highs[i] - highs[i - 1]
            down_move = lows[i - 1] - lows[i]
            if up_move > down_move and up_move > 0:
                plus_dm[i] = up_move
            if down_move > up_move and down_move > 0:
                minus_dm[i] = down_move

        alpha = 1.0 / length
        # Wilder's smoothing
        tr_smooth = np.empty(n, dtype=float)
        p_dm_smooth = np.empty(n, dtype=float)
        m_dm_smooth = np.empty(n, dtype=float)

        tr_smooth[length - 1] = np.mean(tr[:length])
        p_dm_smooth[length - 1] = np.mean(plus_dm[:length])
        m_dm_smooth[length - 1] = np.mean(minus_dm[:length])

        for i in range(length, n):
            tr_smooth[i] = alpha * tr[i] + (1 - alpha) * tr_smooth[i - 1]
            p_dm_smooth[i] = alpha * plus_dm[i] + (1 - alpha) * p_dm_smooth[i - 1]
            m_dm_smooth[i] = alpha * minus_dm[i] + (1 - alpha) * m_dm_smooth[i - 1]

        safe_tr = np.maximum(tr_smooth, 1e-4)
        p_di = 100.0 * (p_dm_smooth / safe_tr)
        m_di = 100.0 * (m_dm_smooth / safe_tr)
        dx = 100.0 * np.abs(p_di - m_di) / np.maximum(p_di + m_di, 1e-4)

        # Smooth DX to get ADX
        adx = np.empty(n, dtype=float)
        start_idx = length * 2 - 1
        if n <= start_idx:
            return 25.0
        adx[start_idx] = np.mean(dx[length - 1 : start_idx + 1])
        for i in range(start_idx + 1, n):
            adx[i] = alpha * dx[i] + (1 - alpha) * adx[i - 1]
        return float(adx[-1])

    def evaluate(self, signal: V12Signal, context: MarketContext) -> AIVerificationResult:
        """
        Runs independent multi-factor audit on the V12 signal.
        Guarantees: Direction is NEVER changed.
        """
        if signal.signal == SignalType.HOLD:
            return AIVerificationResult(
                original_signal=SignalType.HOLD,
                decision=AIDecision.WAITING,
                ai_score=0.0,
                confidence_stage1=0,
                summary_reason="Stage 1 signal is HOLD; no action taken.",
                factor_breakdown={},
                warnings=[]
            )

        warnings: List[str] = []
        score = 0.0
        factors: Dict[str, Any] = {}

        # 1. Hard Filter: Data Freshness Check
        if context.data_age_seconds > self.max_allowed_data_age_secs:
            return AIVerificationResult(
                original_signal=signal.signal,
                decision=AIDecision.REJECTED,
                ai_score=0.0,
                confidence_stage1=signal.confidence,
                summary_reason=f"Data is stale ({int(context.data_age_seconds)}s old > {int(self.max_allowed_data_age_secs)}s threshold).",
                factor_breakdown={"data_age_seconds": context.data_age_seconds},
                warnings=["STALE_DATA_REJECTION"]
            )

        # 2. Hard Filter: Duplicate Position Protection
        if context.existing_open_positions >= 1:
            if context.existing_position_direction == signal.signal.value:
                return AIVerificationResult(
                    original_signal=signal.signal,
                    decision=AIDecision.REJECTED,
                    ai_score=20.0,
                    confidence_stage1=signal.confidence,
                    summary_reason=f"Existing position already open in {signal.signal.value} direction. Max 1 position allowed.",
                    factor_breakdown={"existing_positions": context.existing_open_positions},
                    warnings=["DUPLICATE_POSITION_PREVENTED"]
                )

        # Factor A: Trend Strength & Concordance (Max 25 pts)
        trend_pts = 0.0
        is_bull = signal.signal == SignalType.BUY
        
        # Check EMA 50 / 200 regime
        above_200 = signal.close_price > context.ema_200
        ema_aligned = (context.ema_50 > context.ema_200) if is_bull else (context.ema_50 < context.ema_200)
        
        if is_bull:
            if above_200 and ema_aligned:
                trend_pts += 15.0
            elif above_200 or ema_aligned:
                trend_pts += 8.0
            else:
                warnings.append("BUY against macro downtrend (Close < EMA 200)")
                trend_pts += 2.0
        else:
            if (not above_200) and ema_aligned:
                trend_pts += 15.0
            elif (not above_200) or ema_aligned:
                trend_pts += 8.0
            else:
                warnings.append("SELL against macro uptrend (Close > EMA 200)")
                trend_pts += 2.0

        # ADX Trend Strength
        if context.adx >= 25.0:
            trend_pts += 10.0
        elif context.adx >= 18.0:
            trend_pts += 6.0
        else:
            trend_pts += 2.0
            warnings.append(f"Weak trend strength (ADX = {context.adx:.1f} < 18)")

        score += trend_pts
        factors["trend_concordance"] = {
            "score": trend_pts,
            "max": 25.0,
            "adx": round(context.adx, 1),
            "ema_50": round(context.ema_50, 2),
            "ema_200": round(context.ema_200, 2),
            "macro_aligned": ema_aligned
        }

        # Factor B: Momentum & RSI Context (Max 20 pts)
        rsi_pts = 0.0
        rsi = signal.rsi
        if is_bull:
            if 50.0 <= rsi <= 65.0:
                rsi_pts = 20.0
            elif 65.0 < rsi <= 72.0:
                rsi_pts = 14.0
            elif rsi > 75.0:
                rsi_pts = 2.0
                warnings.append(f"Overbought RSI ({rsi:.1f} > 75)")
            else:
                rsi_pts = 8.0
        else:
            if 35.0 <= rsi <= 50.0:
                rsi_pts = 20.0
            elif 28.0 <= rsi < 35.0:
                rsi_pts = 14.0
            elif rsi < 25.0:
                rsi_pts = 2.0
                warnings.append(f"Oversold RSI ({rsi:.1f} < 25)")
            else:
                rsi_pts = 8.0

        score += rsi_pts
        factors["rsi_momentum"] = {"score": rsi_pts, "max": 20.0, "rsi": round(rsi, 1)}

        # Factor C: Market Volatility & Chop Index (Max 20 pts)
        vol_pts = 0.0
        chop = signal.chop_index
        if chop < 50.0:
            vol_pts += 12.0  # Strong trending expansion
        elif chop <= 61.8:
            vol_pts += 8.0   # Healthy market
        else:
            vol_pts += 2.0   # Severe sideways chop
            warnings.append(f"High Choppiness Index ({chop:.1f} > 61.8)")

        # Volatility stretch penalty
        if signal.is_exhausted:
            vol_pts *= 0.3
            warnings.append("Exhausted 3-candle climax move")
        if signal.hitting_wall:
            vol_pts *= 0.4
            warnings.append("Firing directly into 15-bar S/R boundary wall")

        score += vol_pts
        factors["volatility_regime"] = {
            "score": round(vol_pts, 1),
            "max": 20.0,
            "chop_index": round(chop, 1),
            "is_exhausted": signal.is_exhausted,
            "hitting_wall": signal.hitting_wall
        }

        # Factor D: Volume & Open Interest Confirmation (Max 15 pts)
        oi_pts = 0.0
        if context.volume_ratio >= 1.2:
            oi_pts += 8.0
        elif context.volume_ratio >= 0.8:
            oi_pts += 5.0
        else:
            oi_pts += 2.0
            warnings.append(f"Below average volume (Ratio: {context.volume_ratio:.2f})")

        # OI Buildup interpretation
        if context.oi_change_pct is not None:
            if is_bull and context.oi_change_pct > 1.0:
                oi_pts += 7.0  # Long Buildup
                factors["oi_buildup"] = "Long Buildup"
            elif (not is_bull) and context.oi_change_pct > 1.0:
                oi_pts += 7.0  # Short Buildup
                factors["oi_buildup"] = "Short Buildup"
            else:
                oi_pts += 3.0
                factors["oi_buildup"] = "Unwinding / Covering"
        else:
            # Neutral default if live OI feed unavailable
            oi_pts += 4.0
            factors["oi_buildup"] = "Neutral (Feed Pending)"

        score += oi_pts
        factors["volume_oi"] = {
            "score": round(oi_pts, 1),
            "max": 15.0,
            "volume_ratio": round(context.volume_ratio, 2)
        }

        # Factor E: Stage 1 Confidence Inheritance (Max 20 pts)
        stage1_pts = (signal.confidence / 100.0) * 20.0
        score += stage1_pts
        factors["stage1_confidence"] = {
            "score": round(stage1_pts, 1),
            "max": 20.0,
            "raw_confidence": signal.confidence
        }

        final_score = round(min(100.0, max(0.0, score)), 1)

        # Decision Logic
        if final_score >= self.min_approval_score and not signal.is_exhausted and not signal.hitting_wall:
            decision = AIDecision.APPROVED
            summary = (
                f"APPROVED {signal.signal.value}: Strong multi-factor alignment "
                f"(AI Score: {final_score}/100, V12 Conf: {signal.confidence}%, ADX: {context.adx:.1f})."
            )
        elif final_score >= self.min_waiting_score and not signal.is_exhausted:
            decision = AIDecision.WAITING
            summary = (
                f"WAITING on {signal.signal.value}: Moderate score ({final_score}/100). "
                f"Requires confirmation ({', '.join(warnings) if warnings else 'Volume/Staircase'})."
            )
        else:
            decision = AIDecision.REJECTED
            summary = (
                f"REJECTED {signal.signal.value}: Low composite AI score ({final_score}/100). "
                f"Adverse conditions: {', '.join(warnings) if warnings else 'Insufficient conviction'}."
            )

        return AIVerificationResult(
            original_signal=signal.signal,
            decision=decision,
            ai_score=final_score,
            confidence_stage1=signal.confidence,
            summary_reason=summary,
            factor_breakdown=factors,
            warnings=warnings
        )
