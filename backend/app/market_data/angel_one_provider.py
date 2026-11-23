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
        # Angel One supports Indian equities, indices, and derivatives
        return [
            InstrumentMetadata("NIFTY", "NIFTY 50", AssetType.INDEX_F_AND_O, "INR", "NSE", 0.05, 25.0, 2, 0, False, "NSE Nifty 50 Index"),
            InstrumentMetadata("BANKNIFTY", "BANK NIFTY", AssetType.INDEX_F_AND_O, "INR", "NSE", 0.05, 15.0, 2, 0, False, "NSE Bank Nifty Index"),
            InstrumentMetadata("FINNIFTY", "FIN NIFTY", AssetType.INDEX_F_AND_O, "INR", "NSE", 0.05, 25.0, 2, 0, False, "NSE Financial Services Index"),
            InstrumentMetadata("SENSEX", "BSE SENSEX", AssetType.INDEX_F_AND_O, "INR", "BSE", 0.05, 10.0, 2, 0, False, "BSE SENSEX Index"),
            InstrumentMetadata("BANKEX", "BSE BANKEX", AssetType.INDEX_F_AND_O, "INR", "BSE", 0.05, 15.0, 2, 0, False, "BSE BANKEX Index"),
        ]

    async def get_candles(self, symbol: str, timeframe: str = "5m", bars: int = 150) -> pd.DataFrame:
        if not self.client.is_authenticated:
            raise ConnectionError("Angel One is not connected. Configure credentials or switch to Demo Provider.")
        # When connected, uses self.client.get_historical_candles
        token_map = {"NIFTY": "99926000", "BANKNIFTY": "99926009"}
        token = token_map.get(symbol.upper(), "99926000")
        df = await self.client.get_historical_candles("NSE", token, interval="FIVE_MINUTE")
        if df is not None:
            df["data_mode"] = DataMode.LIVE_AUTHORISED_DATA.value
            return df
        raise ConnectionError(f"Failed to fetch historical candles from Angel One for {symbol}")

    async def get_quote(self, symbol: str) -> MarketQuote:
        if not self.client.is_authenticated:
            raise ConnectionError("Angel One is not connected.")
        token_map = {"NIFTY": "99926000", "BANKNIFTY": "99926009"}
        token = token_map.get(symbol.upper(), "99926000")
        ltp = await self.client.get_ltp("NSE", token, symbol.upper())
        return MarketQuote(
            symbol=symbol.upper(),
            price=ltp or 0.0,
            change_24h=0.0,
            change_pct_24h=0.0,
            high_24h=0.0,
            low_24h=0.0,
            volume_24h=0.0,
            timestamp=datetime.now().isoformat(),
            data_mode=DataMode.LIVE_AUTHORISED_DATA,
            source_label="Angel One SmartAPI Authorised Feed",
            asset_type=AssetType.INDEX_F_AND_O
        )
