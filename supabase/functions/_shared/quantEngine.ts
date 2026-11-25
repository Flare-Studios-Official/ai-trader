import { CandleBar } from "./angelOne.ts";

export interface V12State {
  barIndex: number;
  barTime: number;
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  trendDir: 1 | -1;
  closePrice: number;
  baseline: number;
  atr: number;
  rsi: number;
  chopIndex: number;
  fuelState: string;
  stretchAtr: number;
  roomToWallAtr: number;
  bodyRatio: number;
  upperWickRatio: number;
  lowerWickRatio: number;
  isExhausted: boolean;
  hittingWall: boolean;
  isSidewaysBox: boolean;
  higherLowStaircase: boolean;
  lowerHighStaircase: boolean;
  patternText: string;
}

export interface AICandidateContract {
  symbol: string;
  token: string;
  exchange: string;
  optionType: 'CE' | 'PE' | 'SPOT' | 'EQ';
  strikePrice: number;
  expiryDate: string;
  lotSize: number;
  ltp: number;
  volume: number;
  oi: number;
  spreadPct: number;
  approxDelta: number;
}

export interface AIBrainEvaluation {
  decision: 'APPROVED' | 'REJECTED' | 'WAITING';
  score: number;
  reason: string;
  warnings: string[];
  breakdown: Record<string, { score: number; max: number; note: string }>;
  suggestedLots: number;
  suggestedQuantity: number;
  investedInr: number;
  stopLoss: number;
  takeProfit: number;
  expectedProfitInr: number;
  maxLossInr: number;
  riskRewardRatio: number;
  marketStrengthLabel: 'STRONG' | 'MODERATE' | 'WEAK';
}

export function calcRma(values: number[], length: number): number[] {
  const n = values.length;
  const out = new Array<number>(n).fill(NaN);
  if (n < length || length <= 0) return out;
  let sum = 0;
  for (let i = 0; i < length; i++) sum += values[i];
  out[length - 1] = sum / length;
  const alpha = 1 / length;
  for (let i = length; i < n; i++) {
    out[i] = alpha * values[i] + (1 - alpha) * out[i - 1];
  }
  return out;
}

export function calcEma(values: number[], length: number): number[] {
  const n = values.length;
  const out = new Array<number>(n).fill(0);
  if (n === 0) return out;
  const k = 2 / (length + 1);
  out[0] = values[0];
  for (let i = 1; i < n; i++) {
    out[i] = values[i] * k + out[i - 1] * (1 - k);
  }
  return out;
}

export function calcRsiSeries(closes: number[], length = 14): number[] {
  const n = closes.length;
  const diffs = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i++) diffs[i] = closes[i] - closes[i - 1];
  const gains = diffs.map((d) => (d > 0 ? d : 0));
  const losses = diffs.map((d) => (d < 0 ? -d : 0));
  const avgGain = calcRma(gains, length);
  const avgLoss = calcRma(losses, length);
  const rsi = new Array<number>(n).fill(50);
  for (let i = length - 1; i < n; i++) {
    const g = avgGain[i];
    const l = avgLoss[i];
    if (!Number.isFinite(g) || !Number.isFinite(l)) continue;
    if (l === 0) rsi[i] = 100;
    else {
      const rs = g / l;
      rsi[i] = 100 - 100 / (1 + rs);
    }
  }
  return rsi;
}

export function calcAdx(candles: CandleBar[], length = 14): number {
  const n = candles.length;
  if (n < length * 2) return 22;
  const tr = new Array<number>(n).fill(0);
  const plusDm = new Array<number>(n).fill(0);
  const minusDm = new Array<number>(n).fill(0);
  tr[0] = candles[0].high - candles[0].low;
  for (let i = 1; i < n; i++) {
    const c = candles[i];
    const pc = candles[i - 1].close;
    tr[i] = Math.max(c.high - c.low, Math.abs(c.high - pc), Math.abs(c.low - pc));
    const up = c.high - candles[i - 1].high;
    const dn = candles[i - 1].low - c.low;
    if (up > dn && up > 0) plusDm[i] = up;
    if (dn > up && dn > 0) minusDm[i] = dn;
  }
  const trS = calcRma(tr, length);
  const pS = calcRma(plusDm, length);
  const mS = calcRma(minusDm, length);
  const dx = new Array<number>(n).fill(20);
  for (let i = length - 1; i < n; i++) {
    const st = Math.max(trS[i] || 1e-4, 1e-4);
    const pdi = (100 * (pS[i] || 0)) / st;
    const mdi = (100 * (mS[i] || 0)) / st;
    dx[i] = (100 * Math.abs(pdi - mdi)) / Math.max(pdi + mdi, 1e-4);
  }
  const adxSeries = calcRma(dx, length);
  const last = adxSeries[n - 1];
  return Number.isFinite(last) ? Math.round(last * 10) / 10 : 22;
}

export function computeV12Engine(candles: CandleBar[], mintick = 0.05): V12State[] {
  const n = candles.length;
  if (n < 20) return [];

  const opens = candles.map((c) => c.open);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const closes = candles.map((c) => c.close);

  const tr = new Array<number>(n).fill(0);
  tr[0] = highs[0] - lows[0];
  for (let i = 1; i < n; i++) {
    tr[i] = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
  }

  const atrRaw = calcRma(tr, 10);
  const safeAtr = atrRaw.map((v, i) => Math.max(Number.isFinite(v) ? v : tr[i], mintick));
  const atrBaseline = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - 49);
    let sum = 0;
    for (let j = start; j <= i; j++) sum += safeAtr[j];
    atrBaseline[i] = sum / (i - start + 1);
  }

  const fastEma = calcEma(closes, 8);
  const slowEma = calcEma(closes, 21);
  const rsiSeries = calcRsiSeries(closes, 14);

  const upperBand = new Array<number>(n).fill(0);
  const lowerBand = new Array<number>(n).fill(0);
  const trendDir = new Array<1 | -1>(n).fill(1);
  const buyFlip = new Array<boolean>(n).fill(false);
  const sellFlip = new Array<boolean>(n).fill(false);

  const consecBull = new Array<number>(n).fill(0);
  const consecBear = new Array<number>(n).fill(0);
  const higherLowStair = new Array<boolean>(n).fill(false);
  const lowerHighStair = new Array<boolean>(n).fill(false);

  let cb = 0;
  let cs = 0;
  for (let i = 0; i < n; i++) {
    if (closes[i] > opens[i]) { cb++; cs = 0; }
    else if (closes[i] < opens[i]) { cs++; cb = 0; }
    consecBull[i] = cb;
    consecBear[i] = cs;
  }

  const lowest3 = new Array<number>(n).fill(0);
  const highest3 = new Array<number>(n).fill(0);
  const bullStretch = new Array<number>(n).fill(0);
  const bearStretch = new Array<number>(n).fill(0);
  const isBullExh = new Array<boolean>(n).fill(false);
  const isBearExh = new Array<boolean>(n).fill(false);
  const boxCeiling = new Array<number>(n).fill(0);
  const boxFloor = new Array<number>(n).fill(0);
  const roomCeilAtr = new Array<number>(n).fill(0);
  const roomFloorAtr = new Array<number>(n).fill(0);

  const maxFuelStretch = 1.85;
  for (let i = 0; i < n; i++) {
    let l3 = lows[i], h3 = highs[i];
    for (let j = Math.max(0, i - 2); j <= i; j++) {
      if (lows[j] < l3) l3 = lows[j];
      if (highs[j] > h3) h3 = highs[j];
    }
    lowest3[i] = l3;
    highest3[i] = h3;
    bullStretch[i] = (closes[i] - l3) / safeAtr[i];
    bearStretch[i] = (h3 - closes[i]) / safeAtr[i];
    isBullExh[i] = (consecBull[i] >= 3 && bullStretch[i] >= maxFuelStretch) || bullStretch[i] >= maxFuelStretch * 1.3;
    isBearExh[i] = (consecBear[i] >= 3 && bearStretch[i] >= maxFuelStretch) || bearStretch[i] >= maxFuelStretch * 1.3;

    if (i >= 5) {
      higherLowStair[i] = lowest3[i] > lowest3[i - 3] && closes[i] > opens[i] && closes[i] > highs[i - 1];
      lowerHighStair[i] = highest3[i] < highest3[i - 3] && closes[i] < opens[i] && closes[i] < lows[i - 1];
    }

    let bc = highs[0], bf = lows[0];
    if (i > 0) {
      bc = -Infinity; bf = Infinity;
      for (let j = Math.max(0, i - 15); j < i; j++) {
        if (highs[j] > bc) bc = highs[j];
        if (lows[j] < bf) bf = lows[j];
      }
    }
    boxCeiling[i] = bc;
    boxFloor[i] = bf;
    roomCeilAtr[i] = (bc - closes[i]) / safeAtr[i];
    roomFloorAtr[i] = (closes[i] - bf) / safeAtr[i];
  }

  for (let i = 0; i < n; i++) {
    const volRatio = safeAtr[i] / Math.max(atrBaseline[i], mintick);
    const adaptiveFactor = 2.0 * Math.max(0.8, Math.min(1.2, 1.0 / Math.sqrt(Math.max(0.3, volRatio))));
    const hl2 = (highs[i] + lows[i]) / 2;
    const rawUpper = hl2 + adaptiveFactor * safeAtr[i];
    const rawLower = hl2 - adaptiveFactor * safeAtr[i];
    const bodySz = Math.abs(closes[i] - opens[i]);
    const fullRng = Math.max(highs[i] - lows[i], mintick);
    const bodyRatio = bodySz / fullRng;

    if (i === 0) {
      upperBand[0] = rawUpper;
      lowerBand[0] = rawLower;
      trendDir[0] = 1;
      continue;
    }

    const prevLower = lowerBand[i - 1];
    const prevUpper = upperBand[i - 1];
    const prevClose = closes[i - 1];
    const prevTrend = trendDir[i - 1];

    const currLower = rawLower > prevLower || prevClose < prevLower ? rawLower : prevLower;
    const currUpper = rawUpper < prevUpper || prevClose > prevUpper ? rawUpper : prevUpper;
    const prevUpper2 = i >= 2 ? upperBand[i - 2] : prevUpper;
    const prevLower2 = i >= 2 ? lowerBand[i - 2] : prevLower;

    const velBull = fastEma[i] > slowEma[i] || higherLowStair[i];
    const velBear = fastEma[i] < slowEma[i] || lowerHighStair[i];

    if (prevTrend === -1 && closes[i] > prevUpper) {
      const validBody = closes[i] > opens[i] && bodyRatio >= 0.35 && (velBull || prevClose > prevUpper2);
      const pullbackOk = prevClose > prevUpper2 && closes[i] > opens[i] && closes[i] > highs[i - 1];
      const blockedExh = isBullExh[i] && !pullbackOk;
      if (!validBody || blockedExh) {
        trendDir[i] = -1;
        upperBand[i] = prevUpper;
        lowerBand[i] = currLower;
      } else {
        trendDir[i] = 1;
        lowerBand[i] = rawLower;
        upperBand[i] = currUpper;
      }
    } else if (prevTrend === 1 && closes[i] < prevLower) {
      const validBody = closes[i] < opens[i] && bodyRatio >= 0.35 && (velBear || prevClose < prevLower2);
      const pullbackOk = prevClose < prevLower2 && closes[i] < opens[i] && closes[i] < lows[i - 1];
      const blockedExh = isBearExh[i] && !pullbackOk;
      if (!validBody || blockedExh) {
        trendDir[i] = 1;
        lowerBand[i] = prevLower;
        upperBand[i] = currUpper;
      } else {
        trendDir[i] = -1;
        upperBand[i] = rawUpper;
        lowerBand[i] = currLower;
      }
    } else {
      trendDir[i] = prevTrend;
      lowerBand[i] = currLower;
      upperBand[i] = currUpper;
    }

    buyFlip[i] = trendDir[i] === 1 && prevTrend === -1;
    sellFlip[i] = trendDir[i] === -1 && prevTrend === 1;
  }

  const log14 = Math.log10(14);
  const out: V12State[] = [];
  for (let i = 0; i < n; i++) {
    let chop = 50;
    if (i >= 13) {
      let sTr = 0, hMax = -Infinity, lMin = Infinity;
      for (let j = i - 13; j <= i; j++) {
        sTr += tr[j];
        if (highs[j] > hMax) hMax = highs[j];
        if (lows[j] < lMin) lMin = lows[j];
      }
      const rng = Math.max(hMax - lMin, mintick);
      chop = Math.min(100, Math.max(0, (100 * Math.log10(sTr / rng)) / log14));
    }

    const fullRng = Math.max(highs[i] - lows[i], mintick);
    const bodySz = Math.abs(closes[i] - opens[i]);
    const bodyRatio = bodySz / fullRng;
    const uWickRatio = (highs[i] - Math.max(opens[i], closes[i])) / fullRng;
    const lWickRatio = (Math.min(opens[i], closes[i]) - lows[i]) / fullRng;

    const isSidewaysBox = chop > 61.8 && bodySz < safeAtr[i] * 0.45 && !higherLowStair[i] && !lowerHighStair[i];
    const hitCeil = roomCeilAtr[i] > -0.15 && roomCeilAtr[i] < 0.35 && !higherLowStair[i];
    const hitFloor = roomFloorAtr[i] > -0.15 && roomFloorAtr[i] < 0.35 && !lowerHighStair[i];

    const bStr = bullStretch[i];
    const sStr = bearStretch[i];

    const bFuel = bStr >= 0.55 && bStr <= 1.45 ? 35 : bStr < maxFuelStretch ? 20 : 4;
    const sFuel = sStr >= 0.55 && sStr <= 1.45 ? 35 : sStr < maxFuelStretch ? 20 : 4;
    const bStruct = (higherLowStair[i] ? 15 : 6) + (fastEma[i] > slowEma[i] ? 10 : 3);
    const sStruct = (lowerHighStair[i] ? 15 : 6) + (fastEma[i] < slowEma[i] ? 10 : 3);
    const rv = rsiSeries[i];
    const bRsi = rv >= 50 && rv <= 64 ? 20 : rv > 64 && rv <= 70 ? 12 : 5;
    const sRsi = rv >= 36 && rv <= 50 ? 20 : rv >= 30 && rv < 36 ? 12 : 5;
    const bPat = Math.min(20, (closes[i] - lows[i]) / fullRng >= 0.7 ? 16 : 6);
    const sPat = Math.min(20, (highs[i] - closes[i]) / fullRng >= 0.7 ? 16 : 6);

    let rawBull = bFuel + bStruct + bRsi + bPat;
    let rawBear = sFuel + sStruct + sRsi + sPat;
    if (isBullExh[i]) rawBull *= 0.22;
    if (hitCeil) rawBull *= 0.45;
    if (isBearExh[i]) rawBear *= 0.22;
    if (hitFloor) rawBear *= 0.45;
    if (isSidewaysBox) { rawBull *= 0.35; rawBear *= 0.35; }

    const bConf = Math.round(Math.max(1, Math.min(99, rawBull)));
    const sConf = Math.round(Math.max(1, Math.min(99, rawBear)));

    let sig: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    const conf = trendDir[i] === 1 ? bConf : sConf;
    let fuelState = 'Moderate Fuel';
    let pattern = 'Standard';
    if (bodyRatio >= 0.7) pattern = closes[i] >= opens[i] ? 'Marubozu Bull' : 'Marubozu Bear';
    else if (lWickRatio >= bodyRatio * 1.8 && bodyRatio >= 0.1) pattern = 'Hammer';
    else if (uWickRatio >= bodyRatio * 1.8 && bodyRatio >= 0.1) pattern = 'Shooting Star';

    if (buyFlip[i]) {
      sig = 'BUY';
      fuelState = isBullExh[i] ? 'Exhausted (Low Fuel)' : higherLowStair[i] ? 'Coiled Spring (Full Fuel)' : 'Fresh Breakout';
    } else if (sellFlip[i]) {
      sig = 'SELL';
      fuelState = isBearExh[i] ? 'Exhausted (Low Fuel)' : lowerHighStair[i] ? 'Coiled Spring (Full Fuel)' : 'Fresh Breakdown';
    } else {
      fuelState = (trendDir[i] === 1 ? isBullExh[i] : isBearExh[i]) ? 'Exhausted' : 'In Trend';
    }

    out.push({
      barIndex: i,
      barTime: candles[i].time,
      signal: sig,
      confidence: conf,
      trendDir: trendDir[i],
      closePrice: closes[i],
      baseline: trendDir[i] === 1 ? lowerBand[i] : upperBand[i],
      atr: Math.round(safeAtr[i] * 100) / 100,
      rsi: Math.round(rv * 10) / 10,
      chopIndex: Math.round(chop * 10) / 10,
      fuelState,
      stretchAtr: Math.round((sig === 'SELL' ? sStr : bStr) * 100) / 100,
      roomToWallAtr: Math.round((sig === 'SELL' ? roomFloorAtr[i] : roomCeilAtr[i]) * 100) / 100,
      bodyRatio: Math.round(bodyRatio * 100) / 100,
      upperWickRatio: Math.round(uWickRatio * 100) / 100,
      lowerWickRatio: Math.round(lWickRatio * 100) / 100,
      isExhausted: sig === 'SELL' ? isBearExh[i] : isBullExh[i],
      hittingWall: sig === 'SELL' ? hitFloor : hitCeil,
      isSidewaysBox,
      higherLowStaircase: higherLowStair[i],
      lowerHighStaircase: lowerHighStair[i],
      patternText: pattern,
    });
  }
  return out;
}

export function computeAllocatedBudget(account: any): number {
  const avail = Number(account.available_balance || 0);
  const initCap = Number(account.initial_capital || 100000);
  const invested = Number(account.invested_amount || 0);
  const totalEquity = avail + invested;
  const maxCapPct = Number(account.max_capital_used_pct || 100);
  const remainingCapCeiling = Math.max(0, (initCap * (maxCapPct / 100)) - invested);

  let desired = avail / 3;
  switch (account.capital_allocation_mode) {
    case 'TWO_THIRDS':
      desired = (totalEquity * 2) / 3;
      break;
    case 'FULL':
      desired = avail;
      break;
    case 'CUSTOM':
      desired = Number(account.custom_allocation_amount || avail / 3);
      break;
    case 'ONE_THIRD':
    default:
      desired = totalEquity / 3;
      break;
  }
  return Math.max(0, Math.min(avail, remainingCapCeiling, desired));
}

export function evaluateWithAIBrain(
  sig: V12State,
  candles5m: CandleBar[],
  candles15m: CandleBar[],
  account: any,
  candidate: AICandidateContract,
  usdInrRate: number,
  isCrypto: boolean
): AIBrainEvaluation {
  const warnings: string[] = [];
  const breakdown: Record<string, { score: number; max: number; note: string }> = {};
  const isBull = sig.signal === 'BUY';

  const makeReject = (score: number, reason: string, strength: 'STRONG' | 'MODERATE' | 'WEAK' = 'WEAK'): AIBrainEvaluation => ({
    decision: 'REJECTED',
    score,
    reason,
    warnings,
    breakdown,
    suggestedLots: 0,
    suggestedQuantity: 0,
    investedInr: 0,
    stopLoss: 0,
    takeProfit: 0,
    expectedProfitInr: 0,
    maxLossInr: 0,
    riskRewardRatio: 0,
    marketStrengthLabel: strength,
  });

  if (sig.signal === 'HOLD') {
    return {
      decision: 'WAITING',
      score: 0,
      reason: 'Stage 1 V12 indicator is HOLD. Standing by for fresh signal.',
      warnings: [],
      breakdown: {},
      suggestedLots: 0,
      suggestedQuantity: 0,
      investedInr: 0,
      stopLoss: 0,
      takeProfit: 0,
      expectedProfitInr: 0,
      maxLossInr: 0,
      riskRewardRatio: 0,
      marketStrengthLabel: 'MODERATE',
    };
  }

  const ageSec = Math.floor(Date.now() / 1000) - sig.barTime;
  if (ageSec > 1800) {
    warnings.push(`Stale candle timestamp (${Math.round(ageSec / 60)}m old)`);
    return makeReject(10, `Data is stale (${Math.round(ageSec / 60)}m old). AI refuses to trade stale prices.`);
  }

  let mtfScore = 10;
  let mtfNote = '15m neutral';
  if (candles15m.length >= 25) {
    const v12_15m = computeV12Engine(candles15m);
    const adx15 = calcAdx(candles15m, 14);
    const last15 = v12_15m[v12_15m.length - 1];
    if (last15) {
      const aligned = isBull ? last15.trendDir === 1 : last15.trendDir === -1;
      if (aligned && adx15 >= 22) {
        mtfScore = 20;
        mtfNote = `15m trend aligned (${last15.trendDir === 1 ? 'BULL' : 'BEAR'}, ADX ${adx15})`;
      } else if (aligned) {
        mtfScore = 14;
        mtfNote = `15m aligned, moderate ADX (${adx15})`;
      } else {
        mtfScore = 4;
        mtfNote = `Counter-trend vs 15m (${last15.trendDir === 1 ? 'BULL' : 'BEAR'})`;
        warnings.push(mtfNote);
      }
    }
  }
  breakdown['multi_timeframe'] = { score: mtfScore, max: 20, note: mtfNote };

  let candleScore = 12;
  const oppWick = isBull ? sig.upperWickRatio : sig.lowerWickRatio;
  if (sig.bodyRatio >= 0.55 && oppWick <= 0.22) {
    candleScore = 20;
  } else if (sig.bodyRatio >= 0.38 && oppWick <= 0.35) {
    candleScore = 14;
  } else {
    candleScore = 4;
    if (oppWick > 0.38) warnings.push(`Heavy opposing rejection wick (${Math.round(oppWick * 100)}%)`);
    if (sig.bodyRatio < 0.35) warnings.push(`Weak candle body (${Math.round(sig.bodyRatio * 100)}%)`);
  }
  breakdown['candle_strength'] = {
    score: candleScore,
    max: 20,
    note: `Body ${Math.round(sig.bodyRatio * 100)}%, OppWick ${Math.round(oppWick * 100)}% (${sig.patternText})`,
  };

  let srScore = 10;
  if (sig.hittingWall) {
    srScore = 2;
    warnings.push(`Firing into 15-bar S/R wall (Room: ${sig.roomToWallAtr} ATR)`);
  } else if (sig.roomToWallAtr >= 1.5 || (isBull ? sig.higherLowStaircase : sig.lowerHighStaircase)) {
    srScore = 15;
  }
  breakdown['market_structure'] = {
    score: srScore,
    max: 15,
    note: `Wall room ${sig.roomToWallAtr} ATR${sig.higherLowStaircase ? ' + HL Staircase' : ''}${sig.lowerHighStaircase ? ' + LH Staircase' : ''}`,
  };

  const adx5 = calcAdx(candles5m, 14);
  let regimeScore = 10;
  if (sig.isExhausted || sig.isSidewaysBox || sig.chopIndex > 61.8) {
    regimeScore = 2;
    if (sig.isExhausted) warnings.push(`Climax exhaustion (${sig.stretchAtr}x ATR)`);
    if (sig.chopIndex > 61.8) warnings.push(`Choppy sideways market (Chop ${sig.chopIndex})`);
  } else if (sig.chopIndex < 48 && adx5 >= 22) {
    regimeScore = 15;
  } else if (adx5 < 16) {
    regimeScore = 6;
    warnings.push(`Low trend strength (ADX ${adx5})`);
  }
  breakdown['volatility_chop'] = { score: regimeScore, max: 15, note: `Chop ${sig.chopIndex}, ADX5 ${adx5}` };

  let momScore = 10;
  if (isBull) {
    if (sig.rsi > 74) { momScore = 2; warnings.push(`RSI Overbought (${sig.rsi})`); }
    else if (sig.rsi >= 48 && sig.rsi <= 65 && sig.confidence >= 60) momScore = 15;
  } else {
    if (sig.rsi < 26) { momScore = 2; warnings.push(`RSI Oversold (${sig.rsi})`); }
    else if (sig.rsi >= 35 && sig.rsi <= 52 && sig.confidence >= 60) momScore = 15;
  }
  breakdown['momentum_rsi'] = { score: momScore, max: 15, note: `RSI ${sig.rsi}, V12 Conf ${sig.confidence}%` };

  let liqScore = 15;
  let liqNote = 'Spot high liquidity';
  if (!isCrypto && candidate.optionType !== 'SPOT') {
    if (candidate.ltp <= 1.0) {
      liqScore = 0;
      warnings.push('Contract price too low / invalid LTP');
    } else if (candidate.spreadPct > 0.05) {
      liqScore = 3;
      warnings.push(`Wide bid-ask spread (${(candidate.spreadPct * 100).toFixed(1)}%)`);
    } else if (candidate.oi <= 0 && candidate.volume <= 0 && candidate.optionType !== 'EQ') {
      liqScore = 2;
      warnings.push('Zero OI and Zero Volume on contract');
    } else {
      liqNote = `OI ${candidate.oi.toLocaleString()}, Vol ${candidate.volume.toLocaleString()}, Spread ${(candidate.spreadPct * 100).toFixed(2)}%`;
    }
  }
  breakdown['liquidity_spread'] = { score: liqScore, max: 15, note: liqNote };

  const totalScore = Math.round(mtfScore + candleScore + srScore + regimeScore + momScore + liqScore);
  const strengthLabel: 'STRONG' | 'MODERATE' | 'WEAK' =
    totalScore >= 82 && sig.bodyRatio >= 0.5 && sig.chopIndex < 50 ? 'STRONG' : totalScore >= 72 ? 'MODERATE' : 'WEAK';

  if (sig.isExhausted || sig.hittingWall || totalScore < 72 || liqScore <= 3) {
    return makeReject(
      totalScore,
      `AI Rejected ${sig.signal} (Score ${totalScore}/100): ${warnings.join('; ') || 'Multi-factor setup below 72/100 conviction threshold'}.`,
      strengthLabel
    );
  }

  const budgetInr = computeAllocatedBudget(account);
  if (budgetInr < 500) {
    return makeReject(totalScore, `Insufficient available virtual balance/allocation (₹${budgetInr.toFixed(0)})`, strengthLabel);
  }

  const totalEquity = Number(account.available_balance || 0) + Number(account.invested_amount || 0);
  const maxRiskByPct = totalEquity * (Number(account.risk_per_trade_pct || 1.0) / 100);

  if (isCrypto) {
    const slPct = Math.max(0.2, Number(account.stop_loss_pct || 0.5)) / 100;
    const tpPct = Math.max(0.25, Number(account.target_profit_pct || 0.5)) / 100;
    const atrPct = Math.max(0.0025, (sig.atr / sig.closePrice) * 1.25);
    const effSlPct = Math.max(slPct, Math.min(slPct * 1.5, atrPct));
    const effTpPct = strengthLabel === 'STRONG' ? Math.max(tpPct, effSlPct * 1.35) : Math.max(tpPct, effSlPct * 1.15);

    const budgetUsd = budgetInr / usdInrRate;
    const maxQtyByAlloc = budgetUsd / candidate.ltp;
    const maxRiskUsd = maxRiskByPct / usdInrRate;
    const maxQtyByRisk = maxRiskUsd / (candidate.ltp * effSlPct);
    const qty = Math.floor(Math.min(maxQtyByAlloc, maxQtyByRisk) * 10000) / 10000;

    if (qty < 0.0005) {
      return makeReject(totalScore, 'Allocated capital or risk limit too small for minimum BTC lot (0.0005 BTC).', strengthLabel);
    }

    const investedInr = Math.round(qty * candidate.ltp * usdInrRate * 100) / 100;
    const stopLoss = Math.round((isBull ? candidate.ltp * (1 - effSlPct) : candidate.ltp * (1 + effSlPct)) * 100) / 100;
    const takeProfit = Math.round((isBull ? candidate.ltp * (1 + effTpPct) : candidate.ltp * (1 - effTpPct)) * 100) / 100;
    const maxLossInr = Math.round(qty * candidate.ltp * effSlPct * usdInrRate * 100) / 100;
    const expProfitInr = Math.round(qty * candidate.ltp * effTpPct * usdInrRate * 100) / 100;
    const rr = Math.round((expProfitInr / Math.max(1, maxLossInr)) * 100) / 100;

    return {
      decision: 'APPROVED',
      score: totalScore,
      reason: `AI Approved BTC ${sig.signal} (Score ${totalScore}/100, ${strengthLabel}): 15m ${mtfNote}; ${breakdown['candle_strength'].note}; R:R ${rr}:1.`,
      warnings,
      breakdown,
      suggestedLots: 1,
      suggestedQuantity: qty,
      investedInr,
      stopLoss,
      takeProfit,
      expectedProfitInr: expProfitInr,
      maxLossInr,
      riskRewardRatio: rr,
      marketStrengthLabel: strengthLabel,
    };
  }

  const tick = 0.05;
  const lotSize = Math.max(1, candidate.lotSize);
  const singleLotCost = candidate.ltp * lotSize;
  const maxLotsAfford = Math.floor(budgetInr / singleLotCost);
  if (maxLotsAfford < 1) {
    return makeReject(
      totalScore,
      `1 lot of ${candidate.symbol} (${lotSize} qty × ₹${candidate.ltp} = ₹${singleLotCost.toFixed(0)}) exceeds selected allocation ₹${budgetInr.toFixed(0)}.`,
      strengthLabel
    );
  }

  const delta = Math.max(0.25, Math.abs(candidate.approxDelta || 0.5));
  const optAtr = Math.max(2.5, sig.atr * delta);
  const minSafeSlPts = Math.max(tick * 10, optAtr * 0.85);
  const naturalSlPts = Math.max(minSafeSlPts, optAtr * 1.25);

  const configuredMaxLoss = Number(account.indian_max_loss_inr || 700);
  const maxAllowedLossInr = Math.min(configuredMaxLoss, Math.max(configuredMaxLoss * 0.6, maxRiskByPct));

  let lots = Math.min(maxLotsAfford, Math.max(1, Math.floor(maxAllowedLossInr / (naturalSlPts * lotSize))));
  const minLossForOneLot = minSafeSlPts * lotSize + 55;
  if (minLossForOneLot > maxAllowedLossInr * 1.15) {
    warnings.push(`Minimum structural SL for 1 lot (₹${minLossForOneLot.toFixed(0)}) exceeds max loss limit ₹${maxAllowedLossInr.toFixed(0)}`);
    return makeReject(totalScore, `AI Skipped: ${warnings[warnings.length - 1]}. Protecting loss ceiling.`, strengthLabel);
  }

  lots = Math.max(1, Math.min(maxLotsAfford, lots));
  const qty = lots * lotSize;
  const slPts = Math.max(minSafeSlPts, Math.min(naturalSlPts, Math.max(1, maxAllowedLossInr - 50) / qty));
  const roundedSlPts = Math.round(slPts / tick) * tick;
  const stopLoss = Math.max(tick, Math.round((candidate.ltp - roundedSlPts) * 100) / 100);

  const minTargetPref = Number(account.indian_min_target_inr || 500);
  const rawDesiredTargetInr =
    strengthLabel === 'STRONG'
      ? Math.min(1000, Math.max(minTargetPref + 150, 750))
      : Math.min(700, Math.max(350, minTargetPref));

  const structuralRoomPts = Math.max(optAtr * 1.5, Math.max(1.2, sig.roomToWallAtr) * optAtr * 0.85);
  const targetPtsFromPref = (rawDesiredTargetInr + 55) / qty;
  const tpPts = Math.min(structuralRoomPts, Math.max(roundedSlPts * 1.25, targetPtsFromPref));
  const roundedTpPts = Math.round(tpPts / tick) * tick;
  const takeProfit = Math.round((candidate.ltp + roundedTpPts) * 100) / 100;

  const estCharges = 55;
  const maxLossInr = Math.round((roundedSlPts * qty + estCharges) * 100) / 100;
  const expProfitInr = Math.round((roundedTpPts * qty - estCharges) * 100) / 100;
  const rr = Math.round((expProfitInr / Math.max(1, maxLossInr)) * 100) / 100;

  if (expProfitInr < 280 || rr < 1.1) {
    return makeReject(
      totalScore,
      `AI Skipped: Net target ₹${expProfitInr.toFixed(0)} / Risk ₹${maxLossInr.toFixed(0)} (R:R ${rr}:1) insufficient for structural room (${sig.roomToWallAtr} ATR).`,
      strengthLabel
    );
  }

  return {
    decision: 'APPROVED',
    score: totalScore,
    reason: `AI Approved ${candidate.symbol} (${strengthLabel}, Score ${totalScore}/100): Target ~₹${expProfitInr.toFixed(0)}, Max Risk ~₹${maxLossInr.toFixed(0)} (R:R ${rr}:1). ${breakdown['candle_strength'].note}.`,
    warnings,
    breakdown,
    suggestedLots: lots,
    suggestedQuantity: qty,
    investedInr: Math.round(candidate.ltp * qty * 100) / 100,
    stopLoss,
    takeProfit,
    expectedProfitInr: expProfitInr,
    maxLossInr,
    riskRewardRatio: rr,
    marketStrengthLabel: strengthLabel,
  };
}
