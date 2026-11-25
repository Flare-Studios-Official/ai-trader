import os
os.environ["ENV"] = "test"
os.environ["MARKET_DATA_PROVIDER"] = "demo"

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health_check_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["data_mode"] in ("DEMO_DATA", "LIVE_AUTHORISED_DATA")


def test_overview_endpoint():
    response = client.get("/api/overview")
    assert response.status_code == 200
    data = response.json()
    assert "portfolio" in data
    assert "open_positions" in data
    assert "market_watch" in data
    assert "system_status" in data
    assert data["system_status"]["data_mode"] in ("DEMO_DATA", "LIVE_AUTHORISED_DATA")
    assert any(keyword in data["system_status"]["status_message"] for keyword in ("DEMO", "CONNECTED", "STANDBY"))

    symbols = [m["symbol"] for m in data["market_watch"]]
    assert "BTC/USDT" in symbols
    assert "NIFTY" in symbols
    assert "BANKNIFTY" in symbols
    assert "FINNIFTY" in symbols
    assert "SENSEX" in symbols
    assert "BANKEX" in symbols


def test_options_scanner_endpoint():
    response = client.get("/api/scanner/options?underlying=NIFTY")
    assert response.status_code == 200
    data = response.json()
    assert data["underlying"] == "NIFTY"
    assert len(data["strikes"]) > 0

    btc_res = client.get("/api/scanner/options?underlying=BTC/USDT")
    assert btc_res.status_code == 200
    assert "Spot" in btc_res.json()["message"]


def test_automated_trader_toggle():
    res_pause = client.post("/api/automated-trader/toggle", json={"active": False})
    assert res_pause.status_code == 200
    assert res_pause.json()["automated_trading_active"] is False

    res_resume = client.post("/api/automated-trader/toggle", json={"active": True})
    assert res_resume.status_code == 200
    assert res_resume.json()["automated_trading_active"] is True


def test_kill_switch_api():
    res = client.post("/api/risk/kill-switch", json={"active": True})
    assert res.status_code == 200
    assert res.json()["kill_switch_active"] is True

    res2 = client.post("/api/risk/kill-switch", json={"active": False})
    assert res2.status_code == 200
    assert res2.json()["kill_switch_active"] is False


def test_simulate_manual_candle():
    res = client.post("/api/simulate/candle", json={"symbol": "BTC/USDT", "direction": "BULLISH"})
    assert res.status_code == 200
    assert res.json()["status"] == "manual_candle_simulated"


def test_angel_one_oauth_callback():
    res = client.get("/api/auth/angelone/callback")
    assert res.status_code == 200
    assert "text/html" in res.headers["content-type"]
    assert "Angel One SmartAPI" in res.text
    assert "Authentication Callback Verified" in res.text

    res_with_tokens = client.get("/api/auth/angelone/callback?auth_token=mock_jwt&feed_token=mock_feed")
    assert res_with_tokens.status_code == 200
    assert "Session authorization tokens were received" in res_with_tokens.text


def test_gateway_secret_authorization_barrier(monkeypatch):
    monkeypatch.setenv("ENV", "production")
    monkeypatch.setenv("GATEWAY_SECRET", "unit-test-gateway-secret")
    external_client = TestClient(app, client=("198.51.100.25", 54321))
    blocked_res = external_client.get("/api/overview")
    assert blocked_res.status_code == 401
    assert "Direct backend access blocked" in blocked_res.json()["error"]

    authorized_res = external_client.get("/api/overview", headers={"x-gateway-secret": "unit-test-gateway-secret"})
    assert authorized_res.status_code == 200

    health_res = external_client.get("/api/health")
    assert health_res.status_code == 200
    cb_res = external_client.get("/api/auth/angelone/callback")
    assert cb_res.status_code == 200
