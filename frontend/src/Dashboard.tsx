/**
 * Dashboard.tsx — 首页仪表盘（KPI + 资金曲线 + 成交统计）
 * - KPI Cards: 总资产 / 今日盈亏 / 持仓收益 / 年化收益 (ECharts)
 * - 账户资金曲线: ECharts 折线图，对接 /api/equity-curve（含基准对比+回撤）
 * - 当日成交统计: 成交明细表格
 */
import { Component, createSignal, onMount, onCleanup, createMemo, For, Show } from 'solid-js';
import type * as EChartsType from 'echarts/core';
import type { ECharts } from 'echarts';
import {
  fetchAccounts,
  fetchTrades,
  fetchPositions,
  fetchEquityCurve,
  type EquityCurvePoint,
} from '../hooks/useApi';
import { formatAmount, formatPercent, formatPrice } from '../utils/format';
import { pnlColor } from '../utils/color';
import type { TradeData, PositionData } from '../types/vnpy';

interface AccountRecord {
  date: string;
  balance: number;
}

const Dashboard: Component = () => {
  let lineRef: HTMLDivElement | undefined;
  let lineChart: ECharts | undefined;

  // ── State ─────────────────────────────────────────────────
  const [accountHistory, setAccountHistory] = createSignal<AccountRecord[]>([]);
  const [equityCurve, setEquityCurve] = createSignal<EquityCurvePoint[]>([]);
  const [equityMetrics, setEquityMetrics] = createSignal<{
    total_return: number;
    benchmark_return: number;
    max_drawdown: number;
    initial_balance: number;
    final_equity: number;
  } | null>(null);
  const [todayTrades, setTodayTrades] = createSignal<TradeData[]>([]);
  const [positions, setPositions] = createSignal<PositionData[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [lineLoading, setLineLoading] = createSignal(true);

  // ── KPI derived values ────────────────────────────────────
  const totalBalance = createMemo(() => {
    const m = equityMetrics();
    if (m) return m.final_equity;
    const history = accountHistory();
    if (history.length === 0) return 0;
    return history[history.length - 1].balance;
  });

  const todayPnl = createMemo(() => {
    const curve = equityCurve();
    if (curve.length >= 2) {
      return curve[curve.length - 1].equity - curve[curve.length - 2].equity;
    }
    const history = accountHistory();
    if (history.length < 2) return 0;
    return history[history.length - 1].balance - history[history.length - 2].balance;
  });

  const positionPnl = createMemo(() => positions().reduce((s, p) => s + (p.pnl ?? 0), 0));

  const annualizedReturn = createMemo(() => {
    const m = equityMetrics();
    if (m && m.total_return !== undefined) {
      const curve = equityCurve();
      if (curve.length < 2) return 0;
      const days = curve.length;
      return (Math.pow(1 + m.total_return / 100, 365 / days) - 1) * 100;
    }
    const history = accountHistory();
    if (history.length < 2) return 0;
    const first = history[0].balance;
    const last = history[history.length - 1].balance;
    if (first <= 0) return 0;
    const days = history.length - 1;
    if (days <= 0) return 0;
    return (Math.pow(last / first, 365 / days) - 1) * 100;
  });

  const totalTradeVolume = createMemo(() => todayTrades().reduce((s, t) => s + (t.volume ?? 0), 0));

  const maxDrawdown = createMemo(() => {
    const m = equityMetrics();
    return m?.max_drawdown ?? 0;
  });

  // ── Data loading ───────────────────────────────────────────
  onMount(async () => {
    const _ec = await import('@/lib/echarts');
    const echarts = _ec.default;    await Promise.allSettled([loadEquityCurve(), loadTrades(), loadPositions()]);
    setLoading(false);
    setTimeout(initChart, 50);
  });

  onCleanup(() => {
    lineChart?.dispose();
  });

  async function loadEquityCurve() {
    setLineLoading(true);
    try {
      const res = await fetchEquityCurve('default');
      if (res.code === '0' && res.data?.success && res.data.curve.length > 0) {
        const curve = res.data.curve;
        setEquityCurve(curve);
        setEquityMetrics({
          total_return: res.data.total_return,
          benchmark_return: res.data.benchmark_return,
          max_drawdown: res.data.max_drawdown,
          initial_balance: res.data.initial_balance,
          final_equity: res.data.final_equity,
        });
        setAccountHistory(curve.map((p) => ({ date: p.date, balance: p.equity })));
      }
    } catch {
      // fallback to legacy
      try {
        const accRes = await fetchAccounts();
        if (accRes.data?.accounts?.length) {
          const today = new Date().toISOString().slice(0, 10);
          setAccountHistory([{ date: today, balance: accRes.data.accounts[0].balance }]);
        }
      } catch {
        /* silent */
      }
    } finally {
      setLineLoading(false);
    }
  }

  async function loadTrades() {
    try {
      const res = await fetchTrades();
      if (res.data?.trades) {
        setTodayTrades(res.data.trades);
      }
    } catch {}
  }

  async function loadPositions() {
    try {
      const res = await fetchPositions();
      if (res.data?.positions) {
        setPositions(res.data.positions);
      }
    } catch {}
  }

  // ── ECharts line chart ─────────────────────────────────────
  function initChart() {
    if (!lineRef) return;
    if (lineChart) lineChart.dispose();
    lineChart = echarts.init(lineRef, 'dark');
    const ro = new ResizeObserver(() => lineChart?.resize());
    ro.observe(lineRef);
    renderLineChart();
  }

  function renderLineChart() {
    if (!lineChart) return;
    const curve = equityCurve();
    const records = accountHistory();

    // Use enhanced curve data if available, otherwise fallback
    if (curve.length > 0) {
      const dates = curve.map((p) => p.date.slice(5));
      const equityVals = curve.map((p) => p.equity);
      const bmVals = curve.map((p) => p.benchmark);
      const ddVals = curve.map((p) => p.drawdown);

      const allVals = [...equityVals, ...bmVals];
      const minVal = Math.min(...allVals);
      const maxVal = Math.max(...allVals);
      const pad = (maxVal - minVal) * 0.12 || 1000;

      lineChart.setOption(
        {
          backgroundColor: 'transparent',
          grid: { top: 16, right: 16, bottom: 32, left: 72 },
          legend: {
            data: ['策略净值', '沪深300'],
            textStyle: { color: '#6b7280', fontSize: 11 },
            top: 0,
          },
          tooltip: {
            trigger: 'axis',
            backgroundColor: '#111827',
            borderColor: '#374151',
            textStyle: { color: '#e5e7eb', fontSize: 12 },
            formatter: (params: unknown) => {
              const arr = params as Array<{
                seriesName: string;
                name: string;
                value: number;
                color: string;
              }>;
              if (!arr?.length) return '';
              const date = arr[0].name;
              const equityPt = curve.find((p) => p.date.slice(5) === date) ?? curve[0];
              const equityP = arr.find((p) => p.seriesName === '策略净值');
              const bmP = arr.find((p) => p.seriesName === '沪深300');
              const eqVal = equityP?.value ?? 0;
              const bmVal = bmP?.value ?? 0;
              const ddVal = equityPt?.drawdown ?? 0;
              const drVal = equityPt?.daily_return ?? 0;
              const srVal = equityPt?.rolling_sharpe ?? 0;
              const retPct =
                ((eqVal - (equityPt?.equity - ((drVal / 100) * equityPt?.equity || 0))) /
                  (equityPt?.equity - ((drVal / 100) * equityPt?.equity || 0))) *
                  100 || 0;
              const eqRet = ((eqVal / (equityPt?.equity / (1 + drVal / 100)) - 1) * 100).toFixed(2);
              return `
              <div style="font-size:11px;color:#9ca3af;margin-bottom:4px">${date}</div>
              <div style="display:flex;justify-content:space-between;gap:12px"><span style="color:#3b82f6">策略净值</span><span style="color:#fff">¥${eqVal.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span></div>
              <div style="display:flex;justify-content:space-between;gap:12px"><span style="color:#6b7280">基准净值</span><span style="color:#9ca3af">¥${bmVal.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span></div>
              <div style="border-top:1px solid #374151;margin:4px 0"></div>
              <div style="display:flex;justify-content:space-between;gap:12px"><span style="color:#6b7280">日收益</span><span style="color:${drVal >= 0 ? '#ef4444' : '#22c55e'}">${drVal >= 0 ? '+' : ''}${drVal.toFixed(2)}%</span></div>
              <div style="display:flex;justify-content:space-between;gap:12px"><span style="color:#6b7280">回撤</span><span style="color:#f97316">-${ddVal.toFixed(2)}%</span></div>
              <div style="display:flex;justify-content:space-between;gap:12px"><span style="color:#6b7280">20日夏普</span><span style="color:#a78bfa">${srVal.toFixed(2)}</span></div>
            `;
            },
          },
          xAxis: {
            type: 'category',
            data: dates,
            axisLine: { lineStyle: { color: '#1f2937' } },
            axisLabel: { color: '#6b7280', fontSize: 10, formatter: (v: string) => v },
            splitLine: { show: false },
          },
          yAxis: {
            type: 'value',
            min: minVal - pad,
            max: maxVal + pad,
            axisLine: { show: false },
            axisLabel: {
              color: '#6b7280',
              fontSize: 10,
              formatter: (v: number) => `¥${(v / 10000).toFixed(1)}w`,
            },
            splitLine: { lineStyle: { color: '#1f2937', type: 'dashed' } },
          },
          dataZoom: [
            {
              type: 'inside',
              start: 0,
              end: 100,
            },
          ],
          series: [
            {
              name: '策略净值',
              type: 'line',
              data: equityVals,
              smooth: 0.3,
              symbol: 'circle',
              symbolSize: 4,
              lineStyle: { color: '#3b82f6', width: 2 },
              itemStyle: { color: '#3b82f6', borderWidth: 2, borderColor: '#1e3a5f' },
              areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: 'rgba(59,130,246,0.25)' },
                  { offset: 1, color: 'rgba(59,130,246,0.02)' },
                ]),
              },
            },
            {
              name: '沪深300',
              type: 'line',
              data: bmVals,
              smooth: 0.3,
              symbol: 'none',
              lineStyle: { color: '#6b7280', width: 1.5, type: 'dashed' },
            },
          ],
        },
        true
      );
      return;
    }

    // Legacy path for fallback
    if (records.length === 0) return;
    const dates = records.map((r) => r.date.slice(5));
    const values = records.map((r) => r.balance);

    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const pad = (maxVal - minVal) * 0.15 || 1000;

    lineChart.setOption(
      {
        backgroundColor: 'transparent',
        grid: { top: 16, right: 16, bottom: 28, left: 72 },
        tooltip: {
          trigger: 'axis',
          backgroundColor: '#111827',
          borderColor: '#374151',
          textStyle: { color: '#e5e7eb', fontSize: 12 },
          formatter: (params: unknown) => {
            const p = (params as Array<{ name: string; value: number }>)[0];
            return `<span style="color:#9ca3af;font-size:10px">${p.name}</span><br/><strong style="color:#f3f4f6;font-size:13px">¥${p.value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</strong>`;
          },
        },
        xAxis: {
          type: 'category',
          data: dates,
          axisLine: { lineStyle: { color: '#1f2937' } },
          axisLabel: { color: '#6b7280', fontSize: 10 },
          splitLine: { show: false },
        },
        yAxis: {
          type: 'value',
          min: minVal - pad,
          max: maxVal + pad,
          axisLine: { show: false },
          axisLabel: {
            color: '#6b7280',
            fontSize: 10,
            formatter: (v: number) => `¥${(v / 10000).toFixed(0)}w`,
          },
          splitLine: { lineStyle: { color: '#1f2937', type: 'dashed' } },
        },
        series: [
          {
            type: 'line',
            data: values,
            smooth: 0.3,
            symbol: 'circle',
            symbolSize: 5,
            lineStyle: { color: '#3b82f6', width: 2 },
            itemStyle: { color: '#3b82f6', borderWidth: 2, borderColor: '#1e3a5f' },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(59,130,246,0.25)' },
                { offset: 1, color: 'rgba(59,130,246,0.02)' },
              ]),
            },
          },
        ],
      },
      true
    );
  }

  // Re-render when data changes
  createMemo(() => {
    accountHistory(); // track dependency
    equityCurve();
    if (lineChart) setTimeout(() => renderLineChart(), 50);
  });

  // ── KPI mini bar (using ECharts) ──────────────────────────
  function KPICard(props: {
    label: string;
    value: string;
    sub?: string;
    subColor?: string;
    color?: string;
  }) {
    return (
      <div class="bg-[#111827] border border-white/10 rounded-xl p-4 flex flex-col gap-1">
        <div class="text-xs text-gray-500 font-medium">{props.label}</div>
        <div class={`text-2xl font-bold tabular-nums ${props.color ?? 'text-white'}`}>
          {props.value}
        </div>
        <Show when={props.sub}>
          <div class={`text-xs ${props.subColor ?? 'text-gray-600'}`}>{props.sub}</div>
        </Show>
      </div>
    );
  }

  return (
    <div class="h-full overflow-auto p-6 bg-[#0A0E17] space-y-6">
      {/* ── KPI Row ─────────────────────────────────────────── */}
      <Show
        when={!loading()}
        fallback={
          <div class="grid grid-cols-4 gap-4">
            <For each={[1, 2, 3, 4]}>
              {() => (
                <div class="bg-[#111827] border border-white/10 rounded-xl p-4 animate-pulse">
                  <div class="h-3 bg-white/5 rounded w-16 mb-3" />
                  <div class="h-8 bg-white/5 rounded w-32 mb-2" />
                  <div class="h-3 bg-white/5 rounded w-20" />
                </div>
              )}
            </For>
          </div>
        }
      >
        <div class="grid grid-cols-4 gap-4">
          <KPICard
            label="总资产"
            value={`¥${formatAmount(totalBalance())}`}
            sub="实时账户权益"
            color="text-white"
          />
          <KPICard
            label="今日盈亏"
            value={`${todayPnl() >= 0 ? '+' : ''}${formatAmount(todayPnl())}`}
            sub={totalBalance() > 0 ? formatPercent((todayPnl() / totalBalance()) * 100) : '—'}
            color={pnlColor(todayPnl())}
            subColor={pnlColor(todayPnl())}
          />
          <KPICard
            label="持仓收益"
            value={`${positionPnl() >= 0 ? '+' : ''}${formatAmount(positionPnl())}`}
            sub={positions().length > 0 ? `${positions().length} 只持仓` : '暂无持仓'}
            color={pnlColor(positionPnl())}
            subColor="text-gray-600"
          />
          <KPICard
            label="年化收益"
            value={`${annualizedReturn() >= 0 ? '+' : ''}${annualizedReturn().toFixed(2)}%`}
            sub={accountHistory().length > 1 ? `近 ${accountHistory().length - 1} 天` : '数据不足'}
            color={pnlColor(annualizedReturn())}
            subColor="text-gray-600"
          />
        </div>
      </Show>

      {/* ── 账户资金曲线 ──────────────────────────────────────── */}
      <div class="bg-[#111827] border border-white/10 rounded-xl p-4">
        <div class="flex items-center justify-between mb-4">
          <div class="text-sm font-semibold text-gray-200">账户资金曲线</div>
          <div class="text-xs text-gray-500">
            {lineLoading() ? '加载中…' : `${accountHistory().length} 个数据点`}
          </div>
        </div>

        <Show when={lineLoading()}>
          <div class="h-64 flex items-center justify-center">
            <div class="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          </div>
        </Show>

        <Show when={!lineLoading() && accountHistory().length === 0}>
          <div class="h-64 flex flex-col items-center justify-center gap-2">
            <div class="text-gray-500 text-sm">暂无资金数据</div>
            <div class="text-gray-600 text-xs">对接 /api/data/accounts 获取历史资金曲线</div>
          </div>
        </Show>

        <Show when={!lineLoading() && accountHistory().length > 0}>
          <div ref={lineRef} style={{ width: '100%', height: '260px' }} />
        </Show>
      </div>

      {/* ── 当日成交统计 ─────────────────────────────────────── */}
      <div class="bg-[#111827] border border-white/10 rounded-xl p-4">
        <div class="flex items-center justify-between mb-4">
          <div class="text-sm font-semibold text-gray-200">当日成交统计</div>
          <div class="flex items-center gap-4 text-xs text-gray-500">
            <span>
              成交 <span class="text-white font-medium">{todayTrades().length}</span> 笔
            </span>
            <span>
              总量 <span class="text-white font-medium">{totalTradeVolume().toLocaleString()}</span>{' '}
              股
            </span>
          </div>
        </div>

        <Show when={todayTrades().length === 0}>
          <div class="h-32 flex items-center justify-center">
            <div class="text-gray-500 text-sm">今日暂无成交记录</div>
          </div>
        </Show>

        <Show when={todayTrades().length > 0}>
          <div class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead>
                <tr class="text-gray-500 border-b border-white/10">
                  <th class="text-left py-2 pr-4 font-medium">时间</th>
                  <th class="text-left py-2 pr-4 font-medium">合约代码</th>
                  <th class="text-left py-2 pr-4 font-medium">方向</th>
                  <th class="text-right py-2 pr-4 font-medium">价格</th>
                  <th class="text-right py-2 pr-4 font-medium">成交量</th>
                  <th class="text-right py-2 font-medium">成交额</th>
                </tr>
              </thead>
              <tbody>
                <For each={todayTrades().slice(0, 50)}>
                  {(trade) => (
                    <tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td class="py-2 pr-4 text-gray-400 tabular-nums">
                        {trade.datetime ? trade.datetime.slice(11, 19) : '—'}
                      </td>
                      <td class="py-2 pr-4 text-white font-medium">{trade.symbol}</td>
                      <td
                        class={`py-2 pr-4 text-right font-medium ${
                          trade.direction === '多' ? 'text-red-400' : 'text-green-400'
                        }`}
                      >
                        {trade.direction ?? '—'}
                      </td>
                      <td class="py-2 pr-4 text-right text-gray-300 tabular-nums">
                        {trade.price != null ? formatPrice(trade.price) : '—'}
                      </td>
                      <td class="py-2 pr-4 text-right text-gray-300 tabular-nums">
                        {trade.volume?.toLocaleString() ?? '—'}
                      </td>
                      <td class="py-2 text-right text-gray-300 tabular-nums">
                        {trade.price != null && trade.volume != null
                          ? formatAmount(trade.price * trade.volume)
                          : '—'}
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default Dashboard;
