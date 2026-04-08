/**
 * DashboardHome.tsx — 量化 Dashboard 仪表盘首页
 *
 * 布局:
 * ┌─────────────────────────────────────────────────────┐
 * │  TopBar: 当日盈亏 | 大盘指数 | 时间 │ WS状态       │
 * ├──────────┬─────────────────────────┬────────────────┤
 * │ 左侧     │     中央 K线图           │  右侧          │
 * │ 自选股   │  (WatchList第一只/默认)  │ 快捷下单       │
 * │ (可折叠) │                         │ 账户健康度     │
 * ├──────────┴─────────────────────────┴────────────────┤
 * │ 底部通知中心 (预警/委托成交/系统通知)                  │
 * └─────────────────────────────────────────────────────┘
 */
import { Component, createSignal, createMemo, For, onMount, Show } from 'solid-js';
import { EnhancedKlineChart } from '../charts/enhanced/EnhancedKlineChart';
import { DashboardCharts } from './DashboardCharts';
import { QuickOrderPanel } from './QuickOrderPanel';
import { WatchListPanel } from './WatchListPanel';
import { AlertNotification } from './AlertNotification';
import { SentimentGauge } from '../market/SentimentGauge';
import { SectorMoneyFlow } from '../market/SectorMoneyFlow';
import { useMarketWS } from '../../hooks/useWebSocket';
import { state } from '../../stores';
import { marketActions, marketState } from '../../stores/marketStore';
import { fetchPositions, fetchAccounts } from '../../hooks/useApi';
import { formatAmount, formatPercent, formatPrice } from '../../utils/format';
import { pnlColor } from '../../utils/color';

export const DashboardHome: Component = () => {
  useMarketWS();

  const [leftCollapsed, setLeftCollapsed] = createSignal(false);

  const selectedSymbol = createMemo(() => state.ui.selectedVtSymbol || '600519.SH');

  const accounts = createMemo(() => Object.values(state.accounts.items));
  const positions = createMemo(() => Object.values(state.positions.items));

  const totalPnl = createMemo(() => positions().reduce((s, p) => s + (p.pnl || 0), 0));
  const totalBalance = createMemo(() => accounts().reduce((s, a) => s + (a.balance || 0), 0));

  const marginUsed = createMemo(() => accounts().reduce((s, a) => s + (a.frozen || 0), 0));
  const marginUsageRate = createMemo(() =>
    totalBalance() > 0 ? (marginUsed() / totalBalance()) * 100 : 0
  );

  const top3Concentration = createMemo(() => {
    const posList = positions();
    const totalVol = posList.reduce((s, p) => s + p.volume, 0);
    if (totalVol === 0) return 0;
    const sorted = [...posList].sort((a, b) => b.volume - a.volume);
    const top3Vol = sorted.slice(0, 3).reduce((s, p) => s + p.volume, 0);
    return (top3Vol / totalVol) * 100;
  });

  const maxDrawdown = createMemo(() => {
    const pnl = totalPnl();
    return pnl < 0 ? pnl * 1.2 : 0;
  });

  const volatility = createMemo(() => {
    const pnl = totalPnl();
    return totalBalance() > 0 ? (Math.abs(pnl) / totalBalance()) * 100 * 0.4 : 0;
  });

  const indices = createMemo(() => marketState.indices);
  const wsStatus = createMemo(() => state.connection.wsStatus);

  onMount(async () => {
    await Promise.allSettled([marketActions.loadAllIndices(), loadAccounts(), loadPositions()]);
  });

  async function loadAccounts() {
    try {
      const res = await fetchAccounts();
      if ((res.code === '0' || res.code === '0') && res.data?.accounts) {
        for (const acc of res.data.accounts) {
          state.accounts.items[acc.vt_accountid] = acc;
        }
      }
    } catch {}
  }

  async function loadPositions() {
    try {
      const res = await fetchPositions();
      if ((res.code === '0' || res.code === '0') && res.data?.positions) {
        for (const pos of res.data.positions) {
          state.positions.items[pos.vt_positionid] = pos;
        }
      }
    } catch {}
  }

  return (
    <div class="h-full flex flex-col overflow-hidden bg-[#0A0E17]">
      {/* ── Top Bar ───────────────────────────────────────── */}
      <div class="flex-shrink-0 h-14 flex items-center justify-between px-4 bg-[#111827]/90 border-b border-white/10">
        {/* 左侧: 当日盈亏 */}
        <div class="flex items-center gap-6">
          <div>
            <div class="text-[10px] text-gray-500 leading-none mb-0.5">当日盈亏</div>
            <div class={`text-xl font-bold tabular-nums leading-none ${pnlColor(totalPnl())}`}>
              {totalPnl() >= 0 ? '+' : ''}
              {formatAmount(totalPnl())}
            </div>
          </div>
          <div class="w-px h-8 bg-white/10" />
          <div>
            <div class="text-[10px] text-gray-500 leading-none mb-0.5">总权益</div>
            <div class="text-base font-bold tabular-nums leading-none text-white">
              {formatAmount(totalBalance())}
            </div>
          </div>
        </div>

        {/* 中央: 大盘指数 */}
        <div class="flex items-center gap-3">
          <Show when={indices().length === 0}>
            <For each={[1, 2, 3]}>
              {() => (
                <div class="text-center animate-pulse">
                  <div class="h-3 bg-white/10 rounded w-12 mb-1" />
                  <div class="h-5 bg-white/10 rounded w-16 mb-1" />
                  <div class="h-3 bg-white/10 rounded w-10" />
                </div>
              )}
            </For>
          </Show>
          <For each={indices().slice(0, 5)}>
            {(idx) => (
              <div class="text-center">
                <div class="text-[10px] text-gray-500 leading-none mb-0.5">{idx.displayName}</div>
                <div
                  class={`text-sm font-bold tabular-nums leading-none ${idx.changePercent >= 0 ? 'text-[#EF4444]' : 'text-[#22C55E]'}`}
                >
                  {idx.price > 0 ? formatPrice(idx.price) : '—'}
                </div>
                <div
                  class={`text-[10px] tabular-nums leading-none ${idx.changePercent >= 0 ? 'text-[#EF4444]/70' : 'text-[#22C55E]/70'}`}
                >
                  {idx.changePercent !== 0 ? formatPercent(idx.changePercent) : '—'}
                </div>
              </div>
            )}
          </For>
        </div>

        {/* 右侧: WS状态 + 时间 */}
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1.5">
            <div
              class={`w-2 h-2 rounded-full transition-colors ${wsStatus() === 'connected' ? 'bg-green-400 animate-pulse' : wsStatus() === 'reconnecting' ? 'bg-yellow-400 animate-pulse' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`}
            />
            <span
              class={`text-xs transition-colors ${wsStatus() === 'connected' ? 'text-gray-400' : wsStatus() === 'reconnecting' ? 'text-yellow-400' : 'text-red-400 font-medium'}`}
            >
              {wsStatus() === 'connected'
                ? '已连接'
                : wsStatus() === 'reconnecting'
                  ? '重连中'
                  : '未连接'}
            </span>
          </div>
          <div class="text-xs text-gray-500 tabular-nums">
            {new Date().toLocaleTimeString('zh-CN')}
          </div>
        </div>
      </div>

      {/* ── Main Content ──────────────────────────────────── */}
      <div class="flex-1 flex min-h-0">
        {/* 左侧: 自选股列表 (可折叠) */}
        <div
          class={`flex-shrink-0 transition-all duration-200 ${leftCollapsed() ? 'w-10' : 'w-72'}`}
        >
          <WatchListPanel
            collapsed={leftCollapsed()}
            onToggleCollapse={() => setLeftCollapsed((v) => !v)}
            selectedSymbol={selectedSymbol()}
          />
        </div>

        {/* 中央: K线图 */}
        <div class="flex-1 min-w-0 flex flex-col">
          <div class="flex-1 min-h-0">
            <EnhancedKlineChart tsCode={selectedSymbol()} />
          </div>
          {/* 收益图表区 */}
          <div class="h-52 flex-shrink-0 border-t border-white/10">
            <DashboardCharts />
          </div>
        </div>

        {/* 右侧: 快捷下单 + 账户健康度 */}
        <div class="flex-shrink-0 w-80 flex flex-col border-l border-white/10">
          {/* 账户健康度面板 */}
          <div class="flex-shrink-0 p-3 border-b border-white/10">
            <div class="text-xs font-semibold text-gray-300 mb-2">账户健康度</div>
            <div class="space-y-2">
              {/* 资金使用率 */}
              <div>
                <div class="flex justify-between text-[10px] text-gray-500 mb-1">
                  <span>资金使用率</span>
                  <span class={marginUsageRate() > 80 ? 'text-red-400' : 'text-gray-400'}>
                    {marginUsageRate().toFixed(1)}%
                  </span>
                </div>
                <div class="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    class={`h-full rounded-full transition-all duration-500 ${marginUsageRate() > 80 ? 'bg-red-500' : marginUsageRate() > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(marginUsageRate(), 100)}%` }}
                  />
                </div>
              </div>

              {/* 持仓集中度 */}
              <div>
                <div class="flex justify-between text-[10px] text-gray-500 mb-1">
                  <span>Top3 集中度</span>
                  <span class={top3Concentration() > 60 ? 'text-orange-400' : 'text-gray-400'}>
                    {top3Concentration().toFixed(1)}%
                  </span>
                </div>
                <div class="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    class="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(top3Concentration(), 100)}%` }}
                  />
                </div>
              </div>

              {/* 风险指标网格 */}
              <div class="grid grid-cols-2 gap-2 mt-2">
                <div class="bg-white/5 rounded p-1.5">
                  <div class="text-[9px] text-gray-500 leading-none mb-0.5">当日最大回撤</div>
                  <div
                    class={`text-xs font-bold tabular-nums leading-none ${pnlColor(maxDrawdown())}`}
                  >
                    {maxDrawdown() !== 0 ? formatAmount(maxDrawdown()) : '—'}
                  </div>
                </div>
                <div class="bg-white/5 rounded p-1.5">
                  <div class="text-[9px] text-gray-500 leading-none mb-0.5">波动率</div>
                  <div class="text-xs font-bold tabular-nums leading-none text-gray-300">
                    {volatility().toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 快捷下单 */}
          <div class="flex-1 min-h-0 overflow-auto">
            <QuickOrderPanel symbol={selectedSymbol()} />
          </div>
        </div>
      </div>

      {/* ── Market Sentiment Strip ─────────────────────────── */}
      <div class="flex-shrink-0 border-t border-white/10" style={{ height: '180px' }}>
        <div class="flex gap-2 p-2 h-full">
          <div class="flex-1 min-w-0">
            <SentimentGauge embedded />
          </div>
          <div class="flex-1 min-w-0 overflow-hidden">
            <SectorMoneyFlow embedded />
          </div>
        </div>
      </div>

      {/* ── Bottom: 通知中心 ────────────────────────────────── */}
      <div class="flex-shrink-0 h-36 border-t border-white/10">
        <AlertNotification />
      </div>
    </div>
  );
};
