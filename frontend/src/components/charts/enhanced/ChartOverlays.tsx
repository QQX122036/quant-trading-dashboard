/**
 * ChartOverlays.tsx — 加载/错误/工具提示 覆盖层
 */
import { Component, Show } from 'solid-js';

export interface ChartOverlaysProps {
  loading: boolean;
  error: string | null;
  tooltipText: string | null;
}

export const ChartOverlays: Component<ChartOverlaysProps> = (props) => {
  return (
    <>
      <Show when={props.loading}>
        <div class="absolute inset-0 z-20 flex items-center justify-center bg-[#0A0E17]/80">
          <span class="text-gray-400 text-sm">加载中...</span>
        </div>
      </Show>
      <Show when={props.error}>
        <div class="absolute top-2 left-2 z-20 px-2 py-1 bg-red-900/80 rounded text-xs text-red-300">
          {props.error}
        </div>
      </Show>
      <Show when={props.tooltipText}>
        <div class="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 bg-blue-900/90 text-blue-200 rounded-lg text-xs">
          {props.tooltipText}
        </div>
      </Show>
    </>
  );
};
