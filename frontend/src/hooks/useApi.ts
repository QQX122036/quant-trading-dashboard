/**
 * useApi.ts — REST API Hook & fetch utilities
 * 封装所有后端 REST API 调用
 *
 * 请求防抖: 300ms debounce
 * 失败重试: 最多3次，间隔 1s/2s/3s
 */
import type {
  OrderData,
  TradeData,
  PositionData,
  AccountData,
  ContractData,
  QuoteData,
} from '../types/vnpy';
import { getErrorTracker } from '../stores/errorStore';
import { logger } from '../lib/logger';

// Use env var or empty string (Vite dev server proxy handles /api → backend)
const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

// Lazy-load error tracker to avoid circular deps at module init
function getTracker() {
  try {
    return getErrorTracker();
  } catch {
    return null;
  }
}

// ── Debounce ─────────────────────────────────────────────
// Pending request pool: key → { timer, promise }
const DEBOUNCE_MS = 100;

interface PendingRequest {
  timer: ReturnType<typeof setTimeout>;
  promise: Promise<ApiResponse<unknown>>;
}

const pendingRequests = new Map<string, PendingRequest>();

/**
 * 防抖请求：同一 key（path+method）在 DEBOUNCE_MS 窗口内只发一次
 * 后续请求复用进行中的请求（等待同一个 Promise）
 */
function debouncedFetch<T>(
  key: string,
  fn: () => Promise<ApiResponse<T>>
): Promise<ApiResponse<T>> {
  const existing = pendingRequests.get(key);
  if (existing) {
    // Return the SAME promise so all concurrent requests chain to one fetch
    return existing.promise as Promise<ApiResponse<T>>;
  }

  let _timer: ReturnType<typeof setTimeout> | undefined;

  const p = new Promise<ApiResponse<T>>((resolve, reject) => {
    _timer = setTimeout(async () => {
      pendingRequests.delete(key);
      try {
        const result = await fn();
        resolve(result);
      } catch (e) {
        reject(e);
      }
    }, DEBOUNCE_MS);
  });

  pendingRequests.set(key, {
    timer: _timer!,
    promise: p as Promise<ApiResponse<unknown>>,
  });

  return p;
}

// ── Retry ────────────────────────────────────────────────
const RETRY_DELAYS = [1000, 2000, 3000]; // ms
const MAX_RETRIES = 3;

async function withRetry<T>(
  fn: () => Promise<ApiResponse<T>>,
  onRetry?: (attempt: number, delay: number) => void
): Promise<ApiResponse<T>> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await fn();
      // 429 or 5xx → retry
      return result;
    } catch (e: unknown) {
      lastError = e;
      const errObj = e as Record<string, unknown> | undefined;
      const httpCode = String(errObj?.code ?? '');
      const isRetryable =
        httpCode.startsWith('HTTP_5') || httpCode === 'HTTP_429' || httpCode.startsWith('HTTP_50');
      if (attempt < MAX_RETRIES && isRetryable) {
        const delay = RETRY_DELAYS[attempt] ?? 3000;
        onRetry?.(attempt + 1, delay);
        await new Promise((res) => setTimeout(res, delay));
        continue;
      }
      throw e;
    }
  }
  throw lastError;
}

// ── Helper Functions ───────────────────────────────────────

/**
 * 检查API响应的code是否表示成功
 * 支持字符串'0'和数字0
 */
export function isSuccessCode(code: string | number | undefined, success?: boolean): boolean {
  if (success === true) return true;
  return code === '0' || code === 0;
}

// ── Auth Token Management ─────────────────────────────────────

const TOKEN_KEY = 'auth_token';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

// ── Core fetch (debounced + retried) ──────────────────────

function buildKey(path: string, options: RequestInit = {}): string {
  return `${options.method ?? 'GET'}:${path}`;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const key = buildKey(path, options);

  return debouncedFetch<T>(key, () => withRetry<T>(() => _rawFetch<T>(path, options)));
}

async function _rawFetch<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const token = getAuthToken();
  const startTime = Date.now();
  logger.debug(`[API] ${options.method ?? 'GET'} ${path}`);
  const headers = new Headers({
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  });

  // 已移除认证，不再添加Authorization header

  let res: Response;
  try {
    res = await fetch(url, { headers, ...options });
  } catch (e: unknown) {
    // 网络级错误（DNS 失败/连接拒绝/超时）
    const duration = Date.now() - startTime;
    const tracker = getTracker();
    if (tracker) {
      tracker.trackApiError({
        url,
        method: options.method ?? 'GET',
        duration,
        responseBody: String(e),
        meta: { retryable: true },
      });
    }
    throw { code: 'NETWORK_ERROR', message: String(e) };
  }

  const duration = Date.now() - startTime;
  const tracker = getTracker();

  if (!res.ok) {
    let responseBody = '';
    try {
      const raw = await res.text();
      responseBody = raw.slice(0, 500);
    } catch {
      /* ignore */
    }

    if (tracker) {
      tracker.trackApiError({
        url,
        method: options.method ?? 'GET',
        status: res.status,
        statusText: res.statusText,
        duration,
        responseBody,
        meta: {},
      });
    }

    const err = await res.json().catch(() => ({
      code: `HTTP_${res.status}`,
      message: res.statusText,
    }));
    throw err;
  }

  const data = await res.json();
  // 如果返回的业务 code 不为 0，视为 API 错误
  if (data.code !== undefined && data.code !== '0' && data.code !== 0) {
    if (tracker) {
      tracker.trackApiError({
        url,
        method: options.method ?? 'GET',
        status: res.status,
        statusText: res.statusText,
        duration,
        responseBody: JSON.stringify(data).slice(0, 500),
        meta: { api_code: data.code, api_message: data.message },
      });
    }
  }
  // 如果返回的数据已经是ApiResponse格式，直接返回
  // 支持两种格式: {code, message, data} 或 {success: true, ...data}
  if (data.code !== undefined || data.success === true) {
    return data as ApiResponse<T>;
  }
  // 如果返回的是直接的数据对象，包装成ApiResponse格式
  return {
    code: '0',
    message: 'success',
    data: data as T,
  };
}

// ── Auth ─────────────────────────────────────────────────

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user_id: string;
}

export async function login(
  username: string,
  password: string
): Promise<ApiResponse<LoginResponse>> {
  const res = await apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

  // 后端 LoginResponse 是裸对象: { access_token, user_id, expires_in }
  // apiFetch 的 _rawFetch 会包装成 ApiResponse 格式: { code: '0', message: 'success', data: LoginResponse }
  // 但若后端直接返回裸对象（未包装），则 token 在顶层
  // 兼容两种格式：1) ApiResponse 包装  2) 裸 LoginResponse
  let token: string | undefined = undefined;

  if (res && typeof res === 'object') {
    // 尝试 ApiResponse 包装格式: { code, message, data: { access_token } }
    const wrapper = res as unknown as Record<string, unknown>;
    const dataObj = (wrapper.data || wrapper) as Record<string, unknown>;
    token = typeof dataObj?.access_token === 'string' ? dataObj.access_token : undefined;
  }

  if (isSuccessCode((res as ApiResponse<LoginResponse>).code) && token) {
    logger.debug(`[Auth] Token obtained, length=${token.length}`);
    setAuthToken(token);
  }

  return res as ApiResponse<LoginResponse>;
}

export async function logout(): Promise<void> {
  clearAuthToken();
}

// ── Health ─────────────────────────────────────────────────

export interface HealthInfo {
  status: string;
  version: string;
  gateways: string[];
  ws_connections: number;
  uptime_seconds: number;
}

export async function fetchHealth(): Promise<ApiResponse<HealthInfo>> {
  return apiFetch<HealthInfo>('/api/health');
}

// ── Gateways ───────────────────────────────────────────────

export async function fetchGateways(): Promise<ApiResponse<{ gateways: GatewayInfo[] }>> {
  return apiFetch<{ gateways: GatewayInfo[] }>('/api/gateways');
}

export async function connectGateway(
  gatewayName: string,
  setting: Record<string, string>
): Promise<ApiResponse<{ status: string; gateway_name: string; message: string }>> {
  return apiFetch(`/api/gateways/${gatewayName}/connect`, {
    method: 'POST',
    body: JSON.stringify({ setting }),
  });
}

export async function disconnectGateway(
  gatewayName: string
): Promise<ApiResponse<{ status: string; gateway_name: string }>> {
  return apiFetch(`/api/gateways/${gatewayName}/disconnect`, { method: 'POST' });
}

// ── Orders ─────────────────────────────────────────────────

export interface SendOrderResponse {
  vt_orderid: string;
  status: string;
}

export async function fetchOrders(gateway?: string) {
  const url = gateway ? `/api/order/all?gateway=${encodeURIComponent(gateway)}` : '/api/order/all';
  return apiFetch<{ success: boolean; total: number; orders: OrderData[] }>(url);
}

export async function submitOrder(req: SendOrderReq): Promise<ApiResponse<SendOrderResponse>> {
  return apiFetch<SendOrderResponse>('/api/order/send', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function cancelOrder(
  vt_orderid: string,
  symbol: string,
  exchange: string
): Promise<ApiResponse<void>> {
  return apiFetch<void>('/api/order/cancel', {
    method: 'POST',
    body: JSON.stringify({ orderid: vt_orderid, symbol, exchange }),
  });
}

export async function fetchActiveOrders(gateway?: string) {
  const url = gateway
    ? `/api/order/active?gateway=${encodeURIComponent(gateway)}`
    : '/api/order/active';
  return apiFetch<{ success: boolean; total: number; orders: OrderData[] }>(url);
}

// ── Trades ─────────────────────────────────────────────────

export async function fetchTrades(gateway?: string) {
  const url = gateway
    ? `/api/order/trades?gateway=${encodeURIComponent(gateway)}`
    : '/api/order/trades';
  return apiFetch<{ success: boolean; total: number; trades: TradeData[] }>(url);
}

// ── Positions ──────────────────────────────────────────────

export async function fetchPositions(gateway?: string) {
  const url = gateway
    ? `/api/position/positions?gateway=${encodeURIComponent(gateway)}`
    : '/api/position/positions';
  return apiFetch<{ positions: PositionData[] }>(url);
}

// ── Accounts ──────────────────────────────────────────────

export async function fetchAccounts(gateway?: string) {
  const url = gateway
    ? `/api/position/accounts?gateway=${encodeURIComponent(gateway)}`
    : '/api/position/accounts';
  return apiFetch<{ accounts: AccountData[] }>(url);
}

// ── Contracts ─────────────────────────────────────────────

export async function fetchContracts(keyword?: string) {
  const url = keyword
    ? `/api/gateways/contracts?keyword=${encodeURIComponent(keyword)}`
    : '/api/gateways/contracts';
  return apiFetch<{ contracts: ContractData[] }>(url);
}

// ── Market Data ────────────────────────────────────────────

export interface KLineReq {
  symbol: string;
  exchange: string;
  interval: string;
  start?: string;
  end?: string;
  limit?: number;
}

export interface KLineBar {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function fetchKLine(req: KLineReq): Promise<ApiResponse<{ bars: KLineBar[] }>> {
  const params = new URLSearchParams({
    symbol: req.symbol,
    exchange: req.exchange,
    interval: req.interval,
    ...(req.start && { start: req.start }),
    ...(req.end && { end: req.end }),
    ...(req.limit && { limit: String(req.limit) }),
  });
  const res = await apiFetch<KLineBar[]>(`/api/data/kline?${params}`);
  if (res.code === '0') {
    return { code: '0', message: res.message, data: { bars: res.data ?? [] } };
  }
  return res as unknown as ApiResponse<{ bars: KLineBar[] }>;
}

export interface DailyBar {
  ts_code: string;
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount: number;
  change_pct: number;
  pre_close: number;
}

export type AdjustType = 'none' | 'forward' | 'backward';

export async function fetchDailyBar(
  ts_code: string,
  start_date?: string,
  end_date?: string,
  limit = 100,
  adjust?: 'yes' | 'no',
  adjust_type?: AdjustType
): Promise<ApiResponse<{ bars: DailyBar[] }>> {
  const params = new URLSearchParams({
    ts_code: ts_code,
    ...(start_date && { start_date }),
    ...(end_date && { end_date }),
    limit: String(limit),
    ...(adjust && { adjust }),
    ...(adjust_type && { adjust_type }),
  });
  const res = await apiFetch<DailyBar[] | { items: DailyBar[] }>(`/api/data/daily-bar?${params}`);
  // 兼容后端返回的数据结构
  if (isSuccessCode(res.code)) {
    if (Array.isArray(res.data)) {
      return { code: '0', message: 'success', data: { bars: res.data } };
    }
    if (res.data && 'items' in res.data) {
      return { code: '0', message: 'success', data: { bars: res.data.items } };
    }
    return { code: '0', message: 'success', data: { bars: [] } };
  }
  return res as unknown as ApiResponse<{ bars: DailyBar[] }>;
}

export async function fetchIndexBars(
  ts_code: string,
  start_date?: string,
  end_date?: string,
  limit?: number
): Promise<ApiResponse<{ ts_code: string; total: number; items: IndexBarItem[] }>> {
  const params = new URLSearchParams({
    ts_code,
    ...(start_date && { start_date }),
    ...(end_date && { end_date }),
    ...(limit && { limit: String(limit) }),
  });
  const res = await apiFetch<{ ts_code: string; total: number; items: IndexBarItem[] }>(
    `/api/data/index?${params}`
  );
  // 兼容后端返回的数据结构
  if (res.code === '0' && Array.isArray(res.data)) {
    return {
      code: '0',
      message: res.message,
      data: {
        ts_code,
        total: res.data.length,
        items: res.data,
      },
    };
  }
  return res;
}

export const MAJOR_INDICES = [
  { ts_code: '000001.SH', name: '上证指数', symbol: '000001', displayName: '上证指数' },
  { ts_code: '399001.SZ', name: '深证成指', symbol: '399001', displayName: '深证成指' },
  { ts_code: '399006.SZ', name: '创业板指', symbol: '399006', displayName: '创业板指' },
  { ts_code: '000016.SH', name: '上证50', symbol: '000016', displayName: '上证50' },
  { ts_code: '000300.SH', name: '沪深300', symbol: '000300', displayName: '沪深300' },
  { ts_code: '000905.SH', name: '中证500', symbol: '000905', displayName: '中证500' },
];

export async function fetchSectorRanking(
  date?: string
): Promise<ApiResponse<{ date: string; total: number; items: SectorItem[] }>> {
  const params = date ? `?date=${date}` : '';
  return apiFetch<{ date: string; total: number; items: SectorItem[] }>(
    `/api/data/sector-ranking${params}`
  );
}

export async function fetchHotStocks(
  date?: string
): Promise<ApiResponse<{ date: string; total: number; items: HotStockItem[] }>> {
  const params = date ? `?date=${date}` : '';
  return apiFetch<{ date: string; total: number; items: HotStockItem[] }>(
    `/api/data/hot-stocks${params}`
  );
}

export async function fetchMarketBreadth(
  trade_date?: string
): Promise<ApiResponse<MarketBreadthData>> {
  const params = trade_date ? `?trade_date=${trade_date}` : '';
  return apiFetch<MarketBreadthData>(`/api/data/market-breadth${params}`);
}

export function calcSentiment(upRatio: number): SentimentType {
  if (upRatio >= 0.7) return 'bullish';
  if (upRatio <= 0.3) return 'bearish';
  return 'neutral';
}

// ── Data Import/Export ──────────────────────────────────────

export interface DataImportResponse {
  success: boolean;
  rows_imported: number;
  table_name: string;
  message: string;
}

export async function importData(
  table: string,
  file: File
): Promise<ApiResponse<DataImportResponse>> {
  const formData = new FormData();
  formData.append('table', table);
  formData.append('file', file);

  const url = `/api/data/import`;
  const res = await fetch(url, {
    method: 'POST',
    body: formData,
  });
  const json = await res.json();
  return json as ApiResponse<DataImportResponse>;
}

export interface DataExportResponse {
  success: boolean;
  filename: string;
  row_count: number;
  download_url: string;
}

export async function exportData(table: string): Promise<ApiResponse<DataExportResponse>> {
  return apiFetch<DataExportResponse>(`/api/data/export?table=${encodeURIComponent(table)}`);
}

export interface CollectionProgress {
  total_stocks: number;
  collected_stocks: number;
  progress_pct: number;
  status: 'idle' | 'running' | 'paused' | 'error';
  last_updated: string;
  message: string;
}

export async function fetchCollectionProgress(): Promise<ApiResponse<CollectionProgress>> {
  return apiFetch<CollectionProgress>('/api/data/collection-progress');
}

// ── Backtest ────────────────────────────────────────────────

export interface BacktestProgress {
  task_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  message: string;
}

export interface BacktestSummary {
  ts_code?: string;
  strategy_type?: string;
  start_date?: string;
  end_date?: string;
  initial_capital?: number;
  end_capital?: number;
  total_trades?: number;
  total_return?: number;
  annual_return?: number;
  sharpe_ratio?: number;
  max_drawdown?: number;
  win_rate?: number;
}

export interface BacktestResult {
  task_id?: string;
  summary?: BacktestSummary;
  equity_curve?: unknown[];
  // flat fields (some backends return flat structure)
  ts_code?: string;
  strategy_type?: string;
  start_date?: string;
  end_date?: string;
  initial_capital?: number;
  end_capital?: number;
  total_trades?: number;
  total_return?: number;
  sharpe_ratio?: number;
  max_drawdown?: number;
  win_rate?: number;
  annual_return?: number;
  excess_return?: number;
  calmar_ratio?: number;
  profit_loss_ratio?: number;
}

export interface BacktestRunReq {
  strategy: string;
  symbols: string[];
  start_date: string;
  end_date: string;
  factor_weights?: {
    valuation?: number;
    momentum?: number;
    quality?: number;
    sentiment?: number;
  };
  stock_count?: number;
}

export interface BacktestTasksResponse {
  tasks: Array<{ task_id: string; strategy: string; status: string; created_at: string }>;
}

export async function fetchBacktestTasks(): Promise<ApiResponse<BacktestTasksResponse>> {
  return apiFetch<BacktestTasksResponse>('/api/backtest/tasks');
}

export async function runBacktest(req: BacktestRunReq): Promise<ApiResponse<{ task_id: string }>> {
  // 后端 BacktestSubmitRequest 格式：ts_code(单只), start_date, end_date
  const backendReq = {
    ts_code: req.symbols.length > 0 ? req.symbols[0] : undefined,
    start_date: req.start_date,
    end_date: req.end_date,
  };
  return apiFetch<{ task_id: string }>('/api/backtest', {
    method: 'POST',
    body: JSON.stringify(backendReq),
  });
}

export async function getBacktestProgress(taskId: string): Promise<ApiResponse<BacktestProgress>> {
  return apiFetch<BacktestProgress>(`/api/backtest/${taskId}/status`);
}

export async function getBacktestResult(taskId: string): Promise<ApiResponse<BacktestResult>> {
  return apiFetch<BacktestResult>(`/api/backtest/${taskId}/result`);
}

// ── Strategy Management ─────────────────────────────────────

export interface StrategyItem {
  id: string;
  name: string;
  strategy_type: string;
  status: 'running' | 'stopped' | 'error';
  params: Record<string, unknown>;
  pnl: number;
  running_time?: number; // seconds
  logs?: string[];
  created_at?: string;
  last_updated?: string;
}

export async function fetchStrategies(): Promise<ApiResponse<{ strategies: StrategyItem[] }>> {
  return apiFetch<{ strategies: StrategyItem[] }>('/api/strategies');
}

export async function startStrategy(id: string): Promise<ApiResponse<{ status: string }>> {
  return apiFetch<{ status: string }>(`/api/strategies/${id}/start`, { method: 'POST' });
}

export async function stopStrategy(id: string): Promise<ApiResponse<{ status: string }>> {
  return apiFetch<{ status: string }>(`/api/strategies/${id}/stop`, { method: 'POST' });
}

export async function deleteStrategy(id: string): Promise<ApiResponse<void>> {
  return apiFetch<void>(`/api/strategies/${id}`, { method: 'DELETE' });
}

export async function updateStrategy(
  id: string,
  data: { strategy_type?: string; params?: Record<string, unknown> }
): Promise<ApiResponse<{ status: string }>> {
  return apiFetch<{ status: string }>(`/api/strategies/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

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
  success?: boolean;
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

// ── Quotes ─────────────────────────────────────────────────

export async function fetchQuotes(): Promise<ApiResponse<{ quotes: QuoteData[]; total: number }>> {
  return apiFetch<{ quotes: QuoteData[]; total: number }>('/api/quotes');
}

export async function cancelQuote(quoteId: string): Promise<ApiResponse<void>> {
  return apiFetch<void>(`/api/quotes/cancel/${encodeURIComponent(quoteId)}`, {
    method: 'POST',
  });
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
  default_setting?: Record<
    string,
    {
      label: string;
      type: 'text' | 'password' | 'number';
      default: string;
      required: boolean;
      placeholder?: string;
    }
  >;
}

// ── Settings ─────────────────────────────────────────────────

export interface Settings {
  theme: 'dark' | 'light';
  default_gateway: string;
  [key: string]: unknown;
}

export async function saveSettings(settings: Settings): Promise<ApiResponse<{ success: boolean }>> {
  return apiFetch<{ success: boolean }>('/api/settings', {
    method: 'POST',
    body: JSON.stringify(settings),
  });
}

// ── Factor Analysis ─────────────────────────────────────────

export interface FactorICItem {
  date: string;
  ic: number;
  ic_rank: number;
}

export interface FactorIRItem {
  factor_name: string;
  ir: number;
  rank_ic_mean: number;
  rank_ic_std: number;
}

export interface FactorCorrelationItem {
  factor_1: string;
  factor_2: string;
  correlation: number;
}

export interface MultiFactorScore {
  ts_code: string;
  name?: string;
  composite_score: number;
  valuation_score: number;
  momentum_score: number;
  quality_score: number;
  sentiment_score: number;
  rank: number;
}

export async function fetchFactorIC(
  ts_code: string,
  factor?: string,
  start_date?: string,
  end_date?: string
): Promise<ApiResponse<{ items: FactorICItem[] }>> {
  const params = new URLSearchParams({ ts_code });
  if (factor) params.set('factor', factor);
  if (start_date) params.set('start_date', start_date);
  if (end_date) params.set('end_date', end_date);
  return apiFetch<{ items: FactorICItem[] }>(`/api/factors/ic?${params}`);
}

export async function fetchFactorIR(
  ts_code: string,
  start_date?: string,
  end_date?: string
): Promise<ApiResponse<{ items: FactorIRItem[] }>> {
  const params = new URLSearchParams({ ts_code });
  if (start_date) params.set('start_date', start_date);
  if (end_date) params.set('end_date', end_date);
  return apiFetch<{ items: FactorIRItem[] }>(`/api/factors/ir?${params}`);
}

export async function fetchFactorCorrelation(
  ts_code: string,
  start_date?: string,
  end_date?: string
): Promise<ApiResponse<{ items: FactorCorrelationItem[] }>> {
  const params = new URLSearchParams({ ts_code });
  if (start_date) params.set('start_date', start_date);
  if (end_date) params.set('end_date', end_date);
  return apiFetch<{ items: FactorCorrelationItem[] }>(`/api/factors/correlation?${params}`);
}

export async function fetchMultiFactorScores(
  ts_code: string,
  start_date?: string,
  end_date?: string,
  limit = 50
): Promise<ApiResponse<{ items: MultiFactorScore[] }>> {
  const params = new URLSearchParams({ ts_code, limit: String(limit) });
  if (start_date) params.set('start_date', start_date);
  if (end_date) params.set('end_date', end_date);
  return apiFetch<{ items: MultiFactorScore[] }>(`/api/factors/scores?${params}`);
}

// ── Alpha Signals ─────────────────────────────────────────

export interface AlphaStock {
  ts_code: string;
  name: string;
  industry: string;
  alpha20: number;
  rating: string;
  rating_label?: string;
}

export async function fetchAlphaTop20(): Promise<
  ApiResponse<{ date: string; total: number; items: AlphaStock[] }>
> {
  return apiFetch<{ date: string; total: number; items: AlphaStock[] }>('/api/alpha/top20');
}

// ── Equity Curve ─────────────────────────────────────────────────

export interface EquityCurvePoint {
  date: string;
  equity: number;
  benchmark: number;
  benchmark_date: string;
  drawdown: number;
  daily_return: number;
  rolling_sharpe: number;
}

export interface EquityCurveResponse {
  success: boolean;
  account_id: string;
  start_date: string;
  end_date: string;
  initial_balance: number;
  final_equity: number;
  total_return: number;
  benchmark_return: number;
  max_drawdown: number;
  curve: EquityCurvePoint[];
  message?: string;
}

export async function fetchEquityCurve(
  accountId = 'default',
  startDate?: string,
  endDate?: string
): Promise<ApiResponse<EquityCurveResponse>> {
  const params = new URLSearchParams({ account_id: accountId });
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);
  return apiFetch<EquityCurveResponse>(`/api/equity-curve?${params}`);
}
