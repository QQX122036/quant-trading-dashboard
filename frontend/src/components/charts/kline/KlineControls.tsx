/**
 * KlineControls.tsx — zoom/scroll/timeframe toolbar
 * Extracted from KlineChart.tsx
 */
import { Component, For } from 'solid-js';

interface KlineControlsProps {
  timeframe: '1D' | '1W' | '1M';
  onTimeframeChange: (tf: '1D' | '1W' | '1M') => void;
  visibleCount: number;
  totalCount: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onScrollLeft: () => void;
  onScrollRight: () => void;
  onScrollToStart: () => void;
  onScrollToRealTime: () => void;
  onOpenCustomIndicatorEditor?: () => void;
}

export const KlineControls: Component<KlineControlsProps> = (props) => {
  return (
    <div class="absolute top-2 right-2 z-10 flex items-center gap-2">
      {/* Visible range indicator */}
      <span class="text-xs text-gray-400 bg-black/40 px-2 py-1 rounded">
        显示 {props.visibleCount} / {props.totalCount} 条
      </span>

      {/* Zoom buttons */}
      <div class="flex gap-1">
        <button
          class="px-2 py-1 text-xs rounded bg-white/10 text-gray-300 hover:bg-white/20 transition-colors"
          onClick={props.onZoomOut}
          title="缩小（查看更多数据）"
        >
          ➖ 缩小
        </button>
        <button
          class="px-2 py-1 text-xs rounded bg-white/10 text-gray-300 hover:bg-white/20 transition-colors"
          onClick={props.onZoomIn}
          title="放大（查看更少数据）"
        >
          ➕ 放大
        </button>
      </div>

      {/* Scroll buttons */}
      <div class="flex gap-1">
        <button
          class="px-2 py-1 text-xs rounded bg-white/10 text-gray-300 hover:bg-white/20 transition-colors"
          onClick={props.onScrollToStart}
          title="滚动到开头 (Home)"
        >
          ⏮
        </button>
        <button
          class="px-2 py-1 text-xs rounded bg-white/10 text-gray-300 hover:bg-white/20 transition-colors"
          onClick={props.onScrollLeft}
          title="向左平移 (←)"
        >
          ◀
        </button>
        <button
          class="px-2 py-1 text-xs rounded bg-white/10 text-gray-300 hover:bg-white/20 transition-colors"
          onClick={props.onScrollRight}
          title="向右平移 (→)"
        >
          ▶
        </button>
        <button
          class="px-2 py-1 text-xs rounded bg-white/10 text-gray-300 hover:bg-white/20 transition-colors"
          onClick={props.onScrollToRealTime}
          title="滚动到最新 (End)"
        >
          ⏭
        </button>
      </div>

      {/* Timeframe selector */}
      <div class="flex gap-1">
        <For each={['1D', '1W', '1M'] as const}>
          {(tf) => (
            <button
              class={`px-2 py-1 text-xs rounded transition-colors ${props.timeframe === tf ? 'bg-blue-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
              onClick={() => props.onTimeframeChange(tf)}
            >
              {tf === '1D' ? '日线' : tf === '1W' ? '周线' : '月线'}
            </button>
          )}
        </For>
      </div>

      {/* Custom indicator button */}
      {props.onOpenCustomIndicatorEditor && (
        <button
          class="px-2 py-1 text-xs rounded bg-purple-600/80 hover:bg-purple-600 text-white transition-colors flex items-center gap-1"
          onClick={props.onOpenCustomIndicatorEditor}
          title="自定义指标编辑器"
        >
          📊 指标
        </button>
      )}
    </div>
  );
};
