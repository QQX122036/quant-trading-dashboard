/**
 * DepthChart.tsx — 买卖深度图（阶梯状深度图）
 * 显示买卖盘各5档价格/数量
 * 使用 ECharts 实现
 */
import ec from '@/lib/echarts';
import type { EChartsType, EChartsCoreOption } from '@/lib/echarts';
import { Component, createSignal, onMount, onCleanup, createEffect, For } from 'solid-js';

export interface DepthLevel {
  price: number;
  volume: number;
}

export interface DepthData {
  bids: DepthLevel[]; // 买单（价格从高到低）
  asks: DepthLevel[]; // 卖单（价格从低到高）
}

interface DepthChartProps {
  tsCode?: string;
  data?: DepthData;
}

// 模拟深度数据（当API无数据时使用）
function mockDepthData(): DepthData {
  const midPrice = 1850.0;
  const bids: DepthLevel[] = [];
  const asks: DepthLevel[] = [];

  for (let i = 0; i < 5; i++) {
    const bidPrice = midPrice - (i + 1) * 0.05;
    const askPrice = midPrice + (i + 1) * 0.05;
    const bidVol = Math.round(8000 - i * 1200 + Math.random() * 500);
    const askVol = Math.round(7500 - i * 1000 + Math.random() * 500);
    bids.push({ price: parseFloat(bidPrice.toFixed(2)), volume: bidVol });
    asks.push({ price: parseFloat(askPrice.toFixed(2)), volume: askVol });
  }

  return { bids, asks };
}

async function fetchDepth(tsCode: string): Promise<DepthData> {
  try {
    const res = await fetch(`/api/data/orderbook?ts_code=${tsCode}`);
    if (res.ok) {
      const json = await res.json();
      if (json.code === '0' && json.data) {
        return json.data as DepthData;
      }
    }
  } catch {
    // ignore error, use mock
  }
  return mockDepthData();
}

export const DepthChart: Component<DepthChartProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  let chart: EChartsType | undefined;

  const [depthData, setDepthData] = createSignal<DepthData>(mockDepthData());
  const [loading, setLoading] = createSignal(false);

  // 构建 ECharts 阶梯图数据
  function buildChartOption(data: DepthData) {
    // 买单（红色，用负数表示在左侧）
    const bidPrices = data.bids.map((d) => d.price);
    // 累计量（从高到低累计）
    const bidCumVols: number[] = [];
    let bidSum = 0;
    for (const b of data.bids) {
      bidSum += b.volume;
      bidCumVols.push(bidSum);
    }

    // 卖单（蓝色，用正数表示在右侧）
    const askPrices = data.asks.map((d) => d.price);
    const askCumVols: number[] = [];
    let askSum = 0;
    for (const a of data.asks) {
      askSum += a.volume;
      askCumVols.push(askSum);
    }

    // ECharts 阶梯图 data[] = [price, cumVolume]
    const bidSeriesData: [number, number][] = bidPrices.map((p, i) => [p, bidCumVols[i]]);
    const askSeriesData: [number, number][] = askPrices.map((p, i) => [p, askCumVols[i]]);

    const allPrices = [...bidPrices, ...askPrices];
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const priceRange = maxPrice - minPrice;

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: (params: any[]) => {
          if (!params.length) return '';
          const p = params[0];
          const side = p.seriesName === '买方深度' ? '买' : '卖';
          return `${side}盘价格: <b>${p.data[0]}</b><br/>累计量: <b>${p.data[1].toLocaleString()}</b>`;
        },
      },
      grid: {
        left: '5%',
        right: '5%',
        top: 20,
        bottom: 40,
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        min: minPrice - priceRange * 0.05,
        max: maxPrice + priceRange * 0.05,
        name: '价格',
        nameLocation: 'end',
        nameTextStyle: { color: '#9CA3AF', fontSize: 11 },
        axisLine: { lineStyle: { color: '#374151' } },
        axisTick: { lineStyle: { color: '#374151' } },
        axisLabel: {
          color: '#9CA3AF',
          fontSize: 10,
          formatter: (v: number) => v.toFixed(2),
        },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      },
      yAxis: {
        type: 'value',
        name: '累计量',
        nameTextStyle: { color: '#9CA3AF', fontSize: 11 },
        axisLine: { lineStyle: { color: '#374151' } },
        axisTick: { lineStyle: { color: '#374151' } },
        axisLabel: {
          color: '#9CA3AF',
          fontSize: 10,
          formatter: (v: number) => v.toLocaleString(),
        },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      },
      series: [
        {
          name: '买方深度',
          type: 'line',
          step: 'end',
          data: bidSeriesData,
          smooth: false,
          lineStyle: { color: '#EF4444', width: 2 },
          itemStyle: { color: '#EF4444' },
          areaStyle: {
            color: new ec.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(239,68,68,0.3)' },
              { offset: 1, color: 'rgba(239,68,68,0.02)' },
            ]),
          },
          symbol: 'circle',
          symbolSize: 6,
        },
        {
          name: '卖方深度',
          type: 'line',
          step: 'start',
          data: askSeriesData,
          smooth: false,
          lineStyle: { color: '#22C55E', width: 2 },
          itemStyle: { color: '#22C55E' },
          areaStyle: {
            color: new ec.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(34,197,94,0.3)' },
              { offset: 1, color: 'rgba(34,197,94,0.02)' },
            ]),
          },
          symbol: 'circle',
          symbolSize: 6,
        },
      ],
    };
  }

  // 渲染5档盘口表格
  function renderOrderBook(data: DepthData) {
    const totalBidVol = data.bids.reduce((s, b) => s + b.volume, 0);
    const totalAskVol = data.asks.reduce((s, a) => s + a.volume, 0);
    const maxVol = Math.max(totalBidVol, totalAskVol);

    return (
      <div class="flex gap-4 text-xs font-mono overflow-hidden">
        {/* 卖盘 */}
        <div class="flex-1 min-w-0">
          <div class="text-center text-gray-400 mb-1 text-[10px]">卖盘</div>
          <div class="space-y-0.5">
            <For each={[...data.asks].reverse()}>
              {(ask) => (
                <div
                  class="flex items-center justify-between px-1 py-0.5 rounded"
                  style={{ background: `rgba(34,197,94,${(ask.volume / maxVol) * 0.3})` }}
                >
                  <span class="text-green-400">{ask.price.toFixed(2)}</span>
                  <span class="text-gray-300">{ask.volume.toLocaleString()}</span>
                </div>
              )}
            </For>
          </div>
        </div>

        {/* 中间价 */}
        <div class="flex flex-col items-center justify-center min-w-[60px]">
          <div class="text-gray-500 text-[10px]">最新价</div>
          <div class="text-white font-bold text-sm">
            {data.bids.length > 0 && data.asks.length > 0
              ? ((data.bids[0].price + data.asks[0].price) / 2).toFixed(2)
              : '—'}
          </div>
          <div class="text-gray-500 text-[10px] mt-0.5">买卖价差</div>
          <div class="text-gray-400 text-xs">
            {data.bids.length > 0 && data.asks.length > 0
              ? (data.asks[0].price - data.bids[0].price).toFixed(2)
              : '—'}
          </div>
        </div>

        {/* 买盘 */}
        <div class="flex-1 min-w-0">
          <div class="text-center text-gray-400 mb-1 text-[10px]">买盘</div>
          <div class="space-y-0.5">
            <For each={data.bids}>
              {(bid) => (
                <div
                  class="flex items-center justify-between px-1 py-0.5 rounded"
                  style={{ background: `rgba(239,68,68,${(bid.volume / maxVol) * 0.3})` }}
                >
                  <span class="text-red-400">{bid.price.toFixed(2)}</span>
                  <span class="text-gray-300">{bid.volume.toLocaleString()}</span>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>
    );
  }

  onMount(async () => {
    if (!containerRef) return;

    chart = ec.init(containerRef, undefined, { renderer: 'canvas' });

    const resizeObserver = new ResizeObserver(() => {
      chart?.resize();
    });
    resizeObserver.observe(containerRef);

    onCleanup(() => {
      resizeObserver.disconnect();
      chart?.dispose();
    });
  });

  createEffect(() => {
    const data = depthData();
    if (chart && data) {
      chart.setOption(buildChartOption(data));
    }
  });

  // 外部传入data或加载
  if (props.data) {
    setDepthData(props.data);
  } else {
    setLoading(true);
    fetchDepth(props.tsCode || '600519.SSE').then((d) => {
      setDepthData(d);
      setLoading(false);
    });
  }

  return (
    <div class="relative w-full h-full flex flex-col">
      {/* 盘口表格 */}
      <div class="flex-shrink-0 px-2 py-1">{renderOrderBook(depthData())}</div>

      {/* 深度图 */}
      <div ref={containerRef} class="flex-1 min-h-0 w-full" />

      {loading() && (
        <div class="absolute inset-0 flex items-center justify-center bg-black/40 z-10">
          <span class="text-gray-400 text-xs">加载中...</span>
        </div>
      )}
    </div>
  );
};
