/**
 * RangeStatsPanel.tsx — 区间统计面板
 * 职责：显示框选的K线区间统计数据
 */
import { Component, Show } from 'solid-js';
import type { RangeStats } from './chartUtils';

export interface RangeStatsPanelProps {
  stats: RangeStats | null;
  onClear: () => void;
}

export const RangeStatsPanel: Component<RangeStatsPanelProps> = (props) => {
  return (
    <Show when={props.stats}>
      {(stats) => (
        <div class="border-t border-white/10 bg-[#111827]/90 px-4 py-2 flex items-center gap-6 text-xs">
          <span class="text-gray-400">区间涨跌</span>
          <span class={stats().change >= 0 ? 'text-red-400' : 'text-green-400'}>
            {stats().change >= 0 ? '+' : ''}{stats().change.toFixed(2)} ({stats().changePct.toFixed(2)}%)
          </span>
          <span class="text-gray-400">成交量</span>
          <span class="text-white">{(stats().volume / 1e8).toFixed(2)}亿</span>
          <span class="text-gray-400">均量</span>
          <span class="text-white">{(stats().avgVolume / 1e8).toFixed(2)}亿</span>
          <span class="text-gray-400">振幅</span>
          <span class="text-white">{stats().amplitude.toFixed(2)}%</span>
          <Show when={stats().indexChangePct !== undefined}>
            <span class="text-gray-400">大盘同期</span>
            <span class={stats().indexChangePct! >= 0 ? 'text-red-400' : 'text-green-400'}>
              {stats().indexChangePct! >= 0 ? '+' : ''}{stats().indexChangePct!.toFixed(2)}%
            </span>
            <span class="text-gray-400">超额</span>
            <span class={(stats().changePct - stats().indexChangePct!) >= 0 ? 'text-green-400' : 'text-red-400'}>
              {(stats().changePct - stats().indexChangePct!).toFixed(2)}%
            </span>
          </Show>
          <button class="ml-auto px-2 py-0.5 text-xs rounded bg-white/10 text-gray-300 hover:bg-white/20" onClick={props.onClear}>
            ✕ 清除区间
          </button>
        </div>
      )}
    </Show>
  );
};
