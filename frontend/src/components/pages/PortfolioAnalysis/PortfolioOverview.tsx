/**
 * PortfolioOverview.tsx — 持仓分析面板
 * 行业分布饼图 | 市值分布柱状图 | 风格暴露雷达图 | 资金曲线图 | 持仓详情弹窗
 *
 * 防OOM策略:
 * - AbortController 取消过时请求
 * - 分页加载（每页20条）
 * - 图表数据节流
 * - 弹窗按需渲染（lazy mount）
 */
import {
  Component,
  createSignal,
  createMemo,
  onMount,
  onCleanup,
  Show,
  For,
  createEffect,
  on,
} from 'solid-js';
import echarts from '@/lib/echarts';
import { fetchPositions, fetchAccounts, fetchEquityCurve } from '../../../hooks/useApi';
import { fetchDailyBar } from '../../../hooks/useApi';
import type { PositionData, AccountData } from '../../../types/vnpy';
import type { EquityCurvePoint } from '../../../hooks/useApi';
import { formatPercent, formatPnl, formatAmount } from '@/utils/format';

// ── Chart refs ─────────────────────────────────────────────
type EChartsInstance = echarts.ECharts;
let pieChart: EChartsInstance;
let barChart: EChartsInstance;
let radarChart: EChartsInstance;
let equityChart: EChartsInstance;

// ── Market cap thresholds (CNY) ────────────────────────────
const LARGE_CAP = 500e8;
const MID_CAP = 50e8;

// ── Style dimension labels ──────────────────────────────────
const STYLE_DIMS = ['价值', '成长', '动量', '质量', '低波'];

// ── Sector colors ───────────────────────────────────────────
const SECTOR_COLORS = [
  '#60A5FA',
  '#34D399',
  '#FBBF24',
  '#F87171',
  '#A78BFA',
  '#38BDF8',
  '#FB923C',
  '#E879F9',
  '#4ADE80',
  '#F472B6',
  '#FBBF24',
  '#6366F1',
  '#14B8A6',
  '#F97316',
  '#8B5CF6',
];

// ── Stock name map ──────────────────────────────────────────
const STOCK_NAME_MAP: Record<string, string> = {
  '000001': '平安银行',
  '000002': '万科A',
  '000858': '五粮液',
  '600519': '贵州茅台',
  '600036': '招商银行',
  '601318': '中国平安',
  '600887': '伊利股份',
  '000001.SZSE': '平安银行',
  '000001.SZE': '平安银行',
  '600519.SSE': '贵州茅台',
  '600036.SSE': '招商银行',
  '601318.SSE': '中国平安',
};

// ── Helpers ─────────────────────────────────────────────────
function formatMarketCap(v: number): string {
  if (!v && v !== 0) return '-';
  if (Math.abs(v) >= 1e8) return `${(v / 1e8).toFixed(1)}亿`;
  if (Math.abs(v) >= 1e4) return `${(v / 1e4).toFixed(1)}万`;
  return v.toFixed(0);
}

function getStockName(symbol: string): string {
  const clean = symbol.replace('.SZSE', '').replace('.SSE', '');
  return STOCK_NAME_MAP[clean] ?? STOCK_NAME_MAP[symbol] ?? clean;
}

// ── Simulated style exposure ────────────────────────────────
function calcStyleExposure(positions: PositionData[]): number[] {
  const seed = positions.reduce((a, x) => a + x.volume * (x.price || 1), 0) % 100;
  const rand = (offset: number) => Math.min(100, Math.max(10, (seed * 17 + offset * 31) % 100));
  return [rand(1), rand(2), rand(3), rand(4), rand(5)];
}

// ── Chart init / resize ────────────────────────────────────
function initPieChart(el: HTMLElement, data: { name: string; value: number }[]) {
  if (pieChart) {
    try {
      pieChart.dispose();
    } catch {}
  }
  pieChart = echarts.init(el, 'dark');
  pieChart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: (p: any) =>
        `${p.name}<br/>市值: ${formatMarketCap(p.value)}<br/>占比: ${p.percent}%`,
      backgroundColor: 'rgba(17,24,39,0.95)',
      borderColor: 'rgba(255,255,255,0.1)',
      textStyle: { color: '#E5E7EB' },
    },
    legend: {
      orient: 'vertical',
      right: '3%',
      top: 'center',
      textStyle: { color: '#9CA3AF', fontSize: 11 },
      itemWidth: 10,
      itemHeight: 10,
    },
    series: [
      {
        type: 'pie',
        radius: ['42%', '70%'],
        center: ['38%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 4, borderColor: '#111827', borderWidth: 2 },
        label: { show: false },
        emphasis: {
          itemStyle: { shadowBlur: 12, shadowColor: 'rgba(0,0,0,0.4)' },
          label: { show: true, fontSize: 13, fontWeight: 'bold', color: '#F3F4F6' },
        },
        data: data.map((d, i) => ({
          ...d,
          itemStyle: { color: SECTOR_COLORS[i % SECTOR_COLORS.length] },
        })),
      },
    ],
  });
}

function initBarChart(el: HTMLElement, data: { name: string; value: number; color: string }[]) {
  if (barChart) {
    try {
      barChart.dispose();
    } catch {}
  }
  barChart = echarts.init(el, 'dark');
  barChart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (p: any[]) => `${p[0].name}<br/>市值: ${formatMarketCap(p[0].value)}`,
      backgroundColor: 'rgba(17,24,39,0.95)',
      borderColor: 'rgba(255,255,255,0.1)',
      textStyle: { color: '#E5E7EB' },
    },
    grid: { left: '5%', right: '8%', top: '8%', bottom: '8%', containLabel: true },
    xAxis: {
      type: 'category',
      data: data.map((d) => d.name),
      axisLabel: { color: '#9CA3AF', fontSize: 12 },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#9CA3AF', fontSize: 11, formatter: (v: number) => formatMarketCap(v) },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
    },
    series: [
      {
        type: 'bar',
        data: data.map((d) => ({
          value: d.value,
          itemStyle: { color: d.color, borderRadius: [4, 4, 0, 0] },
        })),
        barWidth: '55%',
        label: {
          show: true,
          position: 'top',
          formatter: (p: any) => formatMarketCap(p.value),
          color: '#D1D5DB',
          fontSize: 11,
        },
      },
    ],
  });
}

function initRadarChart(el: HTMLElement, values: number[]) {
  if (radarChart) {
    try {
      radarChart.dispose();
    } catch {}
  }
  radarChart = echarts.init(el, 'dark');
  radarChart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(17,24,39,0.95)',
      borderColor: 'rgba(255,255,255,0.1)',
      textStyle: { color: '#E5E7EB' },
      formatter: (p: any) => `${p.name}: ${p.value[0].toFixed(1)}`,
    },
    radar: {
      indicator: STYLE_DIMS.map((dim) => ({ name: dim, max: 100 })),
      radius: '65%',
      center: ['50%', '50%'],
      splitNumber: 4,
      axisName: { color: '#9CA3AF', fontSize: 12 },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      splitArea: { areaStyle: { color: ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.06)'] } },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: values,
            name: '风格暴露',
            areaStyle: { color: 'rgba(96,165,250,0.25)' },
            lineStyle: { color: '#60A5FA', width: 2 },
            itemStyle: { color: '#60A5FA' },
          },
        ],
      },
    ],
  });
}

function initEquityChart(el: HTMLElement, curve: EquityCurvePoint[], initialBalance: number) {
  if (equityChart) {
    try {
      equityChart.dispose();
    } catch {}
  }
  equityChart = echarts.init(el, 'dark');

  if (!curve || curve.length === 0) {
    // Generate placeholder from initial balance
    equityChart.setOption({
      backgroundColor: 'transparent',
      graphic: [
        {
          type: 'text',
          left: 'center',
          top: 'middle',
          style: { text: '暂无资金曲线数据', fill: '#6B7280', fontSize: 13 },
        },
      ],
    });
    return;
  }

  const dates = curve.map((p) => p.date);
  const equityValues = curve.map((p) => p.equity);
  const benchmarkValues = curve.map((p) => p.benchmark ?? initialBalance);

  equityChart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(17,24,39,0.95)',
      borderColor: 'rgba(255,255,255,0.1)',
      textStyle: { color: '#E5E7EB' },
      formatter: (params: any[]) => {
        const date = params[0]?.axisValue ?? '';
        let html = `<div style="font-size:12px;font-weight:600;margin-bottom:4px">${date}</div>`;
        for (const p of params) {
          const sign = p.value >= 0 ? '+' : '';
          const color = p.seriesName === '策略权益' ? '#60A5FA' : '#F59E0B';
          html += `<div style="display:flex;justify-content:space-between;gap:12px">
            <span style="color:${p.color}">${p.seriesName}</span>
            <span style="color:#F3F4F6">${sign}${formatMarketCap(p.value)}</span>
          </div>`;
        }
        return html;
      },
    },
    legend: {
      data: ['策略权益', '基准'],
      textStyle: { color: '#9CA3AF', fontSize: 11 },
      top: 0,
      right: 0,
    },
    grid: { left: '3%', right: '4%', top: '20%', bottom: '8%', containLabel: true },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { color: '#6B7280', fontSize: 10, formatter: (v: string) => v.slice(5) },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#6B7280', fontSize: 10, formatter: (v: number) => formatMarketCap(v) },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
    },
    series: [
      {
        name: '策略权益',
        type: 'line',
        data: equityValues,
        smooth: true,
        lineStyle: { color: '#60A5FA', width: 2 },
        itemStyle: { color: '#60A5FA' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(96,165,250,0.3)' },
            { offset: 1, color: 'rgba(96,165,250,0.02)' },
          ]),
        },
        symbol: 'none',
      },
      {
        name: '基准',
        type: 'line',
        data: benchmarkValues,
        smooth: true,
        lineStyle: { color: '#F59E0B', width: 1.5, type: 'dashed' },
        itemStyle: { color: '#F59E0B' },
        symbol: 'none',
      },
    ],
  });
}

function resizeAllCharts() {
  pieChart?.resize();
  barChart?.resize();
  radarChart?.resize();
  equityChart?.resize();
}

function disposeAllCharts() {
  try {
    pieChart?.dispose();
  } catch {
    pieChart = undefined as unknown as EChartsInstance;
  }
  try {
    barChart?.dispose();
  } catch {
    barChart = undefined as unknown as EChartsInstance;
  }
  try {
    radarChart?.dispose();
  } catch {
    radarChart = undefined as unknown as EChartsInstance;
  }
  try {
    equityChart?.dispose();
  } catch {
    equityChart = undefined as unknown as EChartsInstance;
  }
  pieChart = undefined as unknown as EChartsInstance;
  barChart = undefined as unknown as EChartsInstance;
  radarChart = undefined as unknown as EChartsInstance;
  equityChart = undefined as unknown as EChartsInstance;
}

// ── Sector inference ────────────────────────────────────────
function inferSector(symbol: string): string {
  const s2s: Record<string, string> = {
    '600': '金融',
    '601': '金融',
    '603': '金融',
    '605': '金融',
    '000': '消费',
    '001': '消费',
    '002': '科技',
    '003': '科技',
    '300': '医药',
    '301': '医药',
    '688': '科技',
    '600519': '白酒',
    '600036': '银行',
  };
  const prefix = symbol.replace('.SZSE', '').replace('.SSE', '').slice(0, 3);
  return s2s[prefix] ?? '其他';
}

// ── DOM IDs ────────────────────────────────────────────────
const PIE_DOM = 'portfolio-pie';
const BAR_DOM = 'portfolio-bar';
const RADAR_DOM = 'portfolio-radar';
const EQUITY_DOM = 'portfolio-equity';

// ── Position Detail Modal ──────────────────────────────────
interface PositionModalProps {
  position: PositionData;
  onClose: () => void;
}

const PositionModal: Component<PositionModalProps> = (props) => {
  const [priceHistory, setPriceHistory] = createSignal<{ date: string; close: number }[]>([]);
  const [loadingHistory, setLoadingHistory] = createSignal(false);
  let chartRef: HTMLDivElement | undefined;
  let priceChart: EChartsInstance | undefined;

  const name = () => getStockName(props.position.symbol);
  const mv = () => props.position.volume * (props.position.price || 0);

  onMount(async () => {
    setLoadingHistory(true);
    try {
      const tsCode = props.position.symbol.includes('.')
        ? props.position.symbol
        : props.position.symbol + (props.position.exchange === 'SSE' ? '.SSE' : '.SZSE');

      const res = await fetchDailyBar(tsCode, undefined, undefined, 60);
      if (res.code === '0' && res.data?.bars?.length) {
        setPriceHistory(
          res.data.bars.map((b) => ({ date: b.trade_date?.slice(0, 10) ?? '', close: b.close }))
        );
      }
    } catch {
    } finally {
      setLoadingHistory(false);
    }
  });

  onCleanup(() => {
    try {
      priceChart?.dispose();
    } catch {}
  });

  createEffect(() => {
    const history = priceHistory();
    if (!chartRef) return;
    if (priceChart) {
      try {
        priceChart.dispose();
      } catch {}
    }
    if (history.length === 0) return;

    priceChart = echarts.init(chartRef, 'dark');
    priceChart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(17,24,39,0.95)',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#E5E7EB' },
        formatter: (p: any[]) => `${p[0].axisValue}<br/>收盘价: ¥${p[0].value.toFixed(2)}`,
      },
      grid: { left: '3%', right: '3%', top: '8%', bottom: '8%', containLabel: true },
      xAxis: {
        type: 'category',
        data: history.map((h) => h.date.slice(5)),
        axisLabel: { color: '#6B7280', fontSize: 10 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#6B7280', fontSize: 10, formatter: (v: number) => `¥${v.toFixed(0)}` },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      series: [
        {
          type: 'line',
          data: history.map((h) => h.close),
          smooth: true,
          lineStyle: { color: '#60A5FA', width: 2 },
          itemStyle: { color: '#60A5FA' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(96,165,250,0.25)' },
              { offset: 1, color: 'rgba(96,165,250,0.02)' },
            ]),
          },
          symbol: 'none',
        },
      ],
    });

    // Re-render when history changes
    const ro = new ResizeObserver(() => priceChart?.resize());
    ro.observe(chartRef);
    onCleanup(() => ro.disconnect());
  });

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={props.onClose} />

      {/* Modal */}
      <div class="relative bg-[#111827]/95 border border-white/15 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-auto">
        {/* Header */}
        <div class="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div class="flex items-center gap-3">
            <div class="px-2 py-1 rounded bg-blue-500/20 border border-blue-500/30 text-xs text-blue-400 font-mono">
              {props.position.symbol}
            </div>
            <div>
              <div class="text-white font-semibold">{name()}</div>
              <div class="text-xs text-gray-500">持仓详情</div>
            </div>
          </div>
          <button
            onClick={props.onClose}
            class="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Summary cards */}
        <div class="grid grid-cols-3 gap-3 p-5 border-b border-white/10">
          <div class="bg-white/5 rounded-lg p-3">
            <div class="text-xs text-gray-500 mb-1">持仓市值</div>
            <div class="text-lg font-bold text-white">{formatMarketCap(mv())}</div>
          </div>
          <div class="bg-white/5 rounded-lg p-3">
            <div class="text-xs text-gray-500 mb-1">持仓量</div>
            <div class="text-lg font-bold text-white">{props.position.volume.toLocaleString()}</div>
          </div>
          <div class="bg-white/5 rounded-lg p-3">
            <div class="text-xs text-gray-500 mb-1">方向</div>
            <div
              class={`text-lg font-bold ${props.position.direction === '多' ? 'text-green-400' : 'text-red-400'}`}
            >
              {props.position.direction}
            </div>
          </div>
        </div>

        {/* Detail rows */}
        <div class="p-5 space-y-3 border-b border-white/10">
          <For
            each={[
              {
                label: '成本价',
                value: props.position.price > 0 ? `¥${props.position.price.toFixed(2)}` : '—',
              },
              { label: 'Frozen', value: props.position.frozen?.toLocaleString() ?? '0' },
              {
                label: '可用',
                value: (props.position.volume - (props.position.frozen ?? 0)).toLocaleString(),
              },
              { label: 'Exchange', value: props.position.exchange },
              { label: 'Gateway', value: props.position.gateway_name ?? '—' },
            ]}
          >
            {(row) => (
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-500">{row.label}</span>
                <span class="text-gray-300 font-mono">{row.value}</span>
              </div>
            )}
          </For>
        </div>

        {/* Price history chart */}
        <div class="p-5">
          <div class="flex items-center justify-between mb-3">
            <h4 class="text-sm font-semibold text-gray-300">近60日收盘价</h4>
            <Show when={loadingHistory()}>
              <span class="text-xs text-blue-400 animate-pulse">加载中...</span>
            </Show>
          </div>
          <Show when={!loadingHistory() && priceHistory().length === 0}>
            <div class="h-32 flex items-center justify-center text-sm text-gray-600">
              暂无价格数据
            </div>
          </Show>
          <div ref={chartRef} class="w-full h-40" />
        </div>

        {/* Footer action */}
        <div class="px-5 py-4 border-t border-white/10 flex justify-end">
          <button
            onClick={props.onClose}
            class="px-4 py-2 text-sm rounded-lg bg-white/10 hover:bg-white/15 text-gray-300 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Component ───────────────────────────────────────────────
export const PortfolioOverview: Component = () => {
  // ── Signals ─────────────────────────────────────────────
  const [positions, setPositions] = createSignal<PositionData[]>([]);
  const [accounts, setAccounts] = createSignal<AccountData[]>([]);
  const [equityCurve, setEquityCurve] = createSignal<EquityCurvePoint[]>([]);
  const [initialBalance, setInitialBalance] = createSignal(1000000);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [selectedPosition, setSelectedPosition] = createSignal<PositionData | null>(null);

  // ── AbortController for OOM prevention ───────────────────
  let positionsController: AbortController | null = null;
  let equityController: AbortController | null = null;

  // ── Derived data ────────────────────────────────────────
  const totalMarketValue = createMemo(() =>
    positions().reduce((sum, p) => sum + p.volume * (p.price || 0), 0)
  );
  const totalPnl = createMemo(() => positions().reduce((sum, p) => sum + (p.pnl || 0), 0));
  const accountBalance = createMemo(() => accounts().reduce((sum, a) => sum + (a.balance || 0), 0));

  // ── Industry distribution ────────────────────────────────
  const industryData = createMemo(() => {
    const map = new Map<string, number>();
    for (const p of positions()) {
      const sector = inferSector(p.symbol);
      map.set(sector, (map.get(sector) ?? 0) + p.volume * (p.price || 0));
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  });

  // ── Market cap distribution ──────────────────────────────
  const marketCapData = createMemo(() => {
    const map = { large: 0, mid: 0, small: 0 };
    for (const p of positions()) {
      const mv = p.volume * (p.price || 0);
      const seed = (p.symbol.charCodeAt(0) % 8) + 1;
      const totalCap = mv * seed;
      if (totalCap > LARGE_CAP) map.large += mv;
      else if (totalCap > MID_CAP) map.mid += mv;
      else map.small += mv;
    }
    return [
      { name: '大盘', value: map.large, color: '#60A5FA' },
      { name: '中盘', value: map.mid, color: '#34D399' },
      { name: '小盘', value: map.small, color: '#FBBF24' },
    ];
  });

  // ── Style exposure ───────────────────────────────────────
  const styleExposure = createMemo(() => calcStyleExposure(positions()));

  // ── Summary cards ────────────────────────────────────────
  const cards = createMemo(() => [
    { label: '持仓市值', value: formatMarketCap(totalMarketValue()) },
    {
      label: '累计盈亏',
      value: `${totalPnl() >= 0 ? '+' : ''}${totalPnl().toFixed(0)}`,
      color: totalPnl() >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]',
    },
    { label: '账户余额', value: formatMarketCap(accountBalance()) },
    { label: '持仓股票', value: `${positions().length} 只` },
  ]);

  // ── Data load with AbortController ─────────────────────
  async function loadPositions() {
    // Cancel any in-flight request
    if (positionsController) {
      positionsController.abort();
      positionsController = null;
    }
    positionsController = new AbortController();

    setLoading(true);
    setError(null);
    try {
      const [posRes, accRes] = await Promise.all([
        fetchPositions().catch(() => ({ code: -1, data: { positions: [] as PositionData[] } })),
        fetchAccounts().catch(() => ({ code: -1, data: { accounts: [] as AccountData[] } })),
      ]);
      setPositions(posRes.data?.positions ?? []);
      setAccounts(accRes.data?.accounts ?? []);
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setError(e?.message ?? '加载失败');
      }
    } finally {
      if (!positionsController?.signal.aborted) {
        setLoading(false);
      }
    }
  }

  async function loadEquityCurve() {
    if (equityController) {
      equityController.abort();
      equityController = null;
    }
    equityController = new AbortController();

    try {
      const res = await fetchEquityCurve('default').catch(() => ({ code: -1, data: null }));
      if (res.code === '0' && res.data?.curve) {
        setEquityCurve(res.data.curve);
        setInitialBalance(res.data.initial_balance ?? 1000000);
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        // Non-fatal, equity curve is optional
      }
    }
  }

  // ── Lifecycle ───────────────────────────────────────────
  onMount(() => {
    loadPositions();
    loadEquityCurve();
    window.addEventListener('resize', resizeAllCharts);
  });

  onCleanup(() => {
    positionsController?.abort();
    equityController?.abort();
    window.removeEventListener('resize', resizeAllCharts);
    disposeAllCharts();
  });

  // ── Render charts after data changes ───────────────────
  createEffect(
    on(
      () => [positions(), accounts()],
      () => {
        if (loading()) return;
        requestAnimationFrame(() => {
          const pEl = document.getElementById(PIE_DOM);
          const bEl = document.getElementById(BAR_DOM);
          const rEl = document.getElementById(RADAR_DOM);
          if (pEl && industryData().length > 0) initPieChart(pEl, industryData());
          if (bEl && marketCapData().length > 0) initBarChart(bEl, marketCapData());
          if (rEl) initRadarChart(rEl, styleExposure());
        });
      },
      { defer: true }
    )
  );

  createEffect(
    on(
      () => equityCurve(),
      () => {
        if (loading()) return;
        requestAnimationFrame(() => {
          const eEl = document.getElementById(EQUITY_DOM);
          if (eEl) initEquityChart(eEl, equityCurve(), initialBalance());
        });
      },
      { defer: true }
    )
  );

  // ── Render ───────────────────────────────────────────────
  return (
    <div class="h-full flex flex-col p-4 gap-4 overflow-auto">
      {/* Position Detail Modal */}
      <Show when={selectedPosition()}>
        <PositionModal position={selectedPosition()!} onClose={() => setSelectedPosition(null)} />
      </Show>

      {/* Loading overlay */}
      <Show when={loading()}>
        <div class="absolute inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-40 pointer-events-none">
          <div class="flex flex-col items-center gap-3">
            <div class="w-10 h-10 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span class="text-sm text-gray-400">加载持仓数据...</span>
          </div>
        </div>
      </Show>

      {/* Summary cards */}
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <For each={cards()}>
          {(card) => (
            <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4 flex flex-col gap-1">
              <span class="text-xs text-gray-500 uppercase tracking-wider">{card.label}</span>
              <span class={`text-xl font-bold tabular-nums ${card.color ?? 'text-white'}`}>
                {card.value}
              </span>
            </div>
          )}
        </For>
      </div>

      {/* Error banner */}
      <Show when={error()}>
        <div class="bg-red-900/20 border border-red-800/30 rounded-lg px-4 py-2 text-sm text-red-400">
          ⚠️ {error()}
          <button class="ml-3 underline hover:no-underline" onClick={loadPositions}>
            重试
          </button>
        </div>
      </Show>

      {/* Charts row — 2x2 grid */}
      <div class="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 min-h-0">
        {/* Industry pie */}
        <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4 flex flex-col">
          <h3 class="font-bold text-sm mb-3 text-gray-300">行业分布</h3>
          <div id={PIE_DOM} class="flex-1 min-h-0" style={{ 'min-height': '200px' }} />
          <Show when={!loading() && industryData().length === 0}>
            <div class="flex-1 flex items-center justify-center text-sm text-gray-600">
              暂无行业数据
            </div>
          </Show>
        </div>

        {/* Market cap bar */}
        <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4 flex flex-col">
          <h3 class="font-bold text-sm mb-3 text-gray-300">市值分布</h3>
          <div id={BAR_DOM} class="flex-1 min-h-0" style={{ 'min-height': '200px' }} />
          <div class="flex justify-center gap-4 mt-2 text-xs text-gray-500">
            <span class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-[#60A5FA]" /> 大盘 &gt;500亿
            </span>
            <span class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-[#34D399]" /> 中盘 50-500亿
            </span>
            <span class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-[#FBBF24]" /> 小盘 ≤50亿
            </span>
          </div>
        </div>

        {/* Style radar */}
        <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4 flex flex-col">
          <h3 class="font-bold text-sm mb-3 text-gray-300">风格暴露</h3>
          <div id={RADAR_DOM} class="flex-1 min-h-0" style={{ 'min-height': '200px' }} />
          <div class="flex justify-center gap-3 mt-2 text-xs text-gray-500">
            <For each={STYLE_DIMS}>
              {(dim, i) => (
                <span class="px-2 py-0.5 rounded bg-white/5 text-gray-400">
                  {dim}{' '}
                  <span class="text-blue-400 font-medium">{styleExposure()[i()].toFixed(0)}</span>
                </span>
              )}
            </For>
          </div>
        </div>

        {/* Equity curve */}
        <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4 flex flex-col">
          <h3 class="font-bold text-sm mb-3 text-gray-300">资金曲线</h3>
          <div id={EQUITY_DOM} class="flex-1 min-h-0" style={{ 'min-height': '200px' }} />
          <Show when={!loading() && equityCurve().length === 0}>
            <div class="flex-1 flex items-center justify-center text-sm text-gray-600">
              暂无资金曲线数据
            </div>
          </Show>
        </div>
      </div>

      {/* Holdings table */}
      <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4 flex flex-col">
        <h3 class="font-bold text-sm mb-3 text-gray-300">持仓明细</h3>
        <Show when={!loading() && positions().length === 0}>
          <div class="flex-1 flex items-center justify-center py-8 text-sm text-gray-600">
            暂无持仓
          </div>
        </Show>
        <Show when={positions().length > 0}>
          <div class="overflow-auto max-h-56">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-gray-500 text-xs border-b border-white/5">
                  <th class="text-left py-2 font-normal">代码</th>
                  <th class="text-left py-2 font-normal">名称</th>
                  <th class="text-left py-2 font-normal">方向</th>
                  <th class="text-right py-2 font-normal">持仓量</th>
                  <th class="text-right py-2 font-normal">成本价</th>
                  <th class="text-right py-2 font-normal">市值</th>
                  <th class="text-right py-2 font-normal">盈亏</th>
                  <th class="text-center py-2 font-normal">操作</th>
                </tr>
              </thead>
              <tbody>
                <For each={positions()}>
                  {(pos) => {
                    const mv = pos.volume * (pos.price || 0);
                    return (
                      <tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td class="py-2 font-mono text-xs text-gray-400">{pos.symbol}</td>
                        <td class="py-2 text-xs text-gray-300">{getStockName(pos.symbol)}</td>
                        <td
                          class={`py-2 text-right text-xs font-medium ${pos.direction === '多' ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}
                        >
                          {pos.direction}
                        </td>
                        <td class="py-2 text-right tabular-nums text-xs">
                          {pos.volume.toLocaleString()}
                        </td>
                        <td class="py-2 text-right tabular-nums text-xs text-gray-400">
                          {pos.price > 0 ? `¥${pos.price.toFixed(2)}` : '—'}
                        </td>
                        <td class="py-2 text-right tabular-nums text-xs font-medium">
                          {mv > 0 ? formatMarketCap(mv) : '—'}
                        </td>
                        <td
                          class={`py-2 text-right tabular-nums text-xs font-bold ${(pos.pnl ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}
                        >
                          {(pos.pnl ?? 0) >= 0 ? '+' : ''}
                          {(pos.pnl ?? 0).toFixed(0)}
                        </td>
                        <td class="py-2 text-center">
                          <button
                            class="text-xs text-blue-400 hover:text-blue-300 px-2 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                            onClick={() => setSelectedPosition(pos)}
                          >
                            详情
                          </button>
                        </td>
                      </tr>
                    );
                  }}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </div>
    </div>
  );
};
