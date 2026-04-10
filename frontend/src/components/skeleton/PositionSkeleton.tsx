import { Component, For } from 'solid-js';

// ── Column widths matching PositionMonitor table ──────────────────────────────────
// 合约(90), 交易所(60), 方向(55), 数量(65), 昨仓(55), 冻结(55), 均价(90), 占比(60), 盈亏(90)
const HEADER_WIDTHS = [90, 60, 55, 65, 55, 55, 90, 60, 90];
const ROW_WIDTHS = [90, 60, 55, 65, 55, 55, 90, 60, 90];

// ── Account summary field widths (matches AccountMonitor columns) ─────────────────
const _ACCOUNT_FIELD_LABELS = ['账号', '网关', '总权益', '可用资金', '冻结资金', '当日盈亏'];

export const PositionSkeleton: Component = () => {
  return (
    <div class="h-full flex flex-col p-4 gap-4 animate-pulse">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div class="flex items-center justify-between">
        <div class="h-6 w-32 bg-gray-700/50 rounded" />
        <div class="flex gap-2">
          <div class="h-8 w-24 bg-gray-700/50 rounded" />
          <div class="h-8 w-24 bg-gray-700/50 rounded" />
        </div>
      </div>

      {/* ── Account Summary ─────────────────────────────────────── */}
      <div class="bg-[#111827]/80 rounded-lg border border-white/10 overflow-hidden">
        {/* Toolbar */}
        <div class="flex items-center justify-between px-3 py-1.5 border-b border-[rgba(255,255,255,0.05)]">
          <div class="h-4 w-16 bg-gray-700/40 rounded" />
          <div class="h-3 w-24 bg-gray-700/40 rounded" />
        </div>

        {/* Table header */}
        <div class="px-1.5 py-2 border-b border-[rgba(255,255,255,0.05)]">
          <div class="flex gap-1.5">
            <For each={[120, 80, 110, 110, 100, 100]}>
              {(w) => <div class="h-3 bg-gray-700/50 rounded" style={{ width: `${w}px` }} />}
            </For>
          </div>
        </div>

        {/* Summary row */}
        <div class="flex items-center justify-end gap-6 px-3 py-2 border-t border-[rgba(255,255,255,0.05)]">
          <div class="flex items-center gap-1.5">
            <div class="h-3 w-10 bg-gray-700/40 rounded" />
            <div class="h-5 w-20 bg-gray-700/30 rounded" />
          </div>
          <div class="flex items-center gap-1.5">
            <div class="h-3 w-10 bg-gray-700/40 rounded" />
            <div class="h-5 w-20 bg-gray-700/30 rounded" />
          </div>
          <div class="flex items-center gap-1.5">
            <div class="h-3 w-10 bg-gray-700/40 rounded" />
            <div class="h-5 w-20 bg-gray-700/30 rounded" />
          </div>
          <div class="flex items-center gap-1.5">
            <div class="h-3 w-10 bg-gray-700/40 rounded" />
            <div class="h-5 w-20 bg-gray-700/30 rounded" />
          </div>
        </div>
      </div>

      {/* ── Position Table + Charts ─────────────────────────────── */}
      <div class="flex-1 flex overflow-hidden min-h-0 bg-[#111827]/80 rounded-lg border border-white/10">
        {/* Table panel */}
        <div class="flex-1 overflow-hidden border-r border-[rgba(255,255,255,0.05)]">
          {/* Toolbar */}
          <div class="flex items-center justify-between px-3 py-1.5 border-b border-[rgba(255,255,255,0.05)]">
            <div class="flex items-center gap-3">
              <div class="h-5 w-20 bg-gray-700/40 rounded" />
              <div class="h-5 w-24 bg-gray-700/40 rounded" />
            </div>
            <div class="flex items-center gap-2">
              <div class="h-3 w-12 bg-gray-700/40 rounded" />
              <div class="h-5 w-16 bg-gray-700/30 rounded" />
            </div>
          </div>

          {/* Table header */}
          <div class="px-1.5 py-2 border-b border-[rgba(255,255,255,0.05)]">
            <div class="flex gap-1.5">
              <For each={HEADER_WIDTHS}>
                {(w) => <div class="h-3 bg-gray-700/50 rounded" style={{ width: `${w}px` }} />}
              </For>
            </div>
          </div>

          {/* Table rows */}
          <div class="py-1">
            {[...Array(8)].map((_, rowIdx) => (
              <div
                class={`flex gap-1.5 px-1.5 py-1.5 ${rowIdx % 2 === 1 ? 'bg-white/[0.01]' : ''}`}
              >
                <For each={ROW_WIDTHS}>
                  {(w) => <div class="h-4 bg-gray-700/30 rounded" style={{ width: `${w}px` }} />}
                </For>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div class="flex items-center justify-end gap-4 px-3 py-1.5 border-t border-[rgba(255,255,255,0.05)]">
            <div class="h-3 w-12 bg-gray-700/40 rounded" />
            <div class="h-5 w-20 bg-gray-700/30 rounded" />
          </div>
        </div>

        {/* Charts panel */}
        <div class="w-72 shrink-0 flex flex-col overflow-hidden">
          {/* Sector pie skeleton */}
          <div class="flex-1 min-h-0 flex flex-col border-b border-[rgba(255,255,255,0.05)]">
            <div class="px-3 py-1.5 border-b border-[rgba(255,255,255,0.05)]">
              <div class="h-3 w-16 bg-gray-700/40 rounded" />
            </div>
            <div class="flex-1 flex items-center justify-center">
              {/* Animated spinner for chart area */}
              <div class="relative w-24 h-24">
                <div class="absolute inset-0 border-4 border-indigo-500/10 border-t-indigo-500/50 rounded-full animate-spin" />
                <div
                  class="absolute inset-2 border-4 border-purple-500/10 border-b-purple-500/50 rounded-full animate-spin"
                  style={{ 'animation-duration': '1.5s', 'animation-direction': 'reverse' }}
                />
                <div
                  class="absolute inset-4 border-4 border-cyan-500/10 border-t-cyan-500/50 rounded-full animate-spin"
                  style={{ 'animation-duration': '2s' }}
                />
              </div>
            </div>
          </div>

          {/* Weight bar skeleton */}
          <div class="flex-1 min-h-0 flex flex-col">
            <div class="px-3 py-1.5 border-b border-[rgba(255,255,255,0.05)]">
              <div class="h-3 w-24 bg-gray-700/40 rounded" />
            </div>
            <div class="flex-1 flex items-center justify-center">
              {/* Animated shimmer bars */}
              <div class="w-full px-4 flex flex-col justify-end gap-1 h-32">
                <For each={[80, 65, 55, 45, 38, 30, 25, 20, 15, 10, 8, 5]}>
                  {(h) => (
                    <div
                      class="bg-gray-700/30 rounded animate-pulse"
                      style={{
                        height: `${h}px`,
                        width: `${h * 2}px`,
                        'animation-delay': `${Math.random() * 0.5}s`,
                      }}
                    />
                  )}
                </For>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Overlay spinner (extra loading indicator) */}
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div class="flex flex-col items-center gap-2">
          <div class="w-10 h-10 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      </div>
    </div>
  );
};
