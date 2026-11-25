import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
  TickMarkType,
} from 'lightweight-charts';
import { ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { CandlePoint } from '../types';
import { formatNumber } from '../utils/format';

interface TradingViewChartProps {
  symbol: string;
  exchange?: string;
  timeframe: string;
  candles: CandlePoint[];
  livePrice?: number;
  change?: number;
  changePct?: number;
  dataStatus?: string;
  error?: string | null;
  loading?: boolean;
}

function formatIstTick(time: unknown, timeframe: string): string {
  if (typeof time !== 'number') return String(time ?? '');
  const d = new Date(time * 1000);
  if (timeframe === '1D') {
    return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' });
  }
  return d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatIstCrosshair(time: unknown): string {
  if (typeof time !== 'number') return String(time ?? '');
  const d = new Date(time * 1000);
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }) + ' IST';
}

export const TradingViewChart: React.FC<TradingViewChartProps> = ({
  symbol,
  exchange = '',
  timeframe,
  candles,
  livePrice,
  change = 0,
  changePct = 0,
  dataStatus,
  error,
  loading,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const loadedKeyRef = useRef<string>('');
  const prevLenRef = useRef<number>(0);

  const [hoveredBar, setHoveredBar] = useState<CandlePoint | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: '#FFFFFF' },
        textColor: '#475569',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#F1F5F9' },
        horzLines: { color: '#F1F5F9' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#94A3B8',
          labelBackgroundColor: '#3F5BD9',
        },
        horzLine: {
          color: '#94A3B8',
          labelBackgroundColor: '#3F5BD9',
        },
      },
      rightPriceScale: {
        borderColor: '#E2E8F0',
        autoScale: true,
        scaleMargins: {
          top: 0.12,
          bottom: 0.12,
        },
      },
      timeScale: {
        borderColor: '#E2E8F0',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
        barSpacing: 7,
        minBarSpacing: 2,
        tickMarkFormatter: (time: unknown, _tickMarkType: TickMarkType) => formatIstTick(time, timeframe),
      },
      localization: {
        timeFormatter: (time: unknown) => formatIstCrosshair(time),
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#089981',
      downColor: '#F23645',
      borderVisible: false,
      wickUpColor: '#089981',
      wickDownColor: '#F23645',
      priceLineVisible: true,
      priceLineWidth: 1,
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: symbol === 'BITCOIN' ? 0.01 : 0.05,
      },
    });

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) {
        setHoveredBar(null);
        return;
      }
      const bar = param.seriesData.get(candleSeries) as any;
      if (bar && typeof bar.open === 'number') {
        setHoveredBar({
          time: Number(param.time),
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: 0,
        });
      } else {
        setHoveredBar(null);
      }
    });

    chartRef.current = chart;
    seriesRef.current = candleSeries;
    loadedKeyRef.current = '';

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (chartRef.current) {
          chartRef.current.applyOptions({
            width: Math.max(200, Math.floor(entry.contentRect.width)),
            height: Math.max(260, Math.floor(entry.contentRect.height)),
          });
        }
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      loadedKeyRef.current = '';
    };
  }, [symbol, timeframe]);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart || candles.length === 0) return;

    const clean = candles
      .filter((c) => Number.isFinite(c.time) && Number.isFinite(c.open) && Number.isFinite(c.close))
      .sort((a, b) => a.time - b.time)
      .map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));

    if (clean.length === 0) return;

    const key = `${symbol}:${timeframe}`;
    if (loadedKeyRef.current !== key || Math.abs(clean.length - prevLenRef.current) > 3) {
      series.setData(clean);
      chart.timeScale().fitContent();
      loadedKeyRef.current = key;
      prevLenRef.current = clean.length;
    } else {
      const latest = clean[clean.length - 1];
      try {
        series.update(latest);
        if (clean.length > prevLenRef.current && clean.length >= 2) {
          series.update(clean[clean.length - 2]);
          series.update(latest);
        }
      } catch {
        series.setData(clean);
      }
      prevLenRef.current = clean.length;
    }
  }, [candles, symbol, timeframe]);

  const activeBar = hoveredBar || (candles.length > 0 ? candles[candles.length - 1] : null);
  const displayPrice = livePrice || activeBar?.close || 0;
  const isPos = change >= 0;

  const zoomBy = (factor: number) => {
    const ts = chartRef.current?.timeScale();
    if (!ts) return;
    const range = ts.getVisibleLogicalRange();
    if (!range) return;
    const span = range.to - range.from;
    const center = (range.from + range.to) / 2;
    const newHalf = Math.max(8, (span * factor) / 2);
    ts.setVisibleLogicalRange({ from: center - newHalf, to: center + newHalf });
  };

  const panBy = (bars: number) => {
    const ts = chartRef.current?.timeScale();
    if (!ts) return;
    const range = ts.getVisibleLogicalRange();
    if (!range) return;
    ts.setVisibleLogicalRange({ from: range.from + bars, to: range.to + bars });
  };

  const resetScale = () => {
    chartRef.current?.priceScale('right').applyOptions({ autoScale: true });
    chartRef.current?.timeScale().fitContent();
  };

  return (
    <div className="relative bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
      <div className="px-3.5 py-2 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-white">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="font-bold text-slate-900">
            {symbol} {exchange ? `· ${exchange}` : ''}
          </span>
          {activeBar && (
            <div className="flex items-center gap-2.5 tabular-nums text-[11px] font-medium">
              <span className="text-slate-500">
                O <strong className={isPos ? 'text-[#089981]' : 'text-[#F23645]'}>{formatNumber(activeBar.open)}</strong>
              </span>
              <span className="text-slate-500">
                H <strong className={isPos ? 'text-[#089981]' : 'text-[#F23645]'}>{formatNumber(activeBar.high)}</strong>
              </span>
              <span className="text-slate-500">
                L <strong className={isPos ? 'text-[#089981]' : 'text-[#F23645]'}>{formatNumber(activeBar.low)}</strong>
              </span>
              <span className="text-slate-500">
                C <strong className={isPos ? 'text-[#089981]' : 'text-[#F23645]'}>{formatNumber(activeBar.close)}</strong>
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs tabular-nums">
          {displayPrice > 0 && (
            <>
              <span className={`font-bold ${isPos ? 'text-[#089981]' : 'text-[#F23645]'}`}>
                {symbol === 'BITCOIN' ? `$${formatNumber(displayPrice)}` : `₹${formatNumber(displayPrice)}`}
              </span>
              <span className={`text-[11px] font-semibold ${isPos ? 'text-[#089981]' : 'text-[#F23645]'}`}>
                {formatNumber(change, 2, true)} ({formatNumber(changePct, 2, true)}%)
              </span>
            </>
          )}
          {dataStatus && (
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                dataStatus === 'LIVE'
                  ? 'bg-emerald-50 text-emerald-700'
                  : dataStatus === 'MARKET_CLOSED'
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-red-50 text-red-700'
              }`}
            >
              {dataStatus === 'LIVE' ? 'LIVE' : dataStatus === 'MARKET_CLOSED' ? 'CLOSED' : 'UNAVAILABLE'}
            </span>
          )}
        </div>
      </div>

      <div className="relative h-[400px] sm:h-[490px] w-full bg-white">
        <div ref={containerRef} className="w-full h-full" />

        {loading && candles.length === 0 && (
          <div className="absolute inset-0 bg-white/85 flex items-center justify-center z-10">
            <div className="text-xs font-semibold text-slate-500 animate-pulse">
              Loading genuine OHLC data for {symbol}...
            </div>
          </div>
        )}

        {error && candles.length === 0 && !loading && (
          <div className="absolute inset-0 bg-white flex flex-col items-center justify-center p-6 text-center z-10">
            <AlertCircle className="w-8 h-8 text-amber-500 mb-2" />
            <div className="text-sm font-bold text-slate-900">Real-Time Chart Data Unavailable</div>
            <p className="text-xs text-slate-500 mt-1 max-w-md">{error}</p>
          </div>
        )}

        {candles.length > 0 && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-white/95 border border-slate-200 rounded-xl px-1.5 py-1 shadow-sm">
            <button
              onClick={() => zoomBy(1.3)}
              title="Zoom Out"
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => zoomBy(0.75)}
              title="Zoom In"
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => panBy(-12)}
              title="Scroll Left"
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => panBy(12)}
              title="Scroll Right"
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={resetScale}
              title="Reset Auto Scale"
              className="px-2 py-1 rounded-lg text-[10px] font-semibold text-[#3F5BD9] hover:bg-blue-50 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Auto
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
