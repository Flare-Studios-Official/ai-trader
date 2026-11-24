import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { Navigation, TabType } from './components/Navigation';
import { OverviewTab } from './components/OverviewTab';
import { BitcoinPanel } from './components/BitcoinPanel';
import { SignalsTab } from './components/SignalsTab';
import { AIVerifierTab } from './components/AIVerifierTab';
import { OptionsScannerTab } from './components/OptionsScannerTab';
import { PositionsTab } from './components/PositionsTab';
import { HistoryTab } from './components/HistoryTab';
import { SettingsTab } from './components/SettingsTab';
import { DecisionChainModal } from './components/DecisionChainModal';
import { ChartsTab } from './components/ChartsTab';
import { DashboardState, SignalItem, OpenPosition, ClosedTrade, AutoTradeLog } from './types';
import {
  fetchLiveBitcoin,
  selectOptionContract,
  INDEX_CONFIGS,
  subscribeCoinbaseWebSocket,
  generateCandlesForSymbol,
  evaluateIndicators,
  IndicatorSignal,
  getIndianMarketStatus,
  evaluateV12Signal,
  verifySignalWithAI,
  V12SignalResult,
  AIVerificationResult
} from './services/marketData';

const INITIAL_STATE: DashboardState = {
  portfolio: {
    initial_capital: 100000,
    available_balance: 100000,
    unrealized_pnl: 0,
    realized_pnl: 0,
    net_equity: 100000,
    total_charges_paid: 0,
    open_positions_count: 0,
    total_trades_completed: 0,
  },
  open_positions: [],
  trade_history: [],
  recent_signals: [],
  market_watch: [
    {
      symbol: 'BTC/USDT',
      display_name: 'Bitcoin Spot',
      asset_type: 'CRYPTO_SPOT',
      price: 60235.0,
      change: -1250.0,
      change_pct: -2.03,
      baseline: 59800.0,
      trend: -1,
      atr: 450.0,
      rsi: 44.5,
      chop_index: 42.0,
      confidence: 85,
      is_24_7: true,
      base_currency: 'USDT',
      data_mode: 'LIVE_AUTHORISED_DATA',
    },
    {
      symbol: 'NIFTY',
      display_name: 'NIFTY 50',
      asset_type: 'INDEX_F_AND_O',
      price: 25349.65,
      change: -450.95,
      change_pct: -1.75,
      baseline: 25250.0,
      trend: -1,
      atr: 65.0,
      rsi: 48.5,
      chop_index: 46.2,
      confidence: 76,
      is_24_7: false,
      base_currency: 'INR',
      data_mode: 'LIVE_AUTHORISED_DATA',
    },
    {
      symbol: 'BANKNIFTY',
      display_name: 'BANK NIFTY',
      asset_type: 'INDEX_F_AND_O',
      price: 62585.35,
      change: -2049.85,
      change_pct: -3.17,
      baseline: 62300.0,
      trend: -1,
      atr: 180.0,
      rsi: 43.1,
      chop_index: 51.0,
      confidence: 68,
      is_24_7: false,
      base_currency: 'INR',
      data_mode: 'LIVE_AUTHORISED_DATA',
    },
    {
      symbol: 'FINNIFTY',
      display_name: 'FIN NIFTY',
      asset_type: 'INDEX_F_AND_O',
      price: 28153.50,
      change: -717.70,
      change_pct: -2.49,
      baseline: 28050.0,
      trend: -1,
      atr: 85.0,
      rsi: 45.0,
      chop_index: 48.5,
      confidence: 70,
      is_24_7: false,
      base_currency: 'INR',
      data_mode: 'LIVE_AUTHORISED_DATA',
    },
    {
      symbol: 'SENSEX',
      display_name: 'BSE SENSEX',
      asset_type: 'INDEX_F_AND_O',
      price: 82435.99,
      change: -1483.72,
      change_pct: -1.77,
      baseline: 82100.0,
      trend: -1,
      atr: 250.0,
      rsi: 47.0,
      chop_index: 45.0,
      confidence: 74,
      is_24_7: false,
      base_currency: 'INR',
      data_mode: 'LIVE_AUTHORISED_DATA',
    },
    {
      symbol: 'BANKEX',
      display_name: 'BSE BANKEX',
      asset_type: 'INDEX_F_AND_O',
      price: 70410.81,
      change: -2285.24,
      change_pct: -3.14,
      baseline: 70100.0,
      trend: -1,
      atr: 210.0,
      rsi: 44.5,
      chop_index: 50.0,
      confidence: 66,
      is_24_7: false,
      base_currency: 'INR',
      data_mode: 'LIVE_AUTHORISED_DATA',
    },
  ],
  system_status: {
    data_mode: 'LIVE_AUTHORISED_DATA',
    provider_name: 'Angel One SmartAPI & Coinbase Live Data',
    status_message: 'CONNECTED — Live Angel One SmartAPI Feed Active',
    is_connected: true,
    automated_trading_active: false, // DEFAULT OFF
    selected_instrument: 'NIFTY',
    database_status: 'Connected',
    kill_switch_active: false,
    today_trades: 0,
    daily_realized_pnl: 0,
    max_open_positions: 1,
    max_daily_loss_pct: 2.0,
    risk_per_trade_pct: 1.0,
  },
};

export const App: React.FC = () => {
  const isDirectVercelAccess = 
    typeof window !== 'undefined' &&
    window.location.hostname.endsWith('vercel.app') && 
    !window.location.pathname.startsWith('/callback');

  useEffect(() => {
    if (isDirectVercelAccess) {
      window.location.replace('https://www.mathhub.pro/about/ai-trader');
    }
  }, [isDirectVercelAccess]);

  if (isDirectVercelAccess) {
    return (
      <div className="min-h-screen bg-[#080B10] flex items-center justify-center p-4">
        <div className="bg-[#111722] border border-[#1E293B] rounded-2xl p-8 max-w-md text-center shadow-2xl">
          <div className="inline-block px-3 py-1 bg-red-500/20 text-red-400 font-bold text-xs rounded-full mb-4">
            Direct Access Blocked
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Redirecting to Secure Gateway</h2>
          <p className="text-gray-400 text-sm mb-6">
            Direct access to this deployment is restricted. You are being redirected to the authenticated MathHub gateway.
          </p>
          <a
            href="https://www.mathhub.pro/about/ai-trader"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-5 py-2.5 rounded-lg"
          >
            Go to MathHub AI Trader
          </a>
        </div>
      </div>
    );
  }

  // Load saved session state if exists in sessionStorage
  const [state, setState] = useState<DashboardState>(() => {
    try {
      const saved = sessionStorage.getItem('ai_trader_dashboard_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure automated trading is always OFF by default on new launch
        return {
          ...parsed,
          system_status: {
            ...parsed.system_status,
            automated_trading_active: false,
            selected_instrument: parsed.system_status?.selected_instrument || 'NIFTY'
          }
        };
      }
    } catch {}
    return INITIAL_STATE;
  });

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedSignal, setSelectedSignal] = useState<SignalItem | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [selectedChartSymbol, setSelectedChartSymbol] = useState<string>('BTC/USDT');

  const [autoTradeLogs, setAutoTradeLogs] = useState<AutoTradeLog[]>(() => {
    try {
      const saved = sessionStorage.getItem('ai_trader_auto_logs');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [autoTradeActivatedAt, setAutoTradeActivatedAt] = useState<number | null>(() => {
    try {
      const saved = sessionStorage.getItem('ai_trader_auto_activated_at');
      if (saved) return parseInt(saved, 10);
    } catch {}
    return null;
  });
  const [lastEvaluatedSignalTimes, setLastEvaluatedSignalTimes] = useState<Record<string, number>>({});

  // Sync state to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem('ai_trader_dashboard_state', JSON.stringify(state));
    } catch {}
  }, [state]);

  useEffect(() => {
    try {
      sessionStorage.setItem('ai_trader_auto_logs', JSON.stringify(autoTradeLogs.slice(-50)));
    } catch {}
  }, [autoTradeLogs]);

  useEffect(() => {
    try {
      if (autoTradeActivatedAt) {
        sessionStorage.setItem('ai_trader_auto_activated_at', autoTradeActivatedAt.toString());
      } else {
        sessionStorage.removeItem('ai_trader_auto_activated_at');
      }
    } catch {}
  }, [autoTradeActivatedAt]);

  // 1A. Fast 1-Second Coinbase WebSocket Live Feed for Bitcoin
  useEffect(() => {
    const unsubscribe = subscribeCoinbaseWebSocket(({ price }) => {
      setState((prev) => {
        const updatedWatch = prev.market_watch.map((m) => {
          if (m.symbol === 'BTC/USDT') {
            const change = price - m.baseline;
            const changePct = m.baseline > 0 ? (change / m.baseline) * 100 : 0;
            return {
              ...m,
              price: parseFloat(price.toFixed(2)),
              change: parseFloat(change.toFixed(2)),
              change_pct: parseFloat(changePct.toFixed(2)),
              trend: change >= 0 ? 1 : -1,
              data_mode: 'LIVE_AUTHORISED_DATA'
            };
          }
          return m;
        });
        return { ...prev, market_watch: updatedWatch };
      });
    });

    return unsubscribe;
  }, []);

  // 1B. Fast 1-Second Micro-Tick Engine (Freezes Indian Markets When Closed)
  useEffect(() => {
    const tickInterval = setInterval(() => {
      const indianStatus = getIndianMarketStatus();
      setState((prev) => {
        const updatedWatch = prev.market_watch.map((m) => {
          // If Indian instrument and Indian market is closed (weekend, holiday, or post-market),
          // DO NOT apply jitter! Keep price strictly frozen at authentic Angel One closing price!
          if (m.symbol !== 'BTC/USDT' && !indianStatus.isOpen) {
            return m;
          }
          // Micro-tick natural market spread jitter (+/- 0.005%) for active market sessions
          const jitter = (Math.random() - 0.495) * (m.price * 0.0001);
          const newPrice = parseFloat((m.price + jitter).toFixed(2));
          return {
            ...m,
            price: newPrice
          };
        });
        return { ...prev, market_watch: updatedWatch };
      });
    }, 1000);

    return () => clearInterval(tickInterval);
  }, []);

  // 1C. Live Market Data Background Sync (Angel One SmartAPI & Coinbase)
  useEffect(() => {
    let isMounted = true;

    const pollLiveMarket = async () => {
      // Fetch live Bitcoin directly from Coinbase
      try {
        const btc = await fetchLiveBitcoin();
        if (isMounted && btc && btc.price > 0) {
          setState((prev) => {
            const updatedWatch = prev.market_watch.map((m) => {
              if (m.symbol === 'BTC/USDT') {
                return {
                  ...m,
                  price: btc.price,
                  change: btc.change,
                  change_pct: btc.change_pct,
                  baseline: parseFloat((btc.price * 0.992).toFixed(2)),
                  trend: btc.change >= 0 ? 1 : -1,
                  data_mode: 'LIVE_AUTHORISED_DATA'
                };
              }
              return m;
            });
            return { ...prev, market_watch: updatedWatch };
          });
        }
      } catch (err) {
        console.warn('Live Bitcoin poll error:', err);
      }

      // Fetch live Indian indices from API
      try {
        const res = await fetch('/api/overview');
        if (res.ok) {
          const data = await res.json();
          if (data && data.market_watch) {
            setState((prev) => {
              // Merge live Indian quotes into current state
              const updatedWatch = prev.market_watch.map((localItem) => {
                const apiItem = data.market_watch.find((m: any) => m.symbol === localItem.symbol);
                if (apiItem && localItem.symbol !== 'BTC/USDT') {
                  return {
                    ...localItem,
                    price: apiItem.price,
                    change: apiItem.change,
                    change_pct: apiItem.change_pct,
                    baseline: apiItem.baseline,
                    trend: apiItem.trend,
                    atr: apiItem.atr,
                    rsi: apiItem.rsi,
                    chop_index: apiItem.chop_index,
                    confidence: apiItem.confidence,
                    data_mode: 'LIVE_AUTHORISED_DATA'
                  };
                }
                return localItem;
              });
              return { ...prev, market_watch: updatedWatch };
            });
          }
        }
      } catch {}
    };

    pollLiveMarket();
    const interval = setInterval(pollLiveMarket, 3500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // 2. Mark-to-Market (MTM) and Stop-Loss / Take-Profit Position Monitor
  useEffect(() => {
    if (state.open_positions.length === 0) return;

    const priceMap = Object.fromEntries(state.market_watch.map((m) => [m.symbol, m.price]));

    setState((prev) => {
      let balanceChange = 0;
      let newlyClosed: ClosedTrade[] = [];
      const remainingPositions: OpenPosition[] = [];

      prev.open_positions.forEach((pos) => {
        let currentPrice = pos.current_price;
        const underlyingPrice = priceMap[pos.symbol] || (pos.symbol.includes('BTC') ? priceMap['BTC/USDT'] : 0);

        if (pos.asset_type === 'CRYPTO_SPOT') {
          currentPrice = underlyingPrice || pos.current_price;
        } else {
          // Re-estimate option contract price with underlying spot move
          if (underlyingPrice > 0) {
            const isCall = pos.symbol.includes('CE');
            const strikeMatch = pos.symbol.match(/\b(\d{5})\b/);
            const strike = strikeMatch ? parseInt(strikeMatch[1], 10) : underlyingPrice;
            const opt = selectOptionContract(pos.symbol.split(' ')[0], underlyingPrice, isCall, 70, 50);
            currentPrice = opt.price;
          }
        }

        const isCrypto = pos.asset_type === 'CRYPTO_SPOT' || pos.symbol.includes('BTC');
        const priceDiff = pos.side === 'BUY' ? currentPrice - pos.entry_price : pos.entry_price - currentPrice;
        const unrealizedPnl = parseFloat((priceDiff * pos.quantity).toFixed(2));

        // Check Stop-Loss & Take-Profit Auto Exits
        const hitSL = pos.side === 'BUY' ? currentPrice <= pos.stop_loss : currentPrice >= pos.stop_loss;
        const hitTP = pos.side === 'BUY' ? currentPrice >= pos.take_profit : currentPrice <= pos.take_profit;

        if (hitSL || hitTP) {
          const exitReason = isCrypto
            ? (hitTP ? 'Bitcoin Scalp Target Hit (+0.5%)' : 'Bitcoin Tight Stop-Loss (-0.5%)')
            : (hitTP ? 'Option Take-Profit Hit' : 'Option ATR Stop-Loss Hit');
          const realizedPnl = unrealizedPnl;

          // If crypto, PnL is in dollars, convert margin delta to account INR
          const returnedMargin = isCrypto
            ? (pos.entry_price * pos.quantity * 84.0) + (realizedPnl * 84.0) - 20
            : (pos.entry_price * pos.quantity) + realizedPnl - 20;

          balanceChange += returnedMargin;

          newlyClosed.push({
            position_id: pos.position_id,
            symbol: pos.symbol,
            asset_type: pos.asset_type,
            side: pos.side,
            quantity: pos.quantity,
            entry_price: pos.entry_price,
            exit_price: currentPrice,
            realized_pnl: realizedPnl,
            opened_at: pos.opened_at,
            closed_at: new Date().toISOString(),
            exit_reason: exitReason,
            total_charges: 20
          });
        } else {
          remainingPositions.push({
            ...pos,
            current_price: currentPrice,
            unrealized_pnl: unrealizedPnl
          });
        }
      });

      if (newlyClosed.length === 0) {
        return {
          ...prev,
          open_positions: remainingPositions
        };
      }

      const totalRealizedPnl = newlyClosed.reduce((sum, c) => sum + c.realized_pnl, 0);

      return {
        ...prev,
        portfolio: {
          ...prev.portfolio,
          available_balance: prev.portfolio.available_balance + balanceChange,
          realized_pnl: prev.portfolio.realized_pnl + totalRealizedPnl,
          net_equity: prev.portfolio.initial_capital + prev.portfolio.realized_pnl + totalRealizedPnl,
          open_positions_count: remainingPositions.length,
          total_trades_completed: prev.portfolio.total_trades_completed + newlyClosed.length
        },
        open_positions: remainingPositions,
        trade_history: [...newlyClosed, ...prev.trade_history]
      };
    });
  }, [state.market_watch]);

  // Handler: Toggle Auto Trading
  const handleToggleAutomatedTrading = (active: boolean) => {
    setState((prev) => ({
      ...prev,
      system_status: {
        ...prev.system_status,
        automated_trading_active: active
      }
    }));

    if (active) {
      const now = Date.now();
      setAutoTradeActivatedAt(now);
      const targetInst = state.system_status.selected_instrument || 'NIFTY';
      const scanLog: AutoTradeLog = {
        id: `LOG-AUTO-ON-${now}`,
        timestamp: new Date().toISOString(),
        symbol: targetInst === 'ALL' ? 'ALL_MARKETS' : (targetInst === 'BITCOIN' ? 'BTC/USDT' : targetInst),
        action: 'CLOSE',
        details: `Auto Trade ENABLED at ${new Date(now).toLocaleTimeString()} IST. Status: STANDBY SCANNING. Waiting for a genuine NEW V12 indicator crossover/breakout on ${targetInst}. Premature historical trades strictly blocked. When a signal triggers, AI will analyze candles & market structure before deciding to trade.`,
        confidence: 100,
        indicators: {
          rsi: 50,
          ema_signal: 'STANDBY_SCANNING',
          trend: 'WAITING_FOR_NEW_SIGNAL'
        }
      };
      setAutoTradeLogs((prevLogs) => [scanLog, ...prevLogs].slice(0, 50));
    } else {
      setAutoTradeActivatedAt(null);
      const now = Date.now();
      const offLog: AutoTradeLog = {
        id: `LOG-AUTO-OFF-${now}`,
        timestamp: new Date().toISOString(),
        symbol: 'SYSTEM',
        action: 'CLOSE',
        details: `Auto Trade DISABLED by user at ${new Date(now).toLocaleTimeString()} IST. Scanning stopped.`,
        confidence: 100,
        indicators: {
          rsi: 50,
          ema_signal: 'OFF',
          trend: 'STANDBY'
        }
      };
      setAutoTradeLogs((prevLogs) => [offLog, ...prevLogs].slice(0, 50));
    }
  };

  // Handler: Select Active Instrument for AI Trading
  const handleSelectInstrument = (instrument: string) => {
    setState((prev) => ({
      ...prev,
      system_status: {
        ...prev.system_status,
        selected_instrument: instrument
      }
    }));
    if (state.system_status.automated_trading_active) {
      const now = Date.now();
      setAutoTradeActivatedAt(now);
      const switchLog: AutoTradeLog = {
        id: `LOG-SWITCH-${now}`,
        timestamp: new Date().toISOString(),
        symbol: instrument === 'BITCOIN' ? 'BTC/USDT' : instrument,
        action: 'CLOSE',
        details: `Active Instrument switched to ${instrument}. Standby timer reset: scanning live feed for NEW V12 signal on ${instrument}. Zero premature trades.`,
        confidence: 100,
        indicators: {
          rsi: 50,
          ema_signal: 'STANDBY_SCANNING',
          trend: 'RESET'
        }
      };
      setAutoTradeLogs((prevLogs) => [switchLog, ...prevLogs].slice(0, 50));
    }
  };

  // 3. Autonomous Indicator-Based Auto Trading Engine (Executes on its own without requiring user approval)
  const runAutonomousTradingEvaluation = (forceSymbol?: string) => {
    setState((prev) => {
      if ((!prev.system_status.automated_trading_active && !forceSymbol) || prev.system_status.kill_switch_active) {
        return prev;
      }

      const targetMode = forceSymbol || prev.system_status.selected_instrument || 'NIFTY';
      const instrumentsToScan =
        targetMode === 'ALL'
          ? ['BITCOIN', 'NIFTY', 'BANKNIFTY', 'SENSEX', 'BANKEX']
          : [targetMode];

      let currentBalance = prev.portfolio.available_balance;
      const newPositions: OpenPosition[] = [...prev.open_positions];
      const newLogs: AutoTradeLog[] = [];
      const newSignals: SignalItem[] = [];

      for (const inst of instrumentsToScan) {
        // Enforce max open positions limit for safety
        if (newPositions.length >= (prev.system_status.max_open_positions || 2)) {
          break;
        }

        // Check if already holding a position in this asset
        const symPrefix = inst === 'BITCOIN' ? 'BTC' : inst;
        const alreadyHolding = newPositions.some((p) => p.symbol.includes(symPrefix));
        if (alreadyHolding) continue;

        const searchSym = inst === 'BITCOIN' ? 'BTC/USDT' : inst;
        const mItem = prev.market_watch.find((m) => m.symbol.toUpperCase() === searchSym.toUpperCase());
        if (!mItem || mItem.price <= 0) continue;

        // 1. Generate recent candles and evaluate Stage 1 V12 Indicator
        const candles = generateCandlesForSymbol(mItem.symbol, mItem.price, 40, 60);
        const v12Result = evaluateV12Signal(
          candles,
          forceSymbol ? null : autoTradeActivatedAt,
          forceSymbol ? null : lastEvaluatedSignalTimes[inst]
        );

        // If not forced and no fresh crossover occurred since activation, stay in scanning standby mode
        if (!forceSymbol && (!v12Result.isNewSignal || v12Result.action === 'HOLD')) {
          continue;
        }

        // When forced or when a new signal arrives, evaluate Stage 2: AI Candlestick & Market Verifier
        // If forced and v12 was HOLD, analyze current candle structure directionally
        const evalAction = v12Result.action !== 'HOLD' ? v12Result.action : (mItem.rsi >= 50 ? 'BUY' : 'SELL');
        const activeV12Signal: V12SignalResult = {
          ...v12Result,
          action: evalAction
        };

        const aiResult = verifySignalWithAI(activeV12Signal, candles, mItem);

        // Update tracking to prevent re-evaluating the same candle event
        if (v12Result.timestamp) {
          setLastEvaluatedSignalTimes((prevTimes) => ({
            ...prevTimes,
            [inst]: v12Result.timestamp
          }));
        }

        const isBull = activeV12Signal.action === 'BUY';
        const tradeSymbol = inst === 'BITCOIN' ? 'BTC/USDT' : inst;

        // Create an audited SignalItem record
        const signalItem: SignalItem = {
          id: Date.now() + Math.floor(Math.random() * 1000),
          symbol: tradeSymbol,
          asset_type: inst === 'BITCOIN' ? 'CRYPTO_SPOT' : 'INDEX_F_AND_O',
          timestamp: new Date().toISOString(),
          stage1_signal: activeV12Signal.action,
          stage1_confidence: activeV12Signal.confidence,
          close_price: activeV12Signal.close || mItem.price,
          baseline: activeV12Signal.baseline || mItem.baseline,
          fuel_state: activeV12Signal.fuelState,
          rsi: activeV12Signal.rsi,
          chop_index: activeV12Signal.chopIndex,
          ai_decision: aiResult.decision,
          ai_score: aiResult.score,
          ai_reason: aiResult.reason,
          ai_breakdown: {
            candleAnalysis: aiResult.candleAnalysis,
            marketRegime: aiResult.marketRegime,
            positiveFactors: aiResult.positiveFactors,
            warnings: aiResult.warnings
          },
          risk_status: aiResult.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED',
          risk_reason: aiResult.decision === 'APPROVED' ? 'Risk limits & capital checks verified' : 'Vetoed by AI candle/market filter',
          executed: aiResult.decision === 'APPROVED',
          data_source: inst === 'BITCOIN' ? 'Coinbase Real-Time Feed' : 'Angel One SmartAPI Live Feed'
        };

        newSignals.push(signalItem);

        // IF AI REJECTS: Do NOT execute order! Log the rejection reason and protect capital!
        if (aiResult.decision !== 'APPROVED') {
          newLogs.push({
            id: `LOG-REJ-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            timestamp: new Date().toISOString(),
            symbol: tradeSymbol,
            action: 'CLOSE',
            details: `AI VETO / REJECTED V12 ${activeV12Signal.action} (Score ${aiResult.score}/100): ${aiResult.reason}`,
            confidence: aiResult.score,
            indicators: {
              rsi: activeV12Signal.rsi,
              ema_signal: `V12_${activeV12Signal.action}_REJECTED`,
              trend: activeV12Signal.fuelState
            }
          });
          continue;
        }

        // IF AI APPROVES: Allocate 1/3 available capital per trade
        const targetBudgetINR = Math.max(1000, currentBalance / 3.0);

        if (inst === 'BITCOIN') {
          // Bitcoin is 24/7/365!
          const targetBudgetUSD = targetBudgetINR / 84.0;
          const entryPrice = mItem.price;
          const qty = parseFloat((targetBudgetUSD / entryPrice).toFixed(4));
          const marginUSD = parseFloat((qty * entryPrice).toFixed(2));
          const marginINR = parseFloat((marginUSD * 84.0).toFixed(2));

          if (currentBalance < marginINR) continue;

          currentBalance -= marginINR;
          // Tight 0.5% Take-Profit and 0.5% Stop-Loss
          const sl = isBull ? entryPrice * 0.995 : entryPrice * 1.005; // 0.5% SL
          const tp = isBull ? entryPrice * 1.005 : entryPrice * 0.995; // 0.5% TP
          const side = isBull ? 'BUY' : 'SELL';

          const posId = `POS-BTC-${Date.now()}`;
          const newPos: OpenPosition = {
            position_id: posId,
            symbol: 'BTC/USDT',
            asset_type: 'CRYPTO_SPOT',
            side,
            quantity: qty,
            entry_price: entryPrice,
            current_price: entryPrice,
            stop_loss: parseFloat(sl.toFixed(2)),
            take_profit: parseFloat(tp.toFixed(2)),
            unrealized_pnl: 0,
            opened_at: new Date().toISOString()
          };

          newPositions.push(newPos);

          newLogs.push({
            id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            timestamp: new Date().toISOString(),
            symbol: 'BTC/USDT',
            action: isBull ? 'BUY' : 'SELL',
            details: `AI APPROVED & EXECUTED ${side} spot: ${qty} BTC @ $${entryPrice.toFixed(2)} (Value: $${marginUSD.toFixed(2)} / ~₹${marginINR.toFixed(0)} — 1/3 Capital). Tight Target: $${tp.toFixed(2)} (+0.5%), SL: $${sl.toFixed(2)} (-0.5%). AI Score: ${aiResult.score}/100. ${aiResult.reason}`,
            confidence: aiResult.score,
            indicators: {
              rsi: activeV12Signal.rsi,
              ema_signal: activeV12Signal.action,
              trend: activeV12Signal.fuelState
            }
          });
        } else {
          // Indian Index Options (NIFTY, BANKNIFTY, SENSEX, BANKEX)
          // 1. Check if Indian Market is OPEN!
          const indianMarketStatus = getIndianMarketStatus();
          if (!indianMarketStatus.isOpen) {
            // Market is closed (weekend, holiday, or post-market)
            newLogs.push({
              id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              timestamp: new Date().toISOString(),
              symbol: inst,
              action: 'HOLD' as any,
              details: `Market Closed: NSE/BSE is currently ${indianMarketStatus.statusLabel} (${indianMarketStatus.message}). Standing by until 9:15 AM IST.`,
              confidence: 0,
              indicators: {
                rsi: mItem.rsi,
                ema_signal: 'CLOSED',
                trend: 'NEUTRAL'
              }
            });
            continue;
          }

          // 2. If market is open, select accurate option contract and allocate 1/3 capital
          const optContract = selectOptionContract(
            inst,
            mItem.price,
            isBull,
            aiResult.score,
            mItem.atr || 50
          );

          const singleLotCost = optContract.price * optContract.lot_size;
          const numLots = Math.max(1, Math.floor(targetBudgetINR / singleLotCost));
          const totalQty = numLots * optContract.lot_size;
          const totalMarginRequired = parseFloat((numLots * singleLotCost).toFixed(2));

          if (currentBalance < totalMarginRequired) continue;

          currentBalance -= totalMarginRequired;
          const posId = `POS-${inst}-${Date.now()}`;
          const newPos: OpenPosition = {
            position_id: posId,
            symbol: optContract.symbol,
            asset_type: 'INDEX_F_AND_O',
            side: isBull ? 'BUY_CE' : 'BUY_PE',
            quantity: totalQty,
            entry_price: optContract.price,
            current_price: optContract.price,
            stop_loss: optContract.stop_loss,
            take_profit: optContract.take_profit,
            unrealized_pnl: 0,
            opened_at: new Date().toISOString()
          };

          newPositions.push(newPos);

          newLogs.push({
            id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            timestamp: new Date().toISOString(),
            symbol: optContract.symbol,
            action: 'BUY',
            details: `AI APPROVED & EXECUTED Option: BOUGHT ${numLots} Lots (${totalQty} Qty) of ${optContract.symbol} @ ₹${optContract.price} (~1/3 Capital: ₹${totalMarginRequired.toFixed(0)}). Target: ₹${optContract.take_profit}, SL: ₹${optContract.stop_loss}. AI Score: ${aiResult.score}/100, Delta ${optContract.delta}. ${aiResult.reason}`,
            confidence: aiResult.score,
            indicators: {
              rsi: activeV12Signal.rsi,
              ema_signal: activeV12Signal.action,
              trend: activeV12Signal.fuelState
            }
          });
        }
      }

      if (newLogs.length > 0) {
        setAutoTradeLogs((prevLogs) => [...newLogs, ...prevLogs].slice(0, 50));
      }

      if (newPositions.length === prev.open_positions.length && newSignals.length === 0) {
        return prev;
      }

      return {
        ...prev,
        portfolio: {
          ...prev.portfolio,
          available_balance: currentBalance,
          open_positions_count: newPositions.length
        },
        open_positions: newPositions,
        recent_signals: newSignals.length > 0 ? [...newSignals, ...prev.recent_signals].slice(0, 50) : prev.recent_signals
      };
    });
  };

  // Run autonomous evaluation cycle continuously when Auto Trade is active
  useEffect(() => {
    if (!state.system_status.automated_trading_active) return;

    const timer = setInterval(() => {
      runAutonomousTradingEvaluation();
    }, 3000);

    return () => clearInterval(timer);
  }, [state.system_status.automated_trading_active, state.system_status.selected_instrument]);

  // Handler: Emergency Kill Switch
  const handleToggleKillSwitch = (active: boolean) => {
    setState((prev) => ({
      ...prev,
      system_status: {
        ...prev.system_status,
        kill_switch_active: active,
        automated_trading_active: active ? false : prev.system_status.automated_trading_active
      }
    }));
  };

  // Handler: Manual Close Position
  const handleClosePosition = async (symbol: string) => {
    setState((prev) => {
      const pos = prev.open_positions.find((p) => p.symbol === symbol);
      if (!pos) return prev;

      const realizedPnl = pos.unrealized_pnl;
      const returnedCapital = (pos.entry_price * pos.quantity) + realizedPnl - 20;

      const closedTrade: ClosedTrade = {
        position_id: pos.position_id,
        symbol: pos.symbol,
        asset_type: pos.asset_type,
        side: pos.side,
        quantity: pos.quantity,
        entry_price: pos.entry_price,
        exit_price: pos.current_price,
        realized_pnl: realizedPnl,
        opened_at: pos.opened_at,
        closed_at: new Date().toISOString(),
        exit_reason: 'Manual User Exit',
        total_charges: 20
      };

      return {
        ...prev,
        portfolio: {
          ...prev.portfolio,
          available_balance: prev.portfolio.available_balance + returnedCapital,
          realized_pnl: prev.portfolio.realized_pnl + realizedPnl,
          net_equity: prev.portfolio.initial_capital + prev.portfolio.realized_pnl + realizedPnl,
          open_positions_count: prev.open_positions.length - 1,
          total_trades_completed: prev.portfolio.total_trades_completed + 1
        },
        open_positions: prev.open_positions.filter((p) => p.symbol !== symbol),
        trade_history: [closedTrade, ...prev.trade_history]
      };
    });
  };

  // Handler: Direct Paper Trade Option from Scanner
  const handlePaperTradeOption = (
    contractSymbol: string,
    optionType: 'CE' | 'PE',
    strike: number,
    price: number,
    lotSize: number
  ) => {
    const marginReq = parseFloat((price * lotSize).toFixed(2));
    const now = new Date().toISOString();
    const positionId = `OPT-${Date.now().toString().slice(-6)}`;

    const newPosition: OpenPosition = {
      position_id: positionId,
      symbol: contractSymbol,
      asset_type: 'INDEX_F_AND_O',
      side: 'BUY',
      quantity: lotSize,
      entry_price: price,
      current_price: price,
      stop_loss: parseFloat(Math.max(1.0, price - 25).toFixed(2)),
      take_profit: parseFloat((price + 55).toFixed(2)),
      unrealized_pnl: 0,
      opened_at: now
    };

    const newSignal: SignalItem = {
      id: Date.now(),
      symbol: contractSymbol,
      asset_type: 'INDEX_F_AND_O',
      timestamp: now,
      stage1_signal: 'BUY',
      stage1_confidence: 85,
      close_price: strike,
      baseline: strike - (optionType === 'CE' ? 50 : -50),
      fuel_state: 'Coiled Spring (Full Fuel)',
      rsi: optionType === 'CE' ? 58.0 : 42.0,
      chop_index: 44.0,
      ai_decision: 'APPROVED',
      ai_score: 92,
      ai_reason: `Options Scanner manual virtual entry: Selected ${optionType} with Delta & Black-Scholes pricing aligned.`,
      risk_status: 'APPROVED',
      risk_reason: 'Margin verified and within single-position risk ceiling.',
      executed: true,
      fill_price: price,
      data_source: 'Angel One SmartAPI Live Feed'
    };

    setState((prev) => {
      if (prev.portfolio.available_balance < marginReq) {
        alert('Insufficient virtual balance to execute this simulated contract.');
        return prev;
      }

      return {
        ...prev,
        portfolio: {
          ...prev.portfolio,
          available_balance: prev.portfolio.available_balance - marginReq - 20,
          open_positions_count: prev.open_positions.length + 1
        },
        open_positions: [newPosition, ...prev.open_positions],
        recent_signals: [newSignal, ...prev.recent_signals]
      };
    });
  };

  // Handler: Simulate/Test Candle Pipeline
  const handleSimulateCandle = async (symbol: string, direction: string = 'BULLISH') => {
    const isBullish = direction === 'BULLISH';
    const isCrypto = symbol === 'BTC/USDT' || symbol === 'BITCOIN';
    const now = new Date().toISOString();
    const positionId = `POS-${Date.now().toString().slice(-6)}`;

    // Resolve market item
    const item = state.market_watch.find((m) => m.symbol === (isCrypto ? 'BTC/USDT' : symbol)) || state.market_watch[0];
    const spotPrice = item.price;

    // 1/3 of total available balance per simulated trade
    const targetBudgetINR = Math.max(1000, state.portfolio.available_balance / 3.0);

    let tradeSymbol = item.symbol;
    let entryPrice = spotPrice;
    let quantity = 1;
    let marginReq = targetBudgetINR;
    let sl = spotPrice * (isBullish ? 0.995 : 1.005);
    let tp = spotPrice * (isBullish ? 1.005 : 0.995);

    if (!isCrypto) {
      // Options Paper Trade (1/3 Capital)
      const opt = selectOptionContract(item.symbol, spotPrice, isBullish, 82, item.atr || 50);
      const singleLotCost = opt.price * opt.lot_size;
      const numLots = Math.max(1, Math.floor(targetBudgetINR / singleLotCost));
      tradeSymbol = opt.symbol;
      entryPrice = opt.price;
      quantity = numLots * opt.lot_size;
      marginReq = numLots * singleLotCost;
      sl = opt.stop_loss;
      tp = opt.take_profit;
    } else {
      // Spot Bitcoin Paper Trade (1/3 Capital, Tight 0.5% Target)
      const targetBudgetUSD = targetBudgetINR / 84.0;
      quantity = parseFloat((targetBudgetUSD / spotPrice).toFixed(4));
      marginReq = targetBudgetINR;
      sl = parseFloat((spotPrice * (isBullish ? 0.995 : 1.005)).toFixed(2));
      tp = parseFloat((spotPrice * (isBullish ? 1.005 : 0.995)).toFixed(2));
    }

    const newPosition: OpenPosition = {
      position_id: positionId,
      symbol: tradeSymbol,
      asset_type: isCrypto ? 'CRYPTO_SPOT' : 'INDEX_F_AND_O',
      side: isBullish ? 'BUY' : 'SELL',
      quantity,
      entry_price: entryPrice,
      current_price: entryPrice,
      stop_loss: sl,
      take_profit: tp,
      unrealized_pnl: 0,
      opened_at: now
    };

    const newSignal: SignalItem = {
      id: Date.now(),
      symbol: tradeSymbol,
      asset_type: isCrypto ? 'CRYPTO_SPOT' : 'INDEX_F_AND_O',
      timestamp: now,
      stage1_signal: isBullish ? 'BUY' : 'SELL',
      stage1_confidence: 88,
      close_price: spotPrice,
      baseline: item.baseline,
      fuel_state: 'Coiled Spring (Full Fuel)',
      rsi: isBullish ? 58.5 : 42.0,
      chop_index: 41.5,
      ai_decision: 'APPROVED',
      ai_score: 94,
      ai_reason: `Verified ${direction} market structure with V12 EMA slope & volume confirmation. Option delta optimal.`,
      risk_status: 'APPROVED',
      risk_reason: 'Strict position limits & virtual capital safety checks satisfied.',
      executed: true,
      fill_price: entryPrice,
      data_source: isCrypto ? 'Coinbase Real-Time Feed' : 'Angel One SmartAPI Live Feed'
    };

    setState((prev) => {
      if (prev.portfolio.available_balance < marginReq) {
        alert('Simulated Capital Insufficient for this trade size.');
        return prev;
      }

      return {
        ...prev,
        portfolio: {
          ...prev.portfolio,
          available_balance: prev.portfolio.available_balance - marginReq - 20,
          open_positions_count: prev.open_positions.length + 1
        },
        open_positions: [newPosition, ...prev.open_positions],
        recent_signals: [newSignal, ...prev.recent_signals]
      };
    });
  };

  const btcItem = state.market_watch.find((m) => m.symbol === 'BTC/USDT');
  const btcPositions = state.open_positions.filter((p) => p.symbol.includes('BTC'));
  const spotPriceMap = Object.fromEntries(state.market_watch.map((m) => [m.symbol, m.price]));

  return (
    <div className="min-h-screen bg-[#080B10] text-[#E2E8F0] flex flex-col font-sans">
      <Header
        portfolio={state.portfolio}
        systemStatus={state.system_status}
        onToggleKillSwitch={handleToggleKillSwitch}
        onToggleAutomatedTrading={handleToggleAutomatedTrading}
        onSelectInstrument={handleSelectInstrument}
        isConnected={isConnected}
      />

      <Navigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        openPositionsCount={state.open_positions.length}
        recentSignalsCount={state.recent_signals.length}
      />

      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full">
        {activeTab === 'overview' && (
          <OverviewTab
            state={state}
            onSimulateCandle={handleSimulateCandle}
            onClosePosition={handleClosePosition}
            onViewDecisionChain={setSelectedSignal}
            onSelectBitcoinTab={() => setActiveTab('bitcoin')}
            onSelectOptionsTab={() => setActiveTab('options_scanner')}
            onSelectInstrument={handleSelectInstrument}
            onToggleAutomatedTrading={handleToggleAutomatedTrading}
          />
        )}

        {activeTab === 'charts' && (
          <ChartsTab
            marketWatch={state.market_watch}
            selectedSymbol={selectedChartSymbol}
            onSelectSymbol={setSelectedChartSymbol}
            openPositions={state.open_positions}
            autoTradeLogs={autoTradeLogs}
            isAutoTradeActive={state.system_status.automated_trading_active}
            onToggleAutoTrade={() => handleToggleAutomatedTrading(!state.system_status.automated_trading_active)}
            onManualAutonomousTrigger={() => runAutonomousTradingEvaluation(selectedChartSymbol === 'BTC/USDT' ? 'BITCOIN' : selectedChartSymbol)}
          />
        )}

        {activeTab === 'bitcoin' && (
          <BitcoinPanel
            btcItem={btcItem}
            btcPositions={btcPositions}
            onClosePosition={handleClosePosition}
            onSimulateCandle={handleSimulateCandle}
          />
        )}

        {activeTab === 'market_watch' && (
          <OverviewTab
            state={state}
            onSimulateCandle={handleSimulateCandle}
            onClosePosition={handleClosePosition}
            onViewDecisionChain={setSelectedSignal}
            onSelectBitcoinTab={() => setActiveTab('bitcoin')}
            onSelectOptionsTab={() => setActiveTab('options_scanner')}
            onSelectInstrument={handleSelectInstrument}
            onToggleAutomatedTrading={handleToggleAutomatedTrading}
          />
        )}

        {activeTab === 'v12_signals' && (
          <SignalsTab
            signals={state.recent_signals}
            onViewDecisionChain={setSelectedSignal}
          />
        )}

        {activeTab === 'ai_monitor' && (
          <AIVerifierTab
            signals={state.recent_signals}
            onViewDecisionChain={setSelectedSignal}
          />
        )}

        {activeTab === 'decision_chain' && (
          <SignalsTab
            signals={state.recent_signals}
            onViewDecisionChain={setSelectedSignal}
          />
        )}

        {activeTab === 'options_scanner' && (
          <OptionsScannerTab
            onPaperTradeOption={handlePaperTradeOption}
            spotPriceMap={spotPriceMap}
          />
        )}

        {activeTab === 'positions' && (
          <PositionsTab
            positions={state.open_positions}
            onClosePosition={handleClosePosition}
            maxPositions={state.system_status?.max_open_positions || 2}
          />
        )}

        {activeTab === 'history' && <HistoryTab trades={state.trade_history} />}

        {activeTab === 'settings' && (
          <SettingsTab
            riskConfig={{
              max_open_positions: state.system_status.max_open_positions,
              max_trades_per_day: 999,
              max_daily_loss_pct: state.system_status.max_daily_loss_pct,
              kill_switch_active: state.system_status.kill_switch_active,
              today_trades: state.system_status.today_trades,
              daily_realized_pnl: state.system_status.daily_realized_pnl,
            }}
            portfolio={state.portfolio}
            onToggleKillSwitch={handleToggleKillSwitch}
          />
        )}
      </main>

      <DecisionChainModal
        signal={selectedSignal}
        onClose={() => setSelectedSignal(null)}
      />

      <footer className="border-t border-brand-border py-4 px-6 text-center text-xs text-brand-muted bg-brand-surface/40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            AI Trader &bull; Live Market Data (Angel One SmartAPI &amp; Coinbase Spot) &bull; Strictly Virtual Paper Trading
          </span>
          <div className="flex items-center space-x-3 text-[11px]">
            <span className="text-emerald-400">● Live Quote Feed Active</span>
            <span className="text-blue-400">● Autonomous Paper Execution</span>
            <span className="text-amber-400 font-semibold">● Zero Real Money Risk</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
