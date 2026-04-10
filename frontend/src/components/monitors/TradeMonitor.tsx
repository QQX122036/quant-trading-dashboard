/**
 * TradeMonitor.tsx — 成交记录
 * 使用 TanStack Table 展示成交记录，支持排序、分页、自动刷新
 */
import { Component, createMemo, createSignal, onMount, onCleanup, For, Show } from 'solid-js';
import {
  createSolidTable,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
} from '@tanstack/solid-table';
import { state } from '../../stores';
import { fetchTrades } from '../../hooks/useApi';
import { logger } from '../../lib/logger';
import { formatPrice, formatTime } from '../../utils/format';
import { directionBg, _pnlColor } from '../../utils/color';
import type { TradeData } from '../../types/vnpy';

export const TradeMonitor: Component = () => {
  const [loading, setLoading] = createSignal(false);
  const [lastUpdate, setLastUpdate] = createSignal<Date | null>(null);
  let refreshTimer: ReturnType<typeof setInterval>;

  async function loadTrades() {
    setLoading(true);
    try {
      const res = await fetchTrades();
      if (res.code === '0' && res.data?.trades) {
        state.trades.items = res.data.trades;
        setLastUpdate(new Date());
      }
    } catch (e) {
      logger.warn('[TradeMonitor] fetchTrades error', { error: e });
    } finally {
      setLoading(false);
    }
  }

  onMount(() => {
    loadTrades();
    // Auto-refresh every 30s
    refreshTimer = setInterval(loadTrades, 30_000);
  });

  onCleanup(() => clearInterval(refreshTimer));

  const trades = createMemo<TradeData[]>(() => state.trades.items);

  const totalBuyVolume = createMemo(() =>
    trades()
      .filter((t) => t.direction === '多')
      .reduce((s, t) => s + t.volume, 0)
  );
  const totalSellVolume = createMemo(() =>
    trades()
      .filter((t) => t.direction === '空')
      .reduce((s, t) => s + t.volume, 0)
  );
  const totalTurnover = createMemo(() => trades().reduce((s, t) => s + t.price * t.volume, 0));

  const h = createColumnHelper<TradeData>();

  const table = createSolidTable({
    get data() {
      return trades();
    },
    columns: [
      h.accessor('vt_tradeid', {
        header: '成交号',
        size: 150,
        cell: (info) => (
          <span class="text-xs font-mono text-[var(--text-muted)] truncate block">
            {info.getValue()}
          </span>
        ),
      }),
      h.accessor('vt_orderid', {
        header: '委托号',
        size: 150,
        cell: (info) => (
          <span class="text-xs font-mono text-[var(--text-muted)] truncate block">
            {info.getValue()}
          </span>
        ),
      }),
      h.accessor('symbol', {
        header: '代码',
        size: 80,
        cell: (info) => (
          <span class="text-xs font-mono text-[var(--text-secondary)]">{info.getValue()}</span>
        ),
      }),
      h.accessor('exchange', {
        header: '交易所',
        size: 60,
        cell: (info) => <span class="text-xs text-[var(--text-muted)]">{info.getValue()}</span>,
      }),
      h.accessor('direction', {
        header: '方向',
        size: 50,
        meta: { align: 'center' },
        cell: (info) => (
          <span
            class={`inline-block px-1 py-0.5 rounded text-[10px] font-bold ${directionBg(info.getValue() as string)}`}
          >
            {info.getValue()}
          </span>
        ),
      }),
      h.accessor('offset', {
        header: '开平',
        size: 50,
        meta: { align: 'center' },
        cell: (info) => <span class="text-xs text-[var(--text-secondary)]">{info.getValue()}</span>,
      }),
      h.accessor('price', {
        header: '价格',
        size: 90,
        meta: { align: 'right' },
        cell: (info) => (
          <span class="text-xs font-mono tabular-nums text-[var(--text-primary)]">
            {formatPrice(info.getValue() as number)}
          </span>
        ),
      }),
      h.accessor('volume', {
        header: '数量',
        size: 65,
        meta: { align: 'right' },
        cell: (info) => (
          <span class="text-xs font-mono tabular-nums text-[var(--text-secondary)]">
            {info.getValue()}
          </span>
        ),
      }),
      h.accessor('datetime', {
        header: '时间',
        size: 110,
        cell: (info) => (
          <span class="text-xs font-mono text-[var(--text-muted)]">
            {formatTime(info.getValue() as string)}
          </span>
        ),
      }),
    ],
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: {
      sorting: [{ id: 'datetime', desc: true }],
    },
    onSortingChange: (updater) => {
      const val = typeof updater === 'function' ? updater(table.getState().sorting) : updater;
      table.setSorting(val);
    },
  });

  const formatLastUpdate = () => {
    const t = lastUpdate();
    if (!t) return '';
    return `${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}:${t.getSeconds().toString().padStart(2, '0')}`;
  };

  const fmtTurnover = (v: number) =>
    v >= 1e8 ? `${(v / 1e8).toFixed(2)}亿` : v >= 1e4 ? `${(v / 1e4).toFixed(2)}万` : v.toFixed(2);

  return (
    <div class="h-full flex flex-col overflow-hidden">
      {/* 工具栏 */}
      <div class="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <div class="flex items-center gap-2">
          <button
            onClick={loadTrades}
            disabled={loading()}
            class="flex items-center gap-1 px-2 py-1 text-[11px] rounded bg-white/10 hover:bg-white/20 disabled:opacity-40 transition-colors text-[var(--text-secondary)]"
          >
            <span class={loading() ? 'animate-spin' : ''}>↻</span>
            {loading() ? '刷新中...' : '刷新'}
          </button>
        </div>
        <div class="flex items-center gap-4 text-[10px] text-[var(--text-muted)]">
          <Show when={lastUpdate()}>
            <span>更新: {formatLastUpdate()}</span>
          </Show>
          <span>
            买量: <span class="text-[var(--color-up)]">{totalBuyVolume().toLocaleString()}</span>
          </span>
          <span>
            卖量: <span class="text-[var(--color-down)]">{totalSellVolume().toLocaleString()}</span>
          </span>
          <span>
            成交额: <span class="text-[var(--text-secondary)]">{fmtTurnover(totalTurnover())}</span>
          </span>
          <span>{table.getFilteredRowModel().rows.length} 条</span>
        </div>
      </div>

      {/* 表格 */}
      <div class="flex-1 overflow-auto">
        <table class="w-full border-collapse text-xs">
          <thead class="sticky top-0 z-10 bg-[var(--bg-tertiary)]">
            <For each={table.getHeaderGroups()}>
              {(hg) => (
                <tr>
                  <For each={hg.headers}>
                    {(header) => (
                      <th
                        class="px-1.5 py-2 text-[var(--text-muted)] font-normal border-b border-[var(--border-color)] whitespace-nowrap cursor-pointer select-none hover:text-[var(--text-secondary)]"
                        style={{
                          width: `${header.getSize()}px`,
                          'text-align': ((header.column.columnDef.meta as { align?: string })
                            ?.align ?? 'left') as any,
                        }}
                        onClick={() => header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    )}
                  </For>
                </tr>
              )}
            </For>
          </thead>
          <tbody>
            <Show
              when={trades().length > 0}
              fallback={
                <tr>
                  <td colspan={9} class="text-center py-12 text-[var(--text-muted)]">
                    {loading() ? '加载中...' : '暂无成交记录'}
                  </td>
                </tr>
              }
            >
              <For each={table.getRowModel().rows}>
                {(row) => (
                  <tr class="border-b border-[var(--border-color)]/50 hover:bg-[var(--bg-hover)] transition-colors">
                    <For each={row.getVisibleCells()}>
                      {(cell) => (
                        <td
                          class="px-1.5 py-1"
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
      <div class="flex items-center justify-between px-3 py-1.5 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] text-xs">
        <span class="text-[var(--text-muted)] text-[10px]">双击成交记录可复制</span>
        <div class="flex items-center gap-2">
          <span class="text-[var(--text-muted)]">每页</span>
          <select
            class="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded px-1.5 py-0.5 text-[var(--text-secondary)] text-xs"
            value={table.getState().pagination.pageSize}
            onChange={(e) => table.setPageSize(Number(e.currentTarget.value))}
          >
            <For each={[10, 25, 50, 100]}>{(size) => <option value={size}>{size}</option>}</For>
          </select>
          <button
            class="px-2 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] disabled:opacity-40"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            ‹ 上一页
          </button>
          <span class="text-[var(--text-muted)]">
            {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
          </span>
          <button
            class="px-2 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] disabled:opacity-40"
            disabled={!table.getCanNextPage()}
            onClick={() => table.getCanNextPage() && table.nextPage()}
          >
            下一页 ›
          </button>
        </div>
      </div>
    </div>
  );
};
