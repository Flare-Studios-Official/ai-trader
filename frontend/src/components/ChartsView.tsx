import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  X,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Power,
  Layers,
  Activity,
} from 'lucide-react';
import {
  CandlesResponse,
  ChartTabSpec,
  MainTab,
  OverviewResponse,
} from '../types';
import { fetchCandles, placeManualPaperOrder } from '../services/api';
import { TradingViewChart } from './TradingViewChart';

interface ChartsViewProps {
  overview: OverviewResponse;
  tabs: ChartTabSpec[];
  activeTabId: string;
  onSelectChartTab: (id: string) => void;
  onCloseChartTab: (id: string) => void;
  onOpenSearch: () => void;
  onNavigateTab: (tab: MainTab) => void;
  onGoOptionChain: (underlying: string) => void;
  onToggleAutoTradeModal: () => void;
  onRefreshOverview: () => void;
}

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '1D'];

export const ChartsView: React.FC<ChartsViewProps> = ({
  overview,
  tabs,
  activeTabId,
  onSelectChartTab,
  onCloseChartTab,
  onOpenSearch,
  onNavigateTab,
  onGoOptionChain,
  onToggleAutoTradeModal,
  onRefreshOverview,
}) => {
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const [timeframe, setTimeframe] = useState<string>(overview.account.selected_timeframe || '5m');
  const [candleData, setCandleData] = useState<CandlesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [orderNotice, setOrderNotice] = useState<{ ok: boolean; msg: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadCandles = useCallback(
    async (silent = false) => {
      if (!activeTab) return;
      if (!silent) setLoading(true);
      try {
        const res = await fetchCandles({
          symbol: activeTab.symbol,
          timeframe,
          exchange: activeTab.exchange,
          token: activeTab.token,
        });
        setCandleData(res);
      } catch (e: any) {
        if (!silent) {
          setCandleData({
            ok: false,
            error: e?.message || 'Unable to load chart candles',
            symbol: activeTab.symbol,
            timeframe,
            candles: [],
          });
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [activeTab?.symbol, activeTab?.exchange, activeTab?.token, timeframe]
  );

  useEffect(() => {
    setCandleData(null);
    setOrderNotice(null);
    loadCandles(false);

    const pollMs = activeTab?.symbol === 'BITCOIN' ? 2000 : overview.sessions.indian.isOpen ? 2500 : 15000;
    const iv = setInterval(() => loadCandles(true), pollMs);
    return () => clearInterval(iv);
  }, [loadCandles, activeTab?.symbol, overview.sessions.indian.isOpen]);

  const isCrypto = activeTab?.symbol === 'BITCOIN';
  const isOptionContract = activeTab?.exchange === 'NFO' || activeTab?.exchange === 'BFO';
  const isIndex = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX', 'BANKEX'].includes(
    activeTab?.symbol || ''
  );

  const handleQuickPaperOrder = async (direction: 'BUY' | 'SELL' | 'BUY_CE' | 'BUY_PE') => {
    if (!activeTab) return;
    setSubmitting(true);
    setOrderNotice(null);
    try {
      const payload = isOptionContract
        ? {
            underlying: activeTab.symbol.replace(/\d.*/, '') || 'NIFTY',
            direction: 'BUY' as const,
            token: activeTab.token,
            exchange: activeTab.exchange,
            option_symbol: activeTab.symbol,
          }
        : {
            underlying: activeTab.symbol,
            direction,
          };
      const res = await placeManualPaperOrder(payload);
      setOrderNotice({
        ok: true,
        msg: `Paper position opened: ${res.candidate?.symbol || activeTab.symbol} (${res.positionId})`,
      });
      onRefreshOverview();
    } catch (e: any) {
      setOrderNotice({ ok: false, msg: e?.message || 'Order failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const v12 = candleData?.v12Summary;

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const isAct = tab.id === activeTab?.id;
          return (
            <div
              key={tab.id}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                isAct
                  ? 'bg-blue-50 border-[#3F5BD9] text-[#3F5BD9]'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
              onClick={() => onSelectChartTab(tab.id)}
            >
              <span>{tab.label}</span>
              {tab.subLabel && <span className="text-[10px] opacity-75">{tab.subLabel}</span>}
              {tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseChartTab(tab.id);
                  }}
                  className="p-0.5 rounded hover:bg-white text-slate-400 hover:text-slate-700"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        <button
          onClick={onOpenSearch}
          className="shrink-0 px-2.5 py-1.5 rounded-xl border border-dashed border-slate-300 text-xs font-semibold text-[#3F5BD9] hover:bg-blue-50 flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Add Chart
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-card px-3.5 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                timeframe === tf
                  ? 'bg-[#3F5BD9] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {v12 && (
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px]">
              <Activity className="w-3.5 h-3.5 text-[#3F5BD9]" />
              <span className="text-slate-500">V12 Bias:</span>
              <strong className={v12.trendDir === 1 ? 'text-[#0B9D58]' : 'text-[#E53935]'}>
                {v12.trendDir === 1 ? 'BULLISH' : 'BEARISH'}
              </strong>
              <span className="text-slate-400">•</span>
              <span className="text-slate-600 tabular-nums">RSI {v12.rsi}</span>
            </div>
          )}

          <button
            onClick={onToggleAutoTradeModal}
            className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:border-[#3F5BD9] hover:text-[#3F5BD9] flex items-center gap-1"
          >
            <Power className="w-3.5 h-3.5" /> Auto Trade
          </button>

          <button
            onClick={() => loadCandles(false)}
            title="Reload Chart"
            className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <TradingViewChart
        symbol={activeTab?.symbol || 'NIFTY'}
        exchange={candleData?.exchange || activeTab?.exchange}
        timeframe={timeframe}
        candles={candleData?.candles || []}
        livePrice={candleData?.livePrice}
        change={candleData?.change}
        changePct={candleData?.changePct}
        dataStatus={candleData?.dataStatus}
        error={candleData?.ok === false ? candleData.error : null}
        loading={loading}
      />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="px-3 py-1 rounded-full bg-blue-50 border border-[#3F5BD9] text-[#3F5BD9] text-xs font-bold">
              Paper Trade
            </span>
            <button
              onClick={() => onNavigateTab('positions')}
              className="px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold"
            >
              Positions ({overview.openPositions.length})
            </button>
            {isIndex && (
              <button
                onClick={() => onGoOptionChain(activeTab.symbol)}
                className="px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1"
              >
                <Layers className="w-3.5 h-3.5 text-[#3F5BD9]" /> Option Chain ↗
              </button>
            )}
          </div>
          <span className="text-[11px] text-slate-500">
            Allocation: {overview.account.capital_allocation_mode} • Strict Paper Execution
          </span>
        </div>

        {orderNotice && (
          <div
            className={`px-3 py-2 rounded-xl text-xs font-semibold border ${
              orderNotice.ok
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            {orderNotice.msg}
          </div>
        )}

        {isIndex ? (
          <div className="grid grid-cols-2 gap-3">
            <button
              disabled={submitting}
              onClick={() => handleQuickPaperOrder('BUY_CE')}
              className="py-3 rounded-xl bg-[#0B9D58] hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <ArrowUp className="w-4 h-4" /> BUY CALL
            </button>
            <button
              disabled={submitting}
              onClick={() => handleQuickPaperOrder('BUY_PE')}
              className="py-3 rounded-xl bg-[#E53935] hover:bg-red-700 text-white font-bold text-sm flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <ArrowDown className="w-4 h-4" /> BUY PUT
            </button>
          </div>
        ) : isOptionContract ? (
          <button
            disabled={submitting}
            onClick={() => handleQuickPaperOrder('BUY')}
            className="w-full py-3 rounded-xl bg-[#3F5BD9] hover:bg-[#2D46B8] text-white font-bold text-sm transition-colors disabled:opacity-50"
          >
            BUY OPTION PAPER CONTRACT ({activeTab.symbol})
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              disabled={submitting}
              onClick={() => handleQuickPaperOrder('BUY')}
              className="py-3 rounded-xl bg-[#0B9D58] hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <ArrowUp className="w-4 h-4" /> {isCrypto ? 'BUY BTC (PAPER)' : 'BUY STOCK (PAPER)'}
            </button>
            <button
              disabled={submitting}
              onClick={() => handleQuickPaperOrder('SELL')}
              className="py-3 rounded-xl bg-[#E53935] hover:bg-red-700 text-white font-bold text-sm flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <ArrowDown className="w-4 h-4" /> {isCrypto ? 'SELL BTC (PAPER)' : 'SELL STOCK (PAPER)'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
