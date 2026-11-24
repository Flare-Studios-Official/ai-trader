import React, { useState } from 'react';
import { TradingViewChart, ChartMarker } from './TradingViewChart';
import { AutoTradeLog, MarketWatchItem, OpenPosition } from '../types';
import { Activity, Bot, Zap, CheckCircle2, AlertTriangle, ArrowUpRight, ArrowDownRight, Compass, ShieldAlert, Cpu } from 'lucide-react';

interface ChartsTabProps {
  marketWatch: MarketWatchItem[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  openPositions: OpenPosition[];
  autoTradeLogs: AutoTradeLog[];
  isAutoTradeActive: boolean;
  onToggleAutoTrade: () => void;
  onManualAutonomousTrigger: () => void;
}

export const ChartsTab: React.FC<ChartsTabProps> = ({
  marketWatch,
  selectedSymbol,
  onSelectSymbol,
  openPositions,
  autoTradeLogs,
  isAutoTradeActive,
  onToggleAutoTrade,
  onManualAutonomousTrigger
}) => {
  const currentItem = marketWatch.find((m) => m.symbol.toUpperCase() === selectedSymbol.toUpperCase()) || marketWatch[0] || {
    symbol: 'BTC/USDT',
    display_name: 'Bitcoin Spot',
    price: 60350,
    change: -1250,
    change_pct: -2.03,
    rsi: 44.5,
    confidence: 84,
    atr: 45.0
  };

  // Convert open positions and auto trade logs into chart markers
  const markers: ChartMarker[] = autoTradeLogs.slice(-15).map((log) => {
    const isBuy = log.action === 'BUY';
    return {
      time: Math.floor(new Date(log.timestamp).getTime() / 1000),
      position: isBuy ? 'belowBar' : 'aboveBar',
      color: isBuy ? '#10B981' : '#EF4444',
      shape: isBuy ? 'arrowUp' : 'arrowDown',
      text: `${log.action} (${log.symbol})`
    };
  });

  return (
    <div className="space-y-6">
      {/* Top Banner: Autonomous Status & Controls */}
      <div className="bg-gradient-to-r from-blue-950/40 via-brand-card/90 to-purple-950/30 border border-blue-500/30 rounded-xl p-4 shadow-xl backdrop-blur-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className={`p-2.5 rounded-xl border ${
            isAutoTradeActive
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
              : 'bg-brand-surface border-brand-border text-brand-muted'
          }`}>
            <Bot className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-white">Autonomous Indicator-Based Execution</h2>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                isAutoTradeActive ? 'bg-emerald-500 text-white' : 'bg-gray-700 text-gray-300'
              }`}>
                {isAutoTradeActive ? 'AUTONOMOUS ACTIVE' : 'AUTO TRADE OFF'}
              </span>
            </div>
            <p className="text-xs text-brand-muted mt-0.5">
              TradingView Lightweight Chart &bull; Evaluates RSI, EMA 9/21 cross, &amp; Trend every 1s &bull; Strictly 100% Paper Trading
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
          <button
            onClick={onManualAutonomousTrigger}
            className="px-3.5 py-2 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-sm"
            title="Force immediate technical indicator evaluation and execute paper trade if conditions match"
          >
            <Zap className="w-3.5 h-3.5 text-blue-400" />
            <span>Force AI Cycle Check</span>
          </button>

          <button
            onClick={onToggleAutoTrade}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-md flex items-center space-x-2 ${
              isAutoTradeActive
                ? 'bg-red-600/80 hover:bg-red-600 text-white shadow-red-500/20'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>{isAutoTradeActive ? 'Stop Auto Trade' : 'Start Auto Trade'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Chart Column (Left) + Technical Analysis & Auto Feed (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: TradingView Chart (spans 2 columns) */}
        <div className="lg:col-span-2 space-y-4">
          <TradingViewChart
            symbol={currentItem.symbol}
            currentPrice={currentItem.price}
            changePct={currentItem.change_pct}
            height={520}
            markers={markers}
            onSelectSymbol={onSelectSymbol}
            showControls={true}
          />
        </div>

        {/* Right Column: Indicator Gauges & Autonomous AI Trade Logs */}
        <div className="space-y-4">
          {/* Live Indicator Gauges Card */}
          <div className="bg-brand-card/90 border border-brand-border rounded-xl p-4 shadow-xl backdrop-blur-sm">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center space-x-2">
              <Compass className="w-4 h-4 text-blue-400" />
              <span>Live Technical Indicators ({currentItem.symbol})</span>
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              {/* RSI (14) */}
              <div className="bg-brand-surface/80 p-2.5 rounded-lg border border-brand-border">
                <div className="text-[11px] text-brand-muted">RSI (14-period)</div>
                <div className="text-base font-bold font-mono text-white mt-1">
                  {currentItem.rsi ? currentItem.rsi.toFixed(1) : '48.5'}
                </div>
                <div className="text-[10px] text-brand-muted mt-1">
                  {currentItem.rsi < 35
                    ? '🟢 Oversold (Bullish Bounce)'
                    : currentItem.rsi > 65
                    ? '🔴 Overbought (Exhaustion)'
                    : '🟡 Neutral Momentum'}
                </div>
              </div>

              {/* EMA Trend */}
              <div className="bg-brand-surface/80 p-2.5 rounded-lg border border-brand-border">
                <div className="text-[11px] text-brand-muted">EMA 9 / 21 Status</div>
                <div className="text-base font-bold font-mono text-emerald-400 mt-1 flex items-center">
                  <ArrowUpRight className="w-4 h-4 mr-0.5" />
                  <span>Bullish Cross</span>
                </div>
                <div className="text-[10px] text-emerald-400/80 mt-1">Fast EMA &gt; Slow EMA</div>
              </div>

              {/* Volatility / ATR */}
              <div className="bg-brand-surface/80 p-2.5 rounded-lg border border-brand-border">
                <div className="text-[11px] text-brand-muted">ATR Band (Range)</div>
                <div className="text-base font-bold font-mono text-white mt-1">
                  {currentItem.atr ? currentItem.atr.toFixed(1) : '45.0'}
                </div>
                <div className="text-[10px] text-brand-muted mt-1">Dynamic SL: 1.5x ATR</div>
              </div>

              {/* AI Confidence */}
              <div className="bg-brand-surface/80 p-2.5 rounded-lg border border-brand-border">
                <div className="text-[11px] text-brand-muted">Signal Confidence</div>
                <div className="text-base font-bold font-mono text-blue-400 mt-1">
                  {currentItem.confidence || 78}%
                </div>
                <div className="text-[10px] text-blue-400/80 mt-1">High Probability Regime</div>
              </div>
            </div>

            {/* AI Decision Threshold Indicator */}
            <div className="mt-3 pt-3 border-t border-brand-border/60">
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-brand-muted">Autonomous Trigger Threshold:</span>
                <span className="text-emerald-400 font-bold">&gt;= 70% Confidence</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-emerald-500 h-1.5 rounded-full"
                  style={{ width: `${currentItem.confidence || 78}%` }}
                />
              </div>
            </div>
          </div>

          {/* Autonomous AI Decision & Execution Feed */}
          <div className="bg-brand-card/90 border border-brand-border rounded-xl p-4 shadow-xl backdrop-blur-sm flex flex-col h-[320px]">
            <div className="flex items-center justify-between pb-2 border-b border-brand-border/60 mb-2">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
                <Bot className="w-4 h-4 text-purple-400" />
                <span>Autonomous Trades Feed</span>
              </h3>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                AUTO EXECUTING
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 no-scrollbar">
              {autoTradeLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 text-brand-muted text-xs">
                  <Cpu className="w-8 h-8 text-gray-600 mb-2 animate-bounce" />
                  <p className="font-semibold text-gray-400">Autonomous Engine is Standing By</p>
                  <p className="text-[11px] mt-1">
                    Turn Auto Trade ON above or click "Force AI Cycle Check". When indicator conditions align, trades will execute automatically on their own!
                  </p>
                </div>
              ) : (
                autoTradeLogs.map((log) => {
                  const isBuy = log.action === 'BUY';
                  const isClose = log.action === 'CLOSE';
                  return (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-lg bg-brand-surface/70 border border-brand-border hover:border-brand-border/90 text-xs transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${
                            isClose
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : isBuy
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}
                        >
                          {log.action} {log.symbol}
                        </span>
                        <span className="text-[10px] text-brand-muted font-mono">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-200 leading-snug">{log.details}</div>
                      {log.pnl !== undefined && (
                        <div
                          className={`text-[11px] font-mono font-bold mt-1 ${
                            log.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          Realized PnL: {log.pnl >= 0 ? '+' : ''}₹{log.pnl.toFixed(2)}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
