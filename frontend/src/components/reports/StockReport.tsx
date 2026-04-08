/**
 * StockReport.tsx — 个股分析报告页面
 * 支持一键导出PDF
 */
import { Component, createSignal, Show, onMount, onCleanup, createEffect } from 'solid-js';
import echarts from '@/lib/echarts';
import { logger } from '../../lib/logger';
import { exportEchartsToPdf, type ExportPdfOptions } from '../../utils/pdfExport';

interface StockProfile {
  code: string;
  name: string;
  industry: string;
  market: string;
  listDate: string;
  totalShares: number;
  floatShares: number;
}

interface FinancialSummary {
  revenue: number;
  netProfit: number;
  totalAsset: number;
  equity: number;
  roe: number;
  eps: number;
  bvps: number;
  pe: number;
  pb: number;
  pcf: number;
  marketCap: number;
  floatMarketCap: number;
}

interface MoneyFlow {
  buySmAmount: number;
  sellSmAmount: number;
  buyMdAmount: number;
  sellMdAmount: number;
  buyLgAmount: number;
  sellLgAmount: number;
  buyMgAmount: number;
  sellMgAmount: number;
  netBuySm: number;
  netBuyMd: number;
  netBuyLg: number;
  netBuyMg: number;
}

interface RiskMetrics {
  volatility: number;
  beta: number;
  maxDrawdown: number;
  sharpeRatio: number;
  var95: number;
}

interface StockReportData {
  profile: StockProfile;
  financials: FinancialSummary;
  moneyFlow: MoneyFlow;
  riskMetrics: RiskMetrics;
  klineChart?: echarts.ECharts | undefined;
  volumeChart?: echarts.ECharts | undefined;
  moneyFlowChart?: echarts.ECharts | undefined;
  priceLine?: Array<{ date: string; close: number; ma5: number; ma10: number; ma20: number }>;
}

interface StockReportProps {
  symbol?: string;
  name?: string;
  profile?: StockProfile;
  financials?: FinancialSummary;
  moneyFlow?: MoneyFlow;
  riskMetrics?: RiskMetrics;
  klineChart?: echarts.ECharts | undefined;
  volumeChart?: echarts.ECharts | undefined;
  moneyFlowChart?: echarts.ECharts | undefined;
  priceLine?: Array<{ date: string; close: number; ma5: number; ma10: number; ma20: number }>;
  onExportPdf?: () => void;
}

export const StockReport: Component<StockReportProps> = (props) => {
  let klineRef: HTMLDivElement | undefined;
  let volumeRef: HTMLDivElement | undefined;
  let moneyFlowRef: HTMLDivElement | undefined;
  let klineChart: echarts.ECharts | undefined;
  let volumeChart: echarts.ECharts | undefined;
  let moneyFlowChart: echarts.ECharts | undefined;

  const [exporting, setExporting] = createSignal(false);

  const profile = () => props.profile;
  const financials = () => props.financials;
  const moneyFlow = () => props.moneyFlow;
  const riskMetrics = () => props.riskMetrics;

  onMount(() => {
    klineChart = echarts.init(klineRef!, 'dark');
    volumeChart = echarts.init(volumeRef!, 'dark');
    moneyFlowChart = echarts.init(moneyFlowRef!, 'dark');

    const ro = new ResizeObserver(() => {
      klineChart?.resize();
      volumeChart?.resize();
      moneyFlowChart?.resize();
    });
    [klineRef!, volumeRef!, moneyFlowRef!].forEach((el) => ro.observe(el));

    onCleanup(() => {
      ro.disconnect();
      klineChart?.dispose();
      volumeChart?.dispose();
      moneyFlowChart?.dispose();
    });
  });

  createEffect(() => {
    const price = props.priceLine;
    if (!price?.length || !klineChart || !volumeChart) return;

    const dates = price.map((d) => d.date);
    const closes = price.map((d) => d.close);
    const ma5 = price.map((d) => d.ma5);
    const ma10 = price.map((d) => d.ma10);
    const ma20 = price.map((d) => d.ma20);
    const _volumes = price.map((d) => d.close); // placeholder; real volume from props

    // K-line: candlestick-like using price + volume bar below
    const klineOption: echarts.EChartsCoreOption = {
      backgroundColor: 'transparent',
      grid: { left: '5%', right: '3%', top: '8%', bottom: '15%', containLabel: true },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1f2937',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#fff' },
      },
      legend: {
        data: ['收盘价', 'MA5', 'MA10', 'MA20'],
        textStyle: { color: '#9CA3AF', fontSize: 10 },
        top: 0,
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: '#9CA3AF', fontSize: 9, formatter: (v: string) => v.slice(5) },
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: '#9CA3AF', fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      series: [
        {
          name: '收盘价',
          type: 'line',
          data: closes,
          smooth: true,
          lineStyle: { color: '#3B82F6', width: 1.5 },
          itemStyle: { color: '#3B82F6' },
        },
        {
          name: 'MA5',
          type: 'line',
          data: ma5,
          smooth: true,
          lineStyle: { color: '#F59E0B', width: 1, type: 'dashed' },
          itemStyle: { color: '#F59E0B' },
        },
        {
          name: 'MA10',
          type: 'line',
          data: ma10,
          smooth: true,
          lineStyle: { color: '#8B5CF6', width: 1, type: 'dashed' },
          itemStyle: { color: '#8B5CF6' },
        },
        {
          name: 'MA20',
          type: 'line',
          data: ma20,
          smooth: true,
          lineStyle: { color: '#22C55E', width: 1, type: 'dashed' },
          itemStyle: { color: '#22C55E' },
        },
      ],
    };

    // Volume bars
    const volOption: echarts.EChartsCoreOption = {
      backgroundColor: 'transparent',
      grid: { left: '5%', right: '3%', top: '8%', bottom: '8%', containLabel: true },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: '#9CA3AF', fontSize: 9, formatter: (v: string) => v.slice(5) },
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: '#9CA3AF', fontSize: 9 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      // @ts-ignore
      series: [
        {
          type: 'bar',
          data: closes.map((c, i) => ({
            value: c > (price[i - 1]?.close ?? c) ? 1 : -1,
            visualMap: false,
          })),
          itemStyle: {
            color: (params: { dataIndex: number }) => {
              const cur = closes[params.dataIndex];
              const prev = price[params.dataIndex - 1]?.close ?? cur;
              return cur >= prev ? 'rgba(239,68,68,0.6)' : 'rgba(34,197,94,0.6)';
            },
          },
        },
      ],
    };

    klineChart.setOption(klineOption, true);
    volumeChart.setOption(volOption, true);
  });

  // Money flow chart
  createEffect(() => {
    const mf = moneyFlow();
    if (!mf || !moneyFlowChart) return;

    const categories = ['散户(SM)', '中单(MD)', '大单(LG)', '超大单(MG)'];
    const netBuy = [mf.netBuySm, mf.netBuyMd, mf.netBuyLg, mf.netBuyMg];

    const option: echarts.EChartsCoreOption = {
      backgroundColor: 'transparent',
      grid: { left: '5%', right: '5%', top: '10%', bottom: '10%', containLabel: true },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1f2937',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#fff' },
        formatter: (params: unknown) => {
          const arr = params as Array<{ name: string; value: number }>;
          if (!arr?.length) return '';
          const v = arr[0].value;
          return `<div style="font-size:12px">${arr[0].name}<br/><span style="color:${v >= 0 ? '#3B82F6' : '#EF4444'}">净流入: ${v >= 0 ? '+' : ''}${(v / 1e8).toFixed(2)}亿</span></div>`;
        },
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: '#9CA3AF', fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: {
          color: '#9CA3AF',
          fontSize: 9,
          formatter: (v: number) => `${(v / 1e8).toFixed(0)}亿`,
        },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      // @ts-ignore
      series: [
        {
          type: 'bar',
          data: netBuy.map((v) => ({
            value: v,
            itemStyle: { color: v >= 0 ? 'rgba(59,130,246,0.8)' : 'rgba(239,68,68,0.8)' },
          })),
          label: {
            show: true,
            formatter: (p: { value: number }) =>
              `${p.value >= 0 ? '+' : ''}${(p.value / 1e8).toFixed(2)}亿`,
            fontSize: 9,
            color: '#9CA3AF',
          },
        },
      ],
    } as unknown as Record<string, any>;

    moneyFlowChart.setOption(option, true);
  });

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      if (klineChart) {
        await exportEchartsToPdf(
          klineChart,
          `K线走势 — ${profile()?.name ?? props.symbol}`,
          `stock_${profile()?.code ?? props.symbol}_kline`
        );
      }
      if (moneyFlowChart) {
        await exportEchartsToPdf(
          moneyFlowChart,
          `资金流向 — ${profile()?.name ?? props.symbol}`,
          `stock_${profile()?.code ?? props.symbol}_moneyflow`
        );
      }
      props.onExportPdf?.();
    } catch (e) {
      logger.error('PDF export failed', { error: e });
    } finally {
      setExporting(false);
    }
  };

  const fmt = (v?: number, prefix = '') =>
    v !== undefined ? `${prefix}${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '--';
  const fmtPct = (v?: number) => (v !== undefined ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : '--');

  return (
    <div class="flex flex-col h-full" id="stock-report">
      {/* Toolbar */}
      <div class="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <div class="flex items-center gap-3">
          <h2 class="text-lg font-bold">{profile()?.name ?? props.name ?? '个股分析报告'}</h2>
          <span class="text-sm text-gray-400 font-mono">{profile()?.code ?? props.symbol}</span>
          <span class="text-xs text-gray-500">{profile()?.industry ?? ''}</span>
        </div>
        <button
          onClick={handleExportPdf}
          disabled={exporting()}
          class="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          {exporting() ? '导出中...' : '导出PDF'}
        </button>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* 基本信息 */}
        <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4 shrink-0">
          <h3 class="font-bold mb-3 text-sm text-gray-300">基本信息</h3>
          <div class="grid grid-cols-4 gap-4 text-sm">
            <div>
              <div class="text-xs text-gray-400">股票代码</div>
              <div class="font-mono mt-0.5">{profile()?.code ?? '--'}</div>
            </div>
            <div>
              <div class="text-xs text-gray-400">股票名称</div>
              <div class="mt-0.5">{profile()?.name ?? '--'}</div>
            </div>
            <div>
              <div class="text-xs text-gray-400">所属行业</div>
              <div class="mt-0.5">{profile()?.industry ?? '--'}</div>
            </div>
            <div>
              <div class="text-xs text-gray-400">上市市场</div>
              <div class="mt-0.5">{profile()?.market ?? '--'}</div>
            </div>
            <div>
              <div class="text-xs text-gray-400">总股本</div>
              <div class="tabular-nums mt-0.5">{fmt(profile()?.totalShares, '')}股</div>
            </div>
            <div>
              <div class="text-xs text-gray-400">流通股本</div>
              <div class="tabular-nums mt-0.5">{fmt(profile()?.floatShares, '')}股</div>
            </div>
            <div>
              <div class="text-xs text-gray-400">上市日期</div>
              <div class="mt-0.5">{profile()?.listDate ?? '--'}</div>
            </div>
            <div>
              <div class="text-xs text-gray-400">总市值</div>
              <div class="tabular-nums mt-0.5">{fmt(financials()?.marketCap, '')}元</div>
            </div>
          </div>
        </div>

        {/* K线图 + 成交量 */}
        <div class="grid grid-cols-1 gap-4 shrink-0">
          <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4">
            <h3 class="font-bold mb-2 text-sm text-gray-300">K线走势</h3>
            <div ref={klineRef} class="w-full" style={{ height: '240px' }} />
          </div>
          <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4">
            <h3 class="font-bold mb-2 text-sm text-gray-300">成交量</h3>
            <div ref={volumeRef} class="w-full" style={{ height: '100px' }} />
          </div>
        </div>

        {/* 财务摘要 */}
        <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4 shrink-0">
          <h3 class="font-bold mb-3 text-sm text-gray-300">财务摘要</h3>
          <div class="grid grid-cols-4 gap-4 text-sm">
            <div>
              <div class="text-xs text-gray-400">营业收入</div>
              <div class="tabular-nums mt-0.5">{fmt(financials()?.revenue)}元</div>
            </div>
            <div>
              <div class="text-xs text-gray-400">净利润</div>
              <div class="tabular-nums mt-0.5">{fmt(financials()?.netProfit)}元</div>
            </div>
            <div>
              <div class="text-xs text-gray-400">总资产</div>
              <div class="tabular-nums mt-0.5">{fmt(financials()?.totalAsset)}元</div>
            </div>
            <div>
              <div class="text-xs text-gray-400">净资产( equity )</div>
              <div class="tabular-nums mt-0.5">{fmt(financials()?.equity)}元</div>
            </div>
            <div>
              <div class="text-xs text-gray-400">ROE</div>
              <div class="tabular-nums mt-0.5 text-blue-400">{fmtPct(financials()?.roe)}</div>
            </div>
            <div>
              <div class="text-xs text-gray-400">EPS(每股收益)</div>
              <div class="tabular-nums mt-0.5">{financials()?.eps?.toFixed(4) ?? '--'}</div>
            </div>
            <div>
              <div class="text-xs text-gray-400">BVPS(每股净资产)</div>
              <div class="tabular-nums mt-0.5">{financials()?.bvps?.toFixed(4) ?? '--'}</div>
            </div>
            <div>
              <div class="text-xs text-gray-400">PE(市盈率)</div>
              <div class="tabular-nums mt-0.5">{financials()?.pe?.toFixed(2) ?? '--'}</div>
            </div>
            <div>
              <div class="text-xs text-gray-400">PB(市净率)</div>
              <div class="tabular-nums mt-0.5">{financials()?.pb?.toFixed(2) ?? '--'}</div>
            </div>
            <div>
              <div class="text-xs text-gray-400">PCF(现金流)</div>
              <div class="tabular-nums mt-0.5">{financials()?.pcf?.toFixed(2) ?? '--'}</div>
            </div>
          </div>
        </div>

        {/* 资金流 */}
        <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4 shrink-0">
          <h3 class="font-bold mb-2 text-sm text-gray-300">资金流向</h3>
          <div class="grid grid-cols-4 gap-4 text-sm mb-3">
            <div>
              <div class="text-xs text-gray-400">散户净流入</div>
              <div
                class={`tabular-nums mt-0.5 ${(moneyFlow()?.netBuySm ?? 0) >= 0 ? 'text-blue-400' : 'text-red-400'}`}
              >
                {fmtPct((moneyFlow()?.netBuySm ?? 0) / 1e8)}亿
              </div>
            </div>
            <div>
              <div class="text-xs text-gray-400">中单净流入</div>
              <div
                class={`tabular-nums mt-0.5 ${(moneyFlow()?.netBuyMd ?? 0) >= 0 ? 'text-blue-400' : 'text-red-400'}`}
              >
                {fmtPct((moneyFlow()?.netBuyMd ?? 0) / 1e8)}亿
              </div>
            </div>
            <div>
              <div class="text-xs text-gray-400">大单净流入</div>
              <div
                class={`tabular-nums mt-0.5 ${(moneyFlow()?.netBuyLg ?? 0) >= 0 ? 'text-blue-400' : 'text-red-400'}`}
              >
                {fmtPct((moneyFlow()?.netBuyLg ?? 0) / 1e8)}亿
              </div>
            </div>
            <div>
              <div class="text-xs text-gray-400">超大单净流入</div>
              <div
                class={`tabular-nums mt-0.5 ${(moneyFlow()?.netBuyMg ?? 0) >= 0 ? 'text-blue-400' : 'text-red-400'}`}
              >
                {fmtPct((moneyFlow()?.netBuyMg ?? 0) / 1e8)}亿
              </div>
            </div>
          </div>
          <div ref={moneyFlowRef} class="w-full" style={{ height: '160px' }} />
        </div>

        {/* 风险指标 */}
        <Show when={riskMetrics()}>
          <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4 shrink-0">
            <h3 class="font-bold mb-3 text-sm text-gray-300">风险指标</h3>
            <div class="grid grid-cols-5 gap-4 text-sm">
              <div>
                <div class="text-xs text-gray-400">波动率</div>
                <div class="tabular-nums mt-0.5">
                  {(riskMetrics()?.volatility ?? 0).toFixed(2)}%
                </div>
              </div>
              <div>
                <div class="text-xs text-gray-400">Beta</div>
                <div class="tabular-nums mt-0.5">{(riskMetrics()?.beta ?? 0).toFixed(3)}</div>
              </div>
              <div>
                <div class="text-xs text-gray-400">最大回撤</div>
                <div class="tabular-nums mt-0.5 text-red-400">
                  {fmtPct(riskMetrics()?.maxDrawdown)}
                </div>
              </div>
              <div>
                <div class="text-xs text-gray-400">夏普比率</div>
                <div class="tabular-nums mt-0.5 text-blue-400">
                  {(riskMetrics()?.sharpeRatio ?? 0).toFixed(2)}
                </div>
              </div>
              <div>
                <div class="text-xs text-gray-400">VaR(95%)</div>
                <div class="tabular-nums mt-0.5">{fmtPct(riskMetrics()?.var95)}</div>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
};
