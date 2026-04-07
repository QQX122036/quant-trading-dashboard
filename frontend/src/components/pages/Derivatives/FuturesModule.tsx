/**
 * FuturesModule.tsx — 期货模块
 * 主力/次主力合约、升贴水分析、跨期价差图
 */
import { Component, createSignal, createMemo, onMount, For, Show } from 'solid-js';
import * as echarts from 'echarts';

interface FuturesContract {
  symbol: string;
  name: string;
  exchange: string;
  mainContract: string;
  subContract: string;
  latestPrice: number;
  prevSettlement: number;
  change: number;
  changePct: number;
  volume: number;
  openInterest: number;
  spotPrice: number;
  nearMonthPremium: number; // 近月-现货
  farMonthPremium: number; // 远月-近月
}

function generateMockFutures(): FuturesContract[] {
  const contracts: FuturesContract[] = [
    { symbol: 'IF', name: '沪深300期货', exchange: 'CFFEX', mainContract: 'IF2506', subContract: 'IF2509', latestPrice: 3850.2, prevSettlement: 3832.0, change: 18.2, changePct: 0.47, volume: 120543, openInterest: 234567, spotPrice: 3835.0, nearMonthPremium: 15.2, farMonthPremium: 8.4 },
    { symbol: 'IC', name: '中证500期货', exchange: 'CFFEX', mainContract: 'IC2506', subContract: 'IC2509', latestPrice: 5620.4, prevSettlement: 5580.0, change: 40.4, changePct: 0.72, volume: 87654, openInterest: 189432, spotPrice: 5590.0, nearMonthPremium: 30.4, farMonthPremium: 15.6 },
    { symbol: 'IH', name: '上证50期货', exchange: 'CFFEX', mainContract: 'IH2506', subContract: 'IH2509', latestPrice: 2680.5, prevSettlement: 2665.0, change: 15.5, changePct: 0.58, volume: 54321, openInterest: 98765, spotPrice: 2670.0, nearMonthPremium: 10.5, farMonthPremium: 5.2 },
    { symbol: 'IM', name: '中证1000期货', exchange: 'CFFEX', mainContract: 'IM2506', subContract: 'IM2509', latestPrice: 6240.8, prevSettlement: 6190.0, change: 50.8, changePct: 0.82, volume: 65432, openInterest: 145678, spotPrice: 6200.0, nearMonthPremium: 40.8, farMonthPremium: 22.3 },
    { symbol: 'T', name: '10年国债期货', exchange: 'CFFEX', mainContract: 'T2506', subContract: 'T2509', latestPrice: 106.520, prevSettlement: 106.480, change: 0.040, changePct: 0.038, volume: 32145, openInterest: 87654, spotPrice: 106.400, nearMonthPremium: 0.120, farMonthPremium: 0.085 },
    { symbol: 'RU', name: '橡胶期货', exchange: 'SHFE', mainContract: 'RU2506', subContract: 'RU2509', latestPrice: 14850, prevSettlement: 14780, change: 70, changePct: 0.47, volume: 43210, openInterest: 56789, spotPrice: 14820, nearMonthPremium: 30, farMonthPremium: 45 },
    { symbol: 'CU', name: '沪铜期货', exchange: 'SHFE', mainContract: 'CU2506', subContract: 'CU2509', latestPrice: 76500, prevSettlement: 76200, change: 300, changePct: 0.39, volume: 34567, openInterest: 43210, spotPrice: 76300, nearMonthPremium: 200, farMonthPremium: 120 },
    { symbol: 'AU', name: '沪金期货', exchange: 'SHFE', mainContract: 'AU2506', subContract: 'AU2509', latestPrice: 682.5, prevSettlement: 680.0, change: 2.5, changePct: 0.37, volume: 23456, openInterest: 34567, spotPrice: 681.0, nearMonthPremium: 1.5, farMonthPremium: 0.8 },
  ];
  return contracts;
}

// 跨期价差模拟数据（近月-远月）
function generateSpreadData(_symbol: string): { dates: string[]; spread: number[] } {
  const dates: string[] = [];
  const spread: number[] = [];
  const now = new Date('2026-04-05');
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10).replace(/-/g, ''));
    spread.push(Math.round((Math.random() - 0.5) * 50 + 20));
  }
  return { dates, spread };
}

export const FuturesModule: Component = () => {
  const [contracts] = createSignal<FuturesContract[]>(generateMockFutures());
  const [selectedSymbol, setSelectedSymbol] = createSignal('IF');
  let spreadChartRef: HTMLDivElement | undefined;
  let spreadChart: echarts.ECharts | undefined;

  const selectedContract = createMemo(() =>
    contracts().find((c) => c.symbol === selectedSymbol()) || contracts()[0]
  );

  const formatVolume = (v: number) => v >= 10000 ? `${(v / 10000).toFixed(1)}万` : String(v);
  const formatOI = (v: number) => v >= 10000 ? `${(v / 10000).toFixed(1)}万` : String(v);

  const premiumColor = (v: number) => v >= 0 ? 'text-red-400' : 'text-green-400';
  const premiumPrefix = (v: number) => v >= 0 ? '+' : '';

  onMount(() => {
    if (!spreadChartRef) return;
    spreadChart = echarts.init(spreadChartRef, 'dark');

    const { dates, spread } = generateSpreadData(selectedSymbol());
    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      grid: { top: 30, right: 20, bottom: 30, left: 60 },
      tooltip: { trigger: 'axis', backgroundColor: '#1f2937', borderColor: '#374151', textStyle: { color: '#e5e7eb', fontSize: 12 } },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: '#9ca3af', fontSize: 10, formatter: (v: string) => v.slice(4) },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisLabel: { color: '#9ca3af', fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      series: [{
        type: 'line',
        data: spread,
        smooth: true,
        lineStyle: { color: '#3B82F6', width: 2 },
        itemStyle: { color: '#3B82F6' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(59,130,246,0.3)' },
            { offset: 1, color: 'rgba(59,130,246,0)' },
          ]),
        },
        markLine: {
          silent: true,
          lineStyle: { color: 'rgba(255,255,255,0.2)', type: 'dashed' },
          data: [{ yAxis: 0, name: '升贴水=0' }],
        },
      }],
    };
    spreadChart.setOption(option);

    const ro = new ResizeObserver(() => spreadChart?.resize());
    ro.observe(spreadChartRef);
    return () => { ro.disconnect(); spreadChart?.dispose(); };
  });

  return (
    <div class="flex flex-col h-full gap-3 p-4">
      {/* Header */}
      <div class="flex items-center justify-between">
        <h3 class="font-bold text-sm">期货行情</h3>
        <div class="flex gap-1">
          <For each={contracts()}>
            {(c) => (
              <button
                class={`px-2 py-1 text-xs rounded transition-colors ${selectedSymbol() === c.symbol ? 'bg-blue-600 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'}`}
                onClick={() => setSelectedSymbol(c.symbol)}
              >
                {c.symbol}
              </button>
            )}
          </For>
        </div>
      </div>

      {/* Contract cards */}
      <div class="grid grid-cols-4 gap-3">
        <For each={contracts().slice(0, 4)}>
          {(c) => (
            <div
              class={`bg-[#111827]/80 rounded-lg border p-3 cursor-pointer transition-colors ${selectedSymbol() === c.symbol ? 'border-blue-500/50' : 'border-white/10'} hover:border-white/20`}
              onClick={() => setSelectedSymbol(c.symbol)}
            >
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold text-white">{c.symbol}</span>
                <span class="text-[10px] text-gray-500">{c.exchange}</span>
              </div>
              <div class="text-sm font-mono font-bold text-white">{c.latestPrice.toFixed(c.symbol === 'T' || c.symbol === 'AU' ? 3 : 2)}</div>
              <div class="flex items-center gap-2 mt-1">
                <span class={`text-xs font-mono ${c.change >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {premiumPrefix(c.change)}{c.change.toFixed(2)} ({premiumPrefix(c.changePct)}{c.changePct.toFixed(2)}%)
                </span>
              </div>
              <div class="flex justify-between mt-2 text-[10px] text-gray-500">
                <span>成交量: {formatVolume(c.volume)}</span>
                <span>持仓量: {formatOI(c.openInterest)}</span>
              </div>
            </div>
          )}
        </For>
      </div>

      {/* Main content: spread chart + premium table */}
      <div class="flex-1 flex gap-3 min-h-0">
        {/* Left: spread chart */}
        <div class="flex-1 flex flex-col bg-[#111827]/80 rounded-lg border border-white/10">
          <div class="px-4 py-2 border-b border-white/10 flex items-center justify-between">
            <span class="text-xs font-bold">跨期价差 ({selectedContract().mainContract} - {selectedContract().subContract})</span>
            <span class="text-[10px] text-gray-500">近月-远月</span>
          </div>
          <div ref={spreadChartRef} class="flex-1 min-h-[180px]" />
        </div>

        {/* Right: premium analysis */}
        <div class="w-80 flex flex-col gap-3">
          {/* 升贴水分析 */}
          <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-3">
            <div class="text-xs font-bold mb-3">升贴水分析</div>
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-400">近月-现货</span>
                <span class={`text-xs font-mono font-bold ${premiumColor(selectedContract().nearMonthPremium)}`}>
                  {premiumPrefix(selectedContract().nearMonthPremium)}{selectedContract().nearMonthPremium.toFixed(2)}
                </span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-400">远月-近月</span>
                <span class={`text-xs font-mono font-bold ${premiumColor(selectedContract().farMonthPremium)}`}>
                  {premiumPrefix(selectedContract().farMonthPremium)}{selectedContract().farMonthPremium.toFixed(2)}
                </span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-400">现货价格</span>
                <span class="text-xs font-mono text-white">{selectedContract().spotPrice.toFixed(2)}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-400">年化升水率</span>
                <span class={`text-xs font-mono font-bold ${premiumColor(selectedContract().nearMonthPremium / selectedContract().spotPrice * 12)}`}>
                  {((selectedContract().nearMonthPremium / selectedContract().spotPrice) * 12 * 100).toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          {/* Contract details */}
          <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-3 flex-1">
            <div class="text-xs font-bold mb-2">合约详情</div>
            <div class="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
              <span class="text-gray-500">主力合约</span>
              <span class="text-white font-mono">{selectedContract().mainContract}</span>
              <span class="text-gray-500">次主力</span>
              <span class="text-white font-mono">{selectedContract().subContract}</span>
              <span class="text-gray-500">交易所</span>
              <span class="text-white">{selectedContract().exchange}</span>
              <span class="text-gray-500">品种名称</span>
              <span class="text-white">{selectedContract().name}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
