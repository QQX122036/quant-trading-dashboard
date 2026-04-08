// ── Market Data Types ─────────────────────────────────────

export interface IndexBarItem {
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount: number;
  change_pct: number | null;
}

export interface IndexData {
  ts_code: string;
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount: number;
  change_pct: number | null;
}

export interface SectorItem {
  sector_name: string;
  stock_count: number;
  avg_change_pct: number;
  up_count: number;
  down_count: number;
}

export interface MarketBreadthData {
  up_count: number;
  down_count: number;
  equal_count: number;
  up_ratio: number;
  date: string;
}

export interface HotStockItem {
  ts_code: string;
  name: string;
  close: number;
  volume: number;
  amount: number;
  change_pct: number;
}

export type SentimentType = 'bullish' | 'bearish' | 'neutral';

// ── REST API types ─────────────────────────────────────────

export interface ApiResponse<T> {
  code: string | number;
  message: string;
  data?: T;
}

export interface SendOrderReq {
  symbol: string;
  exchange: string;
  direction: '多' | '空' | 'long' | 'short'; // 前端格式 或 后端格式
  offset: '开' | '平' | 'open' | 'close' | 'none';
  type: string;
  price: number;
  volume: number;
  gateway: string;
  reference?: string;
}

export interface CancelOrderReq {
  vt_orderid: string;
  gateway: string;
}

export interface GatewayInfo {
  name: string;
  display_name: string;
  gateway_type?: string;
  connected?: boolean;
  default_setting?: Record<string, FieldConfig>;
}

export interface FieldConfig {
  label: string;
  type: 'text' | 'password' | 'number';
  default: string;
  required: boolean;
  placeholder?: string;
}
