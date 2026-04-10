/**
 * KlineChart types — shared between sub-components
 */
import type { Time } from 'lightweight-charts';
import type { DailyBar } from '../../../hooks/useApi';

// Re-export DailyBar for convenience
export type { DailyBar } from '../../../hooks/useApi';

export interface KlineChartProps {
  symbol?: string;
  exchange?: string;
  /** 外部传入的K线数据（优先使用，否则从API获取） */
  bars?: DailyBar[];
  /** 十字光标时间同步回调 */
  onCrosshairMove?: (time: Time | null) => void;
  /** 外部设置的十字光标时间（来自其他图表同步） */
  externalCrosshairTime?: () => Time | null;
  /** 打开自定义指标编辑器的回调 */
  onOpenCustomIndicatorEditor?: () => void;
  /** K线数据加载完成时回调 */
  onBarsLoaded?: (bars: DailyBar[]) => void;
}

export interface UseKlineChartOptions {
  /** 初始K线数据 */
  initialBars?: DailyBar[];
  /** 十字光标移动回调 */
  onCrosshairMove?: (time: Time | null) => void;
  /** 十字光标同步时间（来自外部） */
  externalCrosshairTime?: () => Time | null;
  /** 自定义指标添加事件 */
  onCustomIndicatorAdd?: (e: Event) => void;
  /** 自定义指标移除事件 */
  onCustomIndicatorRemove?: (e: Event) => void;
}

export interface UseKlineChartResult {
  chart: import('lightweight-charts').IChartApi | undefined;
  candleSeries: import('lightweight-charts').ISeriesApi<'Candlestick'> | undefined;
  bars: () => DailyBar[];
  loading: () => boolean;
  error: () => string | null;
  visibleCount: () => number;
  totalCount: () => number;
  loadData: (symbol: string, exchange: string) => Promise<void>;
  zoomIn: () => void;
  zoomOut: () => void;
  scrollLeft: () => void;
  scrollRight: () => void;
  scrollToStart: () => void;
  scrollToRealTime: () => void;
}
