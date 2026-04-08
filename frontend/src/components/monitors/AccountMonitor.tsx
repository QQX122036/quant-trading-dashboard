/**
 * AccountMonitor.tsx — 账户资金监控
 * 使用 TanStack Table 展示多账户资金，支持 WebSocket 实时更新、自动刷新
 */
import { Component, createMemo, createSignal, onMount, onCleanup, For, Show } from 'solid-js';
import {
  createSolidTable,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
} from '@tanstack/solid-table';
import { state } from '../../stores';
import { fetchAccounts } from '../../hooks/useApi';
import { logger } from '../../lib/logger';
import { formatAmount } from '../../utils/format';
import { pnlColor } from '../../utils/color';

interface DisplayAccount {
  vt_accountid: string;
  accountid: string;
  gateway_name: string;
  balance: number;
  frozen: number;
  available: number;
  dailyPnl: number;
}

export const AccountMonitor: Component = () => {
  const [loading, setLoading] = createSignal(false);
  const [lastUpdate, setLastUpdate] = createSignal<Date | null>(null);
  let refreshTimer: ReturnType<typeof setInterval>;

  async function loadAccounts() {
    setLoading(true);
    try {
      const res = await fetchAccounts();
      if (res.code === '0' && res.data?.accounts) {
        for (const acc of res.data.accounts) {
          state.accounts.items[acc.vt_accountid] = acc;
        }
        setLastUpdate(new Date());
      }
    } catch (e) {
      logger.warn('[AccountMonitor] fetchAccounts error', { error: e });
    } finally {
      setLoading(false);
    }
  }

  onMount(() => {
    loadAccounts();
    // Auto-refresh every 30s
    refreshTimer = setInterval(loadAccounts, 30_000);
  });

  onCleanup(() => clearInterval(refreshTimer));

  const accounts = createMemo<DisplayAccount[]>(() =>
    Object.values(state.accounts.items).map((a) => ({
      vt_accountid: a.vt_accountid,
      accountid: a.accountid,
      gateway_name: a.gateway_name,
      balance: a.balance || 0,
      frozen: a.frozen || 0,
      available: a.available || 0,
      dailyPnl: 0,
    }))
  );

  const totalBalance = createMemo(() => accounts().reduce((s, a) => s + a.balance, 0));
  const totalAvailable = createMemo(() => accounts().reduce((s, a) => s + a.available, 0));
  const totalFrozen = createMemo(() => accounts().reduce((s, a) => s + a.frozen, 0));
  const totalDailyPnl = createMemo(() => accounts().reduce((s, a) => s + a.dailyPnl, 0));

  const h = createColumnHelper<DisplayAccount>();

  const table = createSolidTable({
    get data() {
      return accounts();
    },
    columns: [
      h.accessor('accountid', {
        header: '账号',
        size: 120,
        cell: (info) => (
          <span class="text-xs font-mono text-[var(--text-primary)]">{info.getValue()}</span>
        ),
      }),
      h.accessor('gateway_name', {
        header: '网关',
        size: 80,
        cell: (info) => <span class="text-xs text-[var(--text-muted)]">{info.getValue()}</span>,
      }),
      h.accessor('balance', {
        header: '总权益',
        size: 110,
        meta: { align: 'right' },
        cell: (info) => (
          <span class="text-xs font-mono tabular-nums text-[var(--text-primary)]">
            {formatAmount(info.getValue())}
          </span>
        ),
      }),
      h.accessor('available', {
        header: '可用资金',
        size: 110,
        meta: { align: 'right' },
        cell: (info) => (
          <span class="text-xs font-mono tabular-nums text-[var(--color-up)]">
            {formatAmount(info.getValue())}
          </span>
        ),
      }),
      h.accessor('frozen', {
        header: '冻结资金',
        size: 100,
        meta: { align: 'right' },
        cell: (info) => (
          <span class="text-xs font-mono tabular-nums text-yellow-400">
            {formatAmount(info.getValue())}
          </span>
        ),
      }),
      h.accessor('dailyPnl', {
        header: '当日盈亏',
        size: 100,
        meta: { align: 'right' },
        cell: (info) => {
          const val = info.getValue();
          return (
            <span class={`text-xs font-mono tabular-nums ${pnlColor(val)}`}>
              {val >= 0 ? '+' : ''}
              {formatAmount(val)}
            </span>
          );
        },
      }),
    ],
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const formatLastUpdate = () => {
    const t = lastUpdate();
    if (!t) return '';
    return `${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}:${t.getSeconds().toString().padStart(2, '0')}`;
  };

  return (
    <div class="h-full flex flex-col overflow-hidden">
      {/* 工具栏：刷新按钮 + 更新时间 */}
      <div class="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <div class="flex items-center gap-2">
          <button
            onClick={loadAccounts}
            disabled={loading()}
            class="flex items-center gap-1 px-2 py-1 text-[11px] rounded bg-white/10 hover:bg-white/20 disabled:opacity-40 transition-colors text-[var(--text-secondary)]"
          >
            <span class={loading() ? 'animate-spin' : ''}>↻</span>
            {loading() ? '刷新中...' : '刷新'}
          </button>
        </div>
        <div class="flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
          <Show when={lastUpdate()}>
            <span>更新: {formatLastUpdate()}</span>
          </Show>
          <span>{accounts().length} 账户</span>
        </div>
      </div>

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
            <Show
              when={accounts().length > 0}
              fallback={
                <tr>
                  <td colspan={6} class="text-center py-12 text-[var(--text-muted)]">
                    {loading() ? '加载中...' : '暂无账户数据'}
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
                          class="px-1.5 py-2"
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

      {/* 汇总栏 */}
      <div class="flex items-center justify-end gap-6 px-3 py-2 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] text-xs">
        <div class="flex items-center gap-1.5">
          <span class="text-[var(--text-muted)]">总权益:</span>
          <span class="text-sm font-bold tabular-nums text-[var(--text-primary)]">
            {formatAmount(totalBalance())}
          </span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="text-[var(--text-muted)]">可用:</span>
          <span class="text-sm font-bold tabular-nums text-[var(--color-up)]">
            {formatAmount(totalAvailable())}
          </span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="text-[var(--text-muted)]">冻结:</span>
          <span class="text-sm font-bold tabular-nums text-yellow-400">
            {formatAmount(totalFrozen())}
          </span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="text-[var(--text-muted)]">当日盈亏:</span>
          <span class={`text-sm font-bold tabular-nums ${pnlColor(totalDailyPnl())}`}>
            {totalDailyPnl() >= 0 ? '+' : ''}
            {formatAmount(totalDailyPnl())}
          </span>
        </div>
      </div>
    </div>
  );
};
