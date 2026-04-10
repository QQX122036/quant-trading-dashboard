/**
 * DashboardCharts.tsx — 账户收益走势图 + 持仓收益分布饼图
 * - ECharts 折线图（近30日）
 * - 持仓收益分布饼图（按行业/按个股）
 */
import { Component, createSignal, onMount, onCleanup } from 'solid-js';
import type * as EChartsType from 'echarts/core';
import type { ECharts } from 'echarts';

export const DashboardCharts: Component = () => {
  let lineRef: HTMLDivElement | undefined;
  let pieRef: HTMLDivElement | undefined;
  let lineChart: ECharts | null = null;
  let pieChart: ECharts | null = null;
  const [mode, setMode] = createSignal<'line' | 'pie'>('line');

  onMount(async () => {
    const _ec = await import('@/lib/echarts');
    const echarts = _ec.default;    if (lineRef) {
      lineChart = echarts.init(lineRef, 'dark');
      renderLineChart();
    }
    if (pieRef) {
      pieChart = echarts.init(pieRef, 'dark');
      renderPieChart();
    }

    const handleResize = () => {
      lineChart?.resize();
      pieChart?.resize();
    };
    window.addEventListener('resize', handleResize);
    onCleanup(() => {
      window.removeEventListener('resize', handleResize);
      lineChart?.dispose();
      pieChart?.dispose();
    });
  });

  // 模拟近30日收益数据
  function getEquityCurve(): { dates: string[]; values: number[] } {
    const dates: string[] = [];
    const values: number[] = [];
    let base = 100000;
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dates.push(`${d.getMonth() + 1}/${d.getDate()}`);
      base = base * (1 + (Math.random() - 0.45) * 0.02);
      values.push(Math.round(base * 100) / 100);
    }
    return { dates, values };
  }

  function renderLineChart() {
    if (!lineChart) return;
    const { dates, values } = getEquityCurve();
    lineChart.setOption(
      {
        backgroundColor: 'transparent',
        grid: { top: 10, right: 10, bottom: 24, left: 50 },
        tooltip: {
          trigger: 'axis',
          backgroundColor: '#1f2937',
          borderColor: '#374151',
          textStyle: { color: '#e5e7eb', fontSize: 11 },
          formatter: (params: unknown) => {
            const p = (params as Array<{ name: string; value: number }>)[0];
            return `${p.name}<br/><strong>¥${p.value.toLocaleString()}</strong>`;
          },
        },
        xAxis: {
          type: 'category',
          data: dates,
          axisLine: { lineStyle: { color: '#374151' } },
          axisLabel: { color: '#6b7280', fontSize: 9, interval: 4 },
          splitLine: { show: false },
        },
        yAxis: {
          type: 'value',
          axisLine: { show: false },
          axisLabel: {
            color: '#6b7280',
            fontSize: 9,
            formatter: (v: number) => `¥${(v / 10000).toFixed(0)}w`,
          },
          splitLine: { lineStyle: { color: '#1f2937' } },
        },
        series: [
          {
            type: 'line',
            data: values,
            smooth: true,
            symbol: 'none',
            lineStyle: { color: '#3b82f6', width: 2 },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(59,130,246,0.3)' },
                { offset: 1, color: 'rgba(59,130,246,0)' },
              ]),
            },
          },
        ],
      },
      true
    );
  }

  function renderPieChart() {
    if (!pieChart) return;
    // 按行业模拟分布
    const pieData = [
      { name: '白酒', value: 35 },
      { name: '银行', value: 20 },
      { name: '保险', value: 15 },
      { name: '房地产', value: 12 },
      { name: '其他', value: 18 },
    ];
    pieChart.setOption(
      {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'item',
          backgroundColor: '#1f2937',
          borderColor: '#374151',
          textStyle: { color: '#e5e7eb', fontSize: 11 },
          formatter: '{b}: {d}%',
        },
        series: [
          {
            type: 'pie',
            radius: ['40%', '70%'],
            center: ['50%', '50%'],
            label: { show: true, fontSize: 9, color: '#9ca3af', formatter: '{b} {d}%' },
            labelLine: { show: true },
            data: pieData.map((d, i) => ({
              ...d,
              itemStyle: { color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][i] },
            })),
          },
        ],
      },
      true
    );
  }

  return (
    <div class="h-full flex flex-col">
      {/* Tab switcher */}
      <div class="flex items-center px-3 pt-1.5 pb-1 gap-1 flex-shrink-0">
        <button
          class="px-2 py-0.5 rounded text-[10px] font-medium"
          classList={{
            'bg-blue-600 text-white': mode() === 'line',
            'bg-white/5 text-gray-400': mode() !== 'line',
          }}
          onClick={() => {
            setMode('line');
            setTimeout(() => lineChart?.resize(), 10);
          }}
        >
          收益走势
        </button>
        <button
          class="px-2 py-0.5 rounded text-[10px] font-medium"
          classList={{
            'bg-blue-600 text-white': mode() === 'pie',
            'bg-white/5 text-gray-400': mode() !== 'pie',
          }}
          onClick={() => {
            setMode('pie');
            setTimeout(() => pieChart?.resize(), 10);
          }}
        >
          持仓分布
        </button>
        <div class="ml-auto text-[9px] text-gray-600">近30日</div>
      </div>

      {/* Charts */}
      <div class="flex-1 relative min-h-0">
        <div
          ref={lineRef}
          class="absolute inset-0"
          style={{ display: mode() === 'line' ? 'block' : 'none' }}
        />
        <div
          ref={pieRef}
          class="absolute inset-0"
          style={{ display: mode() === 'pie' ? 'block' : 'none' }}
        />
      </div>
    </div>
  );
};
