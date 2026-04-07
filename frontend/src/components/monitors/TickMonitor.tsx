import { Component, For, createSignal, createEffect, onCleanup } from 'solid-js';
import { getWsInstance } from '../../hooks/useWebSocket';
import type { WsMessage } from '../../types/ws';

interface TickBarData {
  ts_code: string;
  tradedate?: string;
  tradetime?: string;
  price: number;
  volume: number;
  bid_price_1: number;
  bid_price_2: number;
  bid_price_3: number;
  bid_price_4: number;
  bid_price_5: number;
  ask_price_1: number;
  ask_price_2: number;
  ask_price_3: number;
  ask_price_4: number;
  ask_price_5: number;
  bid_volume_1: number;
  bid_volume_2: number;
  bid_volume_3: number;
  bid_volume_4: number;
  bid_volume_5: number;
  ask_volume_1: number;
  ask_volume_2: number;
  ask_volume_3: number;
  ask_volume_4: number;
  ask_volume_5: number;
}

interface DisplayTick {
  ts_code: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  bid1: number;
  ask1: number;
  bidVol1: number;
  askVol1: number;
  volume: number;
}

// 股票代码→名称映射
const NAME_MAP: Record<string, string> = {
  "600519.SH": "贵州茅台",
  "000001.SZ": "平安银行",
  "600036.SH": "招商银行",
  "601318.SH": "中国平安",
  "000002.SZ": "万科A",
};

function getName(ts_code: string): string {
  return NAME_MAP[ts_code] || ts_code.split(".")[0];
}

export const TickMonitor: Component = () => {
  const [ticks, setTicks] = createSignal<DisplayTick[]>([]);
  const [selected, setSelected] = createSignal<string | null>(null);
  const [lastTick, setLastTick] = createSignal<TickBarData | null>(null);

  // 默认显示的股票列表
  const _WATCHLIST = Object.keys(NAME_MAP);

  const ws = getWsInstance();

  const tickHandler = (msg: WsMessage) => {
    if (msg.type === 'tick_bar' && msg.data) {
      const tick = msg.data as TickBarData;
      const prev = lastTick();
      const change = prev ? tick.price - prev.price : 0;
      const changePercent = prev && prev.price > 0
        ? (change / prev.price) * 100
        : 0;

      setLastTick(tick);

      // 更新或追加到列表
      setTicks((prev) => {
        const idx = prev.findIndex((t) => t.ts_code === tick.ts_code);
        const name = getName(tick.ts_code);
        const displayTick: DisplayTick = {
          ts_code: tick.ts_code,
          name,
          price: tick.price,
          change,
          changePercent,
          bid1: tick.bid_price_1,
          ask1: tick.ask_price_1,
          bidVol1: tick.bid_volume_1,
          askVol1: tick.ask_volume_1,
          volume: tick.volume,
        };
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = displayTick;
          return updated;
        } else {
          return [...prev, displayTick];
        }
      });
    }
  };

  createEffect(() => {
    if (ws.status() === 'disconnected') {
      ws.connect();
    }
    ws.addHandler('tick_bar', tickHandler);
  });

  onCleanup(() => {
    ws.removeHandler('tick_bar', tickHandler);
  });

  // 点击行选中，底部显示详情
  function handleRowClick(ts_code: string) {
    setSelected((prev) => (prev === ts_code ? null : ts_code));
  }

  const selectedTick = () => {
    const sel = selected();
    if (!sel) return null;
    return ticks().find((t) => t.ts_code === sel) || null;
  };

  return (
    <div class="flex flex-col h-full">
      <table class="w-full text-sm flex-shrink-0">
        <thead class="sticky top-0 bg-[#111827] z-10">
          <tr class="text-gray-400 text-left text-xs">
            <th class="px-2 py-1">代码</th>
            <th class="px-2 py-1">名称</th>
            <th class="px-2 py-1 text-right">最新价</th>
            <th class="px-2 py-1 text-right">涨跌额</th>
            <th class="px-2 py-1 text-right">涨跌幅</th>
            <th class="px-2 py-1 text-right">买一价</th>
            <th class="px-2 py-1 text-right">卖一价</th>
            <th class="px-2 py-1 text-right">成交量</th>
          </tr>
        </thead>
        <tbody>
          <For each={ticks()}>
            {(tick) => (
              <tr
                class={`border-t border-white/5 hover:bg-white/5 cursor-pointer ${selected() === tick.ts_code ? 'bg-white/10' : ''}`}
                onClick={() => handleRowClick(tick.ts_code)}
              >
                <td class="px-2 py-1.5 tabular-nums">{tick.ts_code.split(".")[0]}</td>
                <td class="px-2 py-1.5">{tick.name}</td>
                <td class="px-2 py-1.5 text-right tabular-nums font-medium">{tick.price > 0 ? tick.price.toFixed(2) : "—"}</td>
                <td class={`px-2 py-1.5 text-right tabular-nums ${tick.change >= 0 ? 'text-[#EF4444]' : 'text-[#22C55E]'}`}>
                  {tick.change !== 0 ? (tick.change >= 0 ? '+' : '') + tick.change.toFixed(2) : '—'}
                </td>
                <td class={`px-2 py-1.5 text-right tabular-nums ${tick.changePercent >= 0 ? 'text-[#EF4444]' : 'text-[#22C55E]'}`}>
                  {tick.changePercent !== 0
                    ? `${tick.changePercent >= 0 ? '↑' : '↓'} ${Math.abs(tick.changePercent).toFixed(2)}%`
                    : '—'}
                </td>
                <td class="px-2 py-1.5 text-right tabular-nums text-[#22C55E]">{tick.bid1 > 0 ? tick.bid1.toFixed(2) : "—"}</td>
                <td class="px-2 py-1.5 text-right tabular-nums text-[#EF4444]">{tick.ask1 > 0 ? tick.ask1.toFixed(2) : "—"}</td>
                <td class="px-2 py-1.5 text-right tabular-nums">{tick.volume > 0 ? tick.volume.toLocaleString() : "—"}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>

      {/* 底部详情面板 */}
      {selectedTick() && (
        <div class="flex-shrink-0 border-t border-white/10 bg-[#0a0f1a] p-3 text-xs">
          <div class="font-semibold text-gray-300 mb-2">详细行情 - {selectedTick()!.name} ({selectedTick()!.ts_code})</div>
          <div class="grid grid-cols-5 gap-2 text-gray-400">
            <div>买一: <span class="text-[#22C55E]">{selectedTick()!.bid1.toFixed(2)}</span> × {selectedTick()!.bidVol1}</div>
            <div>买二: <span class="text-[#22C55E]">{(lastTick()?.bid_price_2 || 0).toFixed(2)}</span> × {(lastTick()?.bid_volume_2 || 0)}</div>
            <div>买三: <span class="text-[#22C55E]">{(lastTick()?.bid_price_3 || 0).toFixed(2)}</span> × {(lastTick()?.bid_volume_3 || 0)}</div>
            <div>买四: <span class="text-[#22C55E]">{(lastTick()?.bid_price_4 || 0).toFixed(2)}</span> × {(lastTick()?.bid_volume_4 || 0)}</div>
            <div>买五: <span class="text-[#22C55E]">{(lastTick()?.bid_price_5 || 0).toFixed(2)}</span> × {(lastTick()?.bid_volume_5 || 0)}</div>
            <div>卖一: <span class="text-[#EF4444]">{selectedTick()!.ask1.toFixed(2)}</span> × {selectedTick()!.askVol1}</div>
            <div>卖二: <span class="text-[#EF4444]">{(lastTick()?.ask_price_2 || 0).toFixed(2)}</span> × {(lastTick()?.ask_volume_2 || 0)}</div>
            <div>卖三: <span class="text-[#EF4444]">{(lastTick()?.ask_price_3 || 0).toFixed(2)}</span> × {(lastTick()?.ask_volume_3 || 0)}</div>
            <div>卖四: <span class="text-[#EF4444]">{(lastTick()?.ask_price_4 || 0).toFixed(2)}</span> × {(lastTick()?.ask_volume_4 || 0)}</div>
            <div>卖五: <span class="text-[#EF4444]">{(lastTick()?.ask_price_5 || 0).toFixed(2)}</span> × {(lastTick()?.ask_volume_5 || 0)}</div>
          </div>
        </div>
      )}
    </div>
  );
};
