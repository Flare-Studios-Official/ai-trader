"""
AI Trader — Cloud FastAPI Application (Phase 1 Revised)
Indian F&O & Bitcoin Cloud Paper Trading Backend with Independent AI Verification and V12 Indicator Replica.
"""

import asyncio
from contextlib import asynccontextmanager
from datetime import datetime
import os
from typing import Any, Dict, Optional
import pandas as pd
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.core.database import init_db, SessionLocal, SignalLog, TradeRecord
from app.core.orchestrator import orchestrator
from app.core.automated_trader import automated_trader
from app.broker.instruments import ContractResolver, INDEX_SPECS, BlackScholesPricer, InstrumentType
from app.market_data.base import AssetType, DataMode


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # Start autonomous background paper trading worker
    automated_trader.start()
    
    # Broadcast price and state updates periodically
    async def periodic_broadcast():
        while True:
            await asyncio.sleep(4)
            try:
                await orchestrator.broadcast_snapshot()
            except Exception:
                pass
                
    broadcast_task = asyncio.create_task(periodic_broadcast())
    yield
    broadcast_task.cancel()
    automated_trader.stop()


app = FastAPI(
    title="AI Trader Backend",
    version="1.1.0",
    description="Responsive Cloud-Hosted Indian F&O & Bitcoin Automated Paper Trading Platform",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "app": "AI Trader — Cloud Paper Trading System",
        "status": "online",
        "version": "1.1.0",
        "data_mode": orchestrator.provider.data_mode.value,
        "provider": orchestrator.provider.provider_name,
        "banner": orchestrator.provider.status_message,
        "supported_assets": ["NIFTY", "BANKNIFTY", "FINNIFTY", "SENSEX", "BANKEX", "BTC/USDT"]
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "database": "connected (Supabase PostgreSQL / SQLite)",
        "provider": orchestrator.provider.provider_name,
        "data_mode": orchestrator.provider.data_mode.value,
        "automated_trader": "active" if automated_trader.is_active else "paused",
        "kill_switch": automated_trader.risk_manager.kill_switch_active
    }


@app.get("/api/overview")
async def get_overview():
    return await orchestrator.get_dashboard_state()


@app.get("/api/signals")
def get_signals(limit: int = 50):
    db = SessionLocal()
    try:
        signals = db.query(SignalLog).order_by(SignalLog.id.desc()).limit(limit).all()
        return [
            {
                "id": s.id,
                "symbol": s.symbol,
                "asset_type": s.asset_type,
                "timestamp": s.timestamp,
                "stage1_signal": s.stage1_signal,
                "stage1_confidence": s.stage1_confidence,
                "close_price": s.close_price,
                "baseline": s.baseline,
                "fuel_state": s.fuel_state,
                "rsi": s.rsi,
                "chop_index": s.chop_index,
                "ai_decision": s.ai_decision,
                "ai_score": s.ai_score,
                "ai_reason": s.ai_reason,
                "ai_breakdown": s.ai_breakdown,
                "risk_status": s.risk_status,
                "risk_reason": s.risk_reason,
                "executed": s.executed,
                "order_id": s.order_id,
                "fill_price": s.fill_price,
                "data_source": s.data_source
            }
            for s in signals
        ]
    finally:
        db.close()


@app.get("/api/positions")
def get_positions():
    broker = automated_trader.paper_broker
    return {
        "open_positions": [
            {
                "position_id": p.position_id,
                "symbol": p.symbol,
                "asset_type": p.contract.asset_type.value,
                "side": p.side,
                "quantity": p.quantity,
                "entry_price": p.entry_price,
                "current_price": p.current_price,
                "stop_loss": p.stop_loss,
                "take_profit": p.take_profit,
                "unrealized_pnl": p.unrealized_pnl,
                "opened_at": p.opened_at,
                "decision_chain": p.decision_chain
            }
            for p in broker.open_positions.values()
        ],
        "closed_positions": [
            {
                "position_id": p.position_id,
                "symbol": p.symbol,
                "asset_type": p.contract.asset_type.value,
                "side": p.side,
                "quantity": p.quantity,
                "entry_price": p.entry_price,
                "exit_price": p.exit_price,
                "realized_pnl": p.realized_pnl,
                "opened_at": p.opened_at,
                "closed_at": p.closed_at,
                "exit_reason": p.exit_reason,
                "total_charges": p.total_charges_paid
            }
            for p in reversed(broker.trade_history[-50:])
        ]
    }


class AutomatedTraderToggleRequest(BaseModel):
    active: bool


@app.post("/api/automated-trader/toggle")
async def toggle_automated_trader(req: AutomatedTraderToggleRequest):
    if req.active:
        automated_trader.start()
    else:
        automated_trader.stop()
    await orchestrator.broadcast_snapshot()
    return {
        "status": "success",
        "automated_trading_active": automated_trader.is_active,
        "message": "Automated paper trading " + ("RESUMED" if req.active else "PAUSED")
    }


class KillSwitchRequest(BaseModel):
    active: bool


@app.post("/api/risk/kill-switch")
async def toggle_kill_switch(req: KillSwitchRequest):
    automated_trader.risk_manager.trigger_kill_switch(req.active)
    await orchestrator.broadcast_snapshot()
    return {
        "status": "success",
        "kill_switch_active": automated_trader.risk_manager.kill_switch_active,
        "message": "Emergency Paper Kill Switch " + ("ACTIVATED" if req.active else "DEACTIVATED")
    }


@app.post("/api/positions/{symbol}/close")
async def manual_close_position(symbol: str):
    pos = automated_trader.paper_broker.open_positions.get(symbol)
    if not pos:
        raise HTTPException(status_code=404, detail="Open position not found")

    closed = automated_trader.paper_broker.close_position(symbol, pos.current_price, exit_reason="Manual User Exit")
    if closed:
        automated_trader.risk_manager.register_position_exit(pos.contract.underlying, closed.realized_pnl)
        await orchestrator.broadcast_snapshot()
        return {"status": "success", "closed_position": closed.position_id, "realized_pnl": closed.realized_pnl}
    raise HTTPException(status_code=500, detail="Failed to close position")


@app.get("/api/scanner/options")
async def get_options_chain(underlying: str = "NIFTY"):
    sym_key = underlying.upper()
    if sym_key in ["BTC", "BTC/USDT"]:
        return {
            "underlying": "BTC/USDT",
            "message": "Bitcoin is supported as Spot Paper Trading. Options derivatives are not available on BTC spot demo feed.",
            "asset_type": "CRYPTO_SPOT",
            "strikes": []
        }

    spec = INDEX_SPECS.get(sym_key, INDEX_SPECS["NIFTY"])
    quote = await orchestrator.provider.get_quote(sym_key)
    spot = quote.price
    atm_strike = ContractResolver.resolve_atm_strike(sym_key, spot)
    step = spec["strike_step"]

    strikes = [atm_strike + (i * step) for i in range(-5, 6)]
    chain = []
    for k in strikes:
        ce_px, ce_delta = BlackScholesPricer.price_option(spot, k, 3.0 / 365.0, volatility=0.14, is_call=True)
        pe_px, pe_delta = BlackScholesPricer.price_option(spot, k, 3.0 / 365.0, volatility=0.14, is_call=False)
        chain.append({
            "strike": k,
            "is_atm": (k == atm_strike),
            "call": {
                "symbol": f"{sym_key}26NOV{int(k)}CE",
                "price": ce_px,
                "delta": ce_delta,
                "lot_size": spec["lot_size"],
                "note": "Demo Analytical Estimate"
            },
            "put": {
                "symbol": f"{sym_key}26NOV{int(k)}PE",
                "price": pe_px,
                "delta": pe_delta,
                "lot_size": spec["lot_size"],
                "note": "Demo Analytical Estimate"
            }
        })

    return {
        "underlying": sym_key,
        "spot_price": spot,
        "atm_strike": atm_strike,
        "lot_size": spec["lot_size"],
        "strikes": chain,
        "data_mode": "DEMO_DATA (Theoretical Estimates)"
    }


class TriggerCandleRequest(BaseModel):
    symbol: str
    direction: Optional[str] = None


@app.post("/api/simulate/candle")
async def trigger_simulated_candle(req: TriggerCandleRequest):
    """Developer Manual Simulation Utility (Strictly separate from Automated Paper Trading)."""
    sym = req.symbol.upper()
    if sym == "BTC":
        sym = "BTC/USDT"
    
    quote = await orchestrator.provider.get_quote(sym)
    curr_px = quote.price

    if req.direction == "BULLISH":
        step = curr_px * 0.008
        o = curr_px
        c = curr_px + step
        h = c + (curr_px * 0.0005)
        l = o - (curr_px * 0.0002)
    elif req.direction == "BEARISH":
        step = curr_px * 0.008
        o = curr_px
        c = curr_px - step
        h = o + (curr_px * 0.0002)
        l = c - (curr_px * 0.0005)
    else:
        step = curr_px * 0.001
        o = curr_px
        c = curr_px + step
        h = max(o, c) + (curr_px * 0.0002)
        l = min(o, c) - (curr_px * 0.0002)

    candle = {
        "datetime": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "open": round(o, 2),
        "high": round(h, 2),
        "low": round(l, 2),
        "close": round(c, 2),
        "volume": 200000,
        "data_mode": "DEMO_DATA"
    }

    # Pass to automated trader pipeline
    df = await orchestrator.provider.get_candles(sym, timeframe="5m", bars=100)
    df = pd.concat([df, pd.DataFrame([candle])], ignore_index=True)
    if hasattr(orchestrator.provider, "candle_cache"):
        orchestrator.provider.candle_cache[sym] = df
        orchestrator.provider.current_prices[sym] = candle["close"]

    await automated_trader._evaluate_symbol_pipeline(sym)
    await orchestrator.broadcast_snapshot()
    return {"status": "manual_candle_simulated", "symbol": sym, "candle": candle}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await orchestrator.register_websocket(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        orchestrator.unregister_websocket(websocket)
    except Exception:
        orchestrator.unregister_websocket(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
