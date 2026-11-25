export interface MarketSessionInfo {
  isOpen: boolean;
  canEnterNewTrade: boolean;
  shouldSquareOffIntraday: boolean;
  statusLabel: 'OPEN' | 'PRE_MARKET' | 'CLOSED' | 'WEEKEND' | 'HOLIDAY' | '24_7_LIVE';
  message: string;
  reason: string;
  nextOpenTime: string;
  istDateStr: string;
  istTimeStr: string;
}

export const NSE_HOLIDAYS_2026: Record<string, string> = {
  '2026-01-26': 'Republic Day',
  '2026-03-03': 'Holi',
  '2026-03-26': 'Shri Ram Navami',
  '2026-03-31': 'Shri Mahavir Jayanti',
  '2026-04-03': 'Good Friday',
  '2026-04-14': 'Dr. Baba Saheb Ambedkar Jayanti',
  '2026-05-01': 'Maharashtra Day',
  '2026-05-28': 'Bakri Id',
  '2026-06-26': 'Muharram',
  '2026-09-14': 'Ganesh Chaturthi',
  '2026-10-02': 'Mahatma Gandhi Jayanti',
  '2026-10-20': 'Dussehra',
  '2026-11-10': 'Diwali-Balipratipada',
  '2026-11-24': 'Prakash Gurpurb Sri Guru Nanak Dev',
  '2026-12-25': 'Christmas',
};

export function getIstDate(nowMs = Date.now()): Date {
  return new Date(nowMs + 5.5 * 3600 * 1000);
}

export function formatIstDateYmd(istDate: Date): string {
  const y = istDate.getUTCFullYear();
  const m = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(istDate.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatIstTimeHm(istDate: Date): string {
  const h = String(istDate.getUTCHours()).padStart(2, '0');
  const m = String(istDate.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function isCryptoInstrument(symbol: string): boolean {
  const s = (symbol || '').toUpperCase().trim();
  return s === 'BITCOIN' || s === 'BTC' || s === 'BTC/USDT' || s === 'BTCUSDT';
}

export function getIndianMarketSession(nowMs = Date.now()): MarketSessionInfo {
  const ist = getIstDate(nowMs);
  const day = ist.getUTCDay();
  const hours = ist.getUTCHours();
  const mins = ist.getUTCMinutes();
  const timeInMinutes = hours * 60 + mins;
  const istDateStr = formatIstDateYmd(ist);
  const istTimeStr = formatIstTimeHm(ist);

  if (day === 0 || day === 6) {
    const dayName = day === 6 ? 'Saturday' : 'Sunday';
    return {
      isOpen: false,
      canEnterNewTrade: false,
      shouldSquareOffIntraday: false,
      statusLabel: 'WEEKEND',
      message: `NSE/BSE Closed (${dayName})`,
      reason: 'Indian exchanges are closed on weekends. Showing last official closing prices.',
      nextOpenTime: 'Monday 09:15 IST',
      istDateStr,
      istTimeStr,
    };
  }

  const holidayName = NSE_HOLIDAYS_2026[istDateStr];
  if (holidayName) {
    return {
      isOpen: false,
      canEnterNewTrade: false,
      shouldSquareOffIntraday: false,
      statusLabel: 'HOLIDAY',
      message: `Market Holiday: ${holidayName}`,
      reason: `NSE & BSE closed today for ${holidayName}. Auto Trade disabled for Indian instruments.`,
      nextOpenTime: 'Next Trading Day 09:15 IST',
      istDateStr,
      istTimeStr,
    };
  }

  if (timeInMinutes < 555) {
    return {
      isOpen: false,
      canEnterNewTrade: false,
      shouldSquareOffIntraday: false,
      statusLabel: 'PRE_MARKET',
      message: 'Pre-Market (Opens 09:15 IST)',
      reason: 'Regular Indian market trading starts at 09:15 IST.',
      nextOpenTime: 'Today 09:15 IST',
      istDateStr,
      istTimeStr,
    };
  }

  if (timeInMinutes > 930) {
    return {
      isOpen: false,
      canEnterNewTrade: false,
      shouldSquareOffIntraday: false,
      statusLabel: 'CLOSED',
      message: 'NSE/BSE Closed (After 03:30 PM IST)',
      reason: 'Indian session ended at 15:30 IST. Showing official closing rates.',
      nextOpenTime: 'Next Trading Day 09:15 IST',
      istDateStr,
      istTimeStr,
    };
  }

  return {
    isOpen: true,
    canEnterNewTrade: timeInMinutes <= 915,
    shouldSquareOffIntraday: timeInMinutes >= 925,
    statusLabel: 'OPEN',
    message: 'NSE & BSE Live Session',
    reason: 'Regular market hours active (09:15 – 15:30 IST).',
    nextOpenTime: 'Closes Today 15:30 IST',
    istDateStr,
    istTimeStr,
  };
}

export function getCryptoSession(nowMs = Date.now()): MarketSessionInfo {
  const ist = getIstDate(nowMs);
  return {
    isOpen: true,
    canEnterNewTrade: true,
    shouldSquareOffIntraday: false,
    statusLabel: '24_7_LIVE',
    message: 'Bitcoin 24/7 Continuous Market',
    reason: 'Crypto spot operates continuously 24/7 including weekends and Indian holidays.',
    nextOpenTime: 'Always Open (24/7)',
    istDateStr: formatIstDateYmd(ist),
    istTimeStr: formatIstTimeHm(ist),
  };
}
