import React from 'react';
import { Brain, CheckCircle2, XCircle, Clock, AlertTriangle, ShieldCheck } from 'lucide-react';
import { SignalItem } from '../types';

interface AIVerifierTabProps {
  signals: SignalItem[];
  onViewDecisionChain: (sig: SignalItem) => void;
}

export const AIVerifierTab: React.FC<AIVerifierTabProps> = ({ signals, onViewDecisionChain }) => {
  const approvedCount = signals.filter(s => s.ai_decision === 'APPROVED').length;
  const rejectedCount = signals.filter(s => s.ai_decision === 'REJECTED').length;
  const waitingCount = signals.filter(s => s.ai_decision === 'WAITING').length;

  return (
    <div className="space-y-6">
      {/* AI Philosophy & Guardrails Banner */}
      <div className="bg-brand-surface rounded-xl p-5 border border-brand-border shadow-lg">
        <div className="flex items-center space-x-3 mb-2">
          <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Stage 2: Independent AI Verification Engine</h2>
            <p className="text-xs text-brand-muted">
              Evaluates trend concordance, ADX, RSI, volatility regime, market chop, volume/OI, and data freshness.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 text-xs">
          <div className="bg-brand-card/70 p-3 rounded-lg border border-brand-border">
            <span className="text-emerald-400 font-bold block text-sm">Rule 1: Direction Invariance</span>
            <p className="text-brand-muted mt-1">
              The AI never changes the original V12 indicator's direction. A BUY remains a BUY; it only approves, waits, or rejects.
            </p>
          </div>
          <div className="bg-brand-card/70 p-3 rounded-lg border border-brand-border">
            <span className="text-blue-400 font-bold block text-sm">Rule 2: Transparent Explanations</span>
            <p className="text-brand-muted mt-1">
              Every decision provides a full written justification and factor breakdown score, preserving complete auditability.
            </p>
          </div>
          <div className="bg-brand-card/70 p-3 rounded-lg border border-brand-border">
            <span className="text-amber-400 font-bold block text-sm">Rule 3: Stale & Overexposure Shield</span>
            <p className="text-brand-muted mt-1">
              Hard vetos automatically reject stale feeds (&gt;10m) or duplicate trades when 1 open position already exists.
            </p>
          </div>
        </div>
      </div>

      {/* Decision Summary Counters */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-brand-surface p-4 rounded-xl border border-brand-border text-center">
          <div className="text-[11px] font-semibold text-brand-muted uppercase">Approved Signals</div>
          <div className="text-2xl font-black text-emerald-400 mt-1 flex items-center justify-center space-x-2">
            <CheckCircle2 className="w-5 h-5" />
            <span>{approvedCount}</span>
          </div>
        </div>
        <div className="bg-brand-surface p-4 rounded-xl border border-brand-border text-center">
          <div className="text-[11px] font-semibold text-brand-muted uppercase">Waiting Confirmation</div>
          <div className="text-2xl font-black text-amber-400 mt-1 flex items-center justify-center space-x-2">
            <Clock className="w-5 h-5" />
            <span>{waitingCount}</span>
          </div>
        </div>
        <div className="bg-brand-surface p-4 rounded-xl border border-brand-border text-center">
          <div className="text-[11px] font-semibold text-brand-muted uppercase">Rejected / Vetoed</div>
          <div className="text-2xl font-black text-red-400 mt-1 flex items-center justify-center space-x-2">
            <XCircle className="w-5 h-5" />
            <span>{rejectedCount}</span>
          </div>
        </div>
      </div>

      {/* Audited Decisions Feed */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-white">AI Signal Verification Logs</h3>
        {signals.length === 0 ? (
          <div className="bg-brand-surface rounded-xl p-8 border border-brand-border text-center text-brand-muted text-xs">
            No signals audited yet.
          </div>
        ) : (
          signals.map((sig) => {
            const isApproved = sig.ai_decision === 'APPROVED';
            const isWaiting = sig.ai_decision === 'WAITING';

            return (
              <div
                key={sig.id}
                className="bg-brand-surface rounded-xl p-4 border border-brand-border shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-white text-sm">{sig.symbol}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      sig.stage1_signal === 'BUY'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      V12 {sig.stage1_signal} ({sig.stage1_confidence}%)
                    </span>
                    <span className="text-xs text-brand-muted">• {sig.timestamp}</span>
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed max-w-2xl">{sig.ai_reason}</p>
                </div>

                <div className="flex items-center space-x-4 w-full md:w-auto justify-between md:justify-end">
                  <div className="text-right">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center space-x-1.5 ${
                      isApproved
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : isWaiting
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}>
                      {isApproved && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {isWaiting && <Clock className="w-3.5 h-3.5" />}
                      {!isApproved && !isWaiting && <XCircle className="w-3.5 h-3.5" />}
                      <span>{sig.ai_decision} ({sig.ai_score?.toFixed(0)}/100)</span>
                    </span>
                  </div>
                  <button
                    onClick={() => onViewDecisionChain(sig)}
                    className="px-3 py-1.5 bg-brand-card hover:bg-blue-600/20 text-blue-400 border border-brand-border rounded-lg text-xs font-bold transition-all"
                  >
                    Inspect
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
