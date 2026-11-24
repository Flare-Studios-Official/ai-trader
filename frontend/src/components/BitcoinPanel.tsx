import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  ShieldCheck,
  Zap,
  Brain,
  Layers,
  Coins,
  AlertCircle,
  Play,
  CheckCircle2
} from 'lucide-react';
import { MarketWatchItem, OpenPosition } from '../types';
import { TradingViewChart } from './TradingViewChart';

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
  const [isSimulating, setIsSimulating] = useState(false);
  const isBull = btcItem ? btcItem.trend === 1 : true;

  const handleSimulate = async (dir: string) => {
    setIsSimulating(true);
    try {
      await onSimulateCandle('BTC/USDT', dir);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* BITCOIN LIVE SPOT HERO CARD */}
      <div className="bg-gradient-to-br from-brand-surface via-brand-card to-amber-950/20 rounded-xl p-5 border border-amber-500/30 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/40 shadow-inner">
              <Coins className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap">
                <h2 className="text-xl font-extrabold text-white">Bitcoin Spot 24/7</h2>
                <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                  BTC/USDT
                </span>
                <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Coinbase Live Feed</span>
                </span>
                <span className="text-[10px] uppercase font-bold text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded border border-blue-500/30">
                  Virtual Spot Paper Only
                </span>
              </div>
              <p className="text-xs text-brand-muted mt-1">
                Real-time public cryptocurrency ticker &bull; Pure spot simulation &bull; Zero Indian session restrictions &bull; 24/7 continuous trading
              </p>
            </div>
          </div>

          <div className="flex items-baseline space-x-3">
            <span className="text-3xl font-black text-white font-mono">
              ${btcItem ? btcItem.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '60,235.00'}
            </span>
            <span className={`text-sm font-bold flex items-center ${
              (btcItem?.change ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {(btcItem?.change ?? 0) >= 0 ? <TrendingUp className="w-4 h-4 mr-0.5" /> : <TrendingDown className="w-4 h-4 mr-0.5" />}
              {btcItem?.change_pct.toFixed(2)}% (${btcItem ? (btcItem.change >= 0 ? '+' : '') + btcItem.change.toFixed(2) : '-1,250.00'})
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
              <span className="text-[10px] text-brand-muted uppercase font-bold block">AI Confidence</span>
              <span className="text-sm font-bold text-amber-400 font-mono mt-0.5 block">
                {btcItem.confidence}%
              </span>
              <span className="text-[10px] text-emerald-400 font-bold">● High Quality Setup</span>
            </div>
          </div>
        )}

        {/* Embedded Live TradingView Chart */}
        <div className="mt-5">
          <TradingViewChart
            symbol="BTC/USDT"
            currentPrice={btcItem?.price || 60350}
            changePct={btcItem?.change_pct || -2.03}
            height={440}
            showControls={true}
          />
        </div>

        {/* Interactive Simulation Controls */}
        <div className="mt-5 pt-4 border-t border-brand-border/60 flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs text-brand-muted">
            Test AI Pipeline for Bitcoin Spot:
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleSimulate('BULLISH')}
              disabled={isSimulating}
              className="px-3.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all shadow-sm"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Simulate BTC Buy Signal</span>
            </button>
            <button
              onClick={() => handleSimulate('BEARISH')}
              disabled={isSimulating}
              className="px-3.5 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all shadow-sm"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Simulate BTC Sell Signal</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Bitcoin Paper Positions */}
      <div className="bg-brand-surface rounded-xl p-5 border border-brand-border shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center space-x-2">
            <Coins className="w-4 h-4 text-amber-400" />
            <span>Active Bitcoin Simulated Positions</span>
          </h3>
          <span className="text-xs text-brand-muted">
            {btcPositions.length} Open Positions
          </span>
        </div>

        {btcPositions.length === 0 ? (
          <div className="p-8 text-center text-xs text-brand-muted border border-dashed border-brand-border rounded-lg">
            No active Bitcoin paper positions. The AI is continuously scanning live Coinbase 5m candles.
          </div>
        ) : (
          <div className="space-y-3">
            {btcPositions.map((pos) => {
              const isProfit = pos.unrealized_pnl >= 0;
              return (
                <div
                  key={pos.position_id}
                  className="bg-brand-card/80 p-4 rounded-xl border border-brand-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-base font-bold text-white">{pos.symbol}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                        pos.side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {pos.side}
                      </span>
                      <span className="text-xs text-brand-muted">{pos.quantity} BTC</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 text-xs">
                      <div>
                        <span className="text-[10px] text-brand-muted uppercase block">Entry Price</span>
                        <strong className="text-white">${pos.entry_price.toFixed(2)}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-brand-muted uppercase block">Current Price</span>
                        <strong className="text-white">${pos.current_price.toFixed(2)}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-brand-muted uppercase block">Stop-Loss</span>
                        <strong className="text-red-400">${pos.stop_loss.toFixed(2)}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-brand-muted uppercase block">Take-Profit</span>
                        <strong className="text-emerald-400">${pos.take_profit.toFixed(2)}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <span className="text-[9px] uppercase text-brand-muted font-bold block">Unrealized P&amp;L</span>
                      <span className={`text-xl font-black ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isProfit ? '+' : ''}${pos.unrealized_pnl.toFixed(2)}
                      </span>
                    </div>
                    <button
                      onClick={() => onClosePosition(pos.symbol)}
                      className="px-3.5 py-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/40 rounded-lg text-xs font-bold transition-all"
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
    </div>
  );
};
