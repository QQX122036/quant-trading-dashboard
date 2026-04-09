/**
 * SentimentGauge.tsx — 情绪指数量表
 * 恐惧贪婪指数 + 波动率指数 + 涨跌家数比
 * ECharts 仪表盘 + 数值卡片
 */
import { Component, createSignal, onMount, onCleanup, createMemo } from 'solid-js';
import echarts from '@/lib/echarts';
import { apiFetch } from '../../hooks/useApi';

interface SentimentData {
  fear_greed: number; // 0-100
  volatility: number; // 布林带宽度
  up_count: number; // 上涨家数
  down_count: number; // 下跌家数
  date: string;
}

interface SentimentGaugeProps {
  embedded?: boolean;
}

const cardStyle =
  'bg-[#1f2937]/80 rounded-lg border border-white/10 p-4 flex flex-col items-center justify-center gap-2';

// 创建仪表盘配置
function createGaugeOption(
  value: number,
  min: number,
  max: number,
  name: string,
  colorStops: Array<{ offset: number; color: string }>,
  suffix = ''
): echarts.EChartsCoreOption {
  return {
    backgroundColor: 'transparent',
    series: [
      {
        type: 'gauge',
        startAngle: 210,
        endAngle: -30,
        min,
        max,
        radius: '90%',
        pointer: { show: true, length: '60%', width: 4, itemStyle: { color: '#e5e7eb' } },
        progress: {
          show: true,
          width: 10,
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops,
            },
          },
        },
        axisLine: {
          lineStyle: { width: 10, color: [[1, '#374151']] },
        },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        title: { show: false },
        detail: {
          valueAnimation: true,
          fontSize: 18,
          fontWeight: 'bold',
          fontFamily: 'JetBrains Mono, monospace',
          color: '#f3f4f6',
          formatter: `{value}${suffix}`,
          offsetCenter: [0, '70%'],
        },
        data: [{ value, name }],
      },
    ],
  };
}

function FearGreedGauge(props: { value: number }) {
  let ref!: HTMLDivElement;
  let chart: echarts.ECharts | undefined;

  const label = createMemo(() => {
    const v = props.value;
    if (v < 30)
      return { text: '恐惧', color: '#22C55E', bg: 'bg-green-500/10 border-green-500/30' };
    if (v <= 70)
      return { text: '中性', color: '#F59E0B', bg: 'bg-yellow-500/10 border-yellow-500/30' };
    return { text: '贪婪', color: '#EF4444', bg: 'bg-red-500/10 border-red-500/30' };
  });

  const option = createMemo((): echarts.EChartsCoreOption => {
    const v = Math.round(props.value);
    return createGaugeOption(v, 0, 100, '', [
      { offset: 0, color: '#22C55E' },
      { offset: 0.3, color: '#22C55E' },
      { offset: 0.7, color: '#F59E0B' },
      { offset: 1, color: '#EF4444' },
    ]);
  });

  onMount(() => {
    chart = echarts.init(ref, undefined, { renderer: 'canvas' });
    chart.setOption(option());
    const ro = new ResizeObserver(() => chart?.resize());
    ro.observe(ref);
    onCleanup(() => {
      ro.disconnect();
      chart?.dispose();
    });
  });

  return (
    <div class={`${cardStyle} flex-1 min-w-[140px]`}>
      <div ref={ref} class="w-full" style={{ height: '140px' }} />
      <div class={`text-center px-2 py-1 rounded border ${label().bg}`}>
        <span class="text-sm font-bold" style={{ color: label().color }}>
          {label().text}
        </span>
      </div>
    </div>
  );
}

function VolatilityCard(props: { value: number }) {
  const level = createMemo(() => {
    const v = props.value;
    if (v < 15) return { text: '低波动', color: '#22C55E', bg: 'bg-green-500/10' };
    if (v < 30) return { text: '中波动', color: '#F59E0B', bg: 'bg-yellow-500/10' };
    return { text: '高波动', color: '#EF4444', bg: 'bg-red-500/10' };
  });

  return (
    <div class={`${cardStyle} flex-1 min-w-[140px]`}>
      <div class="text-xs text-gray-500 uppercase tracking-wider">波动率指数</div>
      <div class="text-2xl font-bold font-mono" style={{ color: level().color }}>
        {props.value.toFixed(2)}
      </div>
      <div class={`text-xs px-2 py-0.5 rounded ${level().bg}`} style={{ color: level().color }}>
        {level().text}
      </div>
    </div>
  );
}

function UpDownRatioCard(props: { up: number; down: number }) {
  const ratio = createMemo(() => {
    const d = Math.max(1, props.down);
    return props.up / d;
  });
  const level = createMemo(() => {
    const r = ratio();
    if (r < 0.8) return { text: '偏弱', color: '#22C55E', bg: 'bg-green-500/10' };
    if (r <= 1.5) return { text: '均衡', color: '#F59E0B', bg: 'bg-yellow-500/10' };
    return { text: '过热', color: '#EF4444', bg: 'bg-red-500/10' };
  });

  return (
    <div class={`${cardStyle} flex-1 min-w-[140px]`}>
      <div class="text-xs text-gray-500 uppercase tracking-wider">涨跌家数比</div>
      <div class="flex items-center gap-2">
        <span class="text-2xl font-bold font-mono" style={{ color: level().color }}>
          {ratio().toFixed(2)}
        </span>
        <span class="text-xs text-gray-500">
          = {props.up}/{props.down}
        </span>
      </div>
      <div class={`text-xs px-2 py-0.5 rounded ${level().bg}`} style={{ color: level().color }}>
        市场{level().text}
      </div>
    </div>
  );
}

export const SentimentGauge: Component<SentimentGaugeProps> = (props) => {
  const [sentiment, setSentiment] = createSignal<SentimentData>({
    fear_greed: 50,
    volatility: 18.5,
    up_count: 0,
    down_count: 0,
    date: '',
  });
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  let abortController: AbortController | null = null;

  const fetchData = async () => {
    // Cancel any in-flight request before starting a new one
    abortController?.abort();
    abortController = new AbortController();
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch<{ data: SentimentData }>('/api/data/sentiment', {
        signal: abortController.signal,
      });
      if (res.code === '0' && res.data?.data) {
        // Map API response to component's expected field names
        const raw = res.data.data as unknown as Record<string, unknown>;
        setSentiment({
          fear_greed:
            (raw.labels as Record<string, number>)?.fear_greed_index ??
            (raw.fear_greed as number) ??
            50,
          volatility:
            (raw.labels as Record<string, number>)?.volatility_index ??
            (raw.volatility as number) ??
            18,
          up_count:
            (raw.labels as Record<string, number>)?.up_count ?? (raw.up_count as number) ?? 0,
          down_count:
            (raw.labels as Record<string, number>)?.down_count ?? (raw.down_count as number) ?? 0,
          date: (raw.date as string) ?? new Date().toLocaleDateString('zh-CN'),
        });
      }
    } catch (e: unknown) {
      const errObj = e as Record<string, unknown> | undefined;
      // Ignore abort errors — they're expected when component unmounts or refetches
      if (errObj?.code === 'NETWORK_ERROR' && String(e).includes('abort')) return;
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      // 提供模拟数据用于开发预览
      setSentiment({
        fear_greed: 58,
        volatility: 21.3,
        up_count: 2847,
        down_count: 1983,
        date: new Date().toLocaleDateString('zh-CN'),
      });
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    fetchData();
    const timer = setInterval(fetchData, 60 * 1000);
    onCleanup(() => {
      abortController?.abort();
      clearInterval(timer);
    });
  });

  return (
    <div
      class={`bg-[#111827]/80 rounded-lg border border-white/10 ${props.embedded ? '' : 'p-4'}`}
      role="region"
      aria-label="市场情绪仪表盘"
    >
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-bold text-sm">市场情绪</h3>
        <div class="flex items-center gap-2">
          {loading() && (
            <span class="text-xs text-gray-500 animate-pulse" role="status" aria-live="polite">
              刷新中…
            </span>
          )}
          <span class="text-xs text-gray-500">{sentiment().date}</span>
        </div>
      </div>

      {error() && (
        <div class="text-xs text-yellow-500 mb-2" role="alert">
          ⚠️ {error()} — 显示预览数据
        </div>
      )}

      <div class="flex gap-3 flex-wrap">
        <FearGreedGauge value={sentiment().fear_greed} />
        <VolatilityCard value={sentiment().volatility} />
        <UpDownRatioCard up={sentiment().up_count} down={sentiment().down_count} />
      </div>

      <div class="mt-3 text-xs text-gray-600 flex justify-between px-1">
        <span>← 恐惧</span>
        <span>中性</span>
        <span>贪婪 →</span>
      </div>
    </div>
  );
};
