/**
 * MultiStrategyChart.tsx — 多因子策略回测图表
 * 因子权重柱状图 + IC时间序列折线图 + 因子贡献度饼图
 */
import { Component, createSignal, onMount, onCleanup, Show } from 'solid-js';
import echarts from '@/lib/echarts';
import { apiState, apiActions } from '../../stores/apiStore';

// ── Mock data (当真实数据不可用时) ─────────────────────────────
const MOCK_FACTOR_WEIGHTS = [
  { name: 'sector_momentum_5d', weight: 0.25, color: '#6366F1' },
  { name: 'price_change', weight: 0.25, color: '#22C55E' },
  { name: 'mom_accel', weight: 0.25, color: '#F59E0B' },
  { name: 'alpha47', weight: 0.25, color: '#EC4899' },
];

const MOCK_IC_SERIES = Array.from({ length: 60 }, (_, i) => {
  const date = new Date(2024, 0, 1);
  date.setDate(date.getDate() + i * 5);
  const base = Math.sin(i * 0.3) * 0.05 + (Math.random() - 0.5) * 0.04;
  return {
    date: date.toISOString().slice(0, 10),
    ic: parseFloat(base.toFixed(4)),
    ic_rank: parseFloat((base * 0.85 + (Math.random() - 0.5) * 0.02).toFixed(4)),
  };
});

const MOCK_CONTRIBUTIONS = [
  { name: 'sector_momentum_5d', value: 32.5, color: '#6366F1' },
  { name: 'price_change', value: 28.3, color: '#22C55E' },
  { name: 'mom_accel', value: 24.7, color: '#F59E0B' },
  { name: 'alpha47', value: 14.5, color: '#EC4899' },
];

// ── Backtest result shape (extensible) ──────────────────────
interface FactorBacktestResult {
  factor_weights?: Array<{ name: string; weight: number; color?: string }>;
  ic_series?: Array<{ date: string; ic: number; ic_rank?: number }>;
  factor_contributions?: Array<{ name: string; value: number; color?: string }>;
}

export const MultiStrategyChart: Component = () => {
  let weightRef: HTMLDivElement | undefined;
  let icRef: HTMLDivElement | undefined;
  let contribRef: HTMLDivElement | undefined;
  let weightChart: echarts.ECharts | undefined;
  let icChart: echarts.ECharts | undefined;
  let contribChart: echarts.ECharts | undefined;

  const [result, setResult] = createSignal<FactorBacktestResult | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [useMock, setUseMock] = createSignal(false);

  // ── Factor Weight Bar Chart ────────────────────────────────
  const buildWeightOption = (
    data: Array<{ name: string; weight: number; color: string }>
  ): echarts.EChartsCoreOption => ({
    backgroundColor: 'transparent',
    grid: { left: '5%', right: '12%', top: '8%', bottom: '8%', containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#1f2937',
      borderColor: 'rgba(255,255,255,0.1)',
      textStyle: { color: '#fff' },
      formatter: (params: unknown) => {
        const arr = params as Array<{ name: string; value: number; color: string }>;
        if (!arr?.length) return '';
        const item = arr[0];
        return `<div style="font-size:12px">
          <div style="font-weight:bold;margin-bottom:4px">${item.name}</div>
          <div style="color:${item.color}">权重: <strong>${(item.value * 100).toFixed(1)}%</strong></div>
        </div>`;
      },
    },
    xAxis: {
      type: 'value',
      max: 1,
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      axisLabel: {
        color: '#9CA3AF',
        fontSize: 10,
        formatter: (v: number) => `${(v * 100).toFixed(0)}%`,
      },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
    },
    yAxis: {
      type: 'category',
      data: data.map((d) => d.name),
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      axisLabel: { color: '#9CA3AF', fontSize: 11 },
    },
    series: [
      {
        type: 'bar',
        data: data.map((d) => ({
          value: d.weight,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: d.color },
              { offset: 1, color: `${d.color}99` },
            ]),
            borderRadius: [0, 4, 4, 0],
          },
        })),
        barMaxWidth: 32,
        label: {
          show: true,
          position: 'right',
          formatter: (p: { value: number }) => `${(p.value * 100).toFixed(1)}%`,
          color: '#9CA3AF',
          fontSize: 11,
        },
      },
    ],
  });

  // ── IC Time Series Line Chart ─────────────────────────────
  const buildICOption = (
    data: Array<{ date: string; ic: number; ic_rank?: number }>
  ): echarts.EChartsCoreOption => {
    const dates = data.map((d) => d.date);
    const icValues = data.map((d) => d.ic);
    const rankValues = data.map((d) => d.ic_rank ?? d.ic * 0.85);

    return {
      backgroundColor: 'transparent',
      grid: { left: '5%', right: '5%', top: '15%', bottom: '12%', containLabel: true },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1f2937',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#fff' },
        formatter: (params: unknown) => {
          const arr = params as Array<{
            axisValue: string;
            seriesName: string;
            value: number;
            color: string;
          }>;
          if (!arr?.length) return '';
          const date = `<div style="font-size:11px;color:#9CA3AF;margin-bottom:4px">${arr[0].axisValue}</div>`;
          return (
            date +
            arr
              .map((p) => {
                const sign = p.value >= 0 ? '+' : '';
                return `<div style="display:flex;justify-content:space-between;gap:16px">
                  <span style="color:${p.color}">${p.seriesName}</span>
                  <span style="color:${p.color}">${sign}${p.value.toFixed(4)}</span>
                </div>`;
              })
              .join('')
          );
        },
      },
      legend: {
        data: ['IC', 'Rank IC'],
        textStyle: { color: '#9CA3AF', fontSize: 10 },
        top: 0,
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: {
          color: '#9CA3AF',
          fontSize: 9,
          formatter: (v: string) => v.slice(5),
          rotate: 30,
        },
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: '#9CA3AF', fontSize: 10, formatter: (v: number) => v.toFixed(2) },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: '#6B7280', type: 'dashed', width: 1 },
          data: [
            { yAxis: 0.03, label: { formatter: '+0.03', color: '#6B7280', fontSize: 9 } },
            { yAxis: -0.03, label: { formatter: '-0.03', color: '#6B7280', fontSize: 9 } },
          ],
        },
      },
      series: [
        {
          name: 'IC',
          type: 'line',
          smooth: true,
          data: icValues,
          lineStyle: { width: 2, color: '#3B82F6' },
          itemStyle: { color: '#3B82F6' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(59,130,246,0.25)' },
              { offset: 1, color: 'rgba(59,130,246,0)' },
            ]),
          },
        },
        {
          name: 'Rank IC',
          type: 'line',
          smooth: true,
          data: rankValues,
          lineStyle: { width: 1.5, type: 'dashed', color: '#8B5CF6' },
          itemStyle: { color: '#8B5CF6' },
        },
      ],
    } as unknown as echarts.EChartsCoreOption;
  };

  // ── Factor Contribution Pie Chart ─────────────────────────
  const buildContribOption = (
    data: Array<{ name: string; value: number; color: string }>
  ): echarts.EChartsCoreOption => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: '#1f2937',
      borderColor: 'rgba(255,255,255,0.1)',
      textStyle: { color: '#fff' },
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number; color: string; percent: number };
        return `<div style="font-size:12px">
          <div style="color:${p.color};font-weight:bold">${p.name}</div>
          <div>贡献: <strong>${p.value.toFixed(1)}%</strong></div>
          <div>占比: ${p.percent.toFixed(1)}%</div>
        </div>`;
      },
    },
    legend: {
      orient: 'vertical',
      right: '5%',
      top: 'center',
      textStyle: { color: '#9CA3AF', fontSize: 10 },
      itemWidth: 10,
      itemHeight: 10,
      formatter: (name: string) => {
        const item = data.find((d) => d.name === name);
        return `${name}  ${item ? `${item.value.toFixed(1)}%` : ''}`;
      },
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 4,
          borderColor: '#0A0E17',
          borderWidth: 2,
        },
        label: {
          show: true,
          position: 'outside',
          formatter: '{b}\n{d}%',
          color: '#D1D5DB',
          fontSize: 10,
        },
        labelLine: { show: true, lineStyle: { color: 'rgba(255,255,255,0.2)' } },
        emphasis: {
          label: { show: true, fontSize: 12, fontWeight: 'bold' },
          itemStyle: { shadowBlur: 12, shadowColor: 'rgba(0,0,0,0.4)' },
        },
        data: data.map((d) => ({
          name: d.name,
          value: d.value,
          itemStyle: { color: d.color },
        })),
      },
    ],
  });

  const loadData = async () => {
    setLoading(true);
    try {
      // Use backtestResult from store (populated by runBacktest or refresh)
      const stored = apiState.backtestResult;
      if (stored && (stored as FactorBacktestResult).factor_weights) {
        setResult(stored as FactorBacktestResult);
        setUseMock(false);
        return;
      }
      // Fallback: use mock data
      setUseMock(true);
      setResult({
        factor_weights: MOCK_FACTOR_WEIGHTS,
        ic_series: MOCK_IC_SERIES,
        factor_contributions: MOCK_CONTRIBUTIONS,
      });
    } catch {
      setUseMock(true);
      setResult({
        factor_weights: MOCK_FACTOR_WEIGHTS,
        ic_series: MOCK_IC_SERIES,
        factor_contributions: MOCK_CONTRIBUTIONS,
      });
    } finally {
      setLoading(false);
    }
  };

  const updateCharts = () => {
    const r = result();
    if (!r) return;

    if (r.factor_weights && weightChart) {
      weightChart.setOption(
        buildWeightOption(
          r.factor_weights.map((d, i) => ({
            ...d,
            color: d.color ?? ['#6366F1', '#22C55E', '#F59E0B', '#EC4899'][i % 4],
          }))
        ),
        true
      );
    }

    if (r.ic_series && icChart) {
      icChart.setOption(buildICOption(r.ic_series), true);
    }

    if (r.factor_contributions && contribChart) {
      contribChart.setOption(
        buildContribOption(
          r.factor_contributions.map((d, i) => ({
            ...d,
            color: d.color ?? ['#6366F1', '#22C55E', '#F59E0B', '#EC4899'][i % 4],
          }))
        ),
        true
      );
    }
  };

  onMount(() => {
    weightChart = echarts.init(weightRef!, 'dark');
    icChart = echarts.init(icRef!, 'dark');
    contribChart = echarts.init(contribRef!, 'dark');

    const ro = new ResizeObserver(() => {
      weightChart?.resize();
      icChart?.resize();
      contribChart?.resize();
    });
    [weightRef!, icRef!, contribRef!].forEach((el) => ro.observe(el));

    loadData().then(updateCharts);

    onCleanup(() => {
      ro.disconnect();
      weightChart?.dispose();
      icChart?.dispose();
      contribChart?.dispose();
    });
  });

  return (
    <div class="flex flex-col gap-4 h-full p-4 overflow-hidden">
      {/* Header */}
      <div class="flex items-center justify-between shrink-0">
        <div class="flex items-center gap-3">
          <h2 class="text-lg font-bold">多因子策略</h2>
          <Show when={useMock()}>
            <span class="text-xs px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
              演示数据
            </span>
          </Show>
          <Show when={loading()}>
            <span class="text-xs text-gray-400 animate-pulse">加载中...</span>
          </Show>
        </div>
        <button
          class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm transition-colors"
          onClick={() => {
            loadData().then(updateCharts);
          }}
        >
          刷新
        </button>
      </div>

      {/* Charts Grid: 2-row bento */}
      <div class="flex-1 grid grid-cols-1 xl:grid-cols-3 gap-4 min-h-0 overflow-hidden">
        {/* Row 1: Factor Weight Bar Chart (full width left) */}
        <div class="xl:col-span-2 bg-[#111827]/80 rounded-lg border border-white/10 p-4 min-h-[220px] flex flex-col">
          <h3 class="text-sm font-bold text-gray-300 mb-2 shrink-0">因子权重配置</h3>
          <div ref={weightRef} class="flex-1 min-h-0" />
        </div>

        {/* Row 1 Right: Factor Contribution Pie */}
        <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4 min-h-[220px] flex flex-col">
          <h3 class="text-sm font-bold text-gray-300 mb-2 shrink-0">因子贡献度</h3>
          <div ref={contribRef} class="flex-1 min-h-0" />
        </div>

        {/* Row 2: IC Time Series (full width) */}
        <div class="xl:col-span-3 bg-[#111827]/80 rounded-lg border border-white/10 p-4 min-h-[260px] flex flex-col">
          <div class="flex items-center justify-between mb-2 shrink-0">
            <h3 class="text-sm font-bold text-gray-300">IC 时间序列 (IC_ir 走势)</h3>
            <div class="flex gap-3 text-xs text-gray-400">
              <span class="flex items-center gap-1">
                <span class="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                IC
              </span>
              <span class="flex items-center gap-1">
                <span class="w-2 h-2 rounded-full bg-purple-500 inline-block" />
                Rank IC
              </span>
              <span class="text-gray-500">|IC| &gt; 0.03 显著</span>
            </div>
          </div>
          <div ref={icRef} class="flex-1 min-h-0" />
        </div>
      </div>
    </div>
  );
};
