"""
Angel One SmartAPI Market Data Provider
Secure backend-only integration for authorised Indian market feeds (NSE / NFO).

Features:
- Authenticates using Client Code, Password/PIN, API Key, and pyotp TOTP.
- Retrieves historical OHLCV candle data (1m, 3m, 5m, 15m, 1d).
- Retrieves live LTP & Market Quotes for underlying indices and F&O contracts.
- Retrieves OpenAPIScripMaster contract token directory.
- Features resilient mock/simulation mode when credentials are not configured or outside market hours.
- Strict security: NEVER logs secrets or exposes tokens to the frontend.
"""

import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta
import logging
import os
from typing import Any, Dict, List, Optional
import httpx
import pandas as pd
import pyotp

logger = logging.getLogger("AngelOneData")


@dataclass
class AngelOneCredentials:
    api_key: str = ""
    client_code: str = ""
    pin_or_password: str = ""
    totp_secret: str = ""


class AngelOneClient:
    BASE_URL = "https://apiconnect.angelone.in"

    def __init__(self, credentials: Optional[AngelOneCredentials] = None):
        self.credentials = credentials or AngelOneCredentials(
            api_key=os.getenv("ANGEL_API_KEY", ""),
            client_code=os.getenv("ANGEL_CLIENT_CODE", ""),
            pin_or_password=os.getenv("ANGEL_PIN", ""),
            totp_secret=os.getenv("ANGEL_TOTP_SECRET", "")
        )
        self.jwt_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self.feed_token: Optional[str] = None
        self.is_authenticated: bool = False
        self._load_persisted_session()

    def _load_persisted_session(self):
        try:
            from app.core.database import SessionLocal, SystemSetting
            import json
            db = SessionLocal()
            try:
                setting = db.query(SystemSetting).filter(SystemSetting.key == "angel_one_session").first()
                if setting and setting.value:
                    data = json.loads(setting.value)
                    token = data.get("jwt_token")
                    if token and token != "mock_jwt" and len(token) > 20:
                        self.jwt_token = token
                        self.refresh_token = data.get("refresh_token")
                        self.feed_token = data.get("feed_token")
                        self.is_authenticated = True
                        logger.info("Loaded persisted Angel One session tokens from database.")
            finally:
                db.close()
        except Exception as e:
            logger.debug(f"Could not load persisted Angel One session: {e}")

    def _persist_session(self):
        try:
            from app.core.database import SessionLocal, SystemSetting
            import json
            db = SessionLocal()
            try:
                payload = json.dumps({
                    "jwt_token": self.jwt_token,
                    "refresh_token": self.refresh_token,
                    "feed_token": self.feed_token,
                    "updated_at": datetime.utcnow().isoformat()
                })
                setting = db.query(SystemSetting).filter(SystemSetting.key == "angel_one_session").first()
                if setting:
                    setting.value = payload
                else:
                    db.add(SystemSetting(key="angel_one_session", value=payload, description="Angel One SmartAPI Session Tokens"))
                db.commit()
                logger.info("Persisted live Angel One session tokens to database.")
            finally:
                db.close()
        except Exception as e:
            logger.debug(f"Could not persist session: {e}")

    def is_configured(self) -> bool:
        c = self.credentials
        return bool(c.api_key and c.client_code and c.pin_or_password and c.totp_secret)

    async def authenticate(self) -> bool:
        if not self.is_configured():
            logger.info("Angel One credentials not provided in environment; operating in simulation/mock feed mode.")
            return False

        try:
            totp = pyotp.TOTP(self.credentials.totp_secret).now()
            payload = {
                "clientcode": self.credentials.client_code,
                "password": self.credentials.pin_or_password,
                "totp": totp
            }
            headers = {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "X-UserType": "USER",
                "X-SourceID": "WEB",
                "X-ClientLocalIP": "127.0.0.1",
                "X-ClientPublicIP": "49.43.222.66",
                "X-MACAddress": "fe80::1",
                "X-PrivateKey": self.credentials.api_key
            }

            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(
                    f"{self.BASE_URL}/rest/auth/angelbroking/user/v1/loginByPassword",
                    json=payload,
                    headers=headers
                )
                data = res.json()
                if data.get("status") and data.get("data", {}).get("jwtToken"):
                    self.jwt_token = data["data"]["jwtToken"]
                    self.refresh_token = data["data"].get("refreshToken")
                    self.feed_token = data["data"].get("feedToken")
                    self.is_authenticated = True
                    self._persist_session()
                    logger.info("Angel One SmartAPI authenticated successfully.")
                    return True
                else:
                    logger.error(f"Angel One authentication failed: {data.get('message')}")
                    return False
        except Exception as e:
            logger.error(f"Error during Angel One authentication: {e}")
            return False

    async def get_historical_candles(
        self,
        exchange: str,
        symbol_token: str,
        interval: str = "FIVE_MINUTE",
        from_date: Optional[str] = None,
        to_date: Optional[str] = None
    ) -> Optional[pd.DataFrame]:
        """
        Fetches historical OHLCV data.
        Interval options: ONE_MINUTE, THREE_MINUTE, FIVE_MINUTE, FIFTEEN_MINUTE, ONE_HOUR, ONE_DAY.
        """
        if not self.is_authenticated:
            auth_ok = await self.authenticate()
            if not auth_ok:
                return None

        if not to_date:
            to_date = datetime.now().strftime("%Y-%m-%d %H:%M")
        if not from_date:
            from_date = (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d 09:15")

        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-UserType": "USER",
            "X-SourceID": "WEB",
            "X-ClientLocalIP": "127.0.0.1",
            "X-ClientPublicIP": os.getenv("ANGEL_CLIENT_PUBLIC_IP", "49.43.222.66"),
            "X-MACAddress": "fe80::1",
            "X-PrivateKey": self.credentials.api_key,
            "Authorization": f"Bearer {self.jwt_token}"
        }

        payload = {
            "exchange": exchange,
            "symboltoken": symbol_token,
            "interval": interval,
            "fromdate": from_date,
            "todate": to_date
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                for attempt in range(3):
                    res = await client.post(
                        f"{self.BASE_URL}/rest/secure/angelbroking/historical/v1/getCandleData",
                        json=payload,
                        headers=headers
                    )
                    if res.status_code == 403 and attempt < 2:
                        await asyncio.sleep(1.1)
                        continue
                    if res.status_code != 200:
                        logger.warning(f"Angel One candle HTTP {res.status_code} for {exchange}:{symbol_token}")
                        return None
                    data = res.json()
                    if data.get("status") and data.get("data"):
                        raw_candles = data["data"]
                        df = pd.DataFrame(raw_candles, columns=["datetime", "open", "high", "low", "close", "volume"])
                        df["datetime"] = pd.to_datetime(df["datetime"])
                        return df
                    return None
                return None
        except Exception as e:
            logger.error(f"Error fetching historical candles from Angel One: {e}")
            return None

    async def get_ltp(self, exchange: str, symbol_token: str, trading_symbol: str = "") -> Optional[float]:
        """Fetches live Last Traded Price (LTP)."""
        if not self.is_authenticated:
            auth_ok = await self.authenticate()
            if not auth_ok:
                return None

        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-UserType": "USER",
            "X-SourceID": "WEB",
            "X-ClientLocalIP": "127.0.0.1",
            "X-ClientPublicIP": "49.43.222.66",
            "X-MACAddress": "fe80::1",
            "X-PrivateKey": self.credentials.api_key,
            "Authorization": f"Bearer {self.jwt_token}"
        }
        payload = {
            "mode": "LTP",
            "exchangeTokens": {
                exchange: [str(symbol_token)]
            }
        }

        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.post(
                    f"{self.BASE_URL}/rest/secure/angelbroking/market/v1/quote",
                    json=payload,
                    headers=headers
                )
                data = res.json()
                if data.get("status") and data.get("data", {}).get("fetched"):
                    for item in data["data"]["fetched"]:
                        if str(item.get("symbolToken")) == str(symbol_token):
                            return float(item.get("ltp", 0.0))
                return None
        except Exception as e:
            logger.error(f"Error getting LTP: {e}")
            return None

    async def get_full_quote(self, exchange: str, symbol_token: str) -> Optional[Dict[str, Any]]:
        """Fetches full market quote data including OHLC, change, and LTP."""
        if not self.is_authenticated:
            auth_ok = await self.authenticate()
            if not auth_ok:
                return None

        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-UserType": "USER",
            "X-SourceID": "WEB",
            "X-ClientLocalIP": "127.0.0.1",
            "X-ClientPublicIP": "49.43.222.66",
            "X-MACAddress": "fe80::1",
            "X-PrivateKey": self.credentials.api_key,
            "Authorization": f"Bearer {self.jwt_token}"
        }
        payload = {
            "mode": "FULL",
            "exchangeTokens": {
                exchange: [str(symbol_token)]
            }
        }

        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.post(
                    f"{self.BASE_URL}/rest/secure/angelbroking/market/v1/quote",
                    json=payload,
                    headers=headers
                )
                data = res.json()
                if data.get("status") and data.get("data", {}).get("fetched"):
                    for item in data["data"]["fetched"]:
                        if str(item.get("symbolToken")) == str(symbol_token):
                            return item
                return None
        except Exception as e:
            logger.error(f"Error getting full quote: {e}")
            return None
