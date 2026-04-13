/**
 * CorrelationMatrix.tsx — 持仓股票相关性热力图
 * ECharts heatmap: 正相关(蓝) / 负相关(红) / 中性(白)
 */
import { Component, createSignal, onMount, onCleanup, createEffect } from 'solid-js';
import { marketState } from '../../../stores/marketStore';
import { apiFetch } from '../../../hooks/useApi';
import ec from '@/lib/echarts';
import type { EChartsType, EChartsCoreOption } from '@/lib/echarts';

interface CorrelationData {
  stocks: string[];
  matrix: number[][]; // [i][j] = correlation between stock[i] and stock[j]
}

interface CorrelationMatrixProps {
  /** 持仓数据源（用于生成模拟相关性矩阵） */
  positions?: Array<{ symbol: string; name?: string; value?: number }>;
  /** 手动指定股票列表 */
  symbols?: string[];
  /** 加载状态回调 */
  onLoadStateChange?: (loading: boolean) => void;
}

// ── 相关性矩阵生成（基于收益率模拟） ────────────────────────
function generateMockCorrelation(symbols: string[]): CorrelationData {
  const n = symbols.length;
  // 生成伪随机但半真实的相关性矩阵
  // 对角线为 1（自身相关性）
  const matrix: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      if (i === j) return 1;
      // 利用 symbol 字符串的 char code 生成稳定 seed
      const seed = (symbols[i].charCodeAt(0) + symbols[j].charCodeAt(0)) % 100;
      // 生成 [0.3, 0.95] 正相关 或 [-0.9, -0.3] 负相关
      const isNeg = seed % 7 === 0 && i !== j;
      if (isNeg) {
        return parseFloat((-0.3 - ((seed * 7) % 60) / 100).toFixed(4));
      }
      return parseFloat((0.3 + ((seed * 3) % 65) / 100).toFixed(4));
    })
  );

  // 确保对称性
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      matrix[j][i] = matrix[i][j];
    }
  }

  return { stocks: symbols, matrix };
}

// ── 从 positions 生成 symbols ────────────────────────────────
function extractSymbols(
  positions?: Array<{ symbol: string; name?: string; value?: number }>
): string[] {
  if (!positions || positions.length === 0) {
    return [
      '平安银行',
      '万科A',
      '宁德时代',
      '比亚迪',
      '美的集团',
      '格力电器',
      '中国平安',
      '招商银行',
    ];
  }
  return positions.map((p) => p.symbol);
}

export const CorrelationMatrix: Component<CorrelationMatrixProps> = (props) => {
  let chartRef: HTMLDivElement | undefined;
  let chart: EChartsType | undefined;

  const [loading, setLoading] = createSignal(false);
  const [data, setData] = createSignal<CorrelationData | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  // ── 获取或生成数据 ─────────────────────────────────────────
  const fetchCorrelation = async () => {
    setLoading(true);
    props.onLoadStateChange?.(true);
    setError(null);

    try {
      const res = await apiFetch<{ tickers?: string[]; stocks?: string[]; matrix?: number[][] }>('/api/risk/correlation');
      const json = res.data;
      if (json && json.tickers && json.tickers.length > 0) {
        setData(json as unknown as CorrelationData);
        return;
      }
    } catch (e: unknown) {
      console.warn('[CorrelationMatrix] API failed, using mock data:', e);
    }

    // 模拟数据路径
    const symbols = props.symbols ?? extractSymbols(props.positions);
    // 从 marketState 注入的持仓信息中取真实数据（兜底）
    const positions = props.positions ?? [];
    const realSymbols =
      props.symbols ??
      (positions.length > 0 ? positions.map((p: { symbol: string }) => p.symbol) : symbols);
    const result = generateMockCorrelation(realSymbols.length > 0 ? realSymbols : symbols);
    setData(result);
  };

  // ── ECharts 配置 ────────────────────────────────────────────
  const buildOption = (corr: CorrelationData): EChartsCoreOption => {
    const { stocks, matrix } = corr;
    const n = stocks.length;

    // heatmap data: [x, y, value]
    const heatmapData: Array<[number, number, number]> = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        heatmapData.push([j, i, matrix[i][j]]);
      }
    }

    return {
      backgroundColor: 'transparent',
      tooltip: {
        backgroundColor: '#1f2937',
        borderColor: 'rgba(255,255,255,0.12)',
        textStyle: { color: '#F9FAFB' },
        formatter: (params: unknown) => {
          const p = params as { data: [number, number, number] };
          if (!p?.data) return '';
          const [x, y, v] = p.data;
          const stockX = stocks[x];
          const stockY = stocks[y];
          const sign = v >= 0 ? '+' : '';
          const abs = Math.abs(v);
          let level = '中性';
          if (v > 0.6) level = '强正相关';
          else if (v > 0.3) level = '正相关';
          else if (v < -0.6) level = '强负相关';
          else if (v < -0.3) level = '负相关';
          return `<div style="font-size:12px;line-height:1.6">
            <div style="font-weight:600;margin-bottom:4px">${stockY} × ${stockX}</div>
            <div style="color:${v >= 0 ? '#60A5FA' : '#F87171'}">相关系数: <b>${sign}${v.toFixed(4)}</b></div>
            <div style="color:#9CA3AF;font-size:11px">${level} (|r|=${abs.toFixed(2)})</div>
          </div>`;
        },
      },
      grid: {
        left: '3%',
        right: '12%',
        top: '6%',
        bottom: '8%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: stocks,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: {
          color: '#9CA3AF',
          fontSize: 10,
          rotate: 30,
          interval: 0,
        },
        axisTick: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        splitArea: { show: false },
      },
      yAxis: {
        type: 'category',
        data: stocks,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: '#9CA3AF', fontSize: 10, interval: 0 },
        axisTick: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        inverse: true,
      },
      visualMap: {
        show: true,
        min: -1,
        max: 1,
        calculable: false,
        orient: 'vertical',
        right: 8,
        top: 'center',
        itemWidth: 14,
        itemHeight: 120,
        itemNumber: 9,
        textStyle: { color: '#D1D5DB', fontSize: 10 },
        // 蓝(-1负相关) → 白(0中性) → 红(1正相关)
        inRange: {
          color: [
            '#3B82F6',
            '#60A5FA',
            '#93C5FD',
            '#BFDBFE',
            '#F3F4F6',
            '#FCA5A5',
            '#F87171',
            '#EF4444',
            '#DC2626',
          ],
        },
        formatter: (v: number) => {
          const sign = v >= 0 ? '+' : '';
          return `${sign}${v.toFixed(1)}`;
        },
      },
      series: [
        {
          type: 'heatmap',
          data: heatmapData,
          label: {
            show: true,
            formatter: (p: { data: [number, number, number] }) => {
              const v = p.data[2];
              return `${v >= 0 ? '+' : ''}${v.toFixed(2)}`;
            },
            fontSize: 9,
            color: '#fff',
            fontWeight: 'bold',
          },
          itemStyle: {
            borderWidth: 1.5,
            borderColor: 'rgba(17,24,39,0.8)',
            borderRadius: 2,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 8,
              shadowColor: 'rgba(0,0,0,0.6)',
              borderColor: '#fff',
              borderWidth: 2,
            },
          },
        },
      ],
    } as EChartsCoreOption;
  };

  // ── 生命周期 ────────────────────────────────────────────────
  onMount(async () => {
    if (!chartRef) return;
    chart = ec.init(chartRef, 'dark', { renderer: 'canvas' });

    const ro = new ResizeObserver(() => chart?.resize());
    ro.observe(chartRef);

    fetchCorrelation();

    onCleanup(() => {
      ro.disconnect();
      chart?.dispose();
    });
  });

  // 数据更新时重绘
  createEffect(() => {
    const corr = data();
    if (chart && corr) {
      chart.setOption(buildOption(corr), true);
    }
  });

  // 外部 loading 状态同步
  createEffect(() => {
    setLoading(loading());
    props.onLoadStateChange?.(loading());
  });

  return (
    <div class="flex flex-col h-full gap-3">
      {/* Header */}
      <div class="flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2">
          <h3 class="text-sm font-semibold text-gray-200">相关性矩阵</h3>
          {loading() && <span class="text-xs text-blue-400 animate-pulse">计算中...</span>}
        </div>
        <button
          class="text-xs text-gray-400 hover:text-gray-200 px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors"
          onClick={fetchCorrelation}
          disabled={loading()}
          title="刷新相关性数据"
        >
          ↻ 刷新
        </button>
      </div>

      {/* Error */}
      {error() && (
        <div class="text-xs text-red-400 bg-red-400/10 rounded px-3 py-2 border border-red-400/20">
          {error()}
        </div>
      )}

      {/* Chart */}
      <div ref={chartRef} class="flex-1 w-full min-h-0" style={{ 'min-height': '280px' }} />

      {/* Legend hint */}
      <div class="flex items-center justify-center gap-4 shrink-0 text-xs text-gray-500">
        <span class="flex items-center gap-1">
          <span class="w-3 h-3 rounded-sm bg-[#3B82F6]" /> 负相关
        </span>
        <span class="flex items-center gap-1">
          <span class="w-3 h-3 rounded-sm bg-white/80" /> 中性
        </span>
        <span class="flex items-center gap-1">
          <span class="w-3 h-3 rounded-sm bg-[#EF4444]" /> 正相关
        </span>
        <span class="text-gray-600">|</span>
        <span class="text-gray-600">|r| &gt; 0.6 强相关</span>
      </div>
    </div>
  );
};
