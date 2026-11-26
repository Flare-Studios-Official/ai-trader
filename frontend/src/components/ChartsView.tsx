import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Plus,
  X,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Power,
  Layers,
  Activity,
  Play,
  Pause,
  RotateCcw,
  Calendar,
  History,
} from 'lucide-react';
import {
  CandlePoint,
  CandlesResponse,
  ChartTabSpec,
  MainTab,
  OverviewResponse,
  ReplaySession,
} from '../types';
import {
  fetchCandles,
  fetchHistoricalCandles,
  fetchReplaySessions,
  placeManualPaperOrder,
  runHistoricalReplay,
} from '../services/api';
import { TradingViewChart } from './TradingViewChart';
import { formatInr, formatIstDateTime } from '../utils/format';

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

  const isPreviousMarketMode = overview.account.trading_mode === 'PREVIOUS_MARKET';
  const [replaySymbol, setReplaySymbol] = useState<string>(activeTab?.symbol || 'NIFTY');
  const [replayDate, setReplayDate] = useState<string>(overview.sessions.indian.istDateStr);
  const [replayTf, setReplayTf] = useState<string>('5m');
  const [replayAllCandles, setReplayAllCandles] = useState<CandlePoint[]>([]);
  const [replaySessionStartIdx, setReplaySessionStartIdx] = useState<number>(0);
  const [replayCursorIdx, setReplayCursorIdx] = useState<number>(0);
  const [replayPlaying, setReplayPlaying] = useState<boolean>(false);
  const [replaySpeed, setReplaySpeed] = useState<1 | 2 | 5 | 10>(2);
  const [replaySession, setReplaySession] = useState<ReplaySession | null>(null);
  const [replayHistory, setReplayHistory] = useState<ReplaySession[]>([]);
  const [replayLoading, setReplayLoading] = useState<boolean>(false);
  const [replayError, setReplayError] = useState<string | null>(null);

  useEffect(() => {
    if (isPreviousMarketMode) {
      fetchReplaySessions()
        .then((r) => setReplayHistory(r.sessions || []))
        .catch(() => {});
    }
  }, [isPreviousMarketMode]);

  const handleLoadAndRunReplay = async () => {
    setReplayLoading(true);
    setReplayError(null);
    setReplayPlaying(false);
    try {
      const [histRes, runRes] = await Promise.all([
        fetchHistoricalCandles({ symbol: replaySymbol, date: replayDate, timeframe: replayTf }),
        runHistoricalReplay({ symbol: replaySymbol, date: replayDate, timeframe: replayTf }),
      ]);
      if (!histRes.ok || !histRes.candles?.length) {
        setReplayError(histRes.error || 'No historical candles available for selected date');
        return;
      }
      const startSec = histRes.sessionStartSec || 0;
      const firstSessIdx = histRes.candles.findIndex((c) => c.time >= startSec);
      const startIdx = firstSessIdx > 0 ? firstSessIdx : Math.min(30, histRes.candles.length - 1);
      setReplayAllCandles(histRes.candles);
      setReplaySessionStartIdx(startIdx);
      setReplayCursorIdx(startIdx);
      setReplaySession(runRes.session);
      setReplayPlaying(true);
      fetchReplaySessions().then((r) => setReplayHistory(r.sessions || [])).catch(() => {});
    } catch (e: any) {
      setReplayError(e?.message || 'Failed to load historical market replay');
    } finally {
      setReplayLoading(false);
    }
  };

  useEffect(() => {
    if (!isPreviousMarketMode || !replayPlaying || replayAllCandles.length === 0) return;
    const intervalMs = Math.max(80, Math.round(1000 / replaySpeed));
    const iv = setInterval(() => {
      setReplayCursorIdx((prev) => {
        if (prev >= replayAllCandles.length - 1) {
          setReplayPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);
    return () => clearInterval(iv);
  }, [isPreviousMarketMode, replayPlaying, replaySpeed, replayAllCandles.length]);

  const visibleReplayCandles = useMemo(() => {
    if (!replayAllCandles.length) return [];
    return replayAllCandles.slice(0, replayCursorIdx + 1);
  }, [replayAllCandles, replayCursorIdx]);

  const currentReplayBar = visibleReplayCandles[visibleReplayCandles.length - 1] || null;
  const revealedTrades = useMemo(() => {
    if (!replaySession || !currentReplayBar) return [];
    return (replaySession.trades_json || []).filter((t) => t.entryTime <= currentReplayBar.time);
  }, [replaySession, currentReplayBar]);

  const loadCandles = useCallback(
    async (silent = false) => {
      if (!activeTab || isPreviousMarketMode) return;
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

    const pollMs = 1000;
    const iv = setInterval(() => loadCandles(true), pollMs);
    return () => clearInterval(iv);
  }, [loadCandles, activeTab?.symbol]);

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

  if (isPreviousMarketMode) {
    const isReplayComplete = replayAllCandles.length > 0 && replayCursorIdx >= replayAllCandles.length - 1;
    const replaySimTimeStr = currentReplayBar
      ? new Date(currentReplayBar.time * 1000).toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
      : 'Not loaded';

    return (
      <div className="space-y-3">
        <div className="bg-white rounded-2xl border border-indigo-200 shadow-card p-3.5 sm:p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-bold">
                  MODE 1 • PREVIOUS MARKET TRADING
                </span>
                <span className="text-[11px] font-semibold text-slate-500">
                  Chronological Zero-Lookahead Replay
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Test today&apos;s completed Indian market session after school or any past date. AI only sees candles up to the simulated clock.
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('account')}
              className="text-xs font-bold text-[#3F5BD9] hover:underline"
            >
              Switch Mode in Account
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600">Instrument</label>
              <select
                value={replaySymbol}
                onChange={(e) => setReplaySymbol(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-900 bg-white"
              >
                <option value="NIFTY">NIFTY 50 (Options)</option>
                <option value="BANKNIFTY">BANK NIFTY (Options)</option>
                <option value="SENSEX">BSE SENSEX (Options)</option>
                <option value="BANKEX">BSE BANKEX (Options)</option>
                <option value="FINNIFTY">FIN NIFTY (Options)</option>
                <option value="MIDCPNIFTY">MIDCP NIFTY (Options)</option>
                <option value="BITCOIN">BITCOIN (BTC/USDT Spot)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600">Trading Date (IST)</label>
              <div className="relative mt-1">
                <input
                  type="date"
                  value={replayDate}
                  max={overview.sessions.indian.istDateStr}
                  onChange={(e) => setReplayDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-900 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600">Timeframe</label>
              <select
                value={replayTf}
                onChange={(e) => setReplayTf(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-900 bg-white"
              >
                <option value="1m">1m</option>
                <option value="5m">5m (Recommended)</option>
                <option value="15m">15m</option>
                <option value="1h">1h</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                disabled={replayLoading}
                onClick={handleLoadAndRunReplay}
                className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Calendar className="w-3.5 h-3.5" />
                {replayLoading ? 'Loading Session...' : 'Load & Start Replay'}
              </button>
            </div>
          </div>

          {replayAllCandles.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (isReplayComplete) {
                      setReplayCursorIdx(replaySessionStartIdx);
                      setReplayPlaying(true);
                    } else {
                      setReplayPlaying((p) => !p);
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#3F5BD9] hover:bg-[#2D46B8] text-white text-xs font-bold flex items-center gap-1.5"
                >
                  {replayPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  {replayPlaying ? 'Pause' : isReplayComplete ? 'Replay Again' : 'Resume'}
                </button>
                <button
                  onClick={() => {
                    setReplayPlaying(false);
                    setReplayCursorIdx(replaySessionStartIdx);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Restart
                </button>

                <div className="flex items-center gap-1 ml-1">
                  {([1, 2, 5, 10] as const).map((spd) => (
                    <button
                      key={spd}
                      onClick={() => setReplaySpeed(spd)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold ${
                        replaySpeed === spd
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-xs font-semibold text-slate-700 tabular-nums">
                Sim Clock: <span className="text-indigo-700 font-bold">{replaySimTimeStr}</span> ({replayCursorIdx - replaySessionStartIdx + 1} / {replayAllCandles.length - replaySessionStartIdx} bars)
              </div>
            </div>
          )}

          {replayError && (
            <div className="px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
              {replayError}
            </div>
          )}
        </div>

        <TradingViewChart
          symbol={replaySymbol}
          exchange={replaySymbol === 'BITCOIN' ? 'CRYPTO' : 'NSE/BSE'}
          timeframe={replayTf}
          candles={visibleReplayCandles}
          livePrice={currentReplayBar?.close}
          dataStatus={replayAllCandles.length > 0 ? 'MARKET_CLOSED' : 'UNAVAILABLE'}
          error={replayError}
          loading={replayLoading}
        />

        {replaySession && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                Replay Results — {replaySession.symbol} ({replaySession.session_date})
              </h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                Strategy: {replaySession.strategy_version}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[10px] font-bold text-slate-500 uppercase">Net P&amp;L</div>
                <div className={`text-sm font-bold mt-0.5 tabular-nums ${replaySession.net_pnl >= 0 ? 'text-[#0B9D58]' : 'text-[#E53935]'}`}>
                  {formatInr(replaySession.net_pnl)}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[10px] font-bold text-slate-500 uppercase">Total Trades</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5 tabular-nums">
                  {replaySession.total_trades} ({replaySession.wins}W / {replaySession.losses}L)
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[10px] font-bold text-slate-500 uppercase">Win Rate</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5 tabular-nums">{replaySession.win_rate}%</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[10px] font-bold text-slate-500 uppercase">Profit Factor</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5 tabular-nums">{replaySession.profit_factor}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[10px] font-bold text-slate-500 uppercase">Max Drawdown</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5 tabular-nums">{formatInr(replaySession.max_drawdown)}</div>
              </div>
            </div>

            {revealedTrades.length === 0 ? (
              <div className="text-xs text-slate-500 py-2">
                {replaySession.total_trades === 0
                  ? 'AI found 0 high-conviction setups matching quality gates during this session (protected capital).'
                  : 'Trades will appear chronologically as the replay clock reaches each entry.'}
              </div>
            ) : (
              <div className="space-y-2">
                {revealedTrades.map((tr, idx) => (
                  <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 text-xs space-y-1">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-slate-900">
                        {tr.symbol} • {tr.side} ({tr.quantity} qty)
                      </span>
                      <span className={tr.netPnlInr >= 0 ? 'text-[#0B9D58]' : 'text-[#E53935]'}>
                        {tr.netPnlInr >= 0 ? '+' : ''}{formatInr(tr.netPnlInr)}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Entry: {tr.entryPrice} ({formatIstDateTime(new Date(tr.entryTime * 1000).toISOString())}) → Exit: {tr.exitPrice} ({formatIstDateTime(new Date(tr.exitTime * 1000).toISOString())})
                    </div>
                    <div className="text-[11px] text-slate-500">
                      SL: {tr.stopLoss} • TP: {tr.takeProfit} • AI Score: {tr.aiScore}/100 • {tr.exitReason}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {replayHistory.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-4 space-y-2">
            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase">
              <History className="w-3.5 h-3.5 text-[#3F5BD9]" /> Saved Historical Replay Sessions (Permanent)
            </h3>
            <div className="divide-y divide-slate-100">
              {replayHistory.slice(0, 6).map((s) => (
                <div key={s.id} className="py-2 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900">{s.symbol}</span>{' '}
                    <span className="text-slate-500">• {s.session_date} ({s.timeframe}) • {s.total_trades} trades ({s.win_rate}% WR)</span>
                  </div>
                  <span className={`font-bold tabular-nums ${s.net_pnl >= 0 ? 'text-[#0B9D58]' : 'text-[#E53935]'}`}>
                    {s.net_pnl >= 0 ? '+' : ''}{formatInr(s.net_pnl)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

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
