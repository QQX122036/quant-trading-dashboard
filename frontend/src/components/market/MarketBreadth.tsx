import { Component, Show } from 'solid-js';
import type { MarketBreadthData } from '../../types/api';

interface MarketBreadthProps {
  data?: MarketBreadthData | null;
  loading?: boolean;
}

export const MarketBreadth: Component<MarketBreadthProps> = (props) => {
  const total = () => {
    if (!props.data) return 1;
    return Math.max(1, props.data.up_count + props.data.down_count + props.data.equal_count);
  };

  const upPercent = () => ((props.data?.up_count ?? 0) / total() * 100).toFixed(1);
  const downPercent = () => ((props.data?.down_count ?? 0) / total() * 100).toFixed(1);
  const equalPercent = () => ((props.data?.equal_count ?? 0) / total() * 100).toFixed(1);

  return (
    <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4">
      <h3 class="text-sm text-gray-400 mb-3">涨跌家数</h3>

      <Show when={props.loading}>
        <div class="animate-pulse space-y-2">
          <div class="h-8 bg-white/5 rounded" />
          <div class="h-4 bg-white/5 rounded w-3/4" />
        </div>
      </Show>

      <Show when={!props.loading && props.data}>
        {/* Visual bar */}
        <div class="flex items-center gap-4 mb-3">
          <div class="flex-1 h-8 rounded overflow-hidden flex">
            <div
              class="bg-[#EF4444] flex items-center justify-center text-xs font-bold text-white/80 min-w-[2rem]"
              style={{ width: `${upPercent()}%`, 'min-width': '2rem' }}
            >
              {Number(upPercent()) > 8 ? props.data?.up_count : ''}
            </div>
            <div
              class="bg-[#6B7280] flex items-center justify-center text-xs text-white/60"
              style={{ width: `${equalPercent()}%` }}
            />
            <div
              class="bg-[#22C55E] flex items-center justify-center text-xs font-bold text-white/80 min-w-[2rem]"
              style={{ width: `${downPercent()}%`, 'min-width': '2rem' }}
            >
              {Number(downPercent()) > 8 ? props.data?.down_count : ''}
            </div>
          </div>
        </div>

        <div class="flex justify-between text-sm">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded bg-[#EF4444]" />
            <span class="text-gray-400">上涨</span>
            <span class="font-bold text-[#EF4444]">{props.data?.up_count.toLocaleString() ?? 0}</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded bg-[#6B7280]" />
            <span class="text-gray-400">平</span>
            <span class="font-bold">{props.data?.equal_count.toLocaleString() ?? 0}</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded bg-[#22C55E]" />
            <span class="text-gray-400">下跌</span>
            <span class="font-bold text-[#22C55E]">{props.data?.down_count.toLocaleString() ?? 0}</span>
          </div>
        </div>

        <Show when={props.data?.date}>
          <div class="mt-2 pt-2 border-t border-white/5 text-xs text-gray-600">
            <span>数据日期: {props.data?.date}</span>
            <span class="mx-2">·</span>
            <span>实时更新</span>
          </div>
        </Show>
      </Show>

      <Show when={!props.loading && !props.data}>
        <div class="flex flex-col items-center justify-center gap-2 py-4 text-center">
          <div class="text-2xl opacity-30">📈</div>
          <div class="text-sm text-gray-400">暂无涨跌家数数据</div>
          <div class="text-xs text-gray-600">数据来源: A股市场 · 请检查数据采集状态</div>
        </div>
      </Show>
    </div>
  );
};
