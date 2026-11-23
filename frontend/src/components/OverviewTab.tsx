import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  Brain,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Play,
  Coins
} from 'lucide-react';
import { DashboardState, SignalItem, OpenPosition } from '../types';

interface OverviewTabProps {
  state: DashboardState;
  onSimulateCandle: (symbol: string, direction?: string) => Promise<void>;
  onClosePosition: (symbol: string) => Promise<void>;
  onViewDecisionChain: (signal: SignalItem) => void;
  onSelectBitcoinTab: () => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  state,
  onSimulateCandle,
  onClosePosition,
  onViewDecisionChain,
  onSelectBitcoinTab
}) => {
  const [isSimulating, setIsSimulating] = useState(false);
  const { portfolio, market_watch, open_positions, recent_signals, system_status } = state;

  const handleSimulate = async (sym: string, dir?: string) => {
    setIsSimulating(true);
    try {
      await onSimulateCandle(sym, dir);
    } finally {
      setIsSimulating(false);
    }
  };

  const btcItem = market_watch.find(m => m.symbol === 'BTC/USDT');
  const indianItems = market_watch.filter(m => m.symbol !== 'BTC/USDT');

  return (
    <div className="space-y-6">
      {/* Automated Paper Trading Status Banner */}
      <div className="bg-brand-surface rounded-xl p-4 border border-brand-border shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${
            system_status?.automated_trading_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
          }`}>
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-white">Automated Paper Trading Engine:</span>
              <span className={`text-xs font-extrabold uppercase px-2 py-0.5 rounded ${
                system_status?.automated_trading_active
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                {system_status?.automated_trading_active ? 'RUNNING AUTONOMOUSLY' : 'PAUSED'}
              </span>
            </div>
            <p className="text-xs text-brand-muted mt-0.5">
              Continuously runs V12 Indicator $\to$ Independent AI Audit $\to$ Risk Engine $\to$ Paper Execution for all completed candles.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleSimulate('NIFTY', 'BULLISH')}
            disabled={isSimulating}
            className="px-2.5 py-1 text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/25 flex items-center space-x-1"
          >
            <Play className="w-3 h-3" />
            <span>Test Nifty Bull</span>
          </button>
          <button
            onClick={() => handleSimulate('BTC/USDT', 'BULLISH')}
            disabled={isSimulating}
            className="px-2.5 py-1 text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/25 flex items-center space-x-1"
          >
            <Play className="w-3 h-3" />
            <span>Test BTC Bull</span>
          </button>
        </div>
      </div>

      {/* Bitcoin Highlight Card */}
      {btcItem && (
        <div
          onClick={onSelectBitcoinTab}
          className="bg-gradient-to-r from-brand-surface via-brand-card to-amber-950/20 rounded-xl p-4 border border-amber-500/30 shadow-md cursor-pointer hover:border-amber-500/60 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-base font-extrabold text-white">Bitcoin Spot 24/7 (BTC/USDT)</span>
                <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30">
                  Continuous Crypto
                </span>
                <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                  DEMO DATA
                </span>
              </div>
              <p className="text-xs text-brand-muted mt-0.5">
                V12 Baseline: <strong>${btcItem.baseline.toFixed(2)}</strong> • ATR: <strong>${btcItem.atr.toFixed(2)}</strong> • RSI: <strong>{btcItem.rsi.toFixed(1)}</strong> • Conf: <strong>{btcItem.confidence}%</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-2xl font-black text-white font-mono">${btcItem.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              <div className={`text-xs font-bold ${btcItem.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {btcItem.change >= 0 ? '+' : ''}{btcItem.change_pct.toFixed(2)}%
              </div>
            </div>
            <div className="text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/30">
              Open Bitcoin Panel →
            </div>
          </div>
        </div>
      )}

      {/* Indian Benchmark Indices Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <span>Indian F&O Benchmark Instruments (Demo Feed)</span>
          </h2>
          <span className="text-xs text-brand-muted">NSE / BSE • 5m Real-time Candlestick Feed</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {indianItems.map((item) => {
            const isBull = item.trend === 1;
            return (
              <div
                key={item.symbol}
                className="bg-brand-surface rounded-xl p-4 border border-brand-border shadow-md hover:border-brand-border/80 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-white">{item.display_name}</span>
                    <span className="text-[10px] text-brand-muted font-mono bg-brand-card px-1.5 py-0.5 rounded border border-brand-border">
                      {item.symbol}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    isBull ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}>
                    {isBull ? 'BULL' : 'BEAR'} ({item.confidence}%)
                  </span>
                </div>

                <div className="flex items-baseline space-x-2 mb-3">
                  <span className="text-xl font-black text-white">₹{item.price.toFixed(2)}</span>
                  <span className={`text-xs font-semibold ${item.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {item.change >= 0 ? '+' : ''}{item.change.toFixed(1)} pts
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
                  <div className="bg-brand-card/70 p-1.5 rounded border border-brand-border">
                    <span className="text-[9px] text-brand-muted uppercase block">Baseline</span>
                    <strong className="text-white mt-0.5 block">₹{item.baseline.toFixed(0)}</strong>
                  </div>
                  <div className="bg-brand-card/70 p-1.5 rounded border border-brand-border">
                    <span className="text-[9px] text-brand-muted uppercase block">ATR(10)</span>
                    <strong className="text-blue-400 mt-0.5 block">{item.atr.toFixed(1)}</strong>
                  </div>
                  <div className="bg-brand-card/70 p-1.5 rounded border border-brand-border">
                    <span className="text-[9px] text-brand-muted uppercase block">RSI(14)</span>
                    <strong className="text-purple-400 mt-0.5 block">{item.rsi.toFixed(1)}</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Simulated Positions */}
      {open_positions.length > 0 && (
        <div className="bg-brand-surface rounded-xl p-4 border border-blue-500/30 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">Active Virtual Paper Positions</h3>
            </div>
            <span className="text-xs text-brand-muted font-medium">
              {open_positions.length} / {system_status?.max_open_positions || 2} Concurrent Positions
            </span>
          </div>

          <div className="space-y-2">
            {open_positions.map((pos) => {
              const isProfit = pos.unrealized_pnl >= 0;
              return (
                <div key={pos.position_id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-brand-card/70 p-3 rounded-lg border border-brand-border">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold text-white">{pos.symbol}</span>
                      <span className="text-[10px] uppercase font-bold bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                        {pos.side}
                      </span>
                      <span className="text-xs text-brand-muted">{pos.quantity} Qty</span>
                    </div>
                    <div className="flex items-center space-x-3 text-xs text-brand-muted mt-1.5">
                      <span>Entry: <strong className="text-white">{pos.entry_price.toFixed(2)}</strong></span>
                      <span>LTP: <strong className="text-white">{pos.current_price.toFixed(2)}</strong></span>
                      <span>SL: <strong className="text-red-400">{pos.stop_loss.toFixed(2)}</strong></span>
                      <span>TP: <strong className="text-emerald-400">{pos.take_profit.toFixed(2)}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <span className="text-[9px] uppercase text-brand-muted font-bold block">Unrealized MTM</span>
                      <span className={`text-lg font-black ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isProfit ? '+' : ''}₹{pos.unrealized_pnl.toFixed(2)}
                      </span>
                    </div>
                    <button
                      onClick={() => onClosePosition(pos.symbol)}
                      className="px-3 py-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/40 rounded-lg text-xs font-bold transition-all"
                    >
                      Close
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Signals & Decision Chain Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center space-x-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Latest Automated Strategy Signals & Audits</span>
          </h2>
          <span className="text-xs text-brand-muted">Continuous 4-Stage Decision Chain</span>
        </div>

        {recent_signals.length === 0 ? (
          <div className="bg-brand-surface rounded-xl p-8 border border-brand-border text-center text-brand-muted text-xs">
            Automated monitoring in progress. Signals will appear here automatically on candle closes.
          </div>
        ) : (
          <div className="bg-brand-surface rounded-xl border border-brand-border overflow-hidden shadow-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-brand-card/80 text-brand-muted uppercase text-[10px] tracking-wider border-b border-brand-border">
                  <tr>
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3">Symbol</th>
                    <th className="py-2.5 px-3">Stage 1: V12</th>
                    <th className="py-2.5 px-3">Stage 2: AI Verifier</th>
                    <th className="py-2.5 px-3">Stage 3: Risk</th>
                    <th className="py-2.5 px-3">Stage 4: Execution</th>
                    <th className="py-2.5 px-3 text-right">Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border text-gray-200">
                  {recent_signals.slice(0, 8).map((sig) => {
                    const isBuy = sig.stage1_signal === 'BUY';
                    const aiApproved = sig.ai_decision === 'APPROVED';
                    const aiWaiting = sig.ai_decision === 'WAITING';
                    const riskPassed = sig.risk_status === 'APPROVED';

                    return (
                      <tr key={sig.id} className="hover:bg-brand-card/40 transition-colors">
                        <td className="py-3 px-3 text-brand-muted whitespace-nowrap">
                          {sig.timestamp.split('T')[1]?.substring(0, 8) || sig.timestamp}
                        </td>
                        <td className="py-3 px-3 font-bold text-white whitespace-nowrap">
                          {sig.symbol}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded font-bold text-xs ${
                            isBuy ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}>
                            {sig.stage1_signal} ({sig.stage1_confidence}%)
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center space-x-1.5 whitespace-nowrap">
                            {aiApproved && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                            {aiWaiting && <Clock className="w-3.5 h-3.5 text-amber-400" />}
                            {!aiApproved && !aiWaiting && <XCircle className="w-3.5 h-3.5 text-red-400" />}
                            <span className={`font-semibold ${
                              aiApproved ? 'text-emerald-400' : aiWaiting ? 'text-amber-400' : 'text-red-400'
                            }`}>
                              {sig.ai_decision} ({sig.ai_score?.toFixed(0)}/100)
                            </span>
                          </div>
                          <div className="text-[10px] text-brand-muted truncate max-w-xs mt-0.5">
                            {sig.ai_reason}
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            riskPassed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                          }`}>
                            {sig.risk_status}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {sig.executed ? (
                            <span className="text-emerald-400 font-bold flex items-center space-x-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Filled @ {sig.fill_price?.toFixed(2)}</span>
                            </span>
                          ) : (
                            <span className="text-brand-muted">Not Executed</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => onViewDecisionChain(sig)}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-brand-card hover:bg-blue-600/20 text-blue-400 border border-brand-border rounded transition-all"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
