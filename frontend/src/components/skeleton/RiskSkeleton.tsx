import { Component } from 'solid-js';

export const RiskSkeleton: Component = () => {
  return (
    <div style={{ padding: '24px', 'max-width': '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div class="flex justify-between items-center mb-6 animate-pulse">
        <div>
          <div class="h-8 w-48 bg-gray-700/50 rounded mb-2" />
          <div class="h-4 w-64 bg-gray-700/50 rounded" />
        </div>
        <div class="h-10 w-24 bg-gray-700/50 rounded" />
      </div>

      {/* Tabs */}
      <div class="flex gap-1 mb-5 bg-[#1a1a1a] p-1 rounded-lg w-fit animate-pulse">
        {[...Array(5)].map(() => (
          <div class="h-9 w-24 bg-gray-700/50 rounded" />
        ))}
      </div>

      {/* Content */}
      <div class="flex flex-col gap-4">
        {/* VaR Card */}
        <div class="bg-[#141414] rounded-xl p-5 border border-[#303030] animate-pulse">
          <div class="flex justify-between items-center mb-4">
            <div class="h-5 w-32 bg-gray-700/50 rounded" />
            <div class="h-8 w-16 bg-gray-700/50 rounded" />
          </div>
          <div class="grid grid-cols-3 gap-3">
            {[...Array(6)].map(() => (
              <div class="bg-[#1e1e1e] p-3 rounded-lg">
                <div class="h-3 w-16 bg-gray-700/50 rounded mb-2" />
                <div class="h-5 w-20 bg-gray-700/50 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Max Drawdown Card */}
        <div class="bg-[#141414] rounded-xl p-5 border border-[#303030] animate-pulse">
          <div class="flex justify-between items-center mb-4">
            <div class="h-5 w-40 bg-gray-700/50 rounded" />
            <div class="h-8 w-16 bg-gray-700/50 rounded" />
          </div>
          <div class="grid grid-cols-3 gap-3">
            {[...Array(6)].map(() => (
              <div class="bg-[#1e1e1e] p-3 rounded-lg">
                <div class="h-3 w-16 bg-gray-700/50 rounded mb-2" />
                <div class="h-5 w-20 bg-gray-700/50 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Sector HHI Card */}
        <div class="bg-[#141414] rounded-xl p-5 border border-[#303030] animate-pulse">
          <div class="flex justify-between items-center mb-4">
            <div class="h-5 w-36 bg-gray-700/50 rounded" />
            <div class="h-8 w-12 bg-gray-700/50 rounded" />
          </div>
          <div class="grid grid-cols-5 gap-2">
            {[...Array(10)].map(() => (
              <div class="bg-[#1e1e1e] p-2 rounded-lg text-center" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
