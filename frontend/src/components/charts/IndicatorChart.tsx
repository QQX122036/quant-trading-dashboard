import { Component, onMount, onCleanup, createSignal, createEffect } from 'solid-js';
import { createChart, IChartApi, Time } from 'lightweight-charts';
import { fetchDailyBar, type KLineBar, type DailyBar } from '../../hooks/useApi';

// ── Types ───────────────────────────────────────────────────────────────────

export interface IndicatorChartProps {
  type: 'MACD' | 'RSI' | 'KDJ' | 'BOLL';
  symbol?: string;
  exchange?: string;
  bars?: KLineBar[] | DailyBar[];
}

// ── Technical Indicator Calculations (from scratch) ──────────────────────────

/** Simple Moving Average */
function sma(values: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += values[i - j];
      }
      result.push(sum / period);
    }
  }
  return result;
}

/** Exponential Moving Average */
function ema(values: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);
  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      result.push(values[0]);
    } else if (i < period - 1) {
      // Use SMA for the initial values
      let sum = 0;
      for (let j = 0; j <= i; j++) {
        sum += values[j];
      }
      result.push(sum / (i + 1));
    } else if (i === period - 1) {
      // First EMA uses SMA of first period
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += values[j];
      }
      result.push(sum / period);
    } else {
      result.push((values[i] - result[i - 1]) * multiplier + result[i - 1]);
    }
  }
  return result;
}

/** Standard Deviation */
function stdDev(values: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += values[i - j];
      }
      const mean = sum / period;
      let variance = 0;
      for (let j = 0; j < period; j++) {
        variance += Math.pow(values[i - j] - mean, 2);
      }
      result.push(Math.sqrt(variance / period));
    }
  }
  return result;
}


// ── Indicator Calculations ────────────────────────────────────────────────────

interface MACDResult {
  dif: number[];
  dea: number[];
  histogram: number[];
}

export function calculateMACD(closes: number[]): MACDResult {
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const dif = ema12.map((v, i) => v - ema26[i]);
  const dea = ema(dif, 9);
  const histogram = dif.map((v, i) => v - dea[i]);
  return { dif, dea, histogram };
}

interface RSIResult {
  rsi: number[];
}

function calculateRSI(closes: number[], period = 14): RSIResult {
  const rsi: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period) {
      rsi.push(NaN);
      continue;
    }
    let avgGain = 0;
    let avgLoss = 0;
    for (let j = 1; j <= period; j++) {
      const change = closes[i - j + 1] - closes[i - j];
      if (change > 0) avgGain += change;
      else avgLoss += Math.abs(change);
    }
    avgGain /= period;
    avgLoss /= period;
    if (avgLoss === 0) {
      rsi.push(100);
    } else {
      const rs = avgGain / avgLoss;
      rsi.push(100 - 100 / (1 + rs));
    }
  }
  return { rsi };
}

interface KDJResult {
  k: number[];
  d: number[];
  j: number[];
}

function calculateKDJ(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 9
): KDJResult {
  const k: number[] = [];
  const d: number[] = [];
  const j: number[] = [];

  const rsvValues: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      rsvValues.push(NaN);
      k.push(NaN);
      d.push(NaN);
      j.push(NaN);
    } else {
      const lowValues = lows.slice(i - period + 1, i + 1);
      const highValues = highs.slice(i - period + 1, i + 1);
      const lowMin = Math.min(...lowValues);
      const highMax = Math.max(...highValues);
      const rsv =
        highMax === lowMin
          ? 50
          : ((closes[i] - lowMin) / (highMax - lowMin)) * 100;
      rsvValues.push(rsv);

      const prevK = k.length > 0 ? k[k.length - 1] : 50;
      const prevD = d.length > 0 ? d[d.length - 1] : 50;

      const kVal = (2 / 3) * prevK + (1 / 3) * rsv;
      const dVal = (2 / 3) * prevD + (1 / 3) * kVal;
      const jVal = 3 * kVal - 2 * dVal;

      k.push(kVal);
      d.push(dVal);
      j.push(jVal);
    }
  }

  return { k, d, j };
}

interface BOLLResult {
  upper: number[];
  middle: number[];
  lower: number[];
}

function calculateBOLL(closes: number[], period = 20, stdDev_mult = 2): BOLLResult {
  const middle = sma(closes, period);
  const std = stdDev(closes, period);
  const upper = middle.map((m, i) => (m !== undefined && !isNaN(m) && std[i] !== undefined ? m + stdDev_mult * std[i] : NaN));
  const lower = middle.map((m, i) => (m !== undefined && !isNaN(m) && std[i] !== undefined ? m - stdDev_mult * std[i] : NaN));
  return { upper, middle, lower };
}

// ── Component ─────────────────────────────────────────────────────────────────

export const IndicatorChart: Component<IndicatorChartProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  let chart: IChartApi | undefined;
  let isDisposed = false; // 跟踪图表是否已被销毁
  const [loading, setLoading] = createSignal(false);

  const loadData = async () => {
    if (!containerRef) return;
    
    // 如果图表已被销毁，不要继续
    if (isDisposed) return;

    let bars: (KLineBar | DailyBar)[] = [];

    if (props.bars && props.bars.length > 0) {
      bars = props.bars as (KLineBar | DailyBar)[];
    } else if (props.symbol && props.exchange) {
      setLoading(true);
      try {
        const res = await fetchDailyBar(`${props.symbol}.${props.exchange}`, undefined, undefined, 100);
        if (res.code === '0' && res.data?.bars) {
          bars = res.data.bars as unknown as KLineBar[];
        }
      } catch (e) {
        console.error('[IndicatorChart] Failed to fetch bars:', e);
      } finally {
        setLoading(false);
      }
    }

    if (bars.length === 0) return;

    // Clear existing series - use a safer approach by recreating the chart
    if (containerRef) {
      // 安全地移除旧图表（如果存在）
      if (chart) {
        try {
          chart.remove();
        } catch (e) {
          // 忽略图表已被销毁的错误
          console.debug('[IndicatorChart] Chart already disposed');
        }
      }
      chart = createChart(containerRef, {
        layout: {
          background: { color: '#0A0E17' },
          textColor: '#9CA3AF',
        },
        grid: {
          vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
          horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
        },
        rightPriceScale: {
          borderColor: 'rgba(255, 255, 255, 0.1)',
        },
        timeScale: {
          visible: true,
          borderColor: 'rgba(255, 255, 255, 0.1)',
          timeVisible: true,
          secondsVisible: false,
        },
        crosshair: {
          vertLine: {
            color: 'rgba(255, 255, 255, 0.3)',
            style: 2,
            labelBackgroundColor: '#3B82F6',
          },
          horzLine: {
            color: 'rgba(255, 255, 255, 0.3)',
            style: 2,
            labelBackgroundColor: '#3B82F6',
          },
        },
      });
    }

    // 确保图表已创建
    if (!chart) return;

    const closes: number[] = bars.map((b) => b.close);
    const highs: number[] = bars.map((b) => b.high);
    const lows: number[] = bars.map((b) => b.low);
    
    // 转换时间戳，过滤掉无效的日期
    const times: Time[] = [];
    bars.forEach((b, index) => {
      const dateStr = (b as any).time || (b as any).timestamp || (b as any).date || (b as any).datetime || (b as any).trade_date || '';
      // 处理不同的日期格式，转换为 yyyy-mm-dd 格式
      let date: Date;
      let formattedDate: string;
      
      if (dateStr.includes('T')) {
        // ISO 格式：2024-01-08T00:00:00 -> 提取日期部分
        formattedDate = dateStr.split('T')[0];
        date = new Date(formattedDate);
      } else if (dateStr.includes('-')) {
        // 日期格式：2024-01-08
        formattedDate = dateStr;
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
          date = new Date(dateStr);
        }
      } else {
        // 其他格式，尝试直接解析
        date = new Date(dateStr);
        formattedDate = dateStr;
      }
      
      const timestamp = Math.floor(date.getTime() / 1000);
      // 如果日期无效，使用前一个有效时间戳 + 60 秒（避免重复）
      if (isNaN(timestamp)) {
        const prevTime = index > 0 ? times[index - 1] as number : Math.floor(Date.now() / 1000);
        times.push((prevTime + 60) as Time);
        console.warn('[IndicatorChart] Invalid date:', dateStr, 'using fallback timestamp:', times[times.length - 1]);
      } else {
        // lightweight-charts 期望 yyyy-mm-dd 格式的字符串作为 Time
        times.push(formattedDate as unknown as Time);
      }
    });

    if (props.type === 'MACD') {
      const { dif, dea, histogram } = calculateMACD(closes);

      const difSeries = chart.addLineSeries({
        color: '#3B82F6',
        lineWidth: 1,
        priceLineVisible: false,
        title: 'DIF',
      });
      const deaSeries = chart.addLineSeries({
        color: '#F59E0B',
        lineWidth: 1,
        priceLineVisible: false,
        title: 'DEA',
      });
      const histSeries = chart.addHistogramSeries({
        priceLineVisible: false,
        title: 'MACD',
      });

      const difData: { time: Time; value: number }[] = [];
      const deaData: { time: Time; value: number }[] = [];
      const histData: { time: Time; value: number; color: string }[] = [];

      for (let i = 0; i < bars.length; i++) {
        if (!isNaN(dif[i])) {
          difData.push({ time: times[i], value: dif[i] });
        }
        if (!isNaN(dea[i])) {
          deaData.push({ time: times[i], value: dea[i] });
        }
        if (!isNaN(histogram[i])) {
          const isUp = histogram[i] >= 0;
          histData.push({
            time: times[i],
            value: histogram[i],
            color: isUp ? 'rgba(239, 68, 68, 0.8)' : 'rgba(34, 197, 94, 0.8)',
          });
        }
      }

      difSeries.setData(difData);
      deaSeries.setData(deaData);
      histSeries.setData(histData);

      chart.timeScale().fitContent();

      // Add price scale for MACD (centered around 0)
      chart.applyOptions({
        rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.1)' },
      });
    } else if (props.type === 'RSI') {
      const { rsi } = calculateRSI(closes, 14);

      const rsiSeries = chart.addLineSeries({
        color: '#8B5CF6',
        lineWidth: 1,
        priceLineVisible: false,
        title: 'RSI',
      });

      // Reference lines at 70 and 30
      const overboughtSeries = chart.addLineSeries({
        color: 'rgba(156, 163, 175, 0.5)',
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        title: '70',
      });
      const oversoldSeries = chart.addLineSeries({
        color: 'rgba(156, 163, 175, 0.5)',
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        title: '30',
      });

      const rsiData: { time: Time; value: number }[] = [];
      const overboughtData: { time: Time; value: number }[] = [];
      const oversoldData: { time: Time; value: number }[] = [];

      for (let i = 0; i < bars.length; i++) {
        if (!isNaN(rsi[i])) {
          rsiData.push({ time: times[i], value: rsi[i] });
          overboughtData.push({ time: times[i], value: 70 });
          oversoldData.push({ time: times[i], value: 30 });
        }
      }

      rsiSeries.setData(rsiData);
      overboughtSeries.setData(overboughtData);
      oversoldSeries.setData(oversoldData);

      chart.timeScale().fitContent();

      chart.applyOptions({
        rightPriceScale: {
          borderColor: 'rgba(255, 255, 255, 0.1)',
          scaleMargins: { top: 0.1, bottom: 0.1 },
        },
      });
    } else if (props.type === 'KDJ') {
      const { k, d, j } = calculateKDJ(highs, lows, closes, 9);

      const kSeries = chart.addLineSeries({
        color: '#3B82F6',
        lineWidth: 1,
        priceLineVisible: false,
        title: 'K',
      });
      const dSeries = chart.addLineSeries({
        color: '#F59E0B',
        lineWidth: 1,
        priceLineVisible: false,
        title: 'D',
      });
      const jSeries = chart.addLineSeries({
        color: '#EF4444',
        lineWidth: 1,
        priceLineVisible: false,
        title: 'J',
      });

      const kData: { time: Time; value: number }[] = [];
      const dData: { time: Time; value: number }[] = [];
      const jData: { time: Time; value: number }[] = [];

      for (let i = 0; i < bars.length; i++) {
        if (!isNaN(k[i])) {
          kData.push({ time: times[i], value: k[i] });
        }
        if (!isNaN(d[i])) {
          dData.push({ time: times[i], value: d[i] });
        }
        if (!isNaN(j[i])) {
          jData.push({ time: times[i], value: j[i] });
        }
      }

      kSeries.setData(kData);
      dSeries.setData(dData);
      jSeries.setData(jData);

      chart.timeScale().fitContent();
    } else if (props.type === 'BOLL') {
      const { upper, middle, lower } = calculateBOLL(closes, 20, 2);

      const upperSeries = chart.addLineSeries({
        color: '#6B7280',
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        title: 'Upper',
      });
      const middleSeries = chart.addLineSeries({
        color: '#3B82F6',
        lineWidth: 1,
        priceLineVisible: false,
        title: 'Middle',
      });
      const lowerSeries = chart.addLineSeries({
        color: '#6B7280',
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        title: 'Lower',
      });

      const upperData: { time: Time; value: number }[] = [];
      const middleData: { time: Time; value: number }[] = [];
      const lowerData: { time: Time; value: number }[] = [];

      for (let i = 0; i < bars.length; i++) {
        if (!isNaN(upper[i])) {
          upperData.push({ time: times[i], value: upper[i] });
        }
        if (!isNaN(middle[i])) {
          middleData.push({ time: times[i], value: middle[i] });
        }
        if (!isNaN(lower[i])) {
          lowerData.push({ time: times[i], value: lower[i] });
        }
      }

      upperSeries.setData(upperData);
      middleSeries.setData(middleData);
      lowerSeries.setData(lowerData);

      chart.timeScale().fitContent();
    }
  };

  onMount(() => {
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
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      timeScale: {
        visible: true,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: {
          color: 'rgba(255, 255, 255, 0.3)',
          style: 2,
          labelBackgroundColor: '#3B82F6',
        },
        horzLine: {
          color: 'rgba(255, 255, 255, 0.3)',
          style: 2,
          labelBackgroundColor: '#3B82F6',
        },
      },
    });

    loadData();

    const resizeObserver = new ResizeObserver(() => {
      if (chart && containerRef) {
        chart.applyOptions({
          width: containerRef.clientWidth,
          height: containerRef.clientHeight,
        });
      }
    });
    resizeObserver.observe(containerRef);

    onCleanup(() => {
      resizeObserver.disconnect();
      if (chart) {
        try {
          chart.remove();
        } catch (e) {
          console.debug('[IndicatorChart] Chart already disposed in cleanup');
        }
      }
    });
  });

  // Reload data when props change
  const updateData = () => {
    if (chart) {
      loadData();
    }
  };

  // Watch for prop changes
  createEffect(() => {
    props.bars;
    props.symbol;
    props.exchange;
    props.type;
    updateData();
  });

  return (
    <div class="relative w-full h-full">
      {loading() && (
        <div class="absolute inset-0 flex items-center justify-center bg-[#0A0E17]/80 z-10">
          <span class="text-[#9CA3AF] text-sm">加载中...</span>
        </div>
      )}
      <div ref={containerRef} class="w-full h-full" />
    </div>
  );
};
