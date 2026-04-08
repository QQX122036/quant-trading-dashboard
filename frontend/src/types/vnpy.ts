// ============================================================
// vnpy.ts — TypeScript types mirroring vnpy Python data objects
// Source: api_specification.md + vnpy/trader/object.py
// ============================================================

export type Exchange = 'SSE' | 'SZE' | 'CFFEX' | 'SHFE' | 'DCE' | 'CZCE' | 'INE';
export type Direction = '多' | '空';
export type Offset = '开' | '平' | '平今' | '平昨';
export type OrderType = '限价' | '市价' | 'STOP' | 'FOK' | 'FAK';
export type OrderStatus = '提交中' | '未成交' | '部分成交' | '全部成交' | '已撤销' | '拒单';
export type Product = '股票' | '期货' | '期权' | '外汇' | '债券' | '基金';

export interface TickData {
  symbol: string; // e.g. "600519"
  exchange: Exchange;
  name: string;
  last_price: number;
  volume: number;
  open_price: number;
  high_price: number;
  low_price: number;
  pre_close: number;
  bid_price_1: number;
  bid_price_2: number;
  bid_price_3: number;
  bid_price_4: number;
  bid_price_5: number;
  ask_price_1: number;
  ask_price_2: number;
  ask_price_3: number;
  ask_price_4: number;
  ask_price_5: number;
  bid_volume_1: number;
  bid_volume_2: number;
  bid_volume_3: number;
  bid_volume_4: number;
  bid_volume_5: number;
  ask_volume_1: number;
  ask_volume_2: number;
  ask_volume_3: number;
  ask_volume_4: number;
  ask_volume_5: number;
  open_interest: number;
  datetime: string; // ISO 8601
  gateway_name: string;
}

export interface OrderData {
  vt_orderid: string; // "DUCKDB_SIM.202604050001"
  reference: string;
  symbol: string;
  exchange: Exchange;
  direction: Direction;
  offset: Offset;
  type: OrderType;
  price: number;
  volume: number;
  traded: number;
  status: OrderStatus;
  datetime: string;
  gateway_name: string;
}

export interface TradeData {
  vt_tradeid: string;
  vt_orderid: string;
  symbol: string;
  exchange: Exchange;
  direction: Direction;
  offset: Offset;
  price: number;
  volume: number;
  datetime: string;
  gateway_name: string;
}

export interface PositionData {
  vt_positionid: string; // "DUCKDB_SIM.600519.SSE.多"
  symbol: string;
  exchange: Exchange;
  direction: Direction;
  volume: number;
  yd_position: number;
  frozen: number;
  price: number;
  pnl: number;
  gateway_name: string;
}

export interface AccountData {
  vt_accountid: string;
  accountid: string;
  balance: number;
  frozen: number;
  available: number;
  gateway_name: string;
}

export interface LogData {
  datetime: string;
  msg: string;
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
  gateway_name: string;
}

export interface ContractData {
  vt_symbol: string; // "600519.SSE"
  symbol: string;
  exchange: Exchange;
  name: string;
  product: Product;
  size: number; // 合约乘数
  price_tick: number; // 最小变动价位
  stop_timeout: number;
  gateway_name: string;
}

// ── Daily Bar (K线) ──────────────────────────────────────────
export interface DailyBar {
  datetime: string; // ISO date "2026-04-05"
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ── Factor Signal ───────────────────────────────────────────
export interface FactorSignal {
  datetime: string;
  symbol: string;
  factor_name: string;
  factor_value: number;
  signal: 'BUY' | 'SELL' | 'HOLD';
  strength: number; // 0-1
}

// ── Backtest Result ─────────────────────────────────────────
export interface BacktestResult {
  strategy_name: string;
  symbol: string;
  start_date: string;
  end_date: string;
  total_return: number; // %
  sharpe_ratio: number;
  max_drawdown: number; // %
  win_rate: number; // %
  total_trades: number;
  equity_curve: { date: string; value: number }[];
}

// ── Quote (报价) ───────────────────────────────────────────
export type QuoteStatus = '活跃' | '已成交' | '已撤销';

export interface QuoteData {
  quote_id: string;
  source: string; // 'SIM' | 'Tencent'
  ts_code: string; // e.g. '600519.SH'
  symbol: string; // e.g. '600519'
  exchange: string;
  bid_price_1: number;
  bid_price_2: number;
  bid_price_3: number;
  bid_price_4: number;
  bid_price_5: number;
  bid_volume_1: number;
  bid_volume_2: number;
  bid_volume_3: number;
  bid_volume_4: number;
  bid_volume_5: number;
  ask_price_1: number;
  ask_price_2: number;
  ask_price_3: number;
  ask_price_4: number;
  ask_price_5: number;
  ask_volume_1: number;
  ask_volume_2: number;
  ask_volume_3: number;
  ask_volume_4: number;
  ask_volume_5: number;
  bid_offset: string; // '开' | '平'
  ask_offset: string; // '开' | '平'
  status: QuoteStatus;
  time: string; // 'YYYY-MM-DD HH:MM:SS'
}
