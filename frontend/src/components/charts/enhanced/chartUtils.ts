/**
 * chartUtils.ts — K线图表共享工具函数
 */
import { CandlestickData, LineData, Time } from 'lightweight-charts';
import type { DailyBar } from '../../../hooks/useApi';

export const UP_COLOR = '#EF4444';
export const DOWN_COLOR = '#22C55E';
export const MA_COLORS = ['#3B82F6', '#F59E0B', '#8B5CF6', '#10B981', '#EC4899'];

export function barToCandle(bar: DailyBar): CandlestickData<Time> {
  const dateStr = bar.trade_date.split('T')[0].split(' ')[0];
  return { time: dateStr as Time, open: bar.open, high: bar.high, low: bar.low, close: bar.close };
}

export function calcMA(closes: number[], times: Time[], period: number): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const avg = slice.reduce((a, b) => a + b, 0) / period;
    result.push({ time: times[i], value: Number(avg.toFixed(2)) });
  }
  return result;
}

export function adjustBars(bars: DailyBar[], type: 'none' | 'forward' | 'backward'): DailyBar[] {
  if (type === 'none' || bars.length === 0) return bars;
  const lastBar = bars[bars.length - 1];
  return bars.map((bar) => {
    if (type === 'forward') {
      const ratio = lastBar.close / bar.close;
      return {
        ...bar,
        open: bar.open * ratio,
        high: bar.high * ratio,
        low: bar.low * ratio,
        close: bar.close * ratio,
      };
    } else {
      const ratio = bar.close / lastBar.close;
      return {
        ...bar,
        open: bar.open * ratio,
        high: bar.high * ratio,
        low: bar.low * ratio,
        close: bar.close * ratio,
      };
    }
  });
}

export function normalizeToStart(bars: DailyBar[], closeKey = 'close'): LineData<Time>[] {
  if (bars.length === 0) return [];
  const startPrice = bars[0][closeKey as keyof DailyBar] as number;
  return bars.map((bar) => {
    const price = bar[closeKey as keyof DailyBar] as number;
    const dateStr = bar.trade_date.split('T')[0].split(' ')[0];
    return { time: dateStr as Time, value: Number(((price / startPrice) * 100).toFixed(2)) };
  });
}

export interface ChipDistribution {
  price: number;
  volume: number;
  ratio: number;
}

export function computeChipDistribution(bars: DailyBar[], bucketCount = 50): ChipDistribution[] {
  if (bars.length === 0) return [];
  const minPrice = Math.min(...bars.map((b) => b.low));
  const maxPrice = Math.max(...bars.map((b) => b.high));
  const range = maxPrice - minPrice;
  const bucketSize = range / bucketCount;
  const buckets = new Array(bucketCount).fill(0);

  bars.forEach((bar) => {
    for (let i = 0; i < bucketCount; i++) {
      buckets[i] += bar.volume / bucketCount;
    }
  });

  const totalVolume = buckets.reduce((a, b) => a + b, 0);
  return buckets.map((vol, i) => ({
    price: minPrice + bucketSize * (i + 0.5),
    volume: vol,
    ratio: totalVolume > 0 ? vol / totalVolume : 0,
  }));
}

export interface RangeStats {
  change: number;
  changePct: number;
  volume: number;
  avgVolume: number;
  turnoverRate: number;
  amplitude: number;
  indexChangePct?: number;
}

export function computeRangeStats(
  bars: DailyBar[],
  fromIdx: number,
  toIdx: number,
  indexBars?: DailyBar[]
): RangeStats | null {
  if (fromIdx < 0 || toIdx >= bars.length || fromIdx >= toIdx) return null;
  const rangeBars = bars.slice(fromIdx, toIdx + 1);
  const first = rangeBars[0];
  const last = rangeBars[rangeBars.length - 1];
  const change = last.close - first.open;
  const changePct = (change / first.open) * 100;
  const volume = rangeBars.reduce((s, b) => s + b.volume, 0);
  const avgVolume = volume / rangeBars.length;
  const highMax = Math.max(...rangeBars.map((b) => b.high));
  const lowMin = Math.min(...rangeBars.map((b) => b.low));
  const amplitude = ((highMax - lowMin) / first.open) * 100;

  let indexChangePct: number | undefined;
  if (indexBars && indexBars.length > 0) {
    const fromTime = first.trade_date;
    const toTime = last.trade_date;
    const iFirst = indexBars.find((b) => b.trade_date >= fromTime);
    const filtered = indexBars.filter((b) => b.trade_date <= toTime);
    const iLast = filtered[filtered.length - 1];
    if (iFirst && iLast && iFirst !== iLast) {
      indexChangePct = ((iLast.close - iFirst.open) / iFirst.open) * 100;
    }
  }

  return { change, changePct, volume, avgVolume, turnoverRate: 0, amplitude, indexChangePct };
}
