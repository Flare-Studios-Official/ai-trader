import React, { useState } from 'react';
import {
  Power,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Briefcase,
  Activity,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { OverviewResponse, MainTab } from '../types';
import { formatInr, formatNumber, formatUsd, formatIstDateTime } from '../utils/format';

interface HomeViewProps {
  overview: OverviewResponse;
  onNavigateTab: (tab: MainTab) => void;
  onOpenAutoTradeModal: () => void;
  onSelectSymbolForChart: (symbol: string, exchange: string, token: string, label?: string) => void;
}

const STOCK_COLORS: Record<string, string> = {
  'RELIANCE-EQ': 'bg-blue-600',
  'HDFCBANK-EQ': 'bg-indigo-700',
  'TCS-EQ': 'bg-sky-600',
  'INFY-EQ': 'bg-blue-500',
  'ICICIBANK-EQ': 'bg-orange-600',
  'SBIN-EQ': 'bg-cyan-700',
  'HCLTECH-EQ': 'bg-violet-600',
  'JIOFIN-EQ': 'bg-amber-600',
  'ADANIPORTS-EQ': 'bg-emerald-600',
};

export const HomeView: React.FC<HomeViewProps> = ({
  overview,
  onNavigateTab,
  onOpenAutoTradeModal,
  onSelectSymbolForChart,
}) => {
  const { account, portfolio, sessions, quotes, openPositions, transactions, liveScanState } = overview;
  const [watchFilter, setWatchFilter] = useState<'ALL' | 'INDICES' | 'STOCKS' | 'CRYPTO'>('ALL');

  const isTodayPos = portfolio.today_pnl >= 0;
  const isOverallPos = portfolio.overall_pnl >= 0;
  const selectedInst = account.selected_instrument || 'NIFTY';
  const isSelectedCrypto = selectedInst === 'BITCOIN';

  const watchListQuotes = quotes.filter((q) => {
    if (watchFilter === 'INDICES') return q.asset_type === 'INDEX_SPOT';
    if (watchFilter === 'STOCKS') return q.asset_type === 'EQUITY_SPOT';
    if (watchFilter === 'CRYPTO') return q.asset_type === 'CRYPTO_SPOT';
    return q.asset_type === 'INDEX_SPOT' || q.asset_type === 'EQUITY_SPOT' || q.asset_type === 'CRYPTO_SPOT';
  });

  return (
    <div className="space-y-4">
      <section className="bg-white rounded-2xl border border-slate-200 shadow-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span>Paper Portfolio Value</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-[#3F5BD9] text-[10px] font-bold">
                <ShieldCheck className="w-3 h-3" /> PAPER ONLY
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1 tabular-nums">
              {formatInr(portfolio.portfolio_value)}
            </div>
          </div>

          <div className="flex items-center gap-5 sm:gap-7">
            <div className="text-right">
              <div className="text-[11px] font-medium text-slate-500">Today&apos;s P&amp;L</div>
              <div
                className={`text-base sm:text-lg font-bold tabular-nums mt-0.5 flex items-center justify-end gap-0.5 ${
                  isTodayPos ? 'text-[#0B9D58]' : 'text-[#E53935]'
                }`}
              >
                {isTodayPos ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                {formatInr(portfolio.today_pnl, true)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-medium text-slate-500">Overall P&amp;L</div>
              <div
                className={`text-base sm:text-lg font-bold tabular-nums mt-0.5 ${
                  isOverallPos ? 'text-[#0B9D58]' : 'text-[#E53935]'
                }`}
              >
                {formatInr(portfolio.overall_pnl, true)}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-3.5 text-xs">
          <div>
            <div className="text-slate-500 text-[11px]">Available Balance</div>
            <div className="font-bold text-slate-900 text-sm sm:text-base mt-0.5 tabular-nums">
              {formatInr(portfolio.available_balance)}
            </div>
          </div>
          <div>
            <div className="text-slate-500 text-[11px]">Invested Amount</div>
            <div className="font-bold text-slate-900 text-sm sm:text-base mt-0.5 tabular-nums">
              {formatInr(portfolio.invested_amount)}
            </div>
          </div>
          <div>
            <div className="text-slate-500 text-[11px]">Allocation Rule</div>
            <div className="font-bold text-[#3F5BD9] text-sm sm:text-base mt-0.5 tabular-nums">
              {account.capital_allocation_mode === 'ONE_THIRD'
                ? '1/3 Balance'
                : account.capital_allocation_mode === 'TWO_THIRDS'
                ? '2/3 Balance'
                : account.capital_allocation_mode === 'FULL'
                ? '100% Full'
                : `Custom`}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-card p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                  account.auto_trade_active
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    account.auto_trade_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                  }`}
                />
                Auto Trade {account.auto_trade_active ? 'ON' : 'OFF'}
              </span>
              <span className="text-xs font-bold text-[#3F5BD9] bg-blue-50 px-2.5 py-1 rounded-full">
                Target: {selectedInst}
              </span>
              <span className="text-[11px] font-medium text-slate-500 hidden sm:inline">
                {isSelectedCrypto ? '24/7 Cloud Active' : sessions.indian.isOpen ? 'NSE/BSE Live' : sessions.indian.statusLabel}
              </span>
            </div>

            <div className="text-xs text-slate-600 flex items-center gap-1.5 pt-1">
              <Activity className="w-3.5 h-3.5 text-[#3F5BD9] shrink-0" />
              <span>
                {account.last_worker_status === 'AUTO_TRADE_OFF'
                  ? 'Auto Trade is OFF by default. Click Configure to choose an instrument and start.'
                  : account.last_worker_status || 'Cloud Engine Standby'}
              </span>
            </div>

            {liveScanState && account.auto_trade_active && (
              <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-3 pt-0.5 tabular-nums">
                <span>
                  Trend:{' '}
                  <strong className={liveScanState.trendDir === 1 ? 'text-[#0B9D58]' : 'text-[#E53935]'}>
                    {liveScanState.trendDir === 1 ? 'BULLISH' : 'BEARISH'}
                  </strong>
                </span>
                <span>RSI: {liveScanState.rsi}</span>
                <span>Chop: {liveScanState.chopIndex}</span>
                <span>State: {liveScanState.fuelState}</span>
              </div>
            )}
          </div>

          <button
            onClick={onOpenAutoTradeModal}
            className={`shrink-0 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors ${
              account.auto_trade_active
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-[#3F5BD9] hover:bg-[#2D46B8] text-white'
            }`}
          >
            <Power className="w-4 h-4" />
            {account.auto_trade_active ? `Manage Auto Trade (${selectedInst})` : 'Enable Auto Trade'}
          </button>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-card p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm sm:text-base font-bold text-slate-900">Markets &amp; Stocks Watchlist</h2>
          <div className="flex items-center gap-1.5">
            {(['ALL', 'INDICES', 'STOCKS', 'CRYPTO'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setWatchFilter(f)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                  watchFilter === f
                    ? 'bg-blue-50 border-[#3F5BD9] text-[#3F5BD9]'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {f === 'ALL' ? 'All' : f === 'INDICES' ? 'Indices' : f === 'STOCKS' ? 'NSE Stocks' : 'Crypto 24/7'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {watchListQuotes.map((q) => {
            const isCrypto = q.symbol === 'BITCOIN';
            const isPos = (q.net_change || 0) >= 0;
            const unavailable = q.ltp <= 0 || q.data_status === 'UNAVAILABLE';
            const initials = q.symbol.replace('-EQ', '').slice(0, 3);
            const badgeBg = STOCK_COLORS[q.symbol] || (isCrypto ? 'bg-amber-500' : 'bg-[#3F5BD9]');

            return (
              <button
                key={q.symbol}
                onClick={() => onSelectSymbolForChart(q.symbol, q.exchange, q.token, q.display_name)}
                className="p-3 rounded-xl border border-slate-200 hover:border-[#3F5BD9] bg-white text-left transition-all hover:shadow-sm"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className={`w-7 h-7 rounded-full ${badgeBg} text-white text-[10px] font-bold flex items-center justify-center shrink-0`}>
                    {initials}
                  </div>
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      q.data_status === 'LIVE'
                        ? 'bg-emerald-50 text-emerald-700'
                        : q.data_status === 'MARKET_CLOSED'
                        ? 'bg-slate-100 text-slate-600'
                        : 'bg-red-50 text-red-600'
                    }`}
                  >
                    {q.data_status === 'LIVE' ? 'LIVE' : q.data_status === 'MARKET_CLOSED' ? 'CLOSED' : 'N/A'}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-900 truncate">{q.symbol.replace('-EQ', '')}</div>
                <div className="text-[11px] text-slate-500 truncate">{q.display_name}</div>
                <div className="mt-2 tabular-nums">
                  {unavailable ? (
                    <div className="text-xs font-semibold text-slate-400">Unavailable</div>
                  ) : (
                    <>
                      <div className="text-sm font-bold text-slate-900">
                        {isCrypto ? formatUsd(q.ltp) : `₹${formatNumber(q.ltp)}`}
                      </div>
                      <div className={`text-[11px] font-semibold ${isPos ? 'text-[#0B9D58]' : 'text-[#E53935]'}`}>
                        {formatNumber(q.net_change, 2, true)} ({formatNumber(q.percent_change, 2, true)}%)
                      </div>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="bg-white rounded-2xl border border-slate-200 shadow-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-[#3F5BD9]" />
              Active Positions ({openPositions.length})
            </h3>
            <button
              onClick={() => onNavigateTab('positions')}
              className="text-xs font-semibold text-[#3F5BD9] flex items-center gap-0.5 hover:underline"
            >
              View All <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {openPositions.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500">
              No active open positions right now.
            </div>
          ) : (
            <div className="space-y-2.5">
              {openPositions.slice(0, 3).map((pos) => {
                const posPnl = Number(pos.unrealized_pnl || 0);
                const isPos = posPnl >= 0;
                const isCrypto = pos.currency === 'USD';
                const usdPnl =
                  isCrypto && portfolio.usd_inr_rate > 0 ? posPnl / portfolio.usd_inr_rate : 0;
                return (
                  <div
                    key={pos.position_id}
                    className="p-3 rounded-xl border border-slate-100 bg-slate-50/60 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">{pos.symbol}</div>
                      <div className="text-[11px] text-slate-500 tabular-nums">
                        {pos.side} • Avg {isCrypto ? formatUsd(pos.entry_price) : `₹${formatNumber(pos.entry_price)}`} • LTP{' '}
                        {isCrypto ? formatUsd(pos.current_price) : `₹${formatNumber(pos.current_price)}`}
                      </div>
                    </div>
                    <div className="text-right shrink-0 tabular-nums">
                      <div className={`text-xs font-bold ${isPos ? 'text-[#0B9D58]' : 'text-[#E53935]'}`}>
                        {formatInr(posPnl, true)}
                      </div>
                      {isCrypto && (
                        <div className={`text-[10px] font-semibold ${isPos ? 'text-[#0B9D58]' : 'text-[#E53935]'}`}>
                          {formatUsd(usdPnl, true)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 shadow-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#3F5BD9]" />
              Recent Transactions
            </h3>
            <button
              onClick={() => onNavigateTab('orders')}
              className="text-xs font-semibold text-[#3F5BD9] flex items-center gap-0.5 hover:underline"
            >
              View All <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {transactions.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500">
              No transactions recorded yet.
            </div>
          ) : (
            <div className="space-y-2.5">
              {transactions.slice(0, 4).map((tx) => (
                <div
                  key={tx.tx_id}
                  className="p-2.5 rounded-xl border border-slate-100 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">
                      {tx.tx_type} · {tx.symbol}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {formatIstDateTime(tx.created_at)}
                    </div>
                  </div>
                  <div className="text-right tabular-nums shrink-0">
                    <div className="font-semibold text-slate-800">{formatInr(tx.amount)}</div>
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
        </section>
      </div>
    </div>
  );
};
