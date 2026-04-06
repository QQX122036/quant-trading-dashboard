/**
 * BacktestAnalysis.tsx — 回测分析 (增强版)
 * 收益率曲线 + 回撤分析 + 月度收益热力图
 */
import { Component, createSignal, For, Show, onMount, onCleanup, createEffect } from 'solid-js';
import * as echarts from 'echarts';
import { YieldChart } from '../charts/YieldChart';
import { apiActions, apiState, setApiState } from '../../stores/apiStore';
import { BacktestConfig } from './BacktestConfig';
import { BacktestProgress } from './BacktestProgress';
import { useNavigate } from '@solidjs/router';

interface Strategy {
  id: string;
  name: string;
  description: string;
}

const STRATEGIES: Strategy[] = [
  { id: 'momentum', name: '动量策略', description: '追涨杀跌，基于近期收益率惯性' },
  { id: 'dual-ma', name: '双均线策略', description: 'MA5 上穿 MA20 买入，下穿卖出' },
  { id: 'boll', name: '布林带策略', description: '价格下破下轨买入，上穿上轨卖出' },
  { id: 'r-breaker', name: 'R-Breaker', description: '日内突破型策略' },
];

type ViewMode = 'config' | 'progress' | 'result';

export const BacktestAnalysis: Component = () => {
  const navigate = useNavigate();

  const [viewMode, setViewMode] = createSignal<ViewMode>('config');
  const [taskId, setTaskId] = createSignal<string>('');

  // Equity / Drawdown chart
  let equityRef: HTMLDivElement | undefined;
  let drawdownRef: HTMLDivElement | undefined;
  let monthlyRef: HTMLDivElement | undefined;
  let equityChart: echarts.ECharts | undefined;
  let drawdownChart: echarts.ECharts | undefined;
  let monthlyChart: echarts.ECharts | undefined;

  // ── Equity + Benchmark Chart ────────────────────────────────
  const buildEquityOption = (curve: Array<{ date: string; equity: number; benchmark: number }>): echarts.EChartsOption => {
    if (!curve.length) return { backgroundColor: 'transparent', series: [] };
    const initial = curve[0]?.equity || 1;
    const dates = curve.map((d) => d.date);
    const strategyReturns = curve.map((d) => ({ date: d.date, value: parseFloat(((d.equity / initial - 1) * 100).toFixed(4)) }));
    const benchReturns = curve.map((d) => ({ date: d.date, value: parseFloat(((d.benchmark / initial - 1) * 100).toFixed(4)) }));

    return {
      backgroundColor: 'transparent',
      grid: { left: '5%', right: '5%', top: '12%', bottom: '12%', containLabel: true },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1f2937',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#fff' },
        formatter: (params: unknown) => {
          const arr = params as Array<{ axisValue: string; seriesName: string; value: number; color: string }>;
          if (!arr?.length) return '';
          const date = `<div style="font-size:11px;color:#9CA3AF;margin-bottom:4px">${arr[0].axisValue}</div>`;
          return date + arr.map((p) => {
            const color = p.seriesName === '策略收益' ? '#3B82F6' : '#6B7280';
            const sign = p.value >= 0 ? '+' : '';
            return `<div style="display:flex;justify-content:space-between;gap:16px"><span style="color:${color}">${p.seriesName}</span><span style="color:${color}">${sign}${p.value}%</span></div>`;
          }).join('');
        },
      },
      legend: { data: ['策略收益', '基准收益'], textStyle: { color: '#9CA3AF' }, top: 0 },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: '#9CA3AF', fontSize: 10, formatter: (v: string) => v.slice(5) },
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: '#9CA3AF', fontSize: 10, formatter: (v: number) => `${v > 0 ? '+' : ''}${v}%` },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      series: [
        {
          name: '策略收益',
          type: 'line',
          smooth: true,
          data: strategyReturns.map((d) => d.value),
          lineStyle: { color: '#3B82F6', width: 2 },
          itemStyle: { color: '#3B82F6' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(59,130,246,0.3)' },
              { offset: 1, color: 'rgba(59,130,246,0)' },
            ]),
          },
        },
        {
          name: '基准收益',
          type: 'line',
          smooth: true,
          data: benchReturns.map((d) => d.value),
          lineStyle: { color: '#6B7280', width: 2, type: 'dashed' },
          itemStyle: { color: '#6B7280' },
        },
      ],
    };
  };

  // ── Drawdown Chart ─────────────────────────────────────────
  const buildDrawdownOption = (curve: Array<{ date: string; equity: number }>): echarts.EChartsOption => {
    if (!curve.length) return { backgroundColor: 'transparent', series: [] };

    let peak = curve[0]?.equity || 0;
    const drawdowns: number[] = [];
    const dates: string[] = [];
    let maxDD = 0;

    for (const bar of curve) {
      if (bar.equity > peak) peak = bar.equity;
      const dd = (bar.equity - peak) / peak * 100;
      if (dd < maxDD) maxDD = dd;
      drawdowns.push(parseFloat(dd.toFixed(4)));
      dates.push(bar.date);
    }

    // Find max drawdown duration
    let inDD = false;
    let ddStart = 0;
    let maxDuration = 0;
    let maxDDStart = 0;
    for (let i = 0; i < drawdowns.length; i++) {
      if (drawdowns[i] < 0 && !inDD) {
        inDD = true;
        ddStart = i;
      } else if (drawdowns[i] >= 0 && inDD) {
        inDD = false;
        const duration = i - ddStart;
        if (duration > maxDuration) {
          maxDuration = duration;
          maxDDStart = ddStart;
        }
      }
    }
    if (inDD) {
      const duration = drawdowns.length - ddStart;
      if (duration > maxDuration) {
        maxDuration = duration;
        maxDDStart = ddStart;
      }
    }

    return {
      backgroundColor: 'transparent',
      grid: { left: '5%', right: '5%', top: '12%', bottom: '12%', containLabel: true },
      title: {
        text: `最大回撤: ${maxDD.toFixed(2)}%  |  最长持续: ${maxDuration}天`,
        left: '5%',
        top: 0,
        textStyle: { color: '#EF4444', fontSize: 11, fontWeight: 'normal' },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1f2937',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#fff' },
        formatter: (params: unknown) => {
          const arr = params as Array<{ axisValue: string; value: number }>;
          if (!arr?.length) return '';
          const v = arr[0].value;
          return `<div style="font-size:11px">${arr[0].axisValue}<br/><span style="color:#EF4444">回撤: ${v.toFixed(2)}%</span></div>`;
        },
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: '#9CA3AF', fontSize: 10, formatter: (v: string) => v.slice(5) },
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: '#9CA3AF', fontSize: 10, formatter: (v: number) => `${v.toFixed(1)}%` },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
        max: 0,
      },
      series: [{
        type: 'line',
        smooth: true,
        data: drawdowns,
        lineStyle: { color: '#EF4444', width: 1.5 },
        itemStyle: { color: '#EF4444' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(239,68,68,0.3)' },
            { offset: 1, color: 'rgba(239,68,68,0)' },
          ]),
        },
        markArea: maxDuration > 0 ? {
          silent: true,
          data: [[{ xAxis: dates[maxDDStart], itemStyle: { color: 'rgba(239,68,68,0.08)' } }, { xAxis: dates[maxDDStart + maxDuration] }]],
        } : undefined,
      }],
    };
  };

  // ── Monthly Returns Heatmap ─────────────────────────────────
  const buildMonthlyOption = (curve: Array<{ date: string; equity: number }>): echarts.EChartsOption => {
    if (curve.length < 30) return { backgroundColor: 'transparent', series: [] };

    // Group by year-month
    const monthlyMap = new Map<string, { first: number; last: number }>();
    for (const bar of curve) {
      const ym = bar.date.slice(0, 7); // YYYY-MM
      if (!monthlyMap.has(ym)) {
        monthlyMap.set(ym, { first: bar.equity, last: bar.equity });
      } else {
        monthlyMap.get(ym)!.last = bar.equity;
      }
    }

    const months = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ym]) => ym);

    const years = [...new Set(months.map((m) => m.slice(0, 4)))];
    const monthLabels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

    const data: Array<{ value: [number, number, number]; tooltip: string }> = [];
    monthlyMap.forEach((v, ym) => {
      const ret = (v.last - v.first) / v.first * 100;
      const yearIdx = years.indexOf(ym.slice(0, 4));
      const monthIdx = parseInt(ym.slice(5, 7)) - 1;
      data.push({
        value: [monthIdx, yearIdx, parseFloat(ret.toFixed(2))],
        tooltip: `${ym}: ${ret >= 0 ? '+' : ''}${ret.toFixed(2)}%`,
      });
    });

    return {
      backgroundColor: 'transparent',
      grid: { left: '6%', right: '8%', top: '10%', bottom: '12%', containLabel: true },
      tooltip: {
        backgroundColor: '#1f2937',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#fff' },
        formatter: (p: { data: { tooltip: string } }) => p.data?.tooltip || '',
      },
      xAxis: {
        type: 'category',
        data: monthLabels,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: '#9CA3AF', fontSize: 10 },
        splitArea: { show: true, areaStyle: { color: ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.01)'] } },
      },
      yAxis: {
        type: 'category',
        data: years,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: '#9CA3AF', fontSize: 10 },
        splitArea: { show: true, areaStyle: { color: ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.01)'] } },
      },
      visualMap: {
        show: true,
        min: -20,
        max: 20,
        calculable: false,
        orient: 'vertical',
        right: 10,
        top: 'center',
        itemWidth: 12,
        itemHeight: 80,
        textStyle: { color: '#9CA3AF', fontSize: 9 },
        inRange: { color: ['#22C55E', '#6B7280', '#EF4444'] },
        formatter: (v: number) => `${v > 0 ? '+' : ''}${v}%`,
      },
      series: [{
        type: 'heatmap',
        data,
        label: {
          show: true,
          formatter: (p: { value: [number, number, number] }) => `${p.value[2] >= 0 ? '+' : ''}${p.value[2].toFixed(0)}`,
          fontSize: 9,
          color: '#fff',
        },
        itemStyle: { borderWidth: 2, borderColor: '#111827', borderRadius: 2 },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } },
      }],
    };
  };

  onMount(() => {
    equityChart = echarts.init(equityRef!, 'dark');
    drawdownChart = echarts.init(drawdownRef!, 'dark');
    monthlyChart = echarts.init(monthlyRef!, 'dark');

    const ro = new ResizeObserver(() => {
      equityChart?.resize();
      drawdownChart?.resize();
      monthlyChart?.resize();
    });
    [equityRef!, drawdownRef!, monthlyRef!].forEach((el) => ro.observe(el));

    onCleanup(() => {
      ro.disconnect();
      equityChart?.dispose();
      drawdownChart?.dispose();
      monthlyChart?.dispose();
    });
  });

  // Update charts when result changes
  createEffect(() => {
    const result = apiState.backtestResult;
    if (result && equityChart && drawdownChart && monthlyChart) {
      // Build equity curve from result if available
      const curve: Array<{ date: string; equity: number; benchmark: number }> = [];
      const equity = result.equity_curve as Array<{ date: string; equity: number; benchmark?: number }> | undefined;
      if (equity && Array.isArray(equity)) {
        curve.push(...equity.map((d) => ({
          date: d.date,
          equity: d.equity,
          benchmark: (d as { benchmark?: number }).benchmark ?? d.equity,
        })));
      }

      if (curve.length > 0) {
        equityChart.setOption(buildEquityOption(curve), true);
        drawdownChart.setOption(buildDrawdownOption(curve.map((d) => ({ date: d.date, equity: d.equity }))), true);
        monthlyChart.setOption(buildMonthlyOption(curve.map((d) => ({ date: d.date, equity: d.equity }))), true);
      }
    }
  });

  const handleRunStarted = (newTaskId: string) => {
    setTaskId(newTaskId);
    setViewMode('progress');
  };

  const handleComplete = () => {
    setViewMode('result');
  };

  const perf = () => apiState.backtestResult;
  const running = () => apiState.backtestRunning;
  const progress = () => apiState.backtestProgress;
  const error = () => apiState.backtestError;

  const perfCards = () => {
    const p = perf();
    if (!p) return [
      { label: '总收益率', value: '--', color: 'text-gray-400' },
      { label: '年化收益率', value: '--', color: 'text-gray-400' },
      { label: '夏普比率', value: '--', color: 'text-gray-400' },
      { label: '最大回撤', value: '--', color: 'text-gray-400' },
    ];
    return [
      { label: '总收益率', value: `${(p?.total_return ?? 0) >= 0 ? '+' : ''}${(p?.total_return ?? 0)}%`, color: (p?.total_return ?? 0) >= 0 ? 'text-[#EF4444]' : 'text-[#22C55E]' },
      { label: '年化收益率', value: `${(p?.annual_return ?? 0) >= 0 ? '+' : ''}${(p?.annual_return ?? 0)}%`, color: (p?.annual_return ?? 0) >= 0 ? 'text-[#EF4444]' : 'text-[#22C55E]' },
      { label: '夏普比率', value: String(p?.sharpe_ratio ?? 0), color: 'text-blue-400' },
      { label: '最大回撤', value: `${p?.max_drawdown ?? 0}%`, color: 'text-[#EF4444]' },
    ];
  };

  const extraCards = () => {
    const p = perf();
    if (!p) return [
      { label: '超额收益', value: '--', color: 'text-gray-400' },
      { label: '卡玛比率', value: '--', color: 'text-gray-400' },
      { label: '总交易次数', value: '--', color: 'text-gray-400' },
      { label: '胜率', value: '--', color: 'text-gray-400' },
    ];
    return [
      { label: '超额收益', value: `${(p?.excess_return ?? 0) >= 0 ? '+' : ''}${(p?.excess_return ?? 0)}%`, color: (p?.excess_return ?? 0) >= 0 ? 'text-[#EF4444]' : 'text-[#22C55E]' },
      { label: '卡玛比率', value: String(p?.calmar_ratio ?? 0), color: 'text-blue-400' },
      { label: '总交易次数', value: String(p?.total_trades ?? 0), color: 'text-gray-300' },
      { label: '盈亏比', value: String(p?.profit_loss_ratio ?? 0), color: 'text-gray-300' },
    ];
  };

  return (
    <div class="h-full flex flex-col p-4 gap-4 overflow-hidden">
      {/* Header */}
      <div class="flex items-center justify-between shrink-0">
        <h2 class="text-xl font-bold">回测分析</h2>
        <div class="flex gap-2">
          <Show when={viewMode() === 'result'}>
            <button
              class="px-4 py-2 text-sm rounded bg-white/10 hover:bg-white/20 transition-colors"
              onClick={() => setViewMode('config')}
            >
              ← 新回测
            </button>
          </Show>
        </div>
      </div>

      {/* Main */}
      <div class="flex-1 flex gap-4 min-h-0 overflow-hidden">
        {/* Left Panel — Config */}
        <Show when={viewMode() === 'config'}>
          <div class="w-80 shrink-0 overflow-y-auto">
            <BacktestConfig onRun={(cfg) => {
              // Task ID would come from the API response, handled via apiActions
            }} />
          </div>
          {/* Spacer when no config */}
          <div class="flex-1" />
        </Show>

        {/* Progress View */}
        <Show when={viewMode() === 'progress'}>
          <div class="flex-1 flex items-center justify-center">
            <div class="w-full max-w-md">
              <BacktestProgress
                taskId={taskId()}
                onComplete={handleComplete}
              />
            </div>
          </div>
        </Show>

        {/* Right Panel / Results */}
        <Show when={viewMode() !== 'progress'}>
          <div class="flex-1 flex flex-col gap-4 min-h-0 overflow-hidden">
            {/* Primary Metrics */}
            <div class="grid grid-cols-4 gap-4 shrink-0">
              <For each={perfCards()}>
                {(card) => (
                  <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4">
                    <div class="text-xs text-gray-400 mb-1">{card.label}</div>
                    <div class={`text-2xl font-bold tabular-nums ${card.color}`}>{card.value}</div>
                  </div>
                )}
              </For>
            </div>

            {/* Secondary Metrics */}
            <div class="grid grid-cols-4 gap-4 shrink-0">
              <For each={extraCards()}>
                {(card) => (
                  <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4">
                    <div class="text-xs text-gray-400 mb-1">{card.label}</div>
                    <div class={`text-xl font-bold tabular-nums ${card.color}`}>{card.value}</div>
                  </div>
                )}
              </For>
            </div>

            {/* Equity Curve */}
            <div class="flex-1 bg-[#111827]/80 rounded-lg border border-white/10 p-4 min-h-[240px] shrink-0">
              <h3 class="font-bold mb-2 text-sm text-gray-300">收益率曲线</h3>
              <div ref={equityRef} class="w-full flex-1" style="min-height:200px" />
            </div>

            {/* Drawdown + Monthly Heatmap */}
            <div class="grid grid-cols-2 gap-4 shrink-0" style="min-height:220px">
              {/* Drawdown */}
              <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4">
                <h3 class="font-bold mb-2 text-sm text-gray-300">回撤分析</h3>
                <div ref={drawdownRef} class="w-full" style="min-height:180px" />
              </div>
              {/* Monthly */}
              <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4">
                <h3 class="font-bold mb-2 text-sm text-gray-300">月度收益热力图</h3>
                <div ref={monthlyRef} class="w-full" style="min-height:180px" />
              </div>
            </div>

            {/* Summary Table */}
            <Show when={perf()}>
              <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4 shrink-0">
                <h3 class="font-bold mb-3 text-sm">回测概要</h3>
                <div class="grid grid-cols-5 gap-4 text-sm">
                  <div><div class="text-xs text-gray-400">标的</div><div class="font-mono mt-0.5">{perf()?.ts_code ?? ''}</div></div>
                  <div><div class="text-xs text-gray-400">策略</div><div class="mt-0.5">{perf()?.strategy_type ?? ''}</div></div>
                  <div><div class="text-xs text-gray-400">期初资金</div><div class="tabular-nums mt-0.5">{(perf()?.initial_capital ?? 0).toLocaleString()}</div></div>
                  <div><div class="text-xs text-gray-400">期末资金</div><div class="tabular-nums mt-0.5">{(perf()?.end_capital ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}</div></div>
                  <div><div class="text-xs text-gray-400">回测区间</div><div class="text-xs mt-0.5">{perf()?.start_date ?? ''} ~ {perf()?.end_date ?? ''}</div></div>
                </div>
              </div>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
};
