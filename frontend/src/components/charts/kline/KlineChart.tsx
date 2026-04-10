/**
 * KlineChart.tsx — K线图组件（重构版）
 * 对接真实数据，支持 MA5/10/20、因子信号标记、十字光标同步
 *
 * 组件结构：
 * - useKlineChart.ts  — chart初始化 + series管理
 * - KlineControls.tsx — 工具栏（缩放/平移/时间周期）
 * - KlineOverlay.tsx  — 加载/错误覆盖层
 * - KlineChart.tsx    — 主组件，组合以上模块
 */
import { Component, createSignal, createEffect, onMount } from 'solid-js';
import type { Time } from 'lightweight-charts';
import type { DailyBar } from '../../../hooks/useApi';

import { useKlineChart } from './useKlineChart';
import { KlineControls } from './KlineControls';
import { KlineOverlay } from './KlineOverlay';

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

// A股红涨绿跌配色
const _UP_COLOR = '#EF4444';
const _DOWN_COLOR = '#22C55E';
const _MA5_COLOR = '#3B82F6';
const _MA10_COLOR = '#F59E0B';
const _MA20_COLOR = '#8B5CF6';

export const KlineChart: Component<KlineChartProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  const [timeframe, setTimeframe] = createSignal<'1D' | '1W' | '1M'>('1D');

  const kline = useKlineChart(() => containerRef, {
    initialBars: props.bars,
    onCrosshairMove: props.onCrosshairMove,
    externalCrosshairTime: props.externalCrosshairTime,
  });

  async function loadData() {
    const sym = props.symbol || '600519';
    const exch = props.exchange || 'SSE';
    await kline.loadData(sym, exch);
    props.onBarsLoaded?.(kline.bars());
  }

  onMount(() => {
    kline.setupChart(() => {
      // After setup, load data if no external bars provided
      if (!props.bars) {
        loadData();
      }
    });
  });

  // 外部bars传入时更新
  createEffect(() => {
    const bars = props.bars;
    if (bars && bars.length > 0) {
      kline.setBars(bars);
      props.onBarsLoaded?.(bars);
    }
  });

  return (
    <div class="relative w-full h-full">
      <KlineOverlay loading={kline.loading()} error={kline.error()} />

      <KlineControls
        timeframe={timeframe()}
        onTimeframeChange={setTimeframe}
        visibleCount={kline.visibleCount()}
        totalCount={kline.totalCount()}
        onZoomIn={kline.zoomIn}
        onZoomOut={kline.zoomOut}
        onScrollLeft={kline.scrollLeft}
        onScrollRight={kline.scrollRight}
        onScrollToStart={kline.scrollToStart}
        onScrollToRealTime={kline.scrollToRealTime}
        onOpenCustomIndicatorEditor={props.onOpenCustomIndicatorEditor}
      />

      <div ref={containerRef} class="w-full h-full" />
    </div>
  );
};
