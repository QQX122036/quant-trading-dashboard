/**
 * BacktestProgress.tsx — 回测进度可视化
 * ECharts进度条、ETA倒计时、轮询状态、完成跳转
 */
import { Component, createSignal, onCleanup, Show, createEffect } from 'solid-js';
import echarts from '@/lib/echarts';
import { useNavigate } from '@solidjs/router';
import { getBacktestProgress, getBacktestResult } from '../../hooks/useApi';

interface BacktestProgressProps {
  taskId: string;
  onComplete?: (result: unknown) => void;
}

const _ESTIMATES: Record<string, number> = {
  momentum: 30,
  'dual-ma': 20,
  boll: 25,
  'r-breaker': 40,
};

export const BacktestProgress: Component<BacktestProgressProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  let chart: echarts.ECharts | undefined;
  const navigate = useNavigate();

  const [status, setStatus] = createSignal<'pending' | 'running' | 'completed' | 'failed'>(
    'pending'
  );
  const [_progress, setProgress] = createSignal(0);
  const [message, setMessage] = createSignal('等待启动...');
  const [eta, setEta] = createSignal<number | null>(null);
  const [elapsed, setElapsed] = createSignal(0);
  const [startTime, setStartTime] = createSignal<number | null>(null);

  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let tickerTimer: ReturnType<typeof setInterval> | null = null;
  let isStopped = false; // 停止标志

  const _updateChart = (pct: number, _msg: string) => {
    if (!chart) return;
    chart.setOption({
      series: [
        {
          type: 'gauge',
          startAngle: 200,
          endAngle: -20,
          min: 0,
          max: 100,
          splitNumber: 5,
          radius: '90%',
          center: ['50%', '55%'],
          axisLine: {
            lineStyle: {
              width: 8,
              color: [
                [
                  pct / 100,
                  new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                    { offset: 0, color: '#3B82F6' },
                    { offset: 1, color: '#6366F1' },
                  ]),
                ],
                [1, 'rgba(255,255,255,0.08)'],
              ],
            },
          },
          pointer: {
            icon: 'circle',
            length: '60%',
            width: 6,
            offsetCenter: [0, '-5%'],
            itemStyle: { color: '#60A5FA' },
          },
          axisTick: {
            distance: -12,
            length: 4,
            lineStyle: { color: 'rgba(255,255,255,0.2)', width: 1 },
          },
          splitLine: {
            distance: -14,
            length: 8,
            lineStyle: { color: 'rgba(255,255,255,0.25)', width: 2 },
          },
          axisLabel: {
            color: 'rgba(255,255,255,0.4)',
            fontSize: 10,
            distance: 18,
            formatter: '{value}%',
          },
          detail: {
            valueAnimation: true,
            formatter: (v: number) => `{a|${v.toFixed(0)}%}`,
            rich: {
              a: {
                fontSize: 28,
                fontWeight: 'bold',
                color: '#60A5FA',
                fontFamily: 'JetBrains Mono, monospace',
              },
            },
            offsetCenter: [0, '35%'],
          },
          title: { show: false },
          data: [{ value: pct }],
        },
      ],
    });
  };

  const poll = async () => {
    // 如果已停止，不再轮询
    if (isStopped || status() === 'completed' || status() === 'failed') return;
    try {
      const res = await getBacktestProgress(props.taskId);
      console.log('[BacktestProgress] API response:', res);
      if (!res.data) {
        console.warn('[BacktestProgress] No data in response');
        return;
      }
      const d = res.data;
      console.log('[BacktestProgress] Status:', d.status, 'Progress:', d.progress, 'Message:', d.message);
      setStatus(d.status as 'pending' | 'running' | 'completed' | 'failed');
      setProgress(d.progress ?? 0);
      setMessage(d.message || '处理中...');

      if (d.status === 'running') {
        // 运行中：1 秒轮询一次
        pollTimer = setTimeout(poll, 1000);
      } else if (d.status === 'pending') {
        // 等待中：2 秒轮询一次
        pollTimer = setTimeout(poll, 2000);
      } else if (d.status === 'completed') {
        // 完成：获取结果并跳转
        isStopped = true;
        const resultRes = await getBacktestResult(props.taskId);
        props.onComplete?.(resultRes.data);
        navigate('/backtest');
      } else if (d.status === 'failed') {
        // 失败：停止轮询
        isStopped = true;
        setMessage(`失败：${d.message}`);
        // 不再继续轮询
      }
    } catch (e) {
      console.error('[BacktestProgress] Poll error:', e);
      // 错误时降低轮询频率
      if (!isStopped) {
        pollTimer = setTimeout(poll, 3000);
      }
    }
  };

  createEffect(() => {
    if (props.taskId) {
      setStatus('running');
      setStartTime(Date.now());
      poll();
      tickerTimer = setInterval(() => {
        if (startTime()) {
          setElapsed(Math.floor((Date.now() - startTime()!) / 1000));
        }
      }, 1000);
    }
  });

  onCleanup(() => {
    if (pollTimer) clearTimeout(pollTimer);
    if (tickerTimer) clearInterval(tickerTimer);
    chart?.dispose();
  });

  const formatTime = (s: number) => {
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec}s`;
  };

  return (
    <div class="flex flex-col items-center justify-center gap-4 p-6">
      {/* ECharts 仪表盘 */}
      <div ref={containerRef} class="w-full h-56" />

      {/* 状态文字 */}
      <div class="text-center">
        <div class="text-lg font-bold text-white mb-1">{message()}</div>
        <div class="text-xs text-gray-400">
          已用时: {formatTime(elapsed())}
          <Show when={eta() !== null && status() === 'running'}>
            {' '}
            | 预计剩余: {formatTime(eta()!)}
          </Show>
        </div>
      </div>

      {/* 状态指示器 */}
      <div
        class={`px-4 py-1.5 rounded-full text-xs font-bold ${
          status() === 'completed'
            ? 'bg-green-500/20 text-green-400 border border-green-500/40'
            : status() === 'failed'
              ? 'bg-red-500/20 text-red-400 border border-red-500/40'
              : status() === 'running'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                : 'bg-gray-500/20 text-gray-400 border border-gray-500/40'
        }`}
      >
        {status() === 'completed'
          ? '✓ 完成'
          : status() === 'failed'
            ? '✕ 失败'
            : status() === 'running'
              ? '◐ 运行中'
              : '○ 等待'}
      </div>

      <Show when={status() === 'completed'}>
        <button
          class="mt-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-bold transition-colors"
          onClick={() => navigate('/backtest')}
        >
          查看回测结果 →
        </button>
      </Show>
    </div>
  );
};

// 自动初始化图表
export const initBacktestProgressChart = (container: HTMLDivElement) => {
  const c = echarts.init(container, 'dark');
  c.setOption({
    backgroundColor: 'transparent',
    series: [
      {
        type: 'gauge',
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 100,
        splitNumber: 5,
        radius: '90%',
        center: ['50%', '55%'],
        axisLine: {
          lineStyle: {
            width: 8,
            color: [[1, 'rgba(255,255,255,0.08)']],
          },
        },
        pointer: {
          icon: 'circle',
          length: '60%',
          width: 6,
          offsetCenter: [0, '-5%'],
          itemStyle: { color: '#60A5FA' },
        },
        axisTick: {
          distance: -12,
          length: 4,
          lineStyle: { color: 'rgba(255,255,255,0.2)', width: 1 },
        },
        splitLine: {
          distance: -14,
          length: 8,
          lineStyle: { color: 'rgba(255,255,255,0.25)', width: 2 },
        },
        axisLabel: {
          color: 'rgba(255,255,255,0.4)',
          fontSize: 10,
          distance: 18,
          formatter: '{value}%',
        },
        detail: {
          valueAnimation: true,
          formatter: (v: number) => `{a|${v.toFixed(0)}%}`,
          rich: {
            a: {
              fontSize: 28,
              fontWeight: 'bold',
              color: '#60A5FA',
              fontFamily: 'JetBrains Mono, monospace',
            },
          },
          offsetCenter: [0, '35%'],
        },
        title: { show: false },
        data: [{ value: 0 }],
      },
    ],
  });
  return c;
};
