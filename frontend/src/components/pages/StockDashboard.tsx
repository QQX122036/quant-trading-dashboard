import { Component, createSignal, Show, createEffect } from 'solid-js';
import { KlineChart } from '../charts/KlineChart';
import { IndicatorChart } from '../charts/IndicatorChart';
import { TickMonitor } from '../monitors/TickMonitor';
import { PositionMonitor } from '../monitors/PositionMonitor';
import { AccountMonitor } from '../monitors/AccountMonitor';
import { CustomIndicatorEditor } from '../dialogs/CustomIndicatorEditor';
import type { DailyBar } from '../../hooks/useApi';

type Indicator = 'MACD' | 'RSI' | 'KDJ' | 'BOLL';

// 简单的股票代码到名称的映射
const stockNameMap: Record<string, string> = {
  '600519': '贵州茅台',
  '000001': '平安银行',
  '300724': '捷佳伟创',
  '000002': '万科A',
  '000858': '五粮液',
  '601318': '中国平安',
  '600036': '招商银行',
  '601888': '中国中免',
  '600276': '恒瑞医药',
  '601668': '中国建筑'
};

export const StockDashboard: Component = () => {
  const [activeIndicator, setActiveIndicator] = createSignal<Indicator>('MACD');
  const [showCustomEditor, setShowCustomEditor] = createSignal(false);
  const [klineBars, setKlineBars] = createSignal<DailyBar[]>([]);
  const [symbol, setSymbol] = createSignal('600519');
  const [exchange, setExchange] = createSignal('SSE');
  const [stockName, setStockName] = createSignal('贵州茅台');
  const [searchValue, setSearchValue] = createSignal('600519');

  const handleSearch = () => {
    const code = searchValue();
    setSymbol(code);
    // 根据股票代码自动设置交易所：6开头是上海，0开头是深圳
    const newExchange = code.startsWith('6') ? 'SSE' : 'SZSE';
    setExchange(newExchange);
    // 设置股票名称
    setStockName(stockNameMap[code] || '未知股票');
    // 清除klineBars，确保KlineChart重新从API加载数据
    setKlineBars([]);
  };

  // 初始设置股票名称
  createEffect(() => {
    setStockName(stockNameMap[symbol()] || '未知股票');
  });

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
            <div class="flex items-center gap-4">
              <h2 class="font-bold">K线图表 - {symbol()} {stockName()} {exchange() === 'SSE' ? '上海' : exchange() === 'SZSE' ? '深圳' : ''}</h2>
              <div class="flex items-center gap-2">
                <input
                  type="text"
                  value={searchValue()}
                  onChange={(e) => setSearchValue(e.currentTarget.value)}
                  class="px-2 py-1 text-xs rounded bg-white/10 text-gray-300 border border-white/20"
                  placeholder="输入股票代码"
                />
                <button
                  class="px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleSearch}
                >
                  搜索
                </button>
              </div>
            </div>
            <div class="flex gap-2">
              <button class="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20">日线</button>
              <button class="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20">周线</button>
              <button class="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20">月线</button>
            </div>
          </div>

          {/* Main KLine Chart */}
          <div class="flex-1 p-2 min-h-[200px]">
            <KlineChart
              symbol={symbol()}
              exchange={exchange()}
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
              <IndicatorChart 
                type={activeIndicator()} 
                bars={klineBars()} 
                symbol={symbol()} 
                exchange={exchange()} 
              />
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
