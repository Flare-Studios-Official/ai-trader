import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health_check_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "DEMO_DATA" in data["data_mode"]


def test_overview_endpoint():
    response = client.get("/api/overview")
    assert response.status_code == 200
    data = response.json()
    assert "portfolio" in data
    assert "open_positions" in data
    assert "market_watch" in data
    assert "system_status" in data
    assert data["system_status"]["data_mode"] == "DEMO_DATA"
    assert "DEMO MODE" in data["system_status"]["status_message"]

    # Check that Bitcoin and Indian indices are present
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

    # BTC options check (explicitly spots only)
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
