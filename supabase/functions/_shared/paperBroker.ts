import { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { CORE_INDICES, fetchAngelQuotes, AngelQuoteItem } from "./angelOne.ts";
import { AICandidateContract, AIBrainEvaluation, V12State, computeAllocatedBudget } from "./quantEngine.ts";

export function calcIndianFnOCharges(turnover: number, isBuy: boolean): number {
  const brokerage = 20.0;
  const stt = isBuy ? 0 : turnover * 0.001;
  const exchange = turnover * 0.0005;
  const gst = (brokerage + exchange) * 0.18;
  const sebi = turnover * (10 / 10000000);
  const stamp = isBuy ? turnover * 0.00003 : 0;
  return Math.round((brokerage + stt + exchange + gst + sebi + stamp) * 100) / 100;
}

export function calcCryptoFee(turnoverInr: number): number {
  return Math.round(turnoverInr * 0.001 * 100) / 100;
}

export async function selectRealOptionCandidate(
  supabase: SupabaseClient,
  underlying: string,
  spotPrice: number,
  isBull: boolean,
  budgetInr: number,
  istDateStr: string,
  istTimeMinutes: number
): Promise<{ ok: true; candidate: AICandidateContract } | { ok: false; reason: string }> {
  const spec = CORE_INDICES[underlying];
  if (!spec) return { ok: false, reason: `Unsupported index ${underlying}` };

  const optType = isBull ? "CE" : "PE";

  const { data: expRows } = await supabase
    .from("instrument_master")
    .select("expiry, expiry_date")
    .eq("name", underlying)
    .eq("exch_seg", spec.optionExch)
    .eq("instrumenttype", "OPTIDX")
    .gte("expiry_date", istDateStr)
    .order("expiry_date", { ascending: true })
    .limit(300);

  if (!expRows || expRows.length === 0) {
    return { ok: false, reason: `No active expiries found in instrument_master for ${underlying}` };
  }

  const distinctExps = Array.from(new Set(expRows.map((r: any) => r.expiry_date))).sort();
  let chosenExpDate = distinctExps[0];
  if (chosenExpDate === istDateStr && istTimeMinutes >= 870 && distinctExps.length > 1) {
    chosenExpDate = distinctExps[1];
  }

  const atm = Math.round(spotPrice / spec.strikeStep) * spec.strikeStep;
  const strikes = isBull
    ? [atm - spec.strikeStep, atm, atm + spec.strikeStep, atm + spec.strikeStep * 2, atm + spec.strikeStep * 3]
    : [atm + spec.strikeStep, atm, atm - spec.strikeStep, atm - spec.strikeStep * 2, atm - spec.strikeStep * 3];

  const { data: candidates } = await supabase
    .from("instrument_master")
    .select("*")
    .eq("name", underlying)
    .eq("exch_seg", spec.optionExch)
    .eq("instrumenttype", "OPTIDX")
    .eq("expiry_date", chosenExpDate)
    .eq("option_type", optType)
    .in("strike", strikes);

  if (!candidates || candidates.length === 0) {
    return { ok: false, reason: `No ${optType} option strikes synced for ${underlying} (${chosenExpDate})` };
  }

  const tokens = candidates.map((c: any) => String(c.token));
  const qRes = await fetchAngelQuotes(supabase, { [spec.optionExch]: tokens });
  if (!qRes.ok) {
    return { ok: false, reason: `Angel One live option quotes failed: ${qRes.error}` };
  }

  const quoteByTok = new Map<string, AngelQuoteItem>();
  for (const q of qRes.fetched) {
    quoteByTok.set(String(q.symbolToken), q);
  }

  const scored: Array<{ score: number; cand: AICandidateContract }> = [];
  for (const row of candidates) {
    const q = quoteByTok.get(String(row.token));
    if (!q || q.ltp <= 1.0) continue;
    const lotCost = q.ltp * Number(row.lotsize);
    if (lotCost > budgetInr) continue;
    if ((q.tradeVolume || 0) <= 0 && (q.opnInterest || 0) <= 0) continue;

    const bestBid = Number(q.depth?.buy?.[0]?.price || 0);
    const bestAsk = Number(q.depth?.sell?.[0]?.price || 0);
    const spreadPct = bestBid > 0 && bestAsk > bestBid ? (bestAsk - bestBid) / q.ltp : 0.01;
    if (spreadPct > 0.05) continue;

    const moneynessSteps = isBull ? (spotPrice - Number(row.strike)) / spec.strikeStep : (Number(row.strike) - spotPrice) / spec.strikeStep;
    const approxDelta = Math.max(0.22, Math.min(0.75, 0.5 + moneynessSteps * 0.12));

    const atmDistPenalty = Math.abs(moneynessSteps) * 15;
    const liqBonus = Math.min(40, Math.log10(Math.max(10, q.opnInterest || 10)) * 5);
    const contractScore = 100 - atmDistPenalty + liqBonus - spreadPct * 200;

    scored.push({
      score: contractScore,
      cand: {
        symbol: String(row.symbol),
        token: String(row.token),
        exchange: spec.optionExch,
        optionType: optType,
        strikePrice: Number(row.strike),
        expiryDate: String(row.expiry),
        lotSize: Number(row.lotsize),
        ltp: Number(q.ltp),
        volume: Number(q.tradeVolume || 0),
        oi: Number(q.opnInterest || 0),
        spreadPct,
        approxDelta,
      },
    });
  }

  if (scored.length === 0) {
    return { ok: false, reason: `No liquid & affordable ${underlying} ${optType} contract within budget ₹${budgetInr.toFixed(0)}` };
  }

  scored.sort((a, b) => b.score - a.score);
  return { ok: true, candidate: scored[0].cand };
}

export async function openPaperPosition(
  supabase: SupabaseClient,
  account: any,
  candidate: AICandidateContract,
  v12Sig: V12State,
  aiEval: AIBrainEvaluation,
  underlying: string,
  usdInrRate: number,
  isCrypto: boolean,
  dataSource: string
): Promise<{ ok: true; positionId: string } | { ok: false; error: string }> {
  const slipPct = 0.001;
  const isLongContract =
    candidate.optionType === "CE" || candidate.optionType === "PE"
      ? true
      : v12Sig.signal === "BUY";
  const fillPrice = Math.round((isLongContract ? candidate.ltp * (1 + slipPct) : candidate.ltp * (1 - slipPct)) * 100) / 100;

  const side = isCrypto
    ? v12Sig.signal
    : candidate.optionType === "CE"
    ? "BUY_CE"
    : candidate.optionType === "PE"
    ? "BUY_PE"
    : v12Sig.signal;

  const investedInr = isCrypto
    ? Math.round(fillPrice * aiEval.suggestedQuantity * usdInrRate * 100) / 100
    : Math.round(fillPrice * aiEval.suggestedQuantity * 100) / 100;

  const entryCharges = isCrypto
    ? calcCryptoFee(investedInr)
    : calcIndianFnOCharges(investedInr, true);

  const avail = Number(account.available_balance || 0);
  if (avail < investedInr + entryCharges) {
    return { ok: false, error: `Insufficient balance ₹${avail.toFixed(2)} for ₹${(investedInr + entryCharges).toFixed(2)}` };
  }

  const posId = `POS-${underlying.replace(/[^A-Z0-9]/g, "")}-${Date.now().toString().slice(-6)}`;
  const nowIso = new Date().toISOString();

  const { error: posErr } = await supabase.from("positions").insert({
    account_id: account.id,
    position_id: posId,
    symbol: candidate.symbol,
    underlying,
    instrument_token: candidate.token,
    exchange: candidate.exchange,
    asset_type: isCrypto ? "CRYPTO_SPOT" : "INDEX_F_AND_O",
    option_type: candidate.optionType === "CE" || candidate.optionType === "PE" ? candidate.optionType : null,
    strike_price: candidate.strikePrice > 0 ? candidate.strikePrice : null,
    expiry_date: candidate.expiryDate || null,
    lot_size: candidate.lotSize,
    lots: aiEval.suggestedLots,
    side,
    quantity: aiEval.suggestedQuantity,
    entry_price: fillPrice,
    current_price: fillPrice,
    invested_amount: investedInr,
    stop_loss: aiEval.stopLoss,
    take_profit: aiEval.takeProfit,
    unrealized_pnl: 0,
    entry_charges: entryCharges,
    status: "OPEN",
    entry_reason: aiEval.reason,
    ai_score: aiEval.score,
    decision_chain: { v12: v12Sig, ai: aiEval },
    data_source: dataSource,
    currency: isCrypto ? "USD" : "INR",
    allocation_mode: account.capital_allocation_mode,
    opened_at: nowIso,
    updated_at: nowIso,
  });

  if (posErr) {
    return { ok: false, error: `DB position insert blocked (duplicate/constraint): ${posErr.message}` };
  }

  await supabase.from("transactions").insert({
    account_id: account.id,
    tx_id: `TX-${Date.now()}-${Math.floor(Math.random() * 999)}`,
    position_id: posId,
    tx_type: "ENTRY",
    symbol: candidate.symbol,
    underlying,
    option_type: candidate.optionType === "CE" || candidate.optionType === "PE" ? candidate.optionType : null,
    side,
    quantity: aiEval.suggestedQuantity,
    lot_size: candidate.lotSize,
    price: fillPrice,
    amount: investedInr,
    charges: entryCharges,
    realized_pnl: 0,
    reason: aiEval.reason,
    currency: isCrypto ? "USD" : "INR",
  });

  const newAvail = Math.round((avail - investedInr - entryCharges) * 100) / 100;
  const newInv = Math.round((Number(account.invested_amount || 0) + investedInr) * 100) / 100;
  const newCharges = Math.round((Number(account.total_charges_paid || 0) + entryCharges) * 100) / 100;

  await supabase
    .from("paper_account")
    .update({
      available_balance: newAvail,
      invested_amount: newInv,
      total_charges_paid: newCharges,
      today_trades_count: Number(account.today_trades_count || 0) + 1,
      updated_at: nowIso,
    })
    .eq("id", account.id);

  return { ok: true, positionId: posId };
}

export async function closePaperPosition(
  supabase: SupabaseClient,
  account: any,
  pos: any,
  marketExitPrice: number,
  exitReason: string,
  usdInrRate: number
): Promise<{ realizedPnlInr: number }> {
  const isCrypto = pos.asset_type === "CRYPTO_SPOT" || pos.symbol.includes("BTC");
  const isLongContract = pos.side === "BUY" || pos.side === "BUY_CE" || pos.side === "BUY_PE";
  const slipPct = 0.001;
  const filledExit = Math.round((isLongContract ? marketExitPrice * (1 - slipPct) : marketExitPrice * (1 + slipPct)) * 100) / 100;

  const qty = Number(pos.quantity);
  const entryPx = Number(pos.entry_price);
  const investedInr = Number(pos.invested_amount);
  const mult = isCrypto ? usdInrRate : 1;

  const grossPnlInr = (isLongContract ? filledExit - entryPx : entryPx - filledExit) * qty * mult;
  const exitTurnoverInr = filledExit * qty * mult;
  const exitCharges = isCrypto ? calcCryptoFee(exitTurnoverInr) : calcIndianFnOCharges(exitTurnoverInr, false);
  const entryCharges = Number(pos.entry_charges || 0);
  const netRealizedInr = Math.round((grossPnlInr - entryCharges - exitCharges) * 100) / 100;

  const creditBackInr = Math.max(0, Math.round((investedInr + grossPnlInr - exitCharges) * 100) / 100);
  const nowIso = new Date().toISOString();
  const durationSec = Math.max(1, Math.floor((Date.now() - Date.parse(pos.opened_at)) / 1000));

  const { data: closedRow } = await supabase
    .from("positions")
    .update({
      status: "CLOSED",
      current_price: filledExit,
      exit_price: filledExit,
      unrealized_pnl: 0,
      realized_pnl: netRealizedInr,
      exit_charges: exitCharges,
      exit_reason: exitReason,
      closed_at: nowIso,
      updated_at: nowIso,
    })
    .eq("position_id", pos.position_id)
    .eq("status", "OPEN")
    .select("position_id")
    .maybeSingle();

  if (!closedRow) {
    return { realizedPnlInr: 0 };
  }

  await supabase.from("transactions").insert({
    account_id: account.id,
    tx_id: `TX-EXIT-${Date.now()}-${Math.floor(Math.random() * 999)}`,
    position_id: pos.position_id,
    tx_type: "EXIT",
    symbol: pos.symbol,
    underlying: pos.underlying,
    option_type: pos.option_type,
    side: isLongContract ? "SELL" : "BUY",
    quantity: qty,
    lot_size: pos.lot_size,
    price: filledExit,
    amount: Math.round(exitTurnoverInr * 100) / 100,
    charges: exitCharges,
    realized_pnl: netRealizedInr,
    trade_duration_sec: durationSec,
    reason: exitReason,
    currency: pos.currency || "INR",
  });

  await supabase.from("system_kv").upsert({
    key: `cooldown:${pos.underlying}`,
    value: { until_ms: Date.now() + 300_000, closed_at: nowIso },
    updated_at: nowIso,
  });

  const { data: remOpen } = await supabase
    .from("positions")
    .select("invested_amount")
    .eq("account_id", account.id)
    .eq("status", "OPEN");
  const remInvested = (remOpen || []).reduce((s: number, r: any) => s + Number(r.invested_amount || 0), 0);

  const { data: freshAcc } = await supabase.from("paper_account").select("*").eq("id", account.id).single();
  const baseAvail = Number(freshAcc?.available_balance ?? account.available_balance);
  const baseRealized = Number(freshAcc?.realized_pnl ?? account.realized_pnl);
  const baseTodayRealized = Number(freshAcc?.today_realized_pnl ?? account.today_realized_pnl);
  const baseCharges = Number(freshAcc?.total_charges_paid ?? account.total_charges_paid);

  await supabase
    .from("paper_account")
    .update({
      available_balance: Math.round((baseAvail + creditBackInr) * 100) / 100,
      invested_amount: Math.round(remInvested * 100) / 100,
      realized_pnl: Math.round((baseRealized + netRealizedInr) * 100) / 100,
      today_realized_pnl: Math.round((baseTodayRealized + netRealizedInr) * 100) / 100,
      total_charges_paid: Math.round((baseCharges + exitCharges) * 100) / 100,
      updated_at: nowIso,
    })
    .eq("id", account.id);

  return { realizedPnlInr: netRealizedInr };
}
