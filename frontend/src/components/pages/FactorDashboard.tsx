/**
 * FactorDashboard.tsx — 因子有效性看板
 * IC时间序列折线图、IR柱状图、相关性热力图
 */
import { Component, createSignal, onMount, onCleanup, _For, Show } from 'solid-js';
import {
  fetchFactorIC,
  fetchFactorIR,
  fetchFactorCorrelation,
  type FactorICItem,
  type FactorIRItem,
  type FactorCorrelationItem,
} from '../../hooks/useApi';

interface FactorDashboardProps {
  tsCode?: string;
}

export const FactorDashboard: Component<FactorDashboardProps> = (props) => {
  let icRef: HTMLDivElement | undefined;
  let irRef: HTMLDivElement | undefined;
  let corrRef: HTMLDivElement | undefined;
  let icChart: echarts.ECharts | undefined;
  let irChart: echarts.ECharts | undefined;
  let corrChart: echarts.ECharts | undefined;

  const [tsCode, setTsCode] = createSignal(props.tsCode || '600519.SH');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const [icData, setIcData] = createSignal<FactorICItem[]>([]);
  const [irData, setIrData] = createSignal<FactorIRItem[]>([]);
  const [corrData, setCorrData] = createSignal<FactorCorrelationItem[]>([]);

  const IC_THRESHOLD = 0.03;

  // ── IC Chart ────────────────────────────────────────────────
  const buildICOption = (data: FactorICItem[]): echarts.EChartsCoreOption => {
    const dates = data.map((d) => d.date);
    const icValues = data.map((d) => d.ic);
    const rankIcValues = data.map((d) => d.ic_rank);

    return {
      backgroundColor: 'transparent',
      grid: { left: '6%', right: '6%', top: '15%', bottom: '12%', containLabel: true },
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
                const color = p.value >= 0 ? '#3B82F6' : '#EF4444';
                const sign = p.value >= 0 ? '+' : '';
                return `<div style="display:flex;justify-content:space-between;gap:16px"><span style="color:${color}">${p.seriesName}</span><span style="color:${color}">${sign}${p.value.toFixed(4)}</span></div>`;
              })
              .join('')
          );
        },
      },
      legend: {
        data: ['IC', 'Rank IC'],
        textStyle: { color: '#9CA3AF', fontSize: 11 },
        top: 0,
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: '#9CA3AF', fontSize: 10, formatter: (v: string) => v.slice(5) },
      },
      yAxis: [
        {
          type: 'value',
          axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
          axisLabel: { color: '#9CA3AF', fontSize: 10, formatter: (v: number) => v.toFixed(2) },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: '#6B7280', type: 'dashed', width: 1 },
            data: [
              {
                yAxis: IC_THRESHOLD,
                label: { formatter: `+${IC_THRESHOLD}`, color: '#6B7280', fontSize: 9 },
              },
              {
                yAxis: -IC_THRESHOLD,
                label: { formatter: `${-IC_THRESHOLD}`, color: '#6B7280', fontSize: 9 },
              },
            ],
          },
        },
      ],
      series: [
        {
          name: 'IC',
          type: 'line',
          smooth: true,
          data: icValues,
          lineStyle: { width: 2 },
          itemStyle: { color: '#3B82F6' },
          areaStyle: {
            color: new ec.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(59,130,246,0.25)' },
              { offset: 1, color: 'rgba(59,130,246,0)' },
            ]),
          },
        },
        {
          name: 'Rank IC',
          type: 'line',
          smooth: true,
          data: rankIcValues,
          lineStyle: { width: 1.5, type: 'dashed', color: '#8B5CF6' },
          itemStyle: { color: '#8B5CF6' },
        },
      ],
    } as unknown as echarts.EChartsCoreOption;
  };

  // ── IR Bar Chart ───────────────────────────────────────────
  const buildIROption = (data: FactorIRItem[]): echarts.EChartsCoreOption => {
    const factors = data.map((d) => d.factor_name);
    const irValues = data.map((d) => d.ir);

    return {
      backgroundColor: 'transparent',
      grid: { left: '5%', right: '8%', top: '10%', bottom: '12%', containLabel: true },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1f2937',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#fff' },
        formatter: (params: unknown) => {
          const arr = params as Array<{ name: string; value: number; color: string }>;
          if (!arr?.length) return '';
          const item = arr[0];
          const sign = item.value >= 0 ? '+' : '';
          return (
            `<div><span style="color:#9CA3AF">因子: </span><span style="color:white">${item.name}</span><br/>` +
            `<span style="color:#9CA3AF">IR: </span><span style="color:${item.value >= 0 ? '#22C55E' : '#EF4444'}">${sign}${item.value.toFixed(3)}</span></div>`
          );
        },
      },
      xAxis: {
        type: 'category',
        data: factors,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: '#9CA3AF', fontSize: 10, rotate: 30 },
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
          data: [{ xAxis: 0.5 }],
        },
      },
      series: [
        {
          type: 'bar',
          data: irValues.map((v) => ({
            value: v,
            itemStyle: {
              color:
                v >= 0
                  ? new ec.graphic.LinearGradient(0, 0, 0, 1, [
                      { offset: 0, color: '#22C55E' },
                      { offset: 1, color: '#16A34A' },
                    ])
                  : new ec.graphic.LinearGradient(0, 0, 0, 1, [
                      { offset: 0, color: '#EF4444' },
                      { offset: 1, color: '#DC2626' },
                    ]),
            },
          })),
          barMaxWidth: 40,
          label: {
            show: true,
            position: 'top',
            formatter: (p: { value: number }) => `${p.value >= 0 ? '+' : ''}${p.value.toFixed(2)}`,
            fontSize: 9,
            color: '#9CA3AF',
          },
        },
      ],
    } as unknown as echarts.EChartsCoreOption;
  };

  // ── Correlation Heatmap ────────────────────────────────────
  const buildCorrOption = (data: FactorCorrelationItem[]): echarts.EChartsCoreOption => {
    if (!data.length) return {};

    const allFactors = Array.from(new Set(data.map((d) => d.factor_1)));
    const matrix: number[][] = Array.from({ length: allFactors.length }, () =>
      Array.from({ length: allFactors.length }, () => 0)
    );
    const idx: Record<string, number> = {};
    allFactors.forEach((f, i) => {
      idx[f] = i;
    });
    data.forEach((d) => {
      const r = idx[d.factor_1];
      const c = idx[d.factor_2];
      if (r !== undefined && c !== undefined) matrix[r][c] = d.correlation;
    });

    const visualMap = {
      show: true,
      min: -1,
      max: 1,
      calculable: true,
      orient: 'vertical',
      right: 10,
      top: 'center',
      itemWidth: 12,
      itemHeight: 100,
      textStyle: { color: '#9CA3AF', fontSize: 10 },
      inRange: {
        color: ['#EF4444', '#6B7280', '#22C55E'],
      },
      formatter: (v: number) => `${v.toFixed(1)}`,
    };

    return {
      backgroundColor: 'transparent',
      grid: { left: '2%', right: '15%', top: '5%', bottom: '15%', containLabel: true },
      tooltip: {
        trigger: 'item',
        backgroundColor: '#1f2937',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#fff' },
        formatter: (p: { data: { value: number; name: string[] } }) => {
          if (!p.data?.name) return '';
          return `<div>${p.data.name[0]} × ${p.data.name[1]}<br/>相关性: <span style="color:${p.data.value >= 0 ? '#22C55E' : '#EF4444'}">${p.data.value.toFixed(3)}</span></div>`;
        },
      },
      xAxis: {
        type: 'category',
        data: allFactors,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: '#9CA3AF', fontSize: 9, rotate: 30 },
      },
      yAxis: {
        type: 'category',
        data: allFactors,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: '#9CA3AF', fontSize: 9 },
      },
      visualMap,
      series: [
        {
          type: 'heatmap',
          data: matrix
            .map((row, i) =>
              row.map((v, j) => ({ value: v, name: [allFactors[i], allFactors[j]] }))
            )
            .flat(),
          label: {
            show: true,
            formatter: (p: { value: number }) => p.value.toFixed(2),
            fontSize: 8,
            color: '#fff',
          },
          itemStyle: { borderWidth: 1, borderColor: '#1f2937' },
          emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } },
        },
      ],
    } as unknown as echarts.EChartsCoreOption;
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const code = tsCode();
      const [icRes, irRes, corrRes] = await Promise.allSettled([
        fetchFactorIC(code),
        fetchFactorIR(code),
        fetchFactorCorrelation(code),
      ]);

      if (icRes.status === 'fulfilled' && icRes.value.data?.items) {
        setIcData(icRes.value.data.items);
      }
      if (irRes.status === 'fulfilled' && irRes.value.data?.items) {
        setIrData(irRes.value.data.items);
      }
      if (corrRes.status === 'fulfilled' && corrRes.value.data?.items) {
        setCorrData(corrRes.value.data.items);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  onMount(async () => {
    const ec = (await import('@/lib/echarts')).default;
    icChart = ec.init(icRef!, 'dark');
    irChart = ec.init(irRef!, 'dark');
    corrChart = ec.init(corrRef!, 'dark');

    const ro = new ResizeObserver(() => {
      icChart?.resize();
      irChart?.resize();
      corrChart?.resize();
    });
    [icRef!, irRef!, corrRef!].forEach((el) => ro.observe(el));

    loadData().then(() => {
      icChart?.setOption(buildICOption(icData()));
      irChart?.setOption(buildIROption(irData()));
      corrChart?.setOption(buildCorrOption(corrData()));
    });

    onCleanup(() => {
      ro.disconnect();
      icChart?.dispose();
      irChart?.dispose();
      corrChart?.dispose();
    });
  });

  return (
    <div class="flex flex-col gap-4 h-full">
      {/* Header */}
      <div class="flex items-center gap-3 shrink-0">
        <h2 class="text-lg font-bold">因子有效性看板</h2>
        <div class="flex items-center gap-2">
          <input
            type="text"
            class="bg-[#0A0E17] border border-white/10 rounded px-3 py-1.5 text-sm w-44"
            placeholder="股票代码"
            value={tsCode()}
            onInput={(e) => setTsCode(e.target.value.toUpperCase())}
          />
          <button
            class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm transition-colors"
            onClick={loadData}
          >
            查询
          </button>
        </div>
        <Show when={loading()}>
          <span class="text-xs text-gray-400 animate-pulse">加载中...</span>
        </Show>
        <Show when={error()}>
          <span class="text-xs text-red-400">{error()}</span>
        </Show>
      </div>

      {/* Charts Grid */}
      <div class="flex-1 grid grid-cols-1 xl:grid-cols-2 gap-4 min-h-0 overflow-hidden">
        {/* IC 时序图 - 全宽 */}
        <div class="xl:col-span-2 bg-[#111827]/80 rounded-lg border border-white/10 p-4 min-h-[260px]">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-bold text-gray-300">IC 时间序列</h3>
            <div class="flex gap-3 text-xs text-gray-400">
              <span class="flex items-center gap-1">
                <span class="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                IC
              </span>
              <span class="flex items-center gap-1">
                <span class="w-2 h-2 rounded-full bg-purple-500 inline-block" />
                Rank IC
              </span>
              <span class="text-gray-500">|IC| &gt; {IC_THRESHOLD} 显著</span>
            </div>
          </div>
          <div ref={icRef} class="w-full flex-1" style={{ 'min-height': '220px' }} />
        </div>

        {/* IR 柱状图 */}
        <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4 min-h-[260px]">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-bold text-gray-300">IR 比率 (因子稳定性)</h3>
            <div class="flex gap-2 text-xs text-gray-400">
              <span class="text-green-400">● 正 IR</span>
              <span class="text-red-400">● 负 IR</span>
            </div>
          </div>
          <div ref={irRef} class="w-full flex-1" style={{ 'min-height': '220px' }} />
        </div>

        {/* 相关性热力图 */}
        <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4 min-h-[260px]">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-bold text-gray-300">因子相关性矩阵</h3>
          </div>
          <div ref={corrRef} class="w-full flex-1" style={{ 'min-height': '220px' }} />
        </div>
      </div>
    </div>
  );
};
