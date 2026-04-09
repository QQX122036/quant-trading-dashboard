/**
 * BacktestSkeleton.tsx — 回测分析页面骨架屏
 * 用于 BacktestAnalysis 懒加载时的加载状态
 */
import { Component } from 'solid-js';

export const BacktestSkeleton: Component = () => {
  return (
    <div class="h-full flex flex-col p-4 gap-4 overflow-hidden">
      {/* Header */}
      <div class="flex items-center justify-between shrink-0 animate-pulse">
        <div class="h-6 w-32 bg-gray-700/50 rounded" />
        <div class="h-8 w-24 bg-gray-700/50 rounded" />
      </div>

      {/* Primary metrics */}
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 shrink-0">
        {[...Array(4)].map(() => (
          <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4">
            <div class="h-3 w-20 bg-gray-700/50 rounded mb-2" />
            <div class="h-8 w-24 bg-gray-700/50 rounded" />
          </div>
        ))}
      </div>

      {/* Secondary metrics */}
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 shrink-0">
        {[...Array(4)].map(() => (
          <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4">
            <div class="h-3 w-20 bg-gray-700/50 rounded mb-2" />
            <div class="h-7 w-20 bg-gray-700/50 rounded" />
          </div>
        ))}
      </div>

      {/* Equity curve chart */}
      <div class="flex-1 bg-[#111827]/80 rounded-lg border border-white/10 p-4 min-h-[240px] shrink-0 animate-pulse">
        <div class="h-4 w-24 bg-gray-700/50 rounded mb-4" />
        <div class="flex-1 flex items-center justify-center">
          <div class="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      </div>

      {/* Drawdown + Monthly */}
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 shrink-0" style={{ 'min-height': '220px' }}>
        {[...Array(2)].map(() => (
          <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4 animate-pulse">
            <div class="h-4 w-24 bg-gray-700/50 rounded mb-4" />
            <div class="flex items-center justify-center" style={{ 'min-height': '180px' }}>
              <div class="w-10 h-10 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
