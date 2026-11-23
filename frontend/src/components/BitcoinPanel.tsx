import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  ShieldCheck,
  Zap,
  Brain,
  Layers,
  Coins,
  AlertCircle
} from 'lucide-react';
import { DashboardState, MarketWatchItem, OpenPosition } from '../types';

interface BitcoinPanelProps {
  btcItem?: MarketWatchItem;
  btcPositions: OpenPosition[];
  onClosePosition: (symbol: string) => Promise<void>;
  onSimulateCandle: (symbol: string, direction?: string) => Promise<void>;
}

export const BitcoinPanel: React.FC<BitcoinPanelProps> = ({
  btcItem,
  btcPositions,
  onClosePosition,
  onSimulateCandle
}) => {
  const isBull = btcItem?.trend === 1;

  return (
    <div className="space-y-6">
      {/* Bitcoin Hero Card */}
      <div className="bg-gradient-to-br from-brand-surface via-brand-card to-amber-950/20 rounded-xl p-5 border border-amber-500/30 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/40 shadow-inner">
              <Coins className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-extrabold text-white">Bitcoin Spot</h2>
                <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                  BTC/USDT
                </span>
                <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>24/7 Continuous Market</span>
                </span>
              </div>
              <p className="text-xs text-brand-muted mt-1">
                Demo Market Feed (Public Internet Reference & High-Fidelity Synthetic Model) • Zero Indian Session Restrictions
              </p>
            </div>
          </div>

          <div className="flex items-baseline space-x-3">
            <span className="text-3xl font-black text-white font-mono">
              ${btcItem ? btcItem.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '68,450.00'}
            </span>
            <span className={`text-sm font-bold flex items-center ${
              (btcItem?.change ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {(btcItem?.change ?? 0) >= 0 ? <TrendingUp className="w-4 h-4 mr-0.5" /> : <TrendingDown className="w-4 h-4 mr-0.5" />}
              {btcItem?.change_pct.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* 4 Pillars for Bitcoin */}
        {btcItem && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            <div className="bg-brand-surface/90 p-3 rounded-lg border border-brand-border">
              <span className="text-[10px] text-brand-muted uppercase font-bold block">V12 Baseline</span>
              <span className="text-sm font-bold text-white font-mono mt-0.5 block">
                ${btcItem.baseline.toFixed(2)}
              </span>
              <span className={`text-[10px] font-bold ${isBull ? 'text-emerald-400' : 'text-red-400'}`}>
                {isBull ? '● Bullish Baseline' : '● Bearish Baseline'}
              </span>
            </div>

            <div className="bg-brand-surface/90 p-3 rounded-lg border border-brand-border">
              <span className="text-[10px] text-brand-muted uppercase font-bold block">Safe ATR (10)</span>
              <span className="text-sm font-bold text-blue-400 font-mono mt-0.5 block">
                ${btcItem.atr.toFixed(2)}
              </span>
              <span className="text-[10px] text-brand-muted">Volatility Range</span>
            </div>

            <div className="bg-brand-surface/90 p-3 rounded-lg border border-brand-border">
              <span className="text-[10px] text-brand-muted uppercase font-bold block">RSI Momentum (14)</span>
              <span className="text-sm font-bold text-purple-400 font-mono mt-0.5 block">
                {btcItem.rsi.toFixed(1)}
              </span>
              <span className="text-[10px] text-brand-muted">Wilder's RMA</span>
            </div>

            <div className="bg-brand-surface/90 p-3 rounded-lg border border-brand-border">
              <span className="text-[10px] text-brand-muted uppercase font-bold block">V12 Confidence</span>
              <span className="text-sm font-bold text-amber-400 font-mono mt-0.5 block">
                {btcItem.confidence}%
              </span>
              <span className="text-[10px] text-brand-muted">4-Pillar Composite</span>
            </div>
          </div>
        )}
      </div>

      {/* Bitcoin Asset Specifics & Disclaimer Banner */}
      <div className="bg-brand-surface rounded-xl p-4 border border-brand-border shadow-md">
        <div className="flex items-start space-x-3 text-xs">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-gray-300">
            <span className="font-bold text-amber-300 block">Bitcoin Market & Trading Model Notes:</span>
            <ul className="list-disc list-inside space-y-1 text-brand-muted text-[11px]">
              <li><strong>Instrument Type:</strong> BTC/USDT Spot Paper Trading (Derivative options/futures are not supported on BTC demo feed).</li>
              <li><strong>24/7 Continuous Execution:</strong> Automated strategy evaluation continues uninterrupted during weekends and nights.</li>
              <li><strong>Fee Structure:</strong> 0.1% spot exchange taker fee applied (Indian STT, exchange turnover taxes, and SEBI fees do not apply to Bitcoin).</li>
              <li><strong>Risk Management:</strong> Fixed 1% virtual equity risk limit (max loss capped at ₹1,000 / ~$12 per trade) with strict anti-revenge sizing.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Active Bitcoin Positions */}
      {btcPositions.length > 0 && (
        <div className="bg-brand-surface rounded-xl p-4 border border-blue-500/30 shadow-md">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">Active Bitcoin Position</h3>
          {btcPositions.map((pos) => {
            const isProfit = pos.unrealized_pnl >= 0;
            return (
              <div key={pos.position_id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-brand-card/70 p-4 rounded-lg border border-brand-border">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-white">{pos.symbol}</span>
                    <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-blue-500/20 text-blue-400">
                      {pos.side}
                    </span>
                    <span className="text-xs text-brand-muted font-mono">{pos.quantity} BTC</span>
                  </div>
                  <div className="flex items-center space-x-3 text-xs text-brand-muted mt-2">
                    <span>Entry: <strong className="text-white">${pos.entry_price.toFixed(2)}</strong></span>
                    <span>LTP: <strong className="text-white">${pos.current_price.toFixed(2)}</strong></span>
                    <span>SL: <strong className="text-red-400">${pos.stop_loss.toFixed(2)}</strong></span>
                    <span>TP: <strong className="text-emerald-400">${pos.take_profit.toFixed(2)}</strong></span>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <span className="text-[10px] text-brand-muted uppercase block font-semibold">Unrealized P&L</span>
                    <span className={`text-xl font-black ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
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
      )}
    </div>
  );
};
