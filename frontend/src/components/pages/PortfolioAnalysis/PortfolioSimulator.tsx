/**
 * PortfolioSimulator.tsx — 模拟调仓组件
 * 功能：权重滑块、实时计算组合指标、对比当前/模拟组合、调仓建议
 */
import { Component, createSignal, createMemo, For, Show } from 'solid-js';
import { formatPercent } from '@/utils/format';

// ── Types ───────────────────────────────────────────────────────────────────

interface StockData {
  symbol: string;
  name: string;
  currentWeight: number; // 当前权重 (0-100)
  expectedReturn: number; // 年化预期收益 (e.g. 0.15 = 15%)
  volatility: number; // 年化波动率
  sharpe: number; // 夏普比率
}

interface RebalanceSuggestion {
  symbol: string;
  name: string;
  currentWeight: number;
  targetWeight: number;
  diff: number; // target - current
  action: 'increase' | 'decrease' | 'unchanged';
}

// 协方差矩阵的简化为相关矩阵（对角线为波动率平方，简化版）
// 真实场景应从后端获取完整协方差矩阵

const RISK_FREE_RATE = 0.03; // 无风险利率 3%

// ── Mock 当前持仓数据 ────────────────────────────────────────────────────────
// 真实场景从 apiStore / hooks/useApi 获取
const INITIAL_STOCKS: StockData[] = [
  {
    symbol: '000001',
    name: '平安银行',
    currentWeight: 20,
    expectedReturn: 0.12,
    volatility: 0.25,
    sharpe: 0.36,
  },
  {
    symbol: '000002',
    name: '万科A',
    currentWeight: 15,
    expectedReturn: 0.08,
    volatility: 0.3,
    sharpe: 0.17,
  },
  {
    symbol: '600036',
    name: '招商银行',
    currentWeight: 25,
    expectedReturn: 0.14,
    volatility: 0.22,
    sharpe: 0.5,
  },
  {
    symbol: '600519',
    name: '贵州茅台',
    currentWeight: 30,
    expectedReturn: 0.18,
    volatility: 0.28,
    sharpe: 0.54,
  },
  {
    symbol: '601318',
    name: '中国平安',
    currentWeight: 10,
    expectedReturn: 0.1,
    volatility: 0.24,
    sharpe: 0.29,
  },
];

// 简化协方差矩阵（基于5只股票的相关性估算）
// [平安银行, 万科A, 招商银行, 贵州茅台, 中国平安]
const CORRELATION_MATRIX: number[][] = [
  [1.0, 0.45, 0.65, 0.3, 0.55],
  [0.45, 1.0, 0.4, 0.25, 0.5],
  [0.65, 0.4, 1.0, 0.35, 0.6],
  [0.3, 0.25, 0.35, 1.0, 0.4],
  [0.55, 0.5, 0.6, 0.4, 1.0],
];

// ── 计算函数 ─────────────────────────────────────────────────────────────────

function calcPortfolioReturn(stocks: StockData[], weights: number[]): number {
  return stocks.reduce((sum, s, i) => sum + (weights[i] / 100) * s.expectedReturn, 0);
}

function calcPortfolioVolatility(stocks: StockData[], weights: number[]): number {
  // σ_p = sqrt(Σ_i Σ_j w_i w_j σ_i σ_j ρ_ij)
  let variance = 0;
  for (let i = 0; i < stocks.length; i++) {
    for (let j = 0; j < stocks.length; j++) {
      const wi = weights[i] / 100;
      const wj = weights[j] / 100;
      const si = stocks[i].volatility;
      const sj = stocks[j].volatility;
      const rho = CORRELATION_MATRIX[i]?.[j] ?? 0;
      variance += wi * wj * si * sj * rho;
    }
  }
  return Math.sqrt(Math.max(variance, 0));
}

function calcSharpe(expectedReturn: number, volatility: number): number {
  if (volatility === 0) return 0;
  return (expectedReturn - RISK_FREE_RATE) / volatility;
}

// ── 工具组件 ─────────────────────────────────────────────────────────────────

const MetricCard: Component<{
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  positive?: boolean;
  negative?: boolean;
}> = (props) => (
  <div
    class={`flex flex-col gap-1 p-3 rounded-lg border ${
      props.highlight ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/10'
    }`}
  >
    <span class="text-xs text-gray-400">{props.label}</span>
    <span
      class={`text-xl font-bold ${props.positive ? 'text-green-400' : props.negative ? 'text-red-400' : 'text-white'}`}
    >
      {props.value}
    </span>
    <Show when={props.sub}>
      <span class="text-xs text-gray-500">{props.sub}</span>
    </Show>
  </div>
);

const CompareRow: Component<{
  label: string;
  current: string;
  simulated: string;
  delta?: string;
  positive?: boolean;
  negative?: boolean;
}> = (props) => (
  <div class="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
    <span class="text-sm text-gray-400 w-20">{props.label}</span>
    <div class="flex items-center gap-4">
      <div class="text-right">
        <span class="text-xs text-gray-500 mr-2">当前</span>
        <span class="text-sm font-mono text-gray-300">{props.current}</span>
      </div>
      <div class="text-gray-600">→</div>
      <div class="text-right">
        <span class="text-xs text-gray-500 mr-2">模拟</span>
        <span class="text-sm font-mono text-white">{props.simulated}</span>
      </div>
      <Show when={props.delta}>
        <span
          class={`text-xs font-mono w-16 text-right ${props.positive ? 'text-green-400' : props.negative ? 'text-red-400' : 'text-gray-500'}`}
        >
          {props.delta}
        </span>
      </Show>
    </div>
  </div>
);

const SuggestionItem: Component<{
  stock: RebalanceSuggestion;
}> = (props) => {
  const { stock } = props;
  const isUp = stock.action === 'increase';
  const isDown = stock.action === 'decrease';

  return (
    <div
      class={`flex items-center justify-between p-3 rounded-lg border ${
        isUp
          ? 'bg-green-500/10 border-green-500/20'
          : isDown
            ? 'bg-red-500/10 border-red-500/20'
            : 'bg-white/5 border-white/10'
      }`}
    >
      <div class="flex flex-col gap-0.5">
        <span class="text-sm font-medium text-white">{stock.name}</span>
        <span class="text-xs text-gray-500">{stock.symbol}</span>
      </div>
      <div class="flex items-center gap-3">
        <div class="flex flex-col items-end gap-0.5">
          <div class="flex items-center gap-2 text-xs">
            <span class="text-gray-500">{stock.currentWeight.toFixed(1)}%</span>
            <span class="text-gray-600">→</span>
            <span class="text-white font-mono">{stock.targetWeight.toFixed(1)}%</span>
          </div>
          <div
            class={`flex items-center gap-1 text-xs font-mono ${
              isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-gray-500'
            }`}
          >
            <Show when={isUp}>
              <span>↑</span>
            </Show>
            <Show when={isDown}>
              <span>↓</span>
            </Show>
            <Show when={!isUp && !isDown}>
              <span>—</span>
            </Show>
            <span>{Math.abs(stock.diff).toFixed(1)}%</span>
          </div>
        </div>
        <div
          class={`w-6 h-6 rounded flex items-center justify-center text-sm ${
            isUp
              ? 'bg-green-500/20 text-green-400'
              : isDown
                ? 'bg-red-500/20 text-red-400'
                : 'bg-white/10 text-gray-500'
          }`}
        >
          {isUp ? '↑' : isDown ? '↓' : '—'}
        </div>
      </div>
    </div>
  );
};

// ── 主组件 ───────────────────────────────────────────────────────────────────

export const PortfolioSimulator: Component = () => {
  const [weights, setWeights] = createSignal<number[]>(INITIAL_STOCKS.map((s) => s.currentWeight));

  const stocks = INITIAL_STOCKS;

  // 当前组合指标
  const currentMetrics = createMemo(() => {
    const w = INITIAL_STOCKS.map((s) => s.currentWeight);
    const ret = calcPortfolioReturn(INITIAL_STOCKS, w);
    const vol = calcPortfolioVolatility(INITIAL_STOCKS, w);
    const sharpe = calcSharpe(ret, vol);
    return { ret, vol, sharpe };
  });

  // 模拟组合指标
  const simulatedMetrics = createMemo(() => {
    const w = weights();
    const ret = calcPortfolioReturn(INITIAL_STOCKS, w);
    const vol = calcPortfolioVolatility(INITIAL_STOCKS, w);
    const sharpe = calcSharpe(ret, vol);
    return { ret, vol, sharpe };
  });

  // 调仓建议
  const suggestions = createMemo<RebalanceSuggestion[]>(() => {
    return INITIAL_STOCKS.map((s, i) => {
      const targetWeight = weights()[i];
      const diff = targetWeight - s.currentWeight;
      const action: RebalanceSuggestion['action'] =
        diff > 0.5 ? 'increase' : diff < -0.5 ? 'decrease' : 'unchanged';
      return {
        symbol: s.symbol,
        name: s.name,
        currentWeight: s.currentWeight,
        targetWeight,
        diff,
        action,
      };
    }).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  });

  // 权重总和（归一化）
  const totalWeight = createMemo(() => weights().reduce((a, b) => a + b, 0));

  const delta = (sim: number, cur: number): string | undefined => {
    const d = sim - cur;
    if (Math.abs(d) < 0.001) return undefined;
    return (d >= 0 ? '+' : '') + (d * 100).toFixed(2) + '%';
  };

  // formatPct: takes a decimal (e.g. 0.15) and returns '15.00%'
  const formatPct = (v: number) => formatPercent(v, 2);

  return (
    <div class="h-full flex flex-col gap-4 overflow-auto">
      {/* 顶部概览：当前 vs 模拟 指标对比 */}
      <div class="grid grid-cols-2 gap-4 shrink-0">
        {/* 当前组合 */}
        <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-2 h-2 rounded-full bg-blue-400" />
            <h3 class="text-sm font-semibold text-white">当前组合</h3>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <MetricCard label="预期收益" value={formatPct(currentMetrics().ret)} sub="年化" />
            <MetricCard label="波动率" value={formatPct(currentMetrics().vol)} sub="年化" />
            <MetricCard
              label="夏普比率"
              value={currentMetrics().sharpe.toFixed(2)}
              sub={`无风险${formatPct(RISK_FREE_RATE)}`}
              positive={currentMetrics().sharpe > 0.5}
            />
          </div>
        </div>

        {/* 模拟组合 */}
        <div class="bg-[#111827]/80 rounded-lg border border-blue-500/20 p-4">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-2 h-2 rounded-full bg-green-400" />
            <h3 class="text-sm font-semibold text-white">模拟组合</h3>
            <span class="ml-auto text-xs text-gray-500">调整权重后自动计算</span>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <MetricCard
              label="预期收益"
              value={formatPct(simulatedMetrics().ret)}
              sub="年化"
              highlight
            />
            <MetricCard
              label="波动率"
              value={formatPct(simulatedMetrics().vol)}
              sub="年化"
              highlight
            />
            <MetricCard
              label="夏普比率"
              value={simulatedMetrics().sharpe.toFixed(2)}
              sub={`无风险${formatPct(RISK_FREE_RATE)}`}
              positive={simulatedMetrics().sharpe > currentMetrics().sharpe}
            />
          </div>
        </div>
      </div>

      {/* 中间三栏：左侧对比 + 中间滑块 + 右侧建议 */}
      <div class="flex flex-col lg:flex-row gap-4 min-h-0 flex-1">
        {/* 左：指标变化明细 */}
        <div class="w-full lg:w-72 shrink-0 bg-[#111827]/80 rounded-lg border border-white/10 p-4 flex flex-col gap-3">
          <h3 class="text-sm font-semibold text-white">指标变化明细</h3>
          <CompareRow
            label="预期收益"
            current={formatPct(currentMetrics().ret)}
            simulated={formatPct(simulatedMetrics().ret)}
            delta={delta(simulatedMetrics().ret, currentMetrics().ret)}
            positive={simulatedMetrics().ret > currentMetrics().ret}
            negative={simulatedMetrics().ret < currentMetrics().ret}
          />
          <CompareRow
            label="波动率"
            current={formatPct(currentMetrics().vol)}
            simulated={formatPct(simulatedMetrics().vol)}
            delta={delta(simulatedMetrics().vol, currentMetrics().vol)}
            positive={simulatedMetrics().vol < currentMetrics().vol}
            negative={simulatedMetrics().vol > currentMetrics().vol}
          />
          <CompareRow
            label="夏普比率"
            current={currentMetrics().sharpe.toFixed(3)}
            simulated={simulatedMetrics().sharpe.toFixed(3)}
            delta={delta(simulatedMetrics().sharpe, currentMetrics().sharpe)}
            positive={simulatedMetrics().sharpe > currentMetrics().sharpe}
            negative={simulatedMetrics().sharpe < currentMetrics().sharpe}
          />

          <div class="mt-2 pt-2 border-t border-white/10">
            <div class="flex items-center justify-between text-xs mb-1">
              <span class="text-gray-500">权重总和</span>
              <span
                class={`font-mono ${Math.abs(totalWeight() - 100) < 0.01 ? 'text-green-400' : 'text-red-400'}`}
              >
                {totalWeight().toFixed(1)}%
              </span>
            </div>
            <Show when={Math.abs(totalWeight() - 100) > 0.01}>
              <div class="text-xs text-red-400">⚠ 权重总和不等于100%，请调整滑块</div>
            </Show>
          </div>

          {/* 简化相关性说明 */}
          <div class="mt-auto pt-2 border-t border-white/10">
            <div class="text-xs text-gray-500 leading-relaxed">
              <div class="font-medium text-gray-400 mb-1">计算说明</div>
              <div>• 预期收益 = Σ(wᵢ × rᵢ)</div>
              <div>• 波动率 = √(wᵀ Σ w)</div>
              <div>• 夏普 = (收益 - 无风险利率) / 波动率</div>
              <div class="mt-1 text-gray-600">基于5只股票相关矩阵估算</div>
            </div>
          </div>
        </div>

        {/* 中：权重滑块 */}
        <div class="flex-1 bg-[#111827]/80 rounded-lg border border-white/10 p-4 flex flex-col gap-4 overflow-auto">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-white">调整权重</h3>
            <button
              class="px-3 py-1 text-xs rounded bg-white/10 hover:bg-white/20 text-gray-300"
              onClick={() => setWeights(INITIAL_STOCKS.map((s) => s.currentWeight))}
            >
              重置
            </button>
          </div>

          <div class="flex flex-col gap-4">
            <For each={stocks}>
              {(stock, i) => {
                const w = () => weights()[i()];
                const currentW = stock.currentWeight;
                const diff = w() - currentW;
                const isUp = diff > 0.5;
                const isDown = diff < -0.5;

                return (
                  <div class="flex flex-col gap-2 p-3 rounded-lg bg-white/5 border border-white/10">
                    <div class="flex items-center justify-between">
                      <div class="flex flex-col">
                        <span class="text-sm font-medium text-white">{stock.name}</span>
                        <span class="text-xs text-gray-500">{stock.symbol}</span>
                      </div>
                      <div class="flex items-center gap-3">
                        <div class="flex flex-col items-end gap-0.5">
                          <div class="flex items-center gap-2">
                            <span class="text-xs text-gray-500">当前 {currentW.toFixed(1)}%</span>
                            <span
                              class={`text-xs font-mono ${
                                isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-gray-400'
                              }`}
                            >
                              {isUp ? '↑' : isDown ? '↓' : ''} {w() - currentW >= 0 ? '+' : ''}
                              {(w() - currentW).toFixed(1)}%
                            </span>
                          </div>
                          <span class="text-sm font-mono text-white">{w().toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>

                    {/* 滑块 */}
                    <div class="relative">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="0.5"
                        value={w()}
                        onInput={(e) => {
                          const newWeights = [...weights()];
                          newWeights[i()] = parseFloat((e.target as HTMLInputElement).value);
                          setWeights(newWeights);
                        }}
                        class="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-blue-500"
                        style={{
                          background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${w()}%, rgba(255,255,255,0.1) ${w()}%, rgba(255,255,255,0.1) 100%)`,
                        }}
                      />
                    </div>

                    {/* 股票基本信息 */}
                    <div class="flex gap-4 text-xs text-gray-500">
                      <span>
                        预期收益:{' '}
                        <span class="text-gray-300">{formatPct(stock.expectedReturn)}</span>
                      </span>
                      <span>
                        波动率: <span class="text-gray-300">{formatPct(stock.volatility)}</span>
                      </span>
                      <span>
                        夏普:{' '}
                        <span class={stock.sharpe > 0.4 ? 'text-green-400' : 'text-gray-300'}>
                          {stock.sharpe.toFixed(2)}
                        </span>
                      </span>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </div>

        {/* 右：调仓建议 */}
        <div class="w-full lg:w-72 shrink-0 bg-[#111827]/80 rounded-lg border border-white/10 p-4 flex flex-col gap-3 overflow-auto">
          <h3 class="text-sm font-semibold text-white">调仓建议</h3>

          <Show
            when={suggestions().some((s) => s.action !== 'unchanged')}
            fallback={
              <div class="flex-1 flex flex-col items-center justify-center text-gray-500 text-sm gap-2">
                <div class="text-2xl">⚖</div>
                <div>调整权重后显示调仓建议</div>
              </div>
            }
          >
            <div class="flex flex-col gap-2">
              <For each={suggestions()}>{(s) => <SuggestionItem stock={s} />}</For>
            </div>
          </Show>

          {/* 风险提示 */}
          <div class="mt-auto pt-3 border-t border-white/10">
            <div class="text-xs text-yellow-500/80 leading-relaxed">
              ⚠ 模拟结果仅供参考，实际交易需考虑流动性、交易成本、滑点等因素。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortfolioSimulator;
