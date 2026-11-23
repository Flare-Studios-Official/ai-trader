import React from 'react';
import { Radio, CheckCircle2, XCircle, Clock, Zap } from 'lucide-react';
import { SignalItem } from '../types';

interface SignalsTabProps {
  signals: SignalItem[];
  onViewDecisionChain: (sig: SignalItem) => void;
}

export const SignalsTab: React.FC<SignalsTabProps> = ({ signals, onViewDecisionChain }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white flex items-center space-x-2">
            <Radio className="w-5 h-5 text-blue-400" />
            <span>V12 Indicator Strategy Signals (Stage 1)</span>
          </h2>
          <p className="text-xs text-brand-muted mt-0.5">
            Original Pine Script calculations replicated independently in Python. 100% Non-Repainting on candle close.
          </p>
        </div>
        <span className="text-xs bg-brand-surface text-brand-muted px-3 py-1 rounded-lg border border-brand-border">
          Total Generated: {signals.length}
        </span>
      </div>

      {signals.length === 0 ? (
        <div className="bg-brand-surface rounded-xl p-12 border border-brand-border text-center text-brand-muted">
          No strategy signals logged yet. When price flips across the V12 Adaptive Supertrend baseline, signals will appear here.
        </div>
      ) : (
        <div className="bg-brand-surface rounded-xl border border-brand-border overflow-hidden shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-brand-card/80 text-brand-muted uppercase text-[10px] tracking-wider border-b border-brand-border">
                <tr>
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Symbol</th>
                  <th className="py-2.5 px-3">Signal</th>
                  <th className="py-2.5 px-3">V12 Conf</th>
                  <th className="py-2.5 px-3">Close Price</th>
                  <th className="py-2.5 px-3">Baseline</th>
                  <th className="py-2.5 px-3">Fuel State</th>
                  <th className="py-2.5 px-3">RSI(14)</th>
                  <th className="py-2.5 px-3">Chop Index</th>
                  <th className="py-2.5 px-3">AI Verdict</th>
                  <th className="py-2.5 px-3 text-right">Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border text-gray-200">
                {signals.map((sig) => {
                  const isBuy = sig.stage1_signal === 'BUY';
                  const aiApproved = sig.ai_decision === 'APPROVED';
                  const aiWaiting = sig.ai_decision === 'WAITING';

                  return (
                    <tr key={sig.id} className="hover:bg-brand-card/40 transition-colors">
                      <td className="py-3 px-3 text-brand-muted whitespace-nowrap">
                        {sig.timestamp}
                      </td>
                      <td className="py-3 px-3 font-bold text-white whitespace-nowrap">
                        {sig.symbol}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded font-bold text-xs ${
                          isBuy ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                          {sig.stage1_signal}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold text-purple-400 whitespace-nowrap">
                        {sig.stage1_confidence}%
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        ₹{sig.close_price.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-blue-400 whitespace-nowrap">
                        ₹{sig.baseline.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-amber-400 whitespace-nowrap">
                        {sig.fuel_state}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {sig.rsi.toFixed(1)}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {sig.chop_index.toFixed(1)}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          aiApproved
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : aiWaiting
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}>
                          {sig.ai_decision}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => onViewDecisionChain(sig)}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-brand-card hover:bg-blue-600/20 text-blue-400 border border-brand-border rounded transition-all"
                        >
                          Details
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
  );
};
