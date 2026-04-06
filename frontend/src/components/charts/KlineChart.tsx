/**
 * KlineChart.tsx — K线图组件
 * 对接真实数据，支持 MA5/10/20、因子信号标记、十字光标同步
 */
import { Component, createSignal, createEffect, onMount, onCleanup } from 'solid-js';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  LineData,
  HistogramData,
  Time,
  CrosshairMode,
  SeriesMarkerPosition,
  SeriesMarkerShape,
} from 'lightweight-charts';
import { fetchDailyBar, type DailyBar, isSuccessCode } from '../../hooks/useApi';
import { calculateMACD } from './IndicatorChart';

interface Signal {
  time: Time;
  position: SeriesMarkerPosition;
  shape: SeriesMarkerShape;
  color: string;
  text: string;
}

interface KlineChartProps {
  symbol?: string;
  exchange?: string;
  /** 外部传入的K线数据（优先使用，否则从API获取） */
  bars?: DailyBar[];
  /** 十字光标时间同步回调 */
  onCrosshairMove?: (time: Time | null) => void;
  /** 外部设置的十字光标时间（来自其他图表同步） */
  externalCrosshairTime?: () => Time | null;
  /** 打开自定义指标编辑器的回调 */
  onOpenCustomIndicatorEditor?: () => void;
  /** K线数据加载完成时回调（用于与CustomIndicatorEditor共享数据） */
  onBarsLoaded?: (bars: DailyBar[]) => void;
}

// A股红涨绿跌配色
const UP_COLOR = '#EF4444';
const DOWN_COLOR = '#22C55E';
const MA5_COLOR = '#3B82F6';
const MA10_COLOR = '#F59E0B';
const MA20_COLOR = '#8B5CF6';

function barToCandle(bar: DailyBar): CandlestickData<Time> {
  // 处理ISO 8601格式（2024-01-02T00:00:00）或普通格式（2024-01-02 00:00:00）
  const dateStr = bar.trade_date.split('T')[0].split(' ')[0];
  return {
    time: dateStr as Time,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
  };
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

/** 简单的因子信号计算（金叉/死叉/突破） */
function calcSignals(bars: DailyBar[]): Signal[] {
  const signals: Signal[] = [];
  if (bars.length < 5) return signals;

  const closes = bars.map((b) => b.close);
  const times = bars.map((b) => b.trade_date as Time);

  // 计算 MA5/MA10
  const ma5 = closes.map((_, i) => {
    if (i < 4) return NaN;
    const slice = closes.slice(i - 4, i + 1);
    return slice.reduce((a, b) => a + b, 0) / 5;
  });
  const ma10 = closes.map((_, i) => {
    if (i < 9) return NaN;
    const slice = closes.slice(i - 9, i + 1);
    return slice.reduce((a, b) => a + b, 0) / 10;
  });

  for (let i = 1; i < bars.length; i++) {
    const prev = i - 1;
    // 金叉：MA5 上穿 MA10
    if (!isNaN(ma5[prev]) && !isNaN(ma10[prev]) && !isNaN(ma5[i]) && !isNaN(ma10[i])) {
      if (ma5[prev] <= ma10[prev] && ma5[i] > ma10[i]) {
        signals.push({ time: times[i], position: 'belowBar', shape: 'arrowUp', color: '#EF4444', text: '★买入' });
      }
      // 死叉：MA5 下穿 MA10
      if (ma5[prev] >= ma10[prev] && ma5[i] < ma10[i]) {
        signals.push({ time: times[i], position: 'aboveBar', shape: 'arrowDown', color: '#22C55E', text: '☆卖出' });
      }
    }
    // 放量突破：成交量 > 前日2倍 且 涨幅 > 2%
    if (i >= 1) {
      const volRatio = bars[i].volume / Math.max(bars[i - 1].volume, 1);
      const priceChange = (bars[i].close - bars[i - 1].close) / bars[i - 1].close;
      if (volRatio > 2 && priceChange > 0.02) {
        signals.push({ time: times[i], position: 'aboveBar', shape: 'circle', color: '#F59E0B', text: '▲放量突破' });
      }
    }
  }
  return signals;
}

export const KlineChart: Component<KlineChartProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  let chart: IChartApi | undefined;
  let candleSeries: ISeriesApi<'Candlestick'> | undefined;
  let ma5Series: ISeriesApi<'Line'> | undefined;
  let ma10Series: ISeriesApi<'Line'> | undefined;
  let ma20Series: ISeriesApi<'Line'> | undefined;

  const [bars, setBars] = createSignal<DailyBar[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [timeframe, setTimeframe] = createSignal<'1D' | '1W' | '1M'>('1D');
  const [visibleCount, setVisibleCount] = createSignal(0);
  const [totalCount, setTotalCount] = createSignal(0);

  // 计算可见K线数量并更新指示器
  function updateVisibleRange() {
    if (!chart || !candleSeries) return;
    const total = bars().length;
    setTotalCount(total);
    try {
      const timeScale = chart.timeScale();
      const visibleRange = timeScale.getVisibleRange();
      if (visibleRange) {
        const fromTime = visibleRange.from;
        const toTime = visibleRange.to;
        const allBars = bars();
        const visible = allBars.filter((b: DailyBar) => {
          const t = (b.trade_date as unknown as number); // Time = number in this context
          return Number(t) >= Number(fromTime) && Number(t) <= Number(toTime);
        }).length;
        setVisibleCount(visible);
      } else {
        setVisibleCount(total);
      }
    } catch {
      setVisibleCount(total);
    }
  }

  // 十字光标同步
  let internalCrosshairTime: Time | null = null;

  async function loadData() {
    const sym = props.symbol || '600519';
    const exch = props.exchange || 'SSE';
    const ts_code = `${sym}.${exch}`;
    
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDailyBar(ts_code, undefined, undefined, 100);
      if (isSuccessCode(res.code) && res.data?.bars) {
        setBars(res.data.bars);
        props.onBarsLoaded?.(res.data.bars);
      } else {
        setError(res.message || '加载数据失败');
      }
    } catch (e: unknown) {
      setError((e as Error)?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  function renderChart(data: DailyBar[]) {
    if (!chart || !candleSeries) return;

    const closes = data.map((b) => b.close);
    const times = data.map((b) => b.trade_date as Time);

    // K 线数据
    candleSeries.setData(data.map(barToCandle));

    // MA
    const ma5Data = calcMA(closes, times, 5);
    const ma10Data = calcMA(closes, times, 10);
    const ma20Data = calcMA(closes, times, 20);
    ma5Series?.setData(ma5Data);
    ma10Series?.setData(ma10Data);
    ma20Series?.setData(ma20Data);

    // 因子信号
    const signals = calcSignals(data);
    candleSeries.setMarkers(signals);

    chart.timeScale().fitContent();
  }

  // ── Zoom controls ─────────────────────────────────────────

  function zoomIn() {
    if (!chart) return;
    const ts = chart.timeScale();
    const visibleRange = ts.getVisibleRange();
    if (!visibleRange) return;
    
    console.log('zoomIn before:', visibleRange);
    
    // 放大：减少可见范围（看到更少但更详细的数据）
    const from = new Date(visibleRange.from as string).getTime();
    const to = new Date(visibleRange.to as string).getTime();
    const currentWidth = Math.abs(to - from);
    
    // 最小宽度限制（至少1天）
    const minWidth = 24 * 60 * 60 * 1000; // 1天
    if (currentWidth <= minWidth) {
      console.log('zoomIn: 已达到最小缩放级别');
      return;
    }
    
    const center = (from + to) / 2;
    const newWidth = currentWidth * 0.7; // 缩小到 70%
    
    // 确保新的开始日期小于结束日期
    const newFrom = center - newWidth / 2;
    const newTo = center + newWidth / 2;
    
    // 转换回字符串日期格式
    const newFromStr = new Date(newFrom).toISOString().split('T')[0];
    let newToStr = new Date(newTo).toISOString().split('T')[0];
    
    // 确保开始日期小于结束日期
    if (newFromStr >= newToStr) {
      console.log('zoomIn: 开始日期大于等于结束日期，调整');
      const newToDate = new Date(newFromStr);
      newToDate.setDate(newToDate.getDate() + 1);
      newToStr = newToDate.toISOString().split('T')[0];
    }
    
    console.log('zoomIn after:', { from: newFromStr, to: newToStr });
    
    ts.setVisibleRange({
      from: newFromStr as Time,
      to: newToStr as Time,
    });
  }

  function zoomOut() {
    if (!chart) return;
    const ts = chart.timeScale();
    const visibleRange = ts.getVisibleRange();
    if (!visibleRange) return;
    
    console.log('zoomOut before:', visibleRange);
    
    // 缩小：增加可见范围（看到更多历史数据）
    const from = new Date(visibleRange.from as string).getTime();
    const to = new Date(visibleRange.to as string).getTime();
    const center = (from + to) / 2;
    const currentWidth = Math.abs(to - from);
    const newWidth = currentWidth * 1.4; // 扩大到 140%
    
    const newFrom = center - newWidth / 2;
    const newTo = center + newWidth / 2;
    
    // 转换回字符串日期格式
    const newFromStr = new Date(newFrom).toISOString().split('T')[0];
    const newToStr = new Date(newTo).toISOString().split('T')[0];
    
    console.log('zoomOut after:', { from: newFromStr, to: newToStr });
    
    ts.setVisibleRange({
      from: newFromStr as Time,
      to: newToStr as Time,
    });
  }

  onMount(() => {
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
        vertLine: {
          width: 1,
          color: 'rgba(255, 255, 255, 0.3)',
          style: 2,
          labelBackgroundColor: '#3B82F6',
        },
        horzLine: {
          width: 1,
          color: 'rgba(255, 255, 255, 0.3)',
          style: 2,
          labelBackgroundColor: '#3B82F6',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
        secondsVisible: false,
        minBarSpacing: 2,  // 最小 K 线间距，允许缩小
      },
      handleScroll: {
        mouseWheel: true,  // 启用鼠标滚轮缩放
        pressedMouseMove: true,  // 启用鼠标拖动
        horzTouchDrag: true,  // 启用水平触摸拖动
        vertTouchDrag: false,  // 禁用垂直触摸拖动
      },
      handleScale: {
        mouseWheel: true,  // 启用鼠标滚轮缩放
        pinch: true,  // 启用手势缩放
        axisPressedMouseMove: {
          time: true,  // 允许在时间轴上拖动
          price: true,  // 允许在价格轴上拖动
        },
      },
    });

    candleSeries = chart.addCandlestickSeries({
      upColor: UP_COLOR,
      downColor: DOWN_COLOR,
      borderUpColor: UP_COLOR,
      borderDownColor: DOWN_COLOR,
      wickUpColor: UP_COLOR,
      wickDownColor: DOWN_COLOR,
    });

    ma5Series = chart.addLineSeries({ color: MA5_COLOR, lineWidth: 1, title: 'MA5', priceLineVisible: false });
    ma10Series = chart.addLineSeries({ color: MA10_COLOR, lineWidth: 1, title: 'MA10', priceLineVisible: false });
    ma20Series = chart.addLineSeries({ color: MA20_COLOR, lineWidth: 1, title: 'MA20', priceLineVisible: false });

    // ── Custom indicator series management ──────────────────────────
    const customSeriesMap = new Map<string, { main: ISeriesApi<'Line'>; dif?: ISeriesApi<'Line'>; dea?: ISeriesApi<'Line'>; hist?: ISeriesApi<'Histogram'> }>();

    // MACD recalculation (needs closes + times from current bars)
    function getChartBars() { return bars(); }

    function handleCustomIndicatorAdd(e: Event) {
      if (!chart) return;
      const ind = (e as CustomEvent).detail as { id: string; type: string; params: Record<string, number>; color: string; seriesData: any[] };
      const chartBars = getChartBars();
      if (chartBars.length === 0) return;

      // Remove existing if present
      if (customSeriesMap.has(ind.id)) {
        const existing = customSeriesMap.get(ind.id)!;
        chart.removeSeries(existing.main);
        existing.dif && chart.removeSeries(existing.dif);
        existing.dea && chart.removeSeries(existing.dea);
        existing.hist && chart.removeSeries(existing.hist);
        customSeriesMap.delete(ind.id);
      }

      const closes = chartBars.map((b) => b.close);
      const highs  = chartBars.map((b) => b.high);
      const lows   = chartBars.map((b) => b.low);
      const times: Time[] = chartBars.map((b) => b.trade_date as Time);

      if (ind.type === 'MACD') {
        const { dif, dea, histogram } = calculateMACD(closes);
        const difSeries = chart.addLineSeries({ color: ind.color, lineWidth: 1, priceLineVisible: false, title: `DIF(${ind.id.slice(-4)})` });
        const deaSeries = chart.addLineSeries({ color: 'rgba(255,255,255,0.5)', lineWidth: 1, priceLineVisible: false, title: `DEA(${ind.id.slice(-4)})` });
        const histSeries = chart.addHistogramSeries({ priceLineVisible: false, title: `MACD(${ind.id.slice(-4)})` });
        const difData: LineData<Time>[] = times.map((t, i) => ({ time: t, value: dif[i] })).filter((d) => !isNaN(d.value));
        const deaData: LineData<Time>[] = times.map((t, i) => ({ time: t, value: dea[i] })).filter((d) => !isNaN(d.value));
        const histData: HistogramData<Time>[] = times.map((t, i) => {
          if (isNaN(histogram[i])) return null;
          return { time: t, value: histogram[i], color: histogram[i] >= 0 ? 'rgba(239,68,68,0.7)' : 'rgba(34,197,94,0.7)' };
        }).filter(Boolean) as HistogramData<Time>[];
        difSeries.setData(difData);
        deaSeries.setData(deaData);
        histSeries.setData(histData);
        customSeriesMap.set(ind.id, { main: difSeries, dif: difSeries, dea: deaSeries, hist: histSeries });
      } else {
        const mainSeries = chart.addLineSeries({
          color: ind.color,
          lineWidth: 1,
          priceLineVisible: false,
          title: `${ind.type}(${ind.id.slice(-4)})`,
        });
        mainSeries.setData(ind.seriesData);
        customSeriesMap.set(ind.id, { main: mainSeries });
      }
    }

    function handleCustomIndicatorRemove(e: Event) {
      if (!chart) return;
      const { id } = (e as CustomEvent).detail as { id: string };
      const entry = customSeriesMap.get(id);
      if (entry) {
        chart.removeSeries(entry.main);
        entry.dif && chart.removeSeries(entry.dif);
        entry.dea && chart.removeSeries(entry.dea);
        entry.hist && chart.removeSeries(entry.hist);
        customSeriesMap.delete(id);
      }
    }

    window.addEventListener('custom-indicator-add', handleCustomIndicatorAdd);
    window.addEventListener('custom-indicator-remove', handleCustomIndicatorRemove);

    // 十字光标同步 + 更新可见范围指示器
    chart.subscribeCrosshairMove((param) => {
      const t = param.time as Time | undefined;
      internalCrosshairTime = t || null;
      props.onCrosshairMove?.(internalCrosshairTime);
      updateVisibleRange();
    });

    // 初始空数据
    candleSeries.setData([]);
    chart.timeScale().fitContent();

    // ResizeObserver
    const resizeObserver = new ResizeObserver(() => {
      if (chart && containerRef) {
        chart.applyOptions({ width: containerRef.clientWidth, height: containerRef.clientHeight });
        updateVisibleRange();
      }
    });
    resizeObserver.observe(containerRef);

    // 键盘快捷键：Left/Right 平移，+/- 缩放
    function handleKeyDown(e: KeyboardEvent) {
      if (!chart) return;
      const timeScale = chart.timeScale();
      const scrollStep = Math.max(1, Math.floor(totalCount() / 20)); // 每次滚动约5%

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const pos = timeScale.scrollPosition(); timeScale.scrollToPosition(Math.max(0, pos - scrollStep), true);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const pos = timeScale.scrollPosition(); timeScale.scrollToPosition(pos + scrollStep, true);
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        // 放大：减少可见范围
        const range = timeScale.getVisibleRange();
        if (range) {
          const mid = ((range.from as number) + (range.to as number)) / 2;
          const half = ((range.to as number) - (range.from as number)) * 0.4;
          timeScale.setVisibleRange({ from: (mid - half) as Time, to: (mid + half) as Time });
        }
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        // 缩小：增加可见范围
        const range = timeScale.getVisibleRange();
        if (range) {
          const mid = ((range.from as number) + (range.to as number)) / 2;
          const half = ((range.to as number) - (range.from as number)) * 0.8;
          timeScale.setVisibleRange({ from: (mid - half) as Time, to: (mid + half) as Time });
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        timeScale.scrollToPosition(0, true);
      } else if (e.key === 'End') {
        e.preventDefault();
        timeScale.scrollToRealTime();
      }
      updateVisibleRange();
    }


    window.addEventListener('keydown', handleKeyDown);

    onCleanup(() => {
      resizeObserver.disconnect();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('custom-indicator-add', handleCustomIndicatorAdd);
      window.removeEventListener('custom-indicator-remove', handleCustomIndicatorRemove);
      chart?.remove();
    });
  });

  // 外部传入 bars 时优先使用
  createEffect(() => {
    const externalBars = props.bars;
    if (externalBars && externalBars.length > 0) {
      setBars(externalBars);
    }
  });

  // bars 变化时重新渲染
  createEffect(() => {
    const data = bars();
    if (data.length > 0 && candleSeries) {
      renderChart(data);
    }
  });

  // 外部十字光标同步（如 IndicatorChart 移动时同步 K 线）
  createEffect(() => {
    const extTime = props.externalCrosshairTime?.();
    if (extTime && chart) {
      chart.setCrosshairPosition(0, extTime, candleSeries!);
    }
  });

  // 初始加载（无外部bars时）
  if (!props.bars) {
    loadData();
  }

  // 当symbol或exchange变化时重新加载数据
  createEffect(() => {
    props.symbol;
    props.exchange;
    if (!props.bars) {
      loadData();
    }
  });

  return (
    <div class="relative w-full h-full">
      {/* Loading/Error overlay */}
      {loading() && (
        <div class="absolute inset-0 z-10 flex items-center justify-center bg-[#0A0E17]/80">
          <span class="text-gray-400 text-sm">加载中...</span>
        </div>
      )}
      {error() && (
        <div class="absolute top-2 left-2 z-10 px-2 py-1 bg-red-900/80 rounded text-xs text-red-300">
          {error()}
        </div>
      )}

      {/* Controls: timeframe selector + pan buttons + range indicator */}
      <div class="absolute top-2 right-2 z-10 flex items-center gap-2">
        {/* 可视范围指示器 */}
        <span class="text-xs text-gray-400 bg-black/40 px-2 py-1 rounded">
          显示 {visibleCount()} / {totalCount()} 条
        </span>

        {/* 缩放按钮 */}
        <div class="flex gap-1">
          <button
            class="px-2 py-1 text-xs rounded bg-white/10 text-gray-300 hover:bg-white/20 transition-colors"
            onClick={zoomOut}
            title="缩小（查看更多数据）"
          >
            ➖ 缩小
          </button>
          <button
            class="px-2 py-1 text-xs rounded bg-white/10 text-gray-300 hover:bg-white/20 transition-colors"
            onClick={zoomIn}
            title="放大（查看更少数据）"
          >
            ➕ 放大
          </button>
        </div>

        {/* 左右平移按钮 */}
        <div class="flex gap-1">
          <button
            class="px-2 py-1 text-xs rounded bg-white/10 text-gray-300 hover:bg-white/20 transition-colors"
            onClick={() => {
              if (!chart) return;
              chart.timeScale().scrollToPosition(0, true);
              updateVisibleRange();
            }}
            title="滚动到开头 (Home)"
          >
            ⏮
          </button>
          <button
            class="px-2 py-1 text-xs rounded bg-white/10 text-gray-300 hover:bg-white/20 transition-colors"
            onClick={() => {
              if (!chart) return;
              chart.timeScale().scrollToPosition(Math.max(0, chart.timeScale().scrollPosition() - Math.max(1, Math.floor(totalCount() / 20))), true);
              updateVisibleRange();
            }}
            title="向左平移 (←)"
          >
            ◀
          </button>
          <button
            class="px-2 py-1 text-xs rounded bg-white/10 text-gray-300 hover:bg-white/20 transition-colors"
            onClick={() => {
              if (!chart) return;
              chart.timeScale().scrollToPosition(chart.timeScale().scrollPosition() + Math.max(1, Math.floor(totalCount() / 20)), true);
              updateVisibleRange();
            }}
            title="向右平移 (→)"
          >
            ▶
          </button>
          <button
            class="px-2 py-1 text-xs rounded bg-white/10 text-gray-300 hover:bg-white/20 transition-colors"
            onClick={() => {
              if (!chart) return;
              chart.timeScale().scrollToRealTime();
              updateVisibleRange();
            }}
            title="滚动到结尾 (End)"
          >
            ⏭
          </button>
        </div>

        {/* Timeframe selector */}
        <div class="flex gap-1">
          {(['1D', '1W', '1M'] as const).map((tf) => (
            <button
              class={`px-2 py-1 text-xs rounded transition-colors ${timeframe() === tf ? 'bg-blue-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
              onClick={() => setTimeframe(tf)}
            >
              {tf === '1D' ? '日线' : tf === '1W' ? '周线' : '月线'}
            </button>
          ))}
        </div>

        {/* 自定义指标编辑器入口 */}
        <button
          class="px-2 py-1 text-xs rounded bg-purple-600/80 hover:bg-purple-600 text-white transition-colors flex items-center gap-1"
          onClick={props.onOpenCustomIndicatorEditor}
          title="自定义指标编辑器"
        >
          📊 指标
        </button>
      </div>

      <div ref={containerRef} class="w-full h-full" />
    </div>
  );
};
