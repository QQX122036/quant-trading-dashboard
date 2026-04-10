import { Component, onMount, onCleanup, createEffect } from 'solid-js';
import type * as EChartsType from 'echarts/core';
import type { ECharts } from 'echarts';

export interface YieldChartProps {
  equityCurve?: Array<{ date: string; equity: number; benchmark: number }>;
  loading?: boolean;
}

export const YieldChart: Component<YieldChartProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  let chart: ECharts | undefined;

  const getOption = (): echarts.EChartsCoreOption => {
    const curve = props.equityCurve;
    if (!curve || curve.length === 0) {
      return getEmptyOption();
    }

    // Calculate % return from initial capital
    const initialEquity = curve[0]?.equity || 1;
    const strategyReturns = curve.map((d) => ({
      date: d.date,
      value: parseFloat(((d.equity / initialEquity - 1) * 100).toFixed(2)),
    }));
    const benchmarkReturns = curve.map((d) => ({
      date: d.date,
      value: parseFloat(((d.benchmark / initialEquity - 1) * 100).toFixed(2)),
    }));

    return {
      backgroundColor: 'transparent',
      grid: {
        left: '5%',
        right: '5%',
        top: '12%',
        bottom: '12%',
        containLabel: true,
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1f2937',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#fff' },
        formatter: (params: unknown) => {
          const arr = params as Array<{
            axisValue: string;
            seriesName: string;
            value: number;
            color: string;
          }>;
          if (!arr?.length) return '';
          const date = `<div style="font-size:11px;color:#9CA3AF;margin-bottom:4px">${arr[0].axisValue}</div>`;
          return (
            date +
            arr
              .map((p) => {
                const color = p.seriesName === '策略收益' ? '#3B82F6' : '#6B7280';
                const sign = p.value >= 0 ? '+' : '';
                return `<div style="display:flex;justify-content:space-between;gap:16px"><span style="color:${color}">${p.seriesName}</span><span style="color:${color}">${sign}${p.value}%</span></div>`;
              })
              .join('')
          );
        },
      },
      legend: {
        data: ['策略收益', '基准收益'],
        textStyle: { color: '#9CA3AF' },
        top: 0,
      },
      xAxis: {
        type: 'category',
        data: strategyReturns.map((d) => d.date),
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: {
          color: '#9CA3AF',
          fontSize: 11,
          formatter: (v: string) => v.slice(5), // MM-DD
        },
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: {
          color: '#9CA3AF',
          formatter: (v: number) => `${v > 0 ? '+' : ''}${v}%`,
          fontSize: 11,
        },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      series: [
        {
          name: '策略收益',
          type: 'line',
          smooth: true,
          data: strategyReturns.map((d) => d.value),
          lineStyle: { color: '#3B82F6', width: 2 },
          itemStyle: { color: '#3B82F6' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0)' },
            ]),
          },
        },
        {
          name: '基准收益',
          type: 'line',
          smooth: true,
          data: benchmarkReturns.map((d) => d.value),
          lineStyle: { color: '#6B7280', width: 2, type: 'dashed' },
          itemStyle: { color: '#6B7280' },
        },
      ],
    };
  };

  const getEmptyOption = (): echarts.EChartsCoreOption => ({
    backgroundColor: 'transparent',
    grid: { left: '5%', right: '5%', top: '10%', bottom: '10%', containLabel: true },
    xAxis: { type: 'category', data: [] },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      axisLabel: { color: '#9CA3AF' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
    },
    series: [
      {
        name: '策略收益',
        type: 'line',
        smooth: true,
        data: [],
        lineStyle: { color: '#3B82F6', width: 2 },
      },
    ],
  });

  onMount(async () => {
    const _ec = await import('@/lib/echarts');
    const echarts = _ec.default;    if (!containerRef) return;
    chart = echarts.init(containerRef, 'dark');
    chart.setOption(getOption());

    const resizeObserver = new ResizeObserver(() => chart?.resize());
    resizeObserver.observe(containerRef);

    onCleanup(() => {
      resizeObserver.disconnect();
      chart?.dispose();
    });
  });

  createEffect(() => {
    // track prop changes
    void props.equityCurve;
    if (chart) {
      chart.setOption(getOption(), true);
    }
  });

  return (
    <div
      ref={containerRef}
      class="w-full h-full"
      style={props.loading ? 'opacity:0.5' : 'opacity:1'}
    />
  );
};
