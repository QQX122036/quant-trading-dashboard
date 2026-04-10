/**
 * PriceScale.tsx — 价格刻度管理
 * 职责：右侧价格轴配置、当前价格线、价格格式
 */
import { Component, createSignal, createEffect, onMount, onCleanup } from 'solid-js';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';

export interface PriceScaleOptions {
  borderColor?: string;
  textColor?: string;
  autoScale?: boolean;
  scaleMargins?: { top: number; bottom: number };
}

export interface PriceScaleProps {
  chart: IChartApi | undefined;
  candleSeries: ISeriesApi<'Candlestick'> | undefined;
  options?: PriceScaleOptions;
}

const DEFAULT_OPTIONS: PriceScaleOptions = {
  borderColor: 'rgba(255, 255, 255, 0.1)',
  textColor: '#9CA3AF',
  autoScale: true,
  scaleMargins: { top: 0.05, bottom: 0.05 },
};

/**
 * 配置图表右侧价格轴
 */
export function configurePriceScale(
  _chart: IChartApi,
  options: PriceScaleOptions = DEFAULT_OPTIONS
): void {
  _chart.applyOptions({
    rightPriceScale: {
      borderColor: options.borderColor,
      autoScale: options.autoScale,
      scaleMargins: options.scaleMargins,
    },
  });
}

/**
 * 价格刻度 Hook — 返回当前价格和涨跌幅
 */
export function usePriceScale(
  _chart: () => IChartApi | undefined,
  _candleSeries: () => ISeriesApi<'Candlestick'> | undefined
) {
  const [currentPrice, setCurrentPrice] = createSignal<number>(0);
  const [priceChange, setPriceChange] = createSignal<number>(0);
  const [priceChangePercent, setPriceChangePercent] = createSignal<number>(0);
  const [openPrice, setOpenPrice] = createSignal<number>(0);

  function updatePrice(bars: { close: number; open: number }[]) {
    if (bars.length === 0) return;
    const last = bars[bars.length - 1];
    const first = bars[0];
    setCurrentPrice(last.close);
    setOpenPrice(first.open);
    const change = last.close - first.open;
    const changePercent = first.open !== 0 ? (change / first.open) * 100 : 0;
    setPriceChange(change);
    setPriceChangePercent(changePercent);
  }

  return {
    currentPrice,
    priceChange,
    priceChangePercent,
    openPrice,
    updatePrice,
  };
}

/**
 * 当前价格线组件 — 在图表上显示当前价格水平线
 */
export const CurrentPriceLine: Component<{
  chart: IChartApi | undefined;
  series: ISeriesApi<'Candlestick'> | undefined;
  price: () => number;
}> = (props) => {
  let priceLineSeries: ISeriesApi<'Line'> | undefined;

  onMount(() => {
    if (!props.chart) return;
    priceLineSeries = props.chart.addLineSeries({
      color: 'rgba(59, 130, 246, 0.5)',
      lineWidth: 1,
      lineStyle: 2, // dashed
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
  });

  createEffect(() => {
    const price = props.price();
    if (priceLineSeries && price > 0) {
      const chartBars = props.series?.data?.() ?? [];
      if (chartBars.length > 0) {
        const lastBar = chartBars[chartBars.length - 1];
        if (lastBar && 'time' in lastBar) {
          priceLineSeries.setData([{ time: lastBar.time, value: price }]);
        }
      }
    }
  });

  onCleanup(() => {
    if (priceLineSeries && props.chart) {
      try {
        props.chart.removeSeries(priceLineSeries);
      } catch {
        /* already removed */
      }
    }
  });

  return null;
};
