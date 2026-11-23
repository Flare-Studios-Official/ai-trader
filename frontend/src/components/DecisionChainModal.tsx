import React from 'react';
import { X, CheckCircle2, XCircle, Clock, Zap, Brain, ShieldCheck, Activity, ArrowDown } from 'lucide-react';
import { SignalItem } from '../types';

interface DecisionChainModalProps {
  signal: SignalItem | null;
  onClose: () => void;
}

export const DecisionChainModal: React.FC<DecisionChainModalProps> = ({ signal, onClose }) => {
  if (!signal) return null;

  const isBuy = signal.stage1_signal === 'BUY';
  const aiApproved = signal.ai_decision === 'APPROVED';
  const aiWaiting = signal.ai_decision === 'WAITING';
  const riskApproved = signal.risk_status === 'APPROVED';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-brand-surface border border-brand-border rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-brand-border">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-white">Full Signal Decision Chain Audit</h2>
              <span className="text-xs bg-brand-card text-brand-muted px-2 py-0.5 rounded border border-brand-border">
                Signal #{signal.id}
              </span>
            </div>
            <div className="text-xs text-brand-muted mt-1">
              Symbol: <strong className="text-white">{signal.symbol}</strong> • Timestamp: <strong className="text-white">{signal.timestamp}</strong>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-brand-card text-brand-muted hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Data Origin Legend */}
        <div className="mt-4 p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs flex items-center justify-between">
          <span className="text-blue-300 font-semibold">Data Provenance:</span>
          <div className="flex items-center space-x-3 text-[11px]">
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="text-gray-300">Angel One SmartAPI</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-purple-400"></span>
              <span className="text-gray-300">Independent AI Audit</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span className="text-gray-300">Simulated Paper Broker</span>
            </span>
          </div>
        </div>

        {/* 4-Stage Step-by-Step Chain */}
        <div className="mt-6 space-y-4">
          {/* Stage 1: V12 Indicator Replica */}
          <div className="bg-brand-card/70 border border-brand-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded bg-blue-500/20 text-blue-400">
                  <Zap className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-white">Stage 1: V12 Indicator Replica</h4>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                isBuy ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}>
                {signal.stage1_signal} ({signal.stage1_confidence}%)
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mt-3">
              <div className="bg-brand-surface p-2 rounded border border-brand-border">
                <span className="text-[10px] text-brand-muted uppercase">Close Price</span>
                <p className="font-bold text-white mt-0.5">₹{signal.close_price.toFixed(2)}</p>
              </div>
              <div className="bg-brand-surface p-2 rounded border border-brand-border">
                <span className="text-[10px] text-brand-muted uppercase">V12 Baseline</span>
                <p className="font-bold text-white mt-0.5">₹{signal.baseline.toFixed(2)}</p>
              </div>
              <div className="bg-brand-surface p-2 rounded border border-brand-border">
                <span className="text-[10px] text-brand-muted uppercase">Fuel State</span>
                <p className="font-bold text-amber-400 mt-0.5">{signal.fuel_state}</p>
              </div>
              <div className="bg-brand-surface p-2 rounded border border-brand-border">
                <span className="text-[10px] text-brand-muted uppercase">RSI(14)</span>
                <p className="font-bold text-purple-400 mt-0.5">{signal.rsi.toFixed(1)}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <ArrowDown className="w-4 h-4 text-brand-muted" />
          </div>

          {/* Stage 2: Independent AI Verification */}
          <div className="bg-brand-card/70 border border-brand-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded bg-purple-500/20 text-purple-400">
                  <Brain className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-white">Stage 2: Independent AI Verification</h4>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-bold flex items-center space-x-1 ${
                aiApproved
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : aiWaiting
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}>
                {aiApproved && <CheckCircle2 className="w-3.5 h-3.5" />}
                {aiWaiting && <Clock className="w-3.5 h-3.5" />}
                {!aiApproved && !aiWaiting && <XCircle className="w-3.5 h-3.5" />}
                <span>{signal.ai_decision} ({signal.ai_score?.toFixed(0)}/100)</span>
              </span>
            </div>
            <p className="text-xs text-gray-300 mt-2 bg-brand-surface p-2.5 rounded border border-brand-border leading-relaxed">
              {signal.ai_reason}
            </p>
            {signal.ai_breakdown && Object.keys(signal.ai_breakdown).length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mt-3">
                {Object.entries(signal.ai_breakdown).map(([key, val]: any) => (
                  <div key={key} className="bg-brand-surface p-2 rounded border border-brand-border">
                    <span className="text-[10px] text-brand-muted uppercase truncate block">{key.replace('_', ' ')}</span>
                    <p className="font-bold text-blue-400 mt-0.5">
                      {typeof val === 'object' && val !== null ? `${val.score ?? ''} / ${val.max ?? ''}` : String(val)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-center">
            <ArrowDown className="w-4 h-4 text-brand-muted" />
          </div>

          {/* Stage 3: Deterministic Risk Management */}
          <div className="bg-brand-card/70 border border-brand-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded bg-amber-500/20 text-amber-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-white">Stage 3: Deterministic Risk Management</h4>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                riskApproved ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}>
                {signal.risk_status}
              </span>
            </div>
            <p className="text-xs text-gray-300 mt-2 bg-brand-surface p-2.5 rounded border border-brand-border leading-relaxed">
              {signal.risk_reason}
            </p>
          </div>

          <div className="flex justify-center">
            <ArrowDown className="w-4 h-4 text-brand-muted" />
          </div>

          {/* Stage 4: Cloud Paper Broker Execution */}
          <div className="bg-brand-card/70 border border-brand-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded bg-emerald-500/20 text-emerald-400">
                  <Activity className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-white">Stage 4: Cloud Paper Broker Execution</h4>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                signal.executed ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
              }`}>
                {signal.executed ? 'FILLED' : 'NOT EXECUTED'}
              </span>
            </div>
            {signal.executed ? (
              <div className="text-xs text-emerald-300 bg-emerald-500/10 p-3 rounded border border-emerald-500/20 mt-2">
                Order #{signal.order_id} filled @ ₹{signal.fill_price?.toFixed(2)} with simulated liquidity slippage and statutory STT/exchange charges applied.
              </div>
            ) : (
              <div className="text-xs text-brand-muted bg-brand-surface p-3 rounded border border-brand-border mt-2">
                Order execution was prevented by {signal.ai_decision !== 'APPROVED' ? 'Stage 2 AI Verifier' : 'Stage 3 Risk Manager'} to preserve virtual capital.
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all"
          >
            Close Audit
          </button>
        </div>
      </div>
    </div>
  );
};
