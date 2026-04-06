import { Component } from 'solid-js';
import { PositionMonitor } from '../monitors/PositionMonitor';
import { AccountMonitor } from '../monitors/AccountMonitor';

export const PositionManagement: Component = () => {
  return (
    <div class="h-full flex flex-col p-4 gap-4">
      {/* Header */}
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold">持仓管理</h2>
        <div class="flex gap-2">
          <button class="px-4 py-2 text-sm rounded bg-white/10 hover:bg-white/20">全部平仓</button>
          <button class="px-4 py-2 text-sm rounded bg-white/10 hover:bg-white/20">导出CSV</button>
        </div>
      </div>

      {/* Account Summary */}
      <div class="bg-[#111827]/80 rounded-lg border border-white/10 overflow-hidden">
        <AccountMonitor />
      </div>

      {/* Position Table */}
      <div class="flex-1 bg-[#111827]/80 rounded-lg border border-white/10 overflow-hidden">
        <PositionMonitor />
      </div>
    </div>
  );
};
