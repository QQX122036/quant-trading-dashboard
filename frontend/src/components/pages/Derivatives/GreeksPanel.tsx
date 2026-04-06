/**
 * GreeksPanel.tsx — Greeks风险面板
 * Delta / Gamma / Vega / Rho 仪表盘
 * Delta：价格敏感度（标的变动1元，期权价格变动）
 * Gamma：Delta变化率（标的变动1元，Delta变化）
 * Vega：波动率敏感度（波动率变动1%，期权价格变动）
 * Rho：利率敏感度（利率变动1%，期权价格变动）
 */
import { Component, createSignal, createEffect, onMount, onCleanup, For } from 'solid-js';
import * as echarts from 'echarts';

interface GreeksData {
  delta: number;    // 范围约 -1 到 1
  gamma: number;    // 范围约 0 到 0.1
  vega: number;     // 范围约 0 到 1
  rho: number;      // 范围约 -0.5 到 0.5
  theta: number;     // 范围约 -1 到 0
  iv: number;       // 隐含波动率 0-100%
  markPrice: number; // 期权标记价格
  theoreticalPrice: number; // 理论价格
  intrinsicValue: number;  // 内在价值
  timeValue: number;       // 时间价值
}

function generateMockGreeks(): GreeksData {
  return {
    delta: 0.452,
    gamma: 0.0032,
    vega: 0.182,
    rho: 0.084,
    theta: -0.045,
    iv: 22.5,
    markPrice: 0.385,
    theoreticalPrice: 0.380,
    intrinsicValue: 0.120,
    timeValue: 0.265,
  };
}

function createGaugeOption(
  value: number,
  name: string,
  min: number,
  max: number,
  unit: string,
  normalRange: [number, number],
  accentColor: string
): echarts.EChartsOption {
  const pct = ((value - min) / (max - min)) * 100;
  const inRange = value >= normalRange[0] && value <= normalRange[1];
  const color = inRange ? accentColor : '#EF4444';

  return {
    backgroundColor: 'transparent',
    series: [
      {
        type: 'gauge',
        startAngle: 200,
        endAngle: -20,
        radius: '90%',
        center: ['50%', '65%'],
        min,
        max,
        splitNumber: 4,
        axisLine: {
          lineStyle: {
            width: 6,
            color: [
              [(normalRange[0] - min) / (max - min), 'rgba(255,255,255,0.1)'],
              [(normalRange[1] - min) / (max - min), color],
              [1, 'rgba(255,255,255,0.1)'],
            ],
          },
        },
        pointer: {
          icon: 'path://M12.8,0.7l12,40.1H0.7L12.8,0.7z',
          length: '60%',
          width: 6,
          offsetCenter: [0, '-10%'],
          itemStyle: { color },
        },
        axisTick: { length: 4, lineStyle: { color: 'auto', width: 1 } },
        splitLine: { length: 8, lineStyle: { color: 'auto', width: 1 } },
        axisLabel: {
          color: '#9ca3af',
          fontSize: 9,
          distance: -28,
          formatter: (v: number) => v.toFixed(2),
        },
        title: {
          offsetCenter: [0, '30%'],
          fontSize: 10,
          color: '#6b7280',
        },
        detail: {
          offsetCenter: [0, '95%'],
          fontSize: 13,
          fontWeight: 'bold',
          formatter: `{value}${unit}`,
          color: '#e5e7eb',
        },
        data: [{ value, name }],
      },
    ],
  };
}

const GreekCard: Component<{
  title: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  normalRange: [number, number];
  accentColor: string;
  description: string;
}> = (props) => {
  let chartRef: HTMLDivElement | undefined;
  let chart: echarts.ECharts | undefined;

  onMount(() => {
    if (!chartRef) return;
    chart = echarts.init(chartRef, 'dark');
    chart.setOption(
      createGaugeOption(
        props.value,
        props.title,
        props.min,
        props.max,
        props.unit,
        props.normalRange,
        props.accentColor
      )
    );
    const ro = new ResizeObserver(() => chart?.resize());
    ro.observe(chartRef);
    onCleanup(() => { ro.disconnect(); chart?.dispose(); });
  });

  createEffect(() => {
    if (!chart) return;
    chart.setOption(
      createGaugeOption(
        props.value,
        props.title,
        props.min,
        props.max,
        props.unit,
        props.normalRange,
        props.accentColor
      )
    );
  });

  return (
    <div class="flex flex-col bg-[#111827]/80 rounded-lg border border-white/10 p-3 min-w-[180px]">
      <div class="text-xs text-gray-400 mb-1">{props.title}</div>
      <div ref={chartRef} class="h-36" />
      <div class="text-[10px] text-gray-600 mt-1 text-center">{props.description}</div>
    </div>
  );
};

export const GreeksPanel: Component = () => {
  const [greeks, setGreeks] = createSignal<GreeksData>(generateMockGreeks());
  const [position, setPosition] = createSignal('Long Call'); // 多头买入看涨期权
  const [theoPnl, setTheoPnl] = createSignal(1250.50);
  const [deltaPnl, setDeltaPnl] = createSignal(830.20);
  const [gammaPnl, setGammaPnl] = createSignal(210.30);
  const [vegaPnl, setVegaPnl] = createSignal(150.80);
  const [thetaPnl, setThetaPnl] = createSignal(-65.40);
  const [rhoPnl, setRhoPnl] = createSignal(25.60);

  let thetaChartRef: HTMLDivElement | undefined;
  let thetaChart: echarts.ECharts | undefined;

  onMount(() => {
    if (!thetaChartRef) return;
    thetaChart = echarts.init(thetaChartRef, 'dark');

    // Theta decay chart: value vs time to expiration
    const daysToExp = Array.from({ length: 30 }, (_, i) => i);
    const thetaValue = daysToExp.map((d) => -(0.5 / (d + 1) + 0.02) * (d < 7 ? 2 : 1));

    thetaChart.setOption({
      backgroundColor: 'transparent',
      grid: { top: 20, right: 15, bottom: 30, left: 50 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1f2937',
        borderColor: '#374151',
        textStyle: { color: '#e5e7eb', fontSize: 11 },
        formatter: (params: any) => `剩余${params[0].axisValue}天: <b>${params[0].value.toFixed(4)}</b>`,
      },
      xAxis: {
        type: 'category',
        data: daysToExp,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: '#6b7280', fontSize: 9 },
        name: '距到期天数',
        nameLocation: 'center',
        nameGap: 22,
        nameTextStyle: { color: '#6b7280', fontSize: 9 },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisLabel: { color: '#6b7280', fontSize: 9 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      series: [{
        type: 'line',
        data: thetaValue,
        smooth: true,
        lineStyle: { color: '#8B5CF6', width: 2 },
        itemStyle: { color: '#8B5CF6' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(139,92,246,0.2)' },
            { offset: 1, color: 'rgba(139,92,246,0)' },
          ]),
        },
        markLine: {
          silent: true,
          lineStyle: { color: 'rgba(255,255,255,0.2)', type: 'dashed' },
          data: [{ yAxis: 0, name: '价值=0' }],
        },
      }],
    } as echarts.EChartsOption);

    const ro = new ResizeObserver(() => thetaChart?.resize());
    ro.observe(thetaChartRef);

    // Simulate real-time update
    const interval = setInterval(() => {
      setGreeks((g) => ({
        ...g,
        delta: +(g.delta + (Math.random() - 0.5) * 0.002).toFixed(4),
        gamma: +(g.gamma + (Math.random() - 0.5) * 0.0001).toFixed(4),
        vega: +(g.vega + (Math.random() - 0.5) * 0.005).toFixed(4),
        theta: +(g.theta - 0.001).toFixed(4),
      }));
    }, 3000);

    onCleanup(() => {
      ro.disconnect();
      thetaChart?.dispose();
      clearInterval(interval);
    });
  });

  const g = greeks();

  return (
    <div class="flex flex-col h-full p-4 gap-4">
      {/* Header */}
      <div class="flex items-center justify-between">
        <h3 class="font-bold text-sm">Greeks 风险面板</h3>
        <div class="flex items-center gap-4 text-xs">
          <span class="text-gray-400">
            持仓: <span class="text-white">{position()}</span>
          </span>
          <span class="text-gray-400">
            隐含波动率: <span class="text-yellow-400 font-mono">{g.iv.toFixed(1)}%</span>
          </span>
          <span class="text-gray-400">
            标记价格: <span class="text-green-400 font-mono">{g.markPrice.toFixed(3)}</span>
          </span>
          <select
            class="bg-white/10 text-xs rounded px-2 py-1 border border-white/10"
            value={position()}
            onChange={(e) => setPosition(e.target.value)}
          >
            <For each={['Long Call', 'Long Put', 'Short Call', 'Short Put', 'Bull Spread', 'Bear Spread', 'Straddle']}>
              {(p) => <option value={p}>{p}</option>}
            </For>
          </select>
        </div>
      </div>

      {/* Main: Greeks gauges */}
      <div class="flex gap-3 overflow-x-auto pb-1">
        <GreekCard
          title="Delta"
          value={g.delta}
          min={-1} max={1}
          unit=""
          normalRange={[-0.5, 0.5]}
          accentColor="#3B82F6"
          description="标的价格变动1元，期权价格变动"
        />
        <GreekCard
          title="Gamma"
          value={g.gamma}
          min={0} max={0.05}
          unit=""
          normalRange={[0, 0.02]}
          accentColor="#22C55E"
          description="标的价格变动1元，Delta变化"
        />
        <GreekCard
          title="Vega"
          value={g.vega}
          min={0} max={0.5}
          unit=""
          normalRange={[0.05, 0.3]}
          accentColor="#F59E0B"
          description="波动率变动1%，价格变动"
        />
        <GreekCard
          title="Rho"
          value={g.rho}
          min={-0.5} max={0.5}
          unit=""
          normalRange={[-0.2, 0.2]}
          accentColor="#EC4899"
          description="利率变动1%，价格变动"
        />
        <GreekCard
          title="Theta"
          value={g.theta}
          min={-0.2} max={0}
          unit=""
          normalRange={[-0.1, -0.01]}
          accentColor="#8B5CF6"
          description="每日时间价值衰减"
        />
      </div>

      {/* Bottom: Price decomposition + Theta chart */}
      <div class="flex-1 flex gap-3 min-h-0">
        {/* Left: Price decomposition */}
        <div class="w-72 bg-[#111827]/80 rounded-lg border border-white/10 p-4">
          <div class="text-xs font-bold mb-3">期权价格分解</div>
          <div class="space-y-3">
            <PriceBar label="标记价格" value={g.markPrice} color="#22C55E" />
            <PriceBar label="理论价格" value={g.theoreticalPrice} color="#3B82F6" />
            <PriceBar label="内在价值" value={g.intrinsicValue} color="#F59E0B" />
            <PriceBar label="时间价值" value={g.timeValue} color="#8B5CF6" />

            <div class="border-t border-white/10 pt-3 mt-3">
              <div class="text-[10px] text-gray-500 mb-2">希腊字母盈亏分解</div>
              <div class="grid grid-cols-2 gap-2 text-xs">
                <PnlItem label="理论盈亏" value={theoPnl()} color="#22C55E" />
                <PnlItem label="Delta盈亏" value={deltaPnl()} color="#3B82F6" />
                <PnlItem label="Gamma盈亏" value={gammaPnl()} color="#22C55E" />
                <PnlItem label="Vega盈亏" value={vegaPnl()} color="#F59E0B" />
                <PnlItem label="Theta盈亏" value={thetaPnl()} color="#8B5CF6" />
                <PnlItem label="Rho盈亏" value={rhoPnl()} color="#EC4899" />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Theta decay chart */}
        <div class="flex-1 bg-[#111827]/80 rounded-lg border border-white/10 flex flex-col">
          <div class="px-4 py-2 border-b border-white/10 flex items-center justify-between">
            <span class="text-xs font-bold">Theta 衰减曲线</span>
            <span class="text-[10px] text-gray-500">期权价值 vs 距到期天数</span>
          </div>
          <div ref={thetaChartRef} class="flex-1 min-h-[160px]" />
        </div>
      </div>
    </div>
  );
};

const PriceBar: Component<{ label: string; value: number; color: string }> = (props) => (
  <div>
    <div class="flex justify-between text-xs mb-1">
      <span class="text-gray-400">{props.label}</span>
      <span class="text-white font-mono">{props.value.toFixed(3)}</span>
    </div>
    <div class="h-1.5 bg-white/10 rounded-full overflow-hidden">
      <div
        class="h-full rounded-full transition-all"
        style={{ width: `${Math.min(100, props.value * 100)}%`, background: props.color }}
      />
    </div>
  </div>
);

const PnlItem: Component<{ label: string; value: number; color: string }> = (props) => (
  <div class="flex justify-between">
    <span class="text-gray-500 text-[10px]">{props.label}</span>
    <span class={`font-mono text-[10px] ${props.value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
      {props.value >= 0 ? '+' : ''}{props.value.toFixed(2)}
    </span>
  </div>
);
