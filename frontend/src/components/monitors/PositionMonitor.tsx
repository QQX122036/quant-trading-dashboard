import { Component, For, createMemo, onMount } from 'solid-js';
import { state } from '../../stores';
import { useMarketWS } from '../../hooks/useWebSocket';
import { fetchPositions } from '../../hooks/useApi';
import { formatPrice } from '../../utils/format';
import { directionBg, pnlColor } from '../../utils/color';

const COLUMNS = [
  { field: 'symbol',        header: '合约',     width: 90 },
  { field: 'exchange',      header: '交易所',   width: 60 },
  { field: 'direction',     header: '方向',     width: 55, align: 'center' },
  { field: 'volume',        header: '数量',     width: 65, align: 'right' },
  { field: 'yd_position',   header: '昨仓',     width: 55, align: 'right' },
  { field: 'frozen',        header: '冻结',     width: 55, align: 'right' },
  { field: 'price',         header: '均价',     width: 90, align: 'right' },
  { field: 'pnl',           header: '盈亏',     width: 90, align: 'right' },
];

export const PositionMonitor: Component = () => {
  // Initialize WebSocket (registers handlers for position updates)
  useMarketWS();

  const positions = createMemo(() =>
    Object.values(state.positions.items)
  );

  const totalPnl = createMemo(() =>
    positions().reduce((sum, p) => sum + (p.pnl || 0), 0)
  );

  onMount(async () => {
    try {
      const res = await fetchPositions();
      if (res.code === '0' && res.data?.positions) {
        for (const pos of res.data.positions) {
          state.positions.items[pos.vt_positionid] = pos;
        }
      }
    } catch (e) {
      console.warn('[PositionMonitor] fetchPositions error', e);
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
            <For each={positions()} fallback={
              <tr>
                <td colspan={COLUMNS.length} class="text-center py-8 text-[var(--text-muted)]">
                  暂无持仓
                </td>
              </tr>
            }>
              {(pos) => (
                <tr class="border-b border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition-colors">
                  <For each={COLUMNS}>
                    {(col) => {
                      const val = (pos as unknown as Record<string, unknown>)[col.field];
                      const ta = { left: 'text-left', right: 'text-right', center: 'text-center' }[col.align ?? 'left'] as string;

                      if (col.field === 'direction') {
                        return (
                          <td class="px-1.5 py-1.5 text-center">
                            <span class={`inline-block px-1 py-0.5 rounded text-[10px] font-bold ${directionBg(val as string)}`}>
                              {val as string}
                            </span>
                          </td>
                        );
                      }
                      if (col.field === 'price') {
                        return <td class={`px-1.5 py-1.5 text-xs font-mono tabular-nums ${ta} text-[var(--text-primary)]`}>{formatPrice(val as number)}</td>;
                      }
                      if (col.field === 'pnl') {
                        const pnl = val as number;
                        return <td class={`px-1.5 py-1.5 text-xs font-mono tabular-nums ${ta} ${pnlColor(pnl)}`}>{pnl >= 0 ? '+' : ''}{formatPrice(pnl)}</td>;
                      }
                      return <td class={`px-1.5 py-1.5 text-xs ${ta} text-[var(--text-secondary)]`}>{String(val ?? '-')}</td>;
                    }}
                  </For>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
      {/* Footer summary */}
      <div class="flex items-center justify-end gap-4 px-3 py-1.5 border-t border-[var(--border-color)] text-xs">
        <span class="text-[var(--text-muted)]">总盈亏:</span>
        <span class={`text-sm font-bold tabular-nums ${pnlColor(totalPnl())}`}>
          {totalPnl() >= 0 ? '+' : ''}{formatPrice(totalPnl())}
        </span>
      </div>
    </div>
  );
};
