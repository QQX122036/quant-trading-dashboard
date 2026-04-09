/**
 * Sentiment.tsx — 情感分析舆情监控页面
 * 路由: /sentiment
 * - ECharts 柱状图: 日均情感分布
 * - 表格: 高正面 / 高负面新闻列表
 * - 对接 GET /api/news/sentiment
 */
import { Component, createSignal, createMemo, onMount, onCleanup, For, Show } from 'solid-js';
import echarts from '@/lib/echarts';
import { apiFetch } from '../hooks/useApi';
import { formatDate } from '../utils/format';

// ── Types ──────────────────────────────────────────────────
interface NewsItem {
  id: string;
  title: string;
  source: string;
  publish_time: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  sentiment_score: number; // 0-100, >50 bullish
  ts_code?: string;
  url?: string;
  summary?: string;
}

interface SentimentSummary {
  ts_code: string;
  bullish_pct: number;
  bearish_pct: number;
  neutral_pct: number;
  sentiment_index: number; // 0-100
  news_count: number;
  date: string;
}

interface DailySentiment {
  date: string;
  bullish_count: number;
  bearish_count: number;
  neutral_count: number;
  avg_score: number; // 0-100
}

interface ApiResponse<T> {
  code: string;
  msg?: string;
  data?: T;
}

const CARD = 'bg-[#1f2937]/80 rounded-lg border border-white/10';

// ── Sentiment Bar Chart ─────────────────────────────────────
function SentimentBarChart(props: { data: DailySentiment[] }) {
  let ref!: HTMLDivElement;
  let chart: echarts.ECharts | undefined;

  const buildOption = (): echarts.EChartsCoreOption => {
    const data = props.data;
    const dates = data.map((d) => d.date.slice(5)); // MM-DD
    return {
      backgroundColor: 'transparent',
      grid: { top: 32, right: 16, bottom: 32, left: 48 },
      legend: {
        top: 4,
        right: 8,
        textStyle: { color: '#9CA3AF', fontSize: 11 },
        itemWidth: 12,
        itemHeight: 8,
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#111827',
        borderColor: '#374151',
        textStyle: { color: '#e5e7eb', fontSize: 12 },
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const arr = params as Array<{
            name: string;
            seriesName: string;
            value: number;
            color: string;
          }>;
          const date = arr[0]?.name ?? '';
          let html = `<div style="color:#9CA3AF;font-size:10px;margin-bottom:4px">${date}</div>`;
          arr.forEach((p) => {
            html += `<div style="display:flex;align-items:center;gap:6px;margin:2px 0">
              <span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${p.color}"></span>
              <span style="color:#d1d5db;font-size:11px">${p.seriesName}</span>
              <strong style="color:#f3f4f6;font-size:12px;margin-left:auto">${p.value}</strong>
            </div>`;
          });
          return html;
        },
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: '#1f2937' } },
        axisLabel: { color: '#6b7280', fontSize: 10 },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisLabel: { color: '#6b7280', fontSize: 10 },
        splitLine: { lineStyle: { color: '#1f2937', type: 'dashed' } },
      },
      series: [
        {
          name: '看涨',
          type: 'bar',
          stack: 'sentiment',
          data: data.map((d) => d.bullish_count),
          itemStyle: {
            color: '#EF4444',
            // @ts-ignore borderRadius supports function in ECharts 5
            borderRadius: (d: number) => {
              const idx = data.findIndex((x) => x.bullish_count === d);
              const isLast = idx === data.length - 1;
              return isLast ? [3, 3, 0, 0] : [0, 0, 0, 0];
            },
          },
          barMaxWidth: 32,
        },
        {
          name: '中性',
          type: 'bar',
          stack: 'sentiment',
          data: data.map((d) => d.neutral_count),
          itemStyle: { color: '#F59E0B' },
        },
        {
          name: '看跌',
          type: 'bar',
          stack: 'sentiment',
          data: data.map((d) => d.bearish_count),
          itemStyle: {
            color: '#22C55E',
            // @ts-ignore borderRadius supports function in ECharts 5
            borderRadius: (d: number) => {
              const idx = data.findIndex((x) => x.bearish_count === d);
              const isFirst = idx === 0;
              return isFirst ? [0, 0, 3, 3] : [0, 0, 0, 0];
            },
          },
          barMaxWidth: 32,
        },
      ],
    };
  };

  onMount(() => {
    if (!ref) return;
    chart = echarts.init(ref, 'dark', { renderer: 'canvas' });
    if (!chart) return;
    chart.setOption(buildOption());
    const ro = new ResizeObserver(() => chart?.resize());
    ro.observe(ref);
    onCleanup(() => {
      ro.disconnect();
      chart?.dispose();
    });
  });

  createMemo(() => {
    props.data; // track
    chart?.setOption(buildOption());
  });

  return <div ref={ref} style={{ width: '100%', height: '240px' }} />;
}

// ── News Table Row ──────────────────────────────────────────
function NewsRow(props: { item: NewsItem; type: 'bullish' | 'bearish' }) {
  const scoreColor = () => (props.type === 'bullish' ? 'text-red-400' : 'text-green-400');
  const borderColor = () =>
    props.type === 'bullish'
      ? 'border-red-500/20 hover:border-red-500/40'
      : 'border-green-500/20 hover:border-green-500/40';

  return (
    <tr
      class={`border-b border-white/5 transition-colors cursor-pointer ${borderColor()}`}
      onClick={() => props.item.url && window.open(props.item.url, '_blank')}
    >
      <td class="py-2.5 pr-3 text-xs text-gray-400 w-20">
        {props.item.publish_time?.slice(0, 10)}
      </td>
      <td class="py-2.5 pr-3">
        <div class="text-xs text-gray-100 leading-snug line-clamp-2">{props.item.title}</div>
        <div class="text-xs text-gray-500 mt-0.5">{props.item.source}</div>
      </td>
      <td class={`py-2.5 pr-3 text-right font-mono text-xs font-bold w-16 ${scoreColor()}`}>
        {props.item.sentiment_score}
      </td>
    </tr>
  );
}

// ── Main Component ──────────────────────────────────────────
const Sentiment: Component = () => {
  const [tsCode, setTsCode] = createSignal('000001.SH');
  const [summary, setSummary] = createSignal<SentimentSummary | null>(null);
  const [allNews, setAllNews] = createSignal<NewsItem[]>([]);
  const [dailyData, setDailyData] = createSignal<DailySentiment[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [activeView, setActiveView] = createSignal<'overview' | 'bullish' | 'bearish'>('overview');

  // Top news derived
  const topBullish = createMemo(() =>
    allNews()
      .filter((n) => n.sentiment === 'bullish')
      .sort((a, b) => b.sentiment_score - a.sentiment_score)
      .slice(0, 15)
  );

  const topBearish = createMemo(() =>
    allNews()
      .filter((n) => n.sentiment === 'bearish')
      .sort((a, b) => a.sentiment_score - b.sentiment_score)
      .slice(0, 15)
  );

  // Build daily distribution from news
  function buildDailyData(news: NewsItem[]): DailySentiment[] {
    const map = new Map<string, DailySentiment>();
    news.forEach((item) => {
      const date = item.publish_time?.slice(0, 10) ?? 'unknown';
      if (!map.has(date)) {
        map.set(date, {
          date,
          bullish_count: 0,
          bearish_count: 0,
          neutral_count: 0,
          avg_score: 50,
        });
      }
      const entry = map.get(date)!;
      if (item.sentiment === 'bullish') entry.bullish_count++;
      else if (item.sentiment === 'bearish') entry.bearish_count++;
      else entry.neutral_count++;
    });
    // Compute avg score per day
    const byDate = new Map<string, number[]>();
    news.forEach((item) => {
      const date = item.publish_time?.slice(0, 10) ?? 'unknown';
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date)!.push(item.sentiment_score);
    });
    map.forEach((entry, date) => {
      const scores = byDate.get(date) ?? [];
      entry.avg_score = scores.length
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 50;
    });
    return Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14);
  }

  async function loadData() {
    setLoading(true);
    try {
      const res = await apiFetch<{ summary: SentimentSummary; news: NewsItem[] }>(
        `/api/news/sentiment?ts_code=${encodeURIComponent(tsCode())}`
      );
      if (res.code === '0' && res.data) {
        setSummary(res.data.summary);
        const news = res.data.news ?? [];
        setAllNews(news);
        setDailyData(buildDailyData(news));
      }
    } catch {
      // fallback: generate demo data
      setSummary({
        ts_code: tsCode(),
        bullish_pct: 48.5,
        bearish_pct: 23.1,
        neutral_pct: 28.4,
        sentiment_index: 62,
        news_count: 28,
        date: new Date().toLocaleDateString('zh-CN'),
      });
      const demo: DailySentiment[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const date = d.toISOString().slice(0, 10);
        demo.push({
          date,
          bullish_count: Math.floor(Math.random() * 8 + 2),
          bearish_count: Math.floor(Math.random() * 5 + 1),
          neutral_count: Math.floor(Math.random() * 4 + 1),
          avg_score: Math.round(Math.random() * 30 + 45),
        });
      }
      setDailyData(demo);
      setAllNews([]);
    } finally {
      setLoading(false);
    }
  }

  onMount(() => loadData());

  return (
    <div class="h-full overflow-auto bg-[#0A0E17] p-4 space-y-4">
      {/* ── Header ── */}
      <div class="flex items-center justify-between shrink-0">
        <div class="flex items-center gap-3">
          <h2 class="text-sm font-bold text-white">📊 情感分析舆情监控</h2>
          {/* View toggle */}
          <div class="flex rounded border border-white/10 overflow-hidden">
            <button
              class={`px-3 py-1 text-xs font-medium transition-colors ${activeView() === 'overview' ? 'bg-blue-600 text-white' : 'bg-[#1f2937] text-gray-400 hover:text-white'}`}
              onClick={() => setActiveView('overview')}
            >
              总览
            </button>
            <button
              class={`px-3 py-1 text-xs font-medium transition-colors ${activeView() === 'bullish' ? 'bg-red-600 text-white' : 'bg-[#1f2937] text-gray-400 hover:text-white'}`}
              onClick={() => setActiveView('bullish')}
            >
              🔴 高正面
            </button>
            <button
              class={`px-3 py-1 text-xs font-medium transition-colors ${activeView() === 'bearish' ? 'bg-green-600 text-white' : 'bg-[#1f2937] text-gray-400 hover:text-white'}`}
              onClick={() => setActiveView('bearish')}
            >
              🟢 高负面
            </button>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <input
            type="text"
            value={tsCode()}
            onInput={(e) => setTsCode(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadData()}
            placeholder="股票代码，如 000001.SH"
            class="bg-[#1f2937] border border-white/10 rounded px-2 py-1 text-xs text-gray-200 w-36 focus:outline-none focus:border-blue-500/50"
          />
          <button
            class="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded font-medium transition-colors"
            onClick={loadData}
          >
            查询
          </button>
        </div>
      </div>

      {/* ── Sentiment Index KPI Row ── */}
      <Show when={!loading() && summary()}>
        <div class="grid grid-cols-4 gap-3 shrink-0">
          <div class={`${CARD} p-3 flex flex-col gap-1`}>
            <div class="text-xs text-gray-500">舆情指数</div>
            <div
              class={`text-2xl font-bold font-mono ${
                (summary()?.sentiment_index ?? 50) > 60
                  ? 'text-red-400'
                  : (summary()?.sentiment_index ?? 50) < 40
                    ? 'text-green-400'
                    : 'text-yellow-400'
              }`}
            >
              {summary()?.sentiment_index ?? '—'}
            </div>
            <div class="text-xs text-gray-600">综合市场情绪</div>
          </div>
          <div class={`${CARD} p-3 flex flex-col gap-1`}>
            <div class="text-xs text-gray-500">看涨占比</div>
            <div class="text-2xl font-bold font-mono text-red-400">
              {summary()?.bullish_pct?.toFixed(1) ?? '—'}%
            </div>
            <div class="text-xs text-gray-600">正面新闻比例</div>
          </div>
          <div class={`${CARD} p-3 flex flex-col gap-1`}>
            <div class="text-xs text-gray-500">看跌占比</div>
            <div class="text-2xl font-bold font-mono text-green-400">
              {summary()?.bearish_pct?.toFixed(1) ?? '—'}%
            </div>
            <div class="text-xs text-gray-600">负面新闻比例</div>
          </div>
          <div class={`${CARD} p-3 flex flex-col gap-1`}>
            <div class="text-xs text-gray-500">新闻总数</div>
            <div class="text-2xl font-bold font-mono text-white">
              {summary()?.news_count ?? '—'}
            </div>
            <div class="text-xs text-gray-600">{summary()?.date ?? ''}</div>
          </div>
        </div>
      </Show>

      {/* Loading skeleton for KPIs */}
      <Show when={loading()}>
        <div class="grid grid-cols-4 gap-3 shrink-0">
          <For each={[1, 2, 3, 4]}>
            {() => (
              <div class={`${CARD} p-3 animate-pulse`}>
                <div class="h-3 bg-white/5 rounded w-16 mb-2" />
                <div class="h-8 bg-white/5 rounded w-20 mb-2" />
                <div class="h-3 bg-white/5 rounded w-24" />
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* ── Bar Chart: Daily Sentiment Distribution ── */}
      <Show when={activeView() === 'overview'}>
        <div class={`${CARD} p-4`}>
          <div class="flex items-center justify-between mb-3">
            <div class="text-xs font-semibold text-gray-300">日均情感分布（近14日）</div>
            <div class="flex items-center gap-4 text-xs text-gray-500">
              <span class="flex items-center gap-1">
                <span class="w-2 h-2 rounded-sm bg-red-500 inline-block" />
                看涨
              </span>
              <span class="flex items-center gap-1">
                <span class="w-2 h-2 rounded-sm bg-yellow-500 inline-block" />
                中性
              </span>
              <span class="flex items-center gap-1">
                <span class="w-2 h-2 rounded-sm bg-green-500 inline-block" />
                看跌
              </span>
            </div>
          </div>
          <Show
            when={!loading() && dailyData().length > 0}
            fallback={
              <div class="h-60 flex items-center justify-center">
                <span class="text-xs text-gray-500 animate-pulse">加载中…</span>
              </div>
            }
          >
            <SentimentBarChart data={dailyData()} />
          </Show>
        </div>
      </Show>

      {/* ── News Tables ── */}
      <Show when={activeView() !== 'overview'}>
        {/* Bullish Table */}
        <Show when={activeView() === 'bullish'}>
          <div class={`${CARD} p-4`}>
            <div class="flex items-center justify-between mb-3">
              <div class="text-xs font-semibold text-red-400">🔴 高正面新闻 TOP15</div>
              <div class="text-xs text-gray-500">{topBullish().length} 条</div>
            </div>
            <Show
              when={topBullish().length > 0}
              fallback={
                <div class="h-32 flex items-center justify-center">
                  <span class="text-xs text-gray-500">暂无正面新闻数据</span>
                </div>
              }
            >
              <div class="overflow-x-auto max-h-96 overflow-y-auto">
                <table class="w-full text-xs">
                  <thead class="sticky top-0 bg-[#1f2937] z-10">
                    <tr class="text-gray-500 border-b border-white/10">
                      <th class="text-left py-2 pr-3 font-medium w-20">日期</th>
                      <th class="text-left py-2 pr-3 font-medium">标题 / 来源</th>
                      <th class="text-right py-2 font-medium w-16">情感分</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={topBullish()}>
                      {(item) => <NewsRow item={item} type="bullish" />}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
          </div>
        </Show>

        {/* Bearish Table */}
        <Show when={activeView() === 'bearish'}>
          <div class={`${CARD} p-4`}>
            <div class="flex items-center justify-between mb-3">
              <div class="text-xs font-semibold text-green-400">🟢 高负面新闻 TOP15</div>
              <div class="text-xs text-gray-500">{topBearish().length} 条</div>
            </div>
            <Show
              when={topBearish().length > 0}
              fallback={
                <div class="h-32 flex items-center justify-center">
                  <span class="text-xs text-gray-500">暂无负面新闻数据</span>
                </div>
              }
            >
              <div class="overflow-x-auto max-h-96 overflow-y-auto">
                <table class="w-full text-xs">
                  <thead class="sticky top-0 bg-[#1f2937] z-10">
                    <tr class="text-gray-500 border-b border-white/10">
                      <th class="text-left py-2 pr-3 font-medium w-20">日期</th>
                      <th class="text-left py-2 pr-3 font-medium">标题 / 来源</th>
                      <th class="text-right py-2 font-medium w-16">情感分</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={topBearish()}>
                      {(item) => <NewsRow item={item} type="bearish" />}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
          </div>
        </Show>
      </Show>
    </div>
  );
};

export default Sentiment;
