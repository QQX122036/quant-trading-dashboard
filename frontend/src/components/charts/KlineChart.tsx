/**
 * KlineChart.tsx — K线图组件
 * 对接真实数据，支持 MA5/10/20、因子信号标记、十字光标同步
 *
 * 组件结构：
 * - PriceScale    — 价格刻度、当前价格线
 * - VolumePanel   — 成交量子图
 * - IndicatorOverlay — 技术指标叠加
 * - Crosshair     — 十字光标管理
 */
import { Component, createSignal, createEffect, onMount, onCleanup, For } from 'solid-js';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  LineData,
  Time,
  CrosshairMode,
  SeriesMarkerPosition,
  SeriesMarkerShape,
} from 'lightweight-charts';
import { fetchDailyBar, type DailyBar, isSuccessCode } from '../../hooks/useApi';
import { calculateMACD } from './IndicatorChart';
import { logger } from '../../lib/logger';

// ── Sub-components ────────────────────────────────────────────────────────────
import { CrosshairManager } from './Crosshair';

// ── Types ────────────────────────────────────────────────────────────────────

interface Signal {
  time: Time;
  position: SeriesMarkerPosition;
  shape: SeriesMarkerShape;
  color: string;
  text: string;
}

export interface KlineChartProps {
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

// ── Constants ────────────────────────────────────────────────────────────────

const UP_COLOR = '#EF4444';
const DOWN_COLOR = '#22C55E';

// ── Helper functions ─────────────────────────────────────────────────────────

function barToCandle(bar: DailyBar): CandlestickData<Time> {
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

/** 因子信号计算（金叉/死叉/突破） */
function calcSignals(bars: DailyBar[]): Signal[] {
  const signals: Signal[] = [];
  if (bars.length < 5) return signals;

  const closes = bars.map((b) => b.close);
  const times = bars.map((b) => {
    const dateStr = b.trade_date;
    return (dateStr.includes('T') ? dateStr.split('T')[0] : dateStr) as unknown as Time;
  });

  const ma5 = closes.map((_, i) =>
    i < 4 ? NaN : closes.slice(i - 4, i + 1).reduce((a, b) => a + b, 0) / 5
  );
  const ma10 = closes.map((_, i) =>
    i < 9 ? NaN : closes.slice(i - 9, i + 1).reduce((a, b) => a + b, 0) / 10
  );

  for (let i = 1; i < bars.length; i++) {
    const prev = i - 1;
    if (!isNaN(ma5[prev]) && !isNaN(ma10[prev]) && !isNaN(ma5[i]) && !isNaN(ma10[i])) {
      if (ma5[prev] <= ma10[prev] && ma5[i] > ma10[i]) {
        signals.push({
          time: times[i],
          position: 'belowBar',
          shape: 'arrowUp',
          color: '#EF4444',
          text: '★买入',
        });
      }
      if (ma5[prev] >= ma10[prev] && ma5[i] < ma10[i]) {
        signals.push({
          time: times[i],
          position: 'aboveBar',
          shape: 'arrowDown',
          color: '#22C55E',
          text: '☆卖出',
        });
      }
    }
    const volRatio = bars[i].volume / Math.max(bars[i - 1].volume, 1);
    const priceChange = (bars[i].close - bars[i - 1].close) / bars[i - 1].close;
    if (volRatio > 2 && priceChange > 0.02) {
      signals.push({
        time: times[i],
        position: 'aboveBar',
        shape: 'circle',
        color: '#F59E0B',
        text: '▲放量突破',
      });
    }
  }
  return signals;
}

// ── Component ────────────────────────────────────────────────────────────────

export const KlineChart: Component<KlineChartProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  let chart: IChartApi | undefined;
  let candleSeries: ISeriesApi<'Candlestick'> | undefined;
  let ma5Series: ISeriesApi<'Line'> | undefined;
  let ma10Series: ISeriesApi<'Line'> | undefined;
  let ma20Series: ISeriesApi<'Line'> | undefined;
  let crosshairManager: CrosshairManager | undefined;

  const [bars, setBars] = createSignal<DailyBar[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [timeframe, setTimeframe] = createSignal<'1D' | '1W' | '1M'>('1D');
  const [visibleCount, setVisibleCount] = createSignal(0);
  const [totalCount, setTotalCount] = createSignal(0);
  const [_currentPrice, setCurrentPrice] = createSignal<number>(0);

  // ── Visible range tracking ────────────────────────────────────────────────

  function updateVisibleRange() {
    if (!chart || !candleSeries) return;
    const total = bars().length;
    setTotalCount(total);
    try {
      const tr = chart.timeScale().getVisibleRange();
      if (tr) {
        const visible = bars().filter((b) => {
          const t = b.trade_date as unknown as number;
          return Number(t) >= Number(tr.from) && Number(t) <= Number(tr.to);
        }).length;
        setVisibleCount(visible);
      } else {
        setVisibleCount(total);
      }
    } catch {
      setVisibleCount(total);
    }
  }

  // ── Zoom controls ─────────────────────────────────────────────────────────

  function zoomIn() {
    if (!chart) return;
    const ts = chart.timeScale();
    const vr = ts.getVisibleRange();
    if (!vr) return;
    const from = new Date(vr.from as string).getTime();
    const to = new Date(vr.to as string).getTime();
    const currentWidth = Math.abs(to - from);
    const minWidth = 24 * 60 * 60 * 1000;
    if (currentWidth <= minWidth) return;
    const center = (from + to) / 2;
    const newWidth = currentWidth * 0.7;
    const newFrom = center - newWidth / 2;
    let newTo = center + newWidth / 2;
    let newFromStr = new Date(newFrom).toISOString().split('T')[0];
    let newToStr = new Date(newTo).toISOString().split('T')[0];
    if (newFromStr >= newToStr) {
      newToStr = new Date(new Date(newFromStr).getTime() + 86400000).toISOString().split('T')[0];
    }
    ts.setVisibleRange({ from: newFromStr as Time, to: newToStr as Time });
  }

  function zoomOut() {
    if (!chart) return;
    const ts = chart.timeScale();
    const vr = ts.getVisibleRange();
    if (!vr) return;
    const from = new Date(vr.from as string).getTime();
    const to = new Date(vr.to as string).getTime();
    const center = (from + to) / 2;
    const newWidth = Math.abs(to - from) * 1.4;
    const newFrom = center - newWidth / 2;
    const newTo = center + newWidth / 2;
    const newFromStr = new Date(newFrom).toISOString().split('T')[0];
    const newToStr = new Date(newTo).toISOString().split('T')[0];
    ts.setVisibleRange({ from: newFromStr as Time, to: newToStr as Time });
  }

  // ── Chart rendering ───────────────────────────────────────────────────────

  function renderChart(data: DailyBar[]) {
    if (!chart || !candleSeries) return;
    candleSeries.setData(data.map(barToCandle));

    const closes = data.map((b) => b.close);
    const times = data.map((b) => {
      const dateStr = b.trade_date;
      return (dateStr.includes('T') ? dateStr.split('T')[0] : dateStr) as unknown as Time;
    });

    ma5Series?.setData(calcMA(closes, times, 5));
    ma10Series?.setData(calcMA(closes, times, 10));
    ma20Series?.setData(calcMA(closes, times, 20));
    candleSeries.setMarkers(calcSignals(data));

    chart.timeScale().fitContent();

    // Update current price from last bar
    if (data.length > 0) {
      setCurrentPrice(data[data.length - 1].close);
    }
  }

  // ── Data loading ──────────────────────────────────────────────────────────

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

  // ── Chart initialization ───────────────────────────────────────────────────

  onMount(() => {
    try {
      if (!containerRef) return;

      chart = createChart(containerRef, {
        layout: { background: { color: '#0A0E17' }, textColor: '#9CA3AF' },
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
        rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.1)' },
        timeScale: {
          borderColor: 'rgba(255, 255, 255, 0.1)',
          timeVisible: true,
          secondsVisible: false,
          minBarSpacing: 2,
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: false,
        },
        handleScale: {
          mouseWheel: true,
          pinch: true,
          axisPressedMouseMove: { time: true, price: true },
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

      ma5Series = chart.addLineSeries({
        color: '#3B82F6',
        lineWidth: 1,
        title: 'MA5',
        priceLineVisible: false,
      });
      ma10Series = chart.addLineSeries({
        color: '#F59E0B',
        lineWidth: 1,
        title: 'MA10',
        priceLineVisible: false,
      });
      ma20Series = chart.addLineSeries({
        color: '#8B5CF6',
        lineWidth: 1,
        title: 'MA20',
        priceLineVisible: false,
      });

      // Initialize Crosshair manager
      crosshairManager = new CrosshairManager(chart, candleSeries);
      crosshairManager.subscribe({
        onCrosshairMove: (time) => {
          props.onCrosshairMove?.(time);
          updateVisibleRange();
        },
      });

      // ── Custom indicator series management ─────────────────────────────
      const customSeriesMap = new Map<
        string,
        {
          main: ISeriesApi<'Line'>;
          dif?: ISeriesApi<'Line'>;
          dea?: ISeriesApi<'Line'>;
          hist?: ISeriesApi<'Histogram'>;
        }
      >();

      function getChartBars() {
        return bars();
      }

      function handleCustomIndicatorAdd(e: Event) {
        if (!chart) return;
        const ind = (e as CustomEvent).detail as {
          id: string;
          type: string;
          params: Record<string, number>;
          color: string;
          seriesData: any[];
        };
        const chartBars = getChartBars();
        if (chartBars.length === 0) return;

        if (customSeriesMap.has(ind.id)) {
          const existing = customSeriesMap.get(ind.id)!;
          chart.removeSeries(existing.main);
          existing.dif && chart.removeSeries(existing.dif);
          existing.dea && chart.removeSeries(existing.dea);
          existing.hist && chart.removeSeries(existing.hist);
          customSeriesMap.delete(ind.id);
        }

        const closes = chartBars.map((b) => b.close);
        const times: Time[] = chartBars.map((b) => b.trade_date as Time);

        if (ind.type === 'MACD') {
          const { dif, dea, histogram } = calculateMACD(closes);
          const difSeries = chart.addLineSeries({
            color: ind.color,
            lineWidth: 1,
            priceLineVisible: false,
            title: `DIF(${ind.id.slice(-4)})`,
          });
          const deaSeries = chart.addLineSeries({
            color: 'rgba(255,255,255,0.5)',
            lineWidth: 1,
            priceLineVisible: false,
            title: `DEA(${ind.id.slice(-4)})`,
          });
          const histSeries = chart.addHistogramSeries({
            priceLineVisible: false,
            title: `MACD(${ind.id.slice(-4)})`,
          });
          const difData: LineData<Time>[] = times
            .map((t, i) => ({ time: t, value: dif[i] }))
            .filter((d) => !isNaN(d.value));
          const deaData: LineData<Time>[] = times
            .map((t, i) => ({ time: t, value: dea[i] }))
            .filter((d) => !isNaN(d.value));
          const histData = times
            .map((t, i) => {
              if (isNaN(histogram[i])) return null;
              return {
                time: t,
                value: histogram[i],
                color: histogram[i] >= 0 ? 'rgba(239,68,68,0.7)' : 'rgba(34,197,94,0.7)',
              };
            })
            .filter(Boolean);
          difSeries.setData(difData);
          deaSeries.setData(deaData);
          histSeries.setData(histData as any);
          customSeriesMap.set(ind.id, {
            main: difSeries,
            dif: difSeries,
            dea: deaSeries,
            hist: histSeries,
          });
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

      // Initial empty data
      candleSeries.setData([]);
      chart.timeScale().fitContent();

      // ResizeObserver
      const resizeObserver = new ResizeObserver(() => {
        if (chart && containerRef) {
          chart.applyOptions({
            width: containerRef.clientWidth,
            height: containerRef.clientHeight,
          });
          updateVisibleRange();
        }
      });
      resizeObserver.observe(containerRef);

      // Keyboard shortcuts
      function handleKeyDown(e: KeyboardEvent) {
        if (!chart) return;
        const timeScale = chart.timeScale();
        const scrollStep = Math.max(1, Math.floor(totalCount() / 20));

        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          timeScale.scrollToPosition(Math.max(0, timeScale.scrollPosition() - scrollStep), true);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          timeScale.scrollToPosition(timeScale.scrollPosition() + scrollStep, true);
        } else if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          zoomIn();
        } else if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          zoomOut();
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
        crosshairManager?.destroy();
        if (chart) {
          try {
            chart.remove();
          } catch (_e) {
            console.debug('[KlineChart] Chart already disposed');
          }
        }
      });
    } catch (err) {
      logger.error('[KlineChart] onMount error', { error: err });
    }
  });

  // External bars
  createEffect(() => {
    const externalBars = props.bars;
    if (externalBars && externalBars.length > 0) setBars(externalBars);
  });

  // Bars change → re-render
  createEffect(() => {
    const data = bars();
    if (data.length > 0 && candleSeries) renderChart(data);
  });

  // External crosshair sync
  createEffect(() => {
    const extTime = props.externalCrosshairTime?.();
    if (extTime && chart && candleSeries) {
      crosshairManager?.setPosition(0, extTime, candleSeries);
    }
  });

  // Initial load
  if (!props.bars) loadData();

  // Symbol/exchange change
  createEffect(() => {
    props.symbol;
    props.exchange;
    if (!props.bars) loadData();
  });

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div class="relative w-full h-full">
      {/* Loading overlay */}
      {loading() && (
        <div class="absolute inset-0 z-10 flex items-center justify-center bg-[#0A0E17]/80">
          <span class="text-gray-400 text-sm">加载中...</span>
        </div>
      )}

      {/* Error banner */}
      {error() && (
        <div class="absolute top-2 left-2 z-10 px-2 py-1 bg-red-900/80 rounded text-xs text-red-300">
          {error()}
        </div>
      )}

      {/* Controls bar */}
      <div class="absolute top-2 right-2 z-10 flex items-center gap-2">
        <span class="text-xs text-gray-400 bg-black/40 px-2 py-1 rounded">
          显示 {visibleCount()} / {totalCount()} 条
        </span>

        {/* Zoom buttons */}
        <div class="flex gap-1">
          <button
            class="px-2 py-1 text-xs rounded bg-white/10 text-gray-300 hover:bg-white/20 transition-colors"
            onClick={zoomOut}
            title="缩小"
          >
            ➖ 缩小
          </button>
          <button
            class="px-2 py-1 text-xs rounded bg-white/10 text-gray-300 hover:bg-white/20 transition-colors"
            onClick={zoomIn}
            title="放大"
          >
            ➕ 放大
          </button>
        </div>

        {/* Pan buttons */}
        <div class="flex gap-1">
          <button
            class="px-2 py-1 text-xs rounded bg-white/10 text-gray-300 hover:bg-white/20 transition-colors"
            onClick={() => {
              chart?.timeScale().scrollToPosition(0, true);
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
              chart
                .timeScale()
                .scrollToPosition(
                  Math.max(
                    0,
                    chart.timeScale().scrollPosition() - Math.max(1, Math.floor(totalCount() / 20))
                  ),
                  true
                );
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
              chart
                .timeScale()
                .scrollToPosition(
                  chart.timeScale().scrollPosition() + Math.max(1, Math.floor(totalCount() / 20)),
                  true
                );
              updateVisibleRange();
            }}
            title="向右平移 (→)"
          >
            ▶
          </button>
          <button
            class="px-2 py-1 text-xs rounded bg-white/10 text-gray-300 hover:bg-white/20 transition-colors"
            onClick={() => {
              chart?.timeScale().scrollToRealTime();
              updateVisibleRange();
            }}
            title="滚动到结尾 (End)"
          >
            ⏭
          </button>
        </div>

        {/* Timeframe selector */}
        <div class="flex gap-1">
          <For each={['1D', '1W', '1M'] as const}>
            {(tf) => (
              <button
                class={`px-2 py-1 text-xs rounded transition-colors ${timeframe() === tf ? 'bg-blue-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
                onClick={() => setTimeframe(tf)}
              >
                {tf === '1D' ? '日线' : tf === '1W' ? '周线' : '月线'}
              </button>
            )}
          </For>
        </div>

        {/* Custom indicator editor */}
        <button
          class="px-2 py-1 text-xs rounded bg-purple-600/80 hover:bg-purple-600 text-white transition-colors flex items-center gap-1"
          onClick={props.onOpenCustomIndicatorEditor}
          title="自定义指标编辑器"
        >
          📊 指标
        </button>
      </div>

      {/* Chart container */}
      <div ref={containerRef} class="w-full h-full" />
    </div>
  );
};
