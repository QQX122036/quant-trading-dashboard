import { For, Component, createMemo, onMount } from 'solid-js';
import { state } from '../../stores';
import { fetchTrades } from '../../hooks/useApi';
import { formatPrice, formatTime } from '../../utils/format';
import { directionBg } from '../../utils/color';

const COLUMNS: { field: string; header: string; width?: number; align?: string }[] = [
  { field: 'vt_tradeid',  header: '成交号',   width: 150 },
  { field: 'vt_orderid', header: '委托号',   width: 150 },
  { field: 'symbol',     header: '代码',     width: 80 },
  { field: 'exchange',   header: '交易所',   width: 60 },
  { field: 'direction',  header: '方向',     width: 50,  align: 'center' },
  { field: 'offset',     header: '开平',     width: 50,  align: 'center' },
  { field: 'price',      header: '价格',     width: 90,  align: 'right' },
  { field: 'volume',     header: '数量',     width: 65,  align: 'right' },
  { field: 'datetime',   header: '时间',     width: 110 },
];

export const TradeMonitor: Component = () => {
  const trades = createMemo(() => state.trades.items);

  onMount(async () => {
    try {
      const res = await fetchTrades();
      if (res.code === '0' && res.data?.trades) {
        // Prepend historical trades (newest first)
        const existing = state.trades.items;
        const merged = [...res.data.trades, ...existing].slice(0, state.trades.maxItems);
        state.trades.items = merged;
      }
    } catch (e) {
      console.warn('[TradeMonitor] fetchTrades error', e);
    }
  });

  return (
    <div class="h-full flex flex-col overflow-hidden">
      <div class="flex-1 overflow-auto">
        <table class="w-full border-collapse text-xs">
          <thead class="sticky top-0 z-10 bg-[var(--bg-tertiary)]">
            <tr>
              <For each={COLUMNS}>
                {(col) => (
                  <th
                    class="px-1.5 py-2 text-[var(--text-muted)] font-normal border-b border-[var(--border-color)] whitespace-nowrap"
                    style={{ width: col.width ? `${col.width}px` : undefined, 'text-align': (col.align ?? 'left') as any }}
                  >
                    {col.header}
                  </th>
                )}
              </For>
            </tr>
          </thead>
          <tbody>
            <For each={trades()} fallback={
              <tr>
                <td colspan={COLUMNS.length} class="text-center py-8 text-[var(--text-muted)]">
                  暂无成交记录
                </td>
              </tr>
            }>
              {(trade) => (
                <tr class="border-b border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition-colors">
                  <For each={COLUMNS}>
                    {(col) => {
                      const val = (trade as unknown as Record<string, unknown>)[col.field];
                      const ta = { left: 'text-left', right: 'text-right', center: 'text-center' }[col.align ?? 'left'] as string;
                      if (col.field === 'direction') {
                        return (
                          <td class="px-1.5 py-1 text-center">
                            <span class={`inline-block px-1 py-0.5 rounded text-[10px] font-bold ${directionBg(val as string)}`}>
                              {val as string}
                            </span>
                          </td>
                        );
                      }
                      if (col.field === 'price') {
                        return <td class={`px-1.5 py-1 text-xs font-mono tabular-nums ${ta} text-[var(--text-primary)]`}>{formatPrice(val as number)}</td>;
                      }
                      if (col.field === 'datetime') {
                        return <td class={`px-1.5 py-1 text-xs font-mono ${ta} text-[var(--text-muted)]`}>{formatTime(val as string)}</td>;
                      }
                      return <td class={`px-1.5 py-1 text-xs ${ta} text-[var(--text-secondary)]`}>{String(val ?? '-')}</td>;
                    }}
                  </For>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </div>
  );
};
