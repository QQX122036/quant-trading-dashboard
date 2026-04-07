/**
 * useWebVitals — Core Web Vitals 监控 Hook
 *
 * 监控指标：LCP / FID(INP) / CLS / FCP / TTFB
 * - Dev 模式：console.log 输出
 * - Prod 模式：上报到后端 /api/metrics/web-vitals（POST JSON body）
 * - 异常不上报（try/catch 包裹）
 */

import { onMount } from 'solid-js';
import { onCLS, onFCP, onLCP, onTTFB, type Metric } from 'web-vitals';
// Note: web-vitals v5 用 onINP 替代了 onFID（INP = Interaction to Next Paint，是 FID 的升级指标）
// @ts-ignore
import { onINP } from 'web-vitals';

const METRICS_ENDPOINT = '/api/metrics/web-vitals';

function isDev(): boolean {
  return import.meta.env.DEV;
}

function getRating(value: number, name: string): 'good' | 'needs-improvement' | 'poor' {
  const thresholds: Record<string, [number, number]> = {
    // LCP: Good ≤ 2500ms, Poor > 4000ms
    LCP: [2500, 4000],
    // FID/INP: Good ≤ 100ms, Poor > 300ms
    FID: [100, 300],
    INP: [100, 300],
    // CLS: Good ≤ 0.1, Poor > 0.25
    CLS: [0.1, 0.25],
    // FCP: Good ≤ 1800ms, Poor > 3000ms
    FCP: [1800, 3000],
    // TTFB: Good ≤ 800ms, Poor > 1800ms
    TTFB: [800, 1800],
  };
  const [good, poor] = thresholds[name] ?? [Infinity, Infinity];
  if (value <= good) return 'good';
  if (value <= poor) return 'needs-improvement';
  return 'poor';
}

async function reportMetric(metric: Metric): Promise<void> {
  if (isDev()) {
    const rating = getRating(metric.value, metric.name);
    console.log(
      `[WebVitals] ${metric.name}: ${metric.value.toFixed(2)} (${rating})`,
      'delta:', metric.delta,
      'id:', metric.id,
    );
    return;
  }

  try {
    const payload = {
      name: metric.name,
      value: metric.value,
      delta: metric.delta,
      id: metric.id,
      rating: getRating(metric.value, metric.name),
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
    };

    await fetch(METRICS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // 异常不上报，静默忽略
  }
}

function onWebVital(metric: Metric): void {
  try {
    reportMetric(metric);
  } catch {
    // noop
  }
}

/**
 * 初始化 Web Vitals 监控
 * 调用一次即可，自动监听所有 Core Web Vitals 指标
 */
export function useWebVitals(): void {
  onMount(() => {
    try {
      onLCP(onWebVital);
      // @ts-ignore
      onINP(onWebVital);
      onCLS(onWebVital);
      onFCP(onWebVital);
      onTTFB(onWebVital);
    } catch {
      // 初始化失败不影响业务
    }
  });
}
