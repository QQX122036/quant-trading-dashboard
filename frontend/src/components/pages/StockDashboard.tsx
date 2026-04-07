import { Component, createSignal, Show, createEffect } from 'solid-js';
import { KlineChart } from '../charts/KlineChart';
import { IndicatorChart } from '../charts/IndicatorChart';
import { TickMonitor } from '../monitors/TickMonitor';
import { PositionMonitor } from '../monitors/PositionMonitor';
import { AccountMonitor } from '../monitors/AccountMonitor';
import { CustomIndicatorEditor } from '../dialogs/CustomIndicatorEditor';
import { apiFetch } from '../../hooks/useApi';
import type { DailyBar, KLineBar } from '../../hooks/useApi';

type Indicator = 'MACD' | 'RSI' | 'KDJ' | 'BOLL';

interface StockBasicItem {
  ts_code: string;
  name: string;
  market: string;
  industry: string;
}

// 缓存已查询过的股票名称，减少API调用
const stockNameCache: Record<string, string> = {};

export const StockDashboard: Component = () => {
  const [activeIndicator, setActiveIndicator] = createSignal<Indicator>('MACD');
  const [showCustomEditor, setShowCustomEditor] = createSignal(false);
  const [klineBars, setKlineBars] = createSignal<DailyBar[]>([]);
  const [symbol, setSymbol] = createSignal('600519');
  const [exchange, setExchange] = createSignal('SSE');
  const [stockName, setStockName] = createSignal('贵州茅台');
  const [searchValue, setSearchValue] = createSignal('600519');
  const [searchLoading, setSearchLoading] = createSignal(false);
  const [searchError, setSearchError] = createSignal('');

  // 通过 API 获取股票名称（支持所有 A 股）
  const fetchStockName = async (code: string): Promise<string> => {
    if (stockNameCache[code]) return stockNameCache[code];
    try {
      const tsCode = code.startsWith('6') ? `${code}.SH` : `${code}.SZ`;
      const res = await apiFetch<{ items: StockBasicItem[] }>(`/api/data/stock-basic?ts_code=${tsCode}&limit=1`);
      if ((!res.code || res.code === '0' || res.code === 0) && res.data?.items?.length) {
        const name = res.data.items[0].name;
        stockNameCache[code] = name;
        return name;
      }
    } catch {}
    return '未知股票';
  };

  const handleSearch = async () => {
    const code = searchValue().trim();
    if (!code) return;
    setSearchLoading(true);
    setSearchError('');

    const newExchange = code.startsWith('6') ? 'SSE' : 'SZSE';
    setSymbol(code);
    setExchange(newExchange);

    // 优先从缓存获取，否则调 API
    const cachedName = stockNameCache[code];
    if (cachedName) {
      setStockName(cachedName);
    } else {
      const name = await fetchStockName(code);
      setStockName(name);
    }
    setSearchLoading(false);
    // 清除 klineBars，确保 KlineChart 重新从 API 加载数据
    setKlineBars([]);
  };

  // 初始加载默认股票名称
  createEffect(() => {
    const sym = symbol();
    if (stockNameCache[sym]) {
      setStockName(stockNameCache[sym]);
    } else {
      fetchStockName(sym).then(setStockName);
    }
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
                  onInput={(e) => { setSearchValue(e.currentTarget.value); setSearchError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  class="px-2 py-1 text-xs rounded bg-white/10 text-gray-300 border border-white/20 w-24"
                  placeholder="代码"
                />
                <Show when={searchLoading()}>
                  <span class="text-xs text-gray-400 animate-spin">⟳</span>
                </Show>
                <Show when={!searchLoading() && searchValue()}>
                  <button
                    class="px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={handleSearch}
                  >
                    搜索
                  </button>
                </Show>
                <Show when={searchError()}>
                  <span class="text-xs text-red-400">{searchError()}</span>
                </Show>
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
                bars={klineBars() as DailyBar[]} 
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
