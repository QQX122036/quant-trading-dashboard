/**
 * QuoteMonitor.tsx — 报价监控
 * 使用 TanStack Table 展示报价，支持筛选、双击撤报价、分页
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
import { fetchQuotes, cancelQuote } from '../../hooks/useApi';
import { logger } from '../../lib/logger';
import { formatPrice, formatTime } from '../../utils/format';
import type { QuoteData, QuoteStatus } from '../../types/vnpy';

type QuoteFilter = '全部' | '活跃' | '已成交' | '已撤销';
const QUOTE_FILTERS: QuoteFilter[] = ['全部', '活跃', '已成交', '已撤销'];

const STATUS_COLOR: Record<QuoteStatus, string> = {
  活跃: 'bg-green-700/30 text-green-400',
  已成交: 'bg-blue-600/30 text-blue-400',
  已撤销: 'bg-gray-500/30 text-gray-400',
};

const OFFSET_COLOR: Record<string, string> = {
  开: 'bg-red-500/20 text-red-400',
  平: 'bg-cyan-500/20 text-cyan-400',
};

export const QuoteMonitor: Component = () => {
  const [filter, setFilter] = createSignal<QuoteFilter>('全部');
  const [quotes, setQuotes] = createSignal<QuoteData[]>([]);
  const [loading, setLoading] = createSignal(false);

  const filteredQuotes = createMemo(() => {
    const f = filter();
    if (f === '全部') return quotes();
    return quotes().filter((q) => q.status === f);
  });

  const h = createColumnHelper<QuoteData>();

  const table = createSolidTable({
    get data() {
      return filteredQuotes();
    },
    columns: [
      h.accessor('ts_code', {
        header: '代码',
        size: 90,
        cell: (info) => (
          <span class="text-xs font-mono text-[var(--text-primary)]">{info.getValue()}</span>
        ),
      }),
      h.accessor('source', {
        header: '来源',
        size: 55,
        meta: { align: 'center' },
        cell: (info) => <span class="text-xs text-[var(--text-muted)]">{info.getValue()}</span>,
      }),
      h.accessor('bid_offset', {
        header: '买开平',
        size: 55,
        meta: { align: 'center' },
        cell: (info) => (
          <span
            class={`inline-block px-1 py-0.5 rounded text-[10px] font-bold ${OFFSET_COLOR[String(info.getValue())] ?? ''}`}
          >
            {String(info.getValue() ?? '-')}
          </span>
        ),
      }),
      h.accessor('bid_volume_1', {
        header: '买量',
        size: 65,
        meta: { align: 'right' },
        cell: (info) => (
          <span class="text-xs font-mono tabular-nums text-[var(--text-secondary)]">
            {Number(info.getValue()).toLocaleString()}
          </span>
        ),
      }),
      h.accessor('bid_price_1', {
        header: '买价',
        size: 80,
        meta: { align: 'right' },
        cell: (info) => (
          <span class="text-xs font-mono tabular-nums text-[var(--color-down)]">
            {formatPrice(Number(info.getValue()))}
          </span>
        ),
      }),
      h.accessor('ask_price_1', {
        header: '卖价',
        size: 80,
        meta: { align: 'right' },
        cell: (info) => (
          <span class="text-xs font-mono tabular-nums text-[var(--color-up)]">
            {formatPrice(Number(info.getValue()))}
          </span>
        ),
      }),
      h.accessor('ask_volume_1', {
        header: '卖量',
        size: 65,
        meta: { align: 'right' },
        cell: (info) => (
          <span class="text-xs font-mono tabular-nums text-[var(--text-secondary)]">
            {Number(info.getValue()).toLocaleString()}
          </span>
        ),
      }),
      h.accessor('ask_offset', {
        header: '卖开平',
        size: 55,
        meta: { align: 'center' },
        cell: (info) => (
          <span
            class={`inline-block px-1 py-0.5 rounded text-[10px] font-bold ${OFFSET_COLOR[String(info.getValue())] ?? ''}`}
          >
            {String(info.getValue() ?? '-')}
          </span>
        ),
      }),
      h.accessor('status', {
        header: '状态',
        size: 70,
        meta: { align: 'center' },
        cell: (info) => (
          <span
            class={`inline-block px-1 py-0.5 rounded text-[10px] ${STATUS_COLOR[String(info.getValue()) as QuoteStatus] ?? ''}`}
          >
            {String(info.getValue() ?? '-')}
          </span>
        ),
      }),
      h.accessor('time', {
        header: '时间',
        size: 100,
        cell: (info) => (
          <span class="text-xs font-mono text-[var(--text-muted)]">
            {formatTime(String(info.getValue()))}
          </span>
        ),
      }),
    ],
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  onMount(async () => {
    setLoading(true);
    try {
      const res = await fetchQuotes();
      if (res.code === '0' && res.data?.quotes) {
        setQuotes(res.data.quotes);
      }
    } catch (e) {
      logger.warn('[QuoteMonitor] fetchQuotes error', { error: e });
    } finally {
      setLoading(false);
    }
  });

  async function handleCancel(quote: QuoteData) {
    if (quote.status === '已撤销') return;
    try {
      await cancelQuote(quote.quote_id);
      setQuotes((prev) =>
        prev.map((q) =>
          q.quote_id === quote.quote_id ? { ...q, status: '已撤销' as QuoteStatus } : q
        )
      );
    } catch (e) {
      logger.warn('[QuoteMonitor] cancelQuote error', { error: e });
    }
  }

  return (
    <div class="h-full flex flex-col overflow-hidden">
      {/* 过滤器 */}
      <div class="flex items-center gap-1 px-2 py-1.5 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <span class="text-xs text-[var(--text-muted)] mr-1">筛选:</span>
        <For each={QUOTE_FILTERS}>
          {(f) => (
            <button
              class={`px-2 py-0.5 rounded text-[11px] transition-colors ${filter() === f ? 'bg-[var(--bg-active)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          )}
        </For>
        <span class="ml-auto text-[10px] text-[var(--text-muted)]">
          {filteredQuotes().length} / {quotes().length} 笔
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
                <td colspan={10} class="text-center py-8 text-[var(--text-muted)] animate-pulse">
                  加载中...
                </td>
              </tr>
            </Show>
            <Show when={!loading()}>
              <For
                each={table.getRowModel().rows}
                fallback={
                  <tr>
                    <td colspan={10} class="text-center py-8 text-[var(--text-muted)]">
                      暂无报价记录
                    </td>
                  </tr>
                }
              >
                {(row) => (
                  <tr
                    class="border-b border-[var(--border-color)]/50 hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
                    onDblClick={() => handleCancel(row.original)}
                    title="双击撤报价"
                  >
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
      <Show when={!loading() && quotes().length > 0}>
        <div class="flex items-center justify-between px-3 py-1 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] text-xs">
          <span class="text-[var(--text-muted)]">双击行撤报价</span>
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
      </Show>
    </div>
  );
};
