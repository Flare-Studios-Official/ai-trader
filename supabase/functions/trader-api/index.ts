import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { CORS_HEADERS, jsonResponse, verifyGatewayOrWorkerRequest } from "../_shared/auth.ts";
import {
  CORE_INDICES,
  POPULAR_EQUITY_TOKENS,
  AngelQuoteItem,
  CandleBar,
  fetchAngelCandles,
  fetchAngelQuotes,
  isAngelConfigured,
} from "../_shared/angelOne.ts";
import { fetchBitcoinCandles, fetchBitcoinQuote, fetchUsdInrRate } from "../_shared/cryptoFeed.ts";
import {
  formatIstDateYmd,
  getCryptoSession,
  getIndianMarketSession,
  getIstDate,
  isCryptoInstrument,
} from "../_shared/marketSessions.ts";
import {
  AICandidateContract,
  computeAllocatedBudget,
  computeV12Engine,
} from "../_shared/quantEngine.ts";
import {
  closePaperPosition,
  openPaperPosition,
  selectRealOptionCandidate,
} from "../_shared/paperBroker.ts";

function getSubPath(reqUrl: string): string {
  const url = new URL(reqUrl);
  const idx = url.pathname.indexOf("/trader-api");
  if (idx !== -1) {
    const rest = url.pathname.slice(idx + "/trader-api".length);
    return rest.replace(/\/+$/, "") || "/";
  }
  return url.pathname.replace(/\/+$/, "") || "/";
}

function getBucketSeconds(tf: string): number {
  switch (tf) {
    case "1m":
      return 60;
    case "3m":
      return 180;
    case "5m":
      return 300;
    case "15m":
      return 900;
    case "1h":
      return 3600;
    case "1D":
      return 86400;
    default:
      return 300;
  }
}

function mergeLiveTickIntoCandles(candles: CandleBar[], livePrice: number, tf: string): CandleBar[] {
  if (!candles.length || !Number.isFinite(livePrice) || livePrice <= 0) return candles;
  const last = candles[candles.length - 1];
  if (last.close > 0 && Math.abs(livePrice - last.close) / last.close > 0.25) {
    return candles;
  }
  const bucket = getBucketSeconds(tf);
  const nowSec = Math.floor(Date.now() / 1000);
  const currentBucket = Math.floor(nowSec / bucket) * bucket;

  const out = [...candles];
  if (last.time >= currentBucket) {
    out[out.length - 1] = {
      ...last,
      close: livePrice,
      high: Math.max(last.high, livePrice),
      low: Math.min(last.low, livePrice),
    };
  } else {
    out.push({
      time: currentBucket,
      open: last.close,
      high: Math.max(last.close, livePrice),
      low: Math.min(last.close, livePrice),
      close: livePrice,
      volume: 0,
    });
  }
  return out;
}

async function resolveInstrumentSpec(
  supabase: SupabaseClient,
  rawSymbol: string
): Promise<{
  symbol: string;
  name: string;
  exchange: string;
  token: string;
  isCrypto: boolean;
  lotSize: number;
  instrumenttype: string;
} | null> {
  const sym = (rawSymbol || "NIFTY").trim().toUpperCase();
  if (isCryptoInstrument(sym)) {
    return {
      symbol: "BITCOIN",
      name: "Bitcoin (BTC/USDT)",
      exchange: "CRYPTO",
      token: "BTCUSDT",
      isCrypto: true,
      lotSize: 1,
      instrumenttype: "CRYPTO_SPOT",
    };
  }
  if (CORE_INDICES[sym]) {
    const c = CORE_INDICES[sym];
    return {
      symbol: c.symbol,
      name: c.displayName,
      exchange: c.exchange,
      token: c.token,
      isCrypto: false,
      lotSize: 1,
      instrumenttype: "AMXIDX",
    };
  }
  if (POPULAR_EQUITY_TOKENS[sym]) {
    const eq = POPULAR_EQUITY_TOKENS[sym];
    return {
      symbol: eq.symbol,
      name: eq.name,
      exchange: "NSE",
      token: eq.token,
      isCrypto: false,
      lotSize: 1,
      instrumenttype: "EQ",
    };
  }

  const { data: rows } = await supabase
    .from("instrument_master")
    .select("*")
    .or(`symbol.eq.${sym},name.eq.${sym}`)
    .order("instrumenttype", { ascending: true })
    .limit(5);

  if (rows && rows.length > 0) {
    const preferred = rows.find((r: any) => r.symbol === sym) || rows.find((r: any) => r.instrumenttype === "EQ") || rows[0];
    return {
      symbol: String(preferred.symbol),
      name: String(preferred.name || preferred.symbol),
      exchange: String(preferred.exch_seg),
      token: String(preferred.token),
      isCrypto: false,
      lotSize: Number(preferred.lotsize || 1),
      instrumenttype: String(preferred.instrumenttype || "EQ"),
    };
  }
  return null;
}

async function ensureFreshQuotes(
  supabase: SupabaseClient,
  openPositions: any[],
  extraSymbols: string[] = []
): Promise<{ quotes: any[]; usdInrRate: number; angelError: string | null }> {
  const indianSession = getIndianMarketSession();
  const usdInrRate = await fetchUsdInrRate(supabase);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const { data: existingCache } = await supabase.from("market_quotes_cache").select("*");
  const cacheMap = new Map<string, any>();
  for (const r of existingCache || []) cacheMap.set(r.symbol, r);

  const upserts: any[] = [];

  const btcRow = cacheMap.get("BITCOIN");
  const btcAgeMs = btcRow?.updated_at ? nowMs - Date.parse(btcRow.updated_at) : 999_999;
  if (btcAgeMs > 1500 || Number(btcRow?.ltp || 0) <= 0) {
    const btcQ = await fetchBitcoinQuote();
    if (btcQ.ok) {
      const nextBtc = {
        symbol: "BITCOIN",
        display_name: "Bitcoin (BTC/USDT)",
        exchange: "CRYPTO",
        token: "BTCUSDT",
        asset_type: "CRYPTO_SPOT",
        ltp: btcQ.price,
        open_price: btcQ.open,
        high_price: btcQ.high,
        low_price: btcQ.low,
        close_price: btcQ.open,
        net_change: btcQ.change,
        percent_change: btcQ.changePct,
        volume: btcQ.volume,
        oi: 0,
        feed_time: nowIso,
        data_status: "LIVE",
        source: btcQ.source,
        updated_at: nowIso,
      };
      cacheMap.set("BITCOIN", nextBtc);
      upserts.push(nextBtc);
    }
  }

  const niftyRow = cacheMap.get("NIFTY");
  const niftyAgeMs = niftyRow?.updated_at ? nowMs - Date.parse(niftyRow.updated_at) : 999_999;
  const maxIndAgeMs = indianSession.isOpen ? 2000 : 90_000;
  const needsExtraRefresh = extraSymbols.some((s) => {
    if (!s || isCryptoInstrument(s)) return false;
    const r = cacheMap.get(s);
    const age = r?.updated_at ? nowMs - Date.parse(r.updated_at) : 999_999;
    return !r || Number(r.ltp || 0) <= 0 || age > maxIndAgeMs;
  });

  let angelError: string | null = null;
  if (niftyAgeMs > maxIndAgeMs || Number(niftyRow?.ltp || 0) <= 0 || needsExtraRefresh || openPositions.some((p) => p.exchange !== "CRYPTO")) {
    if (!isAngelConfigured()) {
      angelError = "Angel One SmartAPI secrets missing in Supabase Edge Secrets";
    } else {
      const exchangeTokens: Record<string, string[]> = { NSE: [], BSE: [], NFO: [], BFO: [] };
      const metaByKey = new Map<string, { symbol: string; displayName: string; assetType: string }>();

      for (const spec of Object.values(CORE_INDICES)) {
        exchangeTokens[spec.exchange].push(spec.token);
        metaByKey.set(`${spec.exchange}:${spec.token}`, {
          symbol: spec.symbol,
          displayName: spec.displayName,
          assetType: "INDEX_SPOT",
        });
      }
      for (const eq of Object.values(POPULAR_EQUITY_TOKENS)) {
        exchangeTokens.NSE.push(eq.token);
        metaByKey.set(`NSE:${eq.token}`, {
          symbol: eq.symbol,
          displayName: eq.name,
          assetType: "EQUITY_SPOT",
        });
      }
      for (const pos of openPositions) {
        if (pos.exchange && pos.instrument_token && pos.exchange !== "CRYPTO") {
          if (!exchangeTokens[pos.exchange]) exchangeTokens[pos.exchange] = [];
          exchangeTokens[pos.exchange].push(String(pos.instrument_token));
          metaByKey.set(`${pos.exchange}:${pos.instrument_token}`, {
            symbol: String(pos.symbol),
            displayName: String(pos.symbol),
            assetType: String(pos.asset_type || "INDEX_F_AND_O"),
          });
        }
      }
      for (const s of extraSymbols) {
        if (!s || isCryptoInstrument(s) || CORE_INDICES[s] || POPULAR_EQUITY_TOKENS[s]) continue;
        const spec = await resolveInstrumentSpec(supabase, s);
        if (spec && !spec.isCrypto) {
          if (!exchangeTokens[spec.exchange]) exchangeTokens[spec.exchange] = [];
          exchangeTokens[spec.exchange].push(spec.token);
          metaByKey.set(`${spec.exchange}:${spec.token}`, {
            symbol: spec.symbol,
            displayName: spec.name,
            assetType: spec.instrumenttype === "OPTIDX" ? "INDEX_F_AND_O" : "EQUITY_SPOT",
          });
        }
      }

      const qRes = await fetchAngelQuotes(supabase, exchangeTokens);
      if (!qRes.ok) {
        angelError = qRes.error;
      } else {
        for (const item of qRes.fetched) {
          const key = `${item.exchange}:${item.symbolToken}`;
          const meta = metaByKey.get(key);
          if (!meta) continue;
          const row = {
            symbol: meta.symbol,
            display_name: meta.displayName,
            exchange: item.exchange,
            token: String(item.symbolToken),
            asset_type: meta.assetType,
            ltp: item.ltp,
            open_price: item.open,
            high_price: item.high,
            low_price: item.low,
            close_price: item.close,
            net_change: item.netChange,
            percent_change: item.percentChange,
            volume: item.tradeVolume || 0,
            oi: item.opnInterest || 0,
            feed_time: item.exchFeedTime || nowIso,
            data_status: item.ltp > 0 ? (indianSession.isOpen ? "LIVE" : "MARKET_CLOSED") : "UNAVAILABLE",
            source: "Angel One SmartAPI",
            updated_at: nowIso,
          };
          cacheMap.set(meta.symbol, row);
          upserts.push(row);
        }
      }
    }
  }

  if (upserts.length > 0) {
    await supabase.from("market_quotes_cache").upsert(upserts, { onConflict: "symbol" });
  }

  for (const pos of openPositions) {
    const isCrypto = pos.asset_type === "CRYPTO_SPOT" || isCryptoInstrument(pos.symbol);
    const quote = cacheMap.get(isCrypto ? "BITCOIN" : pos.symbol);
    if (quote && Number(quote.ltp) > 0) {
      const livePx = Number(quote.ltp);
      const isLong = pos.side === "BUY" || pos.side === "BUY_CE" || pos.side === "BUY_PE";
      const mult = isCrypto ? usdInrRate : 1;
      const unrealInr = Math.round((isLong ? livePx - Number(pos.entry_price) : Number(pos.entry_price) - livePx) * Number(pos.quantity) * mult * 100) / 100;
      pos.current_price = livePx;
      pos.unrealized_pnl = unrealInr;
      await supabase
        .from("positions")
        .update({ current_price: livePx, unrealized_pnl: unrealInr, updated_at: nowIso })
        .eq("position_id", pos.position_id)
        .eq("status", "OPEN");
    }
  }

  return { quotes: Array.from(cacheMap.values()), usdInrRate, angelError };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const auth = await verifyGatewayOrWorkerRequest(req, supabase, ["gateway", "worker"]);
  if (!auth.authorized) {
    return jsonResponse({ error: "Unauthorized gateway request" }, 401);
  }

  const url = new URL(req.url);
  const path = getSubPath(req.url);
  const indianSession = getIndianMarketSession();
  const cryptoSession = getCryptoSession();

  try {
    if (path === "/health" && req.method === "GET") {
      return jsonResponse({
        ok: true,
        service: "ai-trader-cloud-api",
        angelConfigured: isAngelConfigured(),
        indianSession,
        cryptoSession,
        timestamp: new Date().toISOString(),
      });
    }

    if ((path === "/overview" || path === "/") && req.method === "GET") {
      const watchSym = (url.searchParams.get("symbol") || "").toUpperCase();
      let { data: account } = await supabase.from("paper_account").select("*").eq("id", "default").single();
      if (!account) return jsonResponse({ error: "Account not initialized" }, 500);

      const selInst = String(account.selected_instrument || "NIFTY").toUpperCase();
      if (account.auto_trade_active && !isCryptoInstrument(selInst) && !indianSession.isOpen) {
        const { data: updatedAcc } = await supabase
          .from("paper_account")
          .update({
            auto_trade_active: false,
            last_worker_status: `AUTO_OFF_SESSION_CLOSED: ${indianSession.message}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", account.id)
          .select("*")
          .single();
        if (updatedAcc) account = updatedAcc;
      }

      const { data: openPosRaw } = await supabase
        .from("positions")
        .select("*")
        .eq("account_id", account.id)
        .eq("status", "OPEN")
        .order("opened_at", { ascending: false });
      const openPositions = openPosRaw || [];

      const { quotes, usdInrRate, angelError } = await ensureFreshQuotes(
        supabase,
        openPositions,
        watchSym ? [watchSym, selInst] : [selInst]
      );

      const { data: closedPosRaw } = await supabase
        .from("positions")
        .select("*")
        .eq("account_id", account.id)
        .eq("status", "CLOSED")
        .order("closed_at", { ascending: false })
        .limit(40);

      const { data: txRaw } = await supabase
        .from("transactions")
        .select("*")
        .eq("account_id", account.id)
        .order("created_at", { ascending: false })
        .limit(50);

      const { data: sigRaw } = await supabase
        .from("ai_signals")
        .select("*")
        .eq("account_id", account.id)
        .order("created_at", { ascending: false })
        .limit(40);

      const { data: kvRows } = await supabase
        .from("system_kv")
        .select("key, value")
        .in("key", ["live_scan_state", "scripmaster_last_sync", "last_session_event"]);

      const kvMap = new Map<string, any>();
      for (const r of kvRows || []) kvMap.set(r.key, r.value);

      const openUnrealizedInr = openPositions.reduce((s: number, p: any) => s + Number(p.unrealized_pnl || 0), 0);
      const avail = Number(account.available_balance || 0);
      const invested = Number(account.invested_amount || 0);
      const initCap = Number(account.initial_capital || 100000);
      const portfolioValue = Math.round((avail + invested + openUnrealizedInr) * 100) / 100;
      const overallPnl = Math.round((portfolioValue - initCap) * 100) / 100;
      const todayPnl = Math.round((Number(account.today_realized_pnl || 0) + openUnrealizedInr) * 100) / 100;

      const { data: expMeta } = await supabase
        .from("instrument_master")
        .select("name, expiry, expiry_date, lotsize")
        .eq("instrumenttype", "OPTIDX")
        .gte("expiry_date", indianSession.istDateStr)
        .order("expiry_date", { ascending: true })
        .limit(600);

      const indexMeta: Record<string, { nearestExpiry: string; expiryDate: string; lotSize: number }> = {};
      for (const r of expMeta || []) {
        if (!indexMeta[r.name]) {
          indexMeta[r.name] = {
            nearestExpiry: r.expiry,
            expiryDate: r.expiry_date,
            lotSize: Number(r.lotsize || 1),
          };
        }
      }

      return jsonResponse({
        account: {
          ...account,
          allocated_budget_preview: Math.round(computeAllocatedBudget(account) * 100) / 100,
        },
        portfolio: {
          portfolio_value: portfolioValue,
          initial_capital: initCap,
          available_balance: avail,
          invested_amount: invested,
          open_unrealized_pnl: Math.round(openUnrealizedInr * 100) / 100,
          today_pnl: todayPnl,
          today_realized_pnl: Number(account.today_realized_pnl || 0),
          overall_pnl: overallPnl,
          realized_pnl: Number(account.realized_pnl || 0),
          total_charges_paid: Number(account.total_charges_paid || 0),
          usd_inr_rate: usdInrRate,
        },
        sessions: {
          indian: indianSession,
          crypto: cryptoSession,
        },
        quotes,
        indexMeta,
        angelConnected: !angelError && isAngelConfigured(),
        angelError,
        openPositions,
        closedPositions: closedPosRaw || [],
        transactions: txRaw || [],
        aiSignals: sigRaw || [],
        liveScanState: kvMap.get("live_scan_state") || null,
        scripSyncMeta: kvMap.get("scripmaster_last_sync") || null,
        lastSessionEvent: kvMap.get("last_session_event") || null,
      });
    }

    if (path === "/quotes" && req.method === "GET") {
      const symParam = url.searchParams.get("symbols") || "";
      const extra = symParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
      const { data: openPos } = await supabase.from("positions").select("*").eq("status", "OPEN");
      const { quotes, usdInrRate, angelError } = await ensureFreshQuotes(supabase, openPos || [], extra);
      return jsonResponse({
        quotes,
        usdInrRate,
        angelConnected: !angelError && isAngelConfigured(),
        angelError,
        indianSession,
        cryptoSession,
      });
    }

    if (path === "/candles" && req.method === "GET") {
      const symbol = (url.searchParams.get("symbol") || "NIFTY").trim().toUpperCase();
      const tf = (url.searchParams.get("timeframe") || "5m").trim();
      const paramExch = url.searchParams.get("exchange") || "";
      const paramTok = url.searchParams.get("token") || "";

      const isCrypto = isCryptoInstrument(symbol);
      if (isCrypto) {
        const [cRes, qRes] = await Promise.all([
          fetchBitcoinCandles(tf, 200),
          fetchBitcoinQuote(),
        ]);
        if (!cRes.ok) {
          return jsonResponse({ ok: false, error: cRes.error, candles: [], symbol: "BITCOIN", timeframe: tf });
        }
        const livePrice = qRes.ok ? qRes.price : cRes.candles[cRes.candles.length - 1]?.close || 0;
        const merged = mergeLiveTickIntoCandles(cRes.candles, livePrice, tf);
        const v12 = merged.length >= 25 ? computeV12Engine(merged) : [];
        const lastV12 = v12.length ? v12[v12.length - 1] : null;
        return jsonResponse({
          ok: true,
          symbol: "BITCOIN",
          displayName: "Bitcoin (BTC/USDT)",
          exchange: "CRYPTO",
          token: "BTCUSDT",
          timeframe: tf,
          candles: merged,
          livePrice,
          openPrice: qRes.ok ? qRes.open : merged[0]?.open || livePrice,
          change: qRes.ok ? qRes.change : 0,
          changePct: qRes.ok ? qRes.changePct : 0,
          source: cRes.source,
          dataStatus: "LIVE",
          v12Summary: lastV12,
        });
      }

      let exch = paramExch;
      let token = paramTok;
      let displayName = symbol;
      if (!exch || !token) {
        const spec = await resolveInstrumentSpec(supabase, symbol);
        if (!spec) {
          return jsonResponse({ ok: false, error: `Instrument '${symbol}' not found in Angel One ScripMaster`, candles: [] });
        }
        exch = spec.exchange;
        token = spec.token;
        displayName = spec.name;
      }

      const ttl = tf === "1m" ? 6000 : tf === "5m" ? 15000 : 35000;
      const [cRes, qRes] = await Promise.all([
        fetchAngelCandles(supabase, exch, token, tf, ttl),
        fetchAngelQuotes(supabase, { [exch]: [token] }),
      ]);

      if (!cRes.ok) {
        return jsonResponse({
          ok: false,
          error: cRes.error,
          candles: [],
          symbol,
          displayName,
          exchange: exch,
          token,
          timeframe: tf,
          dataStatus: "UNAVAILABLE",
        });
      }

      const liveQ = qRes.ok && qRes.fetched.length > 0 ? qRes.fetched[0] : null;
      let finalCandles = cRes.candles;
      if (liveQ && liveQ.ltp > 0 && indianSession.isOpen) {
        finalCandles = mergeLiveTickIntoCandles(cRes.candles, liveQ.ltp, tf);
      }

      const v12 = finalCandles.length >= 25 ? computeV12Engine(finalCandles) : [];
      const lastV12 = v12.length ? v12[v12.length - 1] : null;
      const lastCandle = finalCandles[finalCandles.length - 1];

      return jsonResponse({
        ok: true,
        symbol,
        displayName,
        exchange: exch,
        token,
        timeframe: tf,
        candles: finalCandles,
        livePrice: liveQ?.ltp || lastCandle?.close || 0,
        openPrice: liveQ?.open || lastCandle?.open || 0,
        change: liveQ?.netChange || 0,
        changePct: liveQ?.percentChange || 0,
        source: "Angel One SmartAPI",
        dataStatus: indianSession.isOpen ? "LIVE" : "MARKET_CLOSED",
        indianSession,
        v12Summary: lastV12,
      });
    }

    if (path === "/options-chain" && req.method === "GET") {
      const underlying = (url.searchParams.get("underlying") || "NIFTY").toUpperCase();
      const reqExpiry = url.searchParams.get("expiry") || "";
      const spec = CORE_INDICES[underlying];
      if (!spec) {
        return jsonResponse({ error: `Unsupported F&O underlying ${underlying}` }, 400);
      }

      const { data: expRows } = await supabase
        .from("instrument_master")
        .select("expiry, expiry_date, lotsize")
        .eq("name", underlying)
        .eq("exch_seg", spec.optionExch)
        .eq("instrumenttype", "OPTIDX")
        .gte("expiry_date", indianSession.istDateStr)
        .order("expiry_date", { ascending: true })
        .limit(300);

      if (!expRows || expRows.length === 0) {
        return jsonResponse({ error: `No options synced for ${underlying}. Run sync-instruments.` }, 404);
      }

      const expiries: Array<{ expiry: string; expiryDate: string }> = [];
      const seenExp = new Set<string>();
      for (const r of expRows) {
        if (!seenExp.has(r.expiry_date)) {
          seenExp.add(r.expiry_date);
          expiries.push({ expiry: r.expiry, expiryDate: r.expiry_date });
        }
      }
      const chosenExpiry = expiries.find((e) => e.expiryDate === reqExpiry || e.expiry === reqExpiry)?.expiryDate || expiries[0].expiryDate;
      const lotSize = Number(expRows[0]?.lotsize || 1);

      const spotRes = await fetchAngelQuotes(supabase, { [spec.exchange]: [spec.token] });
      let spotPrice = 0;
      if (spotRes.ok && spotRes.fetched.length > 0) {
        spotPrice = Number(spotRes.fetched[0].ltp || 0);
      } else {
        const { data: cachedSpot } = await supabase.from("market_quotes_cache").select("ltp").eq("symbol", underlying).maybeSingle();
        spotPrice = Number(cachedSpot?.ltp || 0);
      }

      if (spotPrice <= 0) {
        return jsonResponse({ error: `Spot price unavailable for ${underlying}`, expiries, lotSize }, 503);
      }

      const atm = Math.round(spotPrice / spec.strikeStep) * spec.strikeStep;
      const strikes: number[] = [];
      for (let i = -7; i <= 7; i++) strikes.push(atm + i * spec.strikeStep);

      const { data: chainContracts } = await supabase
        .from("instrument_master")
        .select("*")
        .eq("name", underlying)
        .eq("exch_seg", spec.optionExch)
        .eq("instrumenttype", "OPTIDX")
        .eq("expiry_date", chosenExpiry)
        .in("strike", strikes)
        .order("strike", { ascending: true });

      const tokens = (chainContracts || []).map((c: any) => String(c.token));
      const quoteByTok = new Map<string, AngelQuoteItem>();
      let quoteErr: string | null = null;
      if (tokens.length > 0) {
        const qRes = await fetchAngelQuotes(supabase, { [spec.optionExch]: tokens });
        if (qRes.ok) {
          for (const q of qRes.fetched) quoteByTok.set(String(q.symbolToken), q);
        } else {
          quoteErr = qRes.error;
        }
      }

      const byStrike = new Map<number, { strike: number; ce: any | null; pe: any | null }>();
      for (const s of strikes) byStrike.set(s, { strike: s, ce: null, pe: null });

      for (const c of chainContracts || []) {
        const row = byStrike.get(Number(c.strike));
        if (!row) continue;
        const q = quoteByTok.get(String(c.token));
        const bid = Number(q?.depth?.buy?.[0]?.price || 0);
        const ask = Number(q?.depth?.sell?.[0]?.price || 0);
        const ltp = Number(q?.ltp || 0);
        const item = {
          symbol: String(c.symbol),
          token: String(c.token),
          exchange: String(c.exch_seg),
          expiry: String(c.expiry),
          expiryDate: String(c.expiry_date),
          strike: Number(c.strike),
          optionType: String(c.option_type),
          lotSize: Number(c.lotsize || lotSize),
          ltp,
          netChange: Number(q?.netChange || 0),
          percentChange: Number(q?.percentChange || 0),
          oi: Number(q?.opnInterest || 0),
          volume: Number(q?.tradeVolume || 0),
          bid,
          ask,
          lotCost: Math.round(ltp * Number(c.lotsize || lotSize) * 100) / 100,
        };
        if (c.option_type === "CE") row.ce = item;
        else if (c.option_type === "PE") row.pe = item;
      }

      return jsonResponse({
        underlying,
        displayName: spec.displayName,
        spotPrice,
        atmStrike: atm,
        strikeStep: spec.strikeStep,
        lotSize,
        chosenExpiry,
        expiries,
        dataStatus: indianSession.isOpen ? "LIVE" : "MARKET_CLOSED",
        source: "Angel One SmartAPI",
        quoteError: quoteErr,
        chain: Array.from(byStrike.values()).sort((a, b) => a.strike - b.strike),
      });
    }

    if (path === "/search" && req.method === "GET") {
      const q = (url.searchParams.get("q") || "").trim().toUpperCase();
      const results: any[] = [];
      if (!q || "BITCOIN BTCUSDT CRYPTO".includes(q)) {
        results.push({
          symbol: "BITCOIN",
          name: "Bitcoin (BTC/USDT Spot)",
          exchange: "CRYPTO",
          token: "BTCUSDT",
          instrumenttype: "CRYPTO_SPOT",
          lotsize: 1,
        });
      }

      if (!q) {
        for (const c of Object.values(CORE_INDICES)) {
          results.push({
            symbol: c.symbol,
            name: c.displayName,
            exchange: c.exchange,
            token: c.token,
            instrumenttype: "AMXIDX",
            lotsize: 1,
          });
        }
        for (const eq of Object.values(POPULAR_EQUITY_TOKENS)) {
          results.push({
            symbol: eq.symbol,
            name: eq.name,
            exchange: "NSE",
            token: eq.token,
            instrumenttype: "EQ",
            lotsize: 1,
          });
        }
      } else {
        const cleanQ = q.replace(/[^A-Z0-9\-\s]/g, "");
        const { data: dbRows } = await supabase
          .from("instrument_master")
          .select("symbol, name, exch_seg, token, instrumenttype, expiry, expiry_date, strike, option_type, lotsize")
          .or(`symbol.ilike.%${cleanQ}%,name.ilike.%${cleanQ}%`)
          .order("instrumenttype", { ascending: true })
          .limit(35);
        for (const r of dbRows || []) {
          results.push({
            symbol: r.symbol,
            name: r.name,
            exchange: r.exch_seg,
            token: r.token,
            instrumenttype: r.instrumenttype,
            expiry: r.expiry,
            expiryDate: r.expiry_date,
            strike: r.strike,
            optionType: r.option_type,
            lotsize: r.lotsize,
          });
        }
      }

      return jsonResponse({ results: results.slice(0, 40) });
    }

    if (path === "/auto-trade/toggle" && req.method === "POST") {
      const body = await req.json();
      const active = Boolean(body.active);
      const { data: account } = await supabase.from("paper_account").select("*").eq("id", "default").single();
      if (!account) return jsonResponse({ error: "Account not found" }, 404);

      const selected = String(body.instrument || account.selected_instrument || "NIFTY").toUpperCase().trim();
      const isCrypto = isCryptoInstrument(selected);

      if (active) {
        if (account.kill_switch_active) {
          return jsonResponse({ error: "Kill Switch is active. Reset Kill Switch in Account settings first." }, 400);
        }
        if (!isCrypto && !indianSession.isOpen) {
          return jsonResponse({
            error: `Indian markets are currently closed (${indianSession.message}). Auto Trade is locked for ${selected} outside 09:15–15:30 IST. Bitcoin remains available 24/7.`,
            indianSession,
          }, 400);
        }
        const spec = await resolveInstrumentSpec(supabase, selected);
        if (!spec) {
          return jsonResponse({ error: `Unknown trading instrument '${selected}'` }, 400);
        }

        const nowIso = new Date().toISOString();
        const { data: updated, error: updErr } = await supabase
          .from("paper_account")
          .update({
            auto_trade_active: true,
            selected_instrument: spec.symbol,
            auto_trade_activated_at: nowIso,
            last_worker_status: `WAITING_FRESH_V12_SIGNAL (${spec.symbol})`,
            updated_at: nowIso,
          })
          .eq("id", account.id)
          .select("*")
          .single();

        if (updErr) return jsonResponse({ error: updErr.message }, 500);
        return jsonResponse({
          success: true,
          account: updated,
          message: `Auto Trade ENABLED for ${spec.symbol}. Waiting for the next new V12 signal completed after now (no immediate trade).`,
        });
      } else {
        const nowIso = new Date().toISOString();
        const { data: updated } = await supabase
          .from("paper_account")
          .update({
            auto_trade_active: false,
            selected_instrument: isCrypto ? "BITCOIN" : selected,
            last_worker_status: "AUTO_TRADE_OFF",
            updated_at: nowIso,
          })
          .eq("id", account.id)
          .select("*")
          .single();
        return jsonResponse({ success: true, account: updated, message: "Auto Trade turned OFF cleanly." });
      }
    }

    if (path === "/settings" && req.method === "POST") {
      const body = await req.json();
      const allowedMode = body.trading_mode === "REAL_LOCKED" ? "REAL_LOCKED" : "PAPER";
      const allowedAlloc = ["ONE_THIRD", "TWO_THIRDS", "FULL", "CUSTOM"].includes(body.capital_allocation_mode)
        ? body.capital_allocation_mode
        : undefined;

      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.trading_mode !== undefined) patch.trading_mode = allowedMode;
      if (allowedAlloc) patch.capital_allocation_mode = allowedAlloc;
      if (body.custom_allocation_amount !== undefined) patch.custom_allocation_amount = Math.max(500, Number(body.custom_allocation_amount));
      if (body.risk_per_trade_pct !== undefined) patch.risk_per_trade_pct = Math.max(0.2, Math.min(15, Number(body.risk_per_trade_pct)));
      if (body.max_open_positions !== undefined) patch.max_open_positions = Math.max(1, Math.min(10, Math.round(Number(body.max_open_positions))));
      if (body.max_trades_per_day !== undefined) patch.max_trades_per_day = Math.max(1, Math.min(100, Math.round(Number(body.max_trades_per_day))));
      if (body.max_daily_loss_amount !== undefined) patch.max_daily_loss_amount = Math.max(100, Number(body.max_daily_loss_amount));
      if (body.max_daily_loss_pct !== undefined) patch.max_daily_loss_pct = Math.max(0.5, Math.min(50, Number(body.max_daily_loss_pct)));
      if (body.daily_profit_target !== undefined) patch.daily_profit_target = Math.max(0, Number(body.daily_profit_target));
      if (body.stop_loss_pct !== undefined) patch.stop_loss_pct = Math.max(0.1, Math.min(25, Number(body.stop_loss_pct)));
      if (body.target_profit_pct !== undefined) patch.target_profit_pct = Math.max(0.2, Math.min(50, Number(body.target_profit_pct)));
      if (body.indian_min_target_inr !== undefined) patch.indian_min_target_inr = Math.max(100, Number(body.indian_min_target_inr));
      if (body.indian_max_loss_inr !== undefined) patch.indian_max_loss_inr = Math.max(200, Number(body.indian_max_loss_inr));
      if (body.max_capital_used_pct !== undefined) patch.max_capital_used_pct = Math.max(10, Math.min(100, Number(body.max_capital_used_pct)));
      if (body.selected_timeframe !== undefined) patch.selected_timeframe = String(body.selected_timeframe);
      if (body.equity_stocks_enabled !== undefined) patch.equity_stocks_enabled = Boolean(body.equity_stocks_enabled);

      const { data: updated, error } = await supabase
        .from("paper_account")
        .update(patch)
        .eq("id", "default")
        .select("*")
        .single();

      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ success: true, account: updated });
    }

    if (path === "/funds" && req.method === "POST") {
      const body = await req.json();
      const action = String(body.action || "").toUpperCase();
      const { data: account } = await supabase.from("paper_account").select("*").eq("id", "default").single();
      if (!account) return jsonResponse({ error: "Account not found" }, 404);
      const nowIso = new Date().toISOString();

      if (action === "RESET") {
        const { data: openPos } = await supabase.from("positions").select("position_id").eq("status", "OPEN");
        if (openPos && openPos.length > 0) {
          return jsonResponse({ error: "Please close open positions before resetting virtual account." }, 400);
        }
        const resetAmount = Math.max(10_000, Number(body.amount || 100_000));
        const { data: updated } = await supabase
          .from("paper_account")
          .update({
            initial_capital: resetAmount,
            available_balance: resetAmount,
            invested_amount: 0,
            realized_pnl: 0,
            today_realized_pnl: 0,
            total_charges_paid: 0,
            today_trades_count: 0,
            auto_trade_active: false,
            kill_switch_active: false,
            last_worker_status: "ACCOUNT_RESET",
            updated_at: nowIso,
          })
          .eq("id", account.id)
          .select("*")
          .single();

        await supabase.from("transactions").insert({
          account_id: account.id,
          tx_id: `TX-RST-${Date.now()}`,
          tx_type: "RESET",
          symbol: "VIRTUAL_INR",
          underlying: "VIRTUAL_INR",
          side: "CREDIT",
          quantity: 1,
          lot_size: 1,
          price: resetAmount,
          amount: resetAmount,
          charges: 0,
          realized_pnl: 0,
          reason: `Virtual account reset to ₹${resetAmount.toLocaleString("en-IN")}`,
          currency: "INR",
        });

        return jsonResponse({ success: true, account: updated });
      }

      const amt = Math.max(100, Number(body.amount || 0));
      if (action === "ADD") {
        const nextAvail = Math.round((Number(account.available_balance) + amt) * 100) / 100;
        const nextInit = Math.round((Number(account.initial_capital) + amt) * 100) / 100;
        const { data: updated } = await supabase
          .from("paper_account")
          .update({ available_balance: nextAvail, initial_capital: nextInit, updated_at: nowIso })
          .eq("id", account.id)
          .select("*")
          .single();
        await supabase.from("transactions").insert({
          account_id: account.id,
          tx_id: `TX-DEP-${Date.now()}`,
          tx_type: "ADJUSTMENT",
          symbol: "VIRTUAL_INR",
          underlying: "VIRTUAL_INR",
          side: "ADD_FUNDS",
          quantity: 1,
          lot_size: 1,
          price: amt,
          amount: amt,
          charges: 0,
          realized_pnl: 0,
          reason: `Added ₹${amt.toLocaleString("en-IN")} virtual capital`,
          currency: "INR",
        });
        return jsonResponse({ success: true, account: updated });
      }

      if (action === "WITHDRAW") {
        if (amt > Number(account.available_balance)) {
          return jsonResponse({ error: `Cannot withdraw ₹${amt}; idle balance is ₹${account.available_balance}` }, 400);
        }
        const nextAvail = Math.round((Number(account.available_balance) - amt) * 100) / 100;
        const nextInit = Math.max(0, Math.round((Number(account.initial_capital) - amt) * 100) / 100);
        const { data: updated } = await supabase
          .from("paper_account")
          .update({ available_balance: nextAvail, initial_capital: nextInit, updated_at: nowIso })
          .eq("id", account.id)
          .select("*")
          .single();
        await supabase.from("transactions").insert({
          account_id: account.id,
          tx_id: `TX-WDR-${Date.now()}`,
          tx_type: "ADJUSTMENT",
          symbol: "VIRTUAL_INR",
          underlying: "VIRTUAL_INR",
          side: "WITHDRAW",
          quantity: 1,
          lot_size: 1,
          price: amt,
          amount: amt,
          charges: 0,
          realized_pnl: 0,
          reason: `Withdrew ₹${amt.toLocaleString("en-IN")} virtual capital`,
          currency: "INR",
        });
        return jsonResponse({ success: true, account: updated });
      }

      return jsonResponse({ error: "Invalid funds action" }, 400);
    }

    if (path === "/positions/close" && req.method === "POST") {
      const body = await req.json();
      const { data: account } = await supabase.from("paper_account").select("*").eq("id", "default").single();
      if (!account) return jsonResponse({ error: "Account not found" }, 404);

      const query = supabase.from("positions").select("*").eq("account_id", account.id).eq("status", "OPEN");
      const { data: targets } = body.close_all ? await query : await query.eq("position_id", String(body.position_id || ""));

      if (!targets || targets.length === 0) {
        return jsonResponse({ error: "No matching OPEN position found" }, 404);
      }

      const usdInrRate = await fetchUsdInrRate(supabase);
      const results: any[] = [];

      for (const pos of targets) {
        const isCrypto = pos.asset_type === "CRYPTO_SPOT" || isCryptoInstrument(pos.symbol);
        let livePx: number | null = null;
        if (isCrypto) {
          const bq = await fetchBitcoinQuote();
          livePx = bq.ok ? bq.price : Number(pos.current_price);
        } else {
          const aq = await fetchAngelQuotes(supabase, { [pos.exchange]: [String(pos.instrument_token)] });
          if (aq.ok && aq.fetched.length > 0 && aq.fetched[0].ltp > 0) {
            livePx = Number(aq.fetched[0].ltp);
          } else {
            livePx = Number(pos.current_price);
          }
        }
        const res = await closePaperPosition(supabase, account, pos, livePx, "Manual Exit from App", usdInrRate);
        results.push({ position_id: pos.position_id, realized_pnl: res.realizedPnlInr });
      }

      return jsonResponse({ success: true, closed: results });
    }

    if (path === "/paper-order" && req.method === "POST") {
      const body = await req.json();
      const { data: account } = await supabase.from("paper_account").select("*").eq("id", "default").single();
      if (!account) return jsonResponse({ error: "Account not found" }, 404);
      if (account.kill_switch_active) return jsonResponse({ error: "Kill Switch active" }, 400);

      const underlying = String(body.underlying || body.symbol || "NIFTY").toUpperCase();
      const direction = String(body.direction || "BUY").toUpperCase();
      const isCrypto = isCryptoInstrument(underlying);

      if (!isCrypto && !indianSession.isOpen) {
        return jsonResponse({
          error: `Indian exchanges are currently closed (${indianSession.message}). New paper orders open only between 09:15–15:30 IST. Bitcoin 24/7 remains open.`,
        }, 400);
      }

      const usdInrRate = await fetchUsdInrRate(supabase);
      const budget = computeAllocatedBudget(account);
      let candidate: AICandidateContract;
      let dataSource = "Angel One SmartAPI";

      if (isCrypto) {
        const bq = await fetchBitcoinQuote();
        if (!bq.ok) return jsonResponse({ error: bq.error }, 503);
        dataSource = bq.source;
        candidate = {
          symbol: "BITCOIN",
          token: "BTCUSDT",
          exchange: "CRYPTO",
          optionType: "SPOT",
          strikePrice: 0,
          expiryDate: "",
          lotSize: 1,
          ltp: bq.price,
          volume: bq.volume,
          oi: 0,
          spreadPct: 0.0005,
          approxDelta: 1.0,
        };
      } else if (body.token && body.exchange && body.option_symbol) {
        const qRes = await fetchAngelQuotes(supabase, { [String(body.exchange)]: [String(body.token)] });
        if (!qRes.ok || qRes.fetched.length === 0 || qRes.fetched[0].ltp <= 0) {
          return jsonResponse({ error: "Live Angel One option quote unavailable for selected contract" }, 503);
        }
        const q = qRes.fetched[0];
        const { data: inst } = await supabase
          .from("instrument_master")
          .select("*")
          .eq("token", String(body.token))
          .eq("exch_seg", String(body.exchange))
          .maybeSingle();

        candidate = {
          symbol: String(body.option_symbol),
          token: String(body.token),
          exchange: String(body.exchange),
          optionType: body.option_symbol.endsWith("PE") ? "PE" : "CE",
          strikePrice: Number(inst?.strike || body.strike || 0),
          expiryDate: String(inst?.expiry || body.expiry || ""),
          lotSize: Number(inst?.lotsize || body.lot_size || 1),
          ltp: Number(q.ltp),
          volume: Number(q.tradeVolume || 0),
          oi: Number(q.opnInterest || 0),
          spreadPct: 0.01,
          approxDelta: 0.5,
        };
      } else if (CORE_INDICES[underlying]) {
        const spec = CORE_INDICES[underlying];
        const spotRes = await fetchAngelQuotes(supabase, { [spec.exchange]: [spec.token] });
        if (!spotRes.ok || spotRes.fetched.length === 0 || spotRes.fetched[0].ltp <= 0) {
          return jsonResponse({ error: `Live spot price unavailable for ${underlying}` }, 503);
        }
        const spot = Number(spotRes.fetched[0].ltp);
        const isBullOpt = direction === "BUY" || direction === "BUY_CE";
        const ist = getIstDate();
        const candRes = await selectRealOptionCandidate(
          supabase,
          underlying,
          spot,
          isBullOpt,
          budget,
          formatIstDateYmd(ist),
          ist.getUTCHours() * 60 + ist.getUTCMinutes()
        );
        if (!candRes.ok) return jsonResponse({ error: candRes.reason }, 400);
        candidate = candRes.candidate;
      } else {
        const spec = await resolveInstrumentSpec(supabase, underlying);
        if (!spec) return jsonResponse({ error: `Unknown instrument ${underlying}` }, 404);
        const qRes = await fetchAngelQuotes(supabase, { [spec.exchange]: [spec.token] });
        if (!qRes.ok || qRes.fetched.length === 0 || qRes.fetched[0].ltp <= 0) {
          return jsonResponse({ error: `Live quote unavailable for ${spec.symbol}` }, 503);
        }
        candidate = {
          symbol: spec.symbol,
          token: spec.token,
          exchange: spec.exchange,
          optionType: "EQ",
          strikePrice: 0,
          expiryDate: "",
          lotSize: spec.lotSize,
          ltp: Number(qRes.fetched[0].ltp),
          volume: Number(qRes.fetched[0].tradeVolume || 0),
          oi: 0,
          spreadPct: 0.001,
          approxDelta: 1.0,
        };
      }

      const reqLots = Math.max(1, Math.round(Number(body.lots || 1)));
      const lots = isCrypto ? 1 : Math.min(Math.max(1, Math.floor(budget / (candidate.ltp * candidate.lotSize))), reqLots);
      if (!isCrypto && candidate.ltp * candidate.lotSize > Number(account.available_balance)) {
        return jsonResponse({
          error: `Insufficient virtual balance for 1 lot of ${candidate.symbol} (₹${(candidate.ltp * candidate.lotSize).toFixed(0)})`,
        }, 400);
      }

      const slPct = isCrypto ? Math.max(0.2, Number(account.stop_loss_pct || 0.5)) / 100 : 0.12;
      const tpPct = isCrypto ? Math.max(0.3, Number(account.target_profit_pct || 0.5)) / 100 : 0.2;
      const qty = isCrypto
        ? Math.floor(((budget / usdInrRate) / candidate.ltp) * 10000) / 10000
        : lots * candidate.lotSize;

      if (qty <= 0) return jsonResponse({ error: "Calculated order quantity is zero." }, 400);

      const isLongSide = isCrypto ? direction !== "SELL" : true;
      const stopLoss = Math.round((isLongSide ? candidate.ltp * (1 - slPct) : candidate.ltp * (1 + slPct)) * 100) / 100;
      const takeProfit = Math.round((isLongSide ? candidate.ltp * (1 + tpPct) : candidate.ltp * (1 - tpPct)) * 100) / 100;
      const sigStr = isCrypto ? (direction === "SELL" ? "SELL" : "BUY") : candidate.optionType === "PE" ? "SELL" : "BUY";

      const synthSig: any = {
        barIndex: 0,
        barTime: Math.floor(Date.now() / 1000),
        signal: sigStr,
        confidence: 100,
        trendDir: sigStr === "BUY" ? 1 : -1,
        closePrice: candidate.ltp,
        baseline: candidate.ltp,
        atr: candidate.ltp * 0.01,
        rsi: 50,
        chopIndex: 45,
        fuelState: "Manual Paper Order",
        stretchAtr: 0,
        roomToWallAtr: 2,
        bodyRatio: 1,
        upperWickRatio: 0,
        lowerWickRatio: 0,
        isExhausted: false,
        hittingWall: false,
        isSidewaysBox: false,
        higherLowStaircase: false,
        lowerHighStaircase: false,
        patternText: "Manual Entry",
      };
      const synthAi: any = {
        decision: "APPROVED",
        score: 100,
        reason: `Manual Paper ${direction} Order (${candidate.symbol} @ ${candidate.ltp})`,
        warnings: [],
        breakdown: {},
        suggestedLots: lots,
        suggestedQuantity: qty,
        investedInr: isCrypto ? qty * candidate.ltp * usdInrRate : qty * candidate.ltp,
        stopLoss,
        takeProfit,
        expectedProfitInr: 0,
        maxLossInr: 0,
        riskRewardRatio: Math.round((tpPct / slPct) * 100) / 100,
        marketStrengthLabel: "MODERATE",
      };

      const openRes = await openPaperPosition(
        supabase,
        account,
        candidate,
        synthSig,
        synthAi,
        underlying,
        usdInrRate,
        isCrypto,
        dataSource
      );

      if (!openRes.ok) return jsonResponse({ error: openRes.error }, 400);
      return jsonResponse({ success: true, positionId: openRes.positionId, candidate });
    }

    if (path === "/risk/kill-switch" && req.method === "POST") {
      const body = await req.json();
      const active = Boolean(body.active);
      const { data: account } = await supabase.from("paper_account").select("*").eq("id", "default").single();
      if (!account) return jsonResponse({ error: "Account not found" }, 404);
      const nowIso = new Date().toISOString();

      if (active) {
        const { data: openPos } = await supabase
          .from("positions")
          .select("*")
          .eq("account_id", account.id)
          .eq("status", "OPEN");
        const usdInrRate = await fetchUsdInrRate(supabase);
        for (const pos of openPos || []) {
          const isCrypto = pos.asset_type === "CRYPTO_SPOT" || isCryptoInstrument(pos.symbol);
          const bq = isCrypto ? await fetchBitcoinQuote() : null;
          const livePx = isCrypto
            ? (bq?.ok ? bq.price : Number(pos.current_price))
            : Number(pos.current_price);
          await closePaperPosition(supabase, account, pos, livePx, "Kill Switch Emergency Close", usdInrRate);
        }
        const { data: updated } = await supabase
          .from("paper_account")
          .update({
            kill_switch_active: true,
            auto_trade_active: false,
            last_worker_status: "KILL_SWITCH_ACTIVE",
            updated_at: nowIso,
          })
          .eq("id", account.id)
          .select("*")
          .single();
        return jsonResponse({ success: true, account: updated });
      } else {
        const { data: updated } = await supabase
          .from("paper_account")
          .update({
            kill_switch_active: false,
            last_worker_status: "AUTO_TRADE_OFF",
            updated_at: nowIso,
          })
          .eq("id", account.id)
          .select("*")
          .single();
        return jsonResponse({ success: true, account: updated });
      }
    }

    if (path === "/reports" && req.method === "GET") {
      const [{ data: closedTrades }, { data: transactions }, { data: summaries }, { data: account }] = await Promise.all([
        supabase.from("positions").select("*").eq("status", "CLOSED").order("closed_at", { ascending: false }).limit(100),
        supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(150),
        supabase.from("daily_summaries").select("*").order("summary_date", { ascending: false }).limit(60),
        supabase.from("paper_account").select("*").eq("id", "default").single(),
      ]);

      const closed = closedTrades || [];
      const wins = closed.filter((t: any) => Number(t.realized_pnl || 0) > 0).length;
      return jsonResponse({
        account,
        stats: {
          totalTrades: closed.length,
          wins,
          losses: closed.length - wins,
          winRatePct: closed.length ? Math.round((wins / closed.length) * 1000) / 10 : 0,
          netRealizedPnl: Math.round(closed.reduce((s: number, t: any) => s + Number(t.realized_pnl || 0), 0) * 100) / 100,
          totalChargesPaid: Number(account?.total_charges_paid || 0),
        },
        closedTrades: closed,
        transactions: transactions || [],
        dailySummaries: summaries || [],
      });
    }

    if (path === "/engine/run-now" && req.method === "POST") {
      const baseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      const res = await fetch(`${baseUrl}/functions/v1/trading-engine?fast=true`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
        },
      });
      const data = await res.json();
      return jsonResponse(data, res.status);
    }

    return jsonResponse({ error: `Unknown trader-api endpoint: ${req.method} ${path}` }, 404);
  } catch (err) {
    return jsonResponse({ error: `trader-api internal error: ${String(err)}` }, 500);
  }
});
