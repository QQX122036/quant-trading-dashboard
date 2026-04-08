/**
 * errorStore.ts — 前端错误追踪状态管理
 *
 * 错误类型：
 * - JavaScript Error（未捕获异常）
 * - Promise Rejection（未处理 Promise 拒绝）
 * - API Error（HTTP 错误响应）
 * - Component Error（ErrorBoundary 捕获）
 * - Performance Error（Web Vitals 指标异常）
 *
 * 上报机制：
 * - DEV: 本地存储 + 内存队列 + console 输出
 * - PROD: 批量 POST /api/metrics/errors
 */

import { createSignal } from 'solid-js';
import { logger } from '../lib/logger';
import { apiFetch } from '../hooks/useApi';

// ── Types ───────────────────────────────────────────────────────────────────

export type ErrorLevel = 'critical' | 'error' | 'warning' | 'info';
export type ErrorSource =
  | 'window.onerror'
  | 'unhandledrejection'
  | 'api'
  | 'component'
  | 'websocket'
  | 'performance';

export interface TrackedError {
  id: string;
  level: ErrorLevel;
  source: ErrorSource;
  message: string;
  stack?: string;
  componentStack?: string;
  meta: Record<string, unknown>;
  timestamp: number;
  count: number; // 相同错误的聚合计数
  resolved: boolean;
}

export interface ErrorReport {
  errors: TrackedError[];
  sessionId: string;
  userAgent: string;
  url: string;
  appVersion: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_STORED_ERRORS = 100;
const REPORT_BATCH_SIZE = 10;
const DEDUP_WINDOW_MS = 5_000; // 5s 内相同 error message 视为同一错误

// ── Singleton State ────────────────────────────────────────────────────────

class ErrorTracker {
  private errors: TrackedError[] = [];
  private listeners = new Set<(errors: TrackedError[]) => void>();
  private reportTimer: ReturnType<typeof setInterval> | null = null;
  private reportInterval = 60_000; // 60s 上报一次
  private isDev = import.meta.env.DEV;
  private sessionId = this._genSessionId();

  // 全局 error handlers 是否已注册
  private globalHandlersRegistered = false;
  // component error boundary handlers
  private boundaryHandlers = new Map<string, (error: Error, info: string) => void>();

  constructor() {
    // DEV 模式从 localStorage 恢复错误
    if (this.isDev) {
      this.loadFromStorage();
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * 全局错误处理器注册（App.tsx 初始化时调用一次）
   */
  init() {
    if (this.globalHandlersRegistered) return;
    this.globalHandlersRegistered = true;

    // 1. window.onerror — 未捕获的同步错误
    window.onerror = (message, source, lineno, colno, error) => {
      this.trackJsError({
        level: 'error',
        source: 'window.onerror',
        message: String(message),
        stack: error?.stack,
        meta: { source, lineno, colno },
      });
      // 返回 false 让错误继续冒泡（Chrome 会显示在 console）
      return false;
    };

    // 2. window.onunhandledrejection — 未处理的 Promise 拒绝
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : reason != null
            ? String(reason)
            : 'Unknown promise rejection';

      this.trackJsError({
        level:
          reason instanceof Error && reason.name === 'Warning'
            ? ('warning' as ErrorLevel)
            : ('error' as ErrorLevel),
        source: 'unhandledrejection',
        message,
        stack: reason instanceof Error ? reason.stack : undefined,
        meta: { promiseValue: reason != null ? String(reason) : null },
      });
    });

    // 3. 启动定时上报
    this.startReportTimer();
  }

  /**
   * 追踪 JavaScript Error
   */
  trackJsError(opts: {
    level?: ErrorLevel;
    source?: ErrorSource;
    message: string;
    stack?: string;
    componentStack?: string;
    meta?: Record<string, unknown>;
  }) {
    const error = this.createErrorRecord({
      ...opts,
      source: opts.source ?? 'window.onerror',
      level: opts.level ?? 'error',
      meta: opts.meta ?? {},
    });

    this.addError(error);
    this.persistToStorage();
    return error.id;
  }

  /**
   * 追踪 API 错误
   */
  trackApiError(opts: {
    url: string;
    method: string;
    status?: number;
    statusText?: string;
    responseBody?: string;
    duration?: number;
    meta?: Record<string, unknown>;
  }) {
    const level: ErrorLevel =
      opts.status === 0 || opts.status === 401 || opts.status === 403
        ? 'warning'
        : opts.status != null && opts.status >= 500
          ? 'critical'
          : 'error';

    return this.trackJsError({
      level,
      source: 'api',
      message:
        `[API] ${opts.method} ${opts.url} → ${opts.status ?? 'network_error'} ${opts.statusText ?? ''}`.trim(),
      meta: {
        ...opts.meta,
        api_url: opts.url,
        api_method: opts.method,
        http_status: opts.status,
        http_status_text: opts.statusText,
        response_body: opts.responseBody,
        duration_ms: opts.duration,
      },
    });
  }

  /**
   * 追踪 WebSocket 错误
   */
  trackWsError(opts: { message: string; code?: number; meta?: Record<string, unknown> }) {
    return this.trackJsError({
      level: opts.code != null && opts.code > 1000 ? 'critical' : 'error',
      source: 'websocket',
      message: `[WS] ${opts.message}${opts.code != null ? ` (code: ${opts.code})` : ''}`,
      meta: opts.meta ?? {},
    });
  }

  /**
   * 追踪组件渲染错误（由 ErrorBoundary 调用）
   */
  trackComponentError(error: Error, info: string, boundaryId?: string) {
    const id = this.trackJsError({
      level: 'error',
      source: 'component',
      message: error.message,
      stack: error.stack,
      componentStack: info,
      meta: { boundary_id: boundaryId ?? 'unknown' },
    });
    return id;
  }

  /**
   * 追踪 Performance 异常（Web Vitals 指标较差）
   */
  trackPerformanceError(opts: {
    metric: string;
    value: number;
    threshold: number;
    meta?: Record<string, unknown>;
  }) {
    return this.trackJsError({
      level: opts.value > opts.threshold * 1.5 ? 'critical' : 'warning',
      source: 'performance',
      message: `[Perf] ${opts.metric} = ${opts.value.toFixed(2)}ms (threshold: ${opts.threshold}ms)`,
      meta: opts.meta ?? { metric: opts.metric, value: opts.value, threshold: opts.threshold },
    });
  }

  /**
   * 注册 Component ErrorBoundary 回调
   */
  registerBoundary(id: string, handler: (error: Error, info: string) => void) {
    this.boundaryHandlers.set(id, handler);
  }

  /**
   * 手动标记错误为已解决
   */
  resolveError(id: string) {
    const err = this.errors.find((e) => e.id === id);
    if (err) {
      err.resolved = true;
      this.notify();
    }
  }

  /**
   * 清除所有错误
   */
  clearAll() {
    this.errors = [];
    this.notify();
    this.clearStorage();
  }

  /**
   * 获取所有错误
   */
  getErrors(): TrackedError[] {
    return [...this.errors];
  }

  /**
   * 获取未解决的错误数
   */
  getUnresolvedCount(): number {
    return this.errors.filter((e) => !e.resolved).length;
  }

  /**
   * 立即上报所有错误到后端
   */
  async flush(): Promise<void> {
    if (this.errors.length === 0) return;
    await this.reportToBackend([...this.errors]);
  }

  // ── Error Boundary Factory ───────────────────────────────────────────────

  /**
   * 创建一个 ErrorBoundary 错误处理函数（供 ErrorBoundary.tsx 调用）
   */
  makeBoundaryHandler(boundaryId: string) {
    return (error: Error, info: string) => {
      this.trackComponentError(error, info, boundaryId);
    };
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private createErrorRecord(opts: {
    level: ErrorLevel;
    source: ErrorSource;
    message: string;
    stack?: string;
    componentStack?: string;
    meta?: Record<string, unknown>;
  }): TrackedError {
    const now = Date.now();
    // 去重：在 DEDUP_WINDOW_MS 内相同 message 视为同一错误
    const existing = this.errors.find(
      (e) =>
        !e.resolved &&
        e.message === opts.message &&
        e.source === opts.source &&
        now - e.timestamp < DEDUP_WINDOW_MS
    );

    if (existing) {
      existing.count += 1;
      existing.timestamp = now;
      return existing;
    }

    return {
      id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
      level: opts.level,
      source: opts.source,
      message: opts.message,
      stack: opts.stack,
      componentStack: opts.componentStack,
      meta: opts.meta ?? {},
      timestamp: now,
      count: 1,
      resolved: false,
    };
  }

  private addError(error: TrackedError) {
    // 增量添加（非覆盖）
    const existing = this.errors.find((e) => e.id === error.id);
    if (!existing) {
      this.errors.unshift(error); // newest first
      if (this.errors.length > MAX_STORED_ERRORS) {
        this.errors.pop();
      }
    }
    this.notify();
    this.logError(error);
  }

  private notify() {
    this.listeners.forEach((fn) => fn([...this.errors]));
  }

  private logError(err: TrackedError) {
    const level = err.level;
    const prefix = `[ErrorTracker][${err.source}]`;

    const meta = { ...err.meta, stack: err.stack };
    if (level === 'critical' || level === 'error') {
      logger.error(`${prefix} ${err.message}`, meta);
    } else if (level === 'warning') {
      logger.warn(`${prefix} ${err.message}`, meta);
    } else {
      logger.info(`${prefix} ${err.message}`, meta);
    }
  }

  private startReportTimer() {
    this.reportTimer = setInterval(() => {
      const unresolved = this.errors.filter((e) => !e.resolved);
      if (unresolved.length > 0) {
        this.reportToBackend(unresolved.slice(0, REPORT_BATCH_SIZE));
      }
    }, this.reportInterval);
  }

  private async reportToBackend(errors: TrackedError[]): Promise<void> {
    if (errors.length === 0) return;

    const report: ErrorReport = {
      errors,
      sessionId: this.sessionId,
      userAgent: navigator.userAgent,
      url: location.href,
      appVersion: import.meta.env.VITE_APP_VERSION ?? '1.0.0',
    };

    try {
      await apiFetch('/api/metrics/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      });
      if (!this.isDev) {
        // PROD: 成功后清除已上报错误
        errors.forEach((e) => this.resolveError(e.id));
      }
    } catch {
      // 上报失败不影响业务
    }
  }

  private persistToStorage() {
    if (!this.isDev) return;
    try {
      const data = this.errors.slice(0, 50).map((e) => ({
        ...e,
        // 不存储巨大 stack
        stack: e.stack?.slice(0, 500),
      }));
      localStorage.setItem('error_tracker_errors', JSON.stringify(data));
    } catch {
      /* storage full */
    }
  }

  private loadFromStorage() {
    try {
      const raw = localStorage.getItem('error_tracker_errors');
      if (raw) {
        const parsed = JSON.parse(raw) as TrackedError[];
        this.errors = parsed.filter((e) => !e.resolved);
      }
    } catch {
      /* corrupt data */
    }
  }

  private clearStorage() {
    try {
      localStorage.removeItem('error_tracker_errors');
    } catch {
      /* noop */
    }
  }

  private _genSessionId(): string {
    let sid = sessionStorage.getItem('error_sid');
    if (!sid) {
      sid = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem('error_sid', sid);
    }
    return sid;
  }

  dispose() {
    if (this.reportTimer) clearInterval(this.reportTimer);
    this.listeners.clear();
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let _tracker: ErrorTracker | null = null;

export function getErrorTracker(): ErrorTracker {
  if (!_tracker) _tracker = new ErrorTracker();
  return _tracker;
}

// ── SolidJS Signals ────────────────────────────────────────────────────────

const [_errors, _setErrors] = createSignal<TrackedError[]>([]);

/**
 * 监听错误变化（返回 cleanup fn）
 */
export function watchErrors(fn: (errors: TrackedError[]) => void): () => void {
  const tracker = getErrorTracker();
  tracker.init(); // 确保只初始化一次
  fn(tracker.getErrors());
  tracker['listeners'].add(fn as never);
  return () => tracker['listeners'].delete(fn as never);
}

export { _errors as trackedErrors };

/**
 * 便捷方法：在组件中直接调用
 */
export function useErrorTracker() {
  return {
    track: (opts: Parameters<ErrorTracker['trackJsError']>[0]) =>
      getErrorTracker().trackJsError(opts),
    trackApi: (opts: Parameters<ErrorTracker['trackApiError']>[0]) =>
      getErrorTracker().trackApiError(opts),
    trackWs: (opts: Parameters<ErrorTracker['trackWsError']>[0]) =>
      getErrorTracker().trackWsError(opts),
    trackPerf: (opts: Parameters<ErrorTracker['trackPerformanceError']>[0]) =>
      getErrorTracker().trackPerformanceError(opts),
    resolve: (id: string) => getErrorTracker().resolveError(id),
    clear: () => getErrorTracker().clearAll(),
    flush: () => getErrorTracker().flush(),
    getErrors: () => getErrorTracker().getErrors(),
    getUnresolvedCount: () => getErrorTracker().getUnresolvedCount(),
  };
}
