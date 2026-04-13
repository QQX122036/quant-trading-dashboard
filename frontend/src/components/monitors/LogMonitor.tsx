/**
 * LogMonitor.tsx — 日志监控
 * 使用 TanStack Table 展示日志列表，支持级别过滤、关键词搜索、WebSocket实时追加、自动滚动
 */
import { Component, createSignal, createMemo, For, Show, createEffect } from 'solid-js';
import {
  createSolidTable,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
} from '@tanstack/solid-table';
import { state } from '../../stores';
import { formatTime } from '../../utils/format';
import type { LogData } from '../../types/vnpy';

type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';

const LEVEL_COLORS: Record<LogLevel | string, string> = {
  DEBUG: 'text-[var(--text-muted)]',
  INFO: 'text-blue-400',
  WARNING: 'text-yellow-400',
  ERROR: 'text-red-400',
};

const LEVEL_BG: Record<LogLevel | string, string> = {
  DEBUG: 'bg-transparent',
  INFO: 'bg-blue-900/10',
  WARNING: 'bg-yellow-900/10',
  ERROR: 'bg-red-900/10',
};

const LEVEL_ICONS: Record<LogLevel | string, string> = {
  DEBUG: '○',
  INFO: '●',
  WARNING: '▲',
  ERROR: '✕',
};

const LEVELS: LogLevel[] = ['DEBUG', 'INFO', 'WARNING', 'ERROR'];

export const LogMonitor: Component = () => {
  const [levelFilter, setLevelFilter] = createSignal<LogLevel | 'ALL'>('ALL');
  const [keyword, setKeyword] = createSignal('');
  const [autoScroll, setAutoScroll] = createSignal(true);
  const [showDebug, setShowDebug] = createSignal(false);
  let listRef: HTMLDivElement | undefined;

  const allLogs = createMemo(() => state.logs.items);

  const filteredLogs = createMemo(() => {
    let result = allLogs();
    const lvl = levelFilter();
    if (lvl !== 'ALL') {
      result = result.filter((l) => l.level === lvl);
    }
    if (!showDebug()) {
      result = result.filter((l) => l.level !== 'DEBUG');
    }
    const kw = keyword().toLowerCase();
    if (kw) {
      result = result.filter(
        (l) => l.msg.toLowerCase().includes(kw) || l.gateway_name?.toLowerCase().includes(kw)
      );
    }
    return result;
  });

  // Auto-scroll when new logs arrive
  createEffect(() => {
    filteredLogs(); // track
    if (autoScroll() && listRef) {
      requestAnimationFrame(() => {
        if (listRef) listRef.scrollTop = listRef.scrollHeight;
      });
    }
  });

  function handleScroll() {
    if (!listRef) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef;
    // If user scrolled up > 50px from bottom, disable auto-scroll
    const distFromBottom = scrollHeight - scrollTop - clientHeight;
    if (distFromBottom > 50) {
      setAutoScroll(false);
    } else {
      setAutoScroll(true);
    }
  }

  function clearLogs() {
    state.logs.items = [];
  }

  const levelCounts = createMemo(() => {
    const counts: Record<string, number> = { DEBUG: 0, INFO: 0, WARNING: 0, ERROR: 0 };
    for (const l of allLogs()) {
      if (counts[l.level] !== undefined) counts[l.level]++;
    }
    return counts;
  });

  const h = createColumnHelper<LogData>();

  const table = createSolidTable({
    get data() {
      return filteredLogs();
    },
    columns: [
      h.accessor('datetime', {
        header: '时间',
        size: 140,
        cell: (info) => (
          <span class="text-xs font-mono text-[var(--text-muted)] whitespace-nowrap">
            {formatTime(info.getValue())}
          </span>
        ),
      }),
      h.accessor('level', {
        header: '级别',
        size: 72,
        meta: { align: 'center' },
        cell: (info) => {
          const lvl = info.getValue() as LogLevel;
          return (
            <span
              class={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-bold ${LEVEL_COLORS[lvl]} ${LEVEL_BG[lvl]}`}
            >
              <span>{LEVEL_ICONS[lvl]}</span>
              <span>{lvl}</span>
            </span>
          );
        },
      }),
      h.accessor('gateway_name', {
        header: '网关',
        size: 90,
        cell: (info) => (
          <span class="text-xs text-[var(--text-muted)]">{info.getValue() || '—'}</span>
        ),
      }),
      h.accessor('msg', {
        header: '消息',
        size: 0,
        minSize: 200,
        cell: (info) => (
          <span class="text-xs text-[var(--text-secondary)] break-all leading-relaxed">
            {info.getValue()}
          </span>
        ),
      }),
    ],
    state: {
      sorting: [{ id: 'datetime', desc: true }],
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div class="h-full flex flex-col overflow-hidden">
      {/* 工具栏 */}
      <div class="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <span class="text-xs text-[var(--text-muted)]">级别:</span>
        <For each={['ALL', ...LEVELS] as const}>
          {(lvl) => {
            const count = lvl === 'ALL' ? allLogs().length : (levelCounts()[lvl] ?? 0);
            const isActive = levelFilter() === lvl;
            const isError = lvl === 'ERROR' && (levelCounts()['ERROR'] ?? 0) > 0;
            return (
              <button
                class={`px-2 py-0.5 rounded text-[11px] transition-colors flex items-center gap-1 ${
                  isActive
                    ? 'bg-[var(--bg-active)] text-white'
                    : isError
                      ? 'text-red-400 hover:bg-red-900/20'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/5'
                }`}
                onClick={() =>
                  setLevelFilter(lvl as typeof levelFilter extends () => infer R ? R : never)
                }
              >
                {lvl === 'ALL' ? '全部' : lvl}
                <span class={`text-[10px] ${isActive ? 'opacity-70' : 'opacity-50'}`}>
                  ({count})
                </span>
              </button>
            );
          }}
        </For>

        <div class="w-px h-4 bg-white/10 mx-1" />

        <label class="flex items-center gap-1 text-[11px] text-[var(--text-muted)] cursor-pointer">
          <input
            type="checkbox"
            checked={showDebug()}
            onChange={(e) => setShowDebug(e.currentTarget.checked)}
            class="w-3 h-3 accent-[var(--color-accent)]"
          />
          DEBUG
        </label>

        <div class="w-px h-4 bg-white/10 mx-1" />

        <input
          type="text"
          class="flex-1 max-w-[200px] bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded px-2 py-0.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--border-focus)]"
          placeholder="搜索关键词..."
          value={keyword()}
          onInput={(e) => setKeyword(e.currentTarget.value)}
        />

        <button
          onClick={() => setAutoScroll((v) => !v)}
          class={`px-2 py-0.5 rounded text-[10px] transition-colors ${
            autoScroll()
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          }`}
          title={autoScroll() ? '自动滚动已开启' : '自动滚动已暂停'}
        >
          ↓ {autoScroll() ? '滚动' : '暂停'}
        </button>

        <button
          onClick={clearLogs}
          class="px-2 py-0.5 rounded text-[10px] text-[var(--text-muted)] hover:text-red-400 hover:bg-red-900/10 transition-colors"
          title="清空日志"
        >
          清空
        </button>

        <span class="ml-auto text-[10px] text-[var(--text-muted)] flex items-center gap-2">
          <Show when={(levelCounts()['ERROR'] ?? 0) > 0}>
            <span class="flex items-center gap-0.5 text-red-400">
              <span>✕</span>
              <span>{levelCounts()['ERROR']}</span>
            </span>
          </Show>
          <Show when={(levelCounts()['WARNING'] ?? 0) > 0}>
            <span class="flex items-center gap-0.5 text-yellow-400">
              <span>▲</span>
              <span>{levelCounts()['WARNING']}</span>
            </span>
          </Show>
          <span>
            {filteredLogs().length} / {allLogs().length} 条
          </span>
        </span>
      </div>

      {/* 日志列表 */}
      <div ref={listRef} class="flex-1 overflow-auto font-mono text-xs" onScroll={handleScroll}>
        <Show
          when={filteredLogs().length > 0}
          fallback={
            <div class="flex items-center justify-center h-full text-[var(--text-muted)] text-xs">
              {allLogs().length === 0 ? '暂无日志' : '无匹配日志'}
            </div>
          }
        >
          <For each={table.getRowModel().rows}>
            {(row) => (
              <div
                class={`flex gap-2 px-3 py-0.5 border-b border-[var(--border-color)]/30 hover:bg-[var(--bg-hover)] transition-colors ${LEVEL_BG[row.original.level] ?? ''}`}
              >
                <For each={row.getVisibleCells()}>
                  {(cell) => (
                    <div
                      class="flex-shrink-0 py-0.5"
                      style={{
                        width: cell.column.id === 'msg' ? 'auto' : `${cell.column.getSize()}px`,
                        'text-align': ((cell.column.columnDef.meta as { align?: string })?.align ??
                          'left') as any,
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  )}
                </For>
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
};
