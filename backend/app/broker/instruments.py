"""
Indian F&O & Crypto Instrument & Contract Engine
Handles contract resolution, strike selection, lot sizes, and options pricing.
"""

from dataclasses import dataclass
from datetime import datetime, date
from enum import Enum
import math
from typing import Optional, Tuple
from app.market_data.base import AssetType


class InstrumentType(str, Enum):
    INDEX_OPTION_CE = "CE"
    INDEX_OPTION_PE = "PE"
    INDEX_FUTURES = "FUT"
    CRYPTO_SPOT = "SPOT"


@dataclass
class FNOContract:
    symbol: str
    underlying: str
    instrument_type: InstrumentType
    strike_price: float
    expiry_date: str
    lot_size: float
    exchange: str = "NFO"
    token: str = ""
    tick_size: float = 0.05
    asset_type: AssetType = AssetType.INDEX_F_AND_O


INDEX_SPECS = {
    "NIFTY": {
        "lot_size": 65.0,
        "strike_step": 50.0,
        "exchange": "NFO",
        "underlying_symbol": "NIFTY 50",
        "asset_type": AssetType.INDEX_F_AND_O
    },
    "BANKNIFTY": {
        "lot_size": 30.0,
        "strike_step": 100.0,
        "exchange": "NFO",
        "underlying_symbol": "NIFTY BANK",
        "asset_type": AssetType.INDEX_F_AND_O
    },
    "FINNIFTY": {
        "lot_size": 60.0,
        "strike_step": 50.0,
        "exchange": "NFO",
        "underlying_symbol": "NIFTY FIN SERVICE",
        "asset_type": AssetType.INDEX_F_AND_O
    },
    "MIDCPNIFTY": {
        "lot_size": 120.0,
        "strike_step": 25.0,
        "exchange": "NFO",
        "underlying_symbol": "NIFTY MID SELECT",
        "asset_type": AssetType.INDEX_F_AND_O
    },
    "SENSEX": {
        "lot_size": 20.0,
        "strike_step": 100.0,
        "exchange": "BFO",
        "underlying_symbol": "BSE SENSEX",
        "asset_type": AssetType.INDEX_F_AND_O
    },
    "BANKEX": {
        "lot_size": 30.0,
        "strike_step": 100.0,
        "exchange": "BFO",
        "underlying_symbol": "BSE BANKEX",
        "asset_type": AssetType.INDEX_F_AND_O
    },
    "BTC/USDT": {
        "lot_size": 0.01,
        "strike_step": 0.0,
        "exchange": "CRYPTO",
        "underlying_symbol": "Bitcoin",
        "asset_type": AssetType.CRYPTO_SPOT
    }
}


class BlackScholesPricer:
    """Calculates theoretical options prices and Delta for realistic Indian F&O simulation."""

    @staticmethod
    def norm_cdf(x: float) -> float:
        return (1.0 + math.erf(x / math.sqrt(2.0))) / 2.0

    @classmethod
    def price_option(
        cls,
        spot: float,
        strike: float,
        time_to_expiry_years: float,
        volatility: float = 0.14,
        risk_free_rate: float = 0.065,
        is_call: bool = True
    ) -> Tuple[float, float]:
        if time_to_expiry_years <= 0.0001:
            intrinsic = max(0.0, (spot - strike) if is_call else (strike - spot))
            delta = 1.0 if (is_call and spot >= strike) else (-1.0 if (not is_call and spot <= strike) else 0.0)
            return round(intrinsic, 2), delta

        t = time_to_expiry_years
        v = max(volatility, 0.01)
        r = risk_free_rate

        d1 = (math.log(spot / strike) + (r + 0.5 * v ** 2) * t) / (v * math.sqrt(t))
        d2 = d1 - v * math.sqrt(t)

        if is_call:
            price = spot * cls.norm_cdf(d1) - strike * math.exp(-r * t) * cls.norm_cdf(d2)
            delta = cls.norm_cdf(d1)
        else:
            price = strike * math.exp(-r * t) * cls.norm_cdf(-d2) - spot * cls.norm_cdf(-d1)
            delta = cls.norm_cdf(d1) - 1.0

        return max(0.05, round(price, 2)), round(delta, 3)


class ContractResolver:
    @staticmethod
    def resolve_atm_strike(underlying: str, spot_price: float) -> float:
        spec = INDEX_SPECS.get(underlying.upper(), INDEX_SPECS["NIFTY"])
        step = spec["strike_step"]
        if step == 0.0:
            return round(spot_price, 2)
        return round(round(spot_price / step) * step, 2)

    @staticmethod
    def resolve_contract(
        underlying: str,
        spot_price: float,
        direction_is_buy: bool,
        trade_type: str = "OPTION",
        prefer_itm: bool = False,
        expiry_str: str = "26NOV2026"
    ) -> FNOContract:
        sym_key = underlying.upper()
        if sym_key in ["BTC", "BTC/USDT"]:
            return FNOContract(
                symbol="BTC/USDT",
                underlying="BTC/USDT",
                instrument_type=InstrumentType.CRYPTO_SPOT,
                strike_price=0.0,
                expiry_date="PERPETUAL",
                lot_size=0.01,
                exchange="CRYPTO",
                token="BTC_SPOT",
                asset_type=AssetType.CRYPTO_SPOT
            )

        spec = INDEX_SPECS.get(sym_key, INDEX_SPECS["NIFTY"])
        lot_size = spec["lot_size"]
        step = spec["strike_step"]
        atm_strike = ContractResolver.resolve_atm_strike(sym_key, spot_price)

        if trade_type.upper() == "FUTURES":
            sym = f"{sym_key}{expiry_str}FUT"
            return FNOContract(
                symbol=sym,
                underlying=sym_key,
                instrument_type=InstrumentType.INDEX_FUTURES,
                strike_price=0.0,
                expiry_date=expiry_str,
                lot_size=lot_size,
                exchange=spec["exchange"],
                token=f"FUT_{sym_key}",
                asset_type=AssetType.INDEX_F_AND_O
            )

        if direction_is_buy:
            itype = InstrumentType.INDEX_OPTION_CE
            strike = (atm_strike - step) if prefer_itm else atm_strike
        else:
            itype = InstrumentType.INDEX_OPTION_PE
            strike = (atm_strike + step) if prefer_itm else atm_strike

        sym = f"{sym_key}{expiry_str}{int(strike)}{itype.value}"
        return FNOContract(
            symbol=sym,
            underlying=sym_key,
            instrument_type=itype,
            strike_price=strike,
            expiry_date=expiry_str,
            lot_size=lot_size,
            exchange=spec["exchange"],
            token=f"OPT_{sym}",
            asset_type=AssetType.INDEX_F_AND_O
        )
