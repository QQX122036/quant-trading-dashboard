import { Component, createSignal, createEffect, For, Show, onMount, onCleanup } from 'solid-js';
import { apiState, apiActions, setApiState } from '../../stores/apiStore';
import { getBacktestResult, fetchBacktestStrategies } from '../../hooks/useApi';

interface StrategyParamDef {
  label: string;
  min: number;
  max: number;
  default: number;
  step: number;
}

interface StrategyDef {
  name: string;
  description: string;
  params: Record<string, StrategyParamDef>;
}

interface BacktestConfigProps {
  onRun?: (config: BacktestConfigData) => void;
  onViewResult?: () => void;
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
  const ctrl = new AbortController();
  onCleanup(() => ctrl.abort());
  onMount(() => {
    apiActions.fetchBacktestTasks();
    loadStrategies();
  });

  const [strategyDefs, setStrategyDefs] = createSignal<Record<string, StrategyDef>>({});
  const [selectedStrategy, setSelectedStrategy] = createSignal('dual-ma');
  const [symbols, setSymbols] = createSignal<string[]>([]);
  const [symbolInput, setSymbolInput] = createSignal('');
  const [startDate, setStartDate] = createSignal('2024-01-01');
  const [endDate, setEndDate] = createSignal('2025-01-01');
  const [initialCapital, setInitialCapital] = createSignal(1000000);
  const [paramValues, setParamValues] = createSignal<Record<string, number>>({});

  const loadStrategies = async () => {
    try {
      const res = await fetchBacktestStrategies();
      if (res.data?.strategies) {
        setStrategyDefs(res.data.strategies as Record<string, StrategyDef>);
        const firstKey = Object.keys(res.data.strategies)[0];
        if (firstKey) setSelectedStrategy(firstKey);
      }
    } catch (e) {
      console.warn('[BacktestConfig] 策略列表加载失败，使用默认:', e);
      setStrategyDefs({
        momentum: {
          name: '动量策略',
          description: '追涨杀跌，基于近期收益率惯性',
          params: {
            period1: { label: '回望周期', min: 2, max: 60, default: 5, step: 1 },
            threshold: { label: '信号阈值', min: 0, max: 0.1, default: 0.0, step: 0.001 },
            hold_days: { label: '持仓天数', min: 1, max: 30, default: 5, step: 1 },
            position_pct: { label: '仓位比例%', min: 10, max: 100, default: 100, step: 5 },
          },
        },
        'dual-ma': {
          name: '双均线策略',
          description: 'MA金叉做多，死叉做空',
          params: {
            period1: { label: '短均线周期', min: 2, max: 60, default: 5, step: 1 },
            period2: { label: '长均线周期', min: 5, max: 120, default: 20, step: 1 },
            position_pct: { label: '仓位比例%', min: 10, max: 100, default: 100, step: 5 },
          },
        },
        boll: {
          name: '布林带策略',
          description: '价格下破下轨买入，上穿上轨卖出',
          params: {
            period1: { label: '布林周期', min: 5, max: 60, default: 20, step: 1 },
            threshold: { label: '标准差倍数', min: 1.0, max: 3.0, default: 2.0, step: 0.1 },
            position_pct: { label: '仓位比例%', min: 10, max: 100, default: 100, step: 5 },
          },
        },
        'r-breaker': {
          name: 'R-Breaker策略',
          description: '日内突破型策略，支撑阻力反转',
          params: {
            threshold: { label: '突破系数', min: 0.1, max: 0.7, default: 0.35, step: 0.05 },
            position_pct: { label: '仓位比例%', min: 10, max: 100, default: 100, step: 5 },
          },
        },
      });
    }
  };

  createEffect(() => {
    const sKey = selectedStrategy();
    const defs = strategyDefs();
    const sDef = defs[sKey];
    if (!sDef) return;
    const newParams: Record<string, number> = {};
    for (const [pk, pdef] of Object.entries(sDef.params)) {
      newParams[pk] = pdef.default;
    }
    setParamValues(newParams);
  });

  const updateParam = (key: string, val: number) => {
    setParamValues((prev) => ({ ...prev, [key]: val }));
  };

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
      symbols: symbols().length > 0 ? symbols() : ['000001.SZ'],
      start_date: startDate(),
      end_date: endDate(),
      initial_capital: initialCapital(),
      params: { ...paramValues() },
    };
    props.onRun?.(config);
  };

  const currentParams = () => {
    const sKey = selectedStrategy();
    const sDef = strategyDefs()[sKey];
    return sDef ? Object.entries(sDef.params) : [];
  };

  const formatValue = (val: number, step: number): string => {
    if (step >= 1) return String(Math.round(val));
    if (step >= 0.1) return val.toFixed(1);
    if (step >= 0.01) return val.toFixed(2);
    return val.toFixed(3);
  };

  return (
    <div class="flex flex-col gap-4">
      <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4">
        <h3 class="font-bold mb-3 text-sm text-gray-300">标的代码</h3>
        <div class="flex flex-wrap gap-2 mb-2">
          <For each={symbols()}>
            {(sym) => (
              <span class="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/20 border border-blue-500/40 rounded text-xs text-blue-300">
                {sym}
                <button class="hover:text-white" onClick={() => removeSymbol(sym)}>
                  ✕
                </button>
              </span>
            )}
          </For>
        </div>
        <div class="flex gap-2">
          <input
            id="bt-symbol"
            type="text"
            class="flex-1 bg-[#0A0E17] border border-white/10 rounded px-3 py-2 text-sm placeholder-gray-500"
            placeholder="输入股票代码，如 600519.SH"
            value={symbolInput()}
            onInput={(e) => setSymbolInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addSymbol(symbolInput());
            }}
            aria-label="回测标的股票代码"
          />
          <button
            class="px-3 py-2 bg-white/10 hover:bg-white/20 rounded text-sm transition-colors"
            onClick={() => addSymbol(symbolInput())}
          >
            添加
          </button>
        </div>
        <div class="flex flex-wrap gap-1.5 mt-2">
          <For each={['000001.SZ', '000300.SH', '600519.SH', '000858.SZ']}>
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

      <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4">
        <h3 class="font-bold mb-3 text-sm text-gray-300">策略选择</h3>
        <div class="grid grid-cols-2 gap-2">
          <For each={Object.entries(strategyDefs())}>
            {([id, s]) => (
              <button
                class={`p-3 rounded text-left transition-all ${
                  selectedStrategy() === id
                    ? 'bg-blue-600/20 border border-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                    : 'bg-white/5 border border-transparent hover:bg-white/10'
                }`}
                onClick={() => setSelectedStrategy(id)}
              >
                <div class="font-bold text-sm">{s.name}</div>
                <div class="text-xs text-gray-400 mt-1">{s.description}</div>
              </button>
            )}
          </For>
        </div>
      </div>

      <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4">
        <h3 class="font-bold mb-3 text-sm text-gray-300">策略参数</h3>
        <Show
          when={currentParams().length > 0}
          fallback={<div class="text-xs text-gray-500">选择策略后显示参数</div>}
        >
          <div class="space-y-4">
            <For each={currentParams()}>
              {([key, def]) => (
                <div>
                  <div class="flex justify-between text-xs mb-1">
                    <span class="text-gray-400">{def.label}</span>
                    <span class="text-blue-400 font-mono">
                      {formatValue(paramValues()[key] ?? def.default, def.step)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={def.min}
                    max={def.max}
                    step={def.step}
                    class="w-full accent-blue-500"
                    value={paramValues()[key] ?? def.default}
                    onInput={(e) => updateParam(key, Number(e.target.value))}
                  />
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4">
        <h3 class="font-bold mb-3 text-sm text-gray-300">回测设置</h3>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-gray-400 mb-1" for="bt-start-date">
              开始日期
            </label>
            <input
              id="bt-start-date"
              type="date"
              class="w-full bg-[#0A0E17] border border-white/10 rounded px-3 py-2 text-sm"
              value={startDate()}
              onInput={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label class="block text-xs text-gray-400 mb-1" for="bt-end-date">
              结束日期
            </label>
            <input
              id="bt-end-date"
              type="date"
              class="w-full bg-[#0A0E17] border border-white/10 rounded px-3 py-2 text-sm"
              value={endDate()}
              onInput={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
        <div class="mt-3">
          <label class="block text-xs text-gray-400 mb-1" for="bt-capital">
            初始资金 (元)
          </label>
          <input
            id="bt-capital"
            type="number"
            class="w-full bg-[#0A0E17] border border-white/10 rounded px-3 py-2 text-sm"
            value={initialCapital()}
            onInput={(e) => setInitialCapital(Number(e.target.value))}
            aria-label="回测初始资金"
          />
        </div>
      </div>

      <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4">
        <div class="flex justify-between items-center mb-3">
          <h3 class="font-bold text-sm text-gray-300">📜 回测记录</h3>
          <button
            class="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            onClick={() => apiActions.fetchBacktestTasks()}
          >
            🔄 刷新
          </button>
        </div>
        <div class="space-y-2 max-h-48 overflow-y-auto">
          <For each={apiState.backtestTasks.slice(0, 10)}>
            {(task) => (
              <div
                class="flex justify-between items-center bg-[#0A0E17] rounded px-3 py-2 text-xs cursor-pointer hover:bg-white/5 transition-colors"
                onClick={async () => {
                  if (task.status !== 'completed') return;
                  try {
                    const res = await getBacktestResult(task.task_id);
                    if (res.data) {
                      setApiState('backtestResult', res.data as any);
                      if (props.onViewResult) props.onViewResult();
                    }
                  } catch (e) {
                    console.error('[BacktestConfig] 加载历史结果失败:', e);
                  }
                }}
              >
                <div>
                  <span class="text-gray-300 font-mono">{task.task_id?.slice(0, 12)}...</span>
                  <span class="ml-2 text-gray-500">{task.message || task.status}</span>
                </div>
                <span
                  class={`px-2 py-0.5 rounded text-xs ${task.status === 'completed' ? 'bg-green-500/20 text-green-400' : task.status === 'failed' ? 'bg-red-500/20 text-red-400' : task.status === 'running' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'}`}
                >
                  {task.status === 'completed'
                    ? '✅ 完成'
                    : task.status === 'failed'
                      ? '❌ 失败'
                      : task.status === 'running'
                        ? '🔄 运行'
                        : '⏳ 待处理'}
                </span>
              </div>
            )}
          </For>
          <Show when={apiState.backtestTasks.length === 0}>
            <div class="text-center text-gray-500 text-xs py-4">暂无回测记录</div>
          </Show>
        </div>
      </div>

      <button
        class="w-full py-3 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 font-bold text-sm transition-all shadow-[0_0_20px_rgba(59,130,246,0.4)]"
        onClick={handleRun}
      >
        🚀 开始回测
      </button>
    </div>
  );
};
