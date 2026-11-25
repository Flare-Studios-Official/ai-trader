import React from 'react';
import {
  Search,
  Power,
  ShieldCheck,
  User,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { MarketQuote, MarketSessionInfo, PaperAccount } from '../types';
import { formatNumber } from '../utils/format';

interface TopHeaderProps {
  account: PaperAccount;
  quotes: MarketQuote[];
  indexMeta: Record<string, { nearestExpiry: string; expiryDate: string; lotSize: number }>;
  indianSession: MarketSessionInfo;
  angelConnected: boolean;
  onOpenSearch: () => void;
  onOpenAutoTradeModal: () => void;
  onSelectSymbolForChart: (symbol: string, exchange: string, token: string, label?: string) => void;
  onGoAccount: () => void;
}

const CORE_TICKER_ORDER = ['NIFTY', 'SENSEX', 'BANKNIFTY', 'BANKEX', 'MIDCPNIFTY', 'FINNIFTY', 'BITCOIN'];

export const TopHeader: React.FC<TopHeaderProps> = ({
  account,
  quotes,
  indexMeta,
  indianSession,
  angelConnected,
  onOpenSearch,
  onOpenAutoTradeModal,
  onSelectSymbolForChart,
  onGoAccount,
}) => {
  const quoteMap = new Map<string, MarketQuote>();
  for (const q of quotes) quoteMap.set(q.symbol, q);

  const selectedLabel = account.selected_instrument || 'NIFTY';

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-3 sm:px-5 py-2.5 flex items-center gap-2.5 sm:gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-[#3F5BD9] flex items-center justify-center text-white font-bold text-sm shadow-sm">
            AI
          </div>
          <div className="hidden md:flex flex-col">
            <span className="text-sm font-bold text-slate-900 leading-none">AI Trader</span>
            <span className="text-[10px] font-semibold text-emerald-700 mt-0.5 flex items-center gap-0.5">
              <ShieldCheck className="w-3 h-3" /> Paper Only
            </span>
          </div>
        </div>

        <button
          onClick={onOpenSearch}
          className="flex-1 flex items-center gap-2.5 bg-[#F4F6FA] hover:bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2 text-left transition-colors min-w-0"
        >
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-xs sm:text-sm text-slate-500 truncate">
            Search for &apos;Nifty, Banknifty, Sensex, Reliance, Bitcoin&apos;
          </span>
        </button>

        <button
          onClick={onOpenAutoTradeModal}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
            account.auto_trade_active
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-sm'
              : 'bg-white border-slate-300 text-slate-700 hover:border-[#3F5BD9] hover:text-[#3F5BD9]'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              account.auto_trade_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
            }`}
          />
          <Power className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Auto Trade:</span>
          <span>{account.auto_trade_active ? `ON (${selectedLabel})` : 'OFF'}</span>
        </button>

        <button
          onClick={onGoAccount}
          title="Account & Controls"
          className="w-9 h-9 rounded-full bg-slate-100 hover:bg-blue-50 border border-slate-200 flex items-center justify-center text-[#3F5BD9] shrink-0 transition-colors"
        >
          <User className="w-4 h-4" />
        </button>
      </div>

      <div className="bg-slate-50/70 border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-3 sm:px-5 py-1.5 flex items-center justify-between gap-2 text-[11px] border-b border-slate-100">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${
                indianSession.isOpen
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}
            >
              <Clock className="w-3 h-3" />
              {indianSession.message}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold bg-blue-50 text-[#3F5BD9] border border-blue-200">
              BTC/USDT 24/7 Live
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0 text-slate-500 font-medium">
            {!angelConnected && (
              <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                <AlertCircle className="w-3 h-3" /> Angel Data Unavailable
              </span>
            )}
            <span className="tabular-nums">IST {indianSession.istTimeStr}</span>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-3 sm:px-5 py-2 flex items-center gap-4 overflow-x-auto no-scrollbar bg-white">
          {CORE_TICKER_ORDER.map((sym) => {
            const q = quoteMap.get(sym);
            const meta = indexMeta[sym];
            const isCrypto = sym === 'BITCOIN';
            const ltp = q?.ltp || 0;
            const chg = q?.net_change || 0;
            const pct = q?.percent_change || 0;
            const isPos = chg >= 0;
            const unavailable = !q || ltp <= 0 || q.data_status === 'UNAVAILABLE';

            return (
              <button
                key={sym}
                onClick={() =>
                  onSelectSymbolForChart(
                    sym,
                    q?.exchange || (isCrypto ? 'CRYPTO' : sym === 'SENSEX' || sym === 'BANKEX' ? 'BSE' : 'NSE'),
                    q?.token || '',
                    q?.display_name || sym
                  )
                }
                className="flex flex-col items-start shrink-0 pr-4 border-r border-slate-100 last:border-r-0 hover:opacity-80 transition-opacity text-left"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-800 tracking-tight">
                    {isCrypto ? 'BTC/USDT' : sym}
                  </span>
                  {isCrypto ? (
                    <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-blue-50 text-[#3F5BD9]">
                      24/7
                    </span>
                  ) : meta ? (
                    <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-500">
                      Exp {meta.nearestExpiry.slice(0, 5)}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 tabular-nums">
                  {unavailable ? (
                    <span className="text-xs font-semibold text-slate-400">Unavailable</span>
                  ) : (
                    <>
                      <span className={`text-xs font-bold ${isPos ? 'text-[#0B9D58]' : 'text-[#E53935]'}`}>
                        {isCrypto ? `$${formatNumber(ltp, 2)}` : formatNumber(ltp, 2)}
                      </span>
                      <span className={`inline-flex items-center text-[10px] font-medium ${isPos ? 'text-[#0B9D58]' : 'text-[#E53935]'}`}>
                        {isPos ? <TrendingUp className="w-2.5 h-2.5 mr-0.5" /> : <TrendingDown className="w-2.5 h-2.5 mr-0.5" />}
                        {formatNumber(chg, 2, true)} ({formatNumber(pct, 2, true)}%)
                      </span>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
