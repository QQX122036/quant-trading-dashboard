/**
 * AlphaSignals.tsx — Alpha20 评分 Top20 股票信号看板
 * - 调用 GET /api/alpha/top20 获取 Alpha20 评分 Top20 股票
 * - ECharts 表格展示：代码 / 名称 / 行业 / 评分 / 评级
 * - 支持刷新按钮
 * - 支持评分分布直方图、CSV导出、多维度排序
 */
import { Component, createSignal, onMount, onCleanup, createMemo, Show, For } from 'solid-js';
import ec from '@/lib/echarts';
import type { EChartsType } from '@/lib/echarts';
import { fetchAlphaTop20 } from '../hooks/useApi';

// ── Types ─────────────────────────────────────────────────

export interface AlphaStock {
  ts_code: string; // 股票代码
  name: string; // 股票名称
  industry: string; // 行业
  alpha20: number; // Alpha20 综合评分
  rating: string; // 评级: 强烈买入 / 买入 / 持有 / 谨慎 / 卖出
  rating_label?: string; // 评级标签
}

// ── ECharts 表格样式常量 ───────────────────────────────────

const RATING_COLORS: Record<string, string> = {
  强烈买入: '#10b981',
  买入: '#34d399',
  持有: '#fbbf24',
  谨慎: '#f97316',
  卖出: '#ef4444',
};

// ── 评级颜色映射 ───────────────────────────────────────────

function getRatingColor(rating: string): string {
  return RATING_COLORS[rating] ?? '#9ca3af';
}

// ── 组件 ─────────────────────────────────────────────────

const AlphaSignals: Component = () => {
  let chartRef: HTMLDivElement | undefined;
  let chart: EChartsType | undefined;

  const [data, setData] = createSignal<AlphaStock[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [refreshing, setRefreshing] = createSignal(false);
  const [lastUpdated, setLastUpdated] = createSignal<string>('');
  const [error, setError] = createSignal<string>('');
  const [sortKey, setSortKey] = createSignal<'alpha20' | 'industry' | 'ts_code'>('alpha20');
  const [sortAsc, setSortAsc] = createSignal(false);

  // ── 排序 ─────────────────────────────────────────────────
  function sortedData() {
    const items = data();
    const key = sortKey();
    const asc = sortAsc();
    return [...items].sort((a, b) => {
      let av: string | number = a[key];
      let bv: string | number = b[key];
      if (key === 'alpha20') {
        av = Number(av);
        bv = Number(bv);
        return asc ? av - bv : bv - av;
      }
      return asc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }

  function toggleSort(key: typeof sortKey extends () => infer T ? T : never) {
    if (sortKey() === key) {
      setSortAsc(!sortAsc());
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  function sortIcon(key: string) {
    if (sortKey() !== key) return '↕';
    return sortAsc() ? '↑' : '↓';
  }

  // ── CSV 导出 ─────────────────────────────────────────────
  function exportCSV() {
    const items = sortedData();
    const headers = ['代码', '名称', '行业', 'Alpha评分', '评级'];
    const rows = items.map((s) => [s.ts_code, s.name, s.industry, s.alpha20.toFixed(2), s.rating]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Alpha20_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── 直方图数据计算 ────────────────────────────────────────
  function buildHistogram() {
    const items = data();
    if (!items.length) return null;
    const scores = items.map((s) => s.alpha20);
    const min = Math.floor(Math.min(...scores));
    const max = Math.ceil(Math.max(...scores));
    const step = Math.max(1, Math.ceil((max - min) / 8));
    const buckets: Record<number, number> = {};
    for (let v = min; v < max + step; v += step) buckets[v] = 0;
    items.forEach((s) => {
      const bucket = Math.floor(s.alpha20 / step) * step;
      const key =
        Object.keys(buckets)
          .map(Number)
          .find((k) => Math.abs(k - bucket) < 0.001) ?? bucket;
      if (buckets[key] !== undefined) buckets[key]++;
    });
    return {
      categories: Object.keys(buckets)
        .map(Number)
        .sort((a, b) => a - b)
        .map((v) => `${v}-${v + step}`),
      values: Object.keys(buckets)
        .map(Number)
        .sort((a, b) => a - b)
        .map((v) => buckets[v]),
    };
  }

  // ── 数据加载 ─────────────────────────────────────────────

  async function loadData() {
    setRefreshing(true);
    setError('');
    try {
      const res = await fetchAlphaTop20();
      if (res.code === '0' && res.data?.items) {
        setData(res.data.items);
        setLastUpdated(
          new Date().toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        );
      } else {
        setError(res.message || '获取数据失败');
      }
    } catch (_e: unknown) {
      setError('网络错误，请检查后端服务');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }

  onMount(async () => {
    loadData();
    initChart();
    initHistogram();
  });

  // ── ECharts 直方图 ───────────────────────────────────────
  let histRef: HTMLDivElement | undefined;
  let histChart: EChartsType | undefined;

  function initHistogram() {
    if (!histRef) return;
    if (histChart) histChart.dispose();
    histChart = ec.init(histRef, 'dark');
  }

  function renderHistogram() {
    if (!histChart) return;
    const hist = buildHistogram();
    if (!hist) {
      histChart.clear();
      return;
    }
    histChart.setOption(
      {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'axis',
          backgroundColor: '#111827',
          borderColor: '#374151',
          textStyle: { color: '#e5e7eb', fontSize: 12 },
          formatter: (params: unknown) => {
            const p = (params as Array<{ name: string; value: number }>)[0];
            return `<div style="font-size:12px"><b>${p.name}</b><br/>股票数: <span style="color:#60a5fa;font-weight:600">${p.value}</span></div>`;
          },
        },
        grid: { top: 16, right: 16, bottom: 24, left: 48, containLabel: true },
        xAxis: {
          type: 'category',
          data: hist.categories,
          axisLine: { lineStyle: { color: '#374151' } },
          axisLabel: { color: '#9ca3af', fontSize: 10 },
          axisTick: { show: false },
          name: '评分区间',
          nameLocation: 'middle',
          nameGap: 28,
          nameTextStyle: { color: '#6b7280', fontSize: 10 },
        },
        yAxis: {
          type: 'value',
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: '#6b7280', fontSize: 10 },
          splitLine: { lineStyle: { color: '#1f2937' } },
          name: '股票数',
          nameTextStyle: { color: '#6b7280', fontSize: 10 },
        },
        series: [
          {
            type: 'bar',
            data: hist.values,
            barMaxWidth: 40,
            itemStyle: {
              color: new ec.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: '#3b82f6' },
                { offset: 1, color: '#1e3a5f' },
              ]),
              borderRadius: [4, 4, 0, 0],
            },
            emphasis: { itemStyle: { color: '#60a5fa' } },
          },
        ],
      },
      true
    );
  }

  // ── ECharts 表格 ─────────────────────────────────────────

  function initChart() {
    if (!chartRef) return;
    if (chart) chart.dispose();
    chart = ec.init(chartRef, 'dark');
    const ro = new ResizeObserver(() => chart?.resize());
    ro.observe(chartRef);
    onCleanup(() => ro.disconnect());
    renderChart();
  }

  function renderChart() {
    if (!chart) return;
    const items = sortedData();

    if (items.length === 0) {
      chart.clear();
      return;
    }

    const sorted = items;

    const columns = ['代码', '名称', '行业', 'Alpha评分', '评级'];
    const _rows = sorted.map((s) => [
      s.ts_code,
      s.name,
      s.industry,
      s.alpha20.toFixed(2),
      s.rating,
    ]);
    chart.setOption(
      {
        backgroundColor: 'transparent',
        dataset: {
          dimensions: columns,
          source: sorted.map((s, i) => ({
            代码: s.ts_code,
            名称: s.name,
            行业: s.industry,
            Alpha评分: s.alpha20,
            评级: s.rating,
            _idx: i,
          })),
        },
        tooltip: {
          trigger: 'item',
          backgroundColor: '#111827',
          borderColor: '#374151',
          textStyle: { color: '#e5e7eb', fontSize: 12 },
          formatter: (params: unknown) => {
            const p = params as { data: AlphaStock };
            const s = p.data;
            return `
              <div style="font-size:12px;line-height:1.8">
                <div style="font-weight:600;color:#f3f4f6;margin-bottom:4px">${s.name} (${s.ts_code})</div>
                <div>行业: <span style="color:#d1d5db">${s.industry}</span></div>
                <div>Alpha评分: <span style="color:#60a5fa;font-weight:600">${s.alpha20.toFixed(2)}</span></div>
                <div>评级: <span style="color:${getRatingColor(s.rating)};font-weight:600">${s.rating}</span></div>
              </div>
            `;
          },
        },
        grid: { top: 8, right: 16, bottom: 32, left: 8, containLabel: true },
        xAxis: { type: 'category', show: false },
        yAxis: {
          type: 'category',
          data: sorted.map((s) => s.name),
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: '#9ca3af',
            fontSize: 11,
            width: 60,
            overflow: 'truncate',
          },
          inverse: true,
        },
        series: [
          // Alpha 评分横条
          {
            type: 'bar',
            encode: { x: 'Alpha评分', y: '名称' },
            datasetIndex: 0,
            barMaxWidth: 24,
            barMinHeight: 12,
            itemStyle: {
              color: new ec.graphic.LinearGradient(0, 0, 1, 0, [
                { offset: 0, color: '#3b82f6' },
                { offset: 1, color: '#60a5fa' },
              ]),
              borderRadius: [0, 4, 4, 0],
            },
            emphasis: {
              itemStyle: {
                color: new ec.graphic.LinearGradient(0, 0, 1, 0, [
                  { offset: 0, color: '#2563eb' },
                  { offset: 1, color: '#3b82f6' },
                ]),
              },
            },
            label: {
              show: true,
              position: 'right',
              color: '#60a5fa',
              fontSize: 11,
              formatter: (params: unknown) => {
                const p = params as { data: AlphaStock };
                return p.data.alpha20.toFixed(2);
              },
            },
          },
          // 评级色块（叠加在右侧）
          {
            type: 'bar',
            encode: { x: 'Alpha评分', y: '名称' },
            datasetIndex: 0,
            barMaxWidth: 6,
            barMinHeight: 12,
            itemStyle: {
              color: (params: unknown) => {
                const p = params as { data: AlphaStock };
                return getRatingColor(p.data.rating);
              },
              borderRadius: [0, 4, 4, 0],
            },
            silent: true,
            tooltip: { show: false },
          },
        ],
      },
      true
    );
  }

  // 数据变化时重绘
  createMemo(() => {
    data(); // track
    if (chart) setTimeout(() => renderChart(), 50);
    if (histChart) setTimeout(() => renderHistogram(), 50);
  });

  // ── 渲染 ─────────────────────────────────────────────────

  return (
    <div class="h-full overflow-auto p-6 bg-[#0A0E17] space-y-4">
      {/* ── Header ───────────────────────────────────────── */}
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold text-white">Alpha20 信号看板</h2>
          <p class="text-xs text-gray-500 mt-0.5">
            Alpha20 评分 Top20 股票 · {lastUpdated() ? `更新时间 ${lastUpdated()}` : '加载中…'}
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={refreshing()}
          class="flex items-center gap-2 px-4 py-2 bg-[#1f2937] hover:bg-[#374151] disabled:opacity-50 disabled:cursor-not-allowed border border-white/10 rounded-lg text-sm text-gray-200 transition-colors"
        >
          <svg
            class={`w-4 h-4 ${refreshing() ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {refreshing() ? '刷新中…' : '刷新'}
        </button>
      </div>

      {/* ── 评分说明标签 + 导出按钮 ───────────────────────── */}
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div class="flex flex-wrap gap-3">
          <For each={Object.entries(RATING_COLORS)}>
            {([rating, color]) => (
              <div class="flex items-center gap-1.5 text-xs text-gray-400">
                <div class="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                {rating}
              </div>
            )}
          </For>
        </div>
        <button
          onClick={exportCSV}
          disabled={!data().length}
          class="flex items-center gap-2 px-4 py-2 bg-[#1f2937] hover:bg-[#374151] disabled:opacity-50 disabled:cursor-not-allowed border border-white/10 rounded-lg text-sm text-gray-200 transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          导出CSV
        </button>
      </div>

      {/* ── 评分分布直方图 ─────────────────────────────────── */}
      <Show when={!loading() && !error() && data().length > 0}>
        <div class="bg-[#111827] border border-white/10 rounded-xl p-4">
          <div class="text-xs text-gray-500 mb-3 font-medium">Alpha评分分布</div>
          <div ref={histRef} style={{ width: '100%', height: '160px' }} />
        </div>
      </Show>

      {/* ── Loading ─────────────────────────────────────── */}
      <Show when={loading()}>
        <div class="flex flex-col items-center justify-center h-64 gap-4">
          <div class="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <span class="text-gray-500 text-sm">加载 Alpha20 数据…</span>
        </div>
      </Show>

      {/* ── Error ───────────────────────────────────────── */}
      <Show when={!loading() && error()}>
        <div class="flex flex-col items-center justify-center h-48 gap-3 bg-[#111827] border border-red-500/20 rounded-xl p-6">
          <div class="text-red-400 text-sm">{error()}</div>
          <button
            onClick={loadData}
            class="px-4 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded-lg text-red-300 text-xs transition-colors"
          >
            重试
          </button>
        </div>
      </Show>

      {/* ── 图表区域 ─────────────────────────────────────── */}
      <Show when={!loading() && !error()}>
        {/* ECharts 横向条形图 */}
        <div class="bg-[#111827] border border-white/10 rounded-xl p-4">
          <div
            ref={chartRef}
            style={{ width: '100%', height: Math.max(data().length * 36 + 40, 300) + 'px' }}
          />
        </div>

        {/* 详细数据表格 */}
        <Show when={data().length > 0}>
          <div class="bg-[#111827] border border-white/10 rounded-xl overflow-hidden">
            <table class="w-full text-xs">
              <thead>
                <tr class="text-gray-500 border-b border-white/10 bg-white/[0.02]">
                  <th class="text-left py-2.5 px-4 font-medium w-12">#</th>
                  <th
                    class="text-left py-2.5 px-3 font-medium cursor-pointer hover:text-gray-300 transition-colors select-none"
                    onClick={() => toggleSort('ts_code')}
                  >
                    代码 {sortIcon('ts_code')}
                  </th>
                  <th class="text-left py-2.5 px-3 font-medium">名称</th>
                  <th
                    class="text-left py-2.5 px-3 font-medium cursor-pointer hover:text-gray-300 transition-colors select-none"
                    onClick={() => toggleSort('industry')}
                  >
                    行业 {sortIcon('industry')}
                  </th>
                  <th
                    class="text-right py-2.5 px-3 font-medium cursor-pointer hover:text-gray-300 transition-colors select-none"
                    onClick={() => toggleSort('alpha20')}
                  >
                    Alpha评分 {sortIcon('alpha20')}
                  </th>
                  <th class="text-center py-2.5 px-3 font-medium">评级</th>
                </tr>
              </thead>
              <tbody>
                {sortedData().map((stock, i) => (
                  <tr class="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                    <td class="py-2.5 px-4 text-gray-600">{i + 1}</td>
                    <td class="py-2.5 px-3 text-gray-300 font-mono">{stock.ts_code}</td>
                    <td class="py-2.5 px-3 text-white font-medium">{stock.name}</td>
                    <td class="py-2.5 px-3 text-gray-400">{stock.industry || '—'}</td>
                    <td class="py-2.5 px-3 text-right">
                      <span class="text-blue-400 font-semibold tabular-nums">
                        {stock.alpha20.toFixed(2)}
                      </span>
                    </td>
                    <td class="py-2.5 px-3 text-center">
                      <span
                        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          color: getRatingColor(stock.rating),
                          background: `${getRatingColor(stock.rating)}18`,
                          border: `1px solid ${getRatingColor(stock.rating)}40`,
                        }}
                      >
                        {stock.rating}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Show>
      </Show>
    </div>
  );
};

export default AlphaSignals;
