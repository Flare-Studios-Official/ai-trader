import { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { getIstDate } from "./marketSessions.ts";

export interface AngelQuoteItem {
  exchange: string;
  tradingSymbol: string;
  symbolToken: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  netChange: number;
  percentChange: number;
  tradeVolume: number;
  opnInterest: number;
  exchFeedTime: string;
  depth?: {
    buy?: Array<{ price: number; quantity: number; orders: number }>;
    sell?: Array<{ price: number; quantity: number; orders: number }>;
  };
}

export interface CandleBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const CORE_INDICES: Record<string, {
  symbol: string;
  displayName: string;
  exchange: 'NSE' | 'BSE';
  token: string;
  optionExch: 'NFO' | 'BFO';
  strikeStep: number;
}> = {
  NIFTY: { symbol: 'NIFTY', displayName: 'NIFTY 50', exchange: 'NSE', token: '99926000', optionExch: 'NFO', strikeStep: 50 },
  BANKNIFTY: { symbol: 'BANKNIFTY', displayName: 'BANK NIFTY', exchange: 'NSE', token: '99926009', optionExch: 'NFO', strikeStep: 100 },
  FINNIFTY: { symbol: 'FINNIFTY', displayName: 'FIN NIFTY', exchange: 'NSE', token: '99926037', optionExch: 'NFO', strikeStep: 50 },
  MIDCPNIFTY: { symbol: 'MIDCPNIFTY', displayName: 'NIFTY MIDCAP', exchange: 'NSE', token: '99926074', optionExch: 'NFO', strikeStep: 25 },
  SENSEX: { symbol: 'SENSEX', displayName: 'BSE SENSEX', exchange: 'BSE', token: '99919000', optionExch: 'BFO', strikeStep: 100 },
  BANKEX: { symbol: 'BANKEX', displayName: 'BSE BANKEX', exchange: 'BSE', token: '99919012', optionExch: 'BFO', strikeStep: 100 },
};

export const POPULAR_EQUITY_TOKENS: Record<string, { symbol: string; name: string; token: string }> = {
  'RELIANCE-EQ': { symbol: 'RELIANCE-EQ', name: 'Reliance Industries', token: '2885' },
  'HDFCBANK-EQ': { symbol: 'HDFCBANK-EQ', name: 'HDFC Bank', token: '1333' },
  'TCS-EQ': { symbol: 'TCS-EQ', name: 'TCS', token: '11536' },
  'INFY-EQ': { symbol: 'INFY-EQ', name: 'Infosys', token: '1594' },
  'ICICIBANK-EQ': { symbol: 'ICICIBANK-EQ', name: 'ICICI Bank', token: '4963' },
  'SBIN-EQ': { symbol: 'SBIN-EQ', name: 'State Bank of India', token: '3045' },
  'HCLTECH-EQ': { symbol: 'HCLTECH-EQ', name: 'HCL Technologies', token: '7229' },
  'JIOFIN-EQ': { symbol: 'JIOFIN-EQ', name: 'Jio Financial Services', token: '18143' },
  'ADANIPORTS-EQ': { symbol: 'ADANIPORTS-EQ', name: 'Adani Ports', token: '15083' },
};

const ANGEL_BASE = "https://apiconnect.angelone.in";

export function isAngelConfigured(): boolean {
  return Boolean(
    Deno.env.get("ANGEL_API_KEY") &&
    Deno.env.get("ANGEL_CLIENT_CODE") &&
    Deno.env.get("ANGEL_PIN") &&
    Deno.env.get("ANGEL_TOTP_SECRET")
  );
}

export async function generateTotp(base32Secret: string): Promise<string> {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = base32Secret.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
  let bits = "";
  for (let i = 0; i < cleaned.length; i++) {
    const val = alphabet.indexOf(cleaned[i]);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  const keyBytes = new Uint8Array(bytes);
  const counter = Math.floor(Date.now() / 1000 / 30);
  const counterBuf = new ArrayBuffer(8);
  const view = new DataView(counterBuf);
  view.setUint32(0, Math.floor(counter / 0x100000000), false);
  view.setUint32(4, counter >>> 0, false);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, counterBuf));
  const offset = sig[sig.length - 1] & 0x0f;
  const binCode =
    ((sig[offset] & 0x7f) << 24) |
    ((sig[offset + 1] & 0xff) << 16) |
    ((sig[offset + 2] & 0xff) << 8) |
    (sig[offset + 3] & 0xff);
  return String(binCode % 1000000).padStart(6, "0");
}

function buildAngelHeaders(jwtToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "X-UserType": "USER",
    "X-SourceID": "WEB",
    "X-ClientLocalIP": "127.0.0.1",
    "X-ClientPublicIP": Deno.env.get("ANGEL_CLIENT_PUBLIC_IP") || "49.43.222.66",
    "X-MACAddress": "fe80::1",
    "X-PrivateKey": Deno.env.get("ANGEL_API_KEY") || "",
  };
  if (jwtToken) {
    headers["Authorization"] = `Bearer ${jwtToken}`;
  }
  return headers;
}

export async function getAngelJwtToken(
  supabase: SupabaseClient,
  forceRefresh = false
): Promise<{ ok: true; jwt: string } | { ok: false; error: string }> {
  if (!isAngelConfigured()) {
    return { ok: false, error: "Angel One SmartAPI secrets missing in Supabase Edge Secrets" };
  }

  if (!forceRefresh) {
    const { data: cached } = await supabase
      .from("system_kv")
      .select("value")
      .eq("key", "angel_one_session")
      .maybeSingle();

    const sess = cached?.value as { jwt_token?: string; expires_at?: number } | undefined;
    if (sess?.jwt_token && sess?.expires_at && Date.now() < sess.expires_at) {
      return { ok: true, jwt: sess.jwt_token };
    }
  }

  try {
    const totp = await generateTotp(Deno.env.get("ANGEL_TOTP_SECRET") || "");
    const res = await fetch(`${ANGEL_BASE}/rest/auth/angelbroking/user/v1/loginByPassword`, {
      method: "POST",
      headers: buildAngelHeaders(),
      body: JSON.stringify({
        clientcode: Deno.env.get("ANGEL_CLIENT_CODE"),
        password: Deno.env.get("ANGEL_PIN"),
        totp,
      }),
    });

    const data = await res.json();
    if (!data?.status || !data?.data?.jwtToken) {
      return { ok: false, error: data?.message || `Angel One login failed (${res.status})` };
    }

    const jwtToken = String(data.data.jwtToken);
    await supabase.from("system_kv").upsert({
      key: "angel_one_session",
      value: {
        jwt_token: jwtToken,
        feed_token: data.data.feedToken || null,
        refresh_token: data.data.refreshToken || null,
        expires_at: Date.now() + 6 * 3600 * 1000,
        updated_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    });

    return { ok: true, jwt: jwtToken };
  } catch (e) {
    return { ok: false, error: `Angel One network auth error: ${String(e)}` };
  }
}

export async function fetchAngelQuotes(
  supabase: SupabaseClient,
  exchangeTokens: Record<string, string[]>
): Promise<{ ok: true; fetched: AngelQuoteItem[] } | { ok: false; error: string }> {
  const cleanTokens: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(exchangeTokens)) {
    const uniq = Array.from(new Set(v.filter(Boolean)));
    if (uniq.length > 0) cleanTokens[k] = uniq;
  }
  if (Object.keys(cleanTokens).length === 0) {
    return { ok: true, fetched: [] };
  }

  let auth = await getAngelJwtToken(supabase, false);
  if (!auth.ok) return auth;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${ANGEL_BASE}/rest/secure/angelbroking/market/v1/quote`, {
        method: "POST",
        headers: buildAngelHeaders(auth.jwt),
        body: JSON.stringify({ mode: "FULL", exchangeTokens: cleanTokens }),
      });

      if (res.status === 401 && attempt === 0) {
        auth = await getAngelJwtToken(supabase, true);
        if (!auth.ok) return auth;
        continue;
      }

      if (!res.ok) {
        const errTxt = await res.text();
        if (attempt === 0 && (errTxt.includes("Invalid Token") || errTxt.includes("AG8001"))) {
          auth = await getAngelJwtToken(supabase, true);
          if (!auth.ok) return auth;
          continue;
        }
        return { ok: false, error: `Angel One Quote HTTP ${res.status}: ${errTxt.slice(0, 120)}` };
      }

      const json = await res.json();
      if (!json?.status) {
        if (attempt === 0 && (String(json?.errorcode) === "AG8001" || String(json?.message || "").toLowerCase().includes("token"))) {
          auth = await getAngelJwtToken(supabase, true);
          if (!auth.ok) return auth;
          continue;
        }
        return { ok: false, error: json?.message || "Angel One quote returned false status" };
      }

      return { ok: true, fetched: (json.data?.fetched || []) as AngelQuoteItem[] };
    } catch (e) {
      if (attempt === 1) {
        return { ok: false, error: `Quote request failed: ${String(e)}` };
      }
      await new Promise((r) => setTimeout(r, 350));
    }
  }

  return { ok: false, error: "Quote request exhausted retries" };
}

function formatAngelDateParam(istMs: number): string {
  const d = getIstDate(istMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

export async function fetchAngelCandles(
  supabase: SupabaseClient,
  exchange: string,
  token: string,
  timeframe: string = "5m",
  ttlMs: number = 25_000
): Promise<{ ok: true; candles: CandleBar[]; cached: boolean } | { ok: false; error: string }> {
  const intervalMap: Record<string, { api: string; daysBack: number }> = {
    "1m": { api: "ONE_MINUTE", daysBack: 2 },
    "3m": { api: "THREE_MINUTE", daysBack: 3 },
    "5m": { api: "FIVE_MINUTE", daysBack: 6 },
    "15m": { api: "FIFTEEN_MINUTE", daysBack: 14 },
    "1h": { api: "ONE_HOUR", daysBack: 45 },
    "1D": { api: "ONE_DAY", daysBack: 220 },
  };
  const spec = intervalMap[timeframe] || intervalMap["5m"];
  const cacheKey = `candles:${exchange}:${token}:${spec.api}`;

  const { data: cacheRow } = await supabase
    .from("system_kv")
    .select("value, updated_at")
    .eq("key", cacheKey)
    .maybeSingle();

  const cachedVal = cacheRow?.value as { candles?: CandleBar[]; expires_at?: number } | undefined;
  if (cachedVal?.candles && cachedVal.candles.length > 0 && cachedVal.expires_at && Date.now() < cachedVal.expires_at) {
    return { ok: true, candles: cachedVal.candles, cached: true };
  }

  let auth = await getAngelJwtToken(supabase, false);
  if (!auth.ok) {
    return auth;
  }

  const nowMs = Date.now();
  const fromDateStr = formatAngelDateParam(nowMs - spec.daysBack * 86400 * 1000);
  const toDateStr = formatAngelDateParam(nowMs + 60 * 1000);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${ANGEL_BASE}/rest/secure/angelbroking/historical/v1/getCandleData`, {
        method: "POST",
        headers: buildAngelHeaders(auth.jwt),
        body: JSON.stringify({
          exchange,
          symboltoken: token,
          interval: spec.api,
          fromdate: fromDateStr,
          todate: toDateStr,
        }),
      });

      const rawText = await res.text();
      if (res.status === 403 || rawText.includes("exceeding access rate")) {
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 1100));
          continue;
        }
        if (cachedVal?.candles && cachedVal.candles.length > 0) {
          return { ok: true, candles: cachedVal.candles, cached: true };
        }
        return { ok: false, error: "Angel One historical rate limit reached" };
      }

      if (res.status === 401 && attempt === 0) {
        auth = await getAngelJwtToken(supabase, true);
        if (!auth.ok) return auth;
        continue;
      }

      let json: any;
      try {
        json = JSON.parse(rawText);
      } catch {
        return { ok: false, error: `Invalid Angel One JSON (${res.status})` };
      }

      if (!json?.status) {
        if (attempt === 0 && (String(json?.errorcode) === "AG8001" || String(json?.message || "").toLowerCase().includes("token"))) {
          auth = await getAngelJwtToken(supabase, true);
          if (!auth.ok) return auth;
          continue;
        }
        return { ok: false, error: json?.message || "Historical candles unavailable" };
      }

      const rawList = (json.data || []) as Array<[string, number, number, number, number, number]>;
      const candles: CandleBar[] = [];
      for (const row of rawList) {
        const tsMs = Date.parse(row[0]);
        if (!Number.isFinite(tsMs)) continue;
        candles.push({
          time: Math.floor(tsMs / 1000),
          open: Number(row[1]),
          high: Number(row[2]),
          low: Number(row[3]),
          close: Number(row[4]),
          volume: Number(row[5] || 0),
        });
      }

      const byTime = new Map<number, CandleBar>();
      for (const c of candles) byTime.set(c.time, c);
      const cleanCandles = Array.from(byTime.values()).sort((a, b) => a.time - b.time);

      if (cleanCandles.length > 0) {
        await supabase.from("system_kv").upsert({
          key: cacheKey,
          value: {
            candles: cleanCandles.slice(-220),
            expires_at: Date.now() + ttlMs,
          },
          updated_at: new Date().toISOString(),
        });
      }

      return { ok: true, candles: cleanCandles, cached: false };
    } catch (e) {
      if (attempt === 2) {
        return { ok: false, error: `Angel One candle error: ${String(e)}` };
      }
      await new Promise((r) => setTimeout(r, 800));
    }
  }

  return { ok: false, error: "Historical candle fetch exhausted retries" };
}
