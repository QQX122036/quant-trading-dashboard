/**
 * BacktestConfig.tsx — 策略参数配置界面
 * 策略选择、参数滑块、日期范围、初始资金配置
 */
import { Component, createSignal, For, Show } from 'solid-js';
import { apiActions } from '../../stores/apiStore';

const STRATEGIES = [
  { id: 'momentum', name: '动量策略', description: '追涨杀跌，基于近期收益率惯性' },
  { id: 'dual-ma', name: '双均线策略', description: 'MA5 上穿 MA20 买入，下穿卖出' },
  { id: 'boll', name: '布林带策略', description: '价格下破下轨买入，上穿上轨卖出' },
  { id: 'r-breaker', name: 'R-Breaker', description: '日内突破型策略，支撑阻力反转' },
];

interface BacktestConfigProps {
  onRun?: (config: BacktestConfigData) => void;
}

export interface BacktestConfigData {
  strategy: string;
  symbols: string[];
  start_date: string;
  end_date: string;
  initial_capital: number;
  params: Record<string, number>;
}

export const BacktestConfig: Component<BacktestConfigProps> = (props) => {
  const [selectedStrategy, setSelectedStrategy] = createSignal('dual-ma');
  const [symbols, setSymbols] = createSignal<string[]>([]);
  const [symbolInput, setSymbolInput] = createSignal('');
  const [startDate, setStartDate] = createSignal('2024-01-01');
  const [endDate, setEndDate] = createSignal('2025-01-01');
  const [initialCapital, setInitialCapital] = createSignal(1000000);

  // 参数滑块
  const [period1, setPeriod1] = createSignal(5);
  const [period2, setPeriod2] = createSignal(20);
  const [threshold, setThreshold] = createSignal(0.02);
  const [holdDays, setHoldDays] = createSignal(5);
  const [positionPct, setPositionPct] = createSignal(100);

  const addSymbol = (sym: string) => {
    const s = sym.trim().toUpperCase();
    if (s && !symbols().includes(s)) {
      setSymbols([...symbols(), s]);
    }
    setSymbolInput('');
  };

  const removeSymbol = (sym: string) => {
    setSymbols(symbols().filter((s) => s !== sym));
  };

  const handleRun = () => {
    const config: BacktestConfigData = {
      strategy: selectedStrategy(),
      symbols: symbols().length > 0 ? symbols() : ['000001.SH'],
      start_date: startDate(),
      end_date: endDate(),
      initial_capital: initialCapital(),
      params: {
        period1: period1(),
        period2: period2(),
        threshold: threshold(),
        hold_days: holdDays(),
        position_pct: positionPct(),
      },
    };
    props.onRun?.(config);
    apiActions.runBacktest({
      strategy: config.strategy,
      symbols: config.symbols,
      start_date: config.start_date,
      end_date: config.end_date,
    });
  };

  return (
    <div class="flex flex-col gap-4">
      {/* 标的代码 */}
      <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4">
        <h3 class="font-bold mb-3 text-sm text-gray-300">标的代码</h3>
        <div class="flex flex-wrap gap-2 mb-2">
          <For each={symbols()}>
            {(sym) => (
              <span class="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/20 border border-blue-500/40 rounded text-xs text-blue-300">
                {sym}
                <button class="hover:text-white" onClick={() => removeSymbol(sym)}>✕</button>
              </span>
            )}
          </For>
        </div>
        <div class="flex gap-2">
          <input
            type="text"
            class="flex-1 bg-[#0A0E17] border border-white/10 rounded px-3 py-2 text-sm placeholder-gray-500"
            placeholder="输入股票代码，如 600519.SH"
            value={symbolInput()}
            onInput={(e) => setSymbolInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addSymbol(symbolInput()); }}
          />
          <button
            class="px-3 py-2 bg-white/10 hover:bg-white/20 rounded text-sm transition-colors"
            onClick={() => addSymbol(symbolInput())}
          >
            添加
          </button>
        </div>
        <div class="flex flex-wrap gap-1.5 mt-2">
          <For each={['000001.SH', '000300.SH', '600519.SH', '000858.SH']}>
            {(s) => (
              <button
                class="px-2 py-0.5 bg-white/5 hover:bg-white/10 rounded text-xs text-gray-400 transition-colors"
                onClick={() => addSymbol(s)}
              >
                {s}
              </button>
            )}
          </For>
        </div>
      </div>

      {/* 策略选择 */}
      <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4">
        <h3 class="font-bold mb-3 text-sm text-gray-300">策略选择</h3>
        <div class="grid grid-cols-2 gap-2">
          <For each={STRATEGIES}>
            {(s) => (
              <button
                class={`p-3 rounded text-left transition-all ${
                  selectedStrategy() === s.id
                    ? 'bg-blue-600/20 border border-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                    : 'bg-white/5 border border-transparent hover:bg-white/10'
                }`}
                onClick={() => setSelectedStrategy(s.id)}
              >
                <div class="font-bold text-sm">{s.name}</div>
                <div class="text-xs text-gray-400 mt-1">{s.description}</div>
              </button>
            )}
          </For>
        </div>
      </div>

      {/* 参数滑块 */}
      <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4">
        <h3 class="font-bold mb-3 text-sm text-gray-300">策略参数</h3>
        <div class="space-y-4">
          {/* 周期1 */}
          <div>
            <div class="flex justify-between text-xs mb-1">
              <span class="text-gray-400">周期1 (短期)</span>
              <span class="text-blue-400 font-mono">{period1()} 天</span>
            </div>
            <input
              type="range" min="2" max="60" step="1"
              class="w-full accent-blue-500"
              value={period1()}
              onInput={(e) => setPeriod1(Number(e.target.value))}
            />
          </div>
          {/* 周期2 */}
          <div>
            <div class="flex justify-between text-xs mb-1">
              <span class="text-gray-400">周期2 (长期)</span>
              <span class="text-blue-400 font-mono">{period2()} 天</span>
            </div>
            <input
              type="range" min="5" max="120" step="1"
              class="w-full accent-blue-500"
              value={period2()}
              onInput={(e) => setPeriod2(Number(e.target.value))}
            />
          </div>
          {/* 阈值 */}
          <div>
            <div class="flex justify-between text-xs mb-1">
              <span class="text-gray-400">信号阈值</span>
              <span class="text-blue-400 font-mono">{(threshold() * 100).toFixed(1)}%</span>
            </div>
            <input
              type="range" min="0" max="0.1" step="0.001"
              class="w-full accent-blue-500"
              value={threshold()}
              onInput={(e) => setThreshold(Number(e.target.value))}
            />
          </div>
          {/* 持仓天数 */}
          <div>
            <div class="flex justify-between text-xs mb-1">
              <span class="text-gray-400">持仓天数</span>
              <span class="text-blue-400 font-mono">{holdDays()} 天</span>
            </div>
            <input
              type="range" min="1" max="30" step="1"
              class="w-full accent-blue-500"
              value={holdDays()}
              onInput={(e) => setHoldDays(Number(e.target.value))}
            />
          </div>
          {/* 仓位比例 */}
          <div>
            <div class="flex justify-between text-xs mb-1">
              <span class="text-gray-400">仓位比例</span>
              <span class="text-blue-400 font-mono">{positionPct()}%</span>
            </div>
            <input
              type="range" min="10" max="100" step="5"
              class="w-full accent-blue-500"
              value={positionPct()}
              onInput={(e) => setPositionPct(Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      {/* 日期范围 & 资金 */}
      <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4">
        <h3 class="font-bold mb-3 text-sm text-gray-300">回测设置</h3>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-gray-400 mb-1">开始日期</label>
            <input
              type="date"
              class="w-full bg-[#0A0E17] border border-white/10 rounded px-3 py-2 text-sm"
              value={startDate()}
              onInput={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label class="block text-xs text-gray-400 mb-1">结束日期</label>
            <input
              type="date"
              class="w-full bg-[#0A0E17] border border-white/10 rounded px-3 py-2 text-sm"
              value={endDate()}
              onInput={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
        <div class="mt-3">
          <label class="block text-xs text-gray-400 mb-1">初始资金 (元)</label>
          <input
            type="number"
            class="w-full bg-[#0A0E17] border border-white/10 rounded px-3 py-2 text-sm"
            value={initialCapital()}
            onInput={(e) => setInitialCapital(Number(e.target.value))}
          />
        </div>
      </div>

      {/* 开始回测按钮 */}
      <button
        class="w-full py-3 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 font-bold text-sm transition-all shadow-[0_0_20px_rgba(59,130,246,0.4)]"
        onClick={handleRun}
      >
        🚀 开始回测
      </button>
    </div>
  );
};
