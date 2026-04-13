/**
 * BacktestReport.tsx — 回测报告页面
 * 支持一键导出PDF
 */
import ec from '@/lib/echarts';
import type { EChartsType, EChartsCoreOption } from '@/lib/echarts';
import { Component, createSignal, Show, onMount, onCleanup, createEffect, For } from 'solid-js';
import { logger } from '../../lib/logger';
import { exportBacktestReport, type BacktestReportData } from '../../utils/pdfExport';

interface Trade {
  date: string;
  stock: string;
  direction: string;
  price: number;
  volume: number;
  pnl?: number;
}

interface BacktestResult {
  total_return?: number;
  annual_return?: number;
  sharpe_ratio?: number;
  max_drawdown?: number;
  calmar_ratio?: number;
  win_rate?: number;
  total_trades?: number;
  profit_loss_ratio?: number;
  excess_return?: number;
  initial_capital?: number;
  end_capital?: number;
  ts_code?: string;
  strategy_type?: string;
  start_date?: string;
  end_date?: string;
  equity_curve?: Array<{ date: string; equity: number; benchmark?: number }>;
  trades?: Trade[];
}

interface BacktestReportProps {
  result: BacktestResult | null;
  strategyName?: string;
  loading?: boolean;
}

// ── ECharts Options Builders ─────────────────────────────

function buildEquityOption(
  curve: Array<{ date: string; equity: number; benchmark?: number }>
): EChartsCoreOption {
  if (!curve.length) return { backgroundColor: 'transparent', series: [] };
  const initial = curve[0]?.equity || 1;
  const dates = curve.map((d) => d.date);
  const strategyReturns = curve.map((d) => ({
    value: parseFloat(((d.equity / initial - 1) * 100).toFixed(2)),
  }));
  // @ts-ignore
  const benchReturns = curve.map((d) => ({
    value: parseFloat(((Number(d.benchmark ?? d.equity) / initial - 1) * 100).toFixed(2)),
  }));

  return {
    backgroundColor: 'transparent',
    grid: { left: '5%', right: '5%', top: '12%', bottom: '12%', containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1f2937',
      borderColor: 'rgba(255,255,255,0.1)',
      textStyle: { color: '#fff' },
      formatter: (params: unknown) => {
        const arr = params as Array<{ axisValue: string; seriesName: string; value: number }>;
        if (!arr?.length) return '';
        const date = `<div style="font-size:11px;color:#9CA3AF;margin-bottom:4px">${arr[0].axisValue}</div>`;
        return (
          date +
          arr
            .map((p) => {
              const color = p.seriesName === '策略收益' ? '#3B82F6' : '#6B7280';
              return `<div style="display:flex;justify-content:space-between;gap:16px"><span style="color:${color}">${p.seriesName}</span><span style="color:${color}">${p.value >= 0 ? '+' : ''}${p.value}%</span></div>`;
            })
            .join('')
        );
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
      axisLabel: {
        color: '#9CA3AF',
        fontSize: 10,
        formatter: (v: number) => `${v >= 0 ? '+' : ''}${v}%`,
      },
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
          color: new ec.graphic.LinearGradient(0, 0, 0, 1, [
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
  } as EChartsCoreOption;
}

function buildDrawdownOption(curve: Array<{ date: string; equity: number }>): EChartsCoreOption {
  if (!curve.length) return { backgroundColor: 'transparent', series: [] };
  let peak = curve[0]?.equity || 0;
  const drawdowns: number[] = [];
  const dates: string[] = [];
  let maxDD = 0;
  let maxDuration = 0;
  let maxDDStart = 0;

  for (const bar of curve) {
    if (bar.equity > peak) peak = bar.equity;
    const dd = ((bar.equity - peak) / peak) * 100;
    if (dd < maxDD) maxDD = dd;
    drawdowns.push(parseFloat(dd.toFixed(4)));
    dates.push(bar.date);
  }

  let inDD = false,
    ddStart = 0;
  for (let i = 0; i < drawdowns.length; i++) {
    if (drawdowns[i] < 0 && !inDD) {
      inDD = true;
      ddStart = i;
    } else if (drawdowns[i] >= 0 && inDD) {
      inDD = false;
      const dur = i - ddStart;
      if (dur > maxDuration) {
        maxDuration = dur;
        maxDDStart = ddStart;
      }
    }
  }

  return {
    backgroundColor: 'transparent',
    grid: { left: '5%', right: '5%', top: '16%', bottom: '12%', containLabel: true },
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
        return arr?.length
          ? `<div style="font-size:11px">${arr[0].axisValue}<br/><span style="color:#EF4444">回撤: ${arr[0].value.toFixed(2)}%</span></div>`
          : '';
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
    series: [
      {
        type: 'line',
        smooth: true,
        data: drawdowns,
        lineStyle: { color: '#EF4444', width: 1.5 },
        itemStyle: { color: '#EF4444' },
        areaStyle: {
          color: new ec.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(239,68,68,0.3)' },
            { offset: 1, color: 'rgba(239,68,68,0)' },
          ]),
        },
        markArea:
          maxDuration > 0
            ? {
                silent: true,
                data: [
                  [
                    { xAxis: dates[maxDDStart], itemStyle: { color: 'rgba(239,68,68,0.08)' } },
                    { xAxis: dates[Math.min(maxDDStart + maxDuration, dates.length - 1)] },
                  ],
                ],
              }
            : undefined,
      },
    ],
  } as EChartsCoreOption;
}

function buildMonthlyOption(curve: Array<{ date: string; equity: number }>): EChartsCoreOption {
  if (curve.length < 30) return { backgroundColor: 'transparent', series: [] };

  const monthlyMap = new Map<string, { first: number; last: number }>();
  for (const bar of curve) {
    const ym = bar.date.slice(0, 7);
    if (!monthlyMap.has(ym)) monthlyMap.set(ym, { first: bar.equity, last: bar.equity });
    else monthlyMap.get(ym)!.last = bar.equity;
  }

  const months = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ym]) => ym);
  const years = [...new Set(months.map((m) => m.slice(0, 4)))];
  const monthLabels = [
    '1月',
    '2月',
    '3月',
    '4月',
    '5月',
    '6月',
    '7月',
    '8月',
    '9月',
    '10月',
    '11月',
    '12月',
  ];

  const data: Array<{ value: [number, number, number]; tooltip: string }> = [];
  monthlyMap.forEach((v, ym) => {
    const ret = ((v.last - v.first) / v.first) * 100;
    data.push({
      value: [
        parseInt(ym.slice(5, 7)) - 1,
        years.indexOf(ym.slice(0, 4)),
        parseFloat(ret.toFixed(2)),
      ],
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
      formatter: (p: unknown) => (p as { data?: { tooltip?: string } })?.data?.tooltip || '',
    },
    xAxis: {
      type: 'category',
      data: monthLabels,
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      axisLabel: { color: '#9CA3AF', fontSize: 10 },
      splitArea: {
        show: true,
        areaStyle: { color: ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.01)'] },
      },
    },
    yAxis: {
      type: 'category',
      data: years,
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      axisLabel: { color: '#9CA3AF', fontSize: 10 },
      splitArea: {
        show: true,
        areaStyle: { color: ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.01)'] },
      },
    },
    // @ts-ignore
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
    // @ts-ignore
    series: [
      {
        type: 'heatmap',
        data,
        label: {
          show: true,
          formatter: (p: { value: [number, number, number] }) =>
            `${p.value[2] >= 0 ? '+' : ''}${p.value[2].toFixed(0)}`,
          fontSize: 9,
          color: '#fff',
        },
        itemStyle: { borderWidth: 2, borderColor: '#111827', borderRadius: 2 },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } },
      },
    ],
  } as EChartsCoreOption;
}

// ── Component ─────────────────────────────────────────────

export const BacktestReport: Component<BacktestReportProps> = (props) => {
  let equityRef: HTMLDivElement | undefined;
  let drawdownRef: HTMLDivElement | undefined;
  let monthlyRef: HTMLDivElement | undefined;
  let equityChart: EChartsType | undefined;
  let drawdownChart: EChartsType | undefined;
  let monthlyChart: EChartsType | undefined;

  const [exporting, setExporting] = createSignal(false);

  const result = () => props.result;

  const buildCurve = () => {
    const r = result();
    if (!r?.equity_curve?.length) return [];
    return r.equity_curve.map((d) => ({
      date: d.date,
      equity: d.equity,
      benchmark: d.benchmark ?? d.equity,
    }));
  };

  const curve = () => buildCurve();

  onMount(async () => {
    equityChart = ec.init(equityRef!, 'dark');
    drawdownChart = ec.init(drawdownRef!, 'dark');
    monthlyChart = ec.init(monthlyRef!, 'dark');

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

  createEffect(() => {
    const c = curve();
    if (!c.length || !equityChart || !drawdownChart || !monthlyChart) return;
    equityChart.setOption(
      buildEquityOption(c as Array<{ date: string; equity: number; benchmark?: number }>),
      true
    );
    drawdownChart.setOption(
      buildDrawdownOption(c as Array<{ date: string; equity: number }>),
      true
    );
    monthlyChart.setOption(buildMonthlyOption(c as Array<{ date: string; equity: number }>), true);
  });

  const handleExportPdf = async () => {
    if (!result() || !equityChart || !drawdownChart || !monthlyChart) return;
    setExporting(true);
    try {
      const r = result()!;
      const _c = curve();
      const reportData: BacktestReportData = {
        strategyName: props.strategyName || r.strategy_type || '策略',
        backtestPeriod: `${r.start_date ?? ''} ~ ${r.end_date ?? ''}`,
        sharpeRatio: r.sharpe_ratio ?? 0,
        maxDrawdown: r.max_drawdown ?? 0,
        annualReturn: r.annual_return ?? 0,
        totalReturn: r.total_return ?? 0,
        calmarRatio: r.calmar_ratio ?? 0,
        winRate: r.win_rate ?? 0,
        totalTrades: r.total_trades ?? 0,
        profitLossRatio: r.profit_loss_ratio ?? 0,
        excessReturn: r.excess_return ?? 0,
        initialCapital: r.initial_capital ?? 0,
        endCapital: r.end_capital ?? 0,
        tsCode: r.ts_code ?? '',
        strategyType: r.strategy_type ?? '',
        trades: (r.trades as Trade[]) ?? [],
      };

      await exportBacktestReport(
        {
          equityChart,
          drawdownChart,
          monthlyChart,
        },
        reportData,
        `backtest_${r.strategy_type ?? 'report'}_${new Date().toISOString().slice(0, 10)}`
      );
    } catch (e) {
      logger.error('PDF export failed', { error: e });
    } finally {
      setExporting(false);
    }
  };

  const r = () => result();
  const p = (v?: number) => v ?? 0;

  const metricCards = () => {
    const res = r();
    if (!res) return [];
    return [
      {
        label: '总收益率',
        value: `${p(res.total_return) >= 0 ? '+' : ''}${p(res.total_return).toFixed(2)}%`,
        color: p(res.total_return) >= 0 ? 'text-[#3B82F6]' : 'text-[#22C55E]',
      },
      {
        label: '年化收益率',
        value: `${p(res.annual_return) >= 0 ? '+' : ''}${p(res.annual_return).toFixed(2)}%`,
        color: p(res.annual_return) >= 0 ? 'text-[#3B82F6]' : 'text-[#22C55E]',
      },
      { label: '夏普比率', value: p(res.sharpe_ratio).toFixed(2), color: 'text-blue-400' },
      { label: '最大回撤', value: `${p(res.max_drawdown).toFixed(2)}%`, color: 'text-[#EF4444]' },
    ];
  };

  const extraCards = () => {
    const res = r();
    if (!res) return [];
    return [
      {
        label: '超额收益',
        value: `${p(res.excess_return) >= 0 ? '+' : ''}${p(res.excess_return).toFixed(2)}%`,
        color: p(res.excess_return) >= 0 ? 'text-[#3B82F6]' : 'text-[#22C55E]',
      },
      { label: '卡玛比率', value: p(res.calmar_ratio).toFixed(2), color: 'text-blue-400' },
      { label: '总交易次数', value: String(res.total_trades ?? 0), color: 'text-gray-300' },
      { label: '胜率', value: `${(p(res.win_rate) * 100).toFixed(1)}%`, color: 'text-gray-300' },
    ];
  };

  return (
    <div class="flex flex-col h-full" id="backtest-report">
      {/* ── Toolbar ── */}
      <div class="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <h2 class="text-lg font-bold">回测报告</h2>
        <div class="flex items-center gap-3">
          <span class="text-xs text-gray-500">
            {r() ? `${r()?.start_date ?? ''} ~ ${r()?.end_date ?? ''}` : '暂无数据'}
          </span>
          <button
            onClick={handleExportPdf}
            disabled={!r() || exporting()}
            class="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            {exporting() ? '导出中...' : '导出PDF'}
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <Show
          when={r()}
          fallback={
            <div class="flex-1 flex items-center justify-center text-gray-500">
              <div class="text-center">
                <svg
                  class="w-16 h-16 mx-auto mb-4 opacity-20"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p>暂无回测数据</p>
              </div>
            </div>
          }
        >
          {/* Primary Metrics */}
          <div class="grid grid-cols-4 gap-4 shrink-0">
            <For each={metricCards()}>
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
          <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4 shrink-0">
            <h3 class="font-bold mb-2 text-sm text-gray-300">收益率曲线</h3>
            <div ref={equityRef} class="w-full" style={{ height: '220px' }} />
          </div>

          {/* Drawdown + Monthly */}
          <div class="grid grid-cols-2 gap-4 shrink-0">
            <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4">
              <h3 class="font-bold mb-2 text-sm text-gray-300">回撤分析</h3>
              <div ref={drawdownRef} class="w-full" style={{ height: '200px' }} />
            </div>
            <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4">
              <h3 class="font-bold mb-2 text-sm text-gray-300">月度收益热力图</h3>
              <div ref={monthlyRef} class="w-full" style={{ height: '200px' }} />
            </div>
          </div>

          {/* Summary */}
          <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4 shrink-0">
            <h3 class="font-bold mb-3 text-sm">回测概要</h3>
            <div class="grid grid-cols-5 gap-4 text-sm">
              <div>
                <div class="text-xs text-gray-400">标的</div>
                <div class="font-mono mt-0.5">{r()?.ts_code ?? ''}</div>
              </div>
              <div>
                <div class="text-xs text-gray-400">策略</div>
                <div class="mt-0.5">{r()?.strategy_type ?? ''}</div>
              </div>
              <div>
                <div class="text-xs text-gray-400">期初资金</div>
                <div class="tabular-nums mt-0.5">
                  {(r()?.initial_capital ?? 0).toLocaleString()}
                </div>
              </div>
              <div>
                <div class="text-xs text-gray-400">期末资金</div>
                <div class="tabular-nums mt-0.5">
                  {(r()?.end_capital ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <div class="text-xs text-gray-400">回测区间</div>
                <div class="text-xs mt-0.5">
                  {r()?.start_date ?? ''} ~ {r()?.end_date ?? ''}
                </div>
              </div>
            </div>
          </div>

          {/* Trade Details */}
          <Show when={r()?.trades?.length}>
            <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4 shrink-0">
              <h3 class="font-bold mb-3 text-sm">交易明细</h3>
              <div class="overflow-x-auto">
                <table class="w-full text-xs">
                  <thead>
                    <tr class="text-gray-400 border-b border-white/10">
                      <th class="text-left py-2 pr-4">时间</th>
                      <th class="text-left py-2 pr-4">标的</th>
                      <th class="text-left py-2 pr-4">方向</th>
                      <th class="text-right py-2 pr-4">价格</th>
                      <th class="text-right py-2 pr-4">数量</th>
                      <th class="text-right py-2">盈亏</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={(r()!.trades ?? []).slice(0, 30)}>
                      {(t) => (
                        <tr class="border-b border-white/5 hover:bg-white/5">
                          <td class="py-2 pr-4 text-gray-400">{t.date}</td>
                          <td class="py-2 pr-4 font-mono">{t.stock}</td>
                          <td
                            class={`py-2 pr-4 ${t.direction === '买入' || t.direction === 'long' ? 'text-[#EF4444]' : 'text-[#22C55E]'}`}
                          >
                            {t.direction}
                          </td>
                          <td class="py-2 pr-4 text-right tabular-nums">{t.price.toFixed(2)}</td>
                          <td class="py-2 pr-4 text-right tabular-nums">{t.volume}</td>
                          <td
                            class={`py-2 text-right tabular-nums ${t.pnl !== undefined ? (t.pnl >= 0 ? 'text-[#3B82F6]' : 'text-[#22C55E]') : 'text-gray-600'}`}
                          >
                            {t.pnl !== undefined
                              ? `${t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}`
                              : '--'}
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
                <Show when={(r()!.trades?.length ?? 0) > 30}>
                  <div class="text-xs text-gray-500 mt-2">
                    显示前30条，共 {r()!.trades?.length} 条
                  </div>
                </Show>
              </div>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
};
