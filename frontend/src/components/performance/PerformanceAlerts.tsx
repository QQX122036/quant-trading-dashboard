/**
 * PerformanceAlerts.tsx — 前端性能预警面板
 *
 * 功能：
 * - 实时监控 Web Vitals 指标（LCP/INP/CLS/FCP/TTFB）
 * - API 响应时间预警（P95 > 阈值）
 * - WebSocket 延迟预警
 * - 页面卡顿检测（Long Task）
 * - 内存使用预警（performance.memory）
 * - 错误率预警
 *
 * 预警级别：
 * - 🔴 Critical: 严重性能问题，需立即处理
 * - 🟠 Warning: 中等性能问题，建议处理
 * - 🟡 Info: 提示性信息
 */

import { Component, For, Show, createSignal, createMemo, onCleanup } from 'solid-js';
import {
  getPerformanceMonitor,
  type PerfMetrics,
  type WebVitalRecord,
} from '../../hooks/usePerformanceMetrics';
import { getErrorTracker } from '../../stores/errorStore';

// ── Types ───────────────────────────────────────────────────────────────────

export type AlertLevel = 'critical' | 'warning' | 'info';

export interface PerfAlert {
  id: string;
  level: AlertLevel;
  category: 'webvital' | 'api' | 'websocket' | 'longtask' | 'memory' | 'error';
  title: string;
  description: string;
  value?: number;
  unit?: string;
  threshold?: number;
  timestamp: number;
  acknowledged: boolean;
}

interface Props {
  /** 告警阈值配置 */
  thresholds?: Partial<Thresholds>;
  /** 是否默认展开 */
  defaultOpen?: boolean;
}

export interface Thresholds {
  lcp: number; // ms, default 4000
  inp: number; // ms, default 300
  cls: number; // unitless, default 0.25
  fcp: number; // ms, default 3000
  ttfb: number; // ms, default 1800
  apiP95: number; // ms, default 2000
  wsLatency: number; // ms, default 500
  errorRate: number; // 0-1, default 0.1
  memoryUsage: number; // 0-1, default 0.8
}

const DEFAULT_THRESHOLDS: Thresholds = {
  lcp: 4000,
  inp: 300,
  cls: 0.25,
  fcp: 3000,
  ttfb: 1800,
  apiP95: 2000,
  wsLatency: 500,
  errorRate: 0.1,
  memoryUsage: 0.8,
};

const LEVEL_COLORS: Record<AlertLevel, string> = {
  critical: 'border-red-500/40 bg-red-500/5',
  warning: 'border-orange-500/40 bg-orange-500/5',
  info: 'border-blue-500/40 bg-blue-500/5',
};

const LEVEL_TEXT: Record<AlertLevel, string> = {
  critical: 'text-red-400',
  warning: 'text-orange-400',
  info: 'text-blue-400',
};

const LEVEL_BADGE: Record<AlertLevel, string> = {
  critical: '🔴',
  warning: '🟠',
  info: 'ℹ️',
};

const CATEGORY_ICONS: Record<PerfAlert['category'], string> = {
  webvital: '📊',
  api: '🌐',
  websocket: '📡',
  longtask: '🐢',
  memory: '💾',
  error: '🐛',
};

// ── Alert Generation ─────────────────────────────────────────────────────────

function checkWebVitals(vitals: WebVitalRecord[], thresholds: Thresholds): PerfAlert[] {
  const alerts: PerfAlert[] = [];
  const now = Date.now();

  const vitalConfig: Array<{
    key: keyof Thresholds;
    name: string;
    unit: string;
    good: number;
    poor: number;
  }> = [
    { key: 'lcp', name: 'LCP', unit: 'ms', good: 2500, poor: 4000 },
    { key: 'inp', name: 'INP', unit: 'ms', good: 100, poor: 300 },
    { key: 'cls', name: 'CLS', unit: '', good: 0.1, poor: 0.25 },
    { key: 'fcp', name: 'FCP', unit: 'ms', good: 1800, poor: 3000 },
    { key: 'ttfb', name: 'TTFB', unit: 'ms', good: 800, poor: 1800 },
  ];

  for (const cfg of vitalConfig) {
    const latest = vitals.filter((v) => v.name === cfg.name).pop();
    if (!latest) continue;
    const threshold =
      ((thresholds as unknown as Record<string, number>)[cfg.key] as number) ?? cfg.poor;

    if (latest.value > threshold) {
      const level: AlertLevel = latest.value > cfg.poor * 1.5 ? 'critical' : 'warning';
      alerts.push({
        id: `vital-${cfg.name}-${latest.id}`,
        level,
        category: 'webvital',
        title: `${cfg.name} 指标异常`,
        description: `${cfg.name} (Largest Contentful Paint) 加载时间过长，可能影响用户体验`,
        value: Math.round(latest.value * 10) / 10,
        unit: cfg.unit,
        threshold,
        timestamp: latest.timestamp || now,
        acknowledged: false,
      });
    }
  }

  return alerts;
}

function checkApiLatency(apiCalls: PerfMetrics['apiCalls'], thresholds: Thresholds): PerfAlert[] {
  const alerts: PerfAlert[] = [];
  const now = Date.now();

  if (apiCalls.length < 3) return alerts;

  const sorted = [...apiCalls].sort((a, b) => a.duration - b.duration);
  const p95Index = Math.floor(sorted.length * 0.95);
  const p95 = sorted[p95Index]?.duration ?? 0;

  if (p95 > thresholds.apiP95) {
    const slowest = sorted[sorted.length - 1];
    alerts.push({
      id: `api-p95-${now}`,
      level: p95 > thresholds.apiP95 * 1.5 ? 'critical' : 'warning',
      category: 'api',
      title: `API P95 延迟过高`,
      description: `P95延迟 ${Math.round(p95)}ms，超过阈值 ${thresholds.apiP95}ms`,
      value: Math.round(p95),
      unit: 'ms',
      threshold: thresholds.apiP95,
      timestamp: now,
      acknowledged: false,
    });

    // Check individual slow API
    if (slowest && slowest.duration > thresholds.apiP95 * 2) {
      alerts.push({
        id: `api-slow-${slowest.timestamp}`,
        level: 'warning',
        category: 'api',
        title: `慢 API 检测`,
        description: `${slowest.method} ${slowest.path} 响应时间 ${Math.round(slowest.duration)}ms`,
        value: Math.round(slowest.duration),
        unit: 'ms',
        threshold: thresholds.apiP95,
        timestamp: slowest.timestamp || now,
        acknowledged: false,
      });
    }
  }

  // Check error rate
  const errors = apiCalls.filter((a) => a.status === 'error').length;
  const errorRate = errors / apiCalls.length;
  if (errorRate > thresholds.errorRate) {
    alerts.push({
      id: `api-errors-${now}`,
      level: errorRate > thresholds.errorRate * 2 ? 'critical' : 'warning',
      category: 'api',
      title: `API 错误率过高`,
      description: `最近 ${apiCalls.length} 次请求中 ${errors} 次失败，错误率 ${(errorRate * 100).toFixed(1)}%`,
      value: errorRate,
      unit: '%',
      threshold: thresholds.errorRate,
      timestamp: now,
      acknowledged: false,
    });
  }

  return alerts;
}

function checkWsLatency(
  latencies: PerfMetrics['wsLatencies'],
  thresholds: Thresholds
): PerfAlert[] {
  const alerts: PerfAlert[] = [];
  const now = Date.now();

  if (latencies.length === 0) return alerts;

  const avg = latencies.reduce((s, l) => s + l.latency, 0) / latencies.length;
  const max = Math.max(...latencies.map((l) => l.latency));

  if (avg > thresholds.wsLatency) {
    alerts.push({
      id: `ws-avg-${now}`,
      level: avg > thresholds.wsLatency * 1.5 ? 'critical' : 'warning',
      category: 'websocket',
      title: `WebSocket 平均延迟过高`,
      description: `WS 平均延迟 ${Math.round(avg)}ms，超过阈值 ${thresholds.wsLatency}ms`,
      value: Math.round(avg),
      unit: 'ms',
      threshold: thresholds.wsLatency,
      timestamp: now,
      acknowledged: false,
    });
  }

  if (max > thresholds.wsLatency * 2) {
    alerts.push({
      id: `ws-max-${now}`,
      level: 'warning',
      category: 'websocket',
      title: `WebSocket 突发高延迟`,
      description: `WS 最大延迟 ${Math.round(max)}ms，可能存在网络问题`,
      value: Math.round(max),
      unit: 'ms',
      threshold: thresholds.wsLatency,
      timestamp: now,
      acknowledged: false,
    });
  }

  return alerts;
}

function checkMemory(thresholds: Thresholds): PerfAlert[] {
  const alerts: PerfAlert[] = [];
  const now = Date.now();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const memory = (performance as any).memory;
  if (!memory) return alerts;

  const usedRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
  if (usedRatio > thresholds.memoryUsage) {
    alerts.push({
      id: `memory-${now}`,
      level: usedRatio > 0.9 ? 'critical' : 'warning',
      category: 'memory',
      title: `内存使用率过高`,
      description: `JS Heap 使用 ${(usedRatio * 100).toFixed(1)}%，可能存在内存泄漏`,
      value: usedRatio,
      unit: '%',
      threshold: thresholds.memoryUsage,
      timestamp: now,
      acknowledged: false,
    });
  }

  return alerts;
}

function checkErrorRate(
  tracker: ReturnType<typeof getErrorTracker>,
  thresholds: Thresholds
): PerfAlert[] {
  const alerts: PerfAlert[] = [];
  const now = Date.now();
  const errors = tracker.getErrors();

  if (errors.length === 0) return alerts;

  const unresolved = errors.filter((e) => !e.resolved);
  const criticalCount = unresolved.filter((e) => e.level === 'critical').length;
  const errorCount = unresolved.filter((e) => e.level === 'error').length;

  if (criticalCount > 0) {
    alerts.push({
      id: `errors-critical-${now}`,
      level: 'critical',
      category: 'error',
      title: `${criticalCount} 个 Critical 错误未解决`,
      description:
        unresolved.find((e) => e.level === 'critical')?.message ?? '存在未解决的 Critical 错误',
      timestamp: now,
      acknowledged: false,
    });
  }

  if (errorCount > 3) {
    alerts.push({
      id: `errors-many-${now}`,
      level: 'warning',
      category: 'error',
      title: `大量错误累积`,
      description: `共 ${errorCount} 个 Error 级别错误未解决，建议排查`,
      value: errorCount,
      threshold: 3,
      timestamp: now,
      acknowledged: false,
    });
  }

  return alerts;
}

// ── Component ────────────────────────────────────────────────────────────────

export const PerformanceAlerts: Component<Props> = (props) => {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...props.thresholds };

  const monitor = getPerformanceMonitor();
  const tracker = getErrorTracker();

  const [isOpen, setIsOpen] = createSignal(props.defaultOpen ?? false);
  const [alerts, setAlerts] = createSignal<PerfAlert[]>([]);
  const [acknowledged, setAcknowledged] = createSignal<Set<string>>(new Set());

  // Poll metrics every 5s
  let pollTimer: ReturnType<typeof setInterval>;

  function refreshAlerts() {
    const metrics = monitor.getMetrics();
    const now = Date.now();

    const newAlerts: PerfAlert[] = [
      ...checkWebVitals(metrics.webVitals, thresholds),
      ...checkApiLatency(metrics.apiCalls, thresholds),
      ...checkWsLatency(metrics.wsLatencies, thresholds),
      ...checkMemory(thresholds),
      ...checkErrorRate(tracker, thresholds),
    ];

    // Deduplicate and merge with acknowledged
    setAlerts((prev) => {
      const merged = [...prev];
      for (const alert of newAlerts) {
        const exists = merged.find((a) => a.id === alert.id);
        if (!exists) merged.unshift(alert);
      }
      // Keep last 20 alerts
      return merged.slice(0, 20);
    });
  }

  // Initialize polling
  refreshAlerts();
  pollTimer = setInterval(refreshAlerts, 5000);

  onCleanup(() => clearInterval(pollTimer));

  // ── Computed ─────────────────────────────────────────────────────────────

  const unacknowledgedAlerts = createMemo(() => alerts().filter((a) => !acknowledged().has(a.id)));

  const criticalCount = createMemo(
    () => unacknowledgedAlerts().filter((a) => a.level === 'critical').length
  );
  const warningCount = createMemo(
    () => unacknowledgedAlerts().filter((a) => a.level === 'warning').length
  );
  const totalCount = createMemo(() => unacknowledgedAlerts().length);

  const hasCritical = createMemo(() => criticalCount() > 0);
  const hasWarning = createMemo(() => warningCount() > 0);

  // ── Actions ───────────────────────────────────────────────────────────────

  function acknowledge(id: string) {
    setAcknowledged((prev) => new Set([...prev, id]));
  }

  function acknowledgeAll() {
    setAcknowledged(new Set(alerts().map((a) => a.id)));
  }

  function dismiss(id: string) {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  function formatTs(ts: number): string {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  }

  function formatValue(alert: PerfAlert): string {
    if (alert.value == null) return '';
    if (alert.unit === '%') return `${(alert.value * 100).toFixed(1)}%`;
    if (alert.unit === 'ms') return `${alert.value}ms`;
    return `${alert.value}`;
  }

  function getVitalRating(vital: string): 'good' | 'needs-improvement' | 'poor' {
    const summary = monitor.getSummary();
    const vitalMap: Record<string, keyof typeof summary.webVitals> = {
      LCP: 'LCP',
      INP: 'INP',
      CLS: 'CLS',
      FCP: 'FCP',
      TTFB: 'TTFB',
    };
    const key = vitalMap[vital] ?? vital;
    const value = summary.webVitals[key];
    if (value == null) return 'needs-improvement';

    const thresholds: Record<string, [number, number]> = {
      LCP: [2500, 4000],
      INP: [100, 300],
      CLS: [0.1, 0.25],
      FCP: [1800, 3000],
      TTFB: [800, 1800],
    };
    const [good, poor] = thresholds[vital] ?? [Infinity, Infinity];
    if (value <= good) return 'good';
    if (value <= poor) return 'needs-improvement';
    return 'poor';
  }

  const summary = createMemo(() => monitor.getSummary());

  // ── Render ───────────────────────────────────────────────────────────────

  const fabColor = createMemo(() => {
    if (hasCritical()) return 'bg-red-600 hover:bg-red-500';
    if (hasWarning()) return 'bg-orange-600 hover:bg-orange-500';
    return 'bg-gray-800 hover:bg-gray-700';
  });

  const fabIcon = createMemo(() => {
    if (hasCritical()) return '🔴';
    if (hasWarning()) return '🟠';
    return '✅';
  });

  return (
    <>
      {/* ── FAB ── */}
      <Show when={!isOpen()}>
        <button
          onClick={() => setIsOpen(true)}
          class={`fixed bottom-6 left-6 z-50 flex items-center gap-2 px-3 py-2 rounded-full ${fabColor()} text-white shadow-xl transition-all duration-300`}
          title="性能预警面板"
        >
          <span class="text-base">{fabIcon()}</span>
          <span class="text-sm font-medium text-white/90">
            {totalCount() > 0
              ? `${totalCount()} 预警${criticalCount() > 0 ? ` (${criticalCount()} 严重)` : ''}`
              : '性能正常'}
          </span>
        </button>
      </Show>

      {/* ── Panel ── */}
      <Show when={isOpen()}>
        <div class="fixed bottom-6 left-6 z-50 w-[520px] max-h-[75vh] flex flex-col bg-gray-900/95 backdrop-blur border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div class="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-900/80">
            <div class="flex items-center gap-2">
              <span class="text-base">📊</span>
              <span class="text-sm font-semibold text-gray-100">前端性能预警</span>
              <Show when={hasCritical()}>
                <span class="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold animate-pulse">
                  {criticalCount()} 严重
                </span>
              </Show>
            </div>
            <div class="flex items-center gap-2">
              <button
                onClick={acknowledgeAll}
                class="text-xs px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
              >
                全部确认
              </button>
              <button
                onClick={() => setIsOpen(false)}
                class="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div class="grid grid-cols-5 gap-2 px-4 py-3 border-b border-gray-800 bg-gray-900/50">
            <For each={['LCP', 'INP', 'CLS', 'FCP', 'TTFB'] as const}>
              {(vital) => {
                const value = () => summary().webVitals[vital];
                const rating = () => getVitalRating(vital);
                const ratingColor = () => {
                  if (rating() === 'good') return 'text-green-400';
                  if (rating() === 'needs-improvement') return 'text-orange-400';
                  return 'text-red-400';
                };
                return (
                  <div class="flex flex-col items-center gap-1 p-2 rounded-lg bg-gray-800/50">
                    <span class="text-xs text-gray-500">{vital}</span>
                    <span class={`text-sm font-mono font-bold ${ratingColor()}`}>
                      {value() != null
                        ? `${(value() as number).toFixed(vital === 'CLS' ? 3 : 0)}`
                        : '—'}
                    </span>
                    <span class={`text-xs ${ratingColor()}`}>
                      {rating() === 'good' ? '✓' : rating() === 'needs-improvement' ? '⚠' : '✗'}
                    </span>
                  </div>
                );
              }}
            </For>
          </div>

          {/* API Summary */}
          <div class="grid grid-cols-3 gap-2 px-4 py-2 border-b border-gray-800 bg-gray-900/30 text-xs">
            <div class="flex flex-col items-center gap-0.5 p-2 rounded-lg bg-gray-800/30">
              <span class="text-gray-500">API P95</span>
              <span
                class={`font-mono font-bold ${summary().api.p95Ms > thresholds.apiP95 ? 'text-red-400' : 'text-green-400'}`}
              >
                {summary().api.p95Ms > 0 ? `${summary().api.p95Ms.toFixed(0)}ms` : '—'}
              </span>
            </div>
            <div class="flex flex-col items-center gap-0.5 p-2 rounded-lg bg-gray-800/30">
              <span class="text-gray-500">API Error</span>
              <span
                class={`font-mono font-bold ${summary().api.errorRate > thresholds.errorRate ? 'text-red-400' : 'text-green-400'}`}
              >
                {(summary().api.errorRate * 100).toFixed(1)}%
              </span>
            </div>
            <div class="flex flex-col items-center gap-0.5 p-2 rounded-lg bg-gray-800/30">
              <span class="text-gray-500">WS Latency</span>
              <span
                class={`font-mono font-bold ${summary().ws.avgLatencyMs > thresholds.wsLatency ? 'text-red-400' : 'text-green-400'}`}
              >
                {summary().ws.avgLatencyMs > 0 ? `${summary().ws.avgLatencyMs.toFixed(0)}ms` : '—'}
              </span>
            </div>
          </div>

          {/* Alert List */}
          <div class="flex-1 overflow-y-auto">
            <Show
              when={unacknowledgedAlerts().length > 0}
              fallback={
                <div class="flex flex-col items-center justify-center py-12 text-gray-500">
                  <span class="text-3xl mb-2">🎉</span>
                  <span class="text-sm">所有指标正常，无预警</span>
                </div>
              }
            >
              <For each={unacknowledgedAlerts()}>
                {(alert) => (
                  <div
                    class={`border-b border-gray-800 px-4 py-3 hover:bg-gray-800/30 transition-colors ${LEVEL_COLORS[alert.level]}`}
                  >
                    <div class="flex items-start gap-3">
                      <span class="text-lg mt-0.5">{LEVEL_BADGE[alert.level]}</span>
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                          <span class="text-xs text-gray-500">
                            {CATEGORY_ICONS[alert.category]}
                          </span>
                          <span class={`text-sm font-medium ${LEVEL_TEXT[alert.level]}`}>
                            {alert.title}
                          </span>
                          <Show when={alert.value != null}>
                            <span
                              class={`text-xs px-1.5 py-0.5 rounded font-mono ${
                                alert.level === 'critical'
                                  ? 'bg-red-500/20 text-red-300'
                                  : 'bg-orange-500/20 text-orange-300'
                              }`}
                            >
                              {formatValue(alert)} / {alert.threshold}
                              {alert.unit}
                            </span>
                          </Show>
                          <span class="text-xs text-gray-600 ml-auto">
                            {formatTs(alert.timestamp)}
                          </span>
                        </div>
                        <p class="text-xs text-gray-400 leading-relaxed">{alert.description}</p>
                      </div>
                      <button
                        onClick={() => acknowledge(alert.id)}
                        class="flex-shrink-0 text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-gray-200 transition-colors"
                      >
                        确认
                      </button>
                    </div>
                  </div>
                )}
              </For>
            </Show>
          </div>

          {/* Footer */}
          <div class="px-4 py-2 border-t border-gray-800 text-xs text-gray-600 flex items-center justify-between">
            <span>每5秒自动刷新 · {totalCount()} 未确认预警</span>
            <span>DEV only · 阈值可配置</span>
          </div>
        </div>
      </Show>
    </>
  );
};

// ── Vital Badge ─────────────────────────────────────────────────────────────

/**
 * 小型 Web Vitals 状态徽章（可嵌入页面角落）
 */
export const VitalBadge: Component = () => {
  const summary = createMemo(() => getPerformanceMonitor().getSummary());

  function ratingColor(rating: 'good' | 'needs-improvement' | 'poor'): string {
    if (rating === 'good') return 'text-green-400';
    if (rating === 'needs-improvement') return 'text-orange-400';
    return 'text-red-400';
  }

  function vitalRating(name: string): 'good' | 'needs-improvement' | 'poor' {
    const s = summary();
    const value = (s.webVitals as Record<string, number | null>)[name];
    if (value == null) return 'needs-improvement';

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

  const hasIssue = createMemo(() => ['LCP', 'INP', 'CLS'].some((v) => vitalRating(v) !== 'good'));

  return (
    <div
      class={`fixed top-4 right-4 z-50 flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-mono backdrop-blur border transition-all ${
        hasIssue()
          ? 'bg-red-900/60 border-red-500/30 text-red-300'
          : 'bg-green-900/40 border-green-500/20 text-green-300'
      }`}
    >
      <For each={['LCP', 'INP', 'CLS'] as const}>
        {(v) => (
          <span class={ratingColor(vitalRating(v))}>
            {v}
            <span class="opacity-60">:</span>
            {(summary().webVitals[v] ?? '—').toString()}
            {v !== 'CLS' ? 'ms' : ''}
          </span>
        )}
      </For>
      <Show when={hasIssue()}>
        <span class="text-red-400 animate-pulse">⚠</span>
      </Show>
    </div>
  );
};
