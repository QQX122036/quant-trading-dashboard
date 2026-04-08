/**
 * TickMonitor.tsx — 实时行情监控
 * 使用 TanStack Table 展示实时Tick，支持 WebSocket 推送、排序、分页
 */
import { Component, createSignal, createEffect, createMemo, onCleanup, For, Show } from 'solid-js';
import {
  createSolidTable,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
} from '@tanstack/solid-table';
import { getWsInstance } from '../../hooks/useWebSocket';
import type { WsMessage } from '../../types/ws';
import { formatPrice } from '../../utils/format';

interface TickBarData {
  ts_code: string;
  tradedate?: string;
  tradetime?: string;
  price: number;
  volume: number;
  bid_price_1: number;
  bid_price_2: number;
  bid_price_3: number;
  bid_price_4: number;
  bid_price_5: number;
  ask_price_1: number;
  ask_price_2: number;
  ask_price_3: number;
  ask_price_4: number;
  ask_price_5: number;
  bid_volume_1: number;
  bid_volume_2: number;
  bid_volume_3: number;
  bid_volume_4: number;
  bid_volume_5: number;
  ask_volume_1: number;
  ask_volume_2: number;
  ask_volume_3: number;
  ask_volume_4: number;
  ask_volume_5: number;
}

interface DisplayTick {
  ts_code: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  bid1: number;
  ask1: number;
  bidVol1: number;
  askVol1: number;
  volume: number;
}

const NAME_MAP: Record<string, string> = {
  '600519.SH': '贵州茅台',
  '000001.SZ': '平安银行',
  '600036.SH': '招商银行',
  '601318.SH': '中国平安',
  '000002.SZ': '万科A',
};

function getName(ts_code: string): string {
  return NAME_MAP[ts_code] || ts_code.split('.')[0];
}

export const TickMonitor: Component = () => {
  const [ticks, setTicks] = createSignal<DisplayTick[]>([]);
  const [selected, setSelected] = createSignal<string | null>(null);
  const [lastTick, setLastTick] = createSignal<TickBarData | null>(null);

  const ws = getWsInstance();

  const tickHandler = (msg: WsMessage) => {
    if (msg.type === 'tick_bar' && msg.data) {
      const tick = msg.data as TickBarData;
      const prev = lastTick();
      const change = prev ? tick.price - prev.price : 0;
      const changePercent = prev && prev.price > 0 ? (change / prev.price) * 100 : 0;
      setLastTick(tick);

      setTicks((prev) => {
        const idx = prev.findIndex((t) => t.ts_code === tick.ts_code);
        const displayTick: DisplayTick = {
          ts_code: tick.ts_code,
          name: getName(tick.ts_code),
          price: tick.price,
          change,
          changePercent,
          bid1: tick.bid_price_1,
          ask1: tick.ask_price_1,
          bidVol1: tick.bid_volume_1,
          askVol1: tick.ask_volume_1,
          volume: tick.volume,
        };
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = displayTick;
          return updated;
        }
        return [...prev, displayTick];
      });
    }
  };

  createEffect(() => {
    if (ws.status() === 'disconnected') ws.connect();
    ws.addHandler('tick_bar', tickHandler);
  });

  onCleanup(() => ws.removeHandler('tick_bar', tickHandler));

  const h = createColumnHelper<DisplayTick>();

  const table = createSolidTable({
    get data() {
      return ticks();
    },
    columns: [
      h.accessor('ts_code', {
        header: '代码',
        size: 80,
        cell: (info) => (
          <span class="text-xs font-mono text-[var(--text-primary)]">{info.getValue()}</span>
        ),
      }),
      h.accessor('name', {
        header: '名称',
        size: 90,
        cell: (info) => <span class="text-xs text-[var(--text-secondary)]">{info.getValue()}</span>,
      }),
      h.accessor('price', {
        header: '最新价',
        size: 80,
        meta: { align: 'right' },
        cell: (info) => {
          const val = info.getValue();
          return (
            <span class="text-xs font-mono tabular-nums text-[var(--text-primary)]">
              {val > 0 ? formatPrice(val) : '—'}
            </span>
          );
        },
      }),
      h.accessor('change', {
        header: '涨跌额',
        size: 80,
        meta: { align: 'right' },
        cell: (info) => {
          const val = info.getValue();
          return (
            <span
              class={`text-xs font-mono tabular-nums ${val >= 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}`}
            >
              {val !== 0 ? `${val >= 0 ? '+' : ''}${val.toFixed(2)}` : '—'}
            </span>
          );
        },
      }),
      h.accessor('changePercent', {
        header: '涨跌幅',
        size: 90,
        meta: { align: 'right' },
        cell: (info) => {
          const val = info.getValue();
          return (
            <span
              class={`text-xs font-mono tabular-nums ${val >= 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}`}
            >
              {val !== 0 ? `${val >= 0 ? '↑' : '↓'} ${Math.abs(val).toFixed(2)}%` : '—'}
            </span>
          );
        },
      }),
      h.accessor('bid1', {
        header: '买一价',
        size: 80,
        meta: { align: 'right' },
        cell: (info) => {
          const val = info.getValue();
          return (
            <span class="text-xs font-mono tabular-nums text-[var(--color-down)]">
              {val > 0 ? formatPrice(val) : '—'}
            </span>
          );
        },
      }),
      h.accessor('ask1', {
        header: '卖一价',
        size: 80,
        meta: { align: 'right' },
        cell: (info) => {
          const val = info.getValue();
          return (
            <span class="text-xs font-mono tabular-nums text-[var(--color-up)]">
              {val > 0 ? formatPrice(val) : '—'}
            </span>
          );
        },
      }),
      h.accessor('volume', {
        header: '成交量',
        size: 100,
        meta: { align: 'right' },
        cell: (info) => {
          const val = info.getValue();
          return (
            <span class="text-xs font-mono tabular-nums text-[var(--text-secondary)]">
              {val > 0 ? val.toLocaleString() : '—'}
            </span>
          );
        },
      }),
    ],
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  function handleRowClick(ts_code: string) {
    setSelected((prev) => (prev === ts_code ? null : ts_code));
  }

  const selectedTick = createMemo(() => {
    const sel = selected();
    return sel ? (ticks().find((t) => t.ts_code === sel) ?? null) : null;
  });

  return (
    <div class="flex flex-col h-full">
      <div class="flex-1 overflow-auto min-h-0">
        <table class="w-full border-collapse text-xs">
          <thead class="sticky top-0 z-10 bg-[var(--bg-tertiary)]">
            <tr>
              <For each={table.getHeaderGroups()[0]?.headers ?? []}>
                {(header) => (
                  <th
                    class="px-1.5 py-2 text-[var(--text-muted)] font-normal border-b border-[var(--border-color)] whitespace-nowrap cursor-pointer select-none hover:text-[var(--text-secondary)]"
                    style={{
                      width: `${header.column.getSize()}px`,
                      'text-align': ((header.column.columnDef.meta as { align?: string })?.align ??
                        'left') as any,
                    }}
                    onClick={() => header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                )}
              </For>
            </tr>
          </thead>
          <tbody>
            <Show
              when={ticks().length > 0}
              fallback={
                <tr>
                  <td colspan={8} class="text-center py-12 text-[var(--text-muted)]">
                    暂无行情数据
                  </td>
                </tr>
              }
            >
              <For each={table.getRowModel().rows}>
                {(row) => (
                  <tr
                    class={`border-b border-[var(--border-color)]/50 cursor-pointer transition-colors ${selected() === row.original.ts_code ? 'bg-[var(--bg-selected)]' : 'hover:bg-[var(--bg-hover)]'}`}
                    onClick={() => handleRowClick(row.original.ts_code)}
                  >
                    <For each={row.getVisibleCells()}>
                      {(cell) => (
                        <td
                          class="px-1.5 py-1.5"
                          style={{
                            width: `${cell.column.getSize()}px`,
                            'text-align': ((cell.column.columnDef.meta as { align?: string })
                              ?.align ?? 'left') as any,
                          }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      )}
                    </For>
                  </tr>
                )}
              </For>
            </Show>
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      <Show when={ticks().length > 0}>
        <div class="flex items-center justify-between px-3 py-1 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] text-xs">
          <span class="text-[var(--text-muted)]">{ticks().length} 只股票</span>
          <div class="flex items-center gap-2">
            <button
              class="px-2 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] disabled:opacity-40"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              ‹
            </button>
            <span class="text-[var(--text-muted)]">
              {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
            </span>
            <button
              class="px-2 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] disabled:opacity-40"
              disabled={!table.getCanNextPage()}
              onClick={() => table.getCanNextPage() && table.nextPage()}
            >
              ›
            </button>
          </div>
        </div>
      </Show>

      {/* 底部详情面板 */}
      <Show when={selectedTick()}>
        <div class="flex-shrink-0 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] p-3 text-xs">
          <div class="font-semibold text-[var(--text-primary)] mb-2">
            详细行情 — {selectedTick()!.name} ({selectedTick()!.ts_code})
          </div>
          <div class="grid grid-cols-5 gap-x-4 gap-y-1 text-[var(--text-muted)]">
            <div>
              买一: <span class="text-[var(--color-down)]">{selectedTick()!.bid1.toFixed(2)}</span>{' '}
              × {selectedTick()!.bidVol1}
            </div>
            <div>
              买二:{' '}
              <span class="text-[var(--color-down)]">
                {(lastTick()?.bid_price_2 || 0).toFixed(2)}
              </span>{' '}
              × {lastTick()?.bid_volume_2 || 0}
            </div>
            <div>
              买三:{' '}
              <span class="text-[var(--color-down)]">
                {(lastTick()?.bid_price_3 || 0).toFixed(2)}
              </span>{' '}
              × {lastTick()?.bid_volume_3 || 0}
            </div>
            <div>
              买四:{' '}
              <span class="text-[var(--color-down)]">
                {(lastTick()?.bid_price_4 || 0).toFixed(2)}
              </span>{' '}
              × {lastTick()?.bid_volume_4 || 0}
            </div>
            <div>
              买五:{' '}
              <span class="text-[var(--color-down)]">
                {(lastTick()?.bid_price_5 || 0).toFixed(2)}
              </span>{' '}
              × {lastTick()?.bid_volume_5 || 0}
            </div>
            <div>
              卖一: <span class="text-[var(--color-up)]">{selectedTick()!.ask1.toFixed(2)}</span> ×{' '}
              {selectedTick()!.askVol1}
            </div>
            <div>
              卖二:{' '}
              <span class="text-[var(--color-up)]">
                {(lastTick()?.ask_price_2 || 0).toFixed(2)}
              </span>{' '}
              × {lastTick()?.ask_volume_2 || 0}
            </div>
            <div>
              卖三:{' '}
              <span class="text-[var(--color-up)]">
                {(lastTick()?.ask_price_3 || 0).toFixed(2)}
              </span>{' '}
              × {lastTick()?.ask_volume_3 || 0}
            </div>
            <div>
              卖四:{' '}
              <span class="text-[var(--color-up)]">
                {(lastTick()?.ask_price_4 || 0).toFixed(2)}
              </span>{' '}
              × {lastTick()?.ask_volume_4 || 0}
            </div>
            <div>
              卖五:{' '}
              <span class="text-[var(--color-up)]">
                {(lastTick()?.ask_price_5 || 0).toFixed(2)}
              </span>{' '}
              × {lastTick()?.ask_volume_5 || 0}
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};
