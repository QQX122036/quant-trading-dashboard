/**
 * IndicatorOverlay.tsx — 指标叠加层
 * 职责：技术指标（MA5/10/20、BOLL、VOLUME等）在K线图上的叠加绘制
 */
import { Component, createEffect, onCleanup } from 'solid-js';
import { IChartApi, ISeriesApi, LineData, Time } from 'lightweight-charts';
import type { DailyBar } from '../../hooks/useApi';

export interface IndicatorConfig {
  type: 'MA' | 'BOLL' | 'VOL';
  periods?: number[]; // e.g. [5, 10, 20] for MA
  bollPeriod?: number; // default 20
  bollStdDev?: number; // default 2
  color?: string;
}

export interface IndicatorOverlayProps {
  chart: IChartApi | undefined;
  candleSeries: ISeriesApi<'Candlestick'> | undefined;
  bars: DailyBar[];
  /** 启用的指标列表 */
  indicators: IndicatorConfig[];
  /** 额外自定义指标series数据 */
  customSeries?: Map<
    string,
    {
      main: ISeriesApi<'Line'>;
      dif?: ISeriesApi<'Line'>;
      dea?: ISeriesApi<'Line'>;
      hist?: ISeriesApi<'Histogram'>;
    }
  >;
}

// MA颜色配置
const MA_COLORS: Record<number, string> = {
  5: '#3B82F6',
  10: '#F59E0B',
  20: '#8B5CF6',
  60: '#10B981',
  120: '#EC4899',
  250: '#6366F1',
};

// BOLL颜色
const BOLL_MID_COLOR = '#F59E0B';
const BOLL_UPPER_COLOR = 'rgba(245, 158, 11, 0.3)';
const BOLL_LOWER_COLOR = 'rgba(245, 158, 11, 0.3)';

function barTime(bar: DailyBar): Time {
  return bar.trade_date.split('T')[0].split(' ')[0] as Time;
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

function calcBOLL(
  closes: number[],
  times: Time[],
  _period = 20,
  _stdDev = 2
): { mid: LineData<Time>[]; upper: LineData<Time>[]; lower: LineData<Time>[] } {
  const mid: LineData<Time>[] = [];
  const upper: LineData<Time>[] = [];
  const lower: LineData<Time>[] = [];

  for (let i = _period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - _period + 1, i + 1);
    const avg = slice.reduce((a, b) => a + b, 0) / _period;
    const variance = slice.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / _period;
    const std = Math.sqrt(variance);
    mid.push({ time: times[i], value: avg });
    upper.push({ time: times[i], value: avg + _stdDev * std });
    lower.push({ time: times[i], value: avg - _stdDev * std });
  }
  return { mid, upper, lower };
}

/**
 * 指标叠加层 — 管理所有技术指标series的添加/更新/删除
 */
export class IndicatorOverlayManager {
  private chart: IChartApi;
  private candleSeries: ISeriesApi<'Candlestick'> | undefined;
  private maSeriesMap = new Map<number, ISeriesApi<'Line'>>();
  private bollSeries: {
    mid: ISeriesApi<'Line'>;
    upper: ISeriesApi<'Line'>;
    lower: ISeriesApi<'Line'>;
  } | null = null;
  private activeIndicators = new Set<string>();

  constructor(chart: IChartApi, candleSeries: ISeriesApi<'Candlestick'> | undefined) {
    this.chart = chart;
    this.candleSeries = candleSeries;
  }

  /** 启用/更新 MA 指标 */
  enableMA(periods: number[]) {
    periods.forEach((period) => {
      const key = `MA${period}`;
      if (!this.maSeriesMap.has(period)) {
        const color = MA_COLORS[period] ?? '#9CA3AF';
        const s = this.chart.addLineSeries({
          color,
          lineWidth: 1,
          priceLineVisible: false,
          title: `MA${period}`,
        });
        this.maSeriesMap.set(period, s);
      }
      this.activeIndicators.add(key);
    });
  }

  /** 禁用 MA 指标 */
  disableMA(period: number) {
    const series = this.maSeriesMap.get(period);
    if (series) {
      this.chart.removeSeries(series);
      this.maSeriesMap.delete(period);
    }
    this.activeIndicators.delete(`MA${period}`);
  }

  /** 启用/更新 BOLL 指标 */
  enableBOLL(_period = 20, _stdDev = 2) {
    if (!this.bollSeries) {
      const mid = this.chart.addLineSeries({
        color: BOLL_MID_COLOR,
        lineWidth: 1,
        priceLineVisible: false,
        title: 'BOLL_MID',
      });
      const upper = this.chart.addLineSeries({
        color: BOLL_UPPER_COLOR,
        lineWidth: 1,
        priceLineVisible: false,
        title: 'BOLL_UPPER',
      });
      const lower = this.chart.addLineSeries({
        color: BOLL_LOWER_COLOR,
        lineWidth: 1,
        priceLineVisible: false,
        title: 'BOLL_LOWER',
      });
      this.bollSeries = { mid, upper, lower };
    }
    this.activeIndicators.add('BOLL');
  }

  /** 禁用 BOLL 指标 */
  disableBOLL() {
    if (this.bollSeries) {
      this.chart.removeSeries(this.bollSeries.mid);
      this.chart.removeSeries(this.bollSeries.upper);
      this.chart.removeSeries(this.bollSeries.lower);
      this.bollSeries = null;
    }
    this.activeIndicators.delete('BOLL');
  }

  /** 更新所有指标数据 */
  render(bars: DailyBar[]) {
    const closes = bars.map((b) => b.close);
    const times = bars.map(barTime);

    // MA
    this.maSeriesMap.forEach((series, period) => {
      series.setData(calcMA(closes, times, period));
    });

    // BOLL
    if (this.bollSeries) {
      const { mid, upper, lower } = calcBOLL(closes, times);
      this.bollSeries.mid.setData(mid);
      this.bollSeries.upper.setData(upper);
      this.bollSeries.lower.setData(lower);
    }
  }

  /** 销毁所有指标series */
  destroy() {
    this.maSeriesMap.forEach((s) => {
      try {
        this.chart.removeSeries(s);
      } catch {
        /* already removed */
      }
    });
    this.maSeriesMap.clear();
    this.disableBOLL();
  }
}

/**
 * IndicatorOverlay 组件
 */
export const IndicatorOverlay: Component<IndicatorOverlayProps> = (props) => {
  let manager: IndicatorOverlayManager | null = null;

  createEffect(() => {
    const chart = props.chart;
    const cs = props.candleSeries;
    const bars = props.bars;
    const indicators = props.indicators;

    if (!chart || !cs || bars.length === 0) return;

    if (!manager) {
      manager = new IndicatorOverlayManager(chart, cs);
    }

    // Apply indicators from config
    indicators.forEach((ind) => {
      if (ind.type === 'MA' && ind.periods) {
        manager!.enableMA(ind.periods);
      } else if (ind.type === 'BOLL') {
        manager!.enableBOLL(ind.bollPeriod ?? 20, ind.bollStdDev ?? 2);
      }
    });

    manager.render(bars);
  });

  onCleanup(() => {
    manager?.destroy();
    manager = null;
  });

  return null; // invisible
};
