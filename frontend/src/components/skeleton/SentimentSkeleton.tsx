import { Component } from 'solid-js';

export const SentimentSkeleton: Component = () => {
  return (
    <div class="h-full overflow-auto bg-[#0A0E17]">
      {/* Sticky header */}
      <div class="sticky top-0 z-10 bg-[#0A0E17]/90 backdrop-blur-sm border-b border-white/5 px-4 py-3 flex items-center justify-between shrink-0 animate-pulse">
        <div class="flex items-center gap-3">
          <div class="h-5 w-36 bg-gray-700/50 rounded" />
          <div class="h-4 w-24 bg-gray-700/50 rounded" />
        </div>
        <div class="h-8 w-32 bg-gray-700/50 rounded" />
      </div>

      <div class="p-4 space-y-4">
        {/* Sentiment Gauge */}
        <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-6 animate-pulse">
          <div class="flex items-center justify-between mb-4">
            <div class="h-6 w-48 bg-gray-700/50 rounded" />
            <div class="h-16 w-16 bg-gray-700/50 rounded-full" />
          </div>
          <div class="grid grid-cols-3 gap-4">
            {[...Array(3)].map(() => (
              <div class="h-16 bg-gray-700/50 rounded-lg" />
            ))}
          </div>
        </div>

        {/* Trend + Compare */}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(2)].map(() => (
            <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4 animate-pulse">
              <div class="h-4 w-32 bg-gray-700/50 rounded mb-4" />
              <div class="h-48 bg-gray-700/30 rounded flex items-center justify-center">
                <div class="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
              </div>
            </div>
          ))}
        </div>

        {/* Heatmap */}
        <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4 animate-pulse">
          <div class="h-4 w-32 bg-gray-700/50 rounded mb-4" />
          <div class="grid grid-cols-7 gap-1">
            {[...Array(28)].map(() => (
              <div class="h-8 bg-gray-700/50 rounded" />
            ))}
          </div>
        </div>

        {/* Money Flow */}
        <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4 animate-pulse">
          <div class="h-4 w-32 bg-gray-700/50 rounded mb-4" />
          <div class="h-40 bg-gray-700/30 rounded" />
        </div>
      </div>
    </div>
  );
};
