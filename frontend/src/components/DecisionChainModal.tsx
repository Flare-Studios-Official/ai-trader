import React from 'react';
import { X, Brain, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { AISignalRecord } from '../types';
import { formatIstDateTime } from '../utils/format';

interface DecisionChainModalProps {
  signal: AISignalRecord | null;
  onClose: () => void;
}

export const DecisionChainModal: React.FC<DecisionChainModalProps> = ({ signal, onClose }) => {
  if (!signal) return null;

  const isApproved = signal.ai_decision === 'APPROVED';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-[#3F5BD9]" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                AI Decision Audit — {signal.symbol} ({signal.v12_signal})
              </h3>
              <p className="text-[11px] text-slate-500">
                Bar {formatIstDateTime(signal.bar_timestamp)} • {signal.timeframe}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <div
            className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${
              isApproved ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
            }`}
          >
            {isApproved ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold uppercase ${isApproved ? 'text-emerald-800' : 'text-red-800'}`}>
                  {signal.ai_decision}
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white text-slate-800 border border-slate-200">
                  Conviction Score: {signal.ai_score}/100
                </span>
              </div>
              <p className="text-xs text-slate-700 mt-1 leading-relaxed">{signal.ai_reason}</p>
            </div>
          </div>

          {signal.selected_option_symbol && (
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-slate-500">Selected Contract</div>
                <div className="font-bold text-slate-900 mt-0.5">{signal.selected_option_symbol}</div>
              </div>
              <div>
                <div className="text-slate-500">Option LTP</div>
                <div className="font-bold text-slate-900 mt-0.5">₹{signal.selected_option_ltp ?? '—'}</div>
              </div>
              <div>
                <div className="text-slate-500">Lot Size</div>
                <div className="font-bold text-slate-900 mt-0.5">{signal.lot_size ?? '—'}</div>
              </div>
            </div>
          )}

          {signal.factor_breakdown && Object.keys(signal.factor_breakdown).length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">6-Factor AI Score Breakdown</div>
              {Object.entries(signal.factor_breakdown).map(([key, item]) => (
                <div key={key} className="p-2.5 rounded-lg border border-slate-200 bg-white">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                    <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                    <span className="tabular-nums text-[#3F5BD9]">
                      {item.score}/{item.max}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">{item.note}</p>
                </div>
              ))}
            </div>
          )}

          {signal.warnings && signal.warnings.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1">
              <div className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Guardrail Warnings
              </div>
              {signal.warnings.map((w, i) => (
                <div key={i} className="text-xs text-amber-900">
                  • {w}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
