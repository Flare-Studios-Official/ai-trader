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
        provider_type = os.getenv("MARKET_DATA_PROVIDER", "").lower()
        angel_configured = bool(
            os.getenv("ANGEL_API_KEY")
            and os.getenv("ANGEL_CLIENT_CODE")
            and os.getenv("ANGEL_PIN")
            and os.getenv("ANGEL_TOTP_SECRET")
        )
        if provider_type == "angel_one" and angel_configured:
            _active_provider = AngelOneMarketDataProvider()
        else:
            _active_provider = DemoMarketDataProvider()
    return _active_provider
