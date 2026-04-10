/**
 * KLineCanvas.tsx — K线主图画布
 * 职责：lightweight-charts 初始化、K线/MA渲染、十字光标事件
 */
import { Component, createEffect, onCleanup, onMount, createSignal } from 'solid-js';
import { createChart, IChartApi, ISeriesApi, Time, CrosshairMode } from 'lightweight-charts';
import type { DailyBar } from '../../../hooks/useApi';
import { barToCandle, calcMA, adjustBars } from './chartUtils';

export interface KLineCanvasProps {
  bars: DailyBar[];
  adjustType: 'none' | 'forward' | 'backward';
  onCrosshairMove?: (time: Time | null, price?: number) => void;
  onVisibleRangeChange?: (visible: number, total: number) => void;
  onChartReady?: (chart: IChartApi) => void;
  onChartClick?: (param: { time?: Time; point?: { x: number; y: number; price: number } }) => void;
  zoomIn?: () => void;
  zoomOut?: () => void;
}

const UP_COLOR = '#EF4444';
const DOWN_COLOR = '#22C55E';
const MA_COLORS = ['#3B82F6', '#F59E0B', '#8B5CF6', '#10B981', '#EC4899'];

export const KLineCanvas: Component<KLineCanvasProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  let chart: IChartApi | undefined;
  let candleSeries: ISeriesApi<'Candlestick'> | undefined;
  const maSeriesMap = new Map<number, ISeriesApi<'Line'>>();
  const [_currentPrice, setCurrentPrice] = createSignal<number>(0);
  const [_chipSeries, _setChipSeries] = createSignal<ISeriesApi<'Histogram'> | null>(null);

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
        autoScale: true,
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
        secondsVisible: false,
        minBarSpacing: 0.5,
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
        axisPressedMouseMove: {
          time: true,
          price: true,
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

    // MA lines
    [5, 10, 20, 60, 120].forEach((period, i) => {
      const s = chart!.addLineSeries({
        color: MA_COLORS[i % MA_COLORS.length],
        lineWidth: 1,
        priceLineVisible: false,
        title: `MA${period}`,
      });
      maSeriesMap.set(period, s);
    });

    // Subscribe crosshair
    chart.subscribeCrosshairMove((param) => {
      const t = param.time as Time | undefined;
      let price: number | undefined;
      if (param.point && candleSeries) {
        price = candleSeries.coordinateToPrice(param.point.y) ?? undefined;
        setCurrentPrice(price ?? 0);
      }
      props.onCrosshairMove?.(t || null, price);
      updateVisibleRange();
    });

    // Subscribe click
    chart.subscribeClick((param) => {
      if (!param.time || !param.point || !candleSeries) return;
      const price = candleSeries.coordinateToPrice(param.point.y) ?? 0;
      props.onChartClick?.({
        time: param.time,
        point: { x: param.point.x, y: param.point.y, price },
      });
    });

    // Keyboard
    function handleKey(e: KeyboardEvent) {
      if (!chart) return;
      const ts = chart.timeScale();
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const step = Math.max(1, Math.floor(props.bars.length / 20));
        ts.scrollToPosition(Math.max(0, ts.scrollPosition() - step), true);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const step = Math.max(1, Math.floor(props.bars.length / 20));
        ts.scrollToPosition(ts.scrollPosition() + step, true);
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        props.zoomIn?.();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        props.zoomOut?.();
      }
      updateVisibleRange();
    }
    window.addEventListener('keydown', handleKey);

    // ResizeObserver
    const ro = new ResizeObserver(() => {
      if (chart && containerRef) {
        chart.applyOptions({ width: containerRef.clientWidth, height: containerRef.clientHeight });
      }
    });
    ro.observe(containerRef);

    props.onChartReady?.(chart);

    onCleanup(() => {
      ro.disconnect();
      window.removeEventListener('keydown', handleKey);
      chart?.remove();
    });
  }

  function renderChart(data: DailyBar[]) {
    if (!chart || !candleSeries) return;
    candleSeries.setData(data.map(barToCandle));

    const closes = data.map((b) => b.close);
    const times = data.map((b) => b.trade_date as Time);
    [5, 10, 20, 60, 120].forEach((period) => {
      const series = maSeriesMap.get(period);
      if (series) series.setData(calcMA(closes, times, period));
    });

    chart.timeScale().fitContent();
    updateVisibleRange();
  }

  function updateVisibleRange() {
    if (!chart || !candleSeries) return;
    const allBars = props.bars;
    props.onVisibleRangeChange?.(allBars.length, allBars.length);
    try {
      const tr = chart.timeScale().getVisibleRange();
      if (tr) {
        const visible = allBars.filter((b) => {
          const t = b.trade_date as unknown as number;
          return Number(t) >= Number(tr.from) && Number(t) <= Number(tr.to);
        }).length;
        props.onVisibleRangeChange?.(visible, allBars.length);
      } else {
        props.onVisibleRangeChange?.(allBars.length, allBars.length);
      }
    } catch {
      props.onVisibleRangeChange?.(allBars.length, allBars.length);
    }
  }

  function _getChart(): IChartApi | undefined {
    return chart;
  }

  function _getCandleSeries(): ISeriesApi<'Candlestick'> | undefined {
    return candleSeries;
  }

  onMount(() => {
    setupChart();
  });

  createEffect(() => {
    const data = adjustBars(props.bars, props.adjustType);
    if (data.length > 0 && candleSeries) {
      renderChart(data);
    }
  });

  return <div class="flex-1 relative" ref={containerRef} />;
};

export { adjustBars };
