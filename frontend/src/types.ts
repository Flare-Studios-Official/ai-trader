export interface PortfolioSummary {
  initial_capital: number;
  available_balance: number;
  unrealized_pnl: number;
  realized_pnl: number;
  net_equity: number;
  total_charges_paid: number;
  open_positions_count: number;
  total_trades_completed: number;
}

export interface RiskConfig {
  max_open_positions: number;
  max_trades_per_day: number;
  max_daily_loss_pct: number;
  kill_switch_active: boolean;
  today_trades: number;
  daily_realized_pnl: number;
}

export interface SystemStatus {
  data_mode: string;
  provider_name: string;
  status_message: string;
  is_connected: boolean;
  automated_trading_active: boolean;
  selected_instrument: string; // NIFTY | BANKNIFTY | SENSEX | BANKEX | BITCOIN
  database_status: string;
  kill_switch_active: boolean;
  today_trades: number;
  daily_realized_pnl: number;
  max_open_positions: number;
  max_daily_loss_pct: number;
  risk_per_trade_pct: number;
}

export interface MarketWatchItem {
  symbol: string;
  display_name: string;
  asset_type: "INDEX_F_AND_O" | "CRYPTO_SPOT";
  price: number;
  change: number;
  change_pct: number;
  baseline: number;
  trend: number;
  atr: number;
  rsi: number;
  chop_index: number;
  confidence: number;
  is_24_7: boolean;
  base_currency: string;
  data_mode: string;
}

export interface OpenPosition {
  position_id: string;
  symbol: string;
  asset_type: string;
  side: string;
  quantity: number;
  entry_price: number;
  current_price: number;
  stop_loss: number;
  take_profit: number;
  unrealized_pnl: number;
  opened_at: string;
  decision_chain?: any;
}

export interface ClosedTrade {
  position_id: string;
  symbol: string;
  asset_type: string;
  side: string;
  quantity: number;
  entry_price: number;
  exit_price: number;
  realized_pnl: number;
  opened_at: string;
  closed_at: string;
  exit_reason: string;
  total_charges: number;
}

export interface SignalItem {
  id: number;
  symbol: string;
  asset_type: string;
  timestamp: string;
  stage1_signal: "BUY" | "SELL" | "HOLD";
  stage1_confidence: number;
  close_price: number;
  baseline: number;
  fuel_state: string;
  rsi: number;
  chop_index: number;
  ai_decision: "APPROVED" | "REJECTED" | "WAITING";
  ai_score: number;
  ai_reason: string;
  ai_breakdown?: any;
  risk_status: "APPROVED" | "REJECTED";
  risk_reason: string;
  executed: boolean;
  order_id?: string;
  fill_price?: number;
  data_source: string;
}

export interface OptionStrike {
  strike: number;
  is_atm: boolean;
  call: {
    symbol: string;
    price: number;
    delta: number;
    lot_size: number;
    note?: string;
  };
  put: {
    symbol: string;
    price: number;
    delta: number;
    lot_size: number;
    note?: string;
  };
}

export interface OptionsChainResponse {
  underlying: string;
  spot_price?: number;
  atm_strike?: number;
  lot_size?: number;
  strikes: OptionStrike[];
  message?: string;
  data_mode?: string;
}

export interface DashboardState {
  portfolio: PortfolioSummary;
  open_positions: OpenPosition[];
  trade_history: ClosedTrade[];
  recent_signals: SignalItem[];
  market_watch: MarketWatchItem[];
  system_status: SystemStatus;
}
