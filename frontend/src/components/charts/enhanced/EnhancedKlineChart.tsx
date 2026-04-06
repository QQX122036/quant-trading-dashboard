/**
 * EnhancedKlineChart.tsx — 增强型K线图表
 * 功能：复权切换 | 多股票对比 | 绘图工具 | 筹码分布 | 区间统计
 * 对接 lightweight-charts v4 API
 */
import {
  Component, createSignal, createEffect, onMount, onCleanup, Show, For
} from 'solid-js';
import {
  createChart, IChartApi, ISeriesApi, CandlestickData, LineData,
  HistogramData, Time, CrosshairMode, PriceLineOptions, IPriceLine,
} from 'lightweight-charts';
import { fetchDailyBar, type DailyBar, MAJOR_INDICES } from '../../../hooks/useApi';
import {
  Drawing, DrawingToolType, DrawPoint, TrendLine, FibonacciLine,
  RectangleAnnotation, TextAnnotation, AlertLine,
  COMPARISON_COLORS, FIB_COLORS, getFibPrices, isAlertTriggered,
  createTrendLine, createFibonacci, createRectangle, createAlertLine,
} from './DrawingTools';

// ── Types ────────────────────────────────────────────────────

export type AdjustType = 'none' | 'forward' | 'backward';

interface ComparedStock {
  ts_code: string;
  name: string;
  color: string;
  bars: DailyBar[];
  normalizedData: LineData<Time>[]; // 归一化到起始点
  series?: ISeriesApi<'Line'>;
}

interface RangeSelection {
  fromIndex: number;
  toIndex: number;
  fromTime: Time;
  toTime: Time;
}

interface RangeStats {
  change: number;
  changePct: number;
  volume: number;
  avgVolume: number;
  turnoverRate: number;
  amplitude: number;
  indexChangePct?: number; // 大盘同期
}

interface ChipDistribution {
  price: number;
  volume: number;
  ratio: number; // 占总成交量的比例
}

// Props
export interface EnhancedKlineChartProps {
  /** 默认股票代码 */
  tsCode?: string;
  /** 默认股票名称 */
  name?: string;
  /** 外部传入的K线数据（优先使用） */
  bars?: DailyBar[];
  /** K线数据加载完成回调 */
  onBarsLoaded?: (bars: DailyBar[]) => void;
  /** 十字光标同步 */
  onCrosshairMove?: (time: Time | null) => void;
  externalCrosshairTime?: () => Time | null;
}

// ── Constants ────────────────────────────────────────────────

const UP_COLOR = '#EF4444';
const DOWN_COLOR = '#22C55E';
const MA_COLORS = ['#3B82F6', '#F59E0B', '#8B5CF6', '#10B981', '#EC4899'];

// ── Helpers ──────────────────────────────────────────────────

function barToCandle(bar: DailyBar): CandlestickData<Time> {
  return { time: bar.trade_date as Time, open: bar.open, high: bar.high, low: bar.low, close: bar.close };
}

function calcMA(closes: number[], times: Time[], period: number): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const avg = slice.reduce((a, b) => a + b, 0) / period;
    result.push({ time: times[i], value: Number(avg.toFixed(2)) });
  }
  return result;
}

// Apply forward/backward adjustment
function adjustBars(bars: DailyBar[], type: AdjustType): DailyBar[] {
  if (type === 'none' || bars.length === 0) return bars;
  const lastBar = bars[bars.length - 1];
  return bars.map((bar) => {
    if (type === 'forward') {
      // 前复权：最新价为基准，向前拉伸历史价格
      // adjusted = raw * (last_close / bar_close)
      const ratio = lastBar.close / bar.close;
      return { ...bar, open: bar.open * ratio, high: bar.high * ratio, low: bar.low * ratio, close: bar.close * ratio };
    } else {
      // 后复权：历史价为基准，向后拉伸最新价格
      // adjusted = raw * (bar_close / last_close)
      const ratio = bar.close / lastBar.close;
      return { ...bar, open: bar.open * ratio, high: bar.high * ratio, low: bar.low * ratio, close: bar.close * ratio };
    }
  });
}

// Normalize to starting point (100)
function normalizeToStart(bars: DailyBar[], closeKey = 'close'): LineData<Time>[] {
  if (bars.length === 0) return [];
  const startPrice = bars[0][closeKey as keyof DailyBar] as number;
  return bars.map((bar) => {
    const price = bar[closeKey as keyof DailyBar] as number;
    return { time: bar.trade_date as Time, value: Number(((price / startPrice) * 100).toFixed(2)) };
  });
}

// Compute chip distribution (成本分布)
function computeChipDistribution(bars: DailyBar[], bucketCount = 50): ChipDistribution[] {
  if (bars.length === 0) return [];

  // 建立价格直方图
  const minPrice = Math.min(...bars.map((b) => b.low));
  const maxPrice = Math.max(...bars.map((b) => b.high));
  const range = maxPrice - minPrice;
  const bucketSize = range / bucketCount;
  const buckets = new Array(bucketCount).fill(0);

  bars.forEach((bar) => {
    for (let i = 0; i < bucketCount; i++) {
      buckets[i] += bar.volume / bucketCount;
    }
  });

  const totalVolume = buckets.reduce((a, b) => a + b, 0);
  return buckets.map((vol, i) => ({
    price: minPrice + bucketSize * (i + 0.5),
    volume: vol,
    ratio: totalVolume > 0 ? vol / totalVolume : 0,
  }));
}

// Compute range statistics
function computeRangeStats(bars: DailyBar[], fromIdx: number, toIdx: number, indexBars?: DailyBar[]): RangeStats | null {
  if (fromIdx < 0 || toIdx >= bars.length || fromIdx >= toIdx) return null;
  const rangeBars = bars.slice(fromIdx, toIdx + 1);
  const first = rangeBars[0];
  const last = rangeBars[rangeBars.length - 1];
  const change = last.close - first.open;
  const changePct = (change / first.open) * 100;
  const volume = rangeBars.reduce((s, b) => s + b.volume, 0);
  const avgVolume = volume / rangeBars.length;
  const turnoverRate = rangeBars.reduce((s, b) => {
    const amount = b.amount || b.volume * ((b.open + b.close) / 2);
    return s + amount;
  }, 0);
  const highMax = Math.max(...rangeBars.map((b) => b.high));
  const lowMin = Math.min(...rangeBars.map((b) => b.low));
  const amplitude = ((highMax - lowMin) / first.open) * 100;

  let indexChangePct: number | undefined;
  if (indexBars && indexBars.length > 0) {
    const fromTime = first.trade_date;
    const toTime = last.trade_date;
    const iFirst = indexBars.find((b) => b.trade_date >= fromTime);
    // findLast polyfill using reverse iteration
    const filtered = indexBars.filter((b) => b.trade_date <= toTime);
    const iLast = filtered[filtered.length - 1];
    if (iFirst && iLast && iFirst !== iLast) {
      indexChangePct = ((iLast.close - iFirst.open) / iFirst.open) * 100;
    }
  }

  return { change, changePct, volume, avgVolume, turnoverRate, amplitude, indexChangePct };
}

// ── Component ────────────────────────────────────────────────

export const EnhancedKlineChart: Component<EnhancedKlineChartProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  let chart: IChartApi | undefined;
  let candleSeries: ISeriesApi<'Candlestick'> | undefined;
  const maSeriesMap = new Map<number, ISeriesApi<'Line'>>();
  const alertLineMap = new Map<string, ISeriesApi<'Line'>>();
  let compareChart: IChartApi | undefined;
  let chipChart: IChartApi | undefined;
  let chipSeries: ISeriesApi<'Histogram'> | undefined;

  // State
  const [bars, setBars] = createSignal<DailyBar[]>([]);
  const [adjustedBars, setAdjustedBars] = createSignal<DailyBar[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [adjustType, setAdjustType] = createSignal<AdjustType>('none');

  // Compare stocks
  const [comparedStocks, setComparedStocks] = createSignal<ComparedStock[]>([]);
  const [showCompare, setShowCompare] = createSignal(false);

  // Drawing tools
  const [activeTool, setActiveTool] = createSignal<DrawingToolType | null>(null);
  const [drawings, setDrawings] = createSignal<Drawing[]>([]);
  const [drawingPoints, setDrawingPoints] = createSignal<DrawPoint[]>([]);
  const [alertLines, setAlertLines] = createSignal<AlertLine[]>([]);

  // Range selection
  const [selectingRange, setSelectingRange] = createSignal(false);
  const [rangeStart, setRangeStart] = createSignal<{ time: Time; price: number } | null>(null);
  const [rangeSelection, setRangeSelection] = createSignal<RangeSelection | null>(null);
  const [rangeStats, setRangeStats] = createSignal<RangeStats | null>(null);

  // Chip distribution
  const [showChips, setShowChips] = createSignal(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_chipData, setChipData] = createSignal<ChipDistribution[]>([]);

  // Index bars for benchmark comparison
  const [indexBars, setIndexBars] = createSignal<DailyBar[]>([]);

  // Current price for alert check (used internally)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_currentPrice, setCurrentPrice] = createSignal<number>(0);

  // Visible range
  const [visibleCount, setVisibleCount] = createSignal(0);
  const [totalCount, setTotalCount] = createSignal(0);

  // Drawing state for interactive drawing
  let drawingLines: Array<{ line: ISeriesApi<'Line'>; priceLine?: IPriceLine }> = [];

  // ── Data Loading ──────────────────────────────────────────

  async function loadData() {
    const tsCode = props.tsCode || '600519.SH';
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDailyBar(tsCode);
      if (res.code === '0' && res.data?.bars) {
        const rawBars = res.data.bars;
        setBars(rawBars);
        const adjBars = adjustBars(rawBars, adjustType());
        setAdjustedBars(adjBars);
        props.onBarsLoaded?.(adjBars);
        updateChipData(adjBars);
        loadIndexBars();
      } else {
        setError(res.message || '加载数据失败');
      }
    } catch (e: unknown) {
      setError((e as Error)?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadIndexBars() {
    try {
      const res = await fetchDailyBar('000001.SH');
      if (res.code === '0' && res.data?.bars) {
        setIndexBars(res.data.bars);
      }
    } catch { /* silent */ }
  }

  async function loadComparedStock(tsCode: string) {
    try {
      const res = await fetchDailyBar(tsCode);
      if (res.code === '0' && res.data?.bars) {
        const rawBars = res.data.bars;
        const adjBars = adjustBars(rawBars, adjustType());
        const normalized = normalizeToStart(adjBars);
        const color = COMPARISON_COLORS[comparedStocks().length % COMPARISON_COLORS.length];
        const name = MAJOR_INDICES.find((i) => i.ts_code === tsCode)?.name || tsCode;
        const newStock: ComparedStock = { ts_code: tsCode, name, color, bars: adjBars, normalizedData: normalized };
        setComparedStocks((prev) => [...prev, newStock]);
        if (compareChart) {
          const series = compareChart.addLineSeries({ color, lineWidth: 1, priceLineVisible: false });
          series.setData(normalized);
          newStock.series = series;
        }
      }
    } catch { /* silent */ }
  }

  function updateChipData(data: DailyBar[]) {
    const chips = computeChipDistribution(data);
    setChipData(chips);
    if (chipSeries) {
      const upColor = 'rgba(239,68,68,0.6)';
      const histData: HistogramData<Time>[] = chips.map((c) => ({
        time: data[data.length - 1].trade_date as Time,
        value: c.volume,
        color: upColor,
      }));
      chipSeries.setData(histData);
    }
  }

  // ── Chart Setup ───────────────────────────────────────────

  function setupChart() {
    if (!containerRef) return;

    chart = createChart(containerRef, {
      layout: {
        background: { color: '#0A0E17' },
        textColor: '#9CA3AF',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { width: 1, color: 'rgba(255, 255, 255, 0.3)', style: 2, labelBackgroundColor: '#3B82F6' },
        horzLine: { width: 1, color: 'rgba(255, 255, 255, 0.3)', style: 2, labelBackgroundColor: '#3B82F6' },
      },
      rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.1)' },
      timeScale: { borderColor: 'rgba(255, 255, 255, 0.1)', timeVisible: true, secondsVisible: false },
    });

    candleSeries = chart.addCandlestickSeries({
      upColor: UP_COLOR, downColor: DOWN_COLOR,
      borderUpColor: UP_COLOR, borderDownColor: DOWN_COLOR,
      wickUpColor: UP_COLOR, wickDownColor: DOWN_COLOR,
    });

    // MA lines
    [5, 10, 20, 60, 120].forEach((period, i) => {
      const s = chart!.addLineSeries({
        color: MA_COLORS[i % MA_COLORS.length], lineWidth: 1,
        priceLineVisible: false, title: `MA${period}`,
      });
      maSeriesMap.set(period, s);
    });

    // Subscribe crosshair
    chart.subscribeCrosshairMove((param) => {
      const t = param.time as Time | undefined;
      props.onCrosshairMove?.(t || null);
      updateVisibleRange();
      if (param.point) {
        const _cp = candleSeries?.coordinateToPrice(param.point.y) ?? 0;
        setCurrentPrice(_cp as number);
        checkAlerts(_cp as number);
      }
    });

    // Subscribe click for drawing tools
    chart.subscribeClick((param) => {
      if (!param.time || !param.point) return;
      if (!activeTool() && !selectingRange()) return;

      // Get price from candle series using Y coordinate
      const price = candleSeries?.coordinateToPrice(param.point.y) ?? 0;
      if (selectingRange()) {
        handleRangeSelect(param.time, price as number);
      } else {
        handleChartClick({ time: param.time, point: { x: param.point.x, y: param.point.y, price: price as number } });
      }
    });

    // Setup compare sub-chart
    setupCompareChart();

    // Setup chip sub-chart
    setupChipChart();

    // ResizeObserver
    const ro = new ResizeObserver(() => {
      if (chart && containerRef) {
        chart.applyOptions({ width: containerRef.clientWidth, height: containerRef.clientHeight });
      }
    });
    ro.observe(containerRef);

    // Keyboard
    function handleKey(e: KeyboardEvent) {
      if (!chart) return;
      const ts = chart.timeScale();
      const step = Math.max(1, Math.floor(totalCount() / 20));
      if (e.key === 'ArrowLeft') {
        e.preventDefault(); ts.scrollToPosition(Math.max(0, ts.scrollPosition() - step), true);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault(); ts.scrollToPosition(ts.scrollPosition() + step, true);
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        const r = ts.getVisibleRange();
        if (r) { const mid = ((r.from as number) + (r.to as number)) / 2; const half = ((r.to as number) - (r.from as number)) * 0.4; ts.setVisibleRange({ from: (mid - half) as Time, to: (mid + half) as Time }); }
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        const r = ts.getVisibleRange();
        if (r) { const mid = ((r.from as number) + (r.to as number)) / 2; const half = ((r.to as number) - (r.from as number)) * 0.8; ts.setVisibleRange({ from: (mid - half) as Time, to: (mid + half) as Time }); }
      }
      updateVisibleRange();
    }
    window.addEventListener('keydown', handleKey);

    onCleanup(() => {
      ro.disconnect();
      window.removeEventListener('keydown', handleKey);
      chart?.remove();
      compareChart?.remove();
      chipChart?.remove();
    });
  }

  function setupCompareChart() {
    const compareEl = document.getElementById('compare-chart');
    if (!compareEl) return;
    compareChart = createChart(compareEl, {
      layout: { background: { color: '#0A0E17' }, textColor: '#9CA3AF' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)', scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: 'rgba(255,255,255,0.1)', timeVisible: true },
      crosshair: { mode: CrosshairMode.Normal },
    });
  }

  function setupChipChart() {
    const chipEl = document.getElementById('chip-chart');
    if (!chipEl) return;
    chipChart = createChart(chipEl, {
      layout: { background: { color: '#0A0E17' }, textColor: '#9CA3AF' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' },
      timeScale: { visible: false },
      crosshair: { mode: CrosshairMode.Normal },
    });
    chipSeries = chipChart.addHistogramSeries({
      priceLineVisible: false, priceFormat: { type: 'volume' },
    });
  }

  // ── Rendering ──────────────────────────────────────────────

  function renderChart(data: DailyBar[]) {
    if (!chart || !candleSeries) return;
    candleSeries.setData(data.map(barToCandle));

    // MA
    const closes = data.map((b) => b.close);
    const times = data.map((b) => b.trade_date as Time);
    [5, 10, 20, 60, 120].forEach((period) => {
      const series = maSeriesMap.get(period);
      if (series) series.setData(calcMA(closes, times, period));
    });

    chart.timeScale().fitContent();
    updateVisibleRange();
  }

  function renderDrawings() {
    if (!chart) return;
    // Remove existing drawing lines
    drawingLines.forEach(({ line }) => chart!.removeSeries(line));
    drawingLines = [];

    drawings().forEach((d) => {
      if (!d.visible) return;
      if (d.type === 'trendline') {
        const dl = d as TrendLine;
        const line = chart!.addLineSeries({ color: dl.color, lineWidth: 1, priceLineVisible: false });
        line.setData([
          { time: dl.points[0].time, value: dl.points[0].price },
          { time: dl.points[1].time, value: dl.points[1].price },
        ]);
        drawingLines.push({ line });
      } else if (d.type === 'fibonacci') {
        const fb = d as FibonacciLine;
        const [p1, p2] = fb.points;
        const high = Math.max(p1.price, p2.price);
        const low = Math.min(p1.price, p2.price);
        const fibPrices = getFibPrices(high, low, fb.levels);
        fibPrices.forEach(({ level, price }, i) => {
          const color = FIB_COLORS[i % FIB_COLORS.length];
          const line = chart!.addLineSeries({ color, lineWidth: level === 0.382 || level === 0.618 ? 2 : 1, priceLineVisible: false });
          line.setData([
            { time: p1.time, value: price },
            { time: p2.time, value: price },
          ]);
          drawingLines.push({ line });
        });
      } else if (d.type === 'rectangle') {
        const rect = d as RectangleAnnotation;
        const [p1, p2] = rect.points;
        const high = Math.max(p1.price, p2.price);
        const low = Math.min(p1.price, p2.price);
        const line = chart!.addLineSeries({ color: rect.color, lineWidth: 1, priceLineVisible: false });
        // Draw 4 edges as separate lines (simplified: just top and bottom)
        line.setData([
          { time: p1.time, value: high }, { time: p2.time, value: high },
          { time: p2.time, value: high }, { time: p2.time, value: low },
          { time: p2.time, value: low }, { time: p1.time, value: low },
          { time: p1.time, value: low }, { time: p1.time, value: high },
        ]);
        drawingLines.push({ line });
      } else if (d.type === 'text') {
        const txt = d as TextAnnotation;
        // Text is rendered as a price line with label
        const line = chart!.addLineSeries({ color: 'transparent', lineWidth: 1, priceLineVisible: false });
        line.setData([{ time: txt.point.time, value: txt.point.price }]);
        const priceLine = line.createPriceLine({
          ...({} as Partial<PriceLineOptions>),
          color: txt.color,
          lineVisible: false,
          title: txt.text,
        } as PriceLineOptions & { title: string });
        drawingLines.push({ line, priceLine });
      } else if (d.type === 'alertline') {
        const al = d as AlertLine;
        const existing = alertLineMap.get(al.id);
        if (existing) { chart!.removeSeries(existing); alertLineMap.delete(al.id); }
        const line = chart!.addLineSeries({
          color: al.triggered ? '#EF4444' : al.color,
          lineWidth: 1, lineStyle: 2, priceLineVisible: true,
          title: `⚠️ ¥${al.price.toFixed(2)}`,
        });
        line.setData([
          { time: bars()[0]?.trade_date as Time || 0 as Time, value: al.price },
          { time: bars()[bars().length - 1]?.trade_date as Time || 0 as Time, value: al.price },
        ]);
        alertLineMap.set(al.id, line);
        drawingLines.push({ line });
      }
    });
  }

  function updateVisibleRange() {
    if (!chart || !candleSeries) return;
    const allBars = bars();
    setTotalCount(allBars.length);
    try {
      const tr = chart.timeScale().getVisibleRange();
      if (tr) {
        const visible = allBars.filter((b) => {
          const t = b.trade_date as unknown as number;
          return Number(t) >= Number(tr.from) && Number(t) <= Number(tr.to);
        }).length;
        setVisibleCount(visible);
      } else {
        setVisibleCount(allBars.length);
      }
    } catch {
      setVisibleCount(allBars.length);
    }
  }

  function checkAlerts(price: number) {
    const triggered = alertLines().filter((a) => !a.triggered && isAlertTriggered(a, price));
    if (triggered.length > 0) {
      triggered.forEach((a) => {
        setAlertLines((prev) => prev.map((al) => al.id === a.id ? { ...al, triggered: true } : al));
        // 发出视觉提示（闪烁效果由UI层处理）
        console.warn(`[Alert] Price ${price} triggered alert at ¥${a.price}`);
      });
      renderDrawings();
    }
  }

  // ── Interactive Drawing ─────────────────────────────────────

  function handleChartClick(param: { time?: Time; point?: { x: number; y: number; price: number } }) {
    if (!param.time || !param.point) return;
    const tool = activeTool();
    if (!tool) return;

    const point: DrawPoint = { x: param.point.x, y: param.point.y, time: param.time, price: param.point.price };
    setDrawingPoints((prev) => [...prev, point]);

    if (tool === 'alertline') {
      const al = createAlertLine(param.point.price);
      setAlertLines((prev) => [...prev, al]);
      setDrawings((prev) => [...prev, al]);
      renderDrawings();
      setDrawingPoints([]);
      return;
    }

    const pts = [...drawingPoints(), point];
    if (pts.length >= 2) {
      let drawing: Drawing | null = null;
      if (tool === 'trendline') {
        drawing = createTrendLine(pts[0], pts[1]);
      } else if (tool === 'fibonacci') {
        drawing = createFibonacci(pts[0], pts[1]);
      } else if (tool === 'rectangle') {
        drawing = createRectangle(pts[0], pts[1]);
      }
      if (drawing) {
        setDrawings((prev) => [...prev, drawing!]);
        renderDrawings();
      }
      setDrawingPoints([]);
    }
  }

  // ── Range Selection ────────────────────────────────────────

  function handleRangeSelect(time: Time, price: number) {
    if (!selectingRange()) {
      setRangeStart({ time, price });
      setSelectingRange(true);
    } else {
      const start = rangeStart();
      if (start) {
        const allBars = adjustedBars();
        const fromIdx = allBars.findIndex((b) => (b.trade_date as unknown as number) >= Number(time));
        const toIdx = allBars.findIndex((b) => (b.trade_date as unknown as number) >= Number(start.time));
        const [minIdx, maxIdx] = [Math.min(fromIdx, toIdx), Math.max(fromIdx, toIdx)];
        if (minIdx >= 0 && maxIdx >= 0) {
          const stats = computeRangeStats(allBars, minIdx, maxIdx, indexBars());
          setRangeSelection({ fromIndex: minIdx, toIndex: maxIdx, fromTime: start.time, toTime: time });
          setRangeStats(stats);
        }
      }
      setSelectingRange(false);
      setRangeStart(null);
    }
  }

  function clearRangeSelection() {
    setRangeSelection(null);
    setRangeStats(null);
  }

  // ── Lifecycle ──────────────────────────────────────────────

  onMount(() => {
    setupChart();
    if (!props.bars) loadData();
  });

  createEffect(() => {
    const externalBars = props.bars;
    if (externalBars && externalBars.length > 0) {
      setBars(externalBars);
      const adjBars = adjustBars(externalBars, adjustType());
      setAdjustedBars(adjBars);
      updateChipData(adjBars);
    }
  });

  createEffect(() => {
    const data = adjustedBars();
    if (data.length > 0 && candleSeries) {
      renderChart(data);
    }
  });

  createEffect(() => {
    renderDrawings();
  });

  // ── Adjust type change ────────────────────────────────────

  function handleAdjustChange(type: AdjustType) {
    setAdjustType(type);
    const rawBars = bars();
    const adjBars = adjustBars(rawBars, type);
    setAdjustedBars(adjBars);
    updateChipData(adjBars);
  }

  // ── Delete drawing ─────────────────────────────────────────

  function deleteDrawing(id: string) {
    setDrawings((prev) => prev.filter((d) => d.id !== id));
    const al = alertLines().find((a) => a.id === id);
    if (al) {
      setAlertLines((prev) => prev.filter((a) => a.id !== id));
      const series = alertLineMap.get(id);
      if (series) { chart?.removeSeries(series); alertLineMap.delete(id); }
    }
    renderDrawings();
  }

  function clearAllDrawings() {
    setDrawings([]);
    setAlertLines([]);
    alertLineMap.forEach((series) => chart?.removeSeries(series));
    alertLineMap.clear();
    drawingLines.forEach(({ line }) => chart?.removeSeries(line));
    drawingLines = [];
  }

  // ── Compare chart management ───────────────────────────────

  function addComparedStock(tsCode: string) {
    if (comparedStocks().some((s) => s.ts_code === tsCode)) return;
    loadComparedStock(tsCode);
  }

  function removeComparedStock(tsCode: string) {
    setComparedStocks((prev) => {
      const stock = prev.find((s) => s.ts_code === tsCode);
      if (stock?.series) compareChart?.removeSeries(stock.series);
      return prev.filter((s) => s.ts_code !== tsCode);
    });
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <div class="relative w-full h-full flex flex-col">

      {/* ── Toolbar ── */}
      <div class="flex items-center gap-2 p-2 border-b border-white/10 flex-wrap">

        {/* Adjust type */}
        <div class="flex gap-1">
          {(['none', 'forward', 'backward'] as AdjustType[]).map((t) => (
            <button
              class={`px-2 py-1 text-xs rounded transition-colors ${adjustType() === t ? 'bg-blue-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
              onClick={() => handleAdjustChange(t)}
              title={t === 'none' ? '不复权' : t === 'forward' ? '前复权：以最新价为基准向前拉伸' : '后复权：以历史价为基准向后拉伸'}
            >
              {t === 'none' ? '不复权' : t === 'forward' ? '前复权' : '后复权'}
            </button>
          ))}
        </div>

        <div class="w-px h-4 bg-white/20" />

        {/* Drawing tools */}
        <div class="flex gap-1">
          <button
            class={`px-2 py-1 text-xs rounded transition-colors ${activeTool() === 'trendline' ? 'bg-blue-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
            onClick={() => setActiveTool(activeTool() === 'trendline' ? null : 'trendline')}
            title="趋势线"
          >
            📈 趋势线
          </button>
          <button
            class={`px-2 py-1 text-xs rounded transition-colors ${activeTool() === 'fibonacci' ? 'bg-blue-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
            onClick={() => setActiveTool(activeTool() === 'fibonacci' ? null : 'fibonacci')}
            title="斐波那契回调线"
          >
            📐 斐波那契
          </button>
          <button
            class={`px-2 py-1 text-xs rounded transition-colors ${activeTool() === 'rectangle' ? 'bg-blue-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
            onClick={() => setActiveTool(activeTool() === 'rectangle' ? null : 'rectangle')}
            title="矩形标注"
          >
            ⬜ 矩形
          </button>
          <button
            class={`px-2 py-1 text-xs rounded transition-colors ${activeTool() === 'text' ? 'bg-blue-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
            onClick={() => setActiveTool(activeTool() === 'text' ? null : 'text')}
            title="文字标注"
          >
            📝 文字
          </button>
          <button
            class={`px-2 py-1 text-xs rounded transition-colors ${activeTool() === 'alertline' ? 'bg-red-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
            onClick={() => setActiveTool(activeTool() === 'alertline' ? null : 'alertline')}
            title="突破预警线"
          >
            🔔 预警线
          </button>
        </div>

        <div class="w-px h-4 bg-white/20" />

        {/* Range selection */}
        <button
          class={`px-2 py-1 text-xs rounded transition-colors ${selectingRange() ? 'bg-yellow-600 text-white animate-pulse' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
          onClick={() => { setSelectingRange(!selectingRange()); setRangeStart(null); }}
          title="框选K线区间进行统计"
        >
          📊 区间统计
        </button>
        <Show when={rangeSelection()}>
          <button class="px-2 py-1 text-xs rounded bg-white/10 text-gray-300 hover:bg-white/20" onClick={clearRangeSelection}>
            ✕ 清除区间
          </button>
        </Show>

        <div class="w-px h-4 bg-white/20" />

        {/* Chips */}
        <button
          class={`px-2 py-1 text-xs rounded transition-colors ${showChips() ? 'bg-green-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
          onClick={() => setShowChips(!showChips())}
          title="筹码分布图"
        >
          🎯 筹码分布
        </button>

        {/* Compare */}
        <button
          class={`px-2 py-1 text-xs rounded transition-colors ${showCompare() ? 'bg-purple-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
          onClick={() => setShowCompare(!showCompare())}
          title="多股票对比"
        >
          📈 对比
        </button>
        <Show when={showCompare()}>
          <select
            class="px-2 py-1 text-xs rounded bg-white/10 text-gray-300 border border-white/20"
            onChange={(e) => { const v = e.currentTarget.value; if (v) addComparedStock(v); }}
          >
            <option value="">添加对比...</option>
            <For each={MAJOR_INDICES.filter((i) => !comparedStocks().some((s) => s.ts_code === i.ts_code))}>
              {(idx) => <option value={idx.ts_code}>{idx.name}</option>}
            </For>
          </select>
        </Show>

        <div class="flex-1" />

        {/* Visible count */}
        <span class="text-xs text-gray-400 bg-black/40 px-2 py-1 rounded">
          {visibleCount()} / {totalCount()}
        </span>

        {/* Clear drawings */}
        <Show when={drawings().length > 0}>
          <button class="px-2 py-1 text-xs rounded bg-red-900/60 text-red-300 hover:bg-red-900/80" onClick={clearAllDrawings}>
            🗑 清空绘图
          </button>
        </Show>

        {/* Active tool indicator */}
        <Show when={activeTool()}>
          <span class="text-xs px-2 py-1 rounded bg-blue-900/60 text-blue-300">
            绘图模式：{activeTool()}
          </span>
        </Show>
      </div>

      {/* ── Main Chart Area ── */}
      <div class="flex-1 flex min-h-0">

        {/* K-line chart */}
        <div class="flex-1 relative" ref={containerRef}
          onClick={(e) => {
            if (!chart || !activeTool()) return;
            const rect = containerRef!.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            if (!chart || !containerRef) return;
            // Use chart's time scale to convert
            const time = chart.timeScale().coordinateToTime(x);
            const price = candleSeries?.coordinateToPrice(y) ?? 0;
            if (time) {
              if (selectingRange()) handleRangeSelect(time, price as number);
              else handleChartClick({ time, point: { x, y, price: price as number } });
            }
          }}
        />

        {/* Chip distribution sidebar */}
        <Show when={showChips()}>
          <div class="w-32 border-l border-white/10 flex flex-col">
            <div class="px-2 py-1 text-xs text-gray-400 border-b border-white/10">筹码分布</div>
            <div id="chip-chart" class="flex-1" />
          </div>
        </Show>
      </div>

      {/* ── Compare Chart ── */}
      <Show when={showCompare() && comparedStocks().length > 0}>
        <div class="h-32 border-t border-white/10 flex flex-col">
          <div class="flex items-center gap-2 px-2 py-1 border-b border-white/10">
            <span class="text-xs text-gray-400">多股票对比（归一化）</span>
            <For each={comparedStocks()}>
              {(stock) => (
                <span class="flex items-center gap-1 text-xs">
                  <span class="w-2 h-2 rounded-full" style={{ background: stock.color }} />
                  <span class="text-gray-300">{stock.name}</span>
                  <button class="text-gray-500 hover:text-red-400 ml-1" onClick={() => removeComparedStock(stock.ts_code)}>✕</button>
                </span>
              )}
            </For>
          </div>
          <div id="compare-chart" class="flex-1" />
        </div>
      </Show>

      {/* ── Range Stats Panel ── */}
      <Show when={rangeStats()}>
        {(stats) => (
          <div class="border-t border-white/10 bg-[#111827]/90 px-4 py-2 flex items-center gap-6 text-xs">
            <span class="text-gray-400">区间涨跌</span>
            <span class={stats().change >= 0 ? 'text-red-400' : 'text-green-400'}>
              {stats().change >= 0 ? '+' : ''}{stats().change.toFixed(2)} ({stats().changePct.toFixed(2)}%)
            </span>
            <span class="text-gray-400">成交量</span>
            <span class="text-white">{(stats().volume / 1e8).toFixed(2)}亿</span>
            <span class="text-gray-400">均量</span>
            <span class="text-white">{(stats().avgVolume / 1e8).toFixed(2)}亿</span>
            <span class="text-gray-400">振幅</span>
            <span class="text-white">{stats().amplitude.toFixed(2)}%</span>
            <Show when={stats().indexChangePct !== undefined}>
              <span class="text-gray-400">大盘同期</span>
              <span class={stats().indexChangePct! >= 0 ? 'text-red-400' : 'text-green-400'}>
                {stats().indexChangePct! >= 0 ? '+' : ''}{stats().indexChangePct!.toFixed(2)}%
              </span>
              <span class="text-gray-400">超额</span>
              <span class={(stats().changePct - stats().indexChangePct!) >= 0 ? 'text-green-400' : 'text-red-400'}>
                {(stats().changePct - stats().indexChangePct!).toFixed(2)}%
              </span>
            </Show>
          </div>
        )}
      </Show>

      {/* ── Alert triggered banner ── */}
      <Show when={alertLines().some((a) => a.triggered)}>
        <div class="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-red-600 text-white rounded-lg shadow-lg animate-bounce text-sm">
          🔔 价格触发预警线！
        </div>
      </Show>

      {/* ── Loading / Error ── */}
      <Show when={loading()}>
        <div class="absolute inset-0 z-20 flex items-center justify-center bg-[#0A0E17]/80">
          <span class="text-gray-400 text-sm">加载中...</span>
        </div>
      </Show>
      <Show when={error()}>
        <div class="absolute top-2 left-2 z-20 px-2 py-1 bg-red-900/80 rounded text-xs text-red-300">
          {error()}
        </div>
      </Show>

      {/* ── Tooltip hint ── */}
      <Show when={activeTool() && !selectingRange()}>
        <div class="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 bg-blue-900/90 text-blue-200 rounded-lg text-xs">
          点击K线设置{activeTool() === 'trendline' ? '趋势线' : activeTool() === 'fibonacci' ? '斐波那契' : activeTool() === 'rectangle' ? '矩形' : activeTool() === 'text' ? '文字' : '预警线'}起点，再点击设置终点
        </div>
      </Show>
      <Show when={selectingRange()}>
        <div class="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 bg-yellow-900/90 text-yellow-200 rounded-lg text-xs">
          📊 点击K线左键选择区间起点，再点击选择终点
        </div>
      </Show>

      {/* ── Drawings list ── */}
      <Show when={drawings().length > 0}>
        <div class="absolute right-2 bottom-2 z-20 max-h-48 overflow-auto bg-black/80 rounded border border-white/10 p-2 text-xs">
          <div class="text-gray-400 mb-1">绘图 ({drawings().length})</div>
          <For each={drawings()}>
            {(d) => (
              <div class="flex items-center gap-2 py-0.5">
                <span class="w-2 h-2 rounded-full" style={{ background: d.color }} />
                <span class="text-gray-300 capitalize">{d.type}</span>
                <Show when={d.type === 'alertline'}>
                  <span class="text-gray-400">¥{(d as AlertLine).price.toFixed(2)}</span>
                </Show>
                <button class="text-red-400 hover:text-red-300 ml-1" onClick={() => deleteDrawing(d.id)}>✕</button>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};
