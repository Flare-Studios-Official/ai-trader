import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  Play,
  Coins,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Layers,
  Sparkles,
  LineChart
} from 'lucide-react';
import { DashboardState, SignalItem } from '../types';
import { TradingViewChart } from './TradingViewChart';

interface OverviewTabProps {
  state: DashboardState;
  onSimulateCandle: (symbol: string, direction?: string) => Promise<void>;
  onClosePosition: (symbol: string) => Promise<void>;
  onViewDecisionChain: (signal: SignalItem) => void;
  onSelectBitcoinTab: () => void;
  onSelectOptionsTab?: () => void;
  onSelectInstrument?: (instrument: string) => void;
  onToggleAutomatedTrading?: (active: boolean) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  state,
  onSimulateCandle,
  onClosePosition,
  onViewDecisionChain,
  onSelectBitcoinTab,
  onSelectOptionsTab,
  onSelectInstrument,
  onToggleAutomatedTrading
}) => {
  const [isSimulating, setIsSimulating] = useState(false);
  const { portfolio, market_watch, open_positions, recent_signals, system_status } = state;

  const isAutoTradeOn = system_status?.automated_trading_active;
  const selectedInstrument = system_status?.selected_instrument || 'NIFTY';

  const [activeChartSymbol, setActiveChartSymbol] = useState<string>(
    selectedInstrument === 'ALL' || selectedInstrument === 'BITCOIN' ? 'BTC/USDT' : selectedInstrument
  );
  const activeChartItem = market_watch.find((m) => m.symbol.toUpperCase() === activeChartSymbol.toUpperCase()) || market_watch[0];

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
      {/* AUTONOMOUS PAPER TRADING STATUS BANNER */}
      <div className={`rounded-xl p-4 border shadow-lg transition-all ${
        isAutoTradeOn
          ? 'bg-emerald-950/20 border-emerald-500/40'
          : 'bg-brand-surface border-brand-border'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center space-x-3">
            <div className={`p-2.5 rounded-xl border ${
              isAutoTradeOn
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : 'bg-gray-800 text-gray-400 border-gray-700'
            }`}>
              <Activity className={`w-5 h-5 ${isAutoTradeOn ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap">
                <span className="text-sm font-extrabold text-white">AI Autonomous Paper Engine:</span>
                <span className={`text-xs font-black uppercase px-2.5 py-0.5 rounded border ${
                  isAutoTradeOn
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 ring-1 ring-emerald-400/40'
                    : 'bg-gray-800 text-gray-300 border-gray-600'
                }`}>
                  {isAutoTradeOn ? `AUTO TRADE ON (Target: ${selectedInstrument})` : 'AUTO TRADE OFF (DEFAULT)'}
                </span>
              </div>
              <p className="text-xs text-brand-muted mt-1">
                {isAutoTradeOn ? (
                  <span>
                    Currently scanning live market data &amp; executing autonomous paper options/spot trades strictly for{' '}
                    <strong className="text-emerald-400">{selectedInstrument}</strong>.
                  </span>
                ) : (
                  <span>
                    Automated trading is currently <strong className="text-amber-400">OFF</strong> by default. Click "AUTO TRADE: OFF" in the top bar to enable and select an asset.
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Quick Interactive Actions */}
          <div className="flex items-center space-x-2 flex-wrap">
            <button
              onClick={() => handleSimulate(selectedInstrument, 'BULLISH')}
              disabled={isSimulating}
              className="px-3 py-1.5 text-xs font-bold bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/40 rounded-lg flex items-center space-x-1.5 transition-all shadow-sm"
              title={`Simulate a virtual bullish trade on ${selectedInstrument}`}
            >
              <Play className="w-3 h-3" />
              <span>Test {selectedInstrument} Buy</span>
            </button>
            <button
              onClick={() => handleSimulate(selectedInstrument, 'BEARISH')}
              disabled={isSimulating}
              className="px-3 py-1.5 text-xs font-bold bg-red-600/20 text-red-300 hover:bg-red-600/30 border border-red-500/40 rounded-lg flex items-center space-x-1.5 transition-all shadow-sm"
              title={`Simulate a virtual bearish trade on ${selectedInstrument}`}
            >
              <Play className="w-3 h-3" />
              <span>Test {selectedInstrument} Sell</span>
            </button>
          </div>
        </div>
      </div>

      {/* BITCOIN LIVE SPOT HERO CARD */}
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
                  ● Real-Time Feed
                </span>
                <span className="text-[10px] uppercase font-bold text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded border border-blue-500/30">
                  Coinbase Spot
                </span>
              </div>
              <p className="text-xs text-brand-muted mt-0.5">
                V12 Baseline: <strong>${btcItem.baseline.toFixed(2)}</strong> • ATR: <strong>${btcItem.atr.toFixed(2)}</strong> • RSI: <strong>{btcItem.rsi.toFixed(1)}</strong> • AI Confidence: <strong>{btcItem.confidence}%</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-2xl font-black text-white font-mono">${btcItem.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className={`text-xs font-bold ${btcItem.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {btcItem.change >= 0 ? '+' : ''}{btcItem.change_pct.toFixed(2)}% (${btcItem.change >= 0 ? '+' : ''}{btcItem.change.toFixed(2)})
              </div>
            </div>
            <div className="text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/30 flex items-center space-x-1">
              <span>Trade Bitcoin</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      )}

      {/* INDIAN BENCHMARK INDICES GRID (ANGEL ONE SMARTAPI FEED) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <span>Indian F&amp;O Benchmark Instruments (Angel One SmartAPI)</span>
          </h2>
          <span className="text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/30">
            ● Authorized Live Quote Feed
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {indianItems.map((item) => {
            const isBull = item.trend === 1;
            const isTarget = selectedInstrument === item.symbol;
            return (
              <div
                key={item.symbol}
                className={`bg-brand-surface rounded-xl p-4 border transition-all shadow-md ${
                  isTarget ? 'border-blue-500/70 ring-1 ring-blue-500/30' : 'border-brand-border hover:border-brand-border/80'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-white">{item.display_name}</span>
                    <span className="text-[10px] text-brand-muted font-mono bg-brand-card px-1.5 py-0.5 rounded border border-brand-border">
                      {item.symbol}
                    </span>
                    {isTarget && (
                      <span className="text-[9px] bg-blue-500 text-white font-bold px-1.5 py-0.2 rounded">
                        AI Target
                      </span>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    isBull ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}>
                    {isBull ? 'BULLISH' : 'BEARISH'} ({item.confidence}%)
                  </span>
                </div>

                <div className="flex items-baseline space-x-2 mb-3">
                  <span className="text-xl font-black text-white">₹{item.price.toFixed(2)}</span>
                  <span className={`text-xs font-semibold ${item.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {item.change >= 0 ? '+' : ''}{item.change.toFixed(1)} ({item.change_pct >= 0 ? '+' : ''}{item.change_pct.toFixed(2)}%)
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-center text-[11px] mb-3">
                  <div className="bg-brand-card/70 p-1.5 rounded border border-brand-border">
                    <span className="text-[9px] text-brand-muted uppercase block">Baseline</span>
                    <strong className="text-white mt-0.5 block">₹{item.baseline.toFixed(0)}</strong>
                  </div>
                  <div className="bg-brand-card/70 p-1.5 rounded border border-brand-border">
                    <span className="text-[9px] text-brand-muted uppercase block">Safe ATR</span>
                    <strong className="text-blue-400 mt-0.5 block">{item.atr.toFixed(1)}</strong>
                  </div>
                  <div className="bg-brand-card/70 p-1.5 rounded border border-brand-border">
                    <span className="text-[9px] text-brand-muted uppercase block">RSI(14)</span>
                    <strong className="text-purple-400 mt-0.5 block">{item.rsi.toFixed(1)}</strong>
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-2 border-t border-brand-border/60">
                  <button
                    onClick={() => onSelectInstrument && onSelectInstrument(item.symbol)}
                    className={`flex-1 py-1 rounded text-[11px] font-bold transition-all ${
                      isTarget
                        ? 'bg-blue-600 text-white'
                        : 'bg-brand-card hover:bg-brand-card/80 text-gray-300 border border-brand-border'
                    }`}
                  >
                    {isTarget ? '✓ Selected Target' : 'Set as AI Target'}
                  </button>
                  {onSelectOptionsTab && (
                    <button
                      onClick={onSelectOptionsTab}
                      className="px-2 py-1 bg-brand-surface hover:bg-brand-card text-blue-400 border border-brand-border rounded text-[11px] font-semibold flex items-center space-x-1"
                      title="View Option Chain"
                    >
                      <Layers className="w-3 h-3" />
                      <span>Options</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* TRADINGVIEW LIVE INTERACTIVE CHART (1-SEC REFRESH) */}
      <div className="bg-brand-surface/60 rounded-xl p-4 border border-brand-border shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <LineChart className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              TradingView Lightweight Chart (Real-Time 1-Second Stream)
            </h2>
          </div>
          <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/30 flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Live Tick Updates Active</span>
          </span>
        </div>
        <TradingViewChart
          symbol={activeChartSymbol}
          currentPrice={activeChartItem?.price || 25350}
          changePct={activeChartItem?.change_pct || 0}
          height={400}
          onSelectSymbol={setActiveChartSymbol}
          showControls={true}
        />
      </div>

      {/* ACTIVE SIMULATED PAPER POSITIONS */}
      {open_positions.length > 0 && (
        <div className="bg-brand-surface rounded-xl p-4 border border-blue-500/30 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">Active Simulated Paper Positions</h3>
            </div>
            <span className="text-xs text-brand-muted font-medium">
              {open_positions.length} Active Positions • Strict Risk Engine Active
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
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                        pos.side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {pos.side}
                      </span>
                      <span className="text-xs text-brand-muted">{pos.quantity} Qty</span>
                      <span className="text-[10px] text-brand-muted font-mono bg-brand-surface px-1.5 py-0.2 rounded border border-brand-border">
                        Virtual Execution
                      </span>
                    </div>
                    <div className="flex items-center space-x-3 text-xs text-brand-muted mt-1.5">
                      <span>Entry: <strong className="text-white">₹{pos.entry_price.toFixed(2)}</strong></span>
                      <span>LTP: <strong className="text-white">₹{pos.current_price.toFixed(2)}</strong></span>
                      <span>SL: <strong className="text-red-400">₹{pos.stop_loss.toFixed(2)}</strong></span>
                      <span>TP: <strong className="text-emerald-400">₹{pos.take_profit.toFixed(2)}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <span className="text-[9px] uppercase text-brand-muted font-bold block">Simulated MTM</span>
                      <span className={`text-lg font-black ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isProfit ? '+' : ''}₹{pos.unrealized_pnl.toFixed(2)}
                      </span>
                    </div>
                    <button
                      onClick={() => onClosePosition(pos.symbol)}
                      className="px-3.5 py-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/40 rounded-lg text-xs font-bold transition-all"
                    >
                      Close Position
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* RECENT STRATEGY SIGNALS & AUDIT TRAIL */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center space-x-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Latest Automated Strategy Signals &amp; Audits</span>
          </h2>
          <span className="text-xs text-brand-muted">V12 Pine Script Replica &bull; 4-Stage Verification</span>
        </div>

        {recent_signals.length === 0 ? (
          <div className="bg-brand-surface rounded-xl p-8 border border-brand-border text-center text-brand-muted text-xs">
            Scanning live feed. Signals will appear here automatically on candle closes or when you click "Test Buy / Sell".
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
                              <span>Virtual Order Filled @ {sig.fill_price?.toFixed(2)}</span>
                            </span>
                          ) : (
                            <span className="text-brand-muted">Capital Protected (No Trade)</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => onViewDecisionChain(sig)}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-brand-card hover:bg-blue-600/20 text-blue-400 border border-brand-border rounded transition-all"
                          >
                            Inspect Audit
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
