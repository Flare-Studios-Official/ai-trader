"""
Demo Market Data Provider
High-fidelity demonstration market data adapter with public internet reference & realistic simulation.

Supported Instruments:
1. NIFTY (NSE NIFTY 50 Index)
2. BANKNIFTY (NSE NIFTY Bank Index)
3. FINNIFTY (NSE NIFTY Financial Services)
4. SENSEX (BSE SENSEX Index)
5. BANKEX (BSE BANKEX Index)
6. BTC/USDT (Bitcoin / USDT Spot — 24/7 continuous crypto market)

Features:
- Clearly labelled: DEMO MODE — NOT CONNECTED TO LIVE BROKER DATA.
- Internet-sourced reference prices where available (e.g. Binance public BTC/USDT REST API).
- High-fidelity synthetic OHLCV generation with realistic volatility, wicks, and volume.
- Continuously updating streaming candle feeds.
- Independent 24/7 operation for Bitcoin.
"""

from datetime import datetime, timedelta
import logging
from typing import Any, Dict, List, Optional
import httpx
import numpy as np
import pandas as pd

from app.market_data.base import (
    BaseMarketDataProvider,
    AssetType,
    DataMode,
    InstrumentMetadata,
    MarketQuote
)

logger = logging.getLogger("DemoMarketDataProvider")

DEFAULT_INSTRUMENTS: Dict[str, InstrumentMetadata] = {
    "NIFTY": InstrumentMetadata(
        symbol="NIFTY",
        display_name="NIFTY 50",
        asset_type=AssetType.INDEX_F_AND_O,
        base_currency="INR",
        exchange="NSE",
        tick_size=0.05,
        lot_size=25.0,
        price_decimals=2,
        qty_decimals=0,
        is_24_7=False,
        description="National Stock Exchange NIFTY 50 Benchmark Index"
    ),
    "BANKNIFTY": InstrumentMetadata(
        symbol="BANKNIFTY",
        display_name="BANK NIFTY",
        asset_type=AssetType.INDEX_F_AND_O,
        base_currency="INR",
        exchange="NSE",
        tick_size=0.05,
        lot_size=15.0,
        price_decimals=2,
        qty_decimals=0,
        is_24_7=False,
        description="NSE NIFTY Bank Sectoral Index"
    ),
    "FINNIFTY": InstrumentMetadata(
        symbol="FINNIFTY",
        display_name="FIN NIFTY",
        asset_type=AssetType.INDEX_F_AND_O,
        base_currency="INR",
        exchange="NSE",
        tick_size=0.05,
        lot_size=25.0,
        price_decimals=2,
        qty_decimals=0,
        is_24_7=False,
        description="NSE NIFTY Financial Services Index"
    ),
    "SENSEX": InstrumentMetadata(
        symbol="SENSEX",
        display_name="BSE SENSEX",
        asset_type=AssetType.INDEX_F_AND_O,
        base_currency="INR",
        exchange="BSE",
        tick_size=0.05,
        lot_size=10.0,
        price_decimals=2,
        qty_decimals=0,
        is_24_7=False,
        description="Bombay Stock Exchange 30-share SENSEX Benchmark"
    ),
    "BANKEX": InstrumentMetadata(
        symbol="BANKEX",
        display_name="BSE BANKEX",
        asset_type=AssetType.INDEX_F_AND_O,
        base_currency="INR",
        exchange="BSE",
        tick_size=0.05,
        lot_size=15.0,
        price_decimals=2,
        qty_decimals=0,
        is_24_7=False,
        description="BSE BANKEX Banking Index"
    ),
    "BTC/USDT": InstrumentMetadata(
        symbol="BTC/USDT",
        display_name="Bitcoin Spot",
        asset_type=AssetType.CRYPTO_SPOT,
        base_currency="USDT",
        exchange="CRYPTO",
        tick_size=0.01,
        lot_size=0.01,
        price_decimals=2,
        qty_decimals=4,
        is_24_7=True,
        description="Bitcoin / Tether Spot 24/7 Market"
    ),
}

BASE_PRICES = {
    "NIFTY": 24520.0,
    "BANKNIFTY": 52350.0,
    "FINNIFTY": 23850.0,
    "SENSEX": 80480.0,
    "BANKEX": 58120.0,
    "BTC/USDT": 68450.0
}


class DemoMarketDataProvider(BaseMarketDataProvider):
    def __init__(self):
        self.instruments = DEFAULT_INSTRUMENTS
        self.current_prices = dict(BASE_PRICES)
        self.candle_cache: Dict[str, pd.DataFrame] = {}
        self.last_internet_sync: Optional[datetime] = None
        self._initialize_caches()

    @property
    def provider_name(self) -> str:
        return "Demo Market Provider (Internet Ref & Synthetic)"

    @property
    def data_mode(self) -> DataMode:
        return DataMode.DEMO_DATA

    @property
    def is_connected(self) -> bool:
        return True

    @property
    def status_message(self) -> str:
        return "DEMO MODE — NOT CONNECTED TO LIVE BROKER DATA"

    def get_supported_instruments(self) -> List[InstrumentMetadata]:
        return list(self.instruments.values())

    def _initialize_caches(self):
        """Generates realistic initial multi-day candle histories for all instruments."""
        for sym, meta in self.instruments.items():
            base_p = self.current_prices[sym]
            bars = 180
            dates = pd.date_range(end=datetime.now(), periods=bars, freq="5min")
            
            # Volatility tuning
            pct_vol = 0.0015 if meta.asset_type == AssetType.CRYPTO_SPOT else 0.0008
            prices = [base_p]
            for i in range(1, bars):
                step = float(np.random.normal(loc=0.0, scale=base_p * pct_vol))
                prices.append(max(10.0, prices[-1] + step))

            highs = [p + abs(float(np.random.normal(loc=base_p * (pct_vol * 0.7), scale=base_p * 0.0002))) for p in prices]
            lows = [p - abs(float(np.random.normal(loc=base_p * (pct_vol * 0.7), scale=base_p * 0.0002))) for p in prices]
            opens = [prices[i - 1] if i > 0 else prices[0] - 5.0 for i in range(bars)]
            volumes = np.random.randint(50000, 350000, size=bars)

            df = pd.DataFrame({
                "datetime": dates,
                "open": np.round(opens, meta.price_decimals),
                "high": np.round(highs, meta.price_decimals),
                "low": np.round(lows, meta.price_decimals),
                "close": np.round(prices, meta.price_decimals),
                "volume": volumes,
                "data_mode": DataMode.DEMO_DATA.value
            })
            self.candle_cache[sym] = df
            self.current_prices[sym] = float(prices[-1])

    async def fetch_public_bitcoin_price(self) -> Optional[float]:
        """Attempts to fetch genuine public BTC/USDT price from public API with timeout."""
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.get("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT")
                if res.status_code == 200:
                    data = res.json()
                    px = float(data["price"])
                    self.current_prices["BTC/USDT"] = px
                    self.last_internet_sync = datetime.now()
                    return px
        except Exception as e:
            logger.debug(f"Internet reference BTC price lookup omitted/failed: {e}")
        return None

    async def get_candles(
        self,
        symbol: str,
        timeframe: str = "5m",
        bars: int = 150
    ) -> pd.DataFrame:
        sym = symbol.upper()
        if sym not in self.candle_cache:
            if sym == "BTC":
                sym = "BTC/USDT"
            elif sym not in self.instruments:
                raise ValueError(f"Unsupported demo symbol: {symbol}")

        # If BTC, periodically sync reference price
        if sym == "BTC/USDT":
            await self.fetch_public_bitcoin_price()

        df = self.candle_cache[sym]
        return df.iloc[-bars:].copy()

    async def get_quote(self, symbol: str) -> MarketQuote:
        sym = symbol.upper()
        if sym == "BTC":
            sym = "BTC/USDT"
        meta = self.instruments.get(sym, self.instruments["NIFTY"])

        if sym == "BTC/USDT":
            await self.fetch_public_bitcoin_price()

        df = self.candle_cache[sym]
        curr_p = float(self.current_prices[sym])
        open_24h = float(df["open"].iloc[0])
        change = curr_p - open_24h
        change_pct = (change / max(1.0, open_24h)) * 100.0

        return MarketQuote(
            symbol=sym,
            price=round(curr_p, meta.price_decimals),
            change_24h=round(change, meta.price_decimals),
            change_pct_24h=round(change_pct, 2),
            high_24h=round(float(df["high"].max()), meta.price_decimals),
            low_24h=round(float(df["low"].min()), meta.price_decimals),
            volume_24h=float(df["volume"].sum()),
            timestamp=datetime.now().isoformat(),
            data_mode=DataMode.DEMO_DATA,
            source_label="Demo Market Provider (Internet Reference / Synthetic Demo)",
            asset_type=meta.asset_type
        )

    def advance_candle_tick(self, symbol: str) -> Dict[str, Any]:
        """
        Simulates micro price tick and appends completed bar when rolling over.
        """
        sym = symbol.upper()
        meta = self.instruments[sym]
        curr_p = self.current_prices[sym]

        # Drift
        pct_vol = 0.0008 if meta.asset_type == AssetType.CRYPTO_SPOT else 0.0004
        drift = float(np.random.normal(loc=0.0, scale=curr_p * pct_vol))
        new_p = max(1.0, round(curr_p + drift, meta.price_decimals))
        self.current_prices[sym] = new_p

        df = self.candle_cache[sym]
        # Append simulated candle
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        o = df["close"].iloc[-1]
        c = new_p
        h = max(o, c) + abs(float(np.random.normal(loc=0.0, scale=curr_p * 0.0002)))
        l = min(o, c) - abs(float(np.random.normal(loc=0.0, scale=curr_p * 0.0002)))
        vol = int(np.random.randint(25000, 200000))

        new_candle = {
            "datetime": now_str,
            "open": round(o, meta.price_decimals),
            "high": round(h, meta.price_decimals),
            "low": round(l, meta.price_decimals),
            "close": round(c, meta.price_decimals),
            "volume": vol,
            "data_mode": DataMode.DEMO_DATA.value
        }

        new_row = pd.DataFrame([new_candle])
        self.candle_cache[sym] = pd.concat([df, new_row], ignore_index=True).iloc[-300:].reset_index(drop=True)
        return new_candle
