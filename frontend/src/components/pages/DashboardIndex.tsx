/**
 * DashboardIndex.tsx — Dashboard 首页（/）
 *
 * 功能：
 * 1. 三大指数（上证/深证/创业板）今日行情 — 使用 /api/data/daily-bar
 * 2. 快捷入口卡片：持仓 / 回测 / 情绪 / 风控
 * 3. 系统状态：后端连接 + 数据库状态
 */
import { Component, createSignal, createMemo, onMount, Show, For } from 'solid-js';
import { A } from '@solidjs/router';
import { apiState, apiActions } from '../../stores/apiStore';
import { state } from '../../stores';
import { fetchDailyBar } from '../../hooks/useApi';
import { formatPrice, formatPercent, formatAmount } from '../../utils/format';
import { pnlColor } from '../../utils/color';

// ── Types ────────────────────────────────────────────────────────────────────
interface IndexData {
  ts_code: string;
  name: string;
  displayName: string;
  price: number;
  change: number;
  changePercent: number;
  loading: boolean;
  error: string | null;
}

const INDICES_CONFIG = [
  { ts_code: '000001.SSE', name: '上证指数', displayName: '上证指数' },
  { ts_code: '399001.SZ', name: '深证成指', displayName: '深证成指' },
  { ts_code: '399006.SZ', name: '创业板指', displayName: '创业板指' },
];

const QUICK_ENTRIES = [
  {
    title: '持仓管理',
    path: '/positions',
    desc: '查看当前持仓、盈亏分析',
    icon: `<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>`,
    gradient: 'from-blue-600/20 to-blue-900/40',
    border: 'hover:border-blue-500/50',
    iconColor: 'text-blue-400',
  },
  {
    title: '回测分析',
    path: '/backtest',
    desc: '策略回测、绩效评估',
    icon: `<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>`,
    gradient: 'from-emerald-600/20 to-emerald-900/40',
    border: 'hover:border-emerald-500/50',
    iconColor: 'text-emerald-400',
  },
  {
    title: '情绪监控',
    path: '/sentiment',
    desc: '市场情绪、资金流向',
    icon: `<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`,
    gradient: 'from-amber-600/20 to-amber-900/40',
    border: 'hover:border-amber-500/50',
    iconColor: 'text-amber-400',
  },
  {
    title: '风控中心',
    path: '/risk',
    desc: '风险预警、持仓限制',
    icon: `<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`,
    gradient: 'from-red-600/20 to-red-900/40',
    border: 'hover:border-red-500/50',
    iconColor: 'text-red-400',
  },
];

// ── Component ─────────────────────────────────────────────────────────────────
export const DashboardIndex: Component = () => {
  const [indices, setIndices] = createSignal<IndexData[]>(
    INDICES_CONFIG.map((c) => ({
      ...c,
      price: 0,
      change: 0,
      changePercent: 0,
      loading: true,
      error: null,
    }))
  );

  const wsStatus = createMemo(() => state.connection.wsStatus);
  const health = createMemo(() => apiState.health);
  const healthLoading = createMemo(() => apiState.healthLoading);

  // Load indices via daily-bar API
  async function loadIndices() {
    const today = new Date();
    const endDate = today.toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().split('T')[0];

    for (const config of INDICES_CONFIG) {
      setIndices((prev) =>
        prev.map((i) => (i.ts_code === config.ts_code ? { ...i, loading: true, error: null } : i))
      );

      try {
        const res = await fetchDailyBar(config.ts_code, startDate, endDate, 2);
        if (res.code === '0' && res.data?.bars?.length) {
          const bars = res.data.bars;
          const latest = bars[0];
          const prev = bars[1];
          const price =
            latest.close ?? (latest as unknown as Record<string, number>).settlement ?? 0;
          let change = 0;
          let changePercent = 0;
          if (prev && prev.close) {
            change = price - prev.close;
            changePercent = (change / prev.close) * 100;
          } else if (latest.change_pct !== null && latest.change_pct !== undefined) {
            changePercent = latest.change_pct;
            change = price * (changePercent / 100);
          }
          setIndices((prev) =>
            prev.map((i) =>
              i.ts_code === config.ts_code
                ? { ...i, price, change, changePercent, loading: false, error: null }
                : i
            )
          );
        } else {
          setIndices((prev) =>
            prev.map((i) =>
              i.ts_code === config.ts_code ? { ...i, loading: false, error: '暂无数据' } : i
            )
          );
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : '加载失败';
        setIndices((prev) =>
          prev.map((i) => (i.ts_code === config.ts_code ? { ...i, loading: false, error: msg } : i))
        );
      }
    }
  }

  // Load backend health
  async function loadHealth() {
    try {
      await apiActions.fetchHealth();
    } catch {}
  }

  onMount(async () => {
    await Promise.allSettled([loadIndices(), loadHealth()]);
  });

  // Determine if market is open (simplified: 9:15-15:05 on weekdays)
  const isMarketOpen = createMemo(() => {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const day = now.getDay();
    if (day === 0 || day === 6) return false;
    const minutes = h * 60 + m;
    return minutes >= 9 * 60 + 15 && minutes <= 15 * 60 + 5;
  });

  const currentTime = createMemo(() =>
    new Date().toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  );

  return (
    <div class="min-h-screen bg-[#0A0E17] text-white overflow-auto">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div class="border-b border-white/5 bg-[#111827]/60 backdrop-blur-sm sticky top-0 z-10">
        <div class="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 class="text-xl font-bold text-white tracking-tight">量化交易系统</h1>
            <p class="text-xs text-gray-500 mt-0.5">
              {new Date().toLocaleDateString('zh-CN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}{' '}
              <span class={isMarketOpen() ? 'text-green-400' : 'text-gray-500'}>
                {isMarketOpen() ? '● 交易中' : '○ 休市'}
              </span>
            </p>
          </div>
          <div class="text-right">
            <div class="text-2xl font-mono text-gray-300 tabular-nums">{currentTime()}</div>
            <div class="text-xs text-gray-500 mt-0.5">
              {indices().filter((i) => !i.loading && i.error === null && i.price > 0).length}/3
              指数已加载
            </div>
          </div>
        </div>
      </div>

      <div class="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* ── Section 1: Market Indices ─────────────────────────────────── */}
        <section>
          <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span class="w-1 h-4 bg-indigo-500 rounded-full" />
            今日市场概况
          </h2>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <For each={indices()}>
              {(idx) => (
                <div class="relative bg-[#111827]/80 border border-white/10 rounded-xl p-5 backdrop-blur-sm overflow-hidden group hover:border-white/20 transition-all duration-200">
                  {/* Glow effect */}
                  <div
                    class={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
                      idx.changePercent >= 0
                        ? 'bg-gradient-to-br from-red-500/5 to-transparent'
                        : 'bg-gradient-to-br from-green-500/5 to-transparent'
                    }`}
                  />
                  <div class="relative">
                    {/* Index name */}
                    <div class="flex items-center justify-between mb-3">
                      <span class="text-sm font-medium text-gray-300">{idx.displayName}</span>
                      <Show
                        when={!idx.loading}
                        fallback={
                          <div class="w-4 h-4 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                        }
                      >
                        <Show
                          when={idx.error === null}
                          fallback={<span class="text-xs text-red-400">{idx.error}</span>}
                        >
                          <span
                            class={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                              idx.changePercent >= 0
                                ? 'bg-red-500/15 text-red-400'
                                : 'bg-green-500/15 text-green-400'
                            }`}
                          >
                            {idx.changePercent >= 0 ? '▲' : '▼'}{' '}
                            {Math.abs(idx.changePercent).toFixed(2)}%
                          </span>
                        </Show>
                      </Show>
                    </div>

                    {/* Price */}
                    <Show
                      when={!idx.loading && idx.error === null}
                      fallback={
                        <div class="space-y-2">
                          <div class="h-8 bg-white/5 rounded w-32 animate-pulse" />
                          <div class="h-4 bg-white/5 rounded w-20 animate-pulse" />
                        </div>
                      }
                    >
                      <div
                        class={`text-3xl font-bold tabular-nums mb-1 ${
                          idx.changePercent >= 0 ? 'text-[#EF4444]' : 'text-[#22C55E]'
                        }`}
                      >
                        {idx.price > 0 ? formatPrice(idx.price) : '—'}
                      </div>
                      <div
                        class={`text-sm tabular-nums font-medium ${
                          idx.change >= 0 ? 'text-[#EF4444]/80' : 'text-[#22C55E]/80'
                        }`}
                      >
                        {idx.change >= 0 ? '+' : ''}
                        {idx.change !== 0 ? idx.change.toFixed(2) : '—'}
                      </div>
                    </Show>

                    {/* Code label */}
                    <div class="mt-3 text-[10px] text-gray-600 font-mono">{idx.ts_code}</div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </section>

        {/* ── Section 2: Quick Entry Cards ─────────────────────────────── */}
        <section>
          <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span class="w-1 h-4 bg-indigo-500 rounded-full" />
            快捷入口
          </h2>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <For each={QUICK_ENTRIES}>
              {(entry) => (
                <A
                  href={entry.path}
                  class="group relative bg-[#111827]/80 border border-white/10 rounded-xl p-5 flex flex-col gap-3 backdrop-blur-sm hover:shadow-lg active:scale-[0.98] transition-all duration-200"
                  style={{ 'text-decoration': 'none' }}
                >
                  {/* Gradient background */}
                  <div
                    class={`absolute inset-0 rounded-xl bg-gradient-to-br ${entry.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
                  />

                  <div class="relative flex items-center justify-between">
                    <div
                      class={`${entry.iconColor} opacity-80 group-hover:opacity-100 transition-opacity`}
                      innerHTML={entry.icon}
                    />
                    <svg
                      class="w-4 h-4 text-gray-600 group-hover:text-white group-hover:translate-x-1 transition-all duration-200"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>

                  <div class="relative">
                    <div class="text-base font-semibold text-white group-hover:text-white/90 transition-colors">
                      {entry.title}
                    </div>
                    <div class="text-xs text-gray-500 mt-0.5 group-hover:text-gray-400 transition-colors">
                      {entry.desc}
                    </div>
                  </div>
                </A>
              )}
            </For>
          </div>
        </section>

        {/* ── Section 3: System Status ──────────────────────────────────── */}
        <section>
          <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span class="w-1 h-4 bg-indigo-500 rounded-full" />
            系统状态
          </h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* WebSocket Connection */}
            <div class="bg-[#111827]/80 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
              <div class="flex items-center gap-3">
                <div
                  class={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    wsStatus() === 'connected'
                      ? 'bg-green-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]'
                      : wsStatus() === 'reconnecting'
                        ? 'bg-yellow-400 animate-pulse'
                        : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                  }`}
                />
                <div>
                  <div class="text-sm font-medium text-gray-200">WebSocket</div>
                  <div class="text-xs text-gray-500">
                    {wsStatus() === 'connected'
                      ? '实时行情已连接'
                      : wsStatus() === 'reconnecting'
                        ? '正在重连...'
                        : '未连接'}
                  </div>
                </div>
              </div>
            </div>

            {/* Backend API */}
            <div class="bg-[#111827]/80 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
              <Show
                when={!healthLoading()}
                fallback={
                  <div class="flex items-center gap-3">
                    <div class="w-2.5 h-2.5 rounded-full bg-gray-500 animate-pulse" />
                    <div>
                      <div class="text-sm font-medium text-gray-200">后端服务</div>
                      <div class="text-xs text-gray-500">检查中...</div>
                    </div>
                  </div>
                }
              >
                <Show
                  when={health() !== null}
                  fallback={
                    <div class="flex items-center gap-3">
                      <div class="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                      <div>
                        <div class="text-sm font-medium text-gray-200">后端服务</div>
                        <div class="text-xs text-red-400">连接失败</div>
                      </div>
                    </div>
                  }
                >
                  <div class="flex items-center gap-3">
                    <div class="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                    <div>
                      <div class="text-sm font-medium text-gray-200">后端服务</div>
                      <div class="text-xs text-green-400">运行正常</div>
                    </div>
                  </div>
                </Show>
              </Show>
            </div>

            {/* Database Status */}
            <div class="bg-[#111827]/80 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
              <Show
                when={health() !== null}
                fallback={
                  <div class="flex items-center gap-3">
                    <div class="w-2.5 h-2.5 rounded-full bg-gray-500" />
                    <div>
                      <div class="text-sm font-medium text-gray-200">数据库</div>
                      <div class="text-xs text-gray-500">—</div>
                    </div>
                  </div>
                }
              >
                <div class="flex items-center gap-3">
                  <div
                    class={`w-2.5 h-2.5 rounded-full ${
                      health()?.status === 'ok'
                        ? 'bg-green-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]'
                        : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                    }`}
                  />
                  <div>
                    <div class="text-sm font-medium text-gray-200">数据库</div>
                    <div class="text-xs text-gray-500">
                      {health()?.status === 'ok' ? 'DuckDB 已连接' : (health()?.status ?? '未知')}
                    </div>
                  </div>
                </div>
              </Show>
            </div>
          </div>

          {/* Health Details (if loaded) */}
          <Show when={health() !== null}>
            <div class="mt-4 bg-[#111827]/60 border border-white/5 rounded-xl p-4">
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div>
                  <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-1">版本</div>
                  <div class="text-sm font-mono text-gray-300">{health()?.version ?? '—'}</div>
                </div>
                <div>
                  <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-1">WS连接</div>
                  <div class="text-sm font-mono text-gray-300">
                    {health()?.ws_connections ?? '—'}
                  </div>
                </div>
                <div>
                  <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-1">网关数</div>
                  <div class="text-sm font-mono text-gray-300">
                    {health()?.gateways?.length ?? '—'}
                  </div>
                </div>
                <div>
                  <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
                    运行时长
                  </div>
                  <div class="text-sm font-mono text-gray-300">
                    {health()?.uptime_seconds
                      ? `${Math.floor((health()?.uptime_seconds ?? 0) / 3600)}h ${Math.floor(((health()?.uptime_seconds ?? 0) % 3600) / 60)}m`
                      : '—'}
                  </div>
                </div>
              </div>
            </div>
          </Show>
        </section>
      </div>
    </div>
  );
};
