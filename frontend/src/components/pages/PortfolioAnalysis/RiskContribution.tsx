/**
 * RiskContribution.tsx — 风险贡献分析
 * 各持仓对组合 VaR 的边际贡献分析与可视化
 */
import { Component, createSignal, onMount, onCleanup, createEffect, Show } from 'solid-js';
import * as echarts from 'echarts';

// ── Types ────────────────────────────────────────────────────────────────────

interface Position {
  code: string;
  name: string;
  weight: number;       // 持仓占比 (0-1)
  volatility: number;   // 年化波动率 (0-1)
}

interface RiskContributionItem {
  code: string;
  name: string;
  weight: number;           // 持仓占比 (%)
  riskContribution: number;  // 风险贡献占比 (%)
  marginalVaR: number;       // 边际 VaR
  componentVaR: number;      // 成分 VaR
}

// ── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_POSITIONS: Position[] = [
  { code: '000001', name: '平安银行', weight: 0.15, volatility: 0.28 },
  { code: '000002', name: '万科A',    weight: 0.12, volatility: 0.32 },
  { code: '600036', name: '招商银行', weight: 0.18, volatility: 0.25 },
  { code: '600519', name: '贵州茅台', weight: 0.20, volatility: 0.22 },
  { code: '601318', name: '中国平安', weight: 0.10, volatility: 0.30 },
  { code: '000858', name: '五粮液',   weight: 0.13, volatility: 0.26 },
  { code: '600887', name: '伊利股份', weight: 0.12, volatility: 0.20 },
];

// 简化的相关矩阵 (对称, 对角线=1)
const CORRELATION_MATRIX: number[][] = [
  [1.00, 0.45, 0.52, 0.28, 0.60, 0.38, 0.32],
  [0.45, 1.00, 0.40, 0.25, 0.48, 0.35, 0.30],
  [0.52, 0.40, 1.00, 0.30, 0.55, 0.42, 0.36],
  [0.28, 0.25, 0.30, 1.00, 0.32, 0.65, 0.42],
  [0.60, 0.48, 0.55, 0.32, 1.00, 0.40, 0.35],
  [0.38, 0.35, 0.42, 0.65, 0.40, 1.00, 0.45],
  [0.32, 0.30, 0.36, 0.42, 0.35, 0.45, 1.00],
];

// ── VaR 计算 ────────────────────────────────────────────────────────────────

/** 构建协方差矩阵: Cov(i,j) = ρ(i,j) × σ_i × σ_j */
function buildCovarianceMatrix(positions: Position[]): number[][] {
  const n = positions.length;
  const cov: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      cov[i][j] = CORRELATION_MATRIX[i][j] * positions[i].volatility * positions[j].volatility;
    }
  }
  return cov;
}

/** 计算组合方差: w' × Σ × w */
function portfolioVariance(weights: number[], cov: number[][]): number {
  const n = weights.length;
  let total = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      total += weights[i] * cov[i][j] * weights[j];
    }
  }
  return total;
}

/** 组合年化波动率 */
function portfolioVolatility(weights: number[], cov: number[][]): number {
  return Math.sqrt(portfolioVariance(weights, cov));
}

/** VaR 计算 (95% 单尾, Z = 1.645) */
function calcVaR(weights: number[], cov: number[][], _confidence = 0.95): number {
  const zScore = 1.645;
  return portfolioVolatility(weights, cov) * zScore;
}

/** 边际 VaR: ∂VaR/∂w_i = (Σ × w)_i / σ_p × Z */
function calcMarginalVaR(weights: number[], cov: number[][], _confidence = 0.95): number[] {
  const zScore = 1.645;
  const n = weights.length;
  const vol = portfolioVolatility(weights, cov);

  // Σ × w
  const covWeighted: number[] = [];
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) {
      sum += cov[i][j] * weights[j];
    }
    covWeighted.push(sum);
  }

  return covWeighted.map((v) => (v / vol) * zScore);
}

/** 计算所有风险贡献数据 */
function calcRiskContributions(positions: Position[]): RiskContributionItem[] {
  const _n = positions.length;
  const weights = positions.map((p) => p.weight);
  const cov = buildCovarianceMatrix(positions);
  const totalVaR = calcVaR(weights, cov);
  const marginalVaRs = calcMarginalVaR(weights, cov);

  return positions.map((p, i) => {
    const marginalVaR = marginalVaRs[i];
    const componentVaR = p.weight * marginalVaR;
    const riskContribution = totalVaR > 0 ? (componentVaR / totalVaR) * 100 : 0;

    return {
      code: p.code,
      name: p.name,
      weight: p.weight * 100,
      riskContribution,
      marginalVaR,
      componentVaR,
    };
  });
}

// ── 颜色配置 ────────────────────────────────────────────────────────────────

const STOCK_COLORS = [
  '#3B82F6', // 蓝
  '#10B981', // 绿
  '#F59E0B', // 黄
  '#EF4444', // 红
  '#8B5CF6', // 紫
  '#06B6D4', // 青
  '#F97316', // 橙
  '#EC4899', // 粉
];

// ── 组件 ─────────────────────────────────────────────────────────────────────

export const RiskContribution: Component = () => {
  let chartRef: HTMLDivElement | undefined;
  let chart: echarts.ECharts | undefined;

  const [data, setData] = createSignal<RiskContributionItem[]>([]);
  const [portfolioVaR, setPortfolioVaR] = createSignal(0);
  const [portfolioVol, setPortfolioVol] = createSignal(0);
  const [loading, setLoading] = createSignal(false);

  // ── 加载数据 ──────────────────────────────────────────────────────────────

  const loadData = async () => {
    setLoading(true);
    try {
      // 尝试从 API 获取，失败则使用模拟数据
      let positions = MOCK_POSITIONS;
      try {
        const res = await fetch('/api/risk/var');
        if (res.ok) {
          const json = await res.json();
          if (json.positions) positions = json.positions;
        }
      } catch {
        // 使用模拟数据
      }

      const riskData = calcRiskContributions(positions);
      const weights = positions.map((p) => p.weight);
      const cov = buildCovarianceMatrix(positions);
      setPortfolioVaR(calcVaR(weights, cov) * 100);
      setPortfolioVol(portfolioVolatility(weights, cov) * 100);
      setData(riskData);
    } finally {
      setLoading(false);
    }
  };

  // ── ECharts 配置 ──────────────────────────────────────────────────────────

  const buildChartOption = (items: RiskContributionItem[]): echarts.EChartsOption => {
    if (!items.length) return { backgroundColor: 'transparent', series: [] };

    const codes = items.map((d) => d.code);
    const riskContributions = items.map((d) => parseFloat(d.riskContribution.toFixed(2)));
    const weights = items.map((d) => parseFloat(d.weight.toFixed(2)));

    return {
      backgroundColor: 'transparent',
      grid: {
        left: '3%',
        right: '3%',
        top: '18%',
        bottom: '10%',
        containLabel: true,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(17,24,39,0.95)',
        borderColor: 'rgba(255,255,255,0.12)',
        textStyle: { color: '#F9FAFB', fontSize: 12 },
        formatter: (params: unknown) => {
          const arr = (params as Array<{ axisValue: string; seriesName: string; value: number; color: string }>);
          if (!arr?.length) return '';
          const code = arr[0]?.axisValue ?? '';
          const item = items.find((d) => d.code === code);
          const name = item?.name ?? '';
          let html = `<div style="font-weight:600;margin-bottom:6px">${code} ${name}</div>`;
          for (const p of arr) {
            const val = p.seriesName === '风险贡献占比' ? `${p.value}%` : `${p.value}%`;
            html += `<div style="display:flex;justify-content:space-between;gap:16px;margin:2px 0">
              <span style="color:${p.color}">${p.seriesName}</span>
              <span style="color:#F9FAFB">${val}</span>
            </div>`;
          }
          return html;
        },
      },
      legend: {
        data: ['风险贡献占比', '持仓占比'],
        textStyle: { color: '#9CA3AF', fontSize: 11 },
        top: 0,
      },
      xAxis: {
        type: 'category',
        data: codes,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: '#9CA3AF', fontSize: 11 },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        name: '占比 (%)',
        nameTextStyle: { color: '#6B7280', fontSize: 10 },
        axisLine: { show: false },
        axisLabel: { color: '#9CA3AF', fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      series: [
        {
          name: '风险贡献占比',
          type: 'bar',
          stack: 'risk',
          data: riskContributions,
          itemStyle: {
            color: (params: { dataIndex: number }) => STOCK_COLORS[params.dataIndex % STOCK_COLORS.length],
            borderRadius: [4, 0, 0, 4],
          },
          barMaxWidth: 48,
        },
        {
          name: '持仓占比',
          type: 'bar',
          stack: 'risk',
          data: weights,
          itemStyle: {
            color: 'rgba(255,255,255,0.06)',
            borderRadius: 0,
          },
          barMaxWidth: 48,
        },
      ],
    };
  };

  // ── 生命周期 ──────────────────────────────────────────────────────────────

  onMount(() => {
    if (chartRef) {
      chart = echarts.init(chartRef, undefined, { renderer: 'canvas' });
    }
    loadData();

    const handleResize = () => chart?.resize();
    window.addEventListener('resize', handleResize);

    onCleanup(() => {
      window.removeEventListener('resize', handleResize);
      chart?.dispose();
    });
  });

  createEffect(() => {
    const items = data();
    if (chart && items.length) {
      chart.setOption(buildChartOption(items), true);
    }
  });

  // ── 渲染 ──────────────────────────────────────────────────────────────────

  return (
    <div class="flex flex-col gap-4 h-full">
      {/* 汇总指标卡片 */}
      <div class="grid grid-cols-3 gap-3">
        <div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3">
          <div class="text-xs text-gray-400 mb-1">组合 VaR (95%)</div>
          <div class="text-xl font-bold text-white">{portfolioVaR().toFixed(2)}%</div>
          <div class="text-xs text-gray-500 mt-0.5">日度风险价值</div>
        </div>
        <div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3">
          <div class="text-xs text-gray-400 mb-1">组合波动率</div>
          <div class="text-xl font-bold text-white">{portfolioVol().toFixed(2)}%</div>
          <div class="text-xs text-gray-500 mt-0.5">年化波动率</div>
        </div>
        <div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3">
          <div class="text-xs text-gray-400 mb-1">持仓数量</div>
          <div class="text-xl font-bold text-white">{data().length}</div>
          <div class="text-xs text-gray-500 mt-0.5">只股票</div>
        </div>
      </div>

      {/* 图表区域 */}
      <div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 flex-1 min-h-[260px]">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold text-white">风险贡献 vs 持仓占比</h3>
          <Show when={loading()}>
            <span class="text-xs text-blue-400 animate-pulse">加载中...</span>
          </Show>
        </div>
        <div ref={chartRef} class="w-full h-[220px]" />
      </div>

      {/* 表格区域 */}
      <div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
        <div class="px-4 py-3 border-b border-white/10">
          <h3 class="text-sm font-semibold text-white">明细数据</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="text-gray-400 border-b border-white/10">
                <th class="text-left px-4 py-2 font-medium">股票代码</th>
                <th class="text-left px-4 py-2 font-medium">股票名称</th>
                <th class="text-right px-4 py-2 font-medium">持仓占比</th>
                <th class="text-right px-4 py-2 font-medium">风险贡献占比</th>
                <th class="text-right px-4 py-2 font-medium">边际 VaR</th>
                <th class="text-right px-4 py-2 font-medium">成分 VaR</th>
              </tr>
            </thead>
            <tbody>
              {data().map((item, idx) => (
                <tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td class="px-4 py-2.5">
                    <span
                      class="inline-block w-2 h-2 rounded-full mr-2"
                      style={{ background: STOCK_COLORS[idx % STOCK_COLORS.length] }}
                    />
                    <span class="text-white font-mono">{item.code}</span>
                  </td>
                  <td class="px-4 py-2.5 text-gray-300">{item.name}</td>
                  <td class="px-4 py-2.5 text-right text-gray-300">{item.weight.toFixed(2)}%</td>
                  <td class="px-4 py-2.5 text-right">
                    <span
                      class="font-semibold"
                      style={{ color: STOCK_COLORS[idx % STOCK_COLORS.length] }}
                    >
                      {item.riskContribution.toFixed(2)}%
                    </span>
                  </td>
                  <td class="px-4 py-2.5 text-right text-gray-300">{item.marginalVaR.toFixed(4)}</td>
                  <td class="px-4 py-2.5 text-right text-gray-300">
                    {(item.componentVaR * 100).toFixed(4)}%
                  </td>
                </tr>
              ))}
              {/* 汇总行 */}
              <tr class="bg-white/5 font-semibold border-t border-white/10">
                <td class="px-4 py-2.5 text-gray-400" colspan="2">合计</td>
                <td class="px-4 py-2.5 text-right text-white">
                  {data().reduce((s, d) => s + d.weight, 0).toFixed(2)}%
                </td>
                <td class="px-4 py-2.5 text-right text-white">100.00%</td>
                <td class="px-4 py-2.5 text-right text-gray-400">—</td>
                <td class="px-4 py-2.5 text-right text-gray-400">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
