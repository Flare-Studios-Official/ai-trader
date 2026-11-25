import React, { useState } from 'react';
import { X, Power, CheckCircle2, Lock, Sparkles, Search } from 'lucide-react';
import { MarketSessionInfo, PaperAccount } from '../types';

interface AutoTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: PaperAccount;
  indianSession: MarketSessionInfo;
  indexMeta: Record<string, { nearestExpiry: string; expiryDate: string; lotSize: number }>;
  onToggle: (active: boolean, instrument: string) => Promise<void>;
  onOpenSearch: () => void;
}

const INSTRUMENTS = [
  { symbol: 'NIFTY', name: 'NIFTY 50 (Options CE/PE)', type: 'INDIAN' },
  { symbol: 'BANKNIFTY', name: 'BANK NIFTY (Options CE/PE)', type: 'INDIAN' },
  { symbol: 'SENSEX', name: 'BSE SENSEX (Options CE/PE)', type: 'INDIAN' },
  { symbol: 'BANKEX', name: 'BSE BANKEX (Options CE/PE)', type: 'INDIAN' },
  { symbol: 'FINNIFTY', name: 'FIN NIFTY (Options CE/PE)', type: 'INDIAN' },
  { symbol: 'MIDCPNIFTY', name: 'MIDCAP NIFTY (Options CE/PE)', type: 'INDIAN' },
  { symbol: 'BITCOIN', name: 'BITCOIN (BTC/USDT Spot 24/7)', type: 'CRYPTO' },
];

export const AutoTradeModal: React.FC<AutoTradeModalProps> = ({
  isOpen,
  onClose,
  account,
  indianSession,
  indexMeta,
  onToggle,
  onOpenSearch,
}) => {
  const [selected, setSelected] = useState<string>(account.selected_instrument || 'NIFTY');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!isOpen) return null;

  const isSelectedCrypto = selected === 'BITCOIN';
  const isBlockedBySession = !isSelectedCrypto && !indianSession.isOpen;

  const handleEnable = async () => {
    setErr(null);
    setSubmitting(true);
    try {
      await onToggle(true, selected);
      onClose();
    } catch (e: any) {
      setErr(e?.message || 'Failed to enable Auto Trade');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisable = async () => {
    setErr(null);
    setSubmitting(true);
    try {
      await onToggle(false, selected);
      onClose();
    } catch (e: any) {
      setErr(e?.message || 'Failed to disable Auto Trade');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Power className="w-4 h-4 text-[#3F5BD9]" />
              Autonomous Paper Trade Setup
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select the single instrument for 24/7 cloud AI execution
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 text-xs text-slate-700 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-[#3F5BD9] shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-900">Zero Premature Entries:</span> Turning Auto Trade ON does NOT trade immediately. The cloud AI waits for the next newly closed V12 signal, verifies 6 market factors, selects a liquid option or BTC spot size, and trades strictly with virtual balance.
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Choose One Instrument</span>
              <button
                onClick={() => {
                  onClose();
                  onOpenSearch();
                }}
                className="text-xs font-semibold text-[#3F5BD9] hover:underline flex items-center gap-1"
              >
                <Search className="w-3 h-3" /> Pick NSE Equity Stock
              </button>
            </div>

            {INSTRUMENTS.map((inst) => {
              const isCrypto = inst.type === 'CRYPTO';
              const disabled = !isCrypto && !indianSession.isOpen;
              const isSel = selected === inst.symbol;
              const lotInfo = indexMeta[inst.symbol]?.lotSize;

              return (
                <button
                  key={inst.symbol}
                  onClick={() => {
                    setSelected(inst.symbol);
                    setErr(null);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left transition-all ${
                    isSel
                      ? 'bg-blue-50/60 border-[#3F5BD9] ring-1 ring-[#3F5BD9]'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  } ${disabled ? 'opacity-65' : ''}`}
                >
                  <div>
                    <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      {inst.symbol}
                      {lotInfo ? (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          Lot {lotInfo}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-slate-500">{inst.name}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isCrypto ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        24/7 LIVE
                      </span>
                    ) : indianSession.isOpen ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        OPEN
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Closed
                      </span>
                    )}
                    {isSel && <CheckCircle2 className="w-4 h-4 text-[#3F5BD9]" />}
                  </div>
                </button>
              );
            })}

            {!INSTRUMENTS.some((i) => i.symbol === selected) && (
              <div className="px-3.5 py-2.5 rounded-xl bg-blue-50/60 border border-[#3F5BD9] flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-900">{selected}</div>
                  <div className="text-xs text-slate-500">Custom NSE Equity Selection</div>
                </div>
                <CheckCircle2 className="w-4 h-4 text-[#3F5BD9]" />
              </div>
            )}
          </div>

          {err && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
              {err}
            </div>
          )}

          <div className="flex items-center gap-2.5 pt-2">
            {account.auto_trade_active && (
              <button
                disabled={submitting}
                onClick={handleDisable}
                className="flex-1 py-2.5 rounded-xl border border-red-300 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-bold transition-colors disabled:opacity-50"
              >
                Turn Auto Trade OFF
              </button>
            )}
            <button
              disabled={submitting || isBlockedBySession}
              onClick={handleEnable}
              className="flex-1 py-2.5 rounded-xl bg-[#3F5BD9] hover:bg-[#2D46B8] text-white text-sm font-bold transition-colors disabled:bg-slate-200 disabled:text-slate-500"
            >
              {submitting
                ? 'Updating Cloud...'
                : isBlockedBySession
                ? `Indian Market Closed (${indianSession.statusLabel})`
                : account.auto_trade_active && account.selected_instrument === selected
                ? `Active on ${selected}`
                : `Start Auto Trade (${selected})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
