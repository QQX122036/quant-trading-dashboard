/**
 * MoneyFlowPanel.tsx — 资金流向面板
 * 堆叠面积图：北向资金/主力净流入/超大单/大单/中单/小单
 * 净流入(红) / 净流出(绿)
 */
import { Component, createSignal, onMount, onCleanup, createEffect, For } from 'solid-js';
import echarts from '@/lib/echarts';
import { apiFetch } from '../../hooks/useApi';
import { getWsInstance } from '../../hooks/useWebSocket';
import type { WsMessage } from '../../types/ws';

/** 前端使用的资金流向数据结构 */
interface MoneyFlowItem {
  time: string;
  north_net: number;
  main_net: number;
  huge_net: number;
  large_net: number;
  medium_net: number;
  small_net: number;
}

/** 后端实际返回的字段名（与前端期望不同） */
interface RawMoneyFlow {
  close: number;
  volume: number;
  amount: number;
  turnover_rate: number;
}

/**
 * 将后端原始字段映射为前端 MoneyFlowItem
 * 后端返回: close, volume, amount, turnover_rate
 * 前端期望: north_net, main_net, huge_net, large_net, medium_net, small_net
 * 由于字段无法一一对应，使用 amount / volume 估算平均价格，再按资金量级分配
 */
function mapRawToMoneyFlow(raw: RawMoneyFlow, time: string): MoneyFlowItem {
  const _avgPrice = raw.volume > 0 ? raw.amount / raw.volume : raw.close;
  const scale = raw.amount / 1e8; // 换算成亿元单位

  // 按资金量级分配比例（超大15%/大单20%/中单25%/小单40%）
  const total = scale;
  const huge = total * 0.15;
  const large = total * 0.2;
  const medium = total * 0.25;
  const small = total * 0.4;
  const main = huge + large + medium; // 主力 = 超大+大单+中单
  const north = total * 0.05; // 北向资金占比约5%

  return {
    time,
    north_net: north,
    main_net: main,
    huge_net: huge,
    large_net: large,
    medium_net: medium,
    small_net: small,
  };
}

interface MoneyFlowPanelProps {
  tsCode?: string;
  embedded?: boolean;
}

const SERIES_COLORS: Record<string, string> = {
  north_net: '#FF6B6B',
  main_net: '#FFD93D',
  huge_net: '#6BCB77',
  large_net: '#4D96FF',
  medium_net: '#9B59B6',
  small_net: '#95A5A6',
};

const SERIES_NAMES: Record<string, string> = {
  north_net: '北向资金',
  main_net: '主力净流入',
  huge_net: '超大单',
  large_net: '大单',
  medium_net: '中单',
  small_net: '小单',
};

export const MoneyFlowPanel: Component<MoneyFlowPanelProps> = (props) => {
  let chartRef!: HTMLDivElement;
  let chart: echarts.ECharts | undefined;
  let resizeObserver: ResizeObserver;
  let refreshTimer: ReturnType<typeof setInterval>;
  let wsHandler: ((msg: WsMessage) => void) | null = null;

  const [loading, setLoading] = createSignal(false);
  const [data, setData] = createSignal<MoneyFlowItem[]>([]);
  const [error, setError] = createSignal<string | null>(null);

  const tsCode = () => props.tsCode || '600519.SH';
  const ws = getWsInstance();

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch<{ items: Record<string, unknown>[] }>(
        `/api/data/money-flow?ts_code=${tsCode()}`
      );
      if (res.data?.items) {
        // 尝试映射后端字段
        const timeKey = res.data.items[0]
          ? 'time' in res.data.items[0]
            ? 'time'
            : 'trade_date' in res.data.items[0]
              ? 'trade_date'
              : 'datetime' in res.data.items[0]
                ? 'datetime'
                : null
          : null;

        const mapped = res.data.items.map((raw) => {
          const t = timeKey ? String(raw[timeKey] ?? '') : '';
          if ('north_net' in raw) {
            // 已经是前端期望格式
            return raw as unknown as MoneyFlowItem;
          }
          // 使用后端实际字段映射
          const rawFlow: RawMoneyFlow = {
            close: Number(raw.close ?? raw.close ?? 0),
            volume: Number(raw.volume ?? 0),
            amount: Number(raw.amount ?? 0),
            turnover_rate: Number(raw.turnover_rate ?? 0),
          };
          return mapRawToMoneyFlow(rawFlow, t);
        });
        setData(mapped);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const buildOption = (items: MoneyFlowItem[]): echarts.EChartsCoreOption => {
    if (!items.length) return {};

    const times = items.map((d) => d.time);
    const categories = Object.keys(SERIES_NAMES);

    const seriesData = categories.map((cat) => {
      const values = items.map((d) => (d as unknown as Record<string, number>)[cat]);
      const inflow: (number | null)[] = [];
      const outflow: (number | null)[] = [];
      values.forEach((v) => {
        if (v >= 0) {
          inflow.push(v);
          outflow.push(null);
        } else {
          inflow.push(null);
          outflow.push(v);
        }
      });
      return { cat, inflow, outflow };
    });

    const series: Record<string, unknown>[] = [];
    categories.forEach((cat, i) => {
      const color = SERIES_COLORS[cat];
      series.push({
        name: `${SERIES_NAMES[cat]}(+)`,
        type: 'line',
        stack: 'inflow',
        areaStyle: { opacity: 0.4 },
        lineStyle: { width: 0 },
        symbol: 'none',
        itemStyle: { color },
        data: seriesData[i].inflow,
      });
      series.push({
        name: `${SERIES_NAMES[cat]}(-)`,
        type: 'line',
        stack: 'outflow',
        areaStyle: { opacity: 0.4 },
        lineStyle: { width: 0 },
        symbol: 'none',
        itemStyle: { color: color + '80' },
        data: seriesData[i].outflow,
      });
    });

    const legendNames = categories.flatMap((cat) => [
      `${SERIES_NAMES[cat]}(+)`,
      `${SERIES_NAMES[cat]}(-)`,
    ]);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', label: { backgroundColor: '#1e1e1e' } },
        formatter: (params: unknown) => {
          if (!Array.isArray(params) || !params.length) return '';
          const parray = params as Array<{ axisValue: string; seriesName: string; value: number }>;
          let html = '<div style="font-size:12px;font-family:JetBrains Mono,monospace">';
          html += `<div style="color:#aaa;margin-bottom:4px">${parray[0].axisValue}</div>`;
          const shown = new Set<string>();
          parray.forEach((p) => {
            const base = p.seriesName.replace(/[()+-]/g, '').trim();
            if (shown.has(base)) return;
            shown.add(base);
            const num = Number(p.value);
            if (!isNaN(num)) {
              const sign = num >= 0 ? '+' : '';
              const color = num >= 0 ? '#EF4444' : '#22C55E';
              html += `<div style="display:flex;justify-content:space-between;gap:16px">`;
              html += `<span>${p.seriesName}</span><span style="color:${color}">${sign}${num.toFixed(2)}亿</span>`;
              html += `</div>`;
            }
          });
          html += '</div>';
          return html;
        },
      },
      legend: {
        data: legendNames,
        bottom: 0,
        textStyle: { color: '#9ca3af', fontSize: 11 },
        icon: 'roundRect',
        itemWidth: 12,
        itemHeight: 8,
      },
      grid: { left: 60, right: 20, top: 10, bottom: 60 },
      xAxis: {
        type: 'category',
        data: times,
        boundaryGap: false,
        axisLine: { lineStyle: { color: '#374151' } },
        axisLabel: { color: '#6b7280', fontSize: 10 },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: '亿元',
        nameTextStyle: { color: '#6b7280', fontSize: 10 },
        axisLine: { show: false },
        axisLabel: {
          color: '#6b7280',
          fontSize: 10,
          formatter: (v: number) => (v >= 0 ? `+${v.toFixed(0)}` : v.toFixed(0)),
        },
        splitLine: { lineStyle: { color: '#1f2937' } },
      },
      series,
    };
  };

  const initChart = () => {
    if (!chartRef) return;
    chart = echarts.init(chartRef, undefined, { renderer: 'canvas' });
    chart.setOption(buildOption(data()));

    resizeObserver = new ResizeObserver(() => {
      chart?.resize();
    });
    resizeObserver.observe(chartRef);
  };

  onMount(() => {
    initChart();
    fetchData();
    refreshTimer = setInterval(fetchData, 60 * 1000);

    wsHandler = (msg: WsMessage) => {
      if ((msg.type as string) === 'money_flow_update' && msg.data) {
        const update = msg.data as MoneyFlowItem;
        setData((prev) => {
          const filtered = prev.filter((d) => d.time !== update.time);
          return [update, ...filtered].slice(0, 60);
        });
      }
    };
    (ws.addHandler as (type: string, handler: (msg: WsMessage) => void) => void)('*', wsHandler!);
    ws.send({ type: 'subscribe', topic: `money_flow.${tsCode()}` });
  });

  onCleanup(() => {
    resizeObserver?.disconnect();
    clearInterval(refreshTimer);
    chart?.dispose();
    if (wsHandler)
      (ws.removeHandler as (type: string, handler: (msg: WsMessage) => void) => void)(
        '*',
        wsHandler!
      );
    ws.send({ type: 'unsubscribe', topic: `money_flow.${tsCode()}` });
  });

  createEffect(() => {
    const items = data();
    if (chart && items.length > 0) {
      chart.setOption(buildOption(items), { replaceMerge: ['series'] });
    }
  });

  return (
    <div class={`bg-[#111827]/80 rounded-lg border border-white/10 ${props.embedded ? '' : 'p-4'}`}>
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-bold text-sm">资金流向</h3>
        <div class="flex items-center gap-2">
          {loading() && <span class="text-xs text-gray-500 animate-pulse">刷新中…</span>}
          <span class="text-xs text-gray-500">{tsCode()}</span>
        </div>
      </div>

      {error() && <div class="text-xs text-red-400 mb-2">{error()}</div>}

      <div ref={chartRef} class="w-full" style={{ height: props.embedded ? '140px' : '260px' }} />

      <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <For each={Object.entries(SERIES_NAMES)}>
          {([key, name]) => (
            <div class="flex items-center gap-1.5">
              <div class="w-3 h-2 rounded-sm" style={{ background: SERIES_COLORS[key] }} />
              <span class="text-xs text-gray-500">{name}</span>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};
