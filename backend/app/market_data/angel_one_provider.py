"""
Angel One SmartAPI Provider Adapter
Implements BaseMarketDataProvider for authorized live Indian market feeds (NSE / BSE / NFO).
"""

from datetime import datetime
import logging
import os
from typing import Any, Dict, List, Optional
import pandas as pd

from app.market_data.base import (
    BaseMarketDataProvider,
    AssetType,
    DataMode,
    InstrumentMetadata,
    MarketQuote
)
from app.market_data.angel_one import AngelOneClient, AngelOneCredentials

logger = logging.getLogger("AngelOneProvider")


class AngelOneMarketDataProvider(BaseMarketDataProvider):
    def __init__(self):
        self.client = AngelOneClient()
        self.is_authenticated = False
        self._check_and_connect()

    def _check_and_connect(self):
        if self.client.is_configured():
            logger.info("Angel One credentials detected; ready for authentication.")
        else:
            logger.info("Angel One credentials not found in environment; staying in unconfigured standby mode.")

    @property
    def provider_name(self) -> str:
        return "Angel One SmartAPI"

    @property
    def data_mode(self) -> DataMode:
        return DataMode.LIVE_AUTHORISED_DATA

    @property
    def is_connected(self) -> bool:
        return self.client.is_authenticated

    @property
    def status_message(self) -> str:
        if not self.client.is_configured():
            return "STANDBY — Angel One credentials not configured. Using Demo Provider."
        if not self.client.is_authenticated:
            return "DISCONNECTED — Credentials present but session not established."
        return "CONNECTED — Authorised Angel One SmartAPI Feed Active"

    def get_supported_instruments(self) -> List[InstrumentMetadata]:
        # Angel One supports Indian equities, indices, and derivatives; BTC/USDT spot is also tracked 24/7
        return [
            InstrumentMetadata("NIFTY", "NIFTY 50", AssetType.INDEX_F_AND_O, "INR", "NSE", 0.05, 25.0, 2, 0, False, "NSE Nifty 50 Index"),
            InstrumentMetadata("BANKNIFTY", "BANK NIFTY", AssetType.INDEX_F_AND_O, "INR", "NSE", 0.05, 15.0, 2, 0, False, "NSE Bank Nifty Index"),
            InstrumentMetadata("FINNIFTY", "FIN NIFTY", AssetType.INDEX_F_AND_O, "INR", "NSE", 0.05, 25.0, 2, 0, False, "NSE Financial Services Index"),
            InstrumentMetadata("SENSEX", "BSE SENSEX", AssetType.INDEX_F_AND_O, "INR", "BSE", 0.05, 10.0, 2, 0, False, "BSE SENSEX Index"),
            InstrumentMetadata("BANKEX", "BSE BANKEX", AssetType.INDEX_F_AND_O, "INR", "BSE", 0.05, 15.0, 2, 0, False, "BSE BANKEX Index"),
            InstrumentMetadata("BTC/USDT", "Bitcoin Spot", AssetType.CRYPTO_SPOT, "USDT", "Binance/Spot", 0.01, 1.0, 2, 0, True, "Bitcoin 24/7 Spot Market"),
        ]

    SYMBOL_MAP = {
        "NIFTY": ("NSE", "99926000", 25.0),
        "BANKNIFTY": ("NSE", "99926009", 15.0),
        "FINNIFTY": ("NSE", "99926037", 25.0),
        "MIDCPNIFTY": ("NSE", "99926074", 50.0),
        "SENSEX": ("BSE", "1", 10.0),
        "BANKEX": ("BSE", "12", 15.0),
    }

    async def get_candles(self, symbol: str, timeframe: str = "5m", bars: int = 150) -> pd.DataFrame:
        sym = symbol.upper()
        if sym in self.SYMBOL_MAP:
            exchange, token, _ = self.SYMBOL_MAP[sym]
            try:
                df = await self.client.get_historical_candles(exchange, token, interval="FIVE_MINUTE")
                if df is not None and not df.empty:
                    df["data_mode"] = DataMode.LIVE_AUTHORISED_DATA.value
                    return df
            except Exception as e:
                logger.warning(f"Angel One candle fetch failed for {symbol}: {e}. Falling back to demo data.")

        # Graceful fallback to demo provider for BTC/USDT or when feed is outside hours
        from app.market_data.demo_provider import DemoMarketDataProvider
        demo = DemoMarketDataProvider()
        return await demo.get_candles(symbol, timeframe, bars)

    async def get_quote(self, symbol: str) -> MarketQuote:
        sym = symbol.upper()
        if sym in self.SYMBOL_MAP:
            exchange, token, _ = self.SYMBOL_MAP[sym]
            try:
                full_quote = await self.client.get_full_quote(exchange, token)
                if full_quote:
                    ltp = float(full_quote.get("ltp", 0.0))
                    net_change = float(full_quote.get("netChange", 0.0))
                    pct_change = float(full_quote.get("percentChange", 0.0))
                    high = float(full_quote.get("high", 0.0))
                    low = float(full_quote.get("low", 0.0))
                    volume = float(full_quote.get("tradeVolume", 0.0))
                    return MarketQuote(
                        symbol=sym,
                        price=ltp,
                        change_24h=net_change,
                        change_pct_24h=pct_change,
                        high_24h=high,
                        low_24h=low,
                        volume_24h=volume,
                        timestamp=datetime.now().isoformat(),
                        data_mode=DataMode.LIVE_AUTHORISED_DATA,
                        source_label="Angel One SmartAPI Authorised Feed",
                        asset_type=AssetType.INDEX_F_AND_O
                    )
            except Exception as e:
                logger.warning(f"Angel One quote fetch failed for {symbol}: {e}. Falling back to demo quote.")

        from app.market_data.demo_provider import DemoMarketDataProvider
        demo = DemoMarketDataProvider()
        return await demo.get_quote(symbol)
