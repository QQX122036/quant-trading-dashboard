import { Component, createSignal, onMount, onCleanup, Show, For, createEffect } from 'solid-js';
import { apiState, setApiState } from '../../stores/apiStore';
import { runMultiFactorBacktest, getBacktestResult, getBacktestProgress } from '../../hooks/useApi';
import ec from '@/lib/echarts';
import type { EChartsType, EChartsCoreOption } from '@/lib/echarts';

const FACTOR_OPTIONS = [
  { key: 'momentum', label: '动量因子', defaultWeight: 0.25 },
  { key: 'volatility', label: '波动率因子', defaultWeight: 0.15 },
  { key: 'volume', label: '成交量因子', defaultWeight: 0.2 },
  { key: 'turnover', label: '换手率因子', defaultWeight: 0.15 },
  { key: 'reversal', label: '反转因子', defaultWeight: 0.15 },
  { key: 'size', label: '市值因子', defaultWeight: 0.1 },
];

const MOCK_FACTOR_WEIGHTS = [
  { name: 'momentum', weight: 0.25, color: '#6366F1' },
  { name: 'volatility', weight: 0.15, color: '#22C55E' },
  { name: 'volume', weight: 0.2, color: '#F59E0B' },
  { name: 'turnover', weight: 0.15, color: '#EC4899' },
  { name: 'reversal', weight: 0.15, color: '#06B6D4' },
  { name: 'size', weight: 0.1, color: '#F97316' },
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
  { name: 'momentum', value: 32.5, color: '#6366F1' },
  { name: 'volatility', value: 18.3, color: '#22C55E' },
  { name: 'volume', value: 22.7, color: '#F59E0B' },
  { name: 'turnover', value: 12.5, color: '#EC4899' },
  { name: 'reversal', value: 9.0, color: '#06B6D4' },
  { name: 'size', value: 5.0, color: '#F97316' },
];

interface FactorBacktestResult {
  factor_weights?: Array<{ name: string; weight: number; color?: string }>;
  ic_series?: Array<{ date: string; ic: number; ic_rank?: number }>;
  factor_contributions?: Array<{ name: string; value: number; color?: string }>;
  total_return?: number;
  annual_return?: number;
  sharpe_ratio?: number;
  total_trades?: number;
  total_turnover?: number;
  initial_capital?: number;
  final_capital?: number;
  period_results?: Array<{ date: string; capital: number; period_pnl: number; turnover: number }>;
}

export const MultiStrategyChart: Component = () => {
  let weightRef: HTMLDivElement | undefined;
  let icRef: HTMLDivElement | undefined;
  let contribRef: HTMLDivElement | undefined;
  let equityRef: HTMLDivElement | undefined;
  let weightChart: EChartsType | undefined;
  let icChart: EChartsType | undefined;
  let contribChart: EChartsType | undefined;
  let equityChart: EChartsType | undefined;

  const [result, setResult] = createSignal<FactorBacktestResult | null>(null);
  const [_loading] = createSignal(false);
  const [useMock, setUseMock] = createSignal(true);
  const [running, setRunning] = createSignal(false);
  const [progress, setProgress] = createSignal(0);
  const [startDate, setStartDate] = createSignal('2024-01-01');
  const [endDate, setEndDate] = createSignal('2025-01-01');
  const [topN, setTopN] = createSignal(10);
  const [rebalanceDays, setRebalanceDays] = createSignal(20);
  const [factorWeights, setFactorWeights] = createSignal<Record<string, number>>(
    Object.fromEntries(FACTOR_OPTIONS.map((f) => [f.key, f.defaultWeight]))
  );

  const buildWeightOption = (
    data: Array<{ name: string; weight: number; color: string }>
  ): EChartsCoreOption => ({
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
        return `<div style="font-size:12px"><div style="font-weight:bold;margin-bottom:4px">${item.name}</div><div style="color:${item.color}">权重: <strong>${(item.value * 100).toFixed(1)}%</strong></div></div>`;
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
            color: new ec.graphic.LinearGradient(0, 0, 1, 0, [
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

  const buildICOption = (
    data: Array<{ date: string; ic: number; ic_rank?: number }>
  ): EChartsCoreOption => {
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
                return `<div style="display:flex;justify-content:space-between;gap:16px"><span style="color:${p.color}">${p.seriesName}</span><span style="color:${p.color}">${sign}${p.value.toFixed(4)}</span></div>`;
              })
              .join('')
          );
        },
      },
      legend: { data: ['IC', 'Rank IC'], textStyle: { color: '#9CA3AF', fontSize: 10 }, top: 0 },
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
            color: new ec.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(59,130,246,0.25)' },
              { offset: 1, color: 'rgba(59,130,246,0)' },
            ]),
          },
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
        {
          name: 'Rank IC',
          type: 'line',
          smooth: true,
          data: rankValues,
          lineStyle: { width: 1.5, type: 'dashed', color: '#8B5CF6' },
          itemStyle: { color: '#8B5CF6' },
        },
      ],
    } as EChartsCoreOption;
  };

  const buildContribOption = (
    data: Array<{ name: string; value: number; color: string }>
  ): EChartsCoreOption => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: '#1f2937',
      borderColor: 'rgba(255,255,255,0.1)',
      textStyle: { color: '#fff' },
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number; color: string; percent: number };
        return `<div style="font-size:12px"><div style="color:${p.color};font-weight:bold">${p.name}</div><div>贡献: <strong>${p.value.toFixed(1)}%</strong></div></div>`;
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
        itemStyle: { borderRadius: 4, borderColor: '#0A0E17', borderWidth: 2 },
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
        data: data.map((d) => ({ name: d.name, value: d.value, itemStyle: { color: d.color } })),
      },
    ],
  });

  const buildEquityOption = (
    periods: Array<{ date: string; capital: number }>
  ): EChartsCoreOption => {
    if (!periods.length) return { backgroundColor: 'transparent', series: [] };
    const dates = periods.map((p) => p.date.slice(0, 10));
    const capitals = periods.map((p) => p.capital);
    const initial = periods[0]?.capital ?? 1000000;
    const returns = capitals.map((c) => parseFloat(((c / initial - 1) * 100).toFixed(2)));
    return {
      backgroundColor: 'transparent',
      grid: { left: '5%', right: '5%', top: '12%', bottom: '12%', containLabel: true },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1f2937',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#fff' },
        formatter: (params: unknown) => {
          const arr = params as Array<{ axisValue: string; value: number }>;
          if (!arr?.length) return '';
          return `<div style="font-size:11px">${arr[0].axisValue}<br/>累计收益: ${arr[0].value >= 0 ? '+' : ''}${arr[0].value}%</div>`;
        },
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: '#9CA3AF', fontSize: 9, formatter: (v: string) => v.slice(5) },
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: {
          color: '#9CA3AF',
          fontSize: 10,
          formatter: (v: number) => `${v > 0 ? '+' : ''}${v}%`,
        },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      series: [
        {
          type: 'line',
          smooth: true,
          data: returns,
          lineStyle: { width: 2, color: '#22C55E' },
          itemStyle: { color: '#22C55E' },
          areaStyle: {
            color: new ec.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(34,197,94,0.25)' },
              { offset: 1, color: 'rgba(34,197,94,0)' },
            ]),
          },
        },
      ],
    };
  };

  const pollForResult = async (taskId: string, maxAttempts = 120) => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const statusRes = await getBacktestProgress(taskId);
        const statusData = (statusRes as any)?.data || statusRes;
        const prog = statusData?.progress ?? 0;
        setProgress(prog);
        if (statusData?.status === 'completed') {
          const resultRes = await getBacktestResult(taskId);
          const data = (resultRes as any)?.data || resultRes;
          return data;
        }
        if (statusData?.status === 'failed') {
          throw new Error(statusData?.message || '多因子回测失败');
        }
      } catch (e: any) {
        if (e?.message?.includes('失败')) throw e;
      }
    }
    throw new Error('回测超时');
  };

  const handleRun = async () => {
    setRunning(true);
    setProgress(0);
    try {
      const res = await runMultiFactorBacktest({
        start_date: startDate(),
        end_date: endDate(),
        factors: FACTOR_OPTIONS.map((f) => f.key),
        factor_weights: factorWeights(),
        top_n: topN(),
        rebalance_days: rebalanceDays(),
        initial_capital: 1000000,
      });
      const taskId = (res as any)?.data?.task_id || (res as any)?.task_id;
      if (!taskId) throw new Error('未获取到 task_id');

      const data = await pollForResult(taskId);
      if (data) {
        setResult(data as FactorBacktestResult);
        setUseMock(false);
        setApiState('backtestResult', data as any);
      }
    } catch (e) {
      console.error('[MultiStrategyChart] 回测失败:', e);
      setUseMock(true);
      setResult({
        factor_weights: MOCK_FACTOR_WEIGHTS,
        ic_series: MOCK_IC_SERIES,
        factor_contributions: MOCK_CONTRIBUTIONS,
      });
    } finally {
      setRunning(false);
    }
  };

  const loadFromStore = () => {
    const stored = apiState.backtestResult;
    if (stored && (stored as FactorBacktestResult).factor_weights) {
      setResult(stored as FactorBacktestResult);
      setUseMock(false);
      return true;
    }
    return false;
  };

  const updateCharts = () => {
    const r = result();
    if (!r) return;
    const defaultColors = ['#6366F1', '#22C55E', '#F59E0B', '#EC4899', '#06B6D4', '#F97316'];
    if (r.factor_weights && weightChart) {
      weightChart.setOption(
        buildWeightOption(
          r.factor_weights.map((d, i) => ({
            ...d,
            color: d.color ?? defaultColors[i % defaultColors.length],
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
            color: d.color ?? defaultColors[i % defaultColors.length],
          }))
        ),
        true
      );
    }
    if (r.period_results && equityChart) {
      equityChart.setOption(
        buildEquityOption(r.period_results as Array<{ date: string; capital: number }>),
        true
      );
    }
  };

  const initChart = (ref: HTMLDivElement | undefined): EChartsType | undefined => {
    if (ref) {
      try {
        return ec.init(ref, 'dark');
      } catch (e) {
        console.warn('[MultiStrategyChart] init chart failed:', e);
        return undefined;
      }
    }
    return undefined;
  };

  onMount(() => {
    weightChart = initChart(weightRef);
    icChart = initChart(icRef);
    contribChart = initChart(contribRef);
    equityChart = initChart(equityRef);

    const ro = new ResizeObserver(() => {
      weightChart?.resize();
      icChart?.resize();
      contribChart?.resize();
      equityChart?.resize();
    });
    [weightRef, icRef, contribRef, equityRef].filter(Boolean).forEach((el) => ro.observe(el!));

    if (!loadFromStore()) {
      setUseMock(true);
      setResult({
        factor_weights: MOCK_FACTOR_WEIGHTS,
        ic_series: MOCK_IC_SERIES,
        factor_contributions: MOCK_CONTRIBUTIONS,
      });
    }

    onCleanup(() => {
      ro.disconnect();
      weightChart?.dispose();
      icChart?.dispose();
      contribChart?.dispose();
      equityChart?.dispose();
    });
  });

  createEffect(() => {
    const r = result();
    if (!r) return;
    if (!equityChart && equityRef) {
      equityChart = initChart(equityRef);
    }
    updateCharts();
  });

  const r = () => result();

  return (
    <div class="flex flex-col gap-4 h-full p-4 overflow-hidden">
      <div class="flex items-center justify-between shrink-0">
        <div class="flex items-center gap-3">
          <h2 class="text-lg font-bold">多因子策略</h2>
          <Show when={useMock()}>
            <span class="text-xs px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
              演示数据
            </span>
          </Show>
          <Show when={!useMock() && r()}>
            <span class="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">
              收益: {r()?.total_return?.toFixed(2) ?? 0}% | 夏普:{' '}
              {r()?.sharpe_ratio?.toFixed(2) ?? 0}
            </span>
          </Show>
        </div>
        <button
          class={`px-3 py-1.5 rounded text-sm transition-colors ${running() ? 'bg-gray-600 cursor-wait' : 'bg-blue-600 hover:bg-blue-500'}`}
          onClick={handleRun}
          disabled={running()}
        >
          {running() ? `运行中 ${progress().toFixed(0)}%...` : '🚀 运行回测'}
        </button>
      </div>

      {/* Config Bar */}
      <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-3 shrink-0">
        <div class="flex flex-wrap gap-4 items-end">
          <div>
            <label class="block text-xs text-gray-400 mb-1">开始日期</label>
            <input
              type="date"
              class="bg-[#0A0E17] border border-white/10 rounded px-2 py-1 text-xs"
              value={startDate()}
              onInput={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label class="block text-xs text-gray-400 mb-1">结束日期</label>
            <input
              type="date"
              class="bg-[#0A0E17] border border-white/10 rounded px-2 py-1 text-xs"
              value={endDate()}
              onInput={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div>
            <label class="block text-xs text-gray-400 mb-1">持仓数</label>
            <input
              type="number"
              class="bg-[#0A0E17] border border-white/10 rounded px-2 py-1 text-xs w-16"
              value={topN()}
              onInput={(e) => setTopN(Number(e.target.value))}
            />
          </div>
          <div>
            <label class="block text-xs text-gray-400 mb-1">调仓周期(天)</label>
            <input
              type="number"
              class="bg-[#0A0E17] border border-white/10 rounded px-2 py-1 text-xs w-20"
              value={rebalanceDays()}
              onInput={(e) => setRebalanceDays(Number(e.target.value))}
            />
          </div>
          <div class="flex-1">
            <label class="block text-xs text-gray-400 mb-1">因子权重</label>
            <div class="flex flex-wrap gap-2">
              <For each={FACTOR_OPTIONS}>
                {(f) => (
                  <div class="flex items-center gap-1">
                    <span class="text-xs text-gray-400">{f.label}</span>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      class="bg-[#0A0E17] border border-white/10 rounded px-1 py-0.5 text-xs w-14"
                      value={factorWeights()[f.key] ?? f.defaultWeight}
                      onInput={(e) =>
                        setFactorWeights((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))
                      }
                    />
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <Show when={!useMock() && r()}>
        <div class="grid grid-cols-2 sm:grid-cols-6 gap-3 shrink-0">
          <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-3">
            <div class="text-xs text-gray-400">总收益</div>
            <div
              class={`text-lg font-bold ${(r()?.total_return ?? 0) >= 0 ? 'text-red-400' : 'text-green-400'}`}
            >
              {r()?.total_return?.toFixed(2) ?? 0}%
            </div>
          </div>
          <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-3">
            <div class="text-xs text-gray-400">年化收益</div>
            <div
              class={`text-lg font-bold ${(r()?.annual_return ?? 0) >= 0 ? 'text-red-400' : 'text-green-400'}`}
            >
              {r()?.annual_return?.toFixed(2) ?? 0}%
            </div>
          </div>
          <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-3">
            <div class="text-xs text-gray-400">夏普比率</div>
            <div class="text-lg font-bold text-blue-400">{r()?.sharpe_ratio?.toFixed(2) ?? 0}</div>
          </div>
          <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-3">
            <div class="text-xs text-gray-400">调仓次数</div>
            <div class="text-lg font-bold text-gray-200">{r()?.total_trades ?? 0}</div>
          </div>
          <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-3">
            <div class="text-xs text-gray-400">换手股票数</div>
            <div class="text-lg font-bold text-orange-400">{r()?.total_turnover ?? 0}</div>
          </div>
          <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-3">
            <div class="text-xs text-gray-400">期末资金</div>
            <div class="text-lg font-bold text-gray-200">
              {((r()?.final_capital ?? 0) / 10000).toFixed(1)}万
            </div>
          </div>
        </div>
      </Show>

      {/* Charts Grid */}
      <div class="flex-1 grid grid-cols-1 xl:grid-cols-3 gap-4 min-h-0 overflow-hidden">
        <div class="xl:col-span-2 bg-[#111827]/80 rounded-lg border border-white/10 p-4 min-h-[220px] flex flex-col">
          <h3 class="text-sm font-bold text-gray-300 mb-2 shrink-0">因子权重配置</h3>
          <div ref={weightRef} class="flex-1 min-h-0" />
        </div>
        <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4 min-h-[220px] flex flex-col">
          <h3 class="text-sm font-bold text-gray-300 mb-2 shrink-0">因子贡献度</h3>
          <div ref={contribRef} class="flex-1 min-h-0" />
        </div>
        <div class="xl:col-span-3 bg-[#111827]/80 rounded-lg border border-white/10 p-4 min-h-[200px] flex flex-col">
          <div class="flex items-center justify-between mb-2 shrink-0">
            <h3 class="text-sm font-bold text-gray-300">IC 时间序列</h3>
            <div class="flex gap-3 text-xs text-gray-400">
              <span class="flex items-center gap-1">
                <span class="w-2 h-2 rounded-full bg-blue-500 inline-block" /> IC
              </span>
              <span class="flex items-center gap-1">
                <span class="w-2 h-2 rounded-full bg-purple-500 inline-block" /> Rank IC
              </span>
            </div>
          </div>
          <div ref={icRef} class="flex-1 min-h-0" />
        </div>
        <Show when={!useMock() && r()?.period_results}>
          <div class="xl:col-span-3 bg-[#111827]/80 rounded-lg border border-white/10 p-4 min-h-[180px] flex flex-col">
            <h3 class="text-sm font-bold text-gray-300 mb-2 shrink-0">组合净值曲线</h3>
            <div ref={equityRef} class="flex-1 min-h-0" />
          </div>
        </Show>
      </div>
    </div>
  );
};
