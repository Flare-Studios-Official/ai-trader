import React, { useEffect, useState, useCallback } from 'react';
import {
  Briefcase,
  Layers,
  XCircle,
  Brain,
  CandlestickChart,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import {
  AISignalRecord,
  MainTab,
  OptionContractQuote,
  OptionsChainResponse,
  OverviewResponse,
  PositionsSubTab,
} from '../types';
import { closePosition, fetchOptionsChain, placeManualPaperOrder } from '../services/api';
import { formatInr, formatIstDateTime, formatNumber, formatUsd } from '../utils/format';

interface PositionsViewProps {
  overview: OverviewResponse;
  subTab: PositionsSubTab;
  chainUnderlying: string;
  onChangeSubTab: (sub: PositionsSubTab) => void;
  onChangeChainUnderlying: (u: string) => void;
  onNavigateTab: (tab: MainTab) => void;
  onSelectSymbolForChart: (symbol: string, exchange: string, token: string, label?: string) => void;
  onInspectSignal: (sig: AISignalRecord) => void;
  onRefreshOverview: () => void;
}

const UNDERLYINGS = ['NIFTY', 'BANKNIFTY', 'SENSEX', 'BANKEX', 'FINNIFTY', 'MIDCPNIFTY'];

export const PositionsView: React.FC<PositionsViewProps> = ({
  overview,
  subTab,
  chainUnderlying,
  onChangeSubTab,
  onChangeChainUnderlying,
  onNavigateTab,
  onSelectSymbolForChart,
  onInspectSignal,
  onRefreshOverview,
}) => {
  const { openPositions, portfolio, indexMeta } = overview;
  const [closingId, setClosingId] = useState<string | null>(null);
  const [chainData, setChainData] = useState<OptionsChainResponse | null>(null);
  const [selectedExpiry, setSelectedExpiry] = useState<string>('');
  const [chainLoading, setChainLoading] = useState(false);
  const [chainError, setChainError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; msg: string } | null>(null);

  const loadOptionChain = useCallback(
    async (silent = false) => {
      if (subTab !== 'chain') return;
      if (!silent) setChainLoading(true);
      setChainError(null);
      try {
        const res = await fetchOptionsChain(chainUnderlying, selectedExpiry || undefined);
        setChainData(res);
      } catch (e: any) {
        setChainError(e?.message || 'Unable to load Angel One Option Chain');
      } finally {
        if (!silent) setChainLoading(false);
      }
    },
    [subTab, chainUnderlying, selectedExpiry]
  );

  useEffect(() => {
    setSelectedExpiry('');
  }, [chainUnderlying]);

  useEffect(() => {
    if (subTab === 'chain') {
      loadOptionChain(false);
      const iv = setInterval(() => loadOptionChain(true), overview.sessions.indian.isOpen ? 3000 : 20000);
      return () => clearInterval(iv);
    }
  }, [subTab, loadOptionChain, overview.sessions.indian.isOpen]);

  const handleClose = async (posId: string) => {
    setClosingId(posId);
    setNotice(null);
    try {
      await closePosition(posId, false);
      setNotice({ ok: true, msg: 'Position closed cleanly at live market rate.' });
      onRefreshOverview();
    } catch (e: any) {
      setNotice({ ok: false, msg: e?.message || 'Failed to close position' });
    } finally {
      setClosingId(null);
    }
  };

  const handleCloseAll = async () => {
    setClosingId('ALL');
    setNotice(null);
    try {
      await closePosition(undefined, true);
      setNotice({ ok: true, msg: 'All open positions squared off.' });
      onRefreshOverview();
    } catch (e: any) {
      setNotice({ ok: false, msg: e?.message || 'Square-off failed' });
    } finally {
      setClosingId(null);
    }
  };

  const handleBuyContract = async (c: OptionContractQuote) => {
    setNotice(null);
    try {
      const res = await placeManualPaperOrder({
        underlying: chainUnderlying,
        direction: c.optionType === 'CE' ? 'BUY_CE' : 'BUY_PE',
        token: c.token,
        exchange: c.exchange,
        option_symbol: c.symbol,
        strike: c.strike,
        expiry: c.expiry,
        lot_size: c.lotSize,
      });
      setNotice({ ok: true, msg: `Opened paper contract ${c.symbol} (${res.positionId})` });
      onChangeSubTab('positions');
      onRefreshOverview();
    } catch (e: any) {
      setNotice({ ok: false, msg: e?.message || 'Contract entry failed' });
    }
  };

  const totalOpenPnl = portfolio.open_unrealized_pnl || 0;

  return (
    <div className="space-y-4 pb-12">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card px-4 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onChangeSubTab('positions')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
              subTab === 'positions'
                ? 'bg-[#3F5BD9] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            Positions ({openPositions.length})
          </button>
          <button
            onClick={() => onChangeSubTab('chain')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
              subTab === 'chain'
                ? 'bg-[#3F5BD9] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Option Chain
          </button>
        </div>

        {subTab === 'positions' && openPositions.length > 0 && (
          <button
            disabled={closingId === 'ALL'}
            onClick={handleCloseAll}
            className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-bold"
          >
            Exit All
          </button>
        )}
      </div>

      {notice && (
        <div
          className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold border ${
            notice.ok
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {notice.msg}
        </div>
      )}

      {subTab === 'positions' ? (
        openPositions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card py-16 px-6 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#3F5BD9] mb-4">
              <Briefcase className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No Open Positions</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              Open a paper option contract, spot trade, or enable Auto Trade on your selected instrument.
            </p>
            <div className="flex items-center gap-2.5 mt-5">
              <button
                onClick={() => onNavigateTab('charts')}
                className="px-4 py-2 rounded-xl border border-[#3F5BD9] text-[#3F5BD9] hover:bg-blue-50 text-xs font-bold tracking-wide uppercase"
              >
                View Charts
              </button>
              <button
                onClick={() => onChangeSubTab('chain')}
                className="px-4 py-2 rounded-xl bg-[#3F5BD9] hover:bg-[#2D46B8] text-white text-xs font-bold tracking-wide uppercase"
              >
                Option Chain
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {openPositions.map((pos) => {
              const unreal = Number(pos.unrealized_pnl || 0);
              const isPos = unreal >= 0;
              const isCrypto = pos.currency === 'USD';
              const usdUnreal =
                isCrypto && portfolio.usd_inr_rate > 0 ? unreal / portfolio.usd_inr_rate : 0;

              return (
                <div
                  key={pos.position_id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-card p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900">{pos.symbol}</span>
                        {pos.option_type && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              pos.option_type === 'CE'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-red-50 text-red-700'
                            }`}
                          >
                            {pos.option_type}
                          </span>
                        )}
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {pos.side} • {isCrypto ? `${pos.quantity} BTC` : `${pos.lots} Lot (${pos.quantity} qty)`}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Opened {formatIstDateTime(pos.opened_at)} {pos.expiry_date ? `• Exp ${pos.expiry_date}` : ''}
                      </div>
                    </div>

                    <div className="text-right tabular-nums shrink-0">
                      <div className={`text-base font-bold ${isPos ? 'text-[#0B9D58]' : 'text-[#E53935]'}`}>
                        {formatInr(unreal, true)}
                      </div>
                      {isCrypto && (
                        <div className={`text-xs font-semibold ${isPos ? 'text-[#0B9D58]' : 'text-[#E53935]'}`}>
                          {formatUsd(usdUnreal, true)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2 border-t border-slate-100 text-xs tabular-nums">
                    <div>
                      <div className="text-slate-500 text-[10px]">Entry Avg</div>
                      <div className="font-semibold text-slate-900">
                        {isCrypto ? formatUsd(pos.entry_price) : `₹${formatNumber(pos.entry_price)}`}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[10px]">Live LTP</div>
                      <div className="font-bold text-[#3F5BD9]">
                        {isCrypto ? formatUsd(pos.current_price) : `₹${formatNumber(pos.current_price)}`}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[10px]">Invested</div>
                      <div className="font-semibold text-slate-900">{formatInr(pos.invested_amount)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[10px]">Stop-Loss</div>
                      <div className="font-semibold text-[#E53935]">
                        {isCrypto ? formatUsd(pos.stop_loss) : `₹${formatNumber(pos.stop_loss)}`}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[10px]">Target</div>
                      <div className="font-semibold text-[#0B9D58]">
                        {isCrypto ? formatUsd(pos.take_profit) : `₹${formatNumber(pos.take_profit)}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          onSelectSymbolForChart(pos.symbol, pos.exchange, pos.instrument_token, pos.symbol)
                        }
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1"
                      >
                        <CandlestickChart className="w-3.5 h-3.5" /> Chart
                      </button>
                      {pos.decision_chain?.ai && (
                        <button
                          onClick={() =>
                            onInspectSignal({
                              id: pos.position_id,
                              symbol: pos.underlying,
                              exchange: pos.exchange,
                              timeframe: '5m',
                              bar_timestamp: pos.opened_at,
                              v12_signal: pos.side.includes('PE') || pos.side === 'SELL' ? 'SELL' : 'BUY',
                              v12_confidence: pos.decision_chain?.v12?.confidence || pos.ai_score,
                              spot_price: pos.decision_chain?.v12?.closePrice || pos.entry_price,
                              ai_decision: 'APPROVED',
                              ai_score: pos.ai_score || 0,
                              ai_reason: pos.entry_reason,
                              selected_option_symbol: pos.symbol,
                              selected_option_token: pos.instrument_token,
                              selected_option_ltp: pos.entry_price,
                              lot_size: pos.lot_size,
                              factor_breakdown: pos.decision_chain?.ai?.breakdown || {},
                              warnings: pos.decision_chain?.ai?.warnings || [],
                              data_source: pos.data_source,
                              created_at: pos.opened_at,
                            })
                          }
                          className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#3F5BD9] text-xs font-semibold flex items-center gap-1"
                        >
                          <Brain className="w-3.5 h-3.5" /> AI Brain ({pos.ai_score})
                        </button>
                      )}
                    </div>

                    <button
                      disabled={closingId === pos.position_id}
                      onClick={() => handleClose(pos.position_id)}
                      className="px-3.5 py-1.5 rounded-lg bg-[#E53935] hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      {closingId === pos.position_id ? 'Closing...' : 'Square Off'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          <div className="p-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {UNDERLYINGS.map((u) => (
                <button
                  key={u}
                  onClick={() => onChangeChainUnderlying(u)}
                  className={`px-3 py-1 rounded-full text-xs font-bold border shrink-0 ${
                    chainUnderlying === u
                      ? 'bg-[#3F5BD9] border-[#3F5BD9] text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {u} {indexMeta[u] ? `(${indexMeta[u].lotSize})` : ''}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {chainData && chainData.expiries.length > 0 && (
                <select
                  value={selectedExpiry || chainData.chosenExpiry}
                  onChange={(e) => setSelectedExpiry(e.target.value)}
                  className="text-xs font-semibold border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-800 outline-none"
                >
                  {chainData.expiries.map((e) => (
                    <option key={e.expiryDate} value={e.expiryDate}>
                      {e.expiry} ({e.expiryDate})
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={() => loadOptionChain(false)}
                className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                <RefreshCw className={`w-4 h-4 ${chainLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {chainError ? (
            <div className="p-8 text-center">
              <AlertCircle className="w-7 h-7 text-amber-500 mx-auto mb-2" />
              <div className="text-sm font-bold text-slate-900">Option Chain Unavailable</div>
              <p className="text-xs text-slate-500 mt-1">{chainError}</p>
            </div>
          ) : chainLoading && !chainData ? (
            <div className="p-8 text-center text-xs text-slate-500 animate-pulse">
              Fetching live {chainUnderlying} option contracts from Angel One...
            </div>
          ) : chainData ? (
            <>
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
                <div>
                  <span className="text-slate-500">Spot:</span>{' '}
                  <strong className="text-slate-900">{formatNumber(chainData.spotPrice)}</strong>
                  <span className="mx-2 text-slate-300">|</span>
                  <span className="text-slate-500">ATM:</span>{' '}
                  <strong className="text-[#3F5BD9]">{chainData.atmStrike}</strong>
                  <span className="mx-2 text-slate-300">|</span>
                  <span className="text-slate-500">Lot Size:</span>{' '}
                  <strong className="text-slate-900">{chainData.lotSize} qty</strong>
                </div>
                <span className="text-[11px] font-semibold text-slate-500">
                  Source: {chainData.source} ({chainData.dataStatus})
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Call OI / Vol</th>
                      <th className="py-2.5 px-2 text-right">Call LTP</th>
                      <th className="py-2.5 px-2 text-center">CE</th>
                      <th className="py-2.5 px-3 text-center bg-slate-100 text-slate-800">Strike</th>
                      <th className="py-2.5 px-2 text-center">PE</th>
                      <th className="py-2.5 px-2 text-right">Put LTP</th>
                      <th className="py-2.5 px-3 text-right">Put OI / Vol</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 tabular-nums">
                    {chainData.chain.map((row) => {
                      const isAtm = row.strike === chainData.atmStrike;
                      const ce = row.ce;
                      const pe = row.pe;
                      return (
                        <tr key={row.strike} className={isAtm ? 'bg-blue-50/50' : 'hover:bg-slate-50'}>
                          <td className="py-2 px-3 text-[11px] text-slate-500">
                            {ce ? `${ce.oi.toLocaleString()} / ${ce.volume.toLocaleString()}` : '—'}
                          </td>
                          <td className="py-2 px-2 text-right">
                            {ce && ce.ltp > 0 ? (
                              <button
                                onClick={() => onSelectSymbolForChart(ce.symbol, ce.exchange, ce.token, `${row.strike} CE`)}
                                className="font-bold text-slate-900 hover:text-[#3F5BD9] underline decoration-dotted"
                              >
                                ₹{formatNumber(ce.ltp)}
                              </button>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-center">
                            {ce && ce.ltp > 0 && (
                              <button
                                onClick={() => handleBuyContract(ce)}
                                className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 text-[10px] font-bold transition-colors"
                              >
                                Buy CE
                              </button>
                            )}
                          </td>
                          <td className={`py-2 px-3 text-center font-bold ${isAtm ? 'bg-blue-100/70 text-[#3F5BD9]' : 'bg-slate-50 text-slate-900'}`}>
                            {row.strike}
                          </td>
                          <td className="py-2 px-2 text-center">
                            {pe && pe.ltp > 0 && (
                              <button
                                onClick={() => handleBuyContract(pe)}
                                className="px-2 py-1 rounded bg-red-50 hover:bg-red-600 text-red-700 hover:text-white border border-red-200 text-[10px] font-bold transition-colors"
                              >
                                Buy PE
                              </button>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right">
                            {pe && pe.ltp > 0 ? (
                              <button
                                onClick={() => onSelectSymbolForChart(pe.symbol, pe.exchange, pe.token, `${row.strike} PE`)}
                                className="font-bold text-slate-900 hover:text-[#3F5BD9] underline decoration-dotted"
                              >
                                ₹{formatNumber(pe.ltp)}
                              </button>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right text-[11px] text-slate-500">
                            {pe ? `${pe.oi.toLocaleString()} / ${pe.volume.toLocaleString()}` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      )}

      {subTab === 'positions' && (
        <div className="bg-[#FEF9EC] border border-amber-200 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs shadow-sm">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <span className="w-4 h-4 rounded-full bg-amber-400 text-white text-[10px] flex items-center justify-center">
              ✓
            </span>
            Total Open P&amp;L
          </div>
          <div
            className={`font-bold text-sm tabular-nums ${
              totalOpenPnl >= 0 ? 'text-[#0B9D58]' : 'text-[#E53935]'
            }`}
          >
            {formatInr(totalOpenPnl, true)}
          </div>
        </div>
      )}
    </div>
  );
};
