"""
Market Data Provider Factory
Instantiates and configures the active market data provider based on environment variables.
"""

import os
from typing import Optional
from app.market_data.base import BaseMarketDataProvider
from app.market_data.demo_provider import DemoMarketDataProvider
from app.market_data.angel_one_provider import AngelOneMarketDataProvider

_active_provider: Optional[BaseMarketDataProvider] = None


def get_market_data_provider() -> BaseMarketDataProvider:
    global _active_provider
    if _active_provider is None:
        provider_type = os.getenv("MARKET_DATA_PROVIDER", "demo").lower()
        if provider_type == "angel_one":
            _active_provider = AngelOneMarketDataProvider()
        else:
            _active_provider = DemoMarketDataProvider()
    return _active_provider
