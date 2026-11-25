export type MainTab = 'home' | 'charts' | 'positions' | 'orders' | 'account';
export type PositionsSubTab = 'positions' | 'chain';
export type OrdersSubTab = 'trades' | 'ledger' | 'ai_signals';

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

export interface MarketQuote {
  symbol: string;
  display_name: string;
  exchange: string;
  token: string;
  asset_type: 'INDEX_SPOT' | 'EQUITY_SPOT' | 'CRYPTO_SPOT' | 'INDEX_F_AND_O';
  ltp: number;
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  net_change: number;
  percent_change: number;
  volume: number;
  oi: number;
  feed_time: string;
  data_status: 'LIVE' | 'MARKET_CLOSED' | 'UNAVAILABLE';
  source: string;
  updated_at: string;
}

export interface PaperAccount {
  id: string;
  initial_capital: number;
  available_balance: number;
  invested_amount: number;
  realized_pnl: number;
  today_realized_pnl: number;
  total_charges_paid: number;
  trading_mode: 'PAPER' | 'REAL_LOCKED';
  capital_allocation_mode: 'ONE_THIRD' | 'TWO_THIRDS' | 'FULL' | 'CUSTOM';
  custom_allocation_amount: number;
  auto_trade_active: boolean;
  selected_instrument: string;
  auto_trade_activated_at: string | null;
  kill_switch_active: boolean;
  risk_per_trade_pct: number;
  max_open_positions: number;
  max_trades_per_day: number;
  today_trades_count: number;
  max_daily_loss_amount: number;
  max_daily_loss_pct: number;
  daily_profit_target: number;
  stop_loss_pct: number;
  target_profit_pct: number;
  indian_min_target_inr: number;
  indian_max_loss_inr: number;
  max_capital_used_pct: number;
  selected_timeframe: string;
  equity_stocks_enabled: boolean;
  session_date: string;
  last_worker_run_at: string | null;
  last_worker_status: string;
  updated_at: string;
  allocated_budget_preview?: number;
}

export interface PortfolioSummary {
  portfolio_value: number;
  initial_capital: number;
  available_balance: number;
  invested_amount: number;
  open_unrealized_pnl: number;
  today_pnl: number;
  today_realized_pnl: number;
  overall_pnl: number;
  realized_pnl: number;
  total_charges_paid: number;
  usd_inr_rate: number;
}

export interface PositionItem {
  id: string;
  account_id: string;
  position_id: string;
  symbol: string;
  underlying: string;
  instrument_token: string;
  exchange: string;
  asset_type: string;
  option_type: 'CE' | 'PE' | null;
  strike_price: number | null;
  expiry_date: string | null;
  lot_size: number;
  lots: number;
  side: string;
  quantity: number;
  entry_price: number;
  current_price: number;
  exit_price: number | null;
  invested_amount: number;
  stop_loss: number;
  take_profit: number;
  unrealized_pnl: number;
  realized_pnl: number;
  entry_charges: number;
  exit_charges: number;
  status: 'OPEN' | 'CLOSED';
  entry_reason: string;
  exit_reason: string | null;
  ai_score: number;
  decision_chain: any;
  data_source: string;
  currency: 'INR' | 'USD';
  allocation_mode: string;
  opened_at: string;
  closed_at: string | null;
  updated_at: string;
}

export interface TransactionItem {
  id: string;
  tx_id: string;
  position_id: string | null;
  tx_type: 'ENTRY' | 'EXIT' | 'ADJUSTMENT' | 'RESET';
  symbol: string;
  underlying: string;
  option_type: string | null;
  side: string;
  quantity: number;
  lot_size: number;
  price: number;
  amount: number;
  charges: number;
  realized_pnl: number;
  trade_duration_sec: number | null;
  reason: string;
  currency: 'INR' | 'USD';
  created_at: string;
}

export interface AISignalRecord {
  id: string;
  symbol: string;
  exchange: string;
  timeframe: string;
  bar_timestamp: string;
  v12_signal: 'BUY' | 'SELL' | 'HOLD';
  v12_confidence: number;
  spot_price: number;
  ai_decision: 'APPROVED' | 'REJECTED' | 'WAITING';
  ai_score: number;
  ai_reason: string;
  selected_option_symbol: string | null;
  selected_option_token: string | null;
  selected_option_ltp: number | null;
  lot_size: number | null;
  factor_breakdown: Record<string, { score: number; max: number; note: string }>;
  warnings: string[];
  data_source: string;
  created_at: string;
}

export interface LiveScanState {
  underlying: string;
  timeframe: string;
  barTime: number;
  trendDir: 1 | -1;
  signal: 'BUY' | 'SELL' | 'HOLD';
  rsi: number;
  chopIndex: number;
  atr: number;
  fuelState: string;
  closePrice: number;
  waitingFreshAfterActivation: boolean;
  updated_at: string;
}

export interface OverviewResponse {
  account: PaperAccount;
  portfolio: PortfolioSummary;
  sessions: {
    indian: MarketSessionInfo;
    crypto: MarketSessionInfo;
  };
  quotes: MarketQuote[];
  indexMeta: Record<string, { nearestExpiry: string; expiryDate: string; lotSize: number }>;
  angelConnected: boolean;
  angelError: string | null;
  openPositions: PositionItem[];
  closedPositions: PositionItem[];
  transactions: TransactionItem[];
  aiSignals: AISignalRecord[];
  liveScanState: LiveScanState | null;
  scripSyncMeta: { synced_at?: string; options?: number; equities?: number } | null;
  lastSessionEvent: { message?: string; at?: string } | null;
}

export interface CandlePoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CandlesResponse {
  ok: boolean;
  error?: string;
  symbol: string;
  displayName?: string;
  exchange?: string;
  token?: string;
  timeframe: string;
  candles: CandlePoint[];
  livePrice?: number;
  openPrice?: number;
  change?: number;
  changePct?: number;
  source?: string;
  dataStatus?: string;
  indianSession?: MarketSessionInfo;
  v12Summary?: any;
}

export interface OptionContractQuote {
  symbol: string;
  token: string;
  exchange: string;
  expiry: string;
  expiryDate: string;
  strike: number;
  optionType: 'CE' | 'PE';
  lotSize: number;
  ltp: number;
  netChange: number;
  percentChange: number;
  oi: number;
  volume: number;
  bid: number;
  ask: number;
  lotCost: number;
}

export interface OptionsChainResponse {
  underlying: string;
  displayName: string;
  spotPrice: number;
  atmStrike: number;
  strikeStep: number;
  lotSize: number;
  chosenExpiry: string;
  expiries: Array<{ expiry: string; expiryDate: string }>;
  dataStatus: 'LIVE' | 'MARKET_CLOSED' | 'UNAVAILABLE';
  source: string;
  quoteError: string | null;
  chain: Array<{
    strike: number;
    ce: OptionContractQuote | null;
    pe: OptionContractQuote | null;
  }>;
}

export interface SearchInstrumentItem {
  symbol: string;
  name: string;
  exchange: string;
  token: string;
  instrumenttype: string;
  expiry?: string;
  expiryDate?: string;
  strike?: number;
  optionType?: string;
  lotsize?: number;
}

export interface ChartTabSpec {
  id: string;
  symbol: string;
  label: string;
  exchange: string;
  token: string;
  subLabel?: string;
}
