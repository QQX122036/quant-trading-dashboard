/**
 * PortfolioOverview.tsx — 持仓分析面板
 * 行业分布饼图 | 市值分布柱状图 | 风格暴露雷达图
 */
import { Component, createSignal, createMemo, onMount, onCleanup, Show, For } from 'solid-js';
import echarts from '@/lib/echarts';
import { fetchPositions, fetchAccounts } from '../../../hooks/useApi';
import type { PositionData, AccountData } from '../../../types/vnpy';

// ── Chart refs ─────────────────────────────────────────────
type EChartsInstance = echarts.ECharts;
let pieChart: EChartsInstance;
let barChart: EChartsInstance;
let radarChart: EChartsInstance;

const PIE_DOM = 'portfolio-pie';
const BAR_DOM = 'portfolio-bar';
const RADAR_DOM = 'portfolio-radar';

// ── Market cap thresholds (CNY) ────────────────────────────
const LARGE_CAP = 500e8; // > 500亿
const MID_CAP = 50e8; // 50亿 ~ 500亿

// ── Style dimension labels ──────────────────────────────────
const STYLE_DIMS = ['价值', '成长', '动量', '质量', '低波'];

// ── Sector colors ───────────────────────────────────────────
const SECTOR_COLORS = [
  '#60A5FA',
  '#34D399',
  '#FBBF24',
  '#F87171',
  '#A78BFA',
  '#38BDF8',
  '#FB923C',
  '#E879F9',
  '#4ADE80',
  '#F472B6',
  '#FBBF24',
  '#6366F1',
  '#14B8A6',
  '#F97316',
  '#8B5CF6',
];

// ── Helpers ─────────────────────────────────────────────────
function formatMarketCap(v: number): string {
  if (v >= 1e8) return `${(v / 1e8).toFixed(1)}亿`;
  if (v >= 1e4) return `${(v / 1e4).toFixed(1)}万`;
  return v.toFixed(0);
}

// ── Simulated style exposure (5-dim, normalised 0–100) ──────
// In production these would come from real fundamental data.
function calcStyleExposure(_positions: PositionData[]): number[] {
  // Weighted random simulation seeded from position count to be stable across re-renders
  const seed = (p: PositionData[]) => p.reduce((a, x) => a + x.volume * (x.price || 1), 0) % 100;

  const base = seed(_positions);
  const rand = (offset: number) => Math.min(100, Math.max(10, (base * 17 + offset * 31) % 100));

  return [
    rand(1), // 价值
    rand(2), // 成长
    rand(3), // 动量
    rand(4), // 质量
    rand(5), // 低波
  ];
}

// ── Init / resize charts ───────────────────────────────────
function initPieChart(el: HTMLElement, data: { name: string; value: number }[]) {
  if (pieChart) pieChart.dispose();
  pieChart = echarts.init(el, 'dark');
  pieChart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: (p: any) =>
        `${p.name}<br/>市值: ${formatMarketCap(p.value)}<br/>占比: ${p.percent}%`,
      backgroundColor: 'rgba(17,24,39,0.9)',
      borderColor: 'rgba(255,255,255,0.1)',
      textStyle: { color: '#E5E7EB' },
    },
    legend: {
      orient: 'vertical',
      right: '5%',
      top: 'center',
      textStyle: { color: '#9CA3AF', fontSize: 11 },
      itemWidth: 10,
      itemHeight: 10,
    },
    series: [
      {
        type: 'pie',
        radius: ['42%', '70%'],
        center: ['38%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 4, borderColor: '#111827', borderWidth: 2 },
        label: { show: false },
        emphasis: {
          itemStyle: { shadowBlur: 12, shadowColor: 'rgba(0,0,0,0.4)' },
          label: { show: true, fontSize: 13, fontWeight: 'bold', color: '#F3F4F6' },
        },
        data: data.map((d, i) => ({
          ...d,
          itemStyle: { color: SECTOR_COLORS[i % SECTOR_COLORS.length] },
        })),
      },
    ],
  });
}

function initBarChart(el: HTMLElement, data: { name: string; value: number; color: string }[]) {
  if (barChart) barChart.dispose();
  barChart = echarts.init(el, 'dark');
  barChart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (p: any[]) => `${p[0].name}<br/>市值: ${formatMarketCap(p[0].value)}`,
      backgroundColor: 'rgba(17,24,39,0.9)',
      borderColor: 'rgba(255,255,255,0.1)',
      textStyle: { color: '#E5E7EB' },
    },
    grid: { left: '5%', right: '8%', top: '8%', bottom: '8%', containLabel: true },
    xAxis: {
      type: 'category',
      data: data.map((d) => d.name),
      axisLabel: { color: '#9CA3AF', fontSize: 12 },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#9CA3AF', fontSize: 11, formatter: (v: number) => formatMarketCap(v) },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
    },
    series: [
      {
        type: 'bar',
        data: data.map((d) => ({
          value: d.value,
          itemStyle: { color: d.color, borderRadius: [4, 4, 0, 0] },
        })),
        barWidth: '55%',
        label: {
          show: true,
          position: 'top',
          formatter: (p: any) => formatMarketCap(p.value),
          color: '#D1D5DB',
          fontSize: 11,
        },
      },
    ],
  });
}

function initRadarChart(el: HTMLElement, values: number[]) {
  if (radarChart) radarChart.dispose();
  radarChart = echarts.init(el, 'dark');
  radarChart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(17,24,39,0.9)',
      borderColor: 'rgba(255,255,255,0.1)',
      textStyle: { color: '#E5E7EB' },
      formatter: (p: any) => `${p.name}: ${p.value[0].toFixed(1)}`,
    },
    radar: {
      indicator: STYLE_DIMS.map((dim) => ({ name: dim, max: 100 })),
      radius: '65%',
      center: ['50%', '50%'],
      splitNumber: 4,
      axisName: { color: '#9CA3AF', fontSize: 12 },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      splitArea: { areaStyle: { color: ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.06)'] } },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: values,
            name: '风格暴露',
            areaStyle: { color: 'rgba(96,165,250,0.25)' },
            lineStyle: { color: '#60A5FA', width: 2 },
            itemStyle: { color: '#60A5FA' },
          },
        ],
      },
    ],
  });
}

function resizeCharts() {
  pieChart?.resize();
  barChart?.resize();
  radarChart?.resize();
}

// ── Component ───────────────────────────────────────────────
export const PortfolioOverview: Component = () => {
  const [positions, setPositions] = createSignal<PositionData[]>([]);
  const [accounts, setAccounts] = createSignal<AccountData[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  // ── Aggregate positions to market value ──────────────────
  const totalMarketValue = createMemo(() =>
    positions().reduce((sum, p) => sum + p.volume * (p.price || 0), 0)
  );

  const totalPnl = createMemo(() => positions().reduce((sum, p) => sum + (p.pnl || 0), 0));

  const accountBalance = createMemo(() => accounts().reduce((sum, a) => sum + (a.balance || 0), 0));

  // ── Industry distribution ─────────────────────────────────
  // Map stock code prefix to sector (simplified)
  function inferSector(symbol: string): string {
    const s2s: Record<string, string> = {
      '600': '金融',
      '601': '金融',
      '603': '金融',
      '605': '金融',
      '000': '消费',
      '001': '消费',
      '002': '科技',
      '003': '科技',
      '300': '医药',
      '301': '医药',
      '688': '科技',
      '688001': '科技',
      '600519': '白酒',
      '600036': '银行',
    };
    return s2s[symbol] ?? '其他';
  }

  const industryData = createMemo(() => {
    const map = new Map<string, number>();
    for (const p of positions()) {
      const sector = inferSector(p.symbol);
      map.set(sector, (map.get(sector) ?? 0) + p.volume * (p.price || 0));
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  });

  // ── Market cap distribution ────────────────────────────────
  // In production: fetch total market cap from data API.
  // Here we estimate from position market value × a size factor.
  const marketCapData = createMemo(() => {
    const map = { large: 0, mid: 0, small: 0 };
    for (const p of positions()) {
      const mv = p.volume * (p.price || 0);
      // Simulate total market cap from position MV (random factor 1x–8x)
      const seed = (p.symbol.charCodeAt(0) % 8) + 1;
      const totalCap = mv * seed;
      if (totalCap > LARGE_CAP) map.large += mv;
      else if (totalCap > MID_CAP) map.mid += mv;
      else map.small += mv;
    }
    return [
      { name: '大盘', value: map.large, color: '#60A5FA' },
      { name: '中盘', value: map.mid, color: '#34D399' },
      { name: '小盘', value: map.small, color: '#FBBF24' },
    ];
  });

  // ── Style exposure ─────────────────────────────────────────
  const styleExposure = createMemo(() => calcStyleExposure(positions()));

  // ── Data load ─────────────────────────────────────────────
  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [posRes, accRes] = await Promise.all([fetchPositions(), fetchAccounts()]);
      setPositions(posRes.data?.positions ?? []);
      setAccounts(accRes.data?.accounts ?? []);
    } catch (e: any) {
      setError(e?.message ?? '加载失败');
    } finally {
      setLoading(false);
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────
  onMount(async () => {
    await load();
    window.addEventListener('resize', resizeCharts);
  });

  onCleanup(() => {
    window.removeEventListener('resize', resizeCharts);
    pieChart?.dispose();
    barChart?.dispose();
    radarChart?.dispose();
  });

  // ── Render charts after data changes ─────────────────────
  const renderCharts = () => {
    const pEl = document.getElementById(PIE_DOM);
    const bEl = document.getElementById(BAR_DOM);
    const rEl = document.getElementById(RADAR_DOM);
    if (pEl && industryData().length > 0) initPieChart(pEl, industryData());
    if (bEl && marketCapData().length > 0) initBarChart(bEl, marketCapData());
    if (rEl) initRadarChart(rEl, styleExposure());
  };

  // Watch positions → re-render charts
  createMemo(() => {
    positions();
    accounts();
    setTimeout(renderCharts, 0);
  });

  // ── Summary cards ─────────────────────────────────────────
  const cards = createMemo(() => [
    { label: '持仓市值', value: formatMarketCap(totalMarketValue()) },
    {
      label: '累计盈亏',
      value: `${totalPnl() >= 0 ? '+' : ''}${totalPnl().toFixed(0)}`,
      color: totalPnl() >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]',
    },
    { label: '账户余额', value: formatMarketCap(accountBalance()) },
    { label: '持仓股票', value: `${positions().length} 只` },
  ]);

  return (
    <div class="h-full flex flex-col p-4 gap-4 overflow-auto">
      {/* Loading overlay */}
      <Show when={loading()}>
        <div class="absolute inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-none">
          <div class="flex flex-col items-center gap-3">
            <div class="w-10 h-10 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span class="text-sm text-gray-400">加载持仓数据...</span>
          </div>
        </div>
      </Show>

      {/* Summary cards */}
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <For each={cards()}>
          {(card) => (
            <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4 flex flex-col gap-1">
              <span class="text-xs text-gray-500 uppercase tracking-wider">{card.label}</span>
              <span class={`text-xl font-bold tabular-nums ${card.color ?? 'text-white'}`}>
                {card.value}
              </span>
            </div>
          )}
        </For>
      </div>

      {/* Error banner */}
      <Show when={error()}>
        <div class="bg-red-900/20 border border-red-800/30 rounded-lg px-4 py-2 text-sm text-red-400">
          ⚠️ {error()}
        </div>
      </Show>

      {/* Charts row */}
      <div class="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 min-h-0">
        {/* Industry pie chart */}
        <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4 flex flex-col">
          <h3 class="font-bold text-sm mb-3 text-gray-300">行业分布</h3>
          <div id={PIE_DOM} class="flex-1 min-h-0" />
          <Show when={!loading() && industryData().length === 0}>
            <div class="flex-1 flex items-center justify-center text-sm text-gray-600">
              暂无行业数据
            </div>
          </Show>
        </div>

        {/* Market cap bar chart */}
        <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4 flex flex-col">
          <h3 class="font-bold text-sm mb-3 text-gray-300">市值分布</h3>
          <div id={BAR_DOM} class="flex-1 min-h-0" />
          <div class="flex justify-center gap-4 mt-2 text-xs text-gray-500">
            <span class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-[#60A5FA]" />
              大盘 &gt;500亿
            </span>
            <span class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-[#34D399]" />
              中盘 50-500亿
            </span>
            <span class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-[#FBBF24]" />
              小盘 ≤50亿
            </span>
          </div>
        </div>

        {/* Style radar chart */}
        <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4 flex flex-col">
          <h3 class="font-bold text-sm mb-3 text-gray-300">风格暴露</h3>
          <div id={RADAR_DOM} class="flex-1 min-h-0" />
          <div class="flex justify-center gap-3 mt-2 text-xs text-gray-500">
            <For each={STYLE_DIMS}>
              {(dim, i) => (
                <span class="px-2 py-0.5 rounded bg-white/5 text-gray-400">
                  {dim}{' '}
                  <span class="text-blue-400 font-medium">{styleExposure()[i()].toFixed(0)}</span>
                </span>
              )}
            </For>
          </div>
        </div>
      </div>

      {/* Holdings table */}
      <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4 flex flex-col">
        <h3 class="font-bold text-sm mb-3 text-gray-300">持仓明细</h3>
        <Show when={!loading() && positions().length === 0}>
          <div class="flex-1 flex items-center justify-center py-8 text-sm text-gray-600">
            暂无持仓
          </div>
        </Show>
        <Show when={positions().length > 0}>
          <div class="overflow-auto max-h-48">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-gray-500 text-xs border-b border-white/5">
                  <th class="text-left py-2 font-normal">代码</th>
                  <th class="text-left py-2 font-normal">名称</th>
                  <th class="text-right py-2 font-normal">方向</th>
                  <th class="text-right py-2 font-normal">持仓量</th>
                  <th class="text-right py-2 font-normal">均价</th>
                  <th class="text-right py-2 font-normal">现价</th>
                  <th class="text-right py-2 font-normal">市值</th>
                  <th class="text-right py-2 font-normal">盈亏</th>
                </tr>
              </thead>
              <tbody>
                <For each={positions()}>
                  {(pos) => {
                    const mv = pos.volume * (pos.price || 0);
                    return (
                      <tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td class="py-2 font-mono text-xs text-gray-400">{pos.symbol}</td>
                        <td class="py-2 text-xs text-gray-300">—</td>
                        <td
                          class={`py-2 text-right text-xs font-medium ${String(pos.direction) === '多' || String(pos.direction) === 'long' ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}
                        >
                          {pos.direction}
                        </td>
                        <td class="py-2 text-right tabular-nums text-xs">
                          {pos.volume.toLocaleString()}
                        </td>
                        <td class="py-2 text-right tabular-nums text-xs text-gray-400">
                          {pos.price > 0 ? pos.price.toFixed(2) : '—'}
                        </td>
                        <td class="py-2 text-right tabular-nums text-xs">—</td>
                        <td class="py-2 text-right tabular-nums text-xs font-medium">
                          {mv > 0 ? formatMarketCap(mv) : '—'}
                        </td>
                        <td
                          class={`py-2 text-right tabular-nums text-xs font-bold ${
                            (pos.pnl ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'
                          }`}
                        >
                          {(pos.pnl ?? 0) >= 0 ? '+' : ''}
                          {(pos.pnl ?? 0).toFixed(0)}
                        </td>
                      </tr>
                    );
                  }}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </div>
    </div>
  );
};
