import React, { useState } from 'react';
import { ClipboardList, Brain, ReceiptText } from 'lucide-react';
import { AISignalRecord, OrdersSubTab, OverviewResponse } from '../types';
import { formatDuration, formatInr, formatIstDateTime, formatNumber, formatUsd } from '../utils/format';

interface OrdersViewProps {
  overview: OverviewResponse;
  subTab: OrdersSubTab;
  onChangeSubTab: (t: OrdersSubTab) => void;
  onInspectSignal: (sig: AISignalRecord) => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  overview,
  subTab,
  onChangeSubTab,
  onInspectSignal,
}) => {
  const { closedPositions, transactions, aiSignals, portfolio } = overview;
  const [filterCryptoOnly, setFilterCryptoOnly] = useState(false);

  const wins = closedPositions.filter((t) => Number(t.realized_pnl || 0) > 0).length;
  const winRate = closedPositions.length ? Math.round((wins / closedPositions.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-3.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onChangeSubTab('trades')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
              subTab === 'trades' ? 'bg-[#3F5BD9] text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            Closed Trades ({closedPositions.length})
          </button>
          <button
            onClick={() => onChangeSubTab('ledger')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
              subTab === 'ledger' ? 'bg-[#3F5BD9] text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ReceiptText className="w-3.5 h-3.5" />
            Ledger ({transactions.length})
          </button>
          <button
            onClick={() => onChangeSubTab('ai_signals')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
              subTab === 'ai_signals' ? 'bg-[#3F5BD9] text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            AI Decisions ({aiSignals.length})
          </button>
        </div>

        <label className="text-xs text-slate-600 font-medium flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={filterCryptoOnly}
            onChange={(e) => setFilterCryptoOnly(e.target.checked)}
            className="rounded border-slate-300 text-[#3F5BD9]"
          />
          Bitcoin Only
        </label>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-3.5">
          <div className="text-[11px] text-slate-500">Net Realized P&amp;L</div>
          <div
            className={`text-base sm:text-lg font-bold tabular-nums mt-0.5 ${
              portfolio.realized_pnl >= 0 ? 'text-[#0B9D58]' : 'text-[#E53935]'
            }`}
          >
            {formatInr(portfolio.realized_pnl, true)}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-3.5">
          <div className="text-[11px] text-slate-500">Win Rate</div>
          <div className="text-base sm:text-lg font-bold text-slate-900 tabular-nums mt-0.5">
            {winRate}% ({wins}/{closedPositions.length})
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-3.5">
          <div className="text-[11px] text-slate-500">Total Brokerage &amp; Taxes</div>
          <div className="text-base sm:text-lg font-bold text-slate-900 tabular-nums mt-0.5">
            {formatInr(portfolio.total_charges_paid)}
          </div>
        </div>
      </div>

      {subTab === 'trades' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          {closedPositions.filter((p) => !filterCryptoOnly || p.currency === 'USD').length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">No closed paper trades yet.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {closedPositions
                .filter((p) => !filterCryptoOnly || p.currency === 'USD')
                .map((tr) => {
                  const pnl = Number(tr.realized_pnl || 0);
                  const isPos = pnl >= 0;
                  const isCrypto = tr.currency === 'USD';
                  const durSec =
                    tr.closed_at && tr.opened_at
                      ? Math.floor((Date.parse(tr.closed_at) - Date.parse(tr.opened_at)) / 1000)
                      : null;

                  return (
                    <div key={tr.position_id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-900">{tr.symbol}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {tr.side}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {formatIstDateTime(tr.opened_at)} → {formatIstDateTime(tr.closed_at)} ({formatDuration(durSec)})
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 tabular-nums">
                          Entry {isCrypto ? formatUsd(tr.entry_price) : `₹${formatNumber(tr.entry_price)}`} → Exit{' '}
                          {isCrypto ? formatUsd(tr.exit_price || 0) : `₹${formatNumber(tr.exit_price || 0)}`} • Charges{' '}
                          {formatInr(Number(tr.entry_charges || 0) + Number(tr.exit_charges || 0))}
                        </div>
                        <div className="text-[11px] text-slate-500">Reason: {tr.exit_reason || 'Completed'}</div>
                      </div>

                      <div className="text-right tabular-nums shrink-0">
                        <div className={`text-sm font-bold ${isPos ? 'text-[#0B9D58]' : 'text-[#E53935]'}`}>
                          {formatInr(pnl, true)}
                        </div>
                        {isCrypto && portfolio.usd_inr_rate > 0 && (
                          <div className={`text-xs font-semibold ${isPos ? 'text-[#0B9D58]' : 'text-[#E53935]'}`}>
                            {formatUsd(pnl / portfolio.usd_inr_rate, true)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {subTab === 'ledger' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          {transactions.filter((t) => !filterCryptoOnly || t.currency === 'USD').length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">No ledger transactions found.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {transactions
                .filter((t) => !filterCryptoOnly || t.currency === 'USD')
                .map((tx) => (
                  <div key={tx.tx_id} className="p-3.5 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0 space-y-0.5">
                      <div className="font-bold text-slate-900">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-blue-50 text-[#3F5BD9] text-[10px] mr-1.5">
                          {tx.tx_type}
                        </span>
                        {tx.symbol} ({tx.side})
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">{tx.reason}</div>
                      <div className="text-[10px] text-slate-400">{formatIstDateTime(tx.created_at)}</div>
                    </div>
                    <div className="text-right tabular-nums shrink-0">
                      <div className="font-bold text-slate-900">{formatInr(tx.amount)}</div>
                      {tx.charges > 0 && (
                        <div className="text-[10px] text-slate-500">Chg: {formatInr(tx.charges)}</div>
                      )}
                      {tx.tx_type === 'EXIT' && (
                        <div className={`text-[11px] font-bold ${tx.realized_pnl >= 0 ? 'text-[#0B9D58]' : 'text-[#E53935]'}`}>
                          {formatInr(tx.realized_pnl, true)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {subTab === 'ai_signals' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          {aiSignals.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              No V12 signals evaluated yet. Turn Auto Trade ON to scan incoming closed bars.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {aiSignals.map((sig) => {
                const isApp = sig.ai_decision === 'APPROVED';
                return (
                  <button
                    key={sig.id}
                    onClick={() => onInspectSignal(sig)}
                    className="w-full p-4 flex items-start justify-between gap-3 text-left hover:bg-slate-50 transition-colors"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-900">{sig.symbol}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            sig.v12_signal === 'BUY'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          V12 {sig.v12_signal} ({sig.v12_confidence}%)
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isApp ? 'bg-blue-50 text-[#3F5BD9]' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {sig.ai_decision} • {sig.ai_score}/100
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2">{sig.ai_reason}</p>
                      <div className="text-[10px] text-slate-400">
                        {formatIstDateTime(sig.bar_timestamp)} • Spot {formatNumber(sig.spot_price)}
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-[#3F5BD9] shrink-0">Inspect →</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
