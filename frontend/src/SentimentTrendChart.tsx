/**
 * SentimentTrendChart.tsx — 情绪时序折线图
 * 恐惧贪婪指数 + 波动率指数 时序走势
 * 支持多指标叠加显示
 */
import { Component, createSignal, onMount, onCleanup, createMemo } from 'solid-js';
import echarts from '@/lib/echarts';
import { apiFetch } from '../../hooks/useApi';

export interface SentimentTrendItem {
  date: string;
  fear_greed: number;
  volatility?: number;
  up_count?: number;
  down_count?: number;
}

interface SentimentTrendChartProps {
  tsCode?: string;
  days?: number;
  embedded?: boolean;
}

const CARD_BASE = 'bg-[#1f2937]/80 rounded-lg border border-white/10';

export const SentimentTrendChart: Component<SentimentTrendChartProps> = (props) => {
  let ref!: HTMLDivElement;
  let chart: echarts.ECharts | undefined;
  let abortController: AbortController | null = null;
  const [loading, setLoading] = createSignal(false);
  const [data, setData] = createSignal<SentimentTrendItem[]>([]);
  const [error, setError] = createSignal<string | null>(null);
  const days = () => props.days ?? 30;

  const buildOption = (items: SentimentTrendItem[]): echarts.EChartsCoreOption => {
    if (!items.length) return {};
    const dates = items.map((d) => d.date.slice(5)); // MM-DD
    const fgValues = items.map((d) => d.fear_greed);
    const volValues = items.map((d) => d.volatility ?? 0);

    return {
      backgroundColor: 'transparent',
      grid: { top: 32, right: 60, bottom: 32, left: 48 },
      legend: {
        top: 4,
        right: 8,
        textStyle: { color: '#9CA3AF', fontSize: 11 },
        itemWidth: 16,
        itemHeight: 8,
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#111827',
        borderColor: '#374151',
        textStyle: { color: '#e5e7eb', fontSize: 12 },
        formatter: (params: unknown) => {
          if (!Array.isArray(params)) return '';
          const arr = params as Array<{
            name: string;
            seriesName: string;
            value: number;
            color: string;
          }>;
          const date = arr[0]?.name ?? '';
          let html = `<div style="color:#9CA3AF;font-size:10px;margin-bottom:4px">${date}</div>`;
          arr.forEach((p) => {
            if (p.value == null) return;
            html += `<div style="display:flex;align-items:center;gap:6px;margin:2px 0">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
              <span style="color:#d1d5db;font-size:11px">${p.seriesName}</span>
              <strong style="color:#f3f4f6;font-size:12px;margin-left:auto">${Number(p.value).toFixed(1)}</strong>
            </div>`;
          });
          return html;
        },
      },
      xAxis: {
        type: 'category',
        data: dates,
        boundaryGap: false,
        axisLine: { lineStyle: { color: '#1f2937' } },
        axisLabel: { color: '#6b7280', fontSize: 10 },
        splitLine: { show: false },
      },
      yAxis: [
        {
          type: 'value',
          name: '恐惧/贪婪',
          min: 0,
          max: 100,
          nameTextStyle: { color: '#6b7280', fontSize: 10 },
          axisLine: { show: false },
          axisLabel: { color: '#6b7280', fontSize: 10 },
          splitLine: { lineStyle: { color: '#1f2937', type: 'dashed' } },
        },
        {
          type: 'value',
          name: '波动率',
          nameTextStyle: { color: '#6b7280', fontSize: 10 },
          axisLine: { show: false },
          axisLabel: { color: '#6b7280', fontSize: 10 },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '恐惧/贪婪',
          type: 'line',
          yAxisIndex: 0,
          data: fgValues,
          smooth: true,
          lineStyle: { width: 2, color: '#F59E0B' },
          itemStyle: { color: '#F59E0B' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(245,158,11,0.25)' },
                { offset: 1, color: 'rgba(245,158,11,0.02)' },
              ],
            },
          },
          symbol: 'circle',
          symbolSize: 4,
          markLine: {
            silent: true,
            lineStyle: { color: '#374151', type: 'dashed' },
            data: [
              { yAxis: 30, name: '恐惧线' },
              { yAxis: 70, name: '贪婪线' },
              { yAxis: 50, name: '中性' },
            ],
            label: { color: '#6b7280', fontSize: 9 },
          },
        },
        {
          name: '波动率',
          type: 'line',
          yAxisIndex: 1,
          data: volValues,
          smooth: true,
          lineStyle: { width: 1.5, color: '#9B59B6' },
          itemStyle: { color: '#9B59B6' },
          symbol: 'none',
        },
      ],
    };
  };

  onMount(() => {
    if (!ref) return;
    chart = echarts.init(ref, undefined, { renderer: 'canvas' });
    if (!chart) return;
    chart.setOption(buildOption(data()));
    const ro = new ResizeObserver(() => chart?.resize());
    ro.observe(ref);
    onCleanup(() => {
      ro.disconnect();
      chart?.dispose();
    });
  });

  const fetchData = async () => {
    abortController?.abort();
    abortController = new AbortController();
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch<{ items: SentimentTrendItem[] }>(
        `/api/data/sentiment-trend?ts_code=${props.tsCode ?? '000001.SH'}&days=${days()}`,
        { signal: abortController.signal }
      );
      if (res.code === '0' && res.data?.items) {
        setData(res.data.items);
      }
    } catch (e: unknown) {
      const errObj = e as Record<string, unknown> | undefined;
      if (errObj?.code === 'NETWORK_ERROR' && String(e).includes('abort')) return;
      setError(String(e));
      // Fallback demo data
      const demo: SentimentTrendItem[] = [];
      for (let i = days(); i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        demo.push({
          date: d.toISOString().slice(0, 10),
          fear_greed: Math.round(40 + Math.random() * 30 + (i % 7 < 3 ? 10 : -5)),
          volatility: +(15 + Math.random() * 15).toFixed(2),
        });
      }
      setData(demo);
    } finally {
      setLoading(false);
    }
  };

  createMemo(() => {
    const items = data();
    if (chart && items.length) {
      chart.setOption(buildOption(items), { replaceMerge: ['series'] });
    }
  });

  onMount(() => {
    fetchData();
    const timer = setInterval(fetchData, 60 * 1000);
    onCleanup(() => {
      abortController?.abort();
      clearInterval(timer);
    });
  });

  return (
    <div class={`${CARD_BASE} ${props.embedded ? '' : 'p-4'}`}>
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-bold text-sm">情绪走势</h3>
        <div class="flex items-center gap-2">
          {loading() && <span class="text-xs text-gray-500 animate-pulse">刷新中…</span>}
          <span class="text-xs text-gray-500">近{days()}日</span>
        </div>
      </div>
      {error() && <div class="text-xs text-red-400 mb-2">{error()}</div>}
      <div ref={ref} class="w-full" style={{ height: props.embedded ? '160px' : '260px' }} />
    </div>
  );
};
