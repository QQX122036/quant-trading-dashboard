/**
 * ContractMonitor.tsx — 合约查询
 * 使用 TanStack Table，支持搜索、分页、WebSocket实时更新
 */
import { Component, createSignal, createMemo, onMount, For, Show } from 'solid-js';
import {
  createSolidTable,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
} from '@tanstack/solid-table';
import { state, actions } from '../../stores';
import { fetchContracts } from '../../hooks/useApi';
import { logger } from '../../lib/logger';
import { formatPrice } from '../../utils/format';
import type { ContractData } from '../../types/vnpy';

export const ContractMonitor: Component = () => {
  const [keyword, setKeyword] = createSignal('');
  const [loading, setLoading] = createSignal(false);

  const contracts = createMemo<ContractData[]>(() => Object.values(state.contracts.items));

  const h = createColumnHelper<ContractData>();

  const table = createSolidTable({
    get data() {
      return contracts();
    },
    columns: [
      h.accessor('symbol', {
        header: '代码',
        size: 80,
        cell: (info) => (
          <span class="text-xs font-mono text-[var(--text-primary)]">{info.getValue()}</span>
        ),
      }),
      h.accessor('name', {
        header: '名称',
        size: 100,
        cell: (info) => <span class="text-xs text-[var(--text-secondary)]">{info.getValue()}</span>,
      }),
      h.accessor('exchange', {
        header: '交易所',
        size: 65,
        meta: { align: 'center' },
        cell: (info) => <span class="text-xs text-[var(--text-muted)]">{info.getValue()}</span>,
      }),
      h.accessor('product', {
        header: '品种',
        size: 60,
        meta: { align: 'center' },
        cell: (info) => <span class="text-xs text-[var(--text-muted)]">{info.getValue()}</span>,
      }),
      h.accessor('size', {
        header: '乘数',
        size: 60,
        meta: { align: 'right' },
        cell: (info) => (
          <span class="text-xs font-mono tabular-nums text-[var(--text-secondary)]">
            {info.getValue()}
          </span>
        ),
      }),
      h.accessor('price_tick', {
        header: '最小跳动',
        size: 80,
        meta: { align: 'right' },
        cell: (info) => (
          <span class="text-xs font-mono tabular-nums text-[var(--text-secondary)]">
            {formatPrice(info.getValue())}
          </span>
        ),
      }),
      h.accessor('gateway_name', {
        header: '网关',
        size: 80,
        cell: (info) => <span class="text-xs text-[var(--text-muted)]">{info.getValue()}</span>,
      }),
    ],
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: 'includesString',
  });

  onMount(async () => {
    setLoading(true);
    try {
      const res = await fetchContracts(keyword() || undefined);
      if (res.code === '0' && res.data?.contracts) {
        for (const c of res.data.contracts) {
          actions.contracts.upsertContract(c);
        }
      }
    } catch (e) {
      logger.warn('[ContractMonitor] fetchContracts error', { error: e });
    } finally {
      setLoading(false);
    }
  });

  async function handleSearch() {
    setLoading(true);
    try {
      const res = await fetchContracts(keyword() || undefined);
      if (res.code === '0' && res.data?.contracts) {
        for (const c of res.data.contracts) {
          actions.contracts.upsertContract(c);
        }
      }
    } catch (e) {
      logger.warn('[ContractMonitor] search error', { error: e });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div class="h-full flex flex-col overflow-hidden">
      {/* 搜索栏 */}
      <div class="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <input
          type="text"
          class="flex-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--border-focus)]"
          placeholder="搜索代码/名称..."
          value={keyword()}
          onInput={(e) => setKeyword(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button
          class="px-3 py-1.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-xs rounded transition-colors"
          onClick={handleSearch}
        >
          查询
        </button>
        <span class="text-[10px] text-[var(--text-muted)]">
          {table.getFilteredRowModel().rows.length} 条
        </span>
      </div>

      {/* 表格 */}
      <div class="flex-1 overflow-auto">
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
            <Show when={loading()}>
              <tr>
                <td colspan={7} class="text-center py-8 text-[var(--text-muted)] animate-pulse">
                  加载中...
                </td>
              </tr>
            </Show>
            <Show when={!loading()}>
              <For
                each={table.getRowModel().rows}
                fallback={
                  <tr>
                    <td colspan={7} class="text-center py-8 text-[var(--text-muted)]">
                      暂无合约数据
                    </td>
                  </tr>
                }
              >
                {(row) => (
                  <tr class="border-b border-[var(--border-color)]/50 hover:bg-[var(--bg-hover)] transition-colors">
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
