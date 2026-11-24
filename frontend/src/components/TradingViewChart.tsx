import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  createChart,
  ColorType,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  createSeriesMarkers,
  IChartApi,
  ISeriesApi
} from 'lightweight-charts';
import { generateCandlesForSymbol, CandleData, calculateEMA } from '../services/marketData';
import { Activity, Eye, Zap, Layers, BarChart2 } from 'lucide-react';

export interface ChartMarker {
  time: number;
  position: 'aboveBar' | 'belowBar';
  color: string;
  shape: 'arrowUp' | 'arrowDown';
  text: string;
}

interface TradingViewChartProps {
  symbol: string;
  currentPrice: number;
  changePct?: number;
  height?: number;
  markers?: ChartMarker[];
  onSelectSymbol?: (symbol: string) => void;
  showControls?: boolean;
}

const SYMBOLS = [
  { id: 'BTC/USDT', label: 'BTC/USDT Spot', is247: true },
  { id: 'NIFTY', label: 'NIFTY 50', is247: false },
  { id: 'BANKNIFTY', label: 'BANK NIFTY', is247: false },
  { id: 'SENSEX', label: 'BSE SENSEX', is247: false },
  { id: 'BANKEX', label: 'BSE BANKEX', is247: false },
];

export const TradingViewChart: React.FC<TradingViewChartProps> = ({
  symbol,
  currentPrice,
  changePct = 0,
  height = 480,
  markers = [],
  onSelectSymbol,
  showControls = true
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ema9SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema21SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const markersPrimitiveRef = useRef<any>(null);

  const candlesRef = useRef<CandleData[]>([]);
  const lastPriceRef = useRef<number>(currentPrice);
  const [timeframe, setTimeframe] = useState<'1s' | '1m' | '5m' | '15m'>('1m');
  const [showEma, setShowEma] = useState<boolean>(true);
  const [showVolume, setShowVolume] = useState<boolean>(true);
  const [priceFlash, setPriceFlash] = useState<'up' | 'down' | null>(null);

  // Initialize or reset chart when symbol or timeframe changes
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Clear previous chart if any
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const container = chartContainerRef.current;
    const intervalSecs = timeframe === '1s' ? 1 : timeframe === '1m' ? 60 : timeframe === '5m' ? 300 : 900;
    const initialCandles = generateCandlesForSymbol(symbol, currentPrice, 100, intervalSecs);
    candlesRef.current = initialCandles;

    const chart = createChart(container, {
      width: container.clientWidth || 800,
      height,
      layout: {
        background: { type: ColorType.Solid, color: '#0B0F17' },
        textColor: '#94A3B8',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: 11
      },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.4)' },
        horzLines: { color: 'rgba(30, 41, 59, 0.4)' }
      },
      crosshair: {
        vertLine: {
          color: '#3B82F6',
          width: 1,
          style: 3,
          labelBackgroundColor: '#1E293B'
        },
        horzLine: {
          color: '#3B82F6',
          width: 1,
          style: 3,
          labelBackgroundColor: '#1E293B'
        }
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: timeframe === '1s',
        borderColor: '#1E293B',
        barSpacing: 8,
        minBarSpacing: 4
      },
      rightPriceScale: {
        borderColor: '#1E293B',
        scaleMargins: {
          top: 0.1,
          bottom: 0.2
        }
      }
    });

    chartRef.current = chart;

    // 1. Candlestick Series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10B981',
      downColor: '#EF4444',
      borderVisible: false,
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444'
    });
    candleSeries.setData(
      initialCandles.map((c) => ({
        time: c.time as any,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close
      }))
    );
    candleSeriesRef.current = candleSeries;

    // 2. Volume Series
    if (showVolume) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: '' // overlay on main pane
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.82, bottom: 0 }
      });
      volumeSeries.setData(
        initialCandles.map((c) => ({
          time: c.time as any,
          value: c.volume || 100,
          color: c.close >= c.open ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'
        }))
      );
      volumeSeriesRef.current = volumeSeries;
    }

    // 3. EMA 9 & EMA 21
    if (showEma) {
      const ema9Data = calculateEMA(initialCandles, 9);
      const ema21Data = calculateEMA(initialCandles, 21);

      const ema9Series = chart.addSeries(LineSeries, {
        color: '#3B82F6',
        lineWidth: 2,
        title: 'EMA 9'
      });
      ema9Series.setData(ema9Data.map((d) => ({ time: d.time as any, value: d.value })));
      ema9SeriesRef.current = ema9Series;

      const ema21Series = chart.addSeries(LineSeries, {
        color: '#F59E0B',
        lineWidth: 2,
        title: 'EMA 21'
      });
      ema21Series.setData(ema21Data.map((d) => ({ time: d.time as any, value: d.value })));
      ema21SeriesRef.current = ema21Series;
    }

    // 4. Trade Execution Markers
    if (markers.length > 0 && typeof createSeriesMarkers === 'function') {
      try {
        const markersPrimitive = createSeriesMarkers(
          candleSeries,
          markers.map((m) => ({
            time: m.time as any,
            position: m.position,
            color: m.color,
            shape: m.shape,
            text: m.text
          }))
        );
        markersPrimitiveRef.current = markersPrimitive;
      } catch (err) {
        console.warn('Markers setup note:', err);
      }
    }

    chart.timeScale().fitContent();

    // Responsive ResizeObserver
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0 || !chartRef.current) return;
      const { width } = entries[0].contentRect;
      chartRef.current.applyOptions({ width });
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [symbol, timeframe, showEma, showVolume, height]);

  // Update markers when props change
  useEffect(() => {
    if (markersPrimitiveRef.current && markers.length > 0) {
      try {
        markersPrimitiveRef.current.setMarkers(
          markers.map((m) => ({
            time: m.time as any,
            position: m.position,
            color: m.color,
            shape: m.shape,
            text: m.text
          }))
        );
      } catch {}
    }
  }, [markers]);

  // Handle 1-Second Fast Live Price Ticks
  useEffect(() => {
    if (!candleSeriesRef.current || currentPrice <= 0) return;

    if (currentPrice > lastPriceRef.current) {
      setPriceFlash('up');
      setTimeout(() => setPriceFlash(null), 400);
    } else if (currentPrice < lastPriceRef.current) {
      setPriceFlash('down');
      setTimeout(() => setPriceFlash(null), 400);
    }
    lastPriceRef.current = currentPrice;

    const candles = candlesRef.current;
    if (candles.length === 0) return;

    const lastCandle = candles[candles.length - 1];
    const now = Math.floor(Date.now() / 1000);
    const intervalSecs = timeframe === '1s' ? 1 : timeframe === '1m' ? 60 : timeframe === '5m' ? 300 : 900;

    // Check if new candle should start
    if (now - lastCandle.time >= intervalSecs) {
      const newCandle: CandleData = {
        time: now,
        open: lastCandle.close,
        high: Math.max(lastCandle.close, currentPrice),
        low: Math.min(lastCandle.close, currentPrice),
        close: currentPrice,
        volume: 1
      };
      candles.push(newCandle);
      if (candles.length > 200) candles.shift();

      candleSeriesRef.current.update({
        time: newCandle.time as any,
        open: newCandle.open,
        high: newCandle.high,
        low: newCandle.low,
        close: newCandle.close
      });

      if (volumeSeriesRef.current) {
        volumeSeriesRef.current.update({
          time: newCandle.time as any,
          value: newCandle.volume || 1,
          color: newCandle.close >= newCandle.open ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'
        });
      }
    } else {
      // Update active candle with new high/low/close
      lastCandle.high = Math.max(lastCandle.high, currentPrice);
      lastCandle.low = Math.min(lastCandle.low, currentPrice);
      lastCandle.close = currentPrice;
      lastCandle.volume = (lastCandle.volume || 0) + 1;

      candleSeriesRef.current.update({
        time: lastCandle.time as any,
        open: lastCandle.open,
        high: lastCandle.high,
        low: lastCandle.low,
        close: lastCandle.close
      });
    }
  }, [currentPrice, timeframe]);

  const isPositive = changePct >= 0;

  return (
    <div className="bg-brand-card/90 border border-brand-border rounded-xl p-4 shadow-xl backdrop-blur-sm flex flex-col">
      {/* Header Controls */}
      {showControls && (
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-brand-border/80 mb-3">
          {/* Symbol Selector Pills */}
          <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-0.5">
            {SYMBOLS.map((s) => {
              const active = symbol.toUpperCase() === s.id.toUpperCase();
              return (
                <button
                  key={s.id}
                  onClick={() => onSelectSymbol && onSelectSymbol(s.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                      : 'bg-brand-surface text-brand-muted hover:text-white hover:bg-brand-border/60'
                  }`}
                >
                  {s.id}
                </button>
              );
            })}
          </div>

          {/* Timeframe & Overlays */}
          <div className="flex items-center space-x-2">
            {/* Timeframe selector */}
            <div className="bg-brand-surface rounded-lg p-0.5 border border-brand-border flex items-center space-x-0.5 text-xs">
              {(['1s', '1m', '5m', '15m'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                    timeframe === tf
                      ? 'bg-blue-500/30 text-blue-400 font-bold'
                      : 'text-brand-muted hover:text-gray-300'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>

            {/* EMA Toggle */}
            <button
              onClick={() => setShowEma(!showEma)}
              className={`px-2 py-1 rounded-md text-xs font-semibold flex items-center space-x-1 border transition-colors ${
                showEma
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                  : 'bg-brand-surface text-brand-muted border-brand-border hover:text-gray-300'
              }`}
              title="Toggle EMA 9 & EMA 21 Overlays"
            >
              <Activity className="w-3 h-3" />
              <span>EMA</span>
            </button>

            {/* Volume Toggle */}
            <button
              onClick={() => setShowVolume(!showVolume)}
              className={`px-2 py-1 rounded-md text-xs font-semibold flex items-center space-x-1 border transition-colors ${
                showVolume
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-brand-surface text-brand-muted border-brand-border hover:text-gray-300'
              }`}
              title="Toggle Volume Histogram"
            >
              <BarChart2 className="w-3 h-3" />
              <span>VOL</span>
            </button>
          </div>
        </div>
      )}

      {/* Symbol Live Ticker Bar */}
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="flex items-baseline space-x-3">
          <span className="text-sm font-bold text-white tracking-wide">{symbol}</span>
          <span
            className={`text-xl font-mono font-bold tracking-tight transition-colors duration-200 ${
              priceFlash === 'up'
                ? 'text-emerald-400'
                : priceFlash === 'down'
                ? 'text-red-400'
                : 'text-white'
            }`}
          >
            {symbol.includes('BTC') ? `$${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `₹${currentPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </span>
          <span
            className={`text-xs font-bold px-1.5 py-0.5 rounded ${
              isPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
            }`}
          >
            {isPositive ? '+' : ''}
            {changePct.toFixed(2)}%
          </span>
        </div>

        <div className="flex items-center space-x-2 text-[11px]">
          <span className="inline-flex items-center text-emerald-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-1"></span>
            1-SEC LIVE FEED
          </span>
          {showEma && (
            <div className="hidden sm:flex items-center space-x-2 text-[10px] font-mono">
              <span className="text-blue-400">● EMA(9)</span>
              <span className="text-amber-400">● EMA(21)</span>
            </div>
          )}
        </div>
      </div>

      {/* TradingView Chart Container */}
      <div
        ref={chartContainerRef}
        className="w-full rounded-lg overflow-hidden border border-brand-border/60 bg-[#0B0F17]"
        style={{ minHeight: `${height}px` }}
      />

      {/* Bottom Status / Legend */}
      <div className="mt-2 pt-2 border-t border-brand-border/60 flex items-center justify-between text-[11px] text-brand-muted">
        <div className="flex items-center space-x-3">
          <span>TradingView Lightweight-Charts v5</span>
          <span>&bull;</span>
          <span>Resolution: <span className="text-gray-200 font-semibold">{timeframe}</span></span>
          {markers.length > 0 && (
            <>
              <span>&bull;</span>
              <span className="text-blue-400 font-semibold">{markers.length} AI Trade Markers</span>
            </>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-gray-400">Candles &bull; Volume &bull; Dynamic Auto Scaling</span>
        </div>
      </div>
    </div>
  );
};
