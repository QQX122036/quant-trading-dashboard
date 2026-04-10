/**
 * SentimentMarketCompare.tsx — 情绪与市场走势对比图
 * 双Y轴折线图：恐惧贪婪指数 vs 指数涨跌幅
 * 对标同花顺/东方财富 情绪温度计功能
 */
import { Component, createSignal, onMount, onCleanup, createMemo } from 'solid-js';
import { apiFetch } from '../../hooks/useApi';

export interface CompareItem {
  date: string;
  fear_greed: number;
  index_close: number;
  index_change_pct: number; // %
}

interface SentimentMarketCompareProps {
  tsCode?: string;
  indexCode?: string;
  days?: number;
  embedded?: boolean;
}

const CARD_BASE = 'bg-[#1f2937]/80 rounded-lg border border-white/10';

export const SentimentMarketCompare: Component<SentimentMarketCompareProps> = (props) => {
  let ref!: HTMLDivElement;
  let chart: echarts.ECharts | undefined;
  let abortController: AbortController | null = null;
  const [loading, setLoading] = createSignal(false);
  const [data, setData] = createSignal<CompareItem[]>([]);
  const [error, setError] = createSignal<string | null>(null);
  const days = () => props.days ?? 30;
  const indexCode = () => props.indexCode ?? '000001.SH';

  const buildOption = (items: CompareItem[]): echarts.EChartsCoreOption => {
    if (!items.length) return {};
    const dates = items.map((d) => d.date.slice(5));
    const fgValues = items.map((d) => d.fear_greed);
    const pctValues = items.map((d) => d.index_change_pct);

    return {
      backgroundColor: 'transparent',
      grid: { top: 40, right: 60, bottom: 32, left: 48 },
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
            seriesIndex: number;
          }>;
          const date = arr[0]?.name ?? '';
          let html = `<div style="color:#9CA3AF;font-size:10px;margin-bottom:4px">${date}</div>`;
          arr.forEach((p) => {
            if (p.value == null) return;
            const num = Number(p.value);
            const sign = p.seriesIndex === 0 ? '' : num >= 0 ? '+' : '';
            const color =
              p.seriesIndex === 0
                ? num < 40
                  ? '#22C55E'
                  : num > 60
                    ? '#EF4444'
                    : '#F59E0B'
                : num >= 0
                  ? '#EF4444'
                  : '#22C55E';
            html += `<div style="display:flex;align-items:center;gap:6px;margin:2px 0">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
              <span style="color:#d1d5db;font-size:11px">${p.seriesName}</span>
              <strong style="color:${color};font-size:12px;margin-left:auto">${sign}${num.toFixed(2)}${p.seriesIndex === 1 ? '%' : ''}</strong>
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
          axisLabel: {
            color: '#6b7280',
            fontSize: 10,
            formatter: (v: number) => String(v),
          },
          splitLine: { lineStyle: { color: '#1f2937', type: 'dashed' } },
          markLine: {
            silent: true,
            lineStyle: { color: '#374151', type: 'dashed' },
            data: [
              { yAxis: 30, label: { color: '#6b7280', fontSize: 9 } },
              { yAxis: 50, label: { color: '#6b7280', fontSize: 9 } },
              { yAxis: 70, label: { color: '#6b7280', fontSize: 9 } },
            ],
          },
        },
        {
          type: 'value',
          name: '涨跌幅(%)',
          nameTextStyle: { color: '#6b7280', fontSize: 10 },
          axisLine: { show: false },
          axisLabel: {
            color: '#6b7280',
            fontSize: 10,
            formatter: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`,
          },
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
                { offset: 0, color: 'rgba(245,158,11,0.2)' },
                { offset: 1, color: 'rgba(245,158,11,0.01)' },
              ],
            },
          },
          symbol: 'circle',
          symbolSize: 4,
        },
        {
          name: '指数涨跌幅',
          type: 'line',
          yAxisIndex: 1,
          data: pctValues,
          smooth: true,
          lineStyle: { width: 1.5, color: '#60A5FA' },
          itemStyle: { color: '#60A5FA' },
          symbol: 'circle',
          symbolSize: 3,
          connectNulls: true,
        },
      ],
    };
  };

  onMount(async () => {
    const ec = (await import('@/lib/echarts')).default;
    if (!ref) return;
    chart = ec.init(ref, undefined, { renderer: 'canvas' });
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
      // Try the dedicated compare endpoint first
      const res = await apiFetch<{ items: CompareItem[] }>(
        `/api/data/sentiment-compare?ts_code=${indexCode()}&days=${days()}`,
        { signal: abortController.signal }
      );
      if (res.code === '0' && res.data?.items) {
        setData(res.data.items);
      }
    } catch (e: unknown) {
      const errObj = e as Record<string, unknown> | undefined;
      if (errObj?.code === 'NETWORK_ERROR' && String(e).includes('abort')) return;
      setError(String(e));
      // Fallback: generate correlated demo data
      const demo: CompareItem[] = [];
      let fg = 50;
      let baseClose = 3200;
      for (let i = days(); i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const date = d.toISOString().slice(0, 10);
        // Simulate fear/greed + market correlation
        fg = Math.max(10, Math.min(90, fg + (Math.random() - 0.5) * 15));
        const pctChange = ((fg - 50) / 100) * 2 + (Math.random() - 0.5) * 1.5;
        baseClose *= 1 + pctChange / 100;
        demo.push({
          date,
          fear_greed: Math.round(fg),
          index_close: +baseClose.toFixed(2),
          index_change_pct: +pctChange.toFixed(2),
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

  onMount(async () => {
    const ec = (await import('@/lib/echarts')).default;
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
        <h3 class="font-bold text-sm">情绪与市场走势对比</h3>
        <div class="flex items-center gap-2">
          {loading() && <span class="text-xs text-gray-500 animate-pulse">刷新中…</span>}
          <span class="text-xs text-gray-500">近{days()}日</span>
        </div>
      </div>
      {error() && <div class="text-xs text-red-400 mb-2">{error()}</div>}
      <div ref={ref} class="w-full" style={{ height: props.embedded ? '160px' : '280px' }} />
    </div>
  );
};
