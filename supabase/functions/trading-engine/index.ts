import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { CORS_HEADERS, jsonResponse, verifyGatewayOrWorkerRequest } from "../_shared/auth.ts";
import {
  CORE_INDICES,
  POPULAR_EQUITY_TOKENS,
  AngelQuoteItem,
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
  evaluateWithAIBrain,
  STRATEGY_VERSION,
} from "../_shared/quantEngine.ts";
import { closePaperPosition, openPaperPosition, selectRealOptionCandidate } from "../_shared/paperBroker.ts";

async function refreshAllLiveQuotes(
  supabase: SupabaseClient,
  openPositions: any[],
  extraSymbols: string[] = []
): Promise<{
  quoteBySymbol: Map<string, AngelQuoteItem>;
  quoteByExchToken: Map<string, AngelQuoteItem>;
  btcPrice: number | null;
  btcSource: string;
  angelError: string | null;
  usdInrRate: number;
}> {
  const indianSession = getIndianMarketSession();
  const usdInrRate = await fetchUsdInrRate(supabase);
  const nowIso = new Date().toISOString();
  const cacheRows: any[] = [];

  const btcQ = await fetchBitcoinQuote();
  let btcPrice: number | null = null;
  let btcSource = "UNAVAILABLE";
  if (btcQ.ok) {
    btcPrice = btcQ.price;
    btcSource = btcQ.source;
    cacheRows.push({
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
    });
  } else {
    cacheRows.push({
      symbol: "BITCOIN",
      display_name: "Bitcoin (BTC/USDT)",
      exchange: "CRYPTO",
      token: "BTCUSDT",
      asset_type: "CRYPTO_SPOT",
      ltp: 0,
      open_price: 0,
      high_price: 0,
      low_price: 0,
      close_price: 0,
      net_change: 0,
      percent_change: 0,
      volume: 0,
      oi: 0,
      feed_time: nowIso,
      data_status: "UNAVAILABLE",
      source: btcQ.error,
      updated_at: nowIso,
    });
  }

  const exchangeTokens: Record<string, string[]> = { NSE: [], BSE: [], NFO: [], BFO: [] };
  const tokenMeta = new Map<string, { symbol: string; displayName: string; assetType: string }>();

  for (const spec of Object.values(CORE_INDICES)) {
    exchangeTokens[spec.exchange].push(spec.token);
    tokenMeta.set(`${spec.exchange}:${spec.token}`, {
      symbol: spec.symbol,
      displayName: spec.displayName,
      assetType: "INDEX_SPOT",
    });
  }

  for (const eq of Object.values(POPULAR_EQUITY_TOKENS)) {
    exchangeTokens.NSE.push(eq.token);
    tokenMeta.set(`NSE:${eq.token}`, {
      symbol: eq.symbol,
      displayName: eq.name,
      assetType: "EQUITY_SPOT",
    });
  }

  for (const pos of openPositions) {
    if (pos.exchange && pos.instrument_token && pos.exchange !== "CRYPTO") {
      if (!exchangeTokens[pos.exchange]) exchangeTokens[pos.exchange] = [];
      exchangeTokens[pos.exchange].push(String(pos.instrument_token));
      tokenMeta.set(`${pos.exchange}:${pos.instrument_token}`, {
        symbol: String(pos.symbol),
        displayName: String(pos.symbol),
        assetType: String(pos.asset_type || "INDEX_F_AND_O"),
      });
    }
  }

  const missingLookup = extraSymbols.filter(
    (s) => s && !isCryptoInstrument(s) && !CORE_INDICES[s] && !POPULAR_EQUITY_TOKENS[s]
  );
  if (missingLookup.length > 0) {
    const { data: extraRows } = await supabase
      .from("instrument_master")
      .select("symbol, name, exch_seg, token, instrumenttype")
      .in("symbol", missingLookup)
      .limit(20);
    for (const r of extraRows || []) {
      const ex = String(r.exch_seg);
      const tok = String(r.token);
      if (!exchangeTokens[ex]) exchangeTokens[ex] = [];
      exchangeTokens[ex].push(tok);
      tokenMeta.set(`${ex}:${tok}`, {
        symbol: String(r.symbol),
        displayName: String(r.name || r.symbol),
        assetType: r.instrumenttype === "OPTIDX" ? "INDEX_F_AND_O" : "EQUITY_SPOT",
      });
    }
  }

  const quoteBySymbol = new Map<string, AngelQuoteItem>();
  const quoteByExchToken = new Map<string, AngelQuoteItem>();
  let angelError: string | null = null;

  const qRes = await fetchAngelQuotes(supabase, exchangeTokens);
  if (!qRes.ok) {
    angelError = qRes.error;
  } else {
      for (const item of qRes.fetched) {
        const key = `${item.exchange}:${item.symbolToken}`;
        const meta = tokenMeta.get(key);
        quoteByExchToken.set(key, item);
        if (meta) {
          quoteBySymbol.set(meta.symbol, item);
          const hasValidPrice = Number(item.ltp) > 0;
          cacheRows.push({
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
            data_status: hasValidPrice ? (indianSession.isOpen ? "LIVE" : "MARKET_CLOSED") : "UNAVAILABLE",
            source: "Angel One SmartAPI",
            updated_at: nowIso,
          });
        }
      }
  }

  if (angelError) {
    for (const spec of Object.values(CORE_INDICES)) {
      cacheRows.push({
        symbol: spec.symbol,
        display_name: spec.displayName,
        exchange: spec.exchange,
        token: spec.token,
        asset_type: "INDEX_SPOT",
        ltp: 0,
        open_price: 0,
        high_price: 0,
        low_price: 0,
        close_price: 0,
        net_change: 0,
        percent_change: 0,
        volume: 0,
        oi: 0,
        feed_time: nowIso,
        data_status: "UNAVAILABLE",
        source: angelError,
        updated_at: nowIso,
      });
    }
  }

  if (cacheRows.length > 0) {
    await supabase.from("market_quotes_cache").upsert(cacheRows, { onConflict: "symbol" });
  }

  return { quoteBySymbol, quoteByExchToken, btcPrice, btcSource, angelError, usdInrRate };
}

async function evaluateAndUpdatePositions(
  supabase: SupabaseClient,
  account: any,
  openPositions: any[],
  quoteByExchToken: Map<string, AngelQuoteItem>,
  btcPrice: number | null,
  usdInrRate: number,
  shouldSquareOffIndian: boolean
): Promise<{ closedCount: number; openUnrealizedInr: number; dailyLossBreached: boolean }> {
  let closedCount = 0;
  let openUnrealizedInr = 0;
  const maxDailyLoss = Math.abs(Number(account.max_daily_loss_amount || 1500));

  for (const pos of openPositions) {
    const isCrypto = pos.asset_type === "CRYPTO_SPOT" || isCryptoInstrument(pos.symbol);
    let livePx: number | null = null;

    if (isCrypto) {
      livePx = btcPrice;
    } else {
      const q = quoteByExchToken.get(`${pos.exchange}:${pos.instrument_token}`);
      if (q && q.ltp > 0) livePx = Number(q.ltp);
    }

    if (livePx === null || livePx <= 0) continue;

    const isLong = pos.side === "BUY" || pos.side === "BUY_CE" || pos.side === "BUY_PE";
    const qty = Number(pos.quantity);
    const entryPx = Number(pos.entry_price);
    const mult = isCrypto ? usdInrRate : 1;
    const unrealizedInr = Math.round((isLong ? livePx - entryPx : entryPx - livePx) * qty * mult * 100) / 100;

    let closeReason: string | null = null;
    if (!isCrypto && shouldSquareOffIndian) {
      closeReason = "Market Close Intraday Square-Off (15:25 IST)";
    } else if (isLong && livePx <= Number(pos.stop_loss)) {
      closeReason = `Stop-Loss Triggered @ ${livePx}`;
    } else if (!isLong && livePx >= Number(pos.stop_loss)) {
      closeReason = `Stop-Loss Triggered @ ${livePx}`;
    } else if (isLong && livePx >= Number(pos.take_profit)) {
      closeReason = `Target Profit Hit @ ${livePx}`;
    } else if (!isLong && livePx <= Number(pos.take_profit)) {
      closeReason = `Target Profit Hit @ ${livePx}`;
    }

    if (closeReason) {
      await closePaperPosition(supabase, account, pos, livePx, closeReason, usdInrRate);
      closedCount++;
    } else {
      // Breakeven trailing stop protection once sufficiently in profit
      let nextStopLoss = Number(pos.stop_loss);
      if (isCrypto) {
        if (isLong && livePx >= entryPx * 1.012) {
          nextStopLoss = Math.max(nextStopLoss, Math.round(entryPx * 1.0055 * 100) / 100);
        } else if (!isLong && livePx <= entryPx * 0.988) {
          nextStopLoss = Math.min(nextStopLoss, Math.round(entryPx * 0.9945 * 100) / 100);
        }
      } else if (isLong && livePx >= entryPx * 1.15) {
        nextStopLoss = Math.max(nextStopLoss, Math.round((entryPx + 2.5) * 100) / 100);
      }

      openUnrealizedInr += unrealizedInr;
      await supabase
        .from("positions")
        .update({
          current_price: livePx,
          stop_loss: nextStopLoss,
          unrealized_pnl: unrealizedInr,
          updated_at: new Date().toISOString(),
        })
        .eq("position_id", pos.position_id)
        .eq("status", "OPEN");
    }
  }

  const { data: latestAcc } = await supabase.from("paper_account").select("*").eq("id", account.id).single();
  const todayRealized = Number(latestAcc?.today_realized_pnl || 0);
  const totalDayPnl = todayRealized + openUnrealizedInr;
  let dailyLossBreached = false;

  if (totalDayPnl <= -maxDailyLoss && maxDailyLoss > 0) {
    dailyLossBreached = true;
    const { data: remOpen } = await supabase
      .from("positions")
      .select("*")
      .eq("account_id", account.id)
      .eq("status", "OPEN");
    for (const pos of remOpen || []) {
      const isCrypto = pos.asset_type === "CRYPTO_SPOT" || isCryptoInstrument(pos.symbol);
      const livePx = isCrypto
        ? btcPrice || Number(pos.current_price)
        : Number(quoteByExchToken.get(`${pos.exchange}:${pos.instrument_token}`)?.ltp || pos.current_price);
      await closePaperPosition(supabase, latestAcc || account, pos, livePx, "Max Daily Loss Limit Guard", usdInrRate);
      closedCount++;
    }
    await supabase
      .from("paper_account")
      .update({
        auto_trade_active: false,
        last_worker_status: `PAUSED_DAILY_LOSS (Day P&L ₹${totalDayPnl.toFixed(0)})`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", account.id);
  }

  return { closedCount, openUnrealizedInr, dailyLossBreached };
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
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const url = new URL(req.url);
  const fastMode = url.searchParams.get("fast") === "true";

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const lockUntilIso = new Date(nowMs + 50_000).toISOString();

  const { data: lockedAcc, error: lockErr } = await supabase
    .from("paper_account")
    .update({ worker_lock_until: lockUntilIso })
    .eq("id", "default")
    .or(`worker_lock_until.is.null,worker_lock_until.lt.${nowIso}`)
    .select("*")
    .maybeSingle();

  if (lockErr || !lockedAcc) {
    return jsonResponse({ skipped: true, reason: lockErr?.message || "Another worker instance holds lock" });
  }

  let account = lockedAcc;

  try {
    const istNow = getIstDate(nowMs);
    const todayIst = formatIstDateYmd(istNow);
    const istMinutes = istNow.getUTCHours() * 60 + istNow.getUTCMinutes();
    const indianSession = getIndianMarketSession(nowMs);
    const cryptoSession = getCryptoSession(nowMs);

    if (account.session_date && account.session_date !== todayIst) {
      await supabase.from("daily_summaries").upsert({
        summary_date: account.session_date,
        trades_count: Number(account.today_trades_count || 0),
        realized_pnl: Number(account.today_realized_pnl || 0),
        ending_equity: Number(account.available_balance || 0) + Number(account.invested_amount || 0),
        net_pnl: Number(account.realized_pnl || 0),
        charges_paid: Number(account.total_charges_paid || 0),
        notes: "Automatic IST End-of-Day Archive",
      }, { onConflict: "summary_date" });

      const { data: resetAcc } = await supabase
        .from("paper_account")
        .update({
          session_date: todayIst,
          today_realized_pnl: 0,
          today_trades_count: 0,
          updated_at: nowIso,
        })
        .eq("id", account.id)
        .select("*")
        .single();
      if (resetAcc) account = resetAcc;
    }

    const { data: openPositionsRaw } = await supabase
      .from("positions")
      .select("*")
      .eq("account_id", account.id)
      .eq("status", "OPEN");
    const openPositions = openPositionsRaw || [];

    const selected = String(account.selected_instrument || "NIFTY").toUpperCase();
    const isCryptoSelected = isCryptoInstrument(selected);

    const quotesRes = await refreshAllLiveQuotes(supabase, openPositions, [selected]);

    if (account.kill_switch_active) {
      for (const pos of openPositions) {
        const isPosCrypto = pos.asset_type === "CRYPTO_SPOT" || isCryptoInstrument(pos.symbol);
        const livePx = isPosCrypto
          ? quotesRes.btcPrice || Number(pos.current_price)
          : Number(quotesRes.quoteByExchToken.get(`${pos.exchange}:${pos.instrument_token}`)?.ltp || pos.current_price);
        await closePaperPosition(supabase, account, pos, livePx, "Emergency Kill Switch", quotesRes.usdInrRate);
      }
      await supabase.from("paper_account").update({
        auto_trade_active: false,
        last_worker_status: "KILL_SWITCH_ACTIVE",
        last_worker_run_at: nowIso,
        updated_at: nowIso,
      }).eq("id", account.id);

      return jsonResponse({ status: "KILL_SWITCH_ACTIVE", closed: openPositions.length });
    }

    const posCheck = await evaluateAndUpdatePositions(
      supabase,
      account,
      openPositions,
      quotesRes.quoteByExchToken,
      quotesRes.btcPrice,
      quotesRes.usdInrRate,
      indianSession.shouldSquareOffIntraday
    );

    const { data: freshAcc } = await supabase.from("paper_account").select("*").eq("id", account.id).single();
    if (freshAcc) account = freshAcc;

    let workerStatus = "IDLE";
    if (account.trading_mode === "REALTIME_REAL") {
      workerStatus = "REAL_TRADING_DISABLED_COMING_SOON";
      if (account.auto_trade_active) {
        await supabase.from("paper_account").update({ auto_trade_active: false, last_worker_status: workerStatus, updated_at: nowIso }).eq("id", account.id);
      }
    } else if (account.trading_mode === "PREVIOUS_MARKET") {
      workerStatus = "PREVIOUS_MARKET_REPLAY_MODE";
    } else if (!account.auto_trade_active) {
      workerStatus = "AUTO_TRADE_OFF";
    } else if (!isCryptoSelected && !indianSession.isOpen) {
      await supabase.from("paper_account").update({
        auto_trade_active: false,
        last_worker_status: `AUTO_OFF_SESSION_CLOSED: ${indianSession.message}`,
        last_worker_run_at: nowIso,
        updated_at: nowIso,
      }).eq("id", account.id);
      await supabase.from("system_kv").upsert({
        key: "last_session_event",
        value: {
          message: `Auto Trade turned OFF for ${selected}: ${indianSession.message}`,
          at: nowIso,
        },
        updated_at: nowIso,
      });
      return jsonResponse({ status: "AUTO_OFF_SESSION_CLOSED", reason: indianSession.message });
    } else if (!posCheck.dailyLossBreached) {
      const sessionCanEnter = isCryptoSelected ? cryptoSession.canEnterNewTrade : indianSession.canEnterNewTrade;
      const { data: currentOpen } = await supabase
        .from("positions")
        .select("position_id, underlying")
        .eq("account_id", account.id)
        .eq("status", "OPEN");

      const openCount = (currentOpen || []).length;
      const hasOpenForSelected = (currentOpen || []).some((p: any) => p.underlying === selected);

      if (!sessionCanEnter) {
        workerStatus = isCryptoSelected ? "WAITING_SESSION" : "NO_NEW_ENTRIES_NEAR_CLOSE";
      } else if (hasOpenForSelected) {
        workerStatus = `MANAGING_OPEN_${selected}`;
      } else if (openCount >= Number(account.max_open_positions || 2)) {
        workerStatus = "MAX_OPEN_POSITIONS_REACHED";
      } else if (Number(account.today_trades_count || 0) >= Number(account.max_trades_per_day || 10)) {
        workerStatus = "MAX_DAILY_TRADES_REACHED";
      } else if (
        Number(account.daily_profit_target || 0) > 0 &&
        Number(account.today_realized_pnl || 0) >= Number(account.daily_profit_target)
      ) {
        workerStatus = "DAILY_PROFIT_TARGET_ACHIEVED";
      } else {
        const { data: cdRow } = await supabase
          .from("system_kv")
          .select("value")
          .eq("key", `cooldown:${selected}`)
          .maybeSingle();
        const cdUntil = Number((cdRow?.value as any)?.until_ms || 0);
        if (Date.now() < cdUntil) {
          workerStatus = `COOLDOWN_${selected}`;
        } else {
          let res5m: { ok: true; candles: any[]; source?: string } | { ok: false; error: string };
          let res15m: { ok: true; candles: any[]; source?: string } | { ok: false; error: string };
          let instExch = "CRYPTO";
          let instTok = "BTCUSDT";
          let lotSz = 1;
          let isEqStock = false;

          if (isCryptoSelected) {
            res5m = await fetchBitcoinCandles("5m", 150);
            res15m = await fetchBitcoinCandles("15m", 100);
          } else if (CORE_INDICES[selected]) {
            const spec = CORE_INDICES[selected];
            instExch = spec.exchange;
            instTok = spec.token;
            res5m = await fetchAngelCandles(supabase, instExch, instTok, "5m", 20_000);
            res15m = await fetchAngelCandles(supabase, instExch, instTok, "15m", 45_000);
          } else {
            const { data: eqRow } = await supabase
              .from("instrument_master")
              .select("*")
              .eq("symbol", selected)
              .limit(1)
              .maybeSingle();
            if (!eqRow) {
              res5m = { ok: false, error: `Unknown instrument ${selected}` };
              res15m = { ok: false, error: `Unknown instrument ${selected}` };
            } else {
              isEqStock = true;
              instExch = String(eqRow.exch_seg);
              instTok = String(eqRow.token);
              lotSz = Number(eqRow.lotsize || 1);
              res5m = await fetchAngelCandles(supabase, instExch, instTok, "5m", 20_000);
              res15m = await fetchAngelCandles(supabase, instExch, instTok, "15m", 45_000);
            }
          }

          if (!res5m.ok) {
            workerStatus = `DATA_UNAVAILABLE: ${res5m.error}`;
          } else {
            const nowSec = Math.floor(Date.now() / 1000);
            const closed5m = res5m.candles.filter((c: any) => nowSec >= Number(c.time) + 300);
            const raw15m = res15m.ok ? res15m.candles : [];
            const closed15m = raw15m.filter((c: any) => nowSec >= Number(c.time) + 900);

            if (closed5m.length < 30) {
              workerStatus = `INSUFFICIENT_CLOSED_CANDLES (${closed5m.length})`;
            } else {
              const v12Series = computeV12Engine(closed5m);
              const latestSig = v12Series[v12Series.length - 1];
              const activatedAtSec = account.auto_trade_activated_at
                ? Math.floor(Date.parse(account.auto_trade_activated_at) / 1000)
                : nowSec;
              const barCloseSec = latestSig.barTime + 300;
              const barTsIso = new Date(latestSig.barTime * 1000).toISOString();

              await supabase.from("system_kv").upsert({
                key: "live_scan_state",
                value: {
                  underlying: selected,
                  timeframe: "5m",
                  barTime: latestSig.barTime,
                  trendDir: latestSig.trendDir,
                  signal: latestSig.signal,
                  rsi: latestSig.rsi,
                  chopIndex: latestSig.chopIndex,
                  atr: latestSig.atr,
                  fuelState: latestSig.fuelState,
                  closePrice: latestSig.closePrice,
                  waitingFreshAfterActivation: barCloseSec <= activatedAtSec,
                  updated_at: nowIso,
                },
                updated_at: nowIso,
              });

              if (latestSig.signal === "HOLD") {
                workerStatus = `SCANNING_${selected}_HOLD`;
              } else if (barCloseSec <= activatedAtSec) {
                workerStatus = `WAITING_NEW_SIGNAL_AFTER_ON (${selected})`;
              } else {
                const { data: dupSig } = await supabase
                  .from("ai_signals")
                  .select("id")
                  .eq("account_id", account.id)
                  .eq("symbol", selected)
                  .eq("timeframe", "5m")
                  .eq("bar_timestamp", barTsIso)
                  .maybeSingle();

                if (dupSig) {
                  workerStatus = `SIGNAL_ALREADY_PROCESSED_${selected}`;
                } else {
                  const budgetInr = computeAllocatedBudget(account);
                  let candRes: { ok: true; candidate: AICandidateContract } | { ok: false; reason: string };

                  if (isCryptoSelected) {
                    if (!quotesRes.btcPrice || quotesRes.btcPrice <= 0) {
                      candRes = { ok: false, reason: "Live Bitcoin quote unavailable" };
                    } else {
                      candRes = {
                        ok: true,
                        candidate: {
                          symbol: "BITCOIN",
                          token: "BTCUSDT",
                          exchange: "CRYPTO",
                          optionType: "SPOT",
                          strikePrice: 0,
                          expiryDate: "",
                          lotSize: 1,
                          ltp: quotesRes.btcPrice,
                          volume: 0,
                          oi: 0,
                          spreadPct: 0.0005,
                          approxDelta: 1.0,
                        },
                      };
                    }
                  } else if (isEqStock) {
                    const q = quotesRes.quoteBySymbol.get(selected);
                    if (!q || q.ltp <= 0) {
                      candRes = { ok: false, reason: `Live Angel One quote unavailable for ${selected}` };
                    } else {
                      candRes = {
                        ok: true,
                        candidate: {
                          symbol: selected,
                          token: instTok,
                          exchange: instExch,
                          optionType: "EQ",
                          strikePrice: 0,
                          expiryDate: "",
                          lotSize: lotSz,
                          ltp: q.ltp,
                          volume: q.tradeVolume || 0,
                          oi: 0,
                          spreadPct: 0.001,
                          approxDelta: 1.0,
                        },
                      };
                    }
                  } else {
                    candRes = await selectRealOptionCandidate(
                      supabase,
                      selected,
                      latestSig.closePrice,
                      latestSig.signal === "BUY",
                      budgetInr,
                      todayIst,
                      istMinutes
                    );
                  }

                  if (!candRes.ok) {
                    await supabase.from("ai_signals").upsert({
                      account_id: account.id,
                      symbol: selected,
                      exchange: instExch,
                      timeframe: "5m",
                      bar_timestamp: barTsIso,
                      v12_signal: latestSig.signal,
                      v12_confidence: latestSig.confidence,
                      spot_price: latestSig.closePrice,
                      ai_decision: "REJECTED",
                      ai_score: 0,
                      ai_reason: candRes.reason,
                      created_at: nowIso,
                    }, { onConflict: "account_id,symbol,timeframe,bar_timestamp" });
                    workerStatus = `CANDIDATE_REJECTED: ${candRes.reason}`;
                  } else {
                    const aiEval = evaluateWithAIBrain(
                      latestSig,
                      closed5m,
                      closed15m,
                      account,
                      candRes.candidate,
                      quotesRes.usdInrRate,
                      isCryptoSelected
                    );

                    const dataSrcLabel = isCryptoSelected
                      ? quotesRes.btcSource
                      : "Angel One SmartAPI";

                    await supabase.from("ai_signals").upsert({
                      account_id: account.id,
                      symbol: selected,
                      exchange: candRes.candidate.exchange,
                      timeframe: "5m",
                      bar_timestamp: barTsIso,
                      v12_signal: latestSig.signal,
                      v12_confidence: latestSig.confidence,
                      spot_price: latestSig.closePrice,
                      ai_decision: aiEval.decision,
                      ai_score: aiEval.score,
                      ai_reason: aiEval.reason,
                      selected_option_symbol: candRes.candidate.symbol,
                      selected_option_token: candRes.candidate.token,
                      selected_option_ltp: candRes.candidate.ltp,
                      lot_size: candRes.candidate.lotSize,
                      factor_breakdown: aiEval.breakdown,
                      warnings: aiEval.warnings,
                      data_source: dataSrcLabel,
                      strategy_version: STRATEGY_VERSION,
                      created_at: nowIso,
                    }, { onConflict: "account_id,symbol,timeframe,bar_timestamp" });

                    if (aiEval.decision === "APPROVED") {
                      const openRes = await openPaperPosition(
                        supabase,
                        account,
                        candRes.candidate,
                        latestSig,
                        aiEval,
                        selected,
                        quotesRes.usdInrRate,
                        isCryptoSelected,
                        dataSrcLabel
                      );
                      workerStatus = openRes.ok
                        ? `EXECUTED_${candRes.candidate.symbol} (${openRes.positionId})`
                        : `EXECUTION_BLOCKED: ${openRes.error}`;
                    } else {
                      workerStatus = `AI_REJECTED_${selected} (${aiEval.score}/100)`;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    const { data: activePosAfter } = await supabase
      .from("positions")
      .select("*")
      .eq("account_id", account.id)
      .eq("status", "OPEN");

    if (!fastMode && activePosAfter && activePosAfter.length > 0) {
      await new Promise((r) => setTimeout(r, 22_000));
      const { data: accLatest } = await supabase.from("paper_account").select("*").eq("id", account.id).single();
      const { data: posLatest } = await supabase
        .from("positions")
        .select("*")
        .eq("account_id", account.id)
        .eq("status", "OPEN");
      if (accLatest && posLatest && posLatest.length > 0 && !accLatest.kill_switch_active) {
        const q2 = await refreshAllLiveQuotes(supabase, posLatest, [selected]);
        await evaluateAndUpdatePositions(
          supabase,
          accLatest,
          posLatest,
          q2.quoteByExchToken,
          q2.btcPrice,
          q2.usdInrRate,
          getIndianMarketSession().shouldSquareOffIntraday
        );
      }
    }

    await supabase
      .from("paper_account")
      .update({
        last_worker_run_at: new Date().toISOString(),
        last_worker_status: workerStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", account.id);

    return jsonResponse({
      success: true,
      workerStatus,
      selected,
      autoTradeActive: account.auto_trade_active,
      openPositionsCount: activePosAfter?.length || 0,
      btcPrice: quotesRes.btcPrice,
      angelConnected: !quotesRes.angelError,
    });
  } finally {
    await supabase
      .from("paper_account")
      .update({ worker_lock_until: null })
      .eq("id", account.id);
  }
});
