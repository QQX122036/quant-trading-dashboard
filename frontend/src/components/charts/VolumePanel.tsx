/**
 * VolumePanel.tsx — 成交量面板
 * 职责：独立成交量子图、MAVOL均线、颜色区分涨跌量
 */
import { Component, createEffect, onCleanup } from 'solid-js';
import { IChartApi, ISeriesApi, HistogramData, LineData, Time } from 'lightweight-charts';
import type { DailyBar } from '../../hooks/useApi';

export interface VolumePanelProps {
  chart: IChartApi | undefined;
  bars: DailyBar[];
  /** 是否显示成交量均线 */
  showMA?: boolean;
  /** 高度占比（默认0.15 = 15%） */
  heightRatio?: number;
}

const UP_COLOR = 'rgba(239, 68, 68, 0.6)'; // 红涨
const DOWN_COLOR = 'rgba(34, 197, 94, 0.6)'; // 绿跌
const MAVOL5_COLOR = '#3B82F6';
const MAVOL10_COLOR = '#F59E0B';

function calcMAVOL(volumes: number[], times: Time[], period: number): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  for (let i = period - 1; i < volumes.length; i++) {
    const slice = volumes.slice(i - period + 1, i + 1);
    const avg = slice.reduce((a, b) => a + b, 0) / period;
    result.push({ time: times[i], value: avg });
  }
  return result;
}

function buildVolumeHistogram(bars: DailyBar[]): HistogramData<Time>[] {
  return bars.map((bar) => ({
    time: bar.trade_date.split('T')[0].split(' ')[0] as Time,
    value: bar.volume,
    color: bar.close >= bar.open ? UP_COLOR : DOWN_COLOR,
  }));
}

/**
 * 独立成交量面板 — 挂在主图表下方（通过 chart.addPane 或同一pane独立series）
 * 实际实现：与主图共享时间轴，作为独立 pane
 */
export const VolumePanel: Component<VolumePanelProps> = (props) => {
  let volumeSeries: ISeriesApi<'Histogram'> | undefined;
  let mavol5Series: ISeriesApi<'Line'> | undefined;
  let mavol10Series: ISeriesApi<'Line'> | undefined;

  function initSeries(chart: IChartApi) {
    if (volumeSeries) return; // already initialized

    volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    if (props.showMA !== false) {
      mavol5Series = chart.addLineSeries({
        color: MAVOL5_COLOR,
        lineWidth: 1,
        priceLineVisible: false,
        priceScaleId: 'volume',
        scaleMargins: { top: 0.85, bottom: 0 },
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });

      mavol10Series = chart.addLineSeries({
        color: MAVOL10_COLOR,
        lineWidth: 1,
        priceLineVisible: false,
        priceScaleId: 'volume',
        scaleMargins: { top: 0.85, bottom: 0 },
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
    }

    chart.priceScale('volume').applyOptions({
      autoScale: true,
      scaleMargins: { top: 0.85, bottom: 0 },
    });
  }

  function renderVolume(bars: DailyBar[]) {
    if (!volumeSeries) return;
    volumeSeries.setData(buildVolumeHistogram(bars));

    if (mavol5Series || mavol10Series) {
      const closes = bars.map((b) => b.close);
      const times = bars.map((b) => barTime(b));
      if (mavol5Series)
        mavol5Series.setData(
          calcMAVOL(
            bars.map((b) => b.volume),
            times,
            5
          )
        );
      if (mavol10Series)
        mavol10Series.setData(
          calcMAVOL(
            bars.map((b) => b.volume),
            times,
            10
          )
        );
    }
  }

  function barTime(bar: DailyBar): Time {
    return bar.trade_date.split('T')[0].split(' ')[0] as Time;
  }

  createEffect(() => {
    const bars = props.bars;
    if (!props.chart || bars.length === 0) return;
    initSeries(props.chart);
    renderVolume(bars);
  });

  onCleanup(() => {
    if (volumeSeries && props.chart) {
      try {
        props.chart.removeSeries(volumeSeries);
      } catch {
        /* already removed */
      }
      volumeSeries = undefined;
    }
    if (mavol5Series && props.chart) {
      try {
        props.chart.removeSeries(mavol5Series);
      } catch {
        /* already removed */
      }
      mavol5Series = undefined;
    }
    if (mavol10Series && props.chart) {
      try {
        props.chart.removeSeries(mavol10Series);
      } catch {
        /* already removed */
      }
      mavol10Series = undefined;
    }
  });

  return null; // invisible, manages series only
};
