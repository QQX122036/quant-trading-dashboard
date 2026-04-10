/**
 * NewsSentiment.tsx — 新闻舆情分析模块
 * 路由: /news
 * - 新闻列表 (标题/来源/时间/情感标签 红涨绿跌)
 * - 舆情指数量化 (看涨/看跌/中性 百分比)
 * - ECharts 仪表盘: 舆情指数 0-100
 * - WebSocket 实时推送 news.sentiment
 */
import { Component, createSignal, createMemo, onMount, onCleanup, For, Show } from 'solid-js';
import type * as EChartsType from 'echarts/core';
import type { ECharts } from 'echarts';
import {
  fetchNewsSentiment,
  fetchAnnouncements,
  type NewsItem,
  type SentimentSummary,
  type AnnouncementItem,
} from './api';
import { getWsInstance } from '../../hooks/useWebSocket';

const CARD = 'bg-[#1f2937]/80 rounded-lg border border-white/10';

function SentimentGaugeChart(props: { index: number }) {
  let ref!: HTMLDivElement;
  let chart: ECharts | undefined;

  const option = createMemo((): echarts.EChartsCoreOption => {
    const v = Math.round(props.index);
    const color = v > 60 ? '#22C55E' : v < 40 ? '#EF4444' : '#F59E0B';
    return {
      backgroundColor: 'transparent',
      series: [
        {
          type: 'gauge',
          startAngle: 200,
          endAngle: -20,
          min: 0,
          max: 100,
          radius: '85%',
          pointer: { show: true, length: '55%', width: 3, itemStyle: { color: '#e5e7eb' } },
          progress: {
            show: true,
            width: 12,
            itemStyle: { color },
          },
          axisLine: {
            lineStyle: { width: 12, color: [[1, '#374151']] },
          },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          title: {
            show: true,
            offsetCenter: [0, '75%'],
            color: '#9CA3AF',
            fontSize: 11,
            fontFamily: 'Inter, sans-serif',
          },
          detail: {
            valueAnimation: true,
            fontSize: 22,
            fontWeight: 'bold',
            fontFamily: 'JetBrains Mono, monospace',
            color: '#f3f4f6',
            formatter: '{value}',
            offsetCenter: [0, '30%'],
          },
          data: [{ value: v, name: '舆情指数' }],
        },
      ],
    };
  });

  onMount(async () => {
    const _ec = await import('@/lib/echarts');
    const echarts = _ec.default;
    chart = echarts.init(ref, undefined, { renderer: 'canvas' });
    chart.setOption(option());
    const ro = new ResizeObserver(() => chart?.resize());
    ro.observe(ref);
    onCleanup(() => {
      ro.disconnect();
      chart?.dispose();
    });
  });

  // Update chart when index changes
  createMemo(() => {
    chart?.setOption(option());
  });

  return <div ref={ref} class="w-full" style={{ height: '180px' }} />;
}

function SentimentBar(props: { label: string; value: number; color: string }) {
  return (
    <div class="flex items-center gap-2">
      <span class="text-xs text-gray-400 w-10 shrink-0">{props.label}</span>
      <div class="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-700"
          style={{ width: `${props.value}%`, background: props.color }}
        />
      </div>
      <span class="text-xs font-mono w-10 text-right" style={{ color: props.color }}>
        {props.value.toFixed(1)}%
      </span>
    </div>
  );
}

function NewsItemRow(props: { item: NewsItem }) {
  const sentimentConfig = createMemo(() => {
    switch (props.item.sentiment) {
      case 'bullish':
        return {
          label: '看涨',
          bg: 'bg-red-500/10',
          border: 'border-red-500/30',
          text: 'text-red-400',
        };
      case 'bearish':
        return {
          label: '看跌',
          bg: 'bg-green-500/10',
          border: 'border-green-500/30',
          text: 'text-green-400',
        };
      default:
        return {
          label: '中性',
          bg: 'bg-yellow-500/10',
          border: 'border-yellow-500/30',
          text: 'text-yellow-400',
        };
    }
  });

  return (
    <div
      class={`flex items-start gap-3 p-3 rounded border ${sentimentConfig().border} ${sentimentConfig().bg} hover:bg-white/5 transition-colors cursor-pointer`}
    >
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium text-gray-100 leading-snug line-clamp-2">
          {props.item.title}
        </div>
        <div class="flex items-center gap-2 mt-1">
          <span class="text-xs text-gray-500">{props.item.source}</span>
          <span class="text-xs text-gray-600">·</span>
          <span class="text-xs text-gray-500">{props.item.publish_time}</span>
        </div>
      </div>
      <div
        class={`shrink-0 text-xs px-2 py-0.5 rounded border ${sentimentConfig().bg} ${sentimentConfig().border} ${sentimentConfig().text} font-medium`}
      >
        {sentimentConfig().label}
      </div>
    </div>
  );
}

function AnnouncementItemRow(props: { item: AnnouncementItem }) {
  const typeColor = createMemo(() => {
    const t = props.item.announcement_type;
    if (t.includes('业绩') || t.includes('年报')) return 'text-purple-400';
    if (t.includes('分红')) return 'text-pink-400';
    if (t.includes('并购')) return 'text-orange-400';
    if (t.includes('股权')) return 'text-cyan-400';
    return 'text-gray-400';
  });

  return (
    <div
      class={`flex items-start gap-3 p-3 rounded border border-white/5 hover:bg-white/5 transition-colors ${props.item.is_important ? 'bg-red-500/5 border-red-500/20' : ''}`}
    >
      <Show when={props.item.is_important}>
        <span class="shrink-0 text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded font-medium">
          !
        </span>
      </Show>
      <div class="flex-1 min-w-0">
        <div class="text-sm text-gray-100 leading-snug line-clamp-2">{props.item.title}</div>
        <div class="flex items-center gap-2 mt-1">
          <span class={`text-xs ${typeColor()} font-medium`}>{props.item.announcement_type}</span>
          <span class="text-xs text-gray-600">·</span>
          <span class="text-xs text-gray-500">{props.item.exchange}</span>
          <span class="text-xs text-gray-600">·</span>
          <span class="text-xs text-gray-500">{props.item.publish_time}</span>
        </div>
      </div>
    </div>
  );
}

function RealtimeToast(props: { news: NewsItem | null; onClose: () => void }) {
  return (
    <Show when={props.news}>
      <div class="fixed top-4 right-4 z-[9999] animate-slide-in-right">
        <div
          class={`max-w-sm rounded-lg border ${props.news!.sentiment === 'bullish' ? 'bg-red-900/90 border-red-500/50' : props.news!.sentiment === 'bearish' ? 'bg-green-900/90 border-green-500/50' : 'bg-yellow-900/90 border-yellow-500/50'} backdrop-blur-sm shadow-2xl p-4`}
        >
          <div class="flex items-start gap-3">
            <div class="shrink-0 mt-0.5">
              <div
                class={`w-2 h-2 rounded-full ${props.news!.sentiment === 'bullish' ? 'bg-red-400' : props.news!.sentiment === 'bearish' ? 'bg-green-400' : 'bg-yellow-400'} animate-pulse`}
              />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-xs text-gray-300 mb-1">📰 实时舆情</div>
              <div class="text-sm text-white font-medium leading-snug line-clamp-2">
                {props.news!.title}
              </div>
              <div class="flex items-center gap-2 mt-1">
                <span class="text-xs text-gray-400">{props.news!.source}</span>
                <span
                  class={`text-xs px-1.5 py-0.5 rounded font-medium ${props.news!.sentiment === 'bullish' ? 'text-red-300 bg-red-500/20' : props.news!.sentiment === 'bearish' ? 'text-green-300 bg-green-500/20' : 'text-yellow-300 bg-yellow-500/20'}`}
                >
                  {props.news!.sentiment === 'bullish'
                    ? '看涨'
                    : props.news!.sentiment === 'bearish'
                      ? '看跌'
                      : '中性'}
                </span>
              </div>
            </div>
            <button
              class="shrink-0 text-gray-400 hover:text-white transition-colors"
              onClick={props.onClose}
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}

export const NewsSentiment: Component = () => {
  const [tsCode, setTsCode] = createSignal('600519.SH');
  const [summary, setSummary] = createSignal<SentimentSummary | null>(null);
  const [news, setNews] = createSignal<NewsItem[]>([]);
  const [announcements, setAnnouncements] = createSignal<AnnouncementItem[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [loadingAnn, setLoadingAnn] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<'news' | 'announcements'>('news');
  const [annType, setAnnType] = createSignal<string>('');
  const [realtimeNews, setRealtimeNews] = createSignal<NewsItem | null>(null);
  const [toastVisible, setToastVisible] = createSignal(false);
  const [toastTimer, setToastTimer] = createSignal<ReturnType<typeof setTimeout> | null>(null);

  const ANN_TYPES = ['', '业绩预告', '年报', '分红', '并购', '股权变动', '其他'];

  function showToast(newsItem: NewsItem) {
    if (toastTimer()) clearTimeout(toastTimer()!);
    setRealtimeNews(newsItem);
    setToastVisible(true);
    const t = setTimeout(() => setToastVisible(false), 5000);
    setToastTimer(t);
  }

  // WebSocket 实时推送
  function setupWS() {
    try {
      const ws = getWsInstance();
      if (ws.status() !== 'connected') {
        ws.connect();
      }

      const handler = (msg: { type: string; data: NewsItem }) => {
        if (msg.type === 'news.sentiment' && msg.data) {
          const incoming = msg.data as NewsItem;
          setNews((prev) => [incoming, ...prev.slice(0, 19)]);
          if (summary()) {
            setSummary((prev) =>
              prev
                ? {
                    ...prev,
                    news_count: prev.news_count + 1,
                    sentiment_index: Math.round(
                      (prev.sentiment_index * prev.news_count + incoming.sentiment_score) /
                        (prev.news_count + 1)
                    ),
                  }
                : null
            );
          }
          showToast(incoming);
        }
      };

      ws.addHandler('news.sentiment' as any, handler as never);
      onCleanup(() => ws.removeHandler('news.sentiment' as any, handler as never));
    } catch {
      // WebSocket 不可用，静默降级
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      const [sentRes, _newsRes] = await Promise.allSettled([
        fetchNewsSentiment(tsCode()),
        fetchNewsSentiment(tsCode()),
      ]);
      if (sentRes.status === 'fulfilled' && sentRes.value.code === '0' && sentRes.value.data) {
        setSummary(sentRes.value.data.summary);
        setNews(sentRes.value.data.news || []);
      }
    } catch (e) {
      // 使用默认数据
      setSummary({
        ts_code: tsCode(),
        bullish_pct: 45,
        bearish_pct: 25,
        neutral_pct: 30,
        sentiment_index: 58,
        news_count: 12,
        date: new Date().toLocaleDateString('zh-CN'),
      });
      setNews([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadAnnouncements() {
    setLoadingAnn(true);
    try {
      const res = await fetchAnnouncements(tsCode(), annType() || undefined);
      if (res.code === '0' && res.data) {
        setAnnouncements(res.data.items || []);
      }
    } catch {
      setAnnouncements([]);
    } finally {
      setLoadingAnn(false);
    }
  }

  onMount(async () => {
    const _ec = await import('@/lib/echarts');
    const echarts = _ec.default;
    loadData();
    loadAnnouncements();
    setupWS();
  });

  const sentimentLabel = createMemo(() => {
    const s = summary()?.sentiment_index ?? 50;
    if (s >= 65) return { text: '偏多', color: '#22C55E' };
    if (s <= 35) return { text: '偏空', color: '#EF4444' };
    return { text: '中性', color: '#F59E0B' };
  });

  return (
    <div class="h-full flex flex-col overflow-hidden bg-[#0A0E17]">
      {/* ── Toast 通知 ── */}
      <RealtimeToast news={realtimeNews()} onClose={() => setToastVisible(false)} />

      {/* ── Header ── */}
      <div class="shrink-0 px-4 pt-3 pb-2 flex items-center justify-between border-b border-white/5">
        <div class="flex items-center gap-3">
          <h2 class="font-bold text-sm text-white">📰 舆情监控</h2>
          <div class="flex rounded border border-white/10 overflow-hidden">
            <button
              class={`px-3 py-1 text-xs font-medium transition-colors ${activeTab() === 'news' ? 'bg-blue-600 text-white' : 'bg-[#1f2937] text-gray-400 hover:text-white'}`}
              onClick={() => setActiveTab('news')}
            >
              新闻舆情
            </button>
            <button
              class={`px-3 py-1 text-xs font-medium transition-colors ${activeTab() === 'announcements' ? 'bg-blue-600 text-white' : 'bg-[#1f2937] text-gray-400 hover:text-white'}`}
              onClick={() => setActiveTab('announcements')}
            >
              公告快讯
            </button>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <input
            type="text"
            value={tsCode()}
            onInput={(e) => setTsCode(e.currentTarget.value)}
            onKeyDown={(e) =>
              e.key === 'Enter' && (activeTab() === 'news' ? loadData() : loadAnnouncements())
            }
            placeholder="股票代码，如 600519.SH"
            class="bg-[#1f2937] border border-white/10 rounded px-2 py-1 text-xs text-gray-200 w-36 focus:outline-none focus:border-blue-500/50"
          />
          <button
            class="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded font-medium transition-colors"
            onClick={() => (activeTab() === 'news' ? loadData() : loadAnnouncements())}
          >
            查询
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div
        class="flex-1 overflow-hidden flex"
        style={{ display: activeTab() === 'news' ? 'flex' : 'none' }}
      >
        <div class="flex-1 flex flex-col overflow-hidden p-3 gap-3">
          {/* 舆情仪表盘 + 指标 */}
          <div class={`${CARD} p-3 flex gap-3 shrink-0`}>
            <div class="w-48 shrink-0">
              <SentimentGaugeChart index={summary()?.sentiment_index ?? 50} />
            </div>
            <div class="flex-1 flex flex-col justify-center gap-2">
              <div class="text-xs text-gray-500 mb-1">舆情指数量化</div>
              <SentimentBar label="看涨" value={summary()?.bullish_pct ?? 0} color="#EF4444" />
              <SentimentBar label="看跌" value={summary()?.bearish_pct ?? 0} color="#22C55E" />
              <SentimentBar label="中性" value={summary()?.neutral_pct ?? 0} color="#F59E0B" />
              <div class="flex items-center justify-between mt-1">
                <span class="text-xs text-gray-500">综合判断</span>
                <span class="text-sm font-bold" style={{ color: sentimentLabel().color }}>
                  {sentimentLabel().text}
                </span>
              </div>
              <div class="text-xs text-gray-500">
                共 {summary()?.news_count ?? 0} 条新闻 · {summary()?.date ?? ''}
              </div>
            </div>
          </div>

          {/* 新闻列表 */}
          <div class="flex-1 overflow-y-auto space-y-1.5 pr-1">
            <div class="text-xs text-gray-500 mb-1 font-medium">最新新闻</div>
            <Show
              when={!loading()}
              fallback={
                <div class="flex items-center justify-center h-20">
                  <span class="text-xs text-gray-500 animate-pulse">加载中…</span>
                </div>
              }
            >
              <For
                each={news()}
                fallback={<div class="text-xs text-gray-600 text-center py-4">暂无新闻数据</div>}
              >
                {(item) => <NewsItemRow item={item} />}
              </For>
            </Show>
          </div>
        </div>
      </div>

      {/* ── 公告快讯 ── */}
      <div
        class="flex-1 overflow-hidden flex"
        style={{ display: activeTab() === 'announcements' ? 'flex' : 'none' }}
      >
        <div class="flex-1 flex flex-col overflow-hidden p-3 gap-3">
          {/* 类型筛选 */}
          <div class={`${CARD} p-3 shrink-0`}>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs text-gray-500">公告类型:</span>
              <For each={ANN_TYPES}>
                {(t) => (
                  <button
                    class={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${annType() === t ? 'bg-blue-600 text-white' : 'bg-[#1f2937] text-gray-400 border border-white/10 hover:text-white'}`}
                    onClick={() => {
                      setAnnType(t);
                      loadAnnouncements();
                    }}
                  >
                    {t || '全部'}
                  </button>
                )}
              </For>
            </div>
          </div>

          {/* 公告列表 */}
          <div class="flex-1 overflow-y-auto space-y-1.5 pr-1">
            <Show
              when={!loadingAnn()}
              fallback={
                <div class="flex items-center justify-center h-20">
                  <span class="text-xs text-gray-500 animate-pulse">加载中…</span>
                </div>
              }
            >
              <For
                each={announcements()}
                fallback={<div class="text-xs text-gray-600 text-center py-4">暂无公告数据</div>}
              >
                {(item) => <AnnouncementItemRow item={item} />}
              </For>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
};
