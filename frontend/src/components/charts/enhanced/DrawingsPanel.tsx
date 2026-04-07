/**
 * DrawingsPanel.tsx — 绘图列表面板
 */
import { Component, Show, For } from 'solid-js';
import type { Drawing, AlertLine } from './DrawingTools';

export interface DrawingsPanelProps {
  drawings: Drawing[];
  onDelete: (id: string) => void;
}

export const DrawingsPanel: Component<DrawingsPanelProps> = (props) => {
  return (
    <Show when={props.drawings.length > 0}>
      <div class="absolute right-2 bottom-2 z-20 max-h-48 overflow-auto bg-black/80 rounded border border-white/10 p-2 text-xs">
        <div class="text-gray-400 mb-1">绘图 ({props.drawings.length})</div>
        <For each={props.drawings}>
          {(d) => (
            <div class="flex items-center gap-2 py-0.5">
              <span class="w-2 h-2 rounded-full" style={{ background: d.color }} />
              <span class="text-gray-300 capitalize">{d.type}</span>
              <Show when={d.type === 'alertline'}>
                <span class="text-gray-400">¥{(d as AlertLine).price.toFixed(2)}</span>
              </Show>
              <button class="text-red-400 hover:text-red-300 ml-1" onClick={() => props.onDelete(d.id)}>✕</button>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
};
