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
  Lock
} from 'lucide-react';
import { PortfolioSummary, SystemStatus } from '../types';

interface HeaderProps {
  portfolio: PortfolioSummary;
  systemStatus: SystemStatus;
  onToggleKillSwitch: (active: boolean) => void;
  onToggleAutomatedTrading: (active: boolean) => void;
  isConnected: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  portfolio,
  systemStatus,
  onToggleKillSwitch,
  onToggleAutomatedTrading,
  isConnected
}) => {
  return (
    <header className="bg-brand-surface border-b border-brand-border sticky top-0 z-30 shadow-lg">
      {/* GLOBAL DEMO MODE WARNING BANNER */}
      <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-1.5 text-center text-xs font-bold text-amber-300 flex items-center justify-center space-x-2">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
        <span className="tracking-wide">DEMO MODE — NOT CONNECTED TO LIVE BROKER DATA</span>
        <span className="text-amber-400/80 font-normal hidden sm:inline">• Automated Virtual Paper Trading with Internet Reference & Synthetic Feeds</span>
      </div>

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
                <span className="text-[10px] uppercase font-bold bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded border border-amber-500/40">
                  Demo Mode
                </span>
                <span className="text-[10px] uppercase font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/40">
                  Paper Only
                </span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-brand-muted mt-0.5">
                <span className="flex items-center">
                  <span className={`w-2 h-2 rounded-full mr-1.5 ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}></span>
                  {isConnected ? 'WebSocket Live' : 'Connecting...'}
                </span>
                <span>•</span>
                <span className="text-gray-300 flex items-center space-x-1">
                  <Database className="w-3 h-3 text-emerald-400 inline" />
                  <span>Supabase Cloud DB</span>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Mobile Action Buttons */}
          <div className="flex items-center space-x-2 md:hidden">
            <button
              onClick={() => onToggleAutomatedTrading(!systemStatus.automated_trading_active)}
              className={`p-2 rounded-lg text-xs font-bold flex items-center ${
                systemStatus.automated_trading_active ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
              }`}
            >
              {systemStatus.automated_trading_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
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

        {/* Balance & Controls Toolbar */}
        <div className="flex items-center justify-between md:justify-end w-full md:w-auto space-x-2 sm:space-x-3 text-xs overflow-x-auto py-1">
          {/* Virtual Capital */}
          <div className="bg-brand-card/80 px-3 py-1.5 rounded-lg border border-brand-border">
            <div className="text-[9px] uppercase text-brand-muted font-bold">Virtual Capital</div>
            <div className="font-bold text-white text-sm">₹{portfolio.initial_capital.toLocaleString('en-IN')}</div>
          </div>

          {/* Available Cash */}
          <div className="bg-brand-card/80 px-3 py-1.5 rounded-lg border border-brand-border">
            <div className="text-[9px] uppercase text-brand-muted font-bold">Available Cash</div>
            <div className="font-bold text-blue-400 text-sm">₹{portfolio.available_balance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
          </div>

          {/* Realized P&L */}
          <div className="bg-brand-card/80 px-3 py-1.5 rounded-lg border border-brand-border">
            <div className="text-[9px] uppercase text-brand-muted font-bold">Realized P&L</div>
            <div className={`font-bold text-sm ${portfolio.realized_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {portfolio.realized_pnl >= 0 ? '+' : ''}₹{portfolio.realized_pnl.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
          </div>

          {/* Automated Trading Toggle */}
          <div className="hidden md:block pl-1">
            <button
              onClick={() => onToggleAutomatedTrading(!systemStatus.automated_trading_active)}
              className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all shadow-md ${
                systemStatus.automated_trading_active
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-amber-600 hover:bg-amber-500 text-white'
              }`}
              title="Toggle Automated Continuous Paper Trading"
            >
              {systemStatus.automated_trading_active ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>AUTOTRADE: ON</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>AUTOTRADE: PAUSED</span>
                </>
              )}
            </button>
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
