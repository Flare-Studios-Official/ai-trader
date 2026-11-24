import React from 'react';
import { History, CheckCircle2, TrendingUp, TrendingDown } from 'lucide-react';
import { ClosedTrade } from '../types';

interface HistoryTabProps {
  trades: ClosedTrade[];
}

export const HistoryTab: React.FC<HistoryTabProps> = ({ trades }) => {
  const totalPnl = trades.reduce((acc, t) => acc + t.realized_pnl, 0);
  const totalCharges = trades.reduce((acc, t) => acc + t.total_charges, 0);
  const winCount = trades.filter(t => t.realized_pnl > 0).length;
  const winRate = trades.length > 0 ? (winCount / trades.length) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center space-x-2">
            <History className="w-5 h-5 text-blue-400" />
            <span>Virtual Execution History & Analytics</span>
          </h2>
          <p className="text-xs text-brand-muted mt-0.5">
            Every trade includes realistic simulated execution, slippage, and statutory Indian charges.
          </p>
        </div>

        {/* Quick Analytics Strip */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="bg-brand-surface px-3 py-1.5 rounded-lg border border-brand-border">
            <span className="text-[10px] text-brand-muted uppercase block">Win Rate</span>
            <strong className="text-white">{winRate.toFixed(1)}%</strong> ({winCount}/{trades.length})
          </div>
          <div className="bg-brand-surface px-3 py-1.5 rounded-lg border border-brand-border">
            <span className="text-[10px] text-brand-muted uppercase block">Total Charges Paid</span>
            <strong className="text-amber-400">₹{totalCharges.toFixed(2)}</strong>
          </div>
          <div className="bg-brand-surface px-3 py-1.5 rounded-lg border border-brand-border">
            <span className="text-[10px] text-brand-muted uppercase block">Net P&L</span>
            <strong className={totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
              {totalPnl >= 0 ? '+' : ''}₹{totalPnl.toFixed(2)}
            </strong>
          </div>
        </div>
      </div>

      {trades.length === 0 ? (
        <div className="bg-brand-surface rounded-xl p-12 border border-brand-border text-center text-brand-muted">
          No closed trades yet. When positions are closed by Stop-Loss, Target, or manual exit, they will be archived here.
        </div>
      ) : (
        <div className="bg-brand-surface rounded-xl border border-brand-border overflow-hidden shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-brand-card/80 text-brand-muted uppercase text-[10px] tracking-wider border-b border-brand-border">
                <tr>
                  <th className="py-2.5 px-3">Position ID</th>
                  <th className="py-2.5 px-3">Contract</th>
                  <th className="py-2.5 px-3">Side</th>
                  <th className="py-2.5 px-3">Qty</th>
                  <th className="py-2.5 px-3">Entry Price</th>
                  <th className="py-2.5 px-3">Exit Price</th>
                  <th className="py-2.5 px-3">Charges</th>
                  <th className="py-2.5 px-3">Net Realized P&L</th>
                  <th className="py-2.5 px-3">Exit Reason</th>
                  <th className="py-2.5 px-3 text-right">Closed At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border text-gray-200">
                {trades.map((t) => {
                  const isProfit = t.realized_pnl >= 0;
                  const isCrypto = t.asset_type === 'CRYPTO_SPOT' || t.symbol.includes('BTC');
                  const curr = isCrypto ? '$' : '₹';
                  return (
                    <tr key={t.position_id} className="hover:bg-brand-card/40 transition-colors">
                      <td className="py-3 px-3 font-mono text-brand-muted whitespace-nowrap">
                        {t.position_id}
                      </td>
                      <td className="py-3 px-3 font-bold text-white whitespace-nowrap">
                        {t.symbol}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          t.side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {t.side}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {t.quantity} {isCrypto ? 'BTC' : ''}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {curr}{t.entry_price.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {t.exit_price ? `${curr}${t.exit_price.toFixed(2)}` : '-'}
                      </td>
                      <td className="py-3 px-3 text-amber-400 whitespace-nowrap">
                        {isCrypto ? `$${(t.total_charges / 84).toFixed(2)}` : `₹${t.total_charges.toFixed(2)}`}
                      </td>
                      <td className={`py-3 px-3 font-bold whitespace-nowrap ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isProfit ? '+' : ''}{curr}{t.realized_pnl.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-brand-muted whitespace-nowrap">
                        {t.exit_reason || 'Manual Exit'}
                      </td>
                      <td className="py-3 px-3 text-right text-brand-muted whitespace-nowrap">
                        {t.closed_at ? t.closed_at.split('T')[1]?.substring(0, 8) : '-'}
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
