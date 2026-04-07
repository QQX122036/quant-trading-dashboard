/**
 * MultiFactorChart.tsx — 多因子评分展示
 * 水平条形图 + 排名表格 + 跳转K线
 */
import { Component, createSignal, onMount, onCleanup, For, Show } from 'solid-js';
import * as echarts from 'echarts';
import { useNavigate } from '@solidjs/router';
import { fetchMultiFactorScores, type MultiFactorScore } from '../../hooks/useApi';

interface MultiFactorChartProps {
  tsCode?: string;
}

export const MultiFactorChart: Component<MultiFactorChartProps> = (props) => {
  let barRef: HTMLDivElement | undefined;
  let barChart: echarts.ECharts | undefined;
  const navigate = useNavigate();

  const [tsCode, setTsCode] = createSignal(props.tsCode || '000300.SH');
  const [startDate, setStartDate] = createSignal('2024-01-01');
  const [endDate, setEndDate] = createSignal('2025-01-01');
  const [scores, setScores] = createSignal<MultiFactorScore[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [selectedRow, setSelectedRow] = createSignal<string | null>(null);

  // ── Horizontal Bar Chart ────────────────────────────────────
  const buildBarOption = (data: MultiFactorScore[]): echarts.EChartsOption => {
    const items = data.slice(0, 20); // top 20

    const composite = items.map((d) => d.composite_score);
    const valuation = items.map((d) => d.valuation_score);
    const momentum = items.map((d) => d.momentum_score);
    const quality = items.map((d) => d.quality_score);
    const sentiment = items.map((d) => d.sentiment_score);
    const labels = items.map((d) => d.ts_code);

    const series = [
      { name: '综合评分', data: composite, color: '#6366F1' },
      { name: '估值分', data: valuation, color: '#22C55E' },
      { name: '动量分', data: momentum, color: '#F59E0B' },
      { name: '质量分', data: quality, color: '#3B82F6' },
      { name: '情绪分', data: sentiment, color: '#EC4899' },
    ];

    return {
      backgroundColor: 'transparent',
      grid: { left: '8%', right: '8%', top: '8%', bottom: '15%', containLabel: false },
      legend: {
        data: series.map((s) => s.name),
        textStyle: { color: '#9CA3AF', fontSize: 10 },
        top: 0,
        itemWidth: 12,
        itemHeight: 8,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#1f2937',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#fff' },
        formatter: (params: unknown) => {
          const arr = params as Array<{ axisValue: string; seriesName: string; value: number; color: string }>;
          if (!arr?.length) return '';
          const code = arr[0].axisValue;
          const rows = arr.map((p) =>
            `<tr><td style="padding:2px 8px;color:#9CA3AF">${p.seriesName}</td><td style="padding:2px 8px;color:${p.color};font-weight:bold">${p.value.toFixed(2)}</td></tr>`
          ).join('');
          return `<div style="font-size:12px"><div style="margin-bottom:4px;font-weight:bold">${code}</div><table style="border-collapse:collapse">${rows}</table></div>`;
        },
      },
      xAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: '#9CA3AF', fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      yAxis: {
        type: 'category',
        data: labels,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: '#9CA3AF', fontSize: 10 },
      },
      series: series.map((s) => ({
        name: s.name,
        type: 'bar',
        stack: 'total',
        data: s.data,
        itemStyle: { color: s.color },
        barMaxWidth: 16,
      })),
    };
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchMultiFactorScores(tsCode(), startDate(), endDate());
      if (res.code === '0' && res.data?.items) {
        setScores(res.data.items);
      } else {
        setError(res.message || '获取数据失败');
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    barChart = echarts.init(barRef!, 'dark');
    const ro = new ResizeObserver(() => barChart?.resize());
    if (barRef) ro.observe(barRef);

    onCleanup(() => {
      ro.disconnect();
      barChart?.dispose();
    });
  });

  // Update chart when data changes
  const _updateChart = () => {
    if (barChart && scores().length > 0) {
      barChart.setOption(buildBarOption(scores()), true);
    }
  };

  const handleRowClick = (tsCode: string) => {
    navigate(`/dashboard?symbol=${tsCode}`);
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-400';
    if (score >= 50) return 'text-blue-400';
    if (score >= 30) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div class="flex flex-col gap-4 h-full">
      {/* Header */}
      <div class="flex items-center gap-3 shrink-0 flex-wrap">
        <h2 class="text-lg font-bold">多因子评分</h2>
        <input
          type="text"
          class="bg-[#0A0E17] border border-white/10 rounded px-3 py-1.5 text-sm w-36"
          placeholder="指数代码"
          value={tsCode()}
          onInput={(e) => setTsCode(e.target.value.toUpperCase())}
        />
        <input type="date" class="bg-[#0A0E17] border border-white/10 rounded px-2 py-1.5 text-xs"
          value={startDate()} onInput={(e) => setStartDate(e.target.value)} />
        <span class="text-gray-500 text-xs">—</span>
        <input type="date" class="bg-[#0A0E17] border border-white/10 rounded px-2 py-1.5 text-xs"
          value={endDate()} onInput={(e) => setEndDate(e.target.value)} />
        <button
          class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm transition-colors"
          onClick={() => { loadData(); }}
        >
          查询
        </button>
        <Show when={loading()}>
          <span class="text-xs text-gray-400 animate-pulse">加载中...</span>
        </Show>
        <Show when={error()}>
          <span class="text-xs text-red-400">{error()}</span>
        </Show>
      </div>

      {/* Content */}
      <div class="flex-1 flex gap-4 min-h-0 overflow-hidden">
        {/* Bar Chart */}
        <div class="w-1/2 bg-[#111827]/80 rounded-lg border border-white/10 p-4 min-h-0 flex flex-col">
          <h3 class="text-sm font-bold text-gray-300 mb-2 shrink-0">因子得分对比</h3>
          <div ref={barRef} class="flex-1 min-h-0" />
        </div>

        {/* Ranking Table */}
        <div class="w-1/2 bg-[#111827]/80 rounded-lg border border-white/10 flex flex-col min-h-0 overflow-hidden">
          <h3 class="text-sm font-bold text-gray-300 mb-2 p-4 pb-2 shrink-0">成分股排名</h3>
          <div class="flex-1 overflow-y-auto px-4 pb-4">
            <table class="w-full text-xs">
              <thead class="sticky top-0 bg-[#111827]">
                <tr class="text-gray-400 border-b border-white/5">
                  <th class="py-1.5 pr-3 text-left font-medium">#</th>
                  <th class="py-1.5 pr-3 text-left font-medium">股票</th>
                  <th class="py-1.5 pr-3 text-right font-medium">综合</th>
                  <th class="py-1.5 pr-3 text-right font-medium">估值</th>
                  <th class="py-1.5 pr-3 text-right font-medium">动量</th>
                  <th class="py-1.5 pr-3 text-right font-medium">质量</th>
                  <th class="py-1.5 text-right font-medium">情绪</th>
                </tr>
              </thead>
              <tbody>
                <For each={scores()}>
                  {(item, idx) => (
                    <tr
                      class={`border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors ${selectedRow() === item.ts_code ? 'bg-blue-500/10' : ''}`}
                      onClick={() => { setSelectedRow(item.ts_code); handleRowClick(item.ts_code); }}
                    >
                      <td class="py-1.5 pr-3 text-gray-500">{idx() + 1}</td>
                      <td class="py-1.5 pr-3 font-mono text-blue-300">{item.ts_code}</td>
                      <td class={`py-1.5 pr-3 text-right font-bold tabular-nums ${getScoreColor(item.composite_score)}`}>
                        {item.composite_score.toFixed(1)}
                      </td>
                      <td class={`py-1.5 pr-3 text-right tabular-nums ${getScoreColor(item.valuation_score)}`}>
                        {item.valuation_score.toFixed(1)}
                      </td>
                      <td class={`py-1.5 pr-3 text-right tabular-nums ${getScoreColor(item.momentum_score)}`}>
                        {item.momentum_score.toFixed(1)}
                      </td>
                      <td class={`py-1.5 pr-3 text-right tabular-nums ${getScoreColor(item.quality_score)}`}>
                        {item.quality_score.toFixed(1)}
                      </td>
                      <td class={`py-1.5 text-right tabular-nums ${getScoreColor(item.sentiment_score)}`}>
                        {item.sentiment_score.toFixed(1)}
                      </td>
                    </tr>
                  )}
                </For>
                <Show when={!loading() && scores().length === 0}>
                  <tr>
                    <td colspan="7" class="py-8 text-center text-gray-500">
                      暂无数据，请点击「查询」加载
                    </td>
                  </tr>
                </Show>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
