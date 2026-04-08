/**
 * ChipChart.tsx — 筹码分布侧边图
 * 职责：筹码分布直方图
 */
import { Component, Show, onMount, onCleanup, createEffect } from 'solid-js';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  HistogramData,
  Time,
  CrosshairMode,
} from 'lightweight-charts';
import type { DailyBar } from '../../../hooks/useApi';
import { computeChipDistribution, type ChipDistribution } from './chartUtils';

export interface ChipChartProps {
  show: boolean;
  bars: DailyBar[];
}

export const ChipChart: Component<ChipChartProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  let chart: IChartApi | undefined;
  let chipSeries: ISeriesApi<'Histogram'> | undefined;

  function setupChart() {
    if (!containerRef) return;
    chart = createChart(containerRef, {
      layout: { background: { color: '#0A0E17' }, textColor: '#9CA3AF' },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.03)' },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' },
      timeScale: { visible: false },
      crosshair: { mode: CrosshairMode.Normal },
    });
    chipSeries = chart.addHistogramSeries({
      priceLineVisible: false,
      priceFormat: { type: 'volume' },
    });

    onCleanup(() => chart?.remove());
  }

  function updateChips() {
    if (!chipSeries || props.bars.length === 0) return;
    const chips: ChipDistribution[] = computeChipDistribution(props.bars);
    const upColor = 'rgba(239,68,68,0.6)';
    const lastDate = props.bars[props.bars.length - 1].trade_date as Time;
    const histData: HistogramData<Time>[] = chips.map((c) => ({
      time: lastDate,
      value: c.volume,
      color: upColor,
    }));
    chipSeries.setData(histData);
  }

  onMount(() => {
    setupChart();
  });

  createEffect(() => {
    if (props.bars.length > 0) {
      updateChips();
    }
  });

  return (
    <Show when={props.show}>
      <div class="w-32 border-l border-white/10 flex flex-col">
        <div class="px-2 py-1 text-xs text-gray-400 border-b border-white/10">筹码分布</div>
        <div class="flex-1" ref={containerRef} />
      </div>
    </Show>
  );
};
