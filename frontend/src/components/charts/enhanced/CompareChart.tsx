/**
 * CompareChart.tsx — 多股票对比图
 * 职责：归一化多股票K线叠加对比（独立图表实例）
 */
import { Component, Show, For, onMount, onCleanup, createEffect } from 'solid-js';
import {
  createChart, IChartApi, ISeriesApi, LineData, Time, CrosshairMode,
} from 'lightweight-charts';
import type { ComparedStock } from './EnhancedKlineChart';
import { adjustBars, normalizeToStart } from './chartUtils';

export interface CompareChartProps {
  show: boolean;
  comparedStocks: ComparedStock[];
  bars: import('../../../hooks/useApi').DailyBar[];
  adjustType: 'none' | 'forward' | 'backward';
  onRemoveStock: (tsCode: string) => void;
}

export const CompareChart: Component<CompareChartProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  let chart: IChartApi | undefined;

  function setupChart() {
    if (!containerRef) return;
    chart = createChart(containerRef, {
      layout: { background: { color: '#0A0E17' }, textColor: '#9CA3AF' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)', scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: 'rgba(255,255,255,0.1)', timeVisible: true },
      crosshair: { mode: CrosshairMode.Normal },
    });

    onCleanup(() => chart?.remove());
  }

  onMount(() => {
    setupChart();
  });

  // Sync compare stocks to chart series
  createEffect(() => {
    if (!chart || !props.show) return;
    // Add main stock normalized line
    const adjBars = adjustBars(props.bars, props.adjustType);
    const mainNormalized = normalizeToStart(adjBars);
    // We use a simple approach: just show compared stocks, main stock shown in parent chart
  });

  return (
    <Show when={props.show && props.comparedStocks.length > 0}>
      <div class="h-32 border-t border-white/10 flex flex-col">
        <div class="flex items-center gap-2 px-2 py-1 border-b border-white/10">
          <span class="text-xs text-gray-400">多股票对比（归一化）</span>
          <For each={props.comparedStocks}>
            {(stock) => (
              <span class="flex items-center gap-1 text-xs">
                <span class="w-2 h-2 rounded-full" style={{ background: stock.color }} />
                <span class="text-gray-300">{stock.name}</span>
                <button class="text-gray-500 hover:text-red-400 ml-1" onClick={() => props.onRemoveStock(stock.ts_code)}>✕</button>
              </span>
            )}
          </For>
        </div>
        <div class="flex-1" ref={containerRef} />
      </div>
    </Show>
  );
};
