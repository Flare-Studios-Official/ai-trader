import React from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Zap,
  Activity,
  AlertOctagon,
  Play,
  Pause,
  Database,
  Radio,
  Lock,
  Layers,
  Coins
} from 'lucide-react';
import { PortfolioSummary, SystemStatus } from '../types';

interface HeaderProps {
  portfolio: PortfolioSummary;
  systemStatus: SystemStatus;
  onToggleKillSwitch: (active: boolean) => void;
  onToggleAutomatedTrading: (active: boolean) => void;
  onSelectInstrument?: (instrument: string) => void;
  isConnected: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  portfolio,
  systemStatus,
  onToggleKillSwitch,
  onToggleAutomatedTrading,
  onSelectInstrument,
  isConnected
}) => {
  const isAutoTradeOn = systemStatus.automated_trading_active;
  const selectedInstrument = systemStatus.selected_instrument || 'NIFTY';

  const instruments = [
    { id: 'ALL', label: 'ALL MARKETS (Autonomous)', icon: '⚡' },
    { id: 'NIFTY', label: 'NIFTY 50 (Options)', icon: '📈' },
    { id: 'BANKNIFTY', label: 'BANK NIFTY (Options)', icon: '🏦' },
    { id: 'SENSEX', label: 'SENSEX (Options)', icon: '🏛️' },
    { id: 'BANKEX', label: 'BANKEX (Options)', icon: '💳' },
    { id: 'BITCOIN', label: 'BITCOIN (Spot)', icon: '₿' },
  ];

  return (
    <header className="bg-brand-surface border-b border-brand-border sticky top-0 z-30 shadow-lg">
      {/* LIVE MARKET DATA & STRICT PAPER TRADING BANNER */}
      <div className="bg-emerald-950/40 border-b border-emerald-500/30 px-4 py-1.5 text-center text-xs font-semibold text-emerald-300 flex items-center justify-center space-x-2 flex-wrap">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span className="font-bold tracking-wide text-white">LIVE MARKET DATA CONNECTED:</span>
        <span className="text-emerald-400 font-medium">Angel One SmartAPI (NSE/BSE F&O) &amp; Coinbase Spot (BTC)</span>
        <span className="text-gray-400 hidden sm:inline">•</span>
        <span className="text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
          STRICTLY VIRTUAL PAPER TRADING ONLY (ZERO REAL MONEY)
        </span>
      </div>

      {/* AUTONOMOUS TRADING MASTER CONTROL BAR */}
      <div className="bg-brand-card/90 border-b border-brand-border px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Left: Auto Trade Toggle & Status Indicator */}
          <div className="flex items-center space-x-3 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center space-x-2">
              <span className="text-xs uppercase font-extrabold tracking-wider text-gray-300">
                AI Auto Trade:
              </span>
              <button
                onClick={() => onToggleAutomatedTrading(!isAutoTradeOn)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-black flex items-center space-x-1.5 transition-all shadow-md ${
                  isAutoTradeOn
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-400/50'
                    : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-600'
                }`}
              >
                {isAutoTradeOn ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>AUTO TRADE: ON</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>AUTO TRADE: OFF (CLICK TO ENABLE)</span>
                  </>
                )}
              </button>
            </div>

            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md border ${
              isAutoTradeOn
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            }`}>
              {isAutoTradeOn
                ? selectedInstrument === 'ALL'
                  ? '● ACTIVE — Autonomous Trading Across ALL Markets (Zero Approval Needed)'
                  : `● ACTIVE — Autonomous Trading in ${selectedInstrument} (Zero Approval Needed)`
                : '○ INACTIVE — Standby Mode'}
            </span>
          </div>

          {/* Right: Instrument Selector (Available when Auto Trade is ON or to configure target) */}
          <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar w-full md:w-auto py-1">
            <span className="text-[10px] uppercase font-bold text-brand-muted mr-1 hidden lg:inline">
              Select Instrument to Trade:
            </span>
            {instruments.map((inst) => {
              const isSelected = selectedInstrument === inst.id;
              return (
                <button
                  key={inst.id}
                  onClick={() => onSelectInstrument && onSelectInstrument(inst.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 whitespace-nowrap ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md ring-1 ring-blue-400'
                      : 'bg-brand-surface text-brand-muted hover:text-white hover:bg-brand-card border border-brand-border'
                  }`}
                  title={`Trade ${inst.label} only`}
                >
                  <span>{inst.icon}</span>
                  <span>{inst.label}</span>
                  {isSelected && <span className="ml-1 text-[10px] bg-blue-400/30 px-1 rounded">Active</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Header Bar: Portfolio Summary & Actions */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand & Connection State */}
        <div className="flex items-center justify-between w-full md:w-auto">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-wide text-white">AI TRADER</span>
                <span className="text-[10px] uppercase font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/40">
                  Live Feed
                </span>
                <span className="text-[10px] uppercase font-bold bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/40">
                  Paper Trading
                </span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-brand-muted mt-0.5">
                <span className="flex items-center">
                  <span className={`w-2 h-2 rounded-full mr-1.5 ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-emerald-400'}`}></span>
                  <span>Live Feed Active</span>
                </span>
                <span>•</span>
                <span className="text-gray-300">
                  Target: <strong className="text-white">{selectedInstrument}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Mobile Kill Switch */}
          <div className="md:hidden">
            <button
              onClick={() => onToggleKillSwitch(!systemStatus.kill_switch_active)}
              className={`p-2 rounded-lg text-xs font-bold ${
                systemStatus.kill_switch_active ? 'bg-red-600 text-white' : 'bg-brand-card text-red-400 border border-red-500/30'
              }`}
            >
              <AlertOctagon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Portfolio Balance & Controls */}
        <div className="flex items-center justify-between md:justify-end w-full md:w-auto space-x-2 sm:space-x-3 text-xs overflow-x-auto py-1">
          {/* Virtual Capital */}
          <div className="bg-brand-card/80 px-3 py-1.5 rounded-lg border border-brand-border">
            <div className="text-[9px] uppercase text-brand-muted font-bold">Virtual Capital</div>
            <div className="font-bold text-white text-sm">₹{portfolio.initial_capital.toLocaleString('en-IN')}</div>
          </div>

          {/* Available Cash */}
          <div className="bg-brand-card/80 px-3 py-1.5 rounded-lg border border-brand-border">
            <div className="text-[9px] uppercase text-brand-muted font-bold">Available Balance</div>
            <div className="font-bold text-blue-400 text-sm">₹{portfolio.available_balance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
          </div>

          {/* Realized P&L */}
          <div className="bg-brand-card/80 px-3 py-1.5 rounded-lg border border-brand-border">
            <div className="text-[9px] uppercase text-brand-muted font-bold">Realized P&amp;L</div>
            <div className={`font-bold text-sm ${portfolio.realized_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {portfolio.realized_pnl >= 0 ? '+' : ''}₹{portfolio.realized_pnl.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
          </div>

          {/* Emergency Kill Switch */}
          <div className="hidden md:block">
            <button
              onClick={() => onToggleKillSwitch(!systemStatus.kill_switch_active)}
              className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all shadow-md ${
                systemStatus.kill_switch_active
                  ? 'bg-red-600 text-white animate-pulse'
                  : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30'
              }`}
              title="Emergency Paper Trading Kill Switch"
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              <span>{systemStatus.kill_switch_active ? 'KILL ENGAGED' : 'KILL SWITCH'}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
