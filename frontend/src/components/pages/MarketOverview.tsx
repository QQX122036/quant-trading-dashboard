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
    <div class="min-h-screen w-full bg-[#0A0E17] p-4" role="main" aria-label="市场总览页面">
      {/* Debug: 页面已渲染 - 使用大字体和明显背景 */}
      <div class="text-white text-lg mb-4 p-4 bg-green-900/40 border-2 border-green-500 rounded font-bold">
        ✅ MarketOverview 页面已成功加载！
        <div class="text-sm font-normal mt-2">
          时间：{new Date().toLocaleString('zh-CN')}
          <br />
          indices: {marketState.indices.length} | sectors: {marketState.sectors.length} | hotStocks:{' '}
          {marketState.hotStocks.length}
        </div>
      </div>

      {/* Top Section: Indices + Breadth + Sentiment */}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Index Cards */}
        <div class="col-span-2 grid grid-cols-2 gap-4">
          {/* Skeleton: show when loading OR when no real data (indices show default 0 prices) */}
          <Show
            when={
              marketState.loading || marketState.indices.every((i) => i.price === 0 && !i.loading)
            }
          >
            <div class="col-span-2 grid grid-cols-2 gap-4">
              <For
                each={
                  marketState.indices.length > 0
                    ? marketState.indices
                    : [
                        { ts_code: '000001.SH', displayName: '上证指数' },
                        { ts_code: '399001.SZ', displayName: '深证成指' },
                        { ts_code: '399006.SZ', displayName: '创业板指' },
                        { ts_code: '000016.SH', displayName: '上证50' },
                      ]
                }
              >
                {(index) => (
                  <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4 animate-pulse">
                    <div class="h-4 bg-white/5 rounded w-1/2 mb-3" />
                    <div class="text-sm text-gray-400 mb-3">{index.displayName}</div>
                    <div class="h-8 bg-white/5 rounded w-3/4 mb-2" />
                    <div class="h-4 bg-white/5 rounded w-1/2" />
                  </div>
                )}
              </For>
            </div>
          </Show>
          <Show
            when={marketState.indices.length > 0 && marketState.indices.some((i) => i.price > 0)}
          >
            <For each={marketState.indices}>{(index) => <IndexCard {...index} />}</For>
          </Show>
        </div>

        {/* Right side: Breadth + Sentiment */}
        <div class="col-span-1 sm:col-span-2 flex flex-col gap-4">
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
      <div class="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        {/* Sector Performance */}
        <HotSectors
          sectors={marketState.sectors}
          loading={marketState.loading && marketState.sectors.length === 0}
        />

        {/* Hot Stocks */}
        <div class="flex-1 bg-[#111827]/80 rounded-lg border border-white/10 p-4 flex flex-col">
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-bold text-base">今日强势股</h2>
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
            <div class="flex-1 overflow-auto" role="region" aria-label="热门股票列表">
              <table class="w-full text-sm" role="table" aria-label="今日强势股">
                <thead>
                  <tr class="text-gray-500 text-xs border-b border-white/5" role="row">
                    <th class="text-left py-2 font-normal" role="columnheader">
                      代码
                    </th>
                    <th class="text-left py-2 font-normal" role="columnheader">
                      名称
                    </th>
                    <th class="text-right py-2 font-normal" role="columnheader">
                      最新价
                    </th>
                    <th class="text-right py-2 font-normal" role="columnheader">
                      涨跌幅
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <For each={sortedHotStocks()}>
                    {(stock) => (
                      <tr
                        class="border-b border-white/5 hover:bg-white/5 transition-colors"
                        role="row"
                      >
                        <td class="py-2 font-mono text-xs text-gray-400" role="cell">
                          {stock.ts_code.split('.')[0]}
                        </td>
                        <td class="py-2 text-sm" role="cell">
                          {stock.name}
                        </td>
                        <td class="py-2 text-right tabular-nums font-medium" role="cell">
                          {stock.close > 0 ? stock.close.toFixed(2) : '—'}
                        </td>
                        <td
                          class={`py-2 text-right tabular-nums font-bold ${
                            stock.change_pct >= 0 ? 'text-[#EF4444]' : 'text-[#22C55E]'
                          }`}
                          role="cell"
                          aria-label={`涨跌幅${stock.change_pct >= 0 ? '+' : ''}${stock.change_pct.toFixed(2)}%`}
                        >
                          {stock.change_pct >= 0 ? '+' : ''}
                          {stock.change_pct.toFixed(2)}%
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
