import { Component } from 'solid-js';
import { OrderMonitor } from '../monitors/OrderMonitor';
import { TradeMonitor } from '../monitors/TradeMonitor';

export const TradeLog: Component = () => {
  return (
    <div class="h-full flex flex-col p-4 gap-4">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold">交易监控</h2>
      </div>

      {/* 委托监控 */}
      <div class="flex-1 bg-[#111827]/80 rounded-lg border border-white/10 overflow-hidden">
        <OrderMonitor />
      </div>

      {/* 成交监控 */}
      <div class="h-64 bg-[#111827]/80 rounded-lg border border-white/10 overflow-hidden">
        <TradeMonitor />
      </div>
    </div>
  );
};
