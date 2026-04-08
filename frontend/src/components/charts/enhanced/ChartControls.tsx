/**
 * ChartControls.tsx — 工具栏控件
 * 职责：复权切换 | 绘图工具 | 缩放控制 | 区间统计 | 筹码/对比开关
 */
import { Component, Show, For } from 'solid-js';
import type { AdjustType } from './types';
import type { DrawingToolType } from './DrawingTools';
import { MAJOR_INDICES } from '../../../hooks/useApi';

export interface ChartControlsProps {
  adjustType: AdjustType;
  onAdjustChange: (type: AdjustType) => void;
  activeTool: DrawingToolType | null;
  onToolChange: (tool: DrawingToolType | null) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  selectingRange: boolean;
  onToggleRange: () => void;
  showChips: boolean;
  onToggleChips: () => void;
  showCompare: boolean;
  onToggleCompare: () => void;
  comparedStocks: Array<{ ts_code: string; name: string }>;
  onAddComparedStock: (tsCode: string) => void;
  onRemoveComparedStock: (tsCode: string) => void;
  visibleCount: number;
  totalCount: number;
  drawingsCount: number;
  onClearDrawings: () => void;
}

export const ChartControls: Component<ChartControlsProps> = (props) => {
  const tools: { tool: DrawingToolType; label: string; icon: string; title: string }[] = [
    { tool: 'trendline', label: '趋势线', icon: '📈', title: '趋势线' },
    { tool: 'fibonacci', label: '斐波那契', icon: '📐', title: '斐波那契回调线' },
    { tool: 'rectangle', label: '矩形', icon: '⬜', title: '矩形标注' },
    { tool: 'text', label: '文字', icon: '📝', title: '文字标注' },
    { tool: 'alertline', label: '预警线', icon: '🔔', title: '突破预警线' },
  ];

  return (
    <div class="flex items-center gap-2 p-2 border-b border-white/10 flex-wrap">
      {/* Adjust type */}
      <div class="flex gap-1">
        <For each={['none', 'forward', 'backward'] as AdjustType[]}>
          {(t) => (
            <button
              class={`px-2 py-1 text-xs rounded transition-colors ${props.adjustType === t ? 'bg-blue-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
              onClick={() => props.onAdjustChange(t)}
              title={
                t === 'none'
                  ? '不复权'
                  : t === 'forward'
                    ? '前复权：以最新价为基准向前拉伸'
                    : '后复权：以历史价为基准向后拉伸'
              }
            >
              {t === 'none' ? '不复权' : t === 'forward' ? '前复权' : '后复权'}
            </button>
          )}
        </For>
      </div>

      <div class="w-px h-4 bg-white/20" />

      {/* Drawing tools */}
      <div class="flex gap-1">
        <For each={tools}>
          {({ tool, label, icon, title }) => (
            <button
              class={`px-2 py-1 text-xs rounded transition-colors ${props.activeTool === tool ? (tool === 'alertline' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white') : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
              onClick={() => props.onToolChange(props.activeTool === tool ? null : tool)}
              title={title}
            >
              {icon} {label}
            </button>
          )}
        </For>
      </div>

      <div class="w-px h-4 bg-white/20" />

      {/* Zoom controls */}
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

      <div class="w-px h-4 bg-white/20" />

      {/* Range selection */}
      <button
        class={`px-2 py-1 text-xs rounded transition-colors ${props.selectingRange ? 'bg-yellow-600 text-white animate-pulse' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
        onClick={props.onToggleRange}
        title="框选K线区间进行统计"
      >
        📊 区间统计
      </button>

      <div class="w-px h-4 bg-white/20" />

      {/* Chips */}
      <button
        class={`px-2 py-1 text-xs rounded transition-colors ${props.showChips ? 'bg-green-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
        onClick={props.onToggleChips}
        title="筹码分布图"
      >
        🎯 筹码分布
      </button>

      {/* Compare */}
      <button
        class={`px-2 py-1 text-xs rounded transition-colors ${props.showCompare ? 'bg-purple-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
        onClick={props.onToggleCompare}
        title="多股票对比"
      >
        📈 对比
      </button>

      <Show when={props.showCompare}>
        <select
          class="px-2 py-1 text-xs rounded bg-white/10 text-gray-300 border border-white/20"
          onChange={(e) => {
            const v = e.currentTarget.value;
            if (v) props.onAddComparedStock(v);
          }}
        >
          <option value="">添加对比...</option>
          <For
            each={MAJOR_INDICES.filter(
              (i) => !props.comparedStocks.some((s) => s.ts_code === i.ts_code)
            )}
          >
            {(idx) => <option value={idx.ts_code}>{idx.name}</option>}
          </For>
        </select>
      </Show>

      <div class="flex-1" />

      {/* Visible count */}
      <span class="text-xs text-gray-400 bg-black/40 px-2 py-1 rounded">
        {props.visibleCount} / {props.totalCount}
      </span>

      {/* Clear drawings */}
      <Show when={props.drawingsCount > 0}>
        <button
          class="px-2 py-1 text-xs rounded bg-red-900/60 text-red-300 hover:bg-red-900/80"
          onClick={props.onClearDrawings}
        >
          🗑 清空绘图
        </button>
      </Show>

      {/* Active tool indicator */}
      <Show when={props.activeTool}>
        <span class="text-xs px-2 py-1 rounded bg-blue-900/60 text-blue-300">
          绘图模式：{props.activeTool}
        </span>
      </Show>
    </div>
  );
};
