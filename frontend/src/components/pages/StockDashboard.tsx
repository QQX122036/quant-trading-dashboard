import { Component, createSignal, Show } from 'solid-js';
import { KlineChart } from '../charts/KlineChart';
import { IndicatorChart } from '../charts/IndicatorChart';
import { TickMonitor } from '../monitors/TickMonitor';
import { PositionMonitor } from '../monitors/PositionMonitor';
import { AccountMonitor } from '../monitors/AccountMonitor';
import { CustomIndicatorEditor } from '../dialogs/CustomIndicatorEditor';
import type { DailyBar } from '../../hooks/useApi';

type Indicator = 'MACD' | 'RSI' | 'KDJ' | 'BOLL';

export const StockDashboard: Component = () => {
  const [activeIndicator, setActiveIndicator] = createSignal<Indicator>('MACD');
  const [showCustomEditor, setShowCustomEditor] = createSignal(false);
  // K线数据由KlineChart内部管理，这里透传空数组让KlineChart自行加载
  // 如果KlineChart需要暴露bars给CustomIndicatorEditor，可通过共享信号实现
  const [klineBars, setKlineBars] = createSignal<DailyBar[]>([]);

  return (
    <div class="h-full flex flex-col p-4 gap-4">
      {/* Top Section: Tick Monitor + KLine Chart */}
      <div class="flex-1 flex gap-4 min-h-0">
        {/* Left: Tick Monitor */}
        <div class="w-80 flex flex-col bg-[#111827]/80 rounded-lg border border-white/10">
          <div class="px-4 py-3 border-b border-white/10">
            <h2 class="font-bold">行情监控</h2>
          </div>
          <div class="flex-1 overflow-auto">
            <TickMonitor />
          </div>
        </div>

        {/* Right: KLine Chart + Indicators */}
        <div class="flex-1 flex flex-col bg-[#111827]/80 rounded-lg border border-white/10">
          {/* Chart Header */}
          <div class="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <h2 class="font-bold">K线图表 - 600519 贵州茅台</h2>
            <div class="flex gap-2">
              <button class="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20">日线</button>
              <button class="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20">周线</button>
              <button class="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20">月线</button>
            </div>
          </div>

          {/* Main KLine Chart */}
          <div class="flex-1 p-2 min-h-[200px]">
            <KlineChart
              onOpenCustomIndicatorEditor={() => setShowCustomEditor(true)}
              onBarsLoaded={(bars) => setKlineBars(bars)}
            />
          </div>

          {/* Technical Indicators */}
          <div class="h-40 border-t border-white/10">
            {/* Indicator tabs */}
            <div class="flex items-center gap-1 p-2 border-b border-white/5">
              <button
                class={`px-2 py-1 text-xs rounded ${activeIndicator() === 'MACD' ? 'bg-blue-600' : 'bg-white/10 hover:bg-white/20'}`}
                onClick={() => setActiveIndicator('MACD')}
              >
                MACD
              </button>
              <button
                class={`px-2 py-1 text-xs rounded ${activeIndicator() === 'RSI' ? 'bg-blue-600' : 'bg-white/10 hover:bg-white/20'}`}
                onClick={() => setActiveIndicator('RSI')}
              >
                RSI
              </button>
              <button
                class={`px-2 py-1 text-xs rounded ${activeIndicator() === 'KDJ' ? 'bg-blue-600' : 'bg-white/10 hover:bg-white/20'}`}
                onClick={() => setActiveIndicator('KDJ')}
              >
                KDJ
              </button>
              <button
                class={`px-2 py-1 text-xs rounded ${activeIndicator() === 'BOLL' ? 'bg-blue-600' : 'bg-white/10 hover:bg-white/20'}`}
                onClick={() => setActiveIndicator('BOLL')}
              >
                BOLL
              </button>
            </div>
            {/* Indicator Chart */}
            <div class="h-[calc(100%-36px)] p-2">
              <IndicatorChart type={activeIndicator()} />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Position + Account */}
      <div class="h-48 flex gap-4">
        <div class="flex-1 bg-[#111827]/80 rounded-lg border border-white/10">
          <div class="px-4 py-3 border-b border-white/10">
            <h2 class="font-bold">持仓监控</h2>
          </div>
          <div class="p-2 overflow-auto h-[calc(100%-48px)]">
            <PositionMonitor />
          </div>
        </div>

        <div class="w-96 bg-[#111827]/80 rounded-lg border border-white/10">
          <div class="px-4 py-3 border-b border-white/10">
            <h2 class="font-bold">资金监控</h2>
          </div>
          <div class="p-2">
            <AccountMonitor />
          </div>
        </div>
      </div>

      {/* 自定义指标编辑器 */}
      <Show when={showCustomEditor()}>
        <CustomIndicatorEditor
          bars={klineBars()}
          onClose={() => setShowCustomEditor(false)}
        />
      </Show>
    </div>
  );
};
