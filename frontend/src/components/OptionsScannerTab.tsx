import React, { useState, useEffect } from 'react';
import { Layers, RefreshCw, Info } from 'lucide-react';
import { OptionsChainResponse } from '../types';

export const OptionsScannerTab: React.FC = () => {
  const [selectedUnderlying, setSelectedUnderlying] = useState<'NIFTY' | 'BANKNIFTY'>('NIFTY');
  const [chainData, setChainData] = useState<OptionsChainResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

  const fetchChain = async (sym: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/scanner/options?underlying=${sym}`);
      if (res.ok) {
        const data = await res.json();
        setChainData(data);
      }
    } catch (e) {
      console.error('Failed to load options chain:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchChain(selectedUnderlying);
    const interval = setInterval(() => fetchChain(selectedUnderlying), 5000);
    return () => clearInterval(interval);
  }, [selectedUnderlying]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center space-x-2">
            <Layers className="w-5 h-5 text-blue-400" />
            <span>Indian F&O Options Scanner & Greeks</span>
          </h2>
          <p className="text-xs text-brand-muted mt-0.5">
            Real contract specifications (Strike, Expiry, Lot Size, LTP & Delta). Never assumes index moves guarantee options profit.
          </p>
        </div>

        {/* Index Selector */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setSelectedUnderlying('NIFTY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              selectedUnderlying === 'NIFTY'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-brand-surface text-brand-muted border border-brand-border hover:bg-brand-card'
            }`}
          >
            NIFTY 50
          </button>
          <button
            onClick={() => setSelectedUnderlying('BANKNIFTY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              selectedUnderlying === 'BANKNIFTY'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-brand-surface text-brand-muted border border-brand-border hover:bg-brand-card'
            }`}
          >
            BANKNIFTY
          </button>
          <button
            onClick={() => fetchChain(selectedUnderlying)}
            className="p-1.5 bg-brand-surface hover:bg-brand-card text-brand-muted hover:text-white border border-brand-border rounded-lg transition-all"
            title="Refresh Quotes"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>

      {chainData && (
        <div className="bg-brand-surface rounded-xl p-3 border border-brand-border flex items-center justify-between text-xs text-brand-muted">
          <div>
            Spot Price: <strong className="text-white text-sm">₹{chainData.spot_price.toFixed(2)}</strong>
          </div>
          <div>
            ATM Strike: <strong className="text-blue-400 text-sm">₹{chainData.atm_strike}</strong>
          </div>
          <div>
            Lot Size: <strong className="text-white">{chainData.lot_size} Qty</strong>
          </div>
        </div>
      )}

      {/* Options Chain Table */}
      <div className="bg-brand-surface rounded-xl border border-brand-border overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-center text-xs">
            <thead className="bg-brand-card/90 text-brand-muted uppercase text-[10px] tracking-wider border-b border-brand-border">
              <tr>
                <th colSpan={3} className="py-2 px-3 text-emerald-400 border-r border-brand-border">
                  CALL OPTIONS (CE)
                </th>
                <th className="py-2 px-4 text-white bg-brand-card">
                  STRIKE
                </th>
                <th colSpan={3} className="py-2 px-3 text-red-400 border-l border-brand-border">
                  PUT OPTIONS (PE)
                </th>
              </tr>
              <tr className="border-t border-brand-border text-[9px]">
                <th className="py-1 px-2 text-left">Call Symbol</th>
                <th className="py-1 px-2">Delta</th>
                <th className="py-1 px-2 border-r border-brand-border">LTP</th>
                <th className="py-1 px-4 bg-brand-card text-white">Price</th>
                <th className="py-1 px-2 border-l border-brand-border">LTP</th>
                <th className="py-1 px-2">Delta</th>
                <th className="py-1 px-2 text-right">Put Symbol</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border text-gray-200">
              {chainData?.strikes.map((s) => {
                const isAtm = s.is_atm;
                return (
                  <tr
                    key={s.strike}
                    className={`transition-colors ${
                      isAtm ? 'bg-blue-600/15 font-bold' : 'hover:bg-brand-card/30'
                    }`}
                  >
                    <td className="py-2.5 px-2 text-left font-mono text-[11px] text-gray-300">
                      {s.call.symbol}
                    </td>
                    <td className="py-2.5 px-2 text-emerald-400">
                      +{s.call.delta.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-2 font-bold text-white border-r border-brand-border">
                      ₹{s.call.price.toFixed(2)}
                    </td>

                    {/* Strike */}
                    <td className="py-2.5 px-4 bg-brand-card font-black text-white relative">
                      {s.strike}
                      {isAtm && (
                        <span className="absolute right-1 top-2 text-[8px] uppercase bg-blue-500 text-white px-1 rounded">
                          ATM
                        </span>
                      )}
                    </td>

                    <td className="py-2.5 px-2 font-bold text-white border-l border-brand-border">
                      ₹{s.put.price.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-2 text-red-400">
                      {s.put.delta.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-[11px] text-gray-300">
                      {s.put.symbol}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
