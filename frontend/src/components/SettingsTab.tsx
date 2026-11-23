import React from 'react';
import { Sliders, ShieldCheck, AlertOctagon, Lock, Cloud, Smartphone } from 'lucide-react';
import { RiskConfig, PortfolioSummary } from '../types';

interface SettingsTabProps {
  riskConfig: RiskConfig;
  portfolio: PortfolioSummary;
  onToggleKillSwitch: (active: boolean) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  riskConfig,
  portfolio,
  onToggleKillSwitch
}) => {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-base font-bold text-white flex items-center space-x-2">
          <Sliders className="w-5 h-5 text-blue-400" />
          <span>System Parameters & Cloud Configuration</span>
        </h2>
        <p className="text-xs text-brand-muted mt-0.5">
          Deterministic risk parameters and cloud deployment status for AI Trader.
        </p>
      </div>

      {/* Emergency Kill Switch Card */}
      <div className={`p-5 rounded-xl border transition-all ${
        riskConfig.kill_switch_active
          ? 'bg-red-500/10 border-red-500/40'
          : 'bg-brand-surface border-brand-border'
      }`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className={`p-2 rounded-lg ${riskConfig.kill_switch_active ? 'bg-red-500 text-white' : 'bg-red-500/10 text-red-400'}`}>
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Emergency Paper-Trading Kill Switch</h3>
              <p className="text-xs text-brand-muted mt-0.5">
                Instantly halts all simulated orders and blocks new entries across all symbols.
              </p>
            </div>
          </div>
          <button
            onClick={() => onToggleKillSwitch(!riskConfig.kill_switch_active)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-md ${
              riskConfig.kill_switch_active
                ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse'
                : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/40'
            }`}
          >
            {riskConfig.kill_switch_active ? 'DEACTIVATE KILL SWITCH' : 'ENGAGE KILL SWITCH'}
          </button>
        </div>
      </div>

      {/* Deterministic Risk Rules Table */}
      <div className="bg-brand-surface rounded-xl p-5 border border-brand-border shadow-md">
        <div className="flex items-center space-x-2 mb-4">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">Deterministic Risk Rules (Initial Virtual Configuration)</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="bg-brand-card/70 p-3 rounded-lg border border-brand-border">
            <span className="text-brand-muted text-[10px] uppercase block">Virtual Account Balance</span>
            <strong className="text-white text-base">₹{portfolio.initial_capital.toLocaleString('en-IN')}</strong>
            <p className="text-[11px] text-brand-muted mt-1">Starting paper-trading capital for F&O margin and option premiums.</p>
          </div>

          <div className="bg-brand-card/70 p-3 rounded-lg border border-brand-border">
            <span className="text-brand-muted text-[10px] uppercase block">Maximum Open Positions</span>
            <strong className="text-white text-base">{riskConfig.max_open_positions} Position</strong>
            <p className="text-[11px] text-brand-muted mt-1">Single-position constraint prevents correlation and portfolio overexposure.</p>
          </div>

          <div className="bg-brand-card/70 p-3 rounded-lg border border-brand-border">
            <span className="text-brand-muted text-[10px] uppercase block">Maximum Trades Per Day</span>
            <strong className="text-white text-base">{riskConfig.max_trades_per_day} Trades Max</strong>
            <p className="text-[11px] text-brand-muted mt-1">Used today: {riskConfig.today_trades} / {riskConfig.max_trades_per_day}. Prevents overtrading in chop.</p>
          </div>

          <div className="bg-brand-card/70 p-3 rounded-lg border border-brand-border">
            <span className="text-brand-muted text-[10px] uppercase block">Maximum Daily Drawdown Loss</span>
            <strong className="text-white text-base">{riskConfig.max_daily_loss_pct}% (₹2,000)</strong>
            <p className="text-[11px] text-brand-muted mt-1">Current daily P&L: ₹{riskConfig.daily_realized_pnl.toFixed(2)}. Hard stop halts trading upon breach.</p>
          </div>
        </div>
      </div>

      {/* Cloud & Security Guarantees */}
      <div className="bg-brand-surface rounded-xl p-5 border border-brand-border shadow-md">
        <div className="flex items-center space-x-2 mb-3">
          <Lock className="w-5 h-5 text-blue-400" />
          <h3 className="text-sm font-bold text-white">Cloud Architecture & Safety Guarantees</h3>
        </div>

        <div className="space-y-3 text-xs text-gray-300">
          <div className="flex items-start space-x-2.5">
            <Cloud className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong>Laptop-Independent Cloud Hosting:</strong> Pre-configured for deployment with <strong>Vercel (React Frontend)</strong> and <strong>Render (FastAPI Backend)</strong>.
            </span>
          </div>

          <div className="flex items-start space-x-2.5">
            <Smartphone className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <span>
              <strong>Cross-Device Access:</strong> Responsive PWA layout supports seamless monitoring on <strong>iPad, Android Phone, and PC Browser</strong> without any local Python requirement.
            </span>
          </div>

          <div className="flex items-start space-x-2.5">
            <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              <strong>Zero Live Order Placement Risk:</strong> The codebase contains strictly simulated execution logic. There is no route capable of placing real-money orders through Angel One.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
