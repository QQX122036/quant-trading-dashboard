import { Component, For, Show } from 'solid-js';
import type { SectorItem } from '../../types/api';

interface HotSectorsProps {
  sectors: SectorItem[];
  loading?: boolean;
}

export const HotSectors: Component<HotSectorsProps> = (props) => {
  const topGainers = () =>
    props.sectors
      .filter((s) => s.avg_change_pct > 0)
      .sort((a, b) => b.avg_change_pct - a.avg_change_pct)
      .slice(0, 5);

  const topLosers = () =>
    props.sectors
      .filter((s) => s.avg_change_pct < 0)
      .sort((a, b) => a.avg_change_pct - b.avg_change_pct)
      .slice(0, 5);

  const isHot = (upCount: number, total: number) => upCount / Math.max(1, total) > 0.7;

  return (
    <div class="w-96 bg-[#111827]/80 rounded-lg border border-white/10 p-4 flex flex-col">
      <h3 class="font-bold mb-4">行业板块</h3>

      <Show when={props.loading}>
        <div class="animate-pulse space-y-3">
          <For each={[1, 2, 3, 4, 5]}>
            {() => (
              <div class="h-6 bg-white/5 rounded" />
            )}
          </For>
        </div>
      </Show>

      <Show when={!props.loading && props.sectors.length === 0}>
        <div class="text-sm text-gray-500 py-8 text-center">暂无板块数据</div>
      </Show>

      <Show when={!props.loading && props.sectors.length > 0}>
        <div class="space-y-4 flex-1 overflow-auto">
          {/* Top Gainers */}
          <div>
            <div class="text-xs text-gray-400 mb-2">涨幅榜</div>
            <div class="space-y-1">
              <For each={topGainers()} fallback={<div class="text-xs text-gray-600 py-1">—</div>}>
                {(sector, index) => (
                  <div class="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-gray-500 w-4">{index() + 1}</span>
                      <span class="text-sm" title={`上涨{sector.up_count}家，下跌${sector.down_count}家`}>
                        {sector.sector_name || '未知板块'}
                      </span>
                      {isHot(sector.up_count, sector.stock_count) && (
                        <span class="text-xs bg-orange-500/20 text-orange-400 px-1 rounded">🔥</span>
                      )}
                    </div>
                    <span class="text-[#EF4444] text-sm font-bold">
                      +{sector.avg_change_pct.toFixed(2)}%
                    </span>
                  </div>
                )}
              </For>
            </div>
          </div>

          {/* Top Losers */}
          <div>
            <div class="text-xs text-gray-400 mb-2">跌幅榜</div>
            <div class="space-y-1">
              <For each={topLosers()} fallback={<div class="text-xs text-gray-600 py-1">—</div>}>
                {(sector, index) => (
                  <div class="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-gray-500 w-4">{index() + 1}</span>
                      <span class="text-sm" title={`上涨${sector.up_count}家，下跌${sector.down_count}家`}>
                        {sector.sector_name || '未知板块'}
                      </span>
                    </div>
                    <span class="text-[#22C55E] text-sm font-bold">
                      {sector.avg_change_pct.toFixed(2)}%
                    </span>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};
