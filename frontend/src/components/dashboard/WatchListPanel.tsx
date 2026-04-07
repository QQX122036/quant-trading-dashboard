/**
 * WatchListPanel.tsx — 自选股实时行情列表
 * - 表格：代码/名称/现价/涨跌幅/成交量/成交额
 * - 涨跌排序筛选
 * - 点击行跳转K线图
 * - WebSocket 实时更新 (subscribe "tick.{ts_code}")
 */
import { Component, createSignal, createMemo, For, onMount, onCleanup } from 'solid-js';
import { actions } from '../../stores';
import { getWsInstance } from '../../hooks/useWebSocket';
import type { WsMessage } from '../../types/ws';

interface DisplayTick {
  ts_code: string;
  name: string;
  price: number;
  preClose: number;
  change: number;
  changePercent: number;
  volume: number;
  amount: number;
  high: number;
  low: number;
}

type SortKey = 'changePercent' | 'volume' | 'amount' | 'price';
type SortDir = 'asc' | 'desc';

const STOCK_NAMES: Record<string, string> = {
  '600519.SH': '贵州茅台', '000001.SZ': '平安银行', '600036.SH': '招商银行',
  '601318.SH': '中国平安', '000002.SZ': '万科A', '000300.SH': '沪深300',
  '000905.SH': '中证500', '399006.SZ': '创业板指',
};

// 默认自选股列表
const DEFAULT_WATCHLIST = ['600519.SH', '000001.SZ', '600036.SH', '601318.SH', '000002.SZ'];

export const WatchListPanel: Component<{
  collapsed: boolean;
  onToggleCollapse: () => void;
  selectedSymbol: string;
}> = (props) => {
  const [ticks, setTicks] = createSignal<Record<string, DisplayTick>>({});
  const [sortKey, setSortKey] = createSignal<SortKey>('changePercent');
  const [sortDir, setSortDir] = createSignal<SortDir>('desc');

  const ws = getWsInstance();

  const handleTick = (msg: WsMessage) => {
    if (msg.type === 'tick' && msg.data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = msg.data as any;
      const sym = d.symbol as string;
      if (!sym) return;
      const prev = ticks()[sym];
      const price = d.last_price ?? 0;
      const preClose = d.pre_close ?? prev?.preClose ?? price;
      const change = price - preClose;
      const changePercent = preClose > 0 ? (change / preClose) * 100 : 0;

      setTicks(prev => ({
        ...prev,
        [sym]: {
          ts_code: sym,
          name: STOCK_NAMES[sym] || d.name || sym.split('.')[0],
          price,
          preClose,
          change,
          changePercent,
          volume: d.volume ?? 0,
          amount: d.amount ?? 0,
          high: d.high_price ?? 0,
          low: d.low_price ?? 0,
        },
      }));
    }
  };

  onMount(() => {
    if (ws.status() === 'disconnected') ws.connect();
    // 初始化默认股票名称
    const init: Record<string, DisplayTick> = {};
    for (const sym of DEFAULT_WATCHLIST) {
      init[sym] = {
        ts_code: sym, name: STOCK_NAMES[sym] || sym.split('.')[0],
        price: 0, preClose: 0, change: 0, changePercent: 0, volume: 0, amount: 0, high: 0, low: 0,
      };
    }
    setTicks(init);

    ws.addHandler('tick', handleTick);
    // 订阅默认自选股
    ws.subscribe({ symbols: DEFAULT_WATCHLIST });
  });

  onCleanup(() => {
    ws.removeHandler('tick', handleTick);
    ws.unsubscribe({ symbols: DEFAULT_WATCHLIST });
  });

  // 排序后的列表
  const sortedList = createMemo(() => {
    const all = Object.values(ticks());
    const key = sortKey();
    const dir = sortDir();
    return [...all].sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[key] as number;
      const bv = (b as unknown as Record<string, unknown>)[key] as number;
      return dir === 'asc' ? av - bv : bv - av;
    });
  });

  function handleSort(key: SortKey) {
    if (sortKey() === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  function handleRowClick(sym: string) {
    actions.ui.setSelectedSymbol(sym);
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey() !== col) return <span class="text-gray-600 ml-1">⇅</span>;
    return <span class="text-blue-400 ml-1">{sortDir() === 'asc' ? '↑' : '↓'}</span>;
  }

  if (props.collapsed) {
    return (
      <div class="h-full w-10 flex flex-col items-center py-2 bg-[#111827]/80 border-r border-white/10">
        <button onClick={props.onToggleCollapse} class="text-gray-500 hover:text-white text-xs mb-2" title="展开">☰</button>
        <For each={DEFAULT_WATCHLIST}>{(sym) => (
          <button
            class="w-8 h-8 my-0.5 rounded text-[9px] flex items-center justify-center font-bold"
            style={{ 'writing-mode': 'vertical-rl', 'text-orientation': 'mixed' }}
            classList={{ 'bg-blue-600 text-white': props.selectedSymbol === sym, 'bg-white/5 text-gray-400': props.selectedSymbol !== sym }}
            onClick={() => handleRowClick(sym)}
          >
            {STOCK_NAMES[sym] || sym.split('.')[0]}
          </button>
        )}</For>
      </div>
    );
  }

  return (
    <div class="h-full flex flex-col bg-[#111827]/80 border-r border-white/10">
      {/* Header */}
      <div class="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <span class="text-xs font-semibold text-gray-300">自选股</span>
        <button onClick={props.onToggleCollapse} class="text-gray-500 hover:text-white text-xs" title="折叠">‹</button>
      </div>

      {/* Table */}
      <div class="flex-1 overflow-auto">
        <table class="w-full text-[11px]">
          <thead class="sticky top-0 z-10 bg-[#111827]">
            <tr class="text-gray-500">
              <th class="px-2 py-1.5 text-left font-normal whitespace-nowrap">代码</th>
              <th class="px-2 py-1.5 text-left font-normal">名称</th>
              <th class="px-2 py-1.5 text-right font-normal cursor-pointer select-none" onClick={() => handleSort('price')}>现价<SortIcon col="price" /></th>
              <th class="px-2 py-1.5 text-right font-normal cursor-pointer select-none" onClick={() => handleSort('changePercent')}>涨跌幅<SortIcon col="changePercent" /></th>
              <th class="px-2 py-1.5 text-right font-normal cursor-pointer select-none" onClick={() => handleSort('volume')}>成交量<SortIcon col="volume" /></th>
            </tr>
          </thead>
          <tbody>
            <For each={sortedList()}>
              {(tick) => {
                const isUp = tick.changePercent >= 0;
                const isSelected = props.selectedSymbol === tick.ts_code;
                return (
                  <tr
                    class={`border-t border-white/5 cursor-pointer transition-colors ${isSelected ? 'bg-blue-900/30' : 'hover:bg-white/5'}`}
                    onClick={() => handleRowClick(tick.ts_code)}
                  >
                    <td class="px-2 py-1.5 tabular-nums text-gray-400 whitespace-nowrap">{tick.ts_code.split('.')[0]}</td>
                    <td class="px-2 py-1.5 font-medium whitespace-nowrap" classList={{ 'text-white': isSelected, 'text-gray-200': !isSelected }}>{tick.name}</td>
                    <td class={`px-2 py-1.5 text-right tabular-nums font-medium ${isUp ? 'text-[#EF4444]' : 'text-[#22C55E]'}`}>
                      {tick.price > 0 ? tick.price.toFixed(2) : '—'}
                    </td>
                    <td class={`px-2 py-1.5 text-right tabular-nums ${isUp ? 'text-[#EF4444]' : 'text-[#22C55E]'}`}>
                      {tick.changePercent !== 0 ? `${isUp ? '↑' : '↓'} ${Math.abs(tick.changePercent).toFixed(2)}%` : '—'}
                    </td>
                    <td class="px-2 py-1.5 text-right tabular-nums text-gray-400">
                      {tick.volume > 0 ? (tick.volume >= 1e8 ? (tick.volume / 1e8).toFixed(2) + '亿' : (tick.volume / 1e4).toFixed(2) + '万') : '—'}
                    </td>
                  </tr>
                );
              }}
            </For>
          </tbody>
        </table>
      </div>
    </div>
  );
};
