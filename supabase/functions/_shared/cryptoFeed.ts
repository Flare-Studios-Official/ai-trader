import { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { CandleBar } from "./angelOne.ts";

export interface CryptoQuoteResult {
  ok: true;
  price: number;
  open: number;
  high: number;
  low: number;
  change: number;
  changePct: number;
  volume: number;
  source: string;
}

export async function fetchUsdInrRate(supabase: SupabaseClient): Promise<number> {
  const { data: cached } = await supabase
    .from("system_kv")
    .select("value")
    .eq("key", "fx_usd_inr")
    .maybeSingle();

  const val = cached?.value as { rate?: number; expires_at?: number } | undefined;
  if (val?.rate && val?.expires_at && Date.now() < val.expires_at) {
    return val.rate;
  }

  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    if (res.ok) {
      const json = await res.json();
      const rate = Number(json?.rates?.INR);
      if (Number.isFinite(rate) && rate > 70 && rate < 120) {
        await supabase.from("system_kv").upsert({
          key: "fx_usd_inr",
          value: { rate: Math.round(rate * 100) / 100, expires_at: Date.now() + 12 * 3600 * 1000 },
          updated_at: new Date().toISOString(),
        });
        return Math.round(rate * 100) / 100;
      }
    }
  } catch {
  }

  return val?.rate || 84.5;
}

async function fetchWithTimeout(url: string, timeoutMs = 5000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { "User-Agent": "AITrader-Cloud/2.0" },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchBitcoinQuote(): Promise<CryptoQuoteResult | { ok: false; error: string }> {
  try {
    const res = await fetchWithTimeout("https://api.exchange.coinbase.com/products/BTC-USD/stats", 4500);
    if (res.ok) {
      const s = await res.json();
      const price = Number(s.last);
      const open = Number(s.open) || price;
      const high = Number(s.high) || price;
      const low = Number(s.low) || price;
      const vol = Number(s.volume) || 0;
      if (price > 0) {
        const change = price - open;
        const changePct = open > 0 ? (change / open) * 100 : 0;
        return {
          ok: true,
          price: Math.round(price * 100) / 100,
          open: Math.round(open * 100) / 100,
          high: Math.round(high * 100) / 100,
          low: Math.round(low * 100) / 100,
          change: Math.round(change * 100) / 100,
          changePct: Math.round(changePct * 100) / 100,
          volume: vol,
          source: "Coinbase Exchange",
        };
      }
    }
  } catch {}

  try {
    const res = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT", {
      headers: { "User-Agent": "AITrader-Cloud/2.0" },
    });
    if (res.ok) {
      const b = await res.json();
      const price = Number(b.lastPrice);
      const open = Number(b.openPrice) || price;
      const high = Number(b.highPrice) || price;
      const low = Number(b.lowPrice) || price;
      const vol = Number(b.volume) || 0;
      if (price > 0) {
        return {
          ok: true,
          price: Math.round(price * 100) / 100,
          open: Math.round(open * 100) / 100,
          high: Math.round(high * 100) / 100,
          low: Math.round(low * 100) / 100,
          change: Math.round(Number(b.priceChange || price - open) * 100) / 100,
          changePct: Math.round(Number(b.priceChangePercent || 0) * 100) / 100,
          volume: vol,
          source: "Binance Spot",
        };
      }
    }
  } catch {}

  try {
    const res = await fetch("https://api.gemini.com/v2/ticker/btcusd", {
      headers: { "User-Agent": "AITrader-Cloud/2.0" },
    });
    if (res.ok) {
      const g = await res.json();
      const price = Number(g.close);
      const open = Number(g.open) || price;
      if (price > 0) {
        const change = price - open;
        return {
          ok: true,
          price: Math.round(price * 100) / 100,
          open: Math.round(open * 100) / 100,
          high: Math.round((Number(g.high) || price) * 100) / 100,
          low: Math.round((Number(g.low) || price) * 100) / 100,
          change: Math.round(change * 100) / 100,
          changePct: open > 0 ? Math.round((change / open) * 10000) / 100 : 0,
          volume: 0,
          source: "Gemini Spot",
        };
      }
    }
  } catch {}

  return { ok: false, error: "All real-time Bitcoin exchange feeds unreachable" };
}

export async function fetchBitcoinCandles(
  timeframe: string = "5m",
  limit: number = 200
): Promise<{ ok: true; candles: CandleBar[]; source: string } | { ok: false; error: string }> {
  const coinbaseMap: Record<string, number> = { "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "1D": 86400 };
  const geminiMap: Record<string, string> = { "1m": "1m", "5m": "5m", "15m": "15m", "1h": "1hr", "1D": "1day" };
  const binanceMap: Record<string, string> = { "1m": "1m", "5m": "5m", "15m": "15m", "1h": "1h", "1D": "1d" };

  try {
    const gran = coinbaseMap[timeframe] || 300;
    const res = await fetchWithTimeout(`https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=${gran}`, 5000);
    if (res.ok) {
      const raw = await res.json();
      if (Array.isArray(raw) && raw.length > 0) {
        const candles: CandleBar[] = raw
          .slice(0, limit)
          .reverse()
          .map((c: any) => ({
            time: Number(c[0]),
            open: Number(c[3]),
            high: Number(c[2]),
            low: Number(c[1]),
            close: Number(c[4]),
            volume: Number(c[5]),
          }));
        return { ok: true, candles, source: "Coinbase Exchange" };
      }
    }
  } catch {}

  try {
    const giv = geminiMap[timeframe] || "5m";
    const res = await fetchWithTimeout(`https://api.gemini.com/v2/candles/btcusd/${giv}`, 5000);
    if (res.ok) {
      const raw = await res.json();
      if (Array.isArray(raw) && raw.length > 0) {
        const candles: CandleBar[] = raw
          .slice(0, limit)
          .reverse()
          .map((c: any) => ({
            time: Math.floor(Number(c[0]) / 1000),
            open: Number(c[1]),
            high: Number(c[2]),
            low: Number(c[3]),
            close: Number(c[4]),
            volume: Number(c[5]),
          }));
        return { ok: true, candles, source: "Gemini Spot" };
      }
    }
  } catch {}

  try {
    const iv = binanceMap[timeframe] || "5m";
    const res = await fetchWithTimeout(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${iv}&limit=${limit}`, 4000);
    if (res.ok) {
      const raw = await res.json();
      if (Array.isArray(raw) && raw.length > 0) {
        const candles: CandleBar[] = raw.map((r: any) => ({
          time: Math.floor(Number(r[0]) / 1000),
          open: Number(r[1]),
          high: Number(r[2]),
          low: Number(r[3]),
          close: Number(r[4]),
          volume: Number(r[5]),
        }));
        return { ok: true, candles, source: "Binance Spot" };
      }
    }
  } catch {}

  return { ok: false, error: "Live Bitcoin OHLCV candles unavailable" };
}

export async function fetchBitcoinHistoricalCandlesForDate(
  dateYmd: string,
  timeframe: string = "5m"
): Promise<{ ok: true; candles: CandleBar[]; sessionStartSec: number; sessionEndSec: number; source: string } | { ok: false; error: string }> {
  const granMap: Record<string, number> = { "1m": 60, "5m": 300, "15m": 900, "1h": 3600 };
  const gran = granMap[timeframe] || 300;
  // IST day boundaries in UTC epoch seconds: dateYmd 00:00 IST to 23:59:59 IST
  const istOffsetSec = 5.5 * 3600;
  const dayStartSec = Math.floor(Date.parse(`${dateYmd}T00:00:00Z`) / 1000) - istOffsetSec;
  const dayEndSec = dayStartSec + 86400 - 1;
  const nowSec = Math.floor(Date.now() / 1000);
  const effectiveEndSec = Math.min(dayEndSec, nowSec);
  if (effectiveEndSec <= dayStartSec) {
    return { ok: false, error: `Selected date ${dateYmd} has no completed Bitcoin candles yet.` };
  }

  // Fetch warmup bars prior to dayStartSec (220 bars) + full day bars
  const warmupStartSec = dayStartSec - gran * 220;
  const byTime = new Map<number, CandleBar>();
  const span = gran * 280;
  let cursor = warmupStartSec;
  while (cursor < effectiveEndSec) {
    const chunkEnd = Math.min(effectiveEndSec, cursor + span);
    const sIso = new Date(cursor * 1000).toISOString();
    const eIso = new Date(chunkEnd * 1000).toISOString();
    try {
      const res = await fetchWithTimeout(
        `https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=${gran}&start=${sIso}&end=${eIso}`,
        6000
      );
      if (res.ok) {
        const raw = await res.json();
        if (Array.isArray(raw)) {
          for (const c of raw) {
            const t = Number(c[0]);
            if (t <= effectiveEndSec) {
              byTime.set(t, {
                time: t,
                low: Number(c[1]),
                high: Number(c[2]),
                open: Number(c[3]),
                close: Number(c[4]),
                volume: Number(c[5]),
              });
            }
          }
        }
      }
    } catch {}
    cursor = chunkEnd;
  }

  const candles = Array.from(byTime.values()).sort((a, b) => a.time - b.time);
  const sessionCandles = candles.filter((c) => c.time >= dayStartSec && c.time <= effectiveEndSec);
  if (sessionCandles.length === 0) {
    return { ok: false, error: `Historical Bitcoin candles unavailable for ${dateYmd}` };
  }
  return { ok: true, candles, sessionStartSec: dayStartSec, sessionEndSec: effectiveEndSec, source: "Coinbase Exchange Historical" };
}
