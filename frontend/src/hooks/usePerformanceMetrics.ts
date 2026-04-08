/**
 * usePerformanceMetrics — 前端性能监控埋点 Hook
 *
 * 监控维度：
 * 1. Web Vitals: LCP / INP / CLS / FCP / TTFB
 * 2. API 请求耗时：自动拦截所有 apiFetch 耗时
 * 3. WebSocket 延迟：ping-pong 往返时延
 * 4. 页面路由切换：Next.js Router / 手动 route change
 * 5. 资源加载：JS / CSS / 图片 / API 等关键资源
 * 6. 组件渲染耗时：标记主要组件挂载时间
 * 7. 自定义打点：performance.mark / measure 兼容接口
 *
 * 上报机制：
 * - DEV: console.log 分级输出（groupCollapsed）
 * - PROD: 批量聚合后 POST /api/metrics/performance
 */

import { onMount, onCleanup } from 'solid-js';
import { onCLS, onFCP, onLCP, onTTFB, type Metric } from 'web-vitals';
import { logger } from '../lib/logger';
// @ts-ignore
import { onINP } from 'web-vitals';

// ── Types ───────────────────────────────────────────────────────────────────

export type MetricRating = 'good' | 'needs-improvement' | 'poor';

export interface WebVitalRecord {
  name: string;
  value: number;
  rating: MetricRating;
  delta: number;
  id: string;
  timestamp: number;
}

export interface ApiMetricRecord {
  path: string;
  method: string;
  duration: number; // ms
  status: 'success' | 'error' | 'retry';
  retryCount: number;
  timestamp: number;
}

export interface WsLatencyRecord {
  latency: number; // ms
  timestamp: number;
}

export interface RouteMetricRecord {
  from: string;
  to: string;
  duration: number; // ms
  timestamp: number;
}

export interface ResourceMetricRecord {
  name: string;
  type: string; // js/css/img/api/ws
  size: number; // bytes
  duration: number; // ms
  timestamp: number;
}

export interface RenderMetricRecord {
  component: string;
  phase: 'mount' | 'update';
  duration: number; // ms
  timestamp: number;
}

export interface PerfMetrics {
  webVitals: WebVitalRecord[];
  apiCalls: ApiMetricRecord[];
  wsLatencies: WsLatencyRecord[];
  routeChanges: RouteMetricRecord[];
  resources: ResourceMetricRecord[];
  renders: RenderMetricRecord[];
  customMarks: Array<{ name: string; value: number; timestamp: number }>;
}

interface PendingApiRequest {
  path: string;
  method: string;
  startTime: number;
  retryCount: number;
}

// ── Singleton State ─────────────────────────────────────────────────────────

const MAX_RECORDS = 200;

class PerformanceMonitor {
  private webVitals: WebVitalRecord[] = [];
  private apiCalls: ApiMetricRecord[] = [];
  private wsLatencies: WsLatencyRecord[] = [];
  private routeChanges: RouteMetricRecord[] = [];
  private resources: ResourceMetricRecord[] = [];
  private renders: RenderMetricRecord[] = [];
  private customMarks: Array<{ name: string; value: number; timestamp: number }> = [];

  private pendingApi = new Map<string, PendingApiRequest>();
  private wsPingTime = 0;
  private routeStartTime = 0;
  private lastRoute = '';

  private isDev = import.meta.env.DEV;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private flushInterval = 30_000; // 30s

  constructor() {
    this.startResourceObserver();
    this.startNavigationObserver();
    this.startApiInterceptor();
    this.startWsPingInterceptor();
    this.startFlushTimer();
  }

  // ── Web Vitals ─────────────────────────────────────────────────────────────

  startWebVitals() {
    onMount(() => {
      const handler = (metric: Metric) => {
        const rating = this.getRating(metric.value, metric.name);
        const record: WebVitalRecord = {
          name: metric.name,
          value: metric.value,
          rating,
          delta: metric.delta,
          id: metric.id,
          timestamp: Date.now(),
        };
        this.addRecord('webVitals', record);
        this.logGroup(`[WebVitals] ${metric.name}: ${metric.value.toFixed(2)}ms`, record);
      };
      try {
        onLCP(handler);
        // @ts-ignore
        onINP(handler);
        onCLS(handler);
        onFCP(handler);
        onTTFB(handler);
      } catch {
        /* noop */
      }
    });
  }

  // ── Resource Timing ─────────────────────────────────────────────────────────

  private startResourceObserver() {
    if (typeof PerformanceObserver === 'undefined') return;
    try {
      // 监听资源加载
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const e = entry as PerformanceResourceTiming;
          if (e.initiatorType === 'navigation') continue;
          const record: ResourceMetricRecord = {
            name: e.name,
            type: this.getResourceType(e.initiatorType),
            size: e.transferSize || 0,
            duration: e.responseEnd - e.startTime,
            timestamp: Date.now(),
          };
          this.addRecord('resources', record);
          this.logGroup(
            `[Resource] ${record.type}: ${record.name.split('/').pop()} (${record.duration.toFixed(1)}ms)`,
            record
          );
        }
      }).observe({ entryTypes: ['resource'], buffered: true });

      // 监听 LongTask
      if ('PerformanceLongTaskTiming' in window) {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const e = entry as any;
            logger.warn('[LongTask] long task detected', {
              durationMs: parseFloat(e.duration.toFixed(1)),
            });
          }
        }).observe({ entryTypes: ['longtask'] });
      }
    } catch {
      /* noop */
    }
  }

  // ── Navigation Timing ──────────────────────────────────────────────────────

  private startNavigationObserver() {
    if (typeof PerformanceObserver === 'undefined') return;
    try {
      new PerformanceObserver((list) => {
        const entry = list.getEntries()[0] as PerformanceNavigationTiming;
        if (!entry) return;
        const ttfb = entry.responseStart - entry.requestStart;
        const domInteractive = entry.domInteractive - entry.requestStart;
        const domComplete = entry.domComplete - entry.requestStart;
        const loadComplete = entry.loadEventEnd - entry.requestStart;

        if (this.isDev) {
          logger.debug('[NavigationTiming] page loaded', {
            TTFB: ttfb.toFixed(0),
            DOMInteractive: domInteractive.toFixed(0),
            DOMComplete: domComplete.toFixed(0),
            LoadComplete: loadComplete.toFixed(0),
          });
        }
      }).observe({ entryTypes: ['navigation'], buffered: true });
    } catch {
      /* noop */
    }
  }

  // ── API Interceptor ────────────────────────────────────────────────────────

  private startApiInterceptor() {
    const origFetch = window.fetch.bind(window);
    const self = this;

    window.fetch = async function (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      const url = input instanceof Request ? input.url : String(input);
      const method = init?.method ?? 'GET';

      // 只追踪 /api/* 请求
      if (!url.includes('/api/')) return origFetch(input, init);

      const startTime = performance.now();
      const key = `${method}:${url}`;

      try {
        const response = await origFetch(input, init);
        const duration = performance.now() - startTime;

        // 读取 response clone 以便后续使用
        const clone = response.clone();
        let retryCount = 0;

        self.pendingApi.set(key, { path: url, method, startTime, retryCount });

        // 尝试判断状态
        let status: 'success' | 'error' = 'success';
        try {
          const json = await clone.json();
          if (json.code !== '0' && json.code !== 0) status = 'error';
        } catch {
          /* ignore */
        }

        const record: ApiMetricRecord = {
          path: url.replace(import.meta.env.VITE_API_BASE_URL || '', ''),
          method,
          duration,
          status,
          retryCount,
          timestamp: Date.now(),
        };
        self.addRecord('apiCalls', record);
        if (self.isDev)
          self.logGroup(
            `[API] ${method} ${record.path} → ${status} (${duration.toFixed(1)}ms)`,
            record
          );

        return response;
      } catch (err) {
        const duration = performance.now() - startTime;
        const record: ApiMetricRecord = {
          path: url.replace(import.meta.env.VITE_API_BASE_URL || '', ''),
          method,
          duration,
          status: 'error',
          retryCount: 0,
          timestamp: Date.now(),
        };
        self.addRecord('apiCalls', record);
        if (self.isDev)
          self.logGroup(
            `[API] ${method} ${record.path} → ERROR (${duration.toFixed(1)}ms)`,
            record
          );
        throw err;
      } finally {
        self.pendingApi.delete(key);
      }
    };
  }

  // ── WebSocket Latency ───────────────────────────────────────────────────────

  private startWsPingInterceptor() {
    // 拦截 WebSocket send，注入 ping 追踪
    const origSend = WebSocket.prototype.send;
    const self = this;

    WebSocket.prototype.send = function (data: string | ArrayBuffer | Blob) {
      try {
        const msg = JSON.parse(data as string);
        if (msg?.type === 'ping') {
          self.wsPingTime = performance.now();
        }
      } catch {
        /* noop */
      }
      return origSend.call(this, data);
    };

    // 拦截 message 事件来捕获 pong
    // 注意：这需要 WS 实例支持 monkey-patch，这里用简化版
    // 真实实现建议在 useWebSocket.ts 中直接打点
  }

  /**
   * 手动记录 WS 延迟（从 useWebSocket.ts 调用）
   */
  recordWsLatency(latencyMs: number) {
    const record: WsLatencyRecord = { latency: latencyMs, timestamp: Date.now() };
    this.addRecord('wsLatencies', record);
    this.logGroup(`[WS] latency: ${latencyMs.toFixed(1)}ms`, record);
  }

  /**
   * 记录 WS ping 时间（由 useWebSocket 调用）
   */
  markWsPing() {
    this.wsPingTime = performance.now();
  }

  // ── Route Change ───────────────────────────────────────────────────────────

  /**
   * 标记路由开始（由 App.tsx router 回调调用）
   */
  markRouteStart(path: string) {
    this.routeStartTime = performance.now();
    this.lastRoute = path;
  }

  /**
   * 标记路由完成（由 App.tsx router 回调调用）
   */
  markRouteEnd(path: string) {
    if (!this.routeStartTime) return;
    const duration = performance.now() - this.routeStartTime;
    const record: RouteMetricRecord = {
      from: this.lastRoute,
      to: path,
      duration,
      timestamp: Date.now(),
    };
    this.addRecord('routeChanges', record);
    this.logGroup(`[Route] ${record.from} → ${record.to} (${duration.toFixed(1)}ms)`, record);
    this.routeStartTime = 0;
  }

  // ── Render Timing ──────────────────────────────────────────────────────────

  /**
   * 记录组件渲染耗时
   */
  recordRender(component: string, phase: 'mount' | 'update', duration: number) {
    const record: RenderMetricRecord = { component, phase, duration, timestamp: Date.now() };
    this.addRecord('renders', record);
    this.logGroup(`[Render] ${component} [${phase}]: ${duration.toFixed(2)}ms`, record);
  }

  // ── Custom Marks ───────────────────────────────────────────────────────────

  /**
   * performance.mark 兼容接口
   * 记录自定义打点
   */
  mark(name: string, value?: number) {
    const v = value ?? performance.now();
    this.customMarks.push({ name, value: v, timestamp: Date.now() });
    this.log(`[mark] ${name}: ${v.toFixed(2)}ms`);
  }

  /**
   * performance.measure 兼容接口
   * 测量两个 mark 之间的耗时
   */
  measure(name: string, startMark: string, endMark?: string) {
    const marks = this.customMarks.filter((m) => m.name === startMark);
    if (marks.length === 0) {
      logger.warn(`[measure] start mark "${startMark}" not found`);
      return;
    }
    const start = marks[marks.length - 1].value;
    let end = endMark
      ? (this.customMarks.filter((m) => m.name === endMark).pop()?.value ?? performance.now())
      : performance.now();
    const duration = end - start;
    this.log(`[measure] ${name}: ${duration.toFixed(2)}ms (${startMark} → ${endMark ?? 'now'})`);
  }

  // ── Record Management ──────────────────────────────────────────────────────

  private addRecord<K extends keyof PerfMetrics>(key: K, record: PerfMetrics[K][number]) {
    // Use explicit property access to satisfy TypeScript
    if (key === 'webVitals') {
      this.webVitals.push(record as WebVitalRecord);
      if (this.webVitals.length > MAX_RECORDS)
        this.webVitals.splice(0, this.webVitals.length - MAX_RECORDS);
      return;
    }
    if (key === 'apiCalls') {
      this.apiCalls.push(record as ApiMetricRecord);
      if (this.apiCalls.length > MAX_RECORDS)
        this.apiCalls.splice(0, this.apiCalls.length - MAX_RECORDS);
      return;
    }
    if (key === 'wsLatencies') {
      this.wsLatencies.push(record as WsLatencyRecord);
      if (this.wsLatencies.length > MAX_RECORDS)
        this.wsLatencies.splice(0, this.wsLatencies.length - MAX_RECORDS);
      return;
    }
    if (key === 'routeChanges') {
      this.routeChanges.push(record as RouteMetricRecord);
      if (this.routeChanges.length > MAX_RECORDS)
        this.routeChanges.splice(0, this.routeChanges.length - MAX_RECORDS);
      return;
    }
    if (key === 'resources') {
      this.resources.push(record as ResourceMetricRecord);
      if (this.resources.length > MAX_RECORDS)
        this.resources.splice(0, this.resources.length - MAX_RECORDS);
      return;
    }
    if (key === 'renders') {
      this.renders.push(record as RenderMetricRecord);
      if (this.renders.length > MAX_RECORDS)
        this.renders.splice(0, this.renders.length - MAX_RECORDS);
      return;
    }
    if (key === 'customMarks') {
      this.customMarks.push(record as { name: string; value: number; timestamp: number });
      if (this.customMarks.length > MAX_RECORDS)
        this.customMarks.splice(0, this.customMarks.length - MAX_RECORDS);
      return;
    }
  }

  getMetrics(): Readonly<PerfMetrics> {
    return {
      webVitals: [...this.webVitals],
      apiCalls: [...this.apiCalls],
      wsLatencies: [...this.wsLatencies],
      routeChanges: [...this.routeChanges],
      resources: [...this.resources],
      renders: [...this.renders],
      customMarks: [...this.customMarks],
    };
  }

  getSummary() {
    const vitals = this.webVitals;
    const apis = this.apiCalls;
    const ws = this.wsLatencies;

    const avgApi = apis.length > 0 ? apis.reduce((s, r) => s + r.duration, 0) / apis.length : 0;
    const p95Api =
      apis.length > 0
        ? this.percentile(
            apis.map((r) => r.duration),
            0.95
          )
        : 0;
    const errorRate =
      apis.length > 0 ? apis.filter((r) => r.status === 'error').length / apis.length : 0;
    const avgWs = ws.length > 0 ? ws.reduce((s, r) => s + r.latency, 0) / ws.length : 0;

    return {
      webVitals: {
        LCP: vitals.find((v) => v.name === 'LCP')?.value ?? null,
        INP: vitals.find((v) => v.name === 'INP')?.value ?? null,
        CLS: vitals.find((v) => v.name === 'CLS')?.value ?? null,
        FCP: vitals.find((v) => v.name === 'FCP')?.value ?? null,
        TTFB: vitals.find((v) => v.name === 'TTFB')?.value ?? null,
      },
      api: {
        count: apis.length,
        avgMs: avgApi,
        p95Ms: p95Api,
        errorRate,
      },
      ws: {
        count: ws.length,
        avgLatencyMs: avgWs,
      },
    };
  }

  // ── Reporting ───────────────────────────────────────────────────────────────

  async reportToBackend() {
    const metrics = this.getMetrics();
    if (metrics.webVitals.length === 0 && metrics.apiCalls.length === 0) return;

    try {
      // 使用原生 fetch（此端点已加入白名单，无需认证）
      const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
      await fetch(`${baseUrl}/api/metrics/performance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...metrics,
          sessionId: this.getSessionId(),
          userAgent: navigator.userAgent,
          url: location.href,
        }),
      });
      if (!this.isDev) {
        this.clearOldRecords();
      }
    } catch {
      // noop — don't block on reporting
    }
  }

  private startFlushTimer() {
    this.flushTimer = setInterval(() => {
      this.reportToBackend();
    }, this.flushInterval);
  }

  private clearOldRecords() {
    // 保留最近 50 条
    const keep = 50;
    const trim = <T>(arr: T[]): T[] => arr.slice(-keep);
    this.webVitals = trim(this.webVitals);
    this.apiCalls = trim(this.apiCalls);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private getRating(value: number, name: string): MetricRating {
    const thresholds: Record<string, [number, number]> = {
      LCP: [2500, 4000],
      INP: [100, 300],
      CLS: [0.1, 0.25],
      FCP: [1800, 3000],
      TTFB: [800, 1800],
    };
    const [good, poor] = thresholds[name] ?? [Infinity, Infinity];
    if (value <= good) return 'good';
    if (value <= poor) return 'needs-improvement';
    return 'poor';
  }

  private getResourceType(initiator: string): string {
    const map: Record<string, string> = {
      link: 'css',
      img: 'img',
      script: 'js',
      xmlhttprequest: 'api',
      fetch: 'api',
    };
    return map[initiator] ?? initiator;
  }

  private percentile(arr: number[], p: number): number {
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.ceil(p * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }

  private sessionId = '';
  private getSessionId(): string {
    if (!this.sessionId) {
      this.sessionId =
        sessionStorage.getItem('perf_sid') ??
        (() => {
          const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
          sessionStorage.setItem('perf_sid', id);
          return id;
        })();
    }
    return this.sessionId;
  }

  private log(...args: unknown[]) {
    if (this.isDev) logger.debug('[PerfMetrics] ' + args.map((a) => String(a)).join(' '));
  }

  private logGroup(label: string, data: unknown) {
    if (this.isDev) {
      logger.debug(label, { data });
    }
  }

  dispose() {
    if (this.flushTimer) clearInterval(this.flushTimer);
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

let _monitor: PerformanceMonitor | null = null;

export function getPerformanceMonitor(): PerformanceMonitor {
  if (!_monitor) _monitor = new PerformanceMonitor();
  return _monitor;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * 初始化性能监控
 * 在 App.tsx 顶层调用一次即可
 */
export function usePerformanceMetrics(): void {
  onMount(() => {
    const monitor = getPerformanceMonitor();
    monitor.startWebVitals();

    // 页面卸载时上报
    onCleanup(() => {
      monitor.reportToBackend();
    });
  });
}

/**
 * 获取当前性能指标快照（供调试面板使用）
 */
export function usePerfSnapshot() {
  return () => getPerformanceMonitor().getMetrics();
}

export function usePerfSummary() {
  return () => getPerformanceMonitor().getSummary();
}
