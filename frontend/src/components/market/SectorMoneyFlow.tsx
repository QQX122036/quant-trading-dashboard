/**
 * SectorMoneyFlow.tsx — 板块资金流向
 * 表格：行业/净流入/涨跌幅/成交额
 * 排序：按净流入降序，点击展开详情
 */
import { Component, createSignal, onMount, onCleanup, For, Show } from 'solid-js';
import { apiFetch } from '../../hooks/useApi';

interface SectorFlowItem {
  sector_name: string;
  net_inflow: number;     // 净流入（亿元）
  inflow_rate: number;    // 流入比率%
  change_pct?: number;    // 涨跌幅%（可选）
  amount?: number;        // 成交额（亿元）（可选）
  up_count: number;
  down_count: number;
  leading_stocks?: Array<{ ts_code: string; name: string; net_inflow: number; change_pct: number }>;
}

interface SectorMoneyFlowProps {
  embedded?: boolean;
}

export const SectorMoneyFlow: Component<SectorMoneyFlowProps> = (props) => {
  const [data, setData] = createSignal<SectorFlowItem[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [expandedSector, setExpandedSector] = createSignal<string | null>(null);
  let refreshTimer: ReturnType<typeof setInterval>;

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch<{ items: SectorFlowItem[] }>('/api/data/sector-money-flow');
      if (res.data?.items) {
        // 按净流入降序
        const sorted = [...res.data.items].sort((a, b) => b.net_inflow - a.net_inflow);
        setData(sorted);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    fetchData();
    refreshTimer = setInterval(fetchData, 60 * 1000);
  });

  onCleanup(() => {
    clearInterval(refreshTimer);
  });

  const toggleExpand = (name: string) => {
    setExpandedSector((prev) => (prev === name ? null : name));
  };

  const formatNet = (v: number) => {
    const sign = v >= 0 ? '+' : '';
    return `${sign}${(v ?? 0).toFixed(2)}亿`;
  };

  const netColor = (v: number) => (v >= 0 ? 'text-[#EF4444]' : 'text-[#22C55E]');

  const changeColor = (v: number) => {
    if (v > 0) return 'text-[#EF4444]';
    if (v < 0) return 'text-[#22C55E]';
    return 'text-gray-400';
  };

  return (
    <div class={`bg-[#111827]/80 rounded-lg border border-white/10 ${props.embedded ? '' : 'p-4'}`}>
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-bold text-sm">板块资金流向</h3>
        <div class="flex items-center gap-2">
          {loading() && <span class="text-xs text-gray-500 animate-pulse">刷新中…</span>}
          <Show when={!loading()}>
            <span class="text-xs text-gray-600">{data().length} 个行业</span>
          </Show>
        </div>
      </div>

      {error() && (
        <div class="text-xs text-red-400 mb-2">{error()}</div>
      )}

      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="text-gray-500 border-b border-white/10">
              <th class="text-left py-2 pr-4 font-medium">行业</th>
              <th class="text-right py-2 px-3 font-medium">净流入</th>
              <th class="text-right py-2 px-3 font-medium">涨跌幅</th>
              <th class="text-right py-2 px-3 font-medium">成交额</th>
            </tr>
          </thead>
          <tbody>
            <Show
              when={!loading() && data().length > 0}
              fallback={
                <Show
                  when={loading()}
                  fallback={
                    <tr>
                      <td colspan="4" class="text-center text-gray-600 py-6">暂无数据</td>
                    </tr>
                  }
                >
                  <For each={[1, 2, 3, 4, 5]}>
                    {() => (
                      <tr class="border-b border-white/5">
                        <td class="py-2 pr-4"><div class="h-4 w-24 bg-white/5 rounded animate-pulse" /></td>
                        <td class="py-2 px-3"><div class="h-4 w-16 bg-white/5 rounded animate-pulse ml-auto" /></td>
                        <td class="py-2 px-3"><div class="h-4 w-12 bg-white/5 rounded animate-pulse ml-auto" /></td>
                        <td class="py-2 px-3"><div class="h-4 w-16 bg-white/5 rounded animate-pulse ml-auto" /></td>
                      </tr>
                    )}
                  </For>
                </Show>
              }
            >
              <For each={data()}>
                {(sector) => (
                  <>
                    <tr
                      class="border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors"
                      onClick={() => toggleExpand(sector.sector_name)}
                    >
                      <td class="py-2.5 pr-4">
                        <div class="flex items-center gap-2">
                          <span class="text-gray-400">{expandedSector() === sector.sector_name ? '▼' : '▶'}</span>
                          <span class="text-gray-200 font-medium">{sector.sector_name}</span>
                        </div>
                      </td>
                      <td class={`py-2.5 px-3 text-right font-mono font-medium ${netColor(sector.net_inflow)}`}>
                        {formatNet(sector.net_inflow)}
                      </td>
                      <td class={`py-2.5 px-3 text-right font-mono ${changeColor(sector.change_pct ?? 0)}`}>
                        {sector.change_pct != null ? ((sector.change_pct >= 0 ? '+' : '') + sector.change_pct.toFixed(2) + '%') : '—'}
                      </td>
                      <td class="py-2.5 px-3 text-right text-gray-400 font-mono">
                        {sector.amount != null ? sector.amount.toFixed(0) + '亿' : '—'}
                      </td>
                    </tr>
                    {/* 展开详情 */}
                    <Show when={expandedSector() === sector.sector_name}>
                      <tr class="bg-[#1f2937]/60">
                        <td colspan="4" class="px-6 py-3">
                          <div class="text-xs text-gray-500 mb-2">
                            上涨 <span class="text-[#EF4444]">{sector.up_count}</span> 家 /
                            下跌 <span class="text-[#22C55E]">{sector.down_count}</span> 家
                          </div>
                          <Show when={sector.leading_stocks && sector.leading_stocks.length > 0}>
                            <div class="space-y-1">
                              <div class="text-xs text-gray-600 grid grid-cols-4 gap-2 px-2">
                                <span>股票</span>
                                <span class="text-right">净流入</span>
                                <span class="text-right">涨跌幅</span>
                                <span class="text-right">细分项</span>
                              </div>
                              <For each={sector.leading_stocks}>
                                {(stock) => (
                                  <div class="text-xs grid grid-cols-4 gap-2 px-2 py-1 hover:bg-white/5 rounded">
                                    <span class="text-gray-300">{stock.name}</span>
                                    <span class={`text-right font-mono ${netColor(stock.net_inflow)}`}>
                                      {formatNet(stock.net_inflow)}
                                    </span>
                                    <span class={`text-right font-mono ${changeColor(stock.change_pct)}`}>
                                      {(stock.change_pct ?? 0) >= 0 ? '+' : ''}{(stock.change_pct ?? 0).toFixed(2)}%
                                    </span>
                                    <span class="text-right text-gray-600">—</span>
                                  </div>
                                )}
                              </For>
                            </div>
                          </Show>
                          <Show when={!sector.leading_stocks || sector.leading_stocks.length === 0}>
                            <div class="text-xs text-gray-600 italic">暂无龙头股数据</div>
                          </Show>
                        </td>
                      </tr>
                    </Show>
                  </>
                )}
              </For>
            </Show>
          </tbody>
        </table>
      </div>
    </div>
  );
};
