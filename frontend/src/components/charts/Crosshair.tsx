/**
 * Crosshair.tsx — 十字光标管理
 * 职责：十字光标样式配置、多图表同步、十字光标位置管理
 */
import { Component, createSignal, onCleanup, createEffect } from 'solid-js';
import {
  IChartApi,
  ISeriesApi,
  Time,
  CrosshairMode,
} from 'lightweight-charts';

export interface CrosshairOptions {
  /** 水平线颜色 */
  horzLineColor?: string;
  /** 垂直线颜色 */
  vertLineColor?: string;
  /** 垂直线样式 (0=solid, 2=dashed) */
  vertLineStyle?: 0 | 1 | 2 | 3 | 4;
  /** 水平线样式 */
  horzLineStyle?: 0 | 1 | 2 | 3 | 4;
  /** 标签背景色 */
  labelBackgroundColor?: string;
}

export interface CrosshairSubscribeCallbacks {
  onCrosshairMove?: (time: Time | null, price: number | undefined, index: number) => void;
  onVisibleRangeChange?: (visible: number, total: number) => void;
}

const DEFAULT_OPTIONS: Required<CrosshairOptions> = {
  horzLineColor: 'rgba(255, 255, 255, 0.3)',
  vertLineColor: 'rgba(255, 255, 255, 0.3)',
  vertLineStyle: 2,
  horzLineStyle: 2,
  labelBackgroundColor: '#3B82F6',
};

/**
 * 十字光标管理器 — 封装 crosshair 配置与多图表同步
 */
export class CrosshairManager {
  private chart: IChartApi;
  private candleSeries: ISeriesApi<'Candlestick'> | undefined;
  private options: Required<CrosshairOptions>;
  private unsubscribers: (() => void)[] = [];

  constructor(chart: IChartApi, candleSeries: ISeriesApi<'Candlestick'> | undefined, options: CrosshairOptions = {}) {
    this.chart = chart;
    this.candleSeries = candleSeries;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.applyOptions();
  }

  private applyOptions() {
    this.chart.applyOptions({
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          width: 1,
          color: this.options.vertLineColor,
          style: this.options.vertLineStyle,
          labelBackgroundColor: this.options.labelBackgroundColor,
        },
        horzLine: {
          width: 1,
          color: this.options.horzLineColor,
          style: this.options.horzLineStyle,
          labelBackgroundColor: this.options.labelBackgroundColor,
        },
      },
    });
  }

  /** 订阅十字光标移动事件 */
  subscribe(callbacks: CrosshairSubscribeCallbacks) {
    const unsub = this.chart.subscribeCrosshairMove((param) => {
      const t = param.time as Time | undefined;
      let price: number | undefined;
      let index = -1;

      if (param.point && this.candleSeries) {
        price = this.candleSeries.coordinateToPrice(param.point.y) ?? undefined;
        // Get bar index
        if (param.time && this.candleSeries.data) {
          const bars = this.candleSeries.data();
          index = bars.findIndex((b) => b.time === param.time);
        }
      }

      callbacks.onCrosshairMove?.(t || null, price, index);
    });
    this.unsubscribers.push(unsub);
  }

  /** 设置十字光标位置（用于多图表同步） */
  setPosition(price: number, time: Time, series: ISeriesApi<'Candlestick'>) {
    this.chart.setCrosshairPosition(price, time, series);
  }

  /** 清除十字光标 */
  clearPosition() {
    this.chart.setCrosshairPosition(Number.NaN, '' as Time, this.candleSeries!);
  }

  /** 销毁 */
  destroy() {
    this.unsubscribers.forEach((fn) => fn());
    this.unsubscribers = [];
  }
}

/**
 * 十字光标组件（可视化 + 事件订阅）
 * 不渲染DOM，只管理crosshair行为
 */
export const Crosshair: Component<{
  chart: IChartApi | undefined;
  candleSeries: ISeriesApi<'Candlestick'> | undefined;
  options?: CrosshairOptions;
  /** 外部设置的十字光标时间（用于图表间同步） */
  externalCrosshairTime?: () => Time | null;
  /** 十字光标移动回调 */
  onCrosshairMove?: (time: Time | null, price: number | undefined) => void;
}> = (props) => {
  let manager: CrosshairManager | null = null;

  createEffect(() => {
    const chart = props.chart;
    const cs = props.candleSeries;

    if (!chart || !cs) return;

    if (!manager) {
      manager = new CrosshairManager(chart, cs, props.options);
      manager.subscribe({
        onCrosshairMove: (time, price) => {
          props.onCrosshairMove?.(time, price);
        },
      });
    }
  });

  // 外部十字光标同步（来自其他图表）
  createEffect(() => {
    const extTime = props.externalCrosshairTime?.();
    if (extTime && manager && props.candleSeries) {
      manager.setPosition(0, extTime, props.candleSeries);
    }
  });

  onCleanup(() => {
    manager?.destroy();
    manager = null;
  });

  return null;
};

/**
 * 十字光标信息浮层 — 显示光标所在位置的价格/时间信息
 */
export interface CrosshairInfo {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const CrosshairPriceLabel: Component<{
  visible: boolean;
  price: number;
  color?: string;
}> = (props) => {
  if (!props.visible) return null;
  return (
    <div
      class="absolute right-0 px-1 py-0.5 text-xs font-mono bg-[#3B82F6] text-white rounded-sm"
      style={{ top: '50%', transform: 'translateY(-50%)' }}
    >
      {props.price.toFixed(2)}
    </div>
  );
};
