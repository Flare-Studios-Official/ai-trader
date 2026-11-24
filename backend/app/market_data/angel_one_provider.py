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
            return "ERROR — Angel One credentials not configured."
        if not self.client.is_authenticated:
            return "DISCONNECTED — Angel One session not authenticated."
        return "CONNECTED — Angel One authentication established."

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

        async def get_candles(
        self,
        symbol: str,
        timeframe: str = "5m",
        bars: int = 150
    ) -> pd.DataFrame:

        sym = symbol.upper()

        if sym not in self.SYMBOL_MAP:
            raise ValueError(
                f"{sym} is not supported by the Angel One live feed."
            )

        exchange, token, _ = self.SYMBOL_MAP[sym]

        df = await self.client.get_historical_candles(
            exchange,
            token,
            interval="FIVE_MINUTE"
        )

        if df is None or df.empty:
            raise RuntimeError(
                f"Angel One returned no live candle data for {sym}."
            )

        df = df.tail(bars).copy()
        df["data_mode"] = DataMode.LIVE_AUTHORISED_DATA.value

        return df

        async def get_quote(self, symbol: str) -> MarketQuote:

        sym = symbol.upper()

        if sym not in self.SYMBOL_MAP:
            raise ValueError(
                f"{sym} is not supported by the Angel One live feed."
            )

        exchange, token, _ = self.SYMBOL_MAP[sym]

        full_quote = await self.client.get_full_quote(
            exchange,
            token
        )

        if not full_quote:
            raise RuntimeError(
                f"Angel One live quote unavailable for {sym}."
            )

        ltp = float(full_quote.get("ltp", 0.0))

        if ltp <= 0:
            raise RuntimeError(
                f"Angel One returned an invalid price for {sym}."
            )

        return MarketQuote(
            symbol=sym,
            price=ltp,
            change_24h=float(full_quote.get("netChange", 0.0)),
            change_pct_24h=float(full_quote.get("percentChange", 0.0)),
            high_24h=float(full_quote.get("high", 0.0)),
            low_24h=float(full_quote.get("low", 0.0)),
            volume_24h=float(full_quote.get("tradeVolume", 0.0)),
            timestamp=datetime.now().isoformat(),
            data_mode=DataMode.LIVE_AUTHORISED_DATA,
            source_label="Angel One SmartAPI",
            asset_type=AssetType.INDEX_F_AND_O
        )
            except Exception as e:
                logger.warning(f"Angel One quote fetch failed for {symbol}: {e}. Falling back to demo quote.")

        from app.market_data.demo_provider import DemoMarketDataProvider
        demo = DemoMarketDataProvider()
        return await demo.get_quote(symbol)
