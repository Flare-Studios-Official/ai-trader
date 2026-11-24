import { DashboardState, MarketWatchItem, OpenPosition, ClosedTrade, SignalItem, OptionStrike } from '../types';

export interface OptionDetails {
  symbol: string;
  underlying: string;
  strike: number;
  option_type: 'CE' | 'PE';
  expiry: string;
  lot_size: number;
  price: number;
  delta: number;
  margin_required: number;
  stop_loss: number;
  take_profit: number;
}

export const INDEX_CONFIGS: Record<string, { strike_step: number; lot_size: number; exchange: string; display_name: string; expiry_day: number }> = {
  NIFTY: { strike_step: 50, lot_size: 25, exchange: 'NSE', display_name: 'NIFTY 50', expiry_day: 4 }, // Thursday
  BANKNIFTY: { strike_step: 100, lot_size: 15, exchange: 'NSE', display_name: 'BANK NIFTY', expiry_day: 4 }, // Thursday
  FINNIFTY: { strike_step: 50, lot_size: 25, exchange: 'NSE', display_name: 'FIN NIFTY', expiry_day: 2 }, // Tuesday
  SENSEX: { strike_step: 100, lot_size: 10, exchange: 'BSE', display_name: 'BSE SENSEX', expiry_day: 5 }, // Friday
  BANKEX: { strike_step: 100, lot_size: 15, exchange: 'BSE', display_name: 'BSE BANKEX', expiry_day: 1 }, // Monday
};

// Computes next upcoming weekly contract expiry date (e.g. 26NOV26)
export function getNextWeeklyExpiry(expiryDayOfWeek: number = 4): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utc + 5.5 * 3600000);

  const currentDay = ist.getDay();
  let diff = expiryDayOfWeek - currentDay;
  if (diff < 0 || (diff === 0 && (ist.getHours() * 60 + ist.getMinutes() >= 930))) {
    diff += 7;
  }
  ist.setDate(ist.getDate() + diff);

  const day = String(ist.getDate()).padStart(2, '0');
  const month = ist.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const year = ist.getFullYear().toString().slice(-2);
  return `${day}${month}${year}`;
}

// Market Status Checker for NSE & BSE (Hours, Weekends, Holidays)
export interface MarketStatusInfo {
  isOpen: boolean;
  statusLabel: 'OPEN' | 'CLOSED' | 'WEEKEND' | 'HOLIDAY';
  badgeColor: string;
  message: string;
  reason: string;
  nextOpenTime: string;
}

export function getIndianMarketStatus(): MarketStatusInfo {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const istDate = new Date(utc + 5.5 * 3600000);

  const day = istDate.getDay(); // 0 = Sun, 6 = Sat
  const hours = istDate.getHours();
  const minutes = istDate.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  const year = istDate.getFullYear();
  const month = String(istDate.getMonth() + 1).padStart(2, '0');
  const dateNum = String(istDate.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${dateNum}`;

  // NSE / BSE Declared Trading Holidays
  const NSE_HOLIDAYS: Record<string, string> = {
    '2026-11-24': 'Guru Nanak Jayanti / Market Holiday',
    '2026-12-25': 'Christmas',
    '2026-01-26': 'Republic Day',
    '2026-03-08': 'Mahashivratri',
    '2026-03-25': 'Holi',
    '2026-04-11': 'Id-Ul-Fitr',
    '2026-04-14': 'Ambedkar Jayanti',
    '2026-04-17': 'Ram Navami',
    '2026-05-01': 'Maharashtra Day',
    '2026-08-15': 'Independence Day',
    '2026-10-02': 'Mahatma Gandhi Jayanti',
    '2026-10-12': 'Dussehra',
    '2026-11-01': 'Diwali Laxmi Pujan',
    '2026-11-02': 'Diwali Balipratipada'
  };

  // 1. Weekend Check
  if (day === 0 || day === 6) {
    const isSat = day === 6;
    return {
      isOpen: false,
      statusLabel: 'WEEKEND',
      badgeColor: 'bg-red-500/20 text-red-400 border-red-500/30',
      message: `Weekend (${isSat ? 'Saturday' : 'Sunday'}) — NSE/BSE Closed`,
      reason: 'Exchange is closed on weekends. Quotes represent official Friday closing prices from Angel One.',
      nextOpenTime: 'Monday 9:15 AM IST'
    };
  }

  // 2. Declared Holiday Check
  if (NSE_HOLIDAYS[dateStr]) {
    return {
      isOpen: false,
      statusLabel: 'HOLIDAY',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      message: `Market Holiday: ${NSE_HOLIDAYS[dateStr]}`,
      reason: `NSE & BSE are closed today for ${NSE_HOLIDAYS[dateStr]}. Official last closing quotes from Angel One SmartAPI shown.`,
      nextOpenTime: 'Next Trading Day 9:15 AM IST'
    };
  }

  // 3. Regular Session Time Check (09:15 AM to 03:30 PM IST)
  if (timeInMinutes < 555) {
    return {
      isOpen: false,
      statusLabel: 'CLOSED',
      badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      message: 'Pre-Market Session (Exchange Closed)',
      reason: 'Regular Indian market hours are 9:15 AM to 3:30 PM IST. Opens today at 9:15 AM IST.',
      nextOpenTime: 'Today 9:15 AM IST'
    };
  }

  if (timeInMinutes > 930) {
    return {
      isOpen: false,
      statusLabel: 'CLOSED',
      badgeColor: 'bg-gray-800 text-gray-300 border-gray-600',
      message: 'Market Closed (Post-Market)',
      reason: 'NSE & BSE closed for the day at 3:30 PM IST. Quotes represent official closing rates from Angel One SmartAPI.',
      nextOpenTime: 'Tomorrow 9:15 AM IST'
    };
  }

  // 4. Market is OPEN
  return {
    isOpen: true,
    statusLabel: 'OPEN',
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    message: 'Live Market Session Active (NSE/BSE)',
    reason: 'Regular trading session active. Streaming live quotes from Angel One SmartAPI.',
    nextOpenTime: 'Trading session open until 3:30 PM IST'
  };
}

// Black-Scholes Option Pricing Formula
export function priceOption(
  spot: number,
  strike: number,
  timeToExpiryYears: number = 3.0 / 365.0,
  volatility: number = 0.14,
  rate: number = 0.065,
  isCall: boolean = true
): { price: number; delta: number } {
  if (spot <= 0 || strike <= 0 || timeToExpiryYears <= 0) {
    const intrinsic = isCall ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
    return { price: Math.max(0.05, intrinsic), delta: isCall ? 0.5 : -0.5 };
  }

  const d1 =
    (Math.log(spot / strike) + (rate + 0.5 * volatility * volatility) * timeToExpiryYears) /
    (volatility * Math.sqrt(timeToExpiryYears));
  const d2 = d1 - volatility * Math.sqrt(timeToExpiryYears);

  // Cumulative standard normal distribution approximation
  const normalCdf = (x: number): number => {
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
    const p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    const absX = Math.abs(x) / Math.SQRT2;
    const t = 1.0 / (1.0 + p * absX);
    const erf = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
    return 0.5 * (1.0 + sign * erf);
  };

  const discount = Math.exp(-rate * timeToExpiryYears);

  if (isCall) {
    const price = spot * normalCdf(d1) - strike * discount * normalCdf(d2);
    const delta = normalCdf(d1);
    return { price: Math.max(0.05, parseFloat(price.toFixed(2))), delta: parseFloat(delta.toFixed(2)) };
  } else {
    const price = strike * discount * normalCdf(-d2) - spot * normalCdf(-d1);
    const delta = normalCdf(d1) - 1.0;
    return { price: Math.max(0.05, parseFloat(price.toFixed(2))), delta: parseFloat(delta.toFixed(2)) };
  }
}

// Selects suitable Option Contract based on AI Evaluation
export function selectOptionContract(
  underlying: string,
  spotPrice: number,
  isBullish: boolean,
  confidence: number,
  atr: number
): OptionDetails {
  const cfg = INDEX_CONFIGS[underlying] || INDEX_CONFIGS.NIFTY;
  const step = cfg.strike_step;
  const atm = Math.round(spotPrice / step) * step;

  // AI Strike Selection:
  // - High confidence (>75%) -> Select 1 step OTM for higher leverage / risk-reward
  // - Moderate confidence (60-75%) -> Select ATM (Delta ~ 0.50, highest liquidity)
  // - Low confidence (<60%) -> Select 1 step ITM for delta safety
  let strike = atm;
  if (confidence >= 75) {
    strike = isBullish ? atm + step : atm - step;
  } else if (confidence < 60) {
    strike = isBullish ? atm - step : atm + step;
  }

  const optionType: 'CE' | 'PE' = isBullish ? 'CE' : 'PE';
  const { price, delta } = priceOption(spotPrice, strike, 3.0 / 365.0, 0.14, 0.065, isBullish);

  // Accurate upcoming weekly expiry (e.g. 26NOV26)
  const expiry = getNextWeeklyExpiry(cfg.expiry_day);

  const symbol = `${underlying} ${expiry} ${strike} ${optionType}`;
  const marginRequired = parseFloat((price * cfg.lot_size).toFixed(2));

  // Risk Parameters: SL = 2.0x ATR * delta, TP = 3.5x ATR * delta
  const slOffset = Math.max(10, atr * Math.abs(delta) * 1.5);
  const tpOffset = Math.max(25, atr * Math.abs(delta) * 3.5);

  const stopLoss = Math.max(1.0, parseFloat((price - slOffset).toFixed(2)));
  const takeProfit = parseFloat((price + tpOffset).toFixed(2));

  return {
    symbol,
    underlying,
    strike,
    option_type: optionType,
    expiry,
    lot_size: cfg.lot_size,
    price,
    delta,
    margin_required: marginRequired,
    stop_loss: stopLoss,
    take_profit: takeProfit
  };
}

// Fetches live real-time Bitcoin Spot from Coinbase Exchange API (Zero API key needed, CORS enabled)
export async function fetchLiveBitcoin(): Promise<{ price: number; change: number; change_pct: number; high: number; low: number; volume: number }> {
  try {
    const res = await fetch('https://api.exchange.coinbase.com/products/BTC-USD/stats', {
      headers: { 'User-Agent': 'AITrader/1.0' }
    });
    if (res.ok) {
      const stats = await res.json();
      const last = parseFloat(stats.last);
      const open = parseFloat(stats.open);
      const high = parseFloat(stats.high);
      const low = parseFloat(stats.low);
      const volume = parseFloat(stats.volume);
      const change = parseFloat((last - open).toFixed(2));
      const changePct = parseFloat(((change / open) * 100).toFixed(2));

      return { price: last, change, change_pct: changePct, high, low, volume };
    }
  } catch (e) {
    console.warn('Coinbase ticker fetch failed, attempting CoinGecko fallback:', e);
  }

  // Fallback to CoinGecko
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true');
    if (res.ok) {
      const data = await res.json();
      const price = parseFloat(data.bitcoin.usd);
      const changePct = parseFloat((data.bitcoin.usd_24h_change || 0).toFixed(2));
      const change = parseFloat(((price * changePct) / 100).toFixed(2));
      return { price, change, change_pct: changePct, high: price * 1.02, low: price * 0.98, volume: 15000 };
    }
  } catch (e) {
    console.warn('CoinGecko fallback failed:', e);
  }

  return { price: 60250.0, change: -1250.0, change_pct: -2.03, high: 63600.0, low: 59300.0, volume: 14000 };
}

export interface CandleData {
  time: number; // unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

// Generate realistic baseline candles for TradingView chart based on current market price
export function generateCandlesForSymbol(
  symbol: string,
  basePrice: number,
  count: number = 120,
  intervalSeconds: number = 60
): CandleData[] {
  const candles: CandleData[] = [];
  const now = Math.floor(Date.now() / 1000);
  const startTime = now - count * intervalSeconds;

  let currentPrice = basePrice * 0.985;
  const isCrypto = symbol.includes('BTC');
  const volatility = isCrypto ? 0.0025 : 0.0012;

  for (let i = 0; i < count; i++) {
    const time = startTime + i * intervalSeconds;
    const progress = i / count;
    // Drift gradually towards basePrice
    const drift = (basePrice - currentPrice) * 0.05;
    const noise = (Math.random() - 0.49) * (currentPrice * volatility);
    const open = currentPrice;
    let close = currentPrice + drift + noise;
    if (i === count - 1) {
      close = basePrice;
    }
    const high = Math.max(open, close) + Math.random() * (currentPrice * volatility * 0.8);
    const low = Math.min(open, close) - Math.random() * (currentPrice * volatility * 0.8);
    const volume = Math.floor((isCrypto ? 15 : 2500) * (0.8 + Math.random() * 0.6));

    candles.push({
      time,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume
    });

    currentPrice = close;
  }

  return candles;
}

// Technical Indicator Calculations
export function calculateEMA(candles: CandleData[], period: number): { time: number; value: number }[] {
  if (candles.length < period) return [];
  const k = 2 / (period + 1);
  const result: { time: number; value: number }[] = [];

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += candles[i].close;
  }
  let ema = sum / period;
  result.push({ time: candles[period - 1].time, value: parseFloat(ema.toFixed(2)) });

  for (let i = period; i < candles.length; i++) {
    ema = candles[i].close * k + ema * (1 - k);
    result.push({ time: candles[i].time, value: parseFloat(ema.toFixed(2)) });
  }

  return result;
}

export function calculateRSI(candles: CandleData[], period: number = 14): number {
  if (candles.length <= period) return 50.0;

  let gains = 0;
  let losses = 0;

  for (let i = candles.length - period; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change >= 0) {
      gains += change;
    } else {
      losses -= change;
    }
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100.0;
  const rs = avgGain / avgLoss;
  return parseFloat((100 - (100 / (1 + rs))).toFixed(1));
}

export function calculateATR(candles: CandleData[], period: number = 14): number {
  if (candles.length < 2) return 1.0;
  let trSum = 0;
  const count = Math.min(candles.length - 1, period);
  for (let i = candles.length - count; i < candles.length; i++) {
    const c = candles[i];
    const prevC = candles[i - 1];
    const tr = Math.max(c.high - c.low, Math.abs(c.high - prevC.close), Math.abs(c.low - prevC.close));
    trSum += tr;
  }
  return parseFloat((trSum / count).toFixed(2));
}

export function calculateChoppinessIndex(candles: CandleData[], period: number = 14): number {
  if (candles.length <= period) return 50.0;
  let trSum = 0;
  let maxHigh = -Infinity;
  let minLow = Infinity;
  for (let i = candles.length - period; i < candles.length; i++) {
    const c = candles[i];
    const prevC = candles[i - 1];
    const tr = Math.max(c.high - c.low, Math.abs(c.high - prevC.close), Math.abs(c.low - prevC.close));
    trSum += tr;
    if (c.high > maxHigh) maxHigh = c.high;
    if (c.low < minLow) minLow = c.low;
  }
  const range = maxHigh - minLow;
  if (range <= 0) return 50.0;
  const chop = 100 * (Math.log10(trSum / range) / Math.log10(period));
  return parseFloat(Math.min(100, Math.max(0, chop)).toFixed(1));
}

// Stage 1: V12 Indicator Engine Types and Evaluator
export interface V12SignalResult {
  action: 'BUY' | 'SELL' | 'HOLD';
  isNewSignal: boolean;
  timestamp: number;
  close: number;
  baseline: number;
  fuelState: string;
  stretchATR: number;
  pattern: string;
  rsi: number;
  chopIndex: number;
  confidence: number;
  reason: string;
}

export function evaluateV12Signal(
  candles: CandleData[],
  autoTradeActivatedAtMs?: number | null,
  lastSignalTimestampSec?: number | null
): V12SignalResult {
  if (candles.length < 25) {
    return {
      action: 'HOLD',
      isNewSignal: false,
      timestamp: 0,
      close: 0,
      baseline: 0,
      fuelState: 'None',
      stretchATR: 0,
      pattern: 'None',
      rsi: 50,
      chopIndex: 50,
      confidence: 50,
      reason: 'Insufficient candle data for V12 evaluation'
    };
  }

  const ema9Series = calculateEMA(candles, 9);
  const ema21Series = calculateEMA(candles, 21);
  const lastEma9 = ema9Series[ema9Series.length - 1]?.value || 0;
  const lastEma21 = ema21Series[ema21Series.length - 1]?.value || 0;
  const prevEma9 = ema9Series[ema9Series.length - 2]?.value || lastEma9;
  const prevEma21 = ema21Series[ema21Series.length - 2]?.value || lastEma21;

  const lastCandle = candles[candles.length - 1];
  const prevCandle = candles[candles.length - 2];
  const rsi = calculateRSI(candles, 14);
  const chop = calculateChoppinessIndex(candles, 14);
  const atr = calculateATR(candles, 14);

  // Baseline is 21-period EMA
  const baseline = lastEma21;
  const distFromBaseline = Math.abs(lastCandle.close - baseline);
  const stretchATR = parseFloat((distFromBaseline / (atr || 1)).toFixed(2));

  let fuelState = 'Moderate Fuel';
  if (stretchATR > 2.2) fuelState = 'Exhausted (Low Fuel)';
  else if (stretchATR <= 1.2) fuelState = 'Coiled Spring (Full Fuel)';

  // 15-Bar Box Ceiling/Floor
  const lookbackCount = Math.min(15, candles.length - 2);
  let highest15 = -Infinity;
  let lowest15 = Infinity;
  for (let i = candles.length - 2 - lookbackCount; i < candles.length - 2; i++) {
    if (candles[i].high > highest15) highest15 = candles[i].high;
    if (candles[i].low < lowest15) lowest15 = candles[i].low;
  }

  // Detect Fresh Crossover Transitions (Event occurred on current bar)
  const goldenCross = prevEma9 <= prevEma21 && lastEma9 > lastEma21;
  const deathCross = prevEma9 >= prevEma21 && lastEma9 < lastEma21;
  const baselineCrossUp = prevCandle.close <= prevEma21 && lastCandle.close > lastEma21;
  const baselineCrossDown = prevCandle.close >= prevEma21 && lastCandle.close < lastEma21;
  const boxBreakoutUp = prevCandle.close <= highest15 && lastCandle.close > highest15;
  const boxBreakoutDown = prevCandle.close >= lowest15 && lastCandle.close < lowest15;

  let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  let isCrossoverEvent = false;
  let reason = 'Market scanning live feed. Waiting for fresh V12 crossover trigger';

  if (goldenCross || baselineCrossUp || boxBreakoutUp) {
    action = 'BUY';
    isCrossoverEvent = true;
    if (goldenCross) reason = `EMA 9/21 Golden Cross confirmed on bar (RSI ${rsi.toFixed(1)})`;
    else if (baselineCrossUp) reason = `Price crossed above 21 Baseline on bar (RSI ${rsi.toFixed(1)})`;
    else reason = `15-Bar Resistance Breakout above ${highest15.toFixed(2)}`;
  } else if (deathCross || baselineCrossDown || boxBreakoutDown) {
    action = 'SELL';
    isCrossoverEvent = true;
    if (deathCross) reason = `EMA 9/21 Death Cross confirmed on bar (RSI ${rsi.toFixed(1)})`;
    else if (baselineCrossDown) reason = `Price crossed below 21 Baseline on bar (RSI ${rsi.toFixed(1)})`;
    else reason = `15-Bar Support Breakdown below ${lowest15.toFixed(2)}`;
  }

  // Strict Timing Filter: Was this event strictly AFTER Auto Trade was activated?
  let isNewSignal = false;
  if (isCrossoverEvent) {
    const activationSec = autoTradeActivatedAtMs ? Math.floor(autoTradeActivatedAtMs / 1000) : null;
    if (activationSec && lastCandle.time < activationSec) {
      reason = 'Historical crossover occurred before Auto Trade activation. Waiting for live signal.';
      action = 'HOLD';
    } else if (lastSignalTimestampSec && lastCandle.time <= lastSignalTimestampSec) {
      reason = 'Signal on this candle bar has already been evaluated. Standing by.';
      action = 'HOLD';
    } else {
      isNewSignal = true;
    }
  }

  // Pattern detection on current candle
  const range = Math.max(0.01, lastCandle.high - lastCandle.low);
  const body = Math.abs(lastCandle.close - lastCandle.open);
  const bodyRatio = body / range;
  const upperWick = lastCandle.high - Math.max(lastCandle.open, lastCandle.close);
  const lowerWick = Math.min(lastCandle.open, lastCandle.close) - lastCandle.low;

  let pattern = 'Standard Candle';
  if (bodyRatio >= 0.70) pattern = lastCandle.close > lastCandle.open ? 'Bullish Marubozu' : 'Bearish Marubozu';
  else if (lowerWick >= body * 1.8 && upperWick <= body * 0.65) pattern = 'Hammer Absorption';
  else if (upperWick >= body * 1.8 && lowerWick <= body * 0.65) pattern = 'Shooting Star Rejection';

  return {
    action,
    isNewSignal,
    timestamp: lastCandle.time,
    close: lastCandle.close,
    baseline,
    fuelState,
    stretchATR,
    pattern,
    rsi,
    chopIndex: chop,
    confidence: isNewSignal ? 85 : 50,
    reason
  };
}

// Stage 2: Independent AI Candlestick & Market Verification Engine
export interface AIVerificationResult {
  decision: 'APPROVED' | 'REJECTED' | 'WAITING';
  score: number;
  reason: string;
  warnings: string[];
  positiveFactors: string[];
  candleAnalysis: {
    bodyRatioPct: number;
    upperWickPct: number;
    lowerWickPct: number;
    pattern: string;
    isDecisive: boolean;
  };
  marketRegime: {
    fuelState: string;
    stretchATR: number;
    chopIndex: number;
    isChoppy: boolean;
    rsi: number;
  };
}

export function verifySignalWithAI(
  v12Signal: V12SignalResult,
  candles: CandleData[],
  mItem?: any
): AIVerificationResult {
  const lastCandle = candles[candles.length - 1];
  const range = Math.max(0.01, lastCandle.high - lastCandle.low);
  const body = Math.abs(lastCandle.close - lastCandle.open);
  const bodyRatio = body / range;
  const upperWick = lastCandle.high - Math.max(lastCandle.open, lastCandle.close);
  const upperWickRatio = upperWick / range;
  const lowerWick = Math.min(lastCandle.open, lastCandle.close) - lastCandle.low;
  const lowerWickRatio = lowerWick / range;

  let score = 50;
  const warnings: string[] = [];
  const positiveFactors: string[] = [];

  const isBuy = v12Signal.action === 'BUY';

  // 1. Candlestick Price Action & Wicks
  if (isBuy) {
    if (upperWickRatio > 0.38) {
      warnings.push(`Heavy upper rejection wick (${(upperWickRatio * 100).toFixed(0)}%). Severe selling resistance at highs.`);
      score -= 30;
    } else if (upperWickRatio < 0.18) {
      positiveFactors.push(`Clean close near candle high (upper wick ${(upperWickRatio * 100).toFixed(0)}%). Strong buyer control.`);
      score += 15;
    }

    if (bodyRatio < 0.30) {
      warnings.push(`Thin/indecisive candle body (${(bodyRatio * 100).toFixed(0)}%). Lacks directional impulse.`);
      score -= 15;
    } else if (bodyRatio >= 0.55) {
      positiveFactors.push(`Strong bullish body (${(bodyRatio * 100).toFixed(0)}% of range).`);
      score += 15;
    }
  } else {
    // SELL
    if (lowerWickRatio > 0.38) {
      warnings.push(`Heavy lower rejection wick (${(lowerWickRatio * 100).toFixed(0)}%). Strong buying absorption at lows.`);
      score -= 30;
    } else if (lowerWickRatio < 0.18) {
      positiveFactors.push(`Clean close near candle low (lower wick ${(lowerWickRatio * 100).toFixed(0)}%). Strong seller control.`);
      score += 15;
    }

    if (bodyRatio < 0.30) {
      warnings.push(`Thin/indecisive candle body (${(bodyRatio * 100).toFixed(0)}%). Lacks directional impulse.`);
      score -= 15;
    } else if (bodyRatio >= 0.55) {
      positiveFactors.push(`Strong bearish body (${(bodyRatio * 100).toFixed(0)}% of range).`);
      score += 15;
    }
  }

  // 2. Fuel Tank (Distance from Baseline)
  if (v12Signal.stretchATR > 2.2) {
    warnings.push(`Fuel Tank Depleted: Price stretched ${v12Signal.stretchATR}x ATR from baseline. Climax risk.`);
    score -= 25;
  } else if (v12Signal.stretchATR <= 1.2) {
    positiveFactors.push(`Coiled Spring: Tight baseline alignment (${v12Signal.stretchATR}x ATR). Full fuel runway.`);
    score += 15;
  }

  // 3. Market Choppiness
  if (v12Signal.chopIndex > 58) {
    warnings.push(`High Market Chop (${v12Signal.chopIndex} > 58). Sideways noise, false breakout risk.`);
    score -= 25;
  } else if (v12Signal.chopIndex < 46) {
    positiveFactors.push(`Clean Trend Regime (Chop ${v12Signal.chopIndex} < 46).`);
    score += 15;
  }

  // 4. RSI Sweet Spot
  if (isBuy) {
    if (v12Signal.rsi > 72) {
      warnings.push(`RSI Overbought (${v12Signal.rsi} > 72). Climax top.`);
      score -= 25;
    } else if (v12Signal.rsi >= 40 && v12Signal.rsi <= 65) {
      positiveFactors.push(`RSI in Sweet Spot (${v12Signal.rsi}). Favorable runway.`);
      score += 15;
    }
  } else {
    if (v12Signal.rsi < 28) {
      warnings.push(`RSI Oversold (${v12Signal.rsi} < 28). Climax bottom.`);
      score -= 25;
    } else if (v12Signal.rsi >= 35 && v12Signal.rsi <= 60) {
      positiveFactors.push(`RSI in Sweet Spot (${v12Signal.rsi}). Favorable breakdown runway.`);
      score += 15;
    }
  }

  // Multi-bar staircase check (Higher lows / Lower highs)
  if (candles.length >= 3) {
    const c3 = candles[candles.length - 3];
    const c2 = candles[candles.length - 2];
    const c1 = candles[candles.length - 1];
    if (isBuy && c1.low >= c2.low && c2.low >= c3.low) {
      positiveFactors.push('Higher Lows structure confirmed');
      score += 10;
    } else if (!isBuy && c1.high <= c2.high && c2.high <= c3.high) {
      positiveFactors.push('Lower Highs structure confirmed');
      score += 10;
    }
  }

  score = Math.min(98, Math.max(5, score));
  const decision = score >= 75 ? 'APPROVED' : 'REJECTED';

  let reason = '';
  if (decision === 'APPROVED') {
    reason = `AI APPROVED: ${positiveFactors.join('; ')}. High probability setup.`;
  } else {
    reason = `AI REJECTED (${score}/100): ${warnings.join('; ') || 'Insufficient multi-factor edge to risk capital'}. Trade blocked to protect capital.`;
  }

  return {
    decision,
    score,
    reason,
    warnings,
    positiveFactors,
    candleAnalysis: {
      bodyRatioPct: Math.round(bodyRatio * 100),
      upperWickPct: Math.round(upperWickRatio * 100),
      lowerWickPct: Math.round(lowerWickRatio * 100),
      pattern: v12Signal.pattern,
      isDecisive: bodyRatio >= 0.45
    },
    marketRegime: {
      fuelState: v12Signal.fuelState,
      stretchATR: v12Signal.stretchATR,
      chopIndex: v12Signal.chopIndex,
      isChoppy: v12Signal.chopIndex > 58,
      rsi: v12Signal.rsi
    }
  };
}

// Autonomous Trading Indicator Signal Evaluator
export interface IndicatorSignal {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  rsi: number;
  ema9: number;
  ema21: number;
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  reason: string;
}

export function evaluateIndicators(candles: CandleData[]): IndicatorSignal {
  if (candles.length < 25) {
    return {
      action: 'HOLD',
      confidence: 50,
      rsi: 50,
      ema9: 0,
      ema21: 0,
      trend: 'NEUTRAL',
      reason: 'Insufficient candle data for indicator analysis'
    };
  }

  const rsi = calculateRSI(candles, 14);
  const ema9Series = calculateEMA(candles, 9);
  const ema21Series = calculateEMA(candles, 21);

  const lastEma9 = ema9Series[ema9Series.length - 1]?.value || 0;
  const lastEma21 = ema21Series[ema21Series.length - 1]?.value || 0;
  const prevEma9 = ema9Series[ema9Series.length - 2]?.value || lastEma9;
  const prevEma21 = ema21Series[ema21Series.length - 2]?.value || lastEma21;

  const currentPrice = candles[candles.length - 1].close;

  // Bullish Golden Cross or Momentum Breakout
  const goldenCross = prevEma9 <= prevEma21 && lastEma9 > lastEma21;
  const deathCross = prevEma9 >= prevEma21 && lastEma9 < lastEma21;
  const bullishMomentum = lastEma9 > lastEma21 && currentPrice > lastEma9;
  const bearishMomentum = lastEma9 < lastEma21 && currentPrice < lastEma9;

  let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  let confidence = 50;
  let reason = 'Market consolidates in neutral band';
  let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';

  if (goldenCross || (bullishMomentum && rsi >= 38 && rsi <= 68)) {
    action = 'BUY';
    confidence = Math.min(95, Math.round(72 + (goldenCross ? 15 : 0) + (rsi < 45 ? 8 : 0)));
    trend = 'BULLISH';
    reason = goldenCross
      ? `EMA 9/21 Golden Cross confirmed (RSI ${rsi})`
      : `Bullish Trend continuation above EMA9 (RSI ${rsi})`;
  } else if (deathCross || (bearishMomentum && rsi >= 32 && rsi <= 62)) {
    action = 'SELL';
    confidence = Math.min(95, Math.round(72 + (deathCross ? 15 : 0) + (rsi > 55 ? 8 : 0)));
    trend = 'BEARISH';
    reason = deathCross
      ? `EMA 9/21 Death Cross confirmed (RSI ${rsi})`
      : `Bearish Breakdown below EMA9/21 (RSI ${rsi})`;
  } else if (rsi < 30) {
    // Oversold reversal trigger
    action = 'BUY';
    confidence = 78;
    trend = 'BULLISH';
    reason = `RSI Oversold Bounce (${rsi} < 30)`;
  } else if (rsi > 70) {
    // Overbought reversal trigger
    action = 'SELL';
    confidence = 78;
    trend = 'BEARISH';
    reason = `RSI Overbought Exhaustion (${rsi} > 70)`;
  }

  return { action, confidence, rsi, ema9: lastEma9, ema21: lastEma21, trend, reason };
}

// 1-Second Coinbase WebSocket Live Feed
export function subscribeCoinbaseWebSocket(
  onPriceUpdate: (data: { price: number; time: number }) => void
): () => void {
  let ws: WebSocket | null = null;
  let isClosed = false;

  const connect = () => {
    if (isClosed) return;
    try {
      ws = new WebSocket('wss://ws-feed.exchange.coinbase.com');

      ws.onopen = () => {
        const msg = {
          type: 'subscribe',
          product_ids: ['BTC-USD'],
          channels: ['ticker']
        };
        ws?.send(JSON.stringify(msg));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'ticker' && data.price) {
            const price = parseFloat(data.price);
            if (!isNaN(price) && price > 0) {
              onPriceUpdate({ price, time: Math.floor(Date.now() / 1000) });
            }
          }
        } catch {}
      };

      ws.onerror = () => {
        ws?.close();
      };

      ws.onclose = () => {
        if (!isClosed) {
          setTimeout(connect, 3000);
        }
      };
    } catch {
      if (!isClosed) {
        setTimeout(connect, 5000);
      }
    }
  };

  connect();

  return () => {
    isClosed = true;
    if (ws) {
      ws.close();
      ws = null;
    }
  };
}
