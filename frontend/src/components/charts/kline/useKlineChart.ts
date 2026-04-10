/**
 * useKlineChart — chart initialization + series management hook
 * Extracted from KlineChart.tsx to enable composition
 */
import { createSignal, createEffect, onCleanup } from 'solid-js';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  LineData,
  HistogramData,
  Time,
  CrosshairMode,
} from 'lightweight-charts';
import { fetchDailyBar, isSuccessCode, type DailyBar } from '../../../hooks/useApi';
import { calculateMACD } from '../IndicatorChart';
import { logger } from '../../../lib/logger';

export const UP_COLOR = '#EF4444';
export const DOWN_COLOR = '#22C55E';
export const MA_COLORS = {
  MA5: '#3B82F6',
  MA10: '#F59E0B',
  MA20: '#8B5CF6',
  MA60: '#10B981',
  MA120: '#EC4899',
};

export function barToCandle(bar: DailyBar): CandlestickData<Time> {
  const dateStr = bar.trade_date.split('T')[0].split(' ')[0];
  return {
    time: dateStr as Time,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
  };
}

export function calcMA(
  closes: number[],
  times: Time[],
  period: number
): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const avg = slice.reduce((a, b) => a + b, 0) / period;
    result.push({ time: times[i], value: Number(avg.toFixed(2)) });
  }
  return result;
}

export function useKlineChart(
  containerRef: () => HTMLDivElement | undefined,
  options: {
    initialBars?: DailyBar[];
    onCrosshairMove?: (time: Time | null) => void;
    externalCrosshairTime?: () => Time | null;
    onCustomIndicatorAdd?: (e: Event) => void;
    onCustomIndicatorRemove?: (e: Event) => void;
  } = {}
) {
  let chart: IChartApi | undefined;
  let candleSeries: ISeriesApi<'Candlestick'> | undefined;
  let ma5Series: ISeriesApi<'Line'> | undefined;
  let ma10Series: ISeriesApi<'Line'> | undefined;
  let ma20Series: ISeriesApi<'Line'> | undefined;

  const [bars, setBars] = createSignal<DailyBar[]>(options.initialBars || []);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [visibleCount, setVisibleCount] = createSignal(0);
  const [totalCount, setTotalCount] = createSignal(0);
  const [setupDone, setSetupDone] = createSignal(false);

  const customSeriesMap = new Map<
    string,
    {
      main: ISeriesApi<'Line'>;
      dif?: ISeriesApi<'Line'>;
      dea?: ISeriesApi<'Line'>;
      hist?: ISeriesApi<'Histogram'>;
    }
  >();

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
          const t = b.trade_date as unknown as number;
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

  async function loadData(symbol: string, exchange: string) {
    const ts_code = `${symbol}.${exchange}`;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDailyBar(ts_code, undefined, undefined, 100);
      if (isSuccessCode(res.code) && res.data?.bars) {
        setBars(res.data.bars);
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
    const times: Time[] = data.map((b) => {
      const dateStr = b.trade_date;
      return (dateStr.includes('T') ? dateStr.split('T')[0] : dateStr) as unknown as Time;
    });

    candleSeries.setData(data.map(barToCandle));
    ma5Series?.setData(calcMA(closes, times, 5));
    ma10Series?.setData(calcMA(closes, times, 10));
    ma20Series?.setData(calcMA(closes, times, 20));
    chart.timeScale().fitContent();
    updateVisibleRange();
  }

  function zoomIn() {
    if (!chart) return;
    const ts = chart.timeScale();
    const visibleRange = ts.getVisibleRange();
    if (!visibleRange) return;
    const from = new Date(visibleRange.from as string).getTime();
    const to = new Date(visibleRange.to as string).getTime();
    const center = (from + to) / 2;
    const newWidth = Math.abs(to - from) * 0.7;
    const minWidth = 24 * 60 * 60 * 1000;
    if (Math.abs(to - from) <= minWidth) return;
    const newFrom = new Date(center - newWidth / 2).toISOString().split('T')[0];
    let newTo = new Date(center + newWidth / 2).toISOString().split('T')[0];
    if (newFrom >= newTo) {
      const d = new Date(newFrom);
      d.setDate(d.getDate() + 1);
      newTo = d.toISOString().split('T')[0];
    }
    ts.setVisibleRange({ from: newFrom as Time, to: newTo as Time });
  }

  function zoomOut() {
    if (!chart) return;
    const ts = chart.timeScale();
    const visibleRange = ts.getVisibleRange();
    if (!visibleRange) return;
    const from = new Date(visibleRange.from as string).getTime();
    const to = new Date(visibleRange.to as string).getTime();
    const center = (from + to) / 2;
    const newWidth = Math.abs(to - from) * 1.4;
    const newFrom = new Date(center - newWidth / 2).toISOString().split('T')[0];
    const newTo = new Date(center + newWidth / 2).toISOString().split('T')[0];
    ts.setVisibleRange({ from: newFrom as Time, to: newTo as Time });
  }

  function scrollLeft() {
    if (!chart) return;
    const ts = chart.timeScale();
    const step = Math.max(1, Math.floor(totalCount() / 20));
    ts.scrollToPosition(Math.max(0, ts.scrollPosition() - step), true);
    updateVisibleRange();
  }

  function scrollRight() {
    if (!chart) return;
    const ts = chart.timeScale();
    const step = Math.max(1, Math.floor(totalCount() / 20));
    ts.scrollToPosition(ts.scrollPosition() + step, true);
    updateVisibleRange();
  }

  function scrollToStart() {
    if (!chart) return;
    chart.timeScale().scrollToPosition(0, true);
    updateVisibleRange();
  }

  function scrollToRealTime() {
    if (!chart) return;
    chart.timeScale().scrollToRealTime();
    updateVisibleRange();
  }

  function setupChart() {
    const el = containerRef();
    if (!el) return;

    chart = createChart(el, {
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
      color: MA_COLORS.MA5,
      lineWidth: 1,
      title: 'MA5',
      priceLineVisible: false,
    });
    ma10Series = chart.addLineSeries({
      color: MA_COLORS.MA10,
      lineWidth: 1,
      title: 'MA10',
      priceLineVisible: false,
    });
    ma20Series = chart.addLineSeries({
      color: MA_COLORS.MA20,
      lineWidth: 1,
      title: 'MA20',
      priceLineVisible: false,
    });

    // Custom indicator handlers
    function handleCustomIndicatorAdd(e: Event) {
      if (!chart) return;
      const ind = (e as CustomEvent).detail as {
        id: string;
        type: string;
        params: Record<string, number>;
        color: string;
        seriesData: any[];
      };
      const chartBars = bars();
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
        const histData: HistogramData<Time>[] = times
          .map((t, i) => {
            if (isNaN(histogram[i])) return null;
            return {
              time: t,
              value: histogram[i],
              color: histogram[i] >= 0 ? 'rgba(239,68,68,0.7)' : 'rgba(34,197,94,0.7)',
            };
          })
          .filter(Boolean) as HistogramData<Time>[];
        difSeries.setData(difData);
        deaSeries.setData(deaData);
        histSeries.setData(histData);
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
    options.onCustomIndicatorAdd?.(handleCustomIndicatorAdd as any);
    options.onCustomIndicatorRemove?.(handleCustomIndicatorRemove as any);

    chart.subscribeCrosshairMove((param) => {
      const t = param.time as Time | undefined;
      options.onCrosshairMove?.(t || null);
      updateVisibleRange();
    });

    candleSeries.setData([]);
    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver(() => {
      if (chart && containerRef()) {
        chart.applyOptions({
          width: containerRef()!.clientWidth,
          height: containerRef()!.clientHeight,
        });
        updateVisibleRange();
      }
    });
    resizeObserver.observe(containerRef()!);

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
      if (chart) {
        try {
          chart.remove();
        } catch (e) {
          console.debug('[KlineChart] Chart already disposed');
        }
      }
    });
  }

  // External crosshair sync
  createEffect(() => {
    const extTime = options.externalCrosshairTime?.();
    if (extTime && chart) {
      chart.setCrosshairPosition(0, extTime, candleSeries!);
    }
  });

  // Bars change → re-render (guarded by setupDone to avoid pre-mount render)
  createEffect(() => {
    const data = bars();
    // Only render after chart setup AND when we have real data
    if (setupDone() && data.length > 0 && candleSeries) {
      renderChart(data);
    }
  });

  // External bars passed in
  createEffect(() => {
    if (options.initialBars && options.initialBars.length > 0) {
      setBars(options.initialBars);
    }
  });

  return {
    get chart() { return chart; },
    get candleSeries() { return candleSeries; },
    bars,
    setBars,
    loading,
    error,
    visibleCount,
    totalCount,
    loadData,
    setupChart: (done: () => void) => {
      setupChart();
      setSetupDone(true);
      done();
    },
    zoomIn,
    zoomOut,
    scrollLeft,
    scrollRight,
    scrollToStart,
    scrollToRealTime,
  };
}
