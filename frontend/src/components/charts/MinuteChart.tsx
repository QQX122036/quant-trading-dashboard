/**
 * MinuteChart.tsx — 当日分时图
 * - 分时价格线（涨红跌绿）
 * - 均价线（黄色）
 * - 成交量柱状图（下方）
 * - 时间轴：09:30-11:30 / 13:00-15:00
 * 数据来源：GET /api/data/minute-bar?ts_code=600519.SSE
 */
import { Component, createSignal, createEffect, onMount, onCleanup } from 'solid-js';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  LineData,
  HistogramData,
  Time,
  CrosshairMode,
} from 'lightweight-charts';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

// ── Types ─────────────────────────────────────────────────

export interface MinuteBar {
  datetime: string;   // "2026-04-05 09:30:00"
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface MinuteChartProps {
  /** 股票代码，如 "600519" */
  symbol?: string;
  /** 交易所，如 "SSE" */
  exchange?: string;
  /** 外部传入的分时数据 */
  bars?: MinuteBar[];
  /** 高度，默认 280 */
  height?: number;
  /** 十字光标时间同步回调 */
  onCrosshairMove?: (time: Time | null) => void;
  /** 外部设置的十字光标时间（来自其他图表同步） */
  externalCrosshairTime?: () => Time | null;
}

// ── Colors ────────────────────────────────────────────────
const CHART_BG   = '#0a0a0f';
const GRID_COLOR = 'rgba(255,255,255,0.04)';
const TEXT_COLOR = '#94a3b8';
const UP_COLOR   = '#ef4444';
const DOWN_COLOR = '#22c55e';
const AVG_COLOR  = '#f59e0b';   // 均价线
const BORDER     = 'rgba(255,255,255,0.08)';

// ── API ──────────────────────────────────────────────────

async function fetchMinuteBar(ts_code: string): Promise<MinuteBar[]> {
  const params = new URLSearchParams({ ts_code });
  const url = `${BASE_URL}/api/data/minute-bar?${params}`;
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  const json = await res.json() as { code: string; message?: string; data?: { items?: MinuteBar[]; total?: number } };
  if (json.code !== '0') throw new Error(json.message || '加载分时数据失败');
  return json.data?.items ?? [];
}

// ── 转换：datetime → lightweight-charts Time ──────────────

/**
 * 将 "2026-04-05 09:30:00" 转为 UTC timestamp (秒)
 * lightweight-charts Time 是 Unix 秒
 */
function toTime(datetime: string): Time {
  // 本地时间（服务器与客户端均为北京时间 UTC+8）
  const [datePart, timePart] = datetime.split(' ');
  const [Y, M, D] = datePart.split('-').map(Number);
  const [h, m, s] = timePart.split(':').map(Number);
  // 月份减1因为 JS Date 月份 0-indexed
  return Math.floor(new Date(Y, M - 1, D, h, m, s).getTime() / 1000) as Time;
}

/**
 * 计算均价线数据
 * 均价 = 累计成交额 / 累计成交量
 */
function calcAvgLine(bars: MinuteBar[]): LineData<Time>[] {
  let cumAmount = 0;
  let cumVolume = 0;
  return bars.map((bar) => {
    cumAmount += bar.close * bar.volume;   // 用 close 作为成交价近似
    cumVolume += bar.volume;
    const avg = cumVolume > 0 ? cumAmount / cumVolume : bar.close;
    return { time: toTime(bar.datetime), value: Number(avg.toFixed(2)) };
  });
}

// ── 成交量柱状图数据 ─────────────────────────────────────
function buildVolData(bars: MinuteBar[]): HistogramData<Time>[] {
  const firstClose = bars[0]?.close ?? 0;
  return bars.map((bar) => ({
    time: toTime(bar.datetime),
    value: bar.volume,
    color: bar.close >= firstClose
      ? 'rgba(239,68,68,0.5)'   // 涨
      : 'rgba(34,197,94,0.5)',   // 跌
  }));
}

// ── Main component ────────────────────────────────────────

export const MinuteChart: Component<MinuteChartProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  let chart: IChartApi | undefined;
  let priceSeries: ISeriesApi<'Line'> | undefined;
  let avgSeries:   ISeriesApi<'Line'> | undefined;
  let volSeries:   ISeriesApi<'Histogram'> | undefined;

  const [bars, setBars]     = createSignal<MinuteBar[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError]   = createSignal<string | null>(null);

  // ── 加载数据 ────────────────────────────────────────────
  async function loadData() {
    const sym = props.symbol || '600519';
    const exch = props.exchange || 'SSE';
    const ts_code = sym.includes('.') ? sym : `${sym}.${exch}`;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMinuteBar(ts_code);
      if (!data.length) {
        setError('暂无分时数据');
        return;
      }
      setBars(data);
    } catch (e: unknown) {
      setError((e as Error)?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  // ── 渲染图表 ────────────────────────────────────────────
  function renderChart(data: MinuteBar[]) {
    if (!chart || !priceSeries || !avgSeries || !volSeries) return;

    const firstClose = data[0]?.close ?? 0;

    // 分时价格线
    const priceData: LineData<Time>[] = data.map((b) => ({
      time: toTime(b.datetime),
      value: b.close,
      color: b.close >= firstClose ? UP_COLOR : DOWN_COLOR,
    }));
    priceSeries.setData(priceData);

    // 均价线
    avgSeries.setData(calcAvgLine(data));

    // 成交量柱状图
    volSeries.setData(buildVolData(data));

    // 时间轴对齐
    chart.timeScale().fitContent();
  }

  // ── 十字光标同步 ────────────────────────────────────────
  function subscribeCrosshair() {
    if (!chart) return;
    chart.subscribeCrosshairMove((param) => {
      const t = param.time as Time | undefined;
      props.onCrosshairMove?.(t ?? null);
    });
  }

  // ── 初始化图表 ─────────────────────────────────────────
  onMount(() => {
    if (!containerRef) return;

    chart = createChart(containerRef, {
      layout: {
        background: { color: CHART_BG },
        textColor: TEXT_COLOR,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: GRID_COLOR },
        horzLines: { color: GRID_COLOR },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          width: 1,
          color: 'rgba(255,255,255,0.25)',
          style: 2,
          labelBackgroundColor: '#6366f1',
        },
        horzLine: {
          width: 1,
          color: 'rgba(255,255,255,0.25)',
          style: 2,
          labelBackgroundColor: '#6366f1',
        },
      },
      rightPriceScale: {
        borderColor: BORDER,
        textColor: TEXT_COLOR,
        scaleMargins: { top: 0.08, bottom: 0.25 },
      },
      timeScale: {
        borderColor: BORDER,
        timeVisible: true,
        secondsVisible: false,
        // 交易日时间轴标记
        rightOffset: 5,
        barSpacing: 6,
      },
      handleScroll: { vertTouchDrag: false },
      handleScale: { axisPressedMouseMove: { time: true, price: false } },
    });

    // 分时价格线 — 用空数据初始化，运行时动态设置颜色
    priceSeries = chart.addLineSeries({
      color: UP_COLOR,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 3,
    });

    // 均价线
    avgSeries = chart.addLineSeries({
      color: AVG_COLOR,
      lineWidth: 1,
      lineStyle: 0,       // dashed — lightweight-charts 支持但用实线保持清晰
      priceLineVisible: false,
      lastValueVisible: false,
      title: 'MA',
    });

    // 成交量 — 放在下方 priceScale
    volSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',    // 默认 right
    });
    volSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.75, bottom: 0 },
    });

    subscribeCrosshair();

    // 空数据初始渲染
    priceSeries.setData([]);
    avgSeries.setData([]);
    volSeries.setData([]);

    // ResizeObserver
    const ro = new ResizeObserver(() => {
      if (chart && containerRef) {
        chart.applyOptions({
          width: containerRef.clientWidth,
          height: containerRef.clientHeight,
        });
      }
    });
    ro.observe(containerRef);

    onCleanup(() => {
      ro.disconnect();
      chart?.remove();
    });
  });

  // 十字光标外部同步
  createEffect(() => {
    const extTime = props.externalCrosshairTime?.();
    if (extTime && chart && priceSeries) {
      chart.setCrosshairPosition(0, extTime, priceSeries);
    }
  });

  // 外部传入 bars 时直接使用
  createEffect(() => {
    const external = props.bars;
    if (external && external.length > 0) {
      setBars(external);
    }
  });

  // bars 变化 → 渲染
  createEffect(() => {
    const data = bars();
    if (data.length > 0) {
      renderChart(data);
    }
  });

  // 无外部数据时自动加载
  if (!props.bars) {
    loadData();
  }

  const h = () => props.height ?? 280;

  return (
    <div class="relative w-full" style={{ height: `${h()}px` }}>
      {/* Loading overlay */}
      {loading() && (
        <div class="absolute inset-0 z-10 flex items-center justify-center"
          style={{ background: 'rgba(10,10,15,0.75)', 'backdrop-filter': 'blur(4px)' }}>
          <div class="flex flex-col items-center gap-2">
            <div class="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span class="text-xs" style={{ color: TEXT_COLOR }}>加载分时数据...</span>
          </div>
        </div>
      )}

      {/* Error badge */}
      {error() && (
        <div class="absolute top-2 left-2 z-10 px-2 py-1 rounded text-xs"
          style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
          {error()}
        </div>
      )}

      {/* Legend */}
      <div class="absolute top-2 right-2 z-10 flex items-center gap-3 text-xs" style={{ color: TEXT_COLOR }}>
        <span class="flex items-center gap-1">
          <span class="w-3 h-0.5 rounded-sm" style={{ background: UP_COLOR }} />
          <span>分时</span>
        </span>
        <span class="flex items-center gap-1">
          <span class="w-3 h-0.5 rounded-sm" style={{ background: AVG_COLOR }} />
          <span>均价</span>
        </span>
      </div>

      <div ref={containerRef} class="w-full h-full" />
    </div>
  );
};
