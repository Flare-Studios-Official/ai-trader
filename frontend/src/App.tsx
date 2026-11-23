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
import { DashboardState, SignalItem } from './types';

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
      price: 68450.0,
      change: 1250.0,
      change_pct: 1.86,
      baseline: 67800.0,
      trend: 1,
      atr: 420.0,
      rsi: 59.4,
      chop_index: 44.2,
      confidence: 82,
      is_24_7: true,
      base_currency: 'USDT',
      data_mode: 'DEMO_DATA',
    },
    {
      symbol: 'NIFTY',
      display_name: 'NIFTY 50',
      asset_type: 'INDEX_F_AND_O',
      price: 24520.0,
      change: 35.5,
      change_pct: 0.14,
      baseline: 24450.0,
      trend: 1,
      atr: 48.0,
      rsi: 58.2,
      chop_index: 46.5,
      confidence: 78,
      is_24_7: false,
      base_currency: 'INR',
      data_mode: 'DEMO_DATA',
    },
    {
      symbol: 'BANKNIFTY',
      display_name: 'BANK NIFTY',
      asset_type: 'INDEX_F_AND_O',
      price: 52350.0,
      change: -80.0,
      change_pct: -0.15,
      baseline: 52480.0,
      trend: -1,
      atr: 120.0,
      rsi: 44.5,
      chop_index: 52.0,
      confidence: 65,
      is_24_7: false,
      base_currency: 'INR',
      data_mode: 'DEMO_DATA',
    },
  ],
  system_status: {
    data_mode: 'DEMO_DATA',
    provider_name: 'Demo Market Provider (Internet Ref & Synthetic)',
    status_message: 'DEMO MODE — NOT CONNECTED TO LIVE BROKER DATA',
    is_connected: true,
    automated_trading_active: true,
    database_status: 'Supabase PostgreSQL / SQLite Connected',
    kill_switch_active: false,
    today_trades: 0,
    daily_realized_pnl: 0,
    max_open_positions: 2,
    max_daily_loss_pct: 2.0,
    risk_per_trade_pct: 1.0,
  },
};

export const App: React.FC = () => {
  const [state, setState] = useState<DashboardState>(INITIAL_STATE);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedSignal, setSelectedSignal] = useState<SignalItem | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

  const fetchOverview = async () => {
    try {
      const res = await fetch(`${apiBase}/api/overview`);
      if (res.ok) {
        const data = await res.json();
        setState(data);
      }
    } catch (e) {
      console.warn('API fetch error; using cached state:', e);
    }
  };

  useEffect(() => {
    fetchOverview();

    let wsUrl: string;
    if (import.meta.env.VITE_API_URL) {
      try {
        const url = new URL(import.meta.env.VITE_API_URL);
        const wsProto = url.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${wsProto}//${url.host}/ws`;
      } catch (err) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${protocol}//${window.location.host}/ws`;
      }
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      wsUrl = `${protocol}//${host}/ws`;
    }

    const connectWs = () => {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'FULL_SNAPSHOT' || msg.type === 'SNAPSHOT_UPDATE') {
              setState(msg.data);
            }
          } catch (e) {
            console.error('Error handling WebSocket message:', e);
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          setTimeout(connectWs, 3000);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch (e) {
        console.warn('WebSocket connection failed:', e);
      }
    };

    connectWs();
    const pollInterval = setInterval(fetchOverview, 5000);

    return () => {
      clearInterval(pollInterval);
      wsRef.current?.close();
    };
  }, []);

  const handleToggleKillSwitch = async (active: boolean) => {
    try {
      const res = await fetch(`${apiBase}/api/risk/kill-switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      });
      if (res.ok) {
        await fetchOverview();
      }
    } catch (e) {
      console.error('Failed to toggle kill switch:', e);
    }
  };

  const handleToggleAutomatedTrading = async (active: boolean) => {
    try {
      const res = await fetch(`${apiBase}/api/automated-trader/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      });
      if (res.ok) {
        await fetchOverview();
      }
    } catch (e) {
      console.error('Failed to toggle automated trader:', e);
    }
  };

  const handleSimulateCandle = async (symbol: string, direction?: string) => {
    try {
      const res = await fetch(`${apiBase}/api/simulate/candle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, direction }),
      });
      if (res.ok) {
        await fetchOverview();
      }
    } catch (e) {
      console.error('Failed to simulate candle:', e);
    }
  };

  const handleClosePosition = async (symbol: string) => {
    try {
      const res = await fetch(`${apiBase}/api/positions/${symbol}/close`, { method: 'POST' });
      if (res.ok) {
        await fetchOverview();
      }
    } catch (e) {
      console.error('Failed to close position:', e);
    }
  };

  const btcItem = state.market_watch.find((m) => m.symbol === 'BTC/USDT');
  const btcPositions = state.open_positions.filter((p) => p.symbol === 'BTC/USDT');

  return (
    <div className="min-h-screen bg-brand-bg text-gray-100 flex flex-col font-sans">
      <Header
        portfolio={state.portfolio}
        systemStatus={state.system_status}
        onToggleKillSwitch={handleToggleKillSwitch}
        onToggleAutomatedTrading={handleToggleAutomatedTrading}
        isConnected={isConnected}
      />

      <Navigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        openPositionsCount={state.open_positions.length}
        recentSignalsCount={state.recent_signals.length}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {activeTab === 'overview' && (
          <OverviewTab
            state={state}
            onSimulateCandle={handleSimulateCandle}
            onClosePosition={handleClosePosition}
            onViewDecisionChain={setSelectedSignal}
            onSelectBitcoinTab={() => setActiveTab('bitcoin')}
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

        {activeTab === 'options_scanner' && <OptionsScannerTab />}

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
            AI Trader • Demo Mode Active (Indian F&O + Bitcoin Spot Paper Trading) • Supabase Cloud DB
          </span>
          <div className="flex items-center space-x-3 text-[11px]">
            <span className="text-amber-400">● Not Connected to Live Broker</span>
            <span className="text-emerald-400">● 24/7 Automated Paper Execution</span>
            <span>● Zero Real Money Risk</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
