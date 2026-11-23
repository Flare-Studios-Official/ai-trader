"""
Abstract Base Market Data Provider
Defines the standard contract for all market data adapters (Demo, Angel One, etc.).
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional
import pandas as pd


class AssetType(str, Enum):
    INDEX_F_AND_O = "INDEX_F_AND_O"
    CRYPTO_SPOT = "CRYPTO_SPOT"
    EQUITY_STOCK = "EQUITY_STOCK"


class DataMode(str, Enum):
    DEMO_DATA = "DEMO_DATA"
    LIVE_AUTHORISED_DATA = "LIVE_AUTHORISED_DATA"
    HISTORICAL_DATA = "HISTORICAL_DATA"
    SIMULATED_DATA = "SIMULATED_DATA"


@dataclass
class InstrumentMetadata:
    symbol: str
    display_name: str
    asset_type: AssetType
    base_currency: str = "INR"
    exchange: str = "NSE"
    tick_size: float = 0.05
    lot_size: float = 25.0
    price_decimals: int = 2
    qty_decimals: int = 0
    is_24_7: bool = False
    description: str = ""


@dataclass
class MarketQuote:
    symbol: str
    price: float
    change_24h: float
    change_pct_24h: float
    high_24h: float
    low_24h: float
    volume_24h: float
    timestamp: str
    data_mode: DataMode
    source_label: str
    asset_type: AssetType


class BaseMarketDataProvider(ABC):
    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Name of the provider (e.g. 'Demo Provider', 'Angel One SmartAPI')."""
        pass

    @property
    @abstractmethod
    def data_mode(self) -> DataMode:
        """Returns DataMode.DEMO_DATA or DataMode.LIVE_AUTHORISED_DATA."""
        pass

    @property
    @abstractmethod
    def is_connected(self) -> bool:
        """Whether the provider has tested and established an active data session."""
        pass

    @property
    @abstractmethod
    def status_message(self) -> str:
        """Human-readable status of the provider connection."""
        pass

    @abstractmethod
    def get_supported_instruments(self) -> List[InstrumentMetadata]:
        """Returns list of supported instruments and specifications."""
        pass

    @abstractmethod
    async def get_candles(
        self,
        symbol: str,
        timeframe: str = "5m",
        bars: int = 150
    ) -> pd.DataFrame:
        """
        Retrieves historical and recent completed OHLCV candles.
        Must return columns: ['datetime', 'open', 'high', 'low', 'close', 'volume'].
        """
        pass

    @abstractmethod
    async def get_quote(self, symbol: str) -> MarketQuote:
        """Retrieves latest quote / LTP for the symbol."""
        pass
