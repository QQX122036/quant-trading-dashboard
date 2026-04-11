import { onMount, onCleanup, createEffect, Component } from 'solid-js';
import { createChart, IChartApi, ISeriesApi, HistogramData, Time } from 'lightweight-charts';
import type { DailyBar } from '../../types/vnpy';

interface Props {
  bars: DailyBar[];
  height?: number;
}

export const VolumeChart: Component<Props> = (props) => {
  let containerRef!: HTMLDivElement;
  let chart: IChartApi | undefined;
  let volSeries: ISeriesApi<'Histogram'> | undefined;

  onMount(() => {
    chart = createChart(containerRef, {
      layout: {
        background: { color: '#1e1e1e' },
        textColor: '#9d9d9d',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#2d2d30' },
        horzLines: { color: '#2d2d30' },
      },
      rightPriceScale: { borderColor: '#3e3e42', textColor: '#9d9d9d' },
      timeScale: { borderColor: '#3e3e42', timeVisible: true },
      handleScroll: { vertTouchDrag: false },
    });

    volSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'right',
    });
    volSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.1, bottom: 0 },
    });

    const resizeObserver = new ResizeObserver(() => {
      if (chart && containerRef) chart.applyOptions({ width: containerRef.clientWidth });
    });
    resizeObserver.observe(containerRef);

    onCleanup(() => {
      resizeObserver.disconnect();
      chart?.remove();
    });
  });

  createEffect(() => {
    const bars = props.bars;
    if (!volSeries || !bars.length) return;
    const upColor = '#ff4b4b';
    const downColor = '#00ffff';
    const data: HistogramData<Time>[] = bars.map((b) => ({
      time: b.datetime.slice(0, 10) as Time,
      value: b.volume,
      color: b.close >= b.open ? upColor : downColor,
    }));
    volSeries.setData(data);
  });

  return <div ref={containerRef} class="w-full" style={{ height: `${props.height ?? 150}px` }} />;
};
