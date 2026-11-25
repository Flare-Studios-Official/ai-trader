import {
  CandlesResponse,
  OptionsChainResponse,
  OverviewResponse,
  SearchInstrumentItem,
} from '../types';

function getApiBase(): string {
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/about/ai-trader')) {
    return '/about/ai-trader/api';
  }
  return '/api';
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${getApiBase()}${path}`;
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (res.status === 401 && typeof window !== 'undefined' && window.location.pathname.startsWith('/about/ai-trader')) {
    window.location.href = '/about/ai-trader';
    throw new Error('Authentication required');
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function fetchOverview(watchSymbol?: string): Promise<OverviewResponse> {
  const q = watchSymbol ? `?symbol=${encodeURIComponent(watchSymbol)}` : '';
  return requestJson<OverviewResponse>(`/overview${q}`);
}

export async function fetchQuotes(symbols: string[]): Promise<any> {
  const q = symbols.length ? `?symbols=${encodeURIComponent(symbols.join(','))}` : '';
  return requestJson(`/quotes${q}`);
}

export async function fetchCandles(params: {
  symbol: string;
  timeframe: string;
  exchange?: string;
  token?: string;
}): Promise<CandlesResponse> {
  const qs = new URLSearchParams({
    symbol: params.symbol,
    timeframe: params.timeframe,
  });
  if (params.exchange) qs.set('exchange', params.exchange);
  if (params.token) qs.set('token', params.token);
  return requestJson<CandlesResponse>(`/candles?${qs.toString()}`);
}

export async function fetchOptionsChain(underlying: string, expiry?: string): Promise<OptionsChainResponse> {
  const qs = new URLSearchParams({ underlying });
  if (expiry) qs.set('expiry', expiry);
  return requestJson<OptionsChainResponse>(`/options-chain?${qs.toString()}`);
}

export async function searchInstruments(query: string): Promise<SearchInstrumentItem[]> {
  const res = await requestJson<{ results: SearchInstrumentItem[] }>(
    `/search?q=${encodeURIComponent(query)}`
  );
  return res.results || [];
}

export async function toggleAutoTrade(active: boolean, instrument?: string): Promise<any> {
  return requestJson('/auto-trade/toggle', {
    method: 'POST',
    body: JSON.stringify({ active, instrument }),
  });
}

export async function updateAccountSettings(patch: Record<string, unknown>): Promise<any> {
  return requestJson('/settings', {
    method: 'POST',
    body: JSON.stringify(patch),
  });
}

export async function manageFunds(action: 'ADD' | 'WITHDRAW' | 'RESET', amount?: number): Promise<any> {
  return requestJson('/funds', {
    method: 'POST',
    body: JSON.stringify({ action, amount }),
  });
}

export async function closePosition(positionId?: string, closeAll = false): Promise<any> {
  return requestJson('/positions/close', {
    method: 'POST',
    body: JSON.stringify({ position_id: positionId, close_all: closeAll }),
  });
}

export async function placeManualPaperOrder(payload: {
  underlying: string;
  direction: 'BUY' | 'SELL' | 'BUY_CE' | 'BUY_PE';
  lots?: number;
  token?: string;
  exchange?: string;
  option_symbol?: string;
  strike?: number;
  expiry?: string;
  lot_size?: number;
}): Promise<any> {
  return requestJson('/paper-order', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function toggleKillSwitch(active: boolean): Promise<any> {
  return requestJson('/risk/kill-switch', {
    method: 'POST',
    body: JSON.stringify({ active }),
  });
}

export async function triggerEngineRunNow(): Promise<any> {
  return requestJson('/engine/run-now', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function fetchReports(): Promise<any> {
  return requestJson('/reports');
}
