import { Component, For, Show, onMount, onCleanup } from 'solid-js';
import { IndexCard } from '../market/IndexCard';
import { MarketBreadth } from '../market/MarketBreadth';
import { HotSectors } from '../market/HotSectors';
import { MarketSentiment } from '../market/MarketSentiment';
import { marketState, marketActions } from '../../stores/marketStore';

export const MarketOverview: Component = () => {
  let refreshInterval: ReturnType<typeof setInterval> | undefined;

  onMount(async () => {
    // Initial load
    await marketActions.loadAll();

    // Auto-refresh every 60 seconds
    refreshInterval = setInterval(() => {
      marketActions.refresh();
    }, 60_000);
  });

  onCleanup(() => {
    if (refreshInterval) clearInterval(refreshInterval);
  });

  // Hot stocks sorted by change_pct
  const sortedHotStocks = () =>
    [...marketState.hotStocks].sort((a, b) => b.change_pct - a.change_pct).slice(0, 10);

  return (
    <div class="h-full flex flex-col p-4 gap-4 overflow-auto">
      {/* Loading overlay */}
      <Show when={marketState.loading}>
        <div class="absolute inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-none">
          <div class="flex flex-col items-center gap-3">
            <div class="w-10 h-10 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span class="text-sm text-gray-400">加载市场数据...</span>
          </div>
        </div>
      </Show>

      {/* Top Section: Indices + Breadth + Sentiment */}
      <div class="grid grid-cols-4 gap-4">
        {/* Index Cards */}
        <div class="col-span-2 grid grid-cols-2 gap-4">
          <Show when={marketState.indices.length === 0 && marketState.loading}>
            <div class="col-span-2 grid grid-cols-2 gap-4">
              <For each={[1, 2, 3, 4]}>
                {() => (
                  <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4 animate-pulse">
                    <div class="h-4 bg-white/5 rounded w-1/2 mb-3" />
                    <div class="h-8 bg-white/5 rounded w-3/4 mb-2" />
                    <div class="h-4 bg-white/5 rounded w-1/2" />
                  </div>
                )}
              </For>
            </div>
          </Show>
          <Show when={marketState.indices.length > 0}>
            <For each={marketState.indices}>
              {(index) => <IndexCard {...index} />}
            </For>
          </Show>
        </div>

        {/* Right side: Breadth + Sentiment */}
        <div class="col-span-2 flex flex-col gap-4">
          <MarketBreadth
            data={marketState.marketBreadth}
            loading={marketState.loading && !marketState.marketBreadth}
          />
          <MarketSentiment
            sentiment={marketState.sentiment}
            upRatio={marketState.marketBreadth?.up_ratio}
          />
        </div>
      </div>

      {/* Middle Section: Sectors + Hot Stocks */}
      <div class="flex gap-4 flex-1 min-h-0">
        {/* Sector Performance */}
        <HotSectors sectors={marketState.sectors} loading={marketState.loading && marketState.sectors.length === 0} />

        {/* Hot Stocks */}
        <div class="flex-1 bg-[#111827]/80 rounded-lg border border-white/10 p-4 flex flex-col">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-bold">今日强势股</h3>
            <Show when={marketState.lastUpdate}>
              <span class="text-xs text-gray-600">更新: {marketState.lastUpdate}</span>
            </Show>
          </div>

          <Show when={sortedHotStocks().length === 0 && !marketState.loading}>
            <div class="flex-1 flex flex-col items-center justify-center gap-3 bg-white/5 rounded-lg border border-dashed border-white/10 py-12">
              <div class="text-3xl opacity-30">📊</div>
              <div class="text-sm text-gray-400">暂无热门股票</div>
              <div class="text-xs text-gray-600">请检查数据采集状态</div>
            </div>
          </Show>

          <Show when={sortedHotStocks().length > 0}>
            <div class="flex-1 overflow-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-gray-500 text-xs border-b border-white/5">
                    <th class="text-left py-2 font-normal">代码</th>
                    <th class="text-left py-2 font-normal">名称</th>
                    <th class="text-right py-2 font-normal">最新价</th>
                    <th class="text-right py-2 font-normal">涨跌幅</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={sortedHotStocks()}>
                    {(stock) => (
                      <tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td class="py-2 font-mono text-xs text-gray-400">{stock.ts_code.split('.')[0]}</td>
                        <td class="py-2 text-sm">{stock.name}</td>
                        <td class="py-2 text-right tabular-nums font-medium">
                          {stock.close > 0 ? stock.close.toFixed(2) : '—'}
                        </td>
                        <td class={`py-2 text-right tabular-nums font-bold ${
                          stock.change_pct >= 0 ? 'text-[#EF4444]' : 'text-[#22C55E]'
                        }`}>
                          {stock.change_pct >= 0 ? '+' : ''}{stock.change_pct.toFixed(2)}%
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
};
