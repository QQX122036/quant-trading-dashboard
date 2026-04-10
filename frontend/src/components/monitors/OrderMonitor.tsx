/**
 * OrderMonitor.tsx — 委托查询
 * 使用 TanStack Table，支持排序、分页、状态筛选、双击撤单
 */
import { For, Component, createMemo, onMount, createSignal, Show } from 'solid-js';
import {
  createSolidTable,
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/solid-table';
import { state } from '../../stores';
import { fetchOrders, cancelOrder } from '../../hooks/useApi';
import { formatPrice, formatTime } from '../../utils/format';
import { logger } from '../../lib/logger';
import { directionBg, statusColor } from '../../utils/color';
import type { OrderData } from '../../types/vnpy';

type OrderFilter = '全部' | '未成交' | '部分成交' | '已撤回';
const ORDER_FILTERS: OrderFilter[] = ['全部', '未成交', '部分成交', '已撤回'];

const FILTER_STATUS_MAP: Record<OrderFilter, string | null> = {
  全部: null,
  未成交: '未成交',
  部分成交: '部分成交',
  已撤回: '已撤销',
};

const helper = createColumnHelper<OrderData>();

export const OrderMonitor: Component = () => {
  const [filter, setFilter] = createSignal<OrderFilter>('全部');
  const [sorting, setSorting] = createSignal<{ id: string; desc: boolean }[]>([
    { id: 'datetime', desc: true },
  ]);
  const [loading, setLoading] = createSignal(false);

  // 仅显示未完成订单：过滤掉全部成交和已撤销
  const activeOrders = createMemo<OrderData[]>(() =>
    Object.values(state.orders.all).filter((o) => o.status !== '全部成交' && o.status !== '已撤销')
  );

  // 按状态筛选
  const filteredOrders = createMemo<OrderData[]>(() => {
    const f = FILTER_STATUS_MAP[filter()];
    if (!f) return activeOrders();
    return activeOrders().filter((o) => o.status === f);
  });

  const columns = [
    helper.accessor('vt_orderid', {
      header: '委托号',
      size: 150,
      cell: (info) => (
        <span class="text-xs font-mono text-[var(--text-muted)]">{info.getValue()}</span>
      ),
    }),
    helper.accessor('symbol', {
      header: '代码',
      size: 80,
      cell: (info) => (
        <span class="text-xs font-mono text-[var(--text-primary)]">{info.getValue()}</span>
      ),
    }),
    helper.accessor('exchange', {
      header: '交易所',
      size: 60,
      cell: (info) => (
        <span class="text-xs text-[var(--text-muted)] text-center block">{info.getValue()}</span>
      ),
    }),
    helper.accessor('direction', {
      header: '方向',
      size: 50,
      cell: (info) => (
        <span
          class={`inline-block px-1 py-0.5 rounded text-[10px] font-bold ${directionBg(info.getValue())}`}
        >
          {info.getValue()}
        </span>
      ),
    }),
    helper.accessor('offset', {
      header: '开平',
      size: 50,
      cell: (info) => (
        <span class="text-xs text-[var(--text-secondary)] text-center block">
          {info.getValue()}
        </span>
      ),
    }),
    helper.accessor('type', {
      header: '类型',
      size: 65,
      cell: (info) => <span class="text-xs text-[var(--text-secondary)]">{info.getValue()}</span>,
    }),
    helper.accessor('price', {
      header: '价格',
      size: 90,
      cell: (info) => (
        <span class="text-xs font-mono tabular-nums text-[var(--text-primary)] text-right block">
          {formatPrice(info.getValue())}
        </span>
      ),
    }),
    helper.accessor('volume', {
      header: '数量',
      size: 65,
      cell: (info) => (
        <span class="text-xs font-mono tabular-nums text-[var(--text-secondary)] text-right block">
          {info.getValue()}
        </span>
      ),
    }),
    helper.accessor('traded', {
      header: '已成交',
      size: 65,
      cell: (info) => (
        <span class="text-xs font-mono tabular-nums text-[var(--text-secondary)] text-right block">
          {info.getValue()}
        </span>
      ),
    }),
    helper.accessor('status', {
      header: '状态',
      size: 80,
      cell: (info) => (
        <span
          class={`inline-block px-1 py-0.5 rounded text-[10px] ${statusColor(info.getValue())}`}
        >
          {info.getValue()}
        </span>
      ),
    }),
    helper.accessor('datetime', {
      header: '时间',
      size: 110,
      cell: (info) => (
        <span class="text-xs font-mono text-[var(--text-muted)]">
          {formatTime(info.getValue())}
        </span>
      ),
    }),
  ];

  const table = createSolidTable({
    get data() {
      return filteredOrders();
    },
    columns,
    state: {
      get sorting() {
        return sorting();
      },
    },
    onSortingChange: (updater) => {
      const val = typeof updater === 'function' ? updater(sorting()) : updater;
      setSorting(val as typeof sorting extends () => infer R ? R : never);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  onMount(async () => {
    setLoading(true);
    try {
      const res = await fetchOrders();
      if (res.code === '0' && res.data?.orders) {
        for (const order of res.data.orders) {
          state.orders.all[order.vt_orderid] = order;
        }
      }
    } catch (e) {
      logger.warn('[OrderMonitor] fetchOrders error', { error: e });
    } finally {
      setLoading(false);
    }
  });

  async function handleCancel(order: OrderData) {
    try {
      await cancelOrder(order.vt_orderid, order.symbol, order.exchange);
    } catch (e) {
      logger.warn('[OrderMonitor] cancelOrder error', { error: e });
    }
  }

  const sortIcon = (colId: string) => {
    const s = sorting().find((s) => s.id === colId);
    if (!s) return '↕';
    return s.desc ? '↓' : '↑';
  };

  const _alignClass = (col: ReturnType<typeof helper.accessor> | undefined) => {
    // @ts-ignore
    const align = col?.meta?.align as string | undefined;
    if (align === 'center') return 'text-center';
    if (align === 'right') return 'text-right';
    return 'text-left';
  };

  return (
    <div class="h-full flex flex-col overflow-hidden">
      {/* 状态过滤器 */}
      <div class="flex items-center gap-1 px-2 py-1.5 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <span class="text-xs text-[var(--text-muted)] mr-1">筛选:</span>
        <For each={ORDER_FILTERS}>
          {(f) => (
            <button
              class={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                filter() === f
                  ? 'bg-[var(--bg-active)] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          )}
        </For>
        <span class="ml-auto text-[10px] text-[var(--text-muted)]">
          {table.getFilteredRowModel().rows.length} / {activeOrders().length} 单
        </span>
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
                        style={{ width: `${header.getSize()}px` }}
                        onClick={() => {
                          const colId = header.column.id;
                          const existing = sorting().find((s) => s.id === colId);
                          if (!existing) {
                            setSorting([{ id: colId, desc: false }]);
                          } else if (!existing.desc) {
                            setSorting([{ id: colId, desc: true }]);
                          } else {
                            setSorting([]);
                          }
                        }}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <span class="ml-0.5 text-[10px]">{sortIcon(header.column.id)}</span>
                        )}
                      </th>
                    )}
                  </For>
                </tr>
              )}
            </For>
          </thead>
          <tbody>
            <Show when={loading()}>
              <tr>
                <td colspan={11} class="text-center py-8 text-[var(--text-muted)] animate-pulse">
                  加载中...
                </td>
              </tr>
            </Show>
            <Show when={!loading()}>
              <For
                each={table.getRowModel().rows}
                fallback={
                  <tr>
                    <td colspan={11} class="text-center py-8 text-[var(--text-muted)]">
                      暂无委托记录
                    </td>
                  </tr>
                }
              >
                {(row) => (
                  <tr
                    class="border-b border-[var(--border-color)]/50 hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
                    onDblClick={() => handleCancel(row.original)}
                    title="双击撤单"
                  >
                    <For each={row.getVisibleCells()}>
                      {(cell) => (
                        <td class="px-1.5 py-1" style={{ width: `${cell.column.getSize()}px` }}>
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
        <div class="flex items-center gap-2">
          <span class="text-[var(--text-muted)]">每页</span>
          <select
            class="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded px-1.5 py-0.5 text-[var(--text-secondary)] text-xs"
            value={table.getState().pagination.pageSize}
            onChange={(e) => table.setPageSize(Number(e.currentTarget.value))}
          >
            <For each={[10, 25, 50, 100]}>{(size) => <option value={size}>{size}</option>}</For>
          </select>
        </div>
        <div class="flex items-center gap-2">
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
