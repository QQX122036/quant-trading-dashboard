/**
 * SectorSentimentHeatmap.tsx — 板块情绪热力图
 * ECharts 热力图展示各行业板块情绪分布
 * 颜色映射：绿色(负面) → 黄色(中性) → 红色(正面)
 */
import { Component, createSignal, onMount, onCleanup, For, Show, createMemo } from 'solid-js';
import echarts from '@/lib/echarts';
import { apiFetch } from '../../hooks/useApi';

export interface SectorSentimentItem {
  sector_name: string;
  sentiment_score: number; // 0-100, >50 看涨
  change_pct?: number;
  net_inflow?: number;
  up_count?: number;
  down_count?: number;
  volume?: number;
  date: string;
}

interface SectorSentimentHeatmapProps {
  embedded?: boolean;
  maxItems?: number;
}

const CARD_BASE = 'bg-[#1f2937]/80 rounded-lg border border-white/10';

function sentimentColor(score: number): string {
  if (score < 35) return '#22C55E'; // 恐惧 → 绿色
  if (score < 45) return '#6EE7B7'; // 偏绿
  if (score < 55) return '#FDE047'; // 中性 → 黄色
  if (score < 65) return '#FB923C'; // 偏红
  return '#EF4444'; // 贪婪 → 红色
}

function sentimentLabel(score: number): string {
  if (score < 30) return '极度恐惧';
  if (score < 40) return '恐惧';
  if (score < 50) return '偏弱';
  if (score < 60) return '偏强';
  if (score < 70) return '贪婪';
  return '极度贪婪';
}

export const SectorSentimentHeatmap: Component<SectorSentimentHeatmapProps> = (props) => {
  let ref!: HTMLDivElement;
  let chart: echarts.ECharts | undefined;
  let abortController: AbortController | null = null;
  const [loading, setLoading] = createSignal(false);
  const [data, setData] = createSignal<SectorSentimentItem[]>([]);
  const [error, setError] = createSignal<string | null>(null);
  const maxItems = () => props.maxItems ?? 28;

  const buildOption = (items: SectorSentimentItem[]): echarts.EChartsCoreOption => {
    if (!items.length) return {};
    // Take top N by abs sentiment deviation from 50
    const sorted = [...items]
      .sort((a, b) => Math.abs(b.sentiment_score - 50) - Math.abs(a.sentiment_score - 50))
      .slice(0, maxItems());

    const sectorNames = sorted.map((s) => s.sector_name);
    const scoreValues = sorted.map((s) => s.sentiment_score);

    // Build heatmap data: [sectorIndex, 0, score]
    const heatmapData = sorted.map((s, i) => [i, 0, s.sentiment_score]);

    return {
      backgroundColor: 'transparent',
      grid: { top: 8, right: 80, bottom: 8, left: 8, containLabel: true },
      xAxis: {
        type: 'category',
        data: ['情绪分'],
        show: false,
      },
      yAxis: {
        type: 'category',
        data: sectorNames,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#9CA3AF',
          fontSize: 11,
          width: 80,
          overflow: 'truncate',
        },
        splitLine: { show: false },
      },
      visualMap: {
        min: 0,
        max: 100,
        calculable: false,
        orient: 'vertical',
        right: 0,
        top: 'center',
        itemHeight: 120,
        itemWidth: 12,
        textStyle: { color: '#6b7280', fontSize: 10 },
        inRange: {
          color: ['#22C55E', '#6EE7B7', '#FDE047', '#FB923C', '#EF4444'],
        },
        formatter: (val: number) => {
          if (val < 30) return '极度恐惧';
          if (val < 45) return '恐惧';
          if (val < 55) return '中性';
          if (val < 70) return '贪婪';
          return '极度贪婪';
        },
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: '#111827',
        borderColor: '#374151',
        textStyle: { color: '#e5e7eb', fontSize: 12 },
        formatter: (params: unknown) => {
          const p = params as { data: [number, number, number] };
          const item = sorted[p.data[0]];
          if (!item) return '';
          const pctChange =
            item.change_pct != null
              ? `${item.change_pct >= 0 ? '+' : ''}${item.change_pct.toFixed(2)}%`
              : '—';
          const inflow =
            item.net_inflow != null
              ? `${item.net_inflow >= 0 ? '+' : ''}${item.net_inflow.toFixed(2)}亿`
              : null;
          return `<div style="font-family:JetBrains Mono,monospace;min-width:140px">
            <div style="color:#e5e7eb;font-weight:bold;margin-bottom:4px">${item.sector_name}</div>
            <div style="display:flex;justify-content:space-between;gap:12px">
              <span style="color:#9CA3AF">情绪分</span>
              <span style="color:${sentimentColor(item.sentiment_score)};font-weight:bold">${item.sentiment_score.toFixed(1)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;gap:12px">
              <span style="color:#9CA3AF">涨跌幅</span>
              <span style="color:${item.change_pct != null && item.change_pct >= 0 ? '#EF4444' : '#22C55E'}">${pctChange}</span>
            </div>
            ${
              inflow
                ? `<div style="display:flex;justify-content:space-between;gap:12px">
              <span style="color:#9CA3AF">净流入</span>
              <span style="color:${item.net_inflow! >= 0 ? '#EF4444' : '#22C55E'}">${inflow}</span>
            </div>`
                : ''
            }
            <div style="margin-top:4px;font-size:10px;color:#6b7280">${sentimentLabel(item.sentiment_score)}</div>
          </div>`;
        },
      },
      series: [
        {
          type: 'heatmap',
          data: heatmapData,
          label: {
            show: true,
            formatter: (params: unknown) => {
              const p = params as { data: [number, number, number] };
              const item = sorted[p.data[0]];
              return item ? `${item.sentiment_score.toFixed(0)}` : '';
            },
            color: '#1f2937',
            fontSize: 10,
            fontWeight: 'bold',
          },
          itemStyle: {
            borderColor: '#111827',
            borderWidth: 2,
            borderRadius: 4,
          },
          emphasis: {
            itemStyle: {
              borderColor: '#e5e7eb',
              borderWidth: 2,
            },
          },
        },
      ],
    };
  };

  onMount(() => {
    chart = echarts.init(ref, undefined, { renderer: 'canvas' });
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
      const res = await apiFetch<{ items: SectorSentimentItem[] }>('/api/data/sector-sentiment', {
        signal: abortController.signal,
      });
      if (res.code === '0' && res.data?.items) {
        setData(res.data.items);
      }
    } catch (e: unknown) {
      const errObj = e as Record<string, unknown> | undefined;
      if (errObj?.code === 'NETWORK_ERROR' && String(e).includes('abort')) return;
      setError(String(e));
      // Fallback demo data
      const sectors = [
        '半导体',
        '新能源汽车',
        '医药生物',
        '光伏设备',
        '银行',
        '证券',
        '房地产',
        '白酒',
        '军工',
        '通信设备',
        '软件服务',
        '有色金属',
        '化工',
        '工程机械',
        '食品饮料',
        '家电',
        '电力',
        '煤炭',
        '石油',
        '纺织服装',
        '传媒',
        '环保',
        '建材',
        '旅游',
        '铁路公路',
        '保险',
        '多元金融',
        '航运港口',
      ];
      const demo: SectorSentimentItem[] = sectors.map((name) => ({
        sector_name: name,
        sentiment_score: +(40 + Math.random() * 40).toFixed(1),
        change_pct: +((Math.random() - 0.5) * 6).toFixed(2),
        net_inflow: +((Math.random() - 0.5) * 20).toFixed(2),
        date: new Date().toLocaleDateString('zh-CN'),
      }));
      setData(demo);
    } finally {
      setLoading(false);
    }
  };

  // Update chart when data changes
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
        <h3 class="font-bold text-sm">板块情绪热力图</h3>
        <div class="flex items-center gap-2">
          {loading() && <span class="text-xs text-gray-500 animate-pulse">刷新中…</span>}
          <span class="text-xs text-gray-500">情绪分 = 0-100</span>
        </div>
      </div>
      {error() && <div class="text-xs text-red-400 mb-2">{error()}</div>}
      <Show
        when={!loading() && data().length > 0}
        fallback={
          <div class="flex items-center justify-center" style={{ height: '200px' }}>
            <span class="text-xs text-gray-500 animate-pulse">加载中…</span>
          </div>
        }
      >
        <div ref={ref} class="w-full" style={{ height: props.embedded ? '200px' : '380px' }} />
      </Show>
    </div>
  );
};
