import { For, Component, createMemo } from 'solid-js';
import { state } from '../../stores';
import { formatTime } from '../../utils/format';

const LEVEL_COLORS: Record<string, string> = {
  DEBUG: 'text-[var(--text-muted)]',
  INFO:  'text-[var(--text-primary)]',
  WARNING: 'text-yellow-400',
  ERROR: 'text-red-400',
};

export const LogMonitor: Component = () => {
  const logs = createMemo(() => state.logs.items);

  return (
    <div class="h-full flex flex-col overflow-hidden">
      <div class="flex-1 overflow-auto font-mono text-xs">
        <For each={logs()} fallback={
          <div class="flex items-center justify-center h-full text-[var(--text-muted)]">暂无日志</div>
        }>
          {(log) => (
            <div class="flex gap-3 px-3 py-0.5 border-b border-[var(--border-color)]/50 hover:bg-[var(--bg-hover)]">
              <span class="text-[var(--text-muted)] whitespace-nowrap">{formatTime(log.datetime)}</span>
              <span class={`whitespace-nowrap ${LEVEL_COLORS[log.level] || 'text-[var(--text-secondary)]'}`}>
                [{log.level}]
              </span>
              <span class="text-[var(--text-secondary)]">{log.msg}</span>
              {log.gateway_name && (
                <span class="text-[var(--text-muted)] ml-auto">{log.gateway_name}</span>
              )}
            </div>
          )}
        </For>
      </div>
    </div>
  );
};
