# AI Trader — Responsive Cloud Indian F&O Paper Trading System

A high-performance, cloud-hosted Indian Futures & Options (F&O) paper trading application built with:
- **FastAPI Backend (Python 3.12)**
- **Pure Python Replica of V12 Pine Script Indicator** (Zero repainting, identical mathematical formulation)
- **Independent AI Signal Verification Engine** (Stage 2 multi-factor regime & trend audit)
- **Deterministic Risk Engine** (₹1,00,000 capital, max 1 open position, 2% daily loss limit, 3 trades/day, ATR stops)
- **Simulated Indian F&O Paper Broker** (Option Greeks, Black-Scholes pricing, STT/exchange charges, realistic slippage)
- **React 18 + TypeScript + Tailwind CSS Frontend (PWA ready for iPad, Android, and PC browsers)**

---

## 1. Core Architecture

```
[ Angel One SmartAPI / Market Feed ]
                 │
                 ▼ (Closed 5m OHLCV Candles)
┌────────────────────────────────────────────────────────┐
│ STAGE 1: Python V12 Indicator Engine                   │
│ • Volatility-Adaptive Supertrend Envelope              │
│ • 3-Bar Fuel Stretch & Climax Exhaustion Filter        │
│ • Coiled Spring (Higher-Low/Lower-High Staircase)      │
│ • 15-Bar Box Ceiling/Floor Proximity Shields           │
│ • Candlestick Memory & 4-Pillar Confidence (0-100 pts) │
└────────────────────────┬───────────────────────────────┘
                         │ BUY / SELL / HOLD + Confidence
                         ▼
┌────────────────────────────────────────────────────────┐
│ STAGE 2: Independent AI Verification Engine            │
│ • Direction Invariance: Never alters signal direction  │
│ • Evaluates ADX, RSI, Volatility, Regime, Freshness   │
│ • Verdict: APPROVED / REJECTED / WAITING              │
└────────────────────────┬───────────────────────────────┘
                         │ APPROVED Signals
                         ▼
┌────────────────────────────────────────────────────────┐
│ STAGE 3: Deterministic Risk Management Engine          │
│ • Starting Capital: ₹1,00,000                         │
│ • Max Open Positions: Exactly 1                       │
│ • Max Daily Trades: 3 executions                      │
│ • Max Daily Loss: 2% (₹2,000 hard stop)                │
│ • ATR-based Dynamic Stop-Loss & Take-Profit Targets    │
│ • Emergency Paper Kill Switch                          │
└────────────────────────┬───────────────────────────────┘
                         │ Validated Order Intent
                         ▼
┌────────────────────────────────────────────────────────┐
│ STAGE 4: Cloud Paper Broker (Strictly Virtual)         │
│ • Simulated Market Orders & Fills                      │
│ • Real Indian F&O Contract Resolver (ATM/ITM, Lots)    │
│ • Realistic Liquidity Slippage (0.15%)                 │
│ • Statutory Indian Charges (Brokerage, STT, GST, SEBI) │
│ • Realized / Unrealized MTM P&L Calculation            │
│ • ZERO live broker routing (Strictly safe)             │
└────────────────────────┬───────────────────────────────┘
                         │ Real-time WebSockets
                         ▼
[ Responsive Cloud Dashboard (PC / iPad / Android Phone) ]
```

---

## 2. Testing & Parity Verification

Run the complete test suite:
```bash
python -m pytest backend/tests -v -s
```

All 13 unit tests verify:
1. **Mathematical RMA & EMA identity** vs Pine Script specifications.
2. **Band ratcheting & non-repainting causal invariant**.
3. **Climax exhaustion top/bottom blocking**.
4. **AI Verifier multi-factor scoring & stale data veto**.
5. **Deterministic risk limits** (₹1,00,000 balance, position limits, kill switch).
6. **Paper broker order fills, slippage, and statutory charges**.
7. **FastAPI REST endpoints and options scanner**.

---

## 3. Running Locally

### Backend:
```bash
# From workspace root
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend:
```bash
cd frontend
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser, iPad, or Android phone.

---

## 4. Cloud Deployment

### Backend on Render:
1. Connect this Git repository to Render.
2. Select **Web Service** using `render.yaml` or Dockerfile.
3. Region: **Singapore** (lowest latency to Mumbai/NSE).
4. Environment variables: Add your `ANGEL_API_KEY`, `ANGEL_CLIENT_CODE`, `ANGEL_PIN`, and `ANGEL_TOTP_SECRET` in Render dashboard.

### Frontend on Vercel:
1. Import repository on Vercel.
2. Root Directory: `frontend`.
3. Framework Preset: `Vite`.
4. Deploy! `vercel.json` automatically routes API and WebSocket requests to your Render backend.

---

## 5. Security & Safety Guarantee

- **Paper Trading Only:** The application contains **zero live order-placement routes**.
- **No Scraped Data:** Angel One SmartAPI is the designated source; no TradingView browser scraping.
- **Laptop Independence:** Once deployed on Render + Vercel, the application operates 24/7 in the cloud without requiring your laptop to remain on.
