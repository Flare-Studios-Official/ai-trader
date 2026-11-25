import React, { useEffect, useState } from 'react';
import { Search, X, CandlestickChart, Power } from 'lucide-react';
import { SearchInstrumentItem } from '../types';
import { searchInstruments } from '../services/api';

interface InstrumentSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectForChart: (item: SearchInstrumentItem) => void;
  onSelectForAutoTrade: (symbol: string) => void;
}

export const InstrumentSearchModal: React.FC<InstrumentSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectForChart,
  onSelectForAutoTrade,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchInstrumentItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const rows = await searchInstruments(query);
        if (!cancelled) setResults(rows);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] flex items-start justify-center p-3 sm:pt-14">
      <div className="bg-white w-full max-w-xl rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
        <div className="p-3.5 border-b border-slate-100 flex items-center gap-2.5">
          <Search className="w-4 h-4 text-[#3F5BD9] shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search NIFTY, BANKNIFTY, SENSEX, RELIANCE-EQ, HDFC, BITCOIN, or 26200CE..."
            className="flex-1 text-sm text-slate-900 placeholder:text-slate-400 outline-none bg-transparent"
            autoFocus
          />
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto divide-y divide-slate-100">
          {loading ? (
            <div className="p-6 text-center text-xs text-slate-500">Searching Angel One ScripMaster...</div>
          ) : results.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">No matching contracts or stocks found.</div>
          ) : (
            results.map((item) => (
              <div
                key={`${item.exchange}:${item.token}:${item.symbol}`}
                className="px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 truncate">{item.symbol}</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {item.exchange}
                    </span>
                    {item.optionType && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          item.optionType === 'CE' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {item.optionType}
                      </span>
                    )}
                    {item.lotsize && item.lotsize > 1 && (
                      <span className="text-[10px] text-slate-500">Lot {item.lotsize}</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{item.name}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => {
                      onSelectForChart(item);
                      onClose();
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#3F5BD9] text-xs font-semibold flex items-center gap-1"
                  >
                    <CandlestickChart className="w-3.5 h-3.5" /> Chart
                  </button>
                  {item.instrumenttype !== 'OPTIDX' && (
                    <button
                      onClick={() => {
                        onSelectForAutoTrade(item.symbol);
                        onClose();
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-[#3F5BD9] text-slate-700 text-xs font-semibold flex items-center gap-1"
                    >
                      <Power className="w-3 h-3" /> Auto
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
