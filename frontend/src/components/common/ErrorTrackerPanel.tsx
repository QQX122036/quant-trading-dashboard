/**
 * ErrorTrackerPanel.tsx — 前端错误追踪面板
 *
 * 功能：
 * - 显示最近捕获的前端错误
 * - 按 level / source 过滤
 * - 支持一键上报/清除
 * - 显示未解决错误计数
 * - DEV 模式悬浮按钮入口
 */

import { Component, For, Show, createSignal, createMemo } from 'solid-js';
import { trackedErrors, useErrorTracker } from '../../stores/errorStore';
import type { ErrorLevel, ErrorSource } from '../../stores/errorStore';

interface Props {
  /** 默认是否展开面板 */
  defaultOpen?: boolean;
}

const LEVEL_COLORS: Record<ErrorLevel, string> = {
  critical: 'text-red-400 bg-red-500/10 border-red-500/30',
  error: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  warning: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  info: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
};

const LEVEL_BADGE: Record<ErrorLevel, string> = {
  critical: '🔴',
  error: '🟠',
  warning: '🟡',
  info: '🔵',
};

const SOURCE_LABELS: Record<ErrorSource, string> = {
  'window.onerror': 'JS Error',
  unhandledrejection: 'Promise',
  api: 'API',
  component: 'Component',
  websocket: 'WebSocket',
  performance: 'Perf',
};

function formatTs(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

function formatDuration(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

export const ErrorTrackerPanel: Component<Props> = (props) => {
  const tracker = useErrorTracker();
  const [isOpen, setIsOpen] = createSignal(props.defaultOpen ?? false);
  const [filterLevel, setFilterLevel] = createSignal<ErrorLevel | 'all'>('all');
  const [filterSource, setFilterSource] = createSignal<ErrorSource | 'all'>('all');
  const [expandedId, setExpandedId] = createSignal<string | null>(null);

  const filteredErrors = createMemo(() => {
    return trackedErrors().filter((e) => {
      if (filterLevel() !== 'all' && e.level !== filterLevel()) return false;
      if (filterSource() !== 'all' && e.source !== filterSource()) return false;
      return true;
    });
  });

  const unresolvedCount = createMemo(() => tracker.getUnresolvedCount());

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <>
      {/* ── FAB 悬浮按钮 ── */}
      <Show when={!isOpen()}>
        <button
          onClick={() => setIsOpen(true)}
          class="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-3 py-2 rounded-full bg-gray-800/90 backdrop-blur border border-gray-700 shadow-xl hover:bg-gray-700 transition-colors"
          title="打开错误追踪面板"
        >
          <span class="text-base">
            {unresolvedCount() > 0 ? (unresolvedCount() > 5 ? '🔴' : '🟠') : '✅'}
          </span>
          <span class="text-sm font-medium text-gray-300">
            {unresolvedCount() > 0 ? `${unresolvedCount()} errors` : 'No errors'}
          </span>
        </button>
      </Show>

      {/* ── 面板 ── */}
      <Show when={isOpen()}>
        <div class="fixed bottom-6 right-6 z-50 w-[480px] max-h-[70vh] flex flex-col bg-gray-900/95 backdrop-blur border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div class="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-900/80">
            <div class="flex items-center gap-2">
              <span class="text-base">🐛</span>
              <span class="text-sm font-semibold text-gray-100">Error Tracker</span>
              <Show when={unresolvedCount() > 0}>
                <span class="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium">
                  {unresolvedCount()} unresolved
                </span>
              </Show>
            </div>
            <div class="flex items-center gap-2">
              {/* Flush button */}
              <button
                onClick={() => tracker.flush()}
                class="text-xs px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                title="上报错误到服务器"
              >
                Report
              </button>
              {/* Clear button */}
              <button
                onClick={() => tracker.clear()}
                class="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                title="清除所有错误"
              >
                Clear
              </button>
              {/* Close button */}
              <button
                onClick={() => setIsOpen(false)}
                class="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Filters */}
          <div class="flex items-center gap-3 px-4 py-2 border-b border-gray-800 text-xs">
            <span class="text-gray-500">Level:</span>
            <div class="flex gap-1">
              <For each={['all', 'critical', 'error', 'warning', 'info'] as const}>
                {(level) => (
                  <button
                    onClick={() => setFilterLevel(level)}
                    class={`px-2 py-0.5 rounded transition-colors ${
                      filterLevel() === level
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {level === 'all' ? 'All' : level}
                  </button>
                )}
              </For>
            </div>
            <span class="text-gray-500 ml-2">Source:</span>
            <select
              value={filterSource()}
              onChange={(e) => setFilterSource(e.target.value as ErrorSource | 'all')}
              class="bg-gray-800 text-gray-300 rounded px-2 py-0.5 text-xs border border-gray-700"
            >
              <option value="all">All</option>
              <option value="window.onerror">JS Error</option>
              <option value="unhandledrejection">Promise</option>
              <option value="api">API</option>
              <option value="component">Component</option>
              <option value="websocket">WebSocket</option>
              <option value="performance">Perf</option>
            </select>
          </div>

          {/* Error List */}
          <div class="flex-1 overflow-y-auto">
            <Show
              when={filteredErrors().length > 0}
              fallback={
                <div class="flex flex-col items-center justify-center py-12 text-gray-500">
                  <span class="text-3xl mb-2">✅</span>
                  <span class="text-sm">No errors tracked</span>
                </div>
              }
            >
              <For each={filteredErrors()}>
                {(err) => (
                  <div
                    class={`border-b border-gray-800 px-4 py-3 hover:bg-gray-800/40 transition-colors cursor-pointer ${LEVEL_COLORS[err.level]}`}
                    onClick={() => toggleExpand(err.id)}
                  >
                    <div class="flex items-start gap-2">
                      {/* Level badge */}
                      <span class="text-sm mt-0.5">{LEVEL_BADGE[err.level]}</span>
                      <div class="flex-1 min-w-0">
                        {/* Source + time */}
                        <div class="flex items-center gap-2 mb-1">
                          <span class="text-xs font-medium text-gray-400">
                            {SOURCE_LABELS[err.source]}
                          </span>
                          <span class="text-xs text-gray-600">{formatTs(err.timestamp)}</span>
                          <span class="text-xs text-gray-600">{formatDuration(err.timestamp)}</span>
                          <Show when={err.count > 1}>
                            <span class="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">
                              ×{err.count}
                            </span>
                          </Show>
                          <Show when={err.resolved}>
                            <span class="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                              resolved
                            </span>
                          </Show>
                        </div>
                        {/* Message */}
                        <p class="text-sm text-gray-200 truncate">{err.message}</p>
                      </div>
                    </div>

                    {/* Expanded details */}
                    <Show when={expandedId() === err.id}>
                      <div class="mt-3 pl-6 space-y-2 text-xs">
                        <Show when={err.stack}>
                          <div>
                            <span class="text-gray-500">Stack:</span>
                            <pre class="mt-1 p-2 bg-black/30 rounded overflow-x-auto text-gray-400 whitespace-pre-wrap break-all max-h-40">
                              {err.stack}
                            </pre>
                          </div>
                        </Show>
                        <Show when={err.componentStack}>
                          <div>
                            <span class="text-gray-500">Component Stack:</span>
                            <pre class="mt-1 p-2 bg-black/30 rounded overflow-x-auto text-gray-400 whitespace-pre-wrap break-all max-h-32">
                              {err.componentStack}
                            </pre>
                          </div>
                        </Show>
                        <Show when={Object.keys(err.meta).length > 0}>
                          <div>
                            <span class="text-gray-500">Meta:</span>
                            <pre class="mt-1 p-2 bg-black/30 rounded overflow-x-auto text-gray-400 whitespace-pre-wrap break-all">
                              {JSON.stringify(err.meta, null, 2)}
                            </pre>
                          </div>
                        </Show>
                        <div class="flex gap-2 pt-1">
                          <Show when={!err.resolved}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                tracker.resolve(err.id);
                              }}
                              class="px-2 py-1 rounded bg-green-600/30 hover:bg-green-600/50 text-green-300 transition-colors"
                            >
                              Mark Resolved
                            </button>
                          </Show>
                        </div>
                      </div>
                    </Show>
                  </div>
                )}
              </For>
            </Show>
          </div>

          {/* Footer */}
          <div class="px-4 py-2 border-t border-gray-800 text-xs text-gray-600 flex items-center justify-between">
            <span>{filteredErrors().length} errors shown</span>
            <span>
              DEV only · session: {sessionStorage.getItem('error_sid')?.slice(-8) ?? 'n/a'}
            </span>
          </div>
        </div>
      </Show>
    </>
  );
};
