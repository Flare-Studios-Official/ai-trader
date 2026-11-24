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

        if provider_type == "angel_one":
            required = [
                "ANGEL_API_KEY",
                "ANGEL_CLIENT_CODE",
                "ANGEL_PIN",
                "ANGEL_TOTP_SECRET",
            ]
            missing = [key for key in required if not os.getenv(key)]

            if missing:
                raise RuntimeError(
                    "Angel One live data configuration incomplete. "
                    f"Missing environment variables: {', '.join(missing)}"
                )

            _active_provider = AngelOneMarketDataProvider()

        elif provider_type == "demo":
            _active_provider = DemoMarketDataProvider()

        else:
            raise RuntimeError(
                "Invalid MARKET_DATA_PROVIDER. "
                "Use angel_one or explicitly enabled demo mode."
            )

    return _active_provider
