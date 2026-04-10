/**
 * MarketMonitor.tsx — 市场行情监控 + K线图
 * 使用 TanStack Table 展示指数行情，集成 lightweight-charts K线图，支持自动刷新
 */
import { Component, createSignal, createMemo, For, Show, onMount, onCleanup } from 'solid-js';
import {
  createSolidTable,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
} from '@tanstack/solid-table';
import { KlineChart } from '../charts/KlineChart';
import { logger } from '../../lib/logger';
import { state } from '../../stores';
import { fetchDailyBar, isSuccessCode, MAJOR_INDICES, type DailyBar } from '../../hooks/useApi';
import { formatPrice } from '../../utils/format';

interface MarketRow {
  ts_code: string;
  name: string;
  close: number;
  change: number;
  change_pct: number | null;
  volume: number;
  amount: number;
  pre_close: number;
}

const INDEX_NAME_MAP: Record<string, string> = Object.fromEntries(
  MAJOR_INDICES.map((i) => [i.ts_code, i.displayName])
);

export const MarketMonitor: Component = () => {
  const [selectedSymbol, setSelectedSymbol] = createSignal<string>('000001.SH');
  const [selectedName, setSelectedName] = createSignal<string>('上证指数');
  const [indexBars, setIndexBars] = createSignal<DailyBar[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [indexLoading, _setIndexLoading] = createSignal(false);
  const [lastMarketUpdate, setLastMarketUpdate] = createSignal<Date | null>(null);

  // Pull market data from state (WebSocket-fed)
  const marketRows = createMemo<MarketRow[]>(() => {
    const rows = Object.values(state.market.ticks).map((tick) => ({
      ts_code: tick.symbol,
      name: INDEX_NAME_MAP[tick.symbol] || tick.name || tick.symbol,
      close: tick.last_price,
      pre_close: tick.pre_close,
      change: tick.pre_close > 0 ? tick.last_price - tick.pre_close : 0,
      change_pct:
        tick.pre_close > 0 ? ((tick.last_price - tick.pre_close) / tick.pre_close) * 100 : null,
      volume: tick.volume,
      amount: 0,
    }));
    if (rows.length > 0) setLastMarketUpdate(new Date());
    return rows;
  });

  async function loadIndexBars(ts_code: string) {
    setLoading(true);
    try {
      const res = await fetchDailyBar(ts_code, undefined, undefined, 120);
      if (isSuccessCode(res.code) && res.data?.bars) {
        setIndexBars(res.data.bars);
      }
    } catch (e) {
      logger.warn('[MarketMonitor] fetchDailyBar error', { error: e });
    } finally {
      setLoading(false);
    }
  }

  function handleRowClick(row: MarketRow) {
    setSelectedSymbol(row.ts_code);
    setSelectedName(row.name);
    loadIndexBars(row.ts_code);
  }

  onMount(() => {
    // Load selected index bars on mount
    loadIndexBars(selectedSymbol());
  });

  const h = createColumnHelper<MarketRow>();

  const table = createSolidTable({
    get data() {
      return marketRows();
    },
    columns: [
      h.accessor('name', {
        header: '名称',
        size: 90,
        cell: (info) => (
          <span class="text-xs font-medium text-[var(--text-primary)]">{info.getValue()}</span>
        ),
      }),
      h.accessor('ts_code', {
        header: '代码',
        size: 85,
        cell: (info) => (
          <span class="text-xs font-mono text-[var(--text-muted)]">{info.getValue()}</span>
        ),
      }),
      h.accessor('close', {
        header: '最新价',
        size: 85,
        meta: { align: 'right' },
        cell: (info) => {
          const val = info.getValue();
          const pct = info.row.original.change_pct;
          const color =
            pct === null ? '' : pct >= 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]';
          return <span class={`text-xs font-mono tabular-nums ${color}`}>{formatPrice(val)}</span>;
        },
      }),
      h.accessor('change', {
        header: '涨跌额',
        size: 75,
        meta: { align: 'right' },
        cell: (info) => {
          const val = info.getValue();
          const pct = info.row.original.change_pct;
          const color =
            pct === null ? '' : pct >= 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]';
          return (
            <span class={`text-xs font-mono tabular-nums ${color}`}>
              {val >= 0 ? '+' : ''}
              {val.toFixed(2)}
            </span>
          );
        },
      }),
      h.accessor('change_pct', {
        header: '涨跌幅',
        size: 80,
        meta: { align: 'right' },
        cell: (info) => {
          const pct = info.getValue() as number | null;
          if (pct === null) return <span class="text-xs text-[var(--text-muted)]">—</span>;
          const up = pct >= 0;
          return (
            <span
              class={`text-xs font-mono tabular-nums font-medium ${up ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}`}
            >
              {up ? '↑' : '↓'} {Math.abs(pct).toFixed(2)}%
            </span>
          );
        },
      }),
      h.accessor('volume', {
        header: '成交量',
        size: 95,
        meta: { align: 'right' },
        cell: (info) => {
          const vol = info.getValue();
          return (
            <span class="text-xs font-mono tabular-nums text-[var(--text-secondary)]">
              {vol > 0 ? (vol / 1e8).toFixed(2) + '亿' : '—'}
            </span>
          );
        },
      }),
    ],
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: {
      pagination: { pageSize: 10, pageIndex: 0 },
    },
  });

  const formatLastUpdate = () => {
    const t = lastMarketUpdate();
    if (!t) return '';
    return `${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}:${t.getSeconds().toString().padStart(2, '0')}`;
  };

  return (
    <div class="flex flex-col h-full overflow-hidden">
      {/* 工具栏 */}
      <div class="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold text-[var(--text-secondary)]">主要指数</span>
          <button
            onClick={() => {
              loadIndexBars(selectedSymbol());
            }}
            disabled={loading()}
            class="flex items-center gap-1 px-2 py-1 text-[11px] rounded bg-white/10 hover:bg-white/20 disabled:opacity-40 transition-colors text-[var(--text-secondary)]"
          >
            <span class={indexLoading() || loading() ? 'animate-spin' : ''}>↻</span>
            刷新
          </button>
        </div>
        <div class="flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
          <Show when={lastMarketUpdate()}>
            <span>更新: {formatLastUpdate()}</span>
          </Show>
          <Show when={loading()}>
            <span class="animate-pulse">K线加载中...</span>
          </Show>
          <Show when={!loading()}>
            <span>{marketRows().length} 只指数</span>
          </Show>
        </div>
      </div>

      {/* 指数行情列表 */}
      <div class="flex-shrink-0 border-b border-[var(--border-color)] overflow-x-auto max-h-[180px]">
        <table class="w-full border-collapse text-xs min-w-[400px]">
          <thead class="sticky top-0 z-10 bg-[var(--bg-tertiary)]">
            <tr>
              <For each={table.getHeaderGroups()[0]?.headers ?? []}>
                {(header) => (
                  <th
                    class="px-2 py-2 text-[var(--text-muted)] font-normal border-b border-[var(--border-color)] whitespace-nowrap cursor-pointer select-none hover:text-[var(--text-secondary)]"
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
              when={marketRows().length > 0}
              fallback={
                <tr>
                  <td colspan={6} class="text-center py-6 text-[var(--text-muted)] text-xs">
                    {indexLoading() ? '加载中...' : '暂无行情数据'}
                  </td>
                </tr>
              }
            >
              <For each={table.getRowModel().rows}>
                {(row) => (
                  <tr
                    class={`border-b border-[var(--border-color)]/50 cursor-pointer transition-colors ${selectedSymbol() === row.original.ts_code ? 'bg-[var(--bg-selected)]' : 'hover:bg-[var(--bg-hover)]'}`}
                    onClick={() => handleRowClick(row.original)}
                  >
                    <For each={row.getVisibleCells()}>
                      {(cell) => (
                        <td
                          class="px-2 py-1.5"
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

      {/* K线图区域 */}
      <div class="flex-1 min-h-0 flex flex-col">
        <div class="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold text-[var(--text-primary)]">
              {selectedName()} ({selectedSymbol()})
            </span>
            <Show when={loading()}>
              <span class="text-[10px] text-[var(--text-muted)] animate-pulse">K线加载中...</span>
            </Show>
          </div>
          <div class="flex items-center gap-2">
            {/* Quick index switcher */}
            <For each={MAJOR_INDICES.slice(0, 6)}>
              {(idx) => (
                <button
                  onClick={() => {
                    setSelectedSymbol(idx.ts_code);
                    setSelectedName(idx.displayName);
                    loadIndexBars(idx.ts_code);
                  }}
                  class={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                    selectedSymbol() === idx.ts_code
                      ? 'bg-[var(--bg-active)] text-white'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  {idx.displayName}
                </button>
              )}
            </For>
          </div>
        </div>
        <div class="flex-1 min-h-0 w-full">
          <Show
            when={!loading() || indexBars().length > 0}
            fallback={
              <div class="flex items-center justify-center h-full text-[var(--text-muted)] text-xs animate-pulse">
                加载K线数据...
              </div>
            }
          >
            <KlineChart
              symbol={selectedSymbol().split('.')[0]}
              exchange={selectedSymbol().endsWith('.SH') ? 'SSE' : 'SZE'}
              bars={indexBars().length > 0 ? indexBars() : undefined}
            />
          </Show>
        </div>
      </div>
    </div>
  );
};
