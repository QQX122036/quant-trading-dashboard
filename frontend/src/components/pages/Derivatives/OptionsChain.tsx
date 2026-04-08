/**
 * OptionsChain.tsx — 期权链模块
 * 展示PUT/CALL报价、隐含波动率、成交量、持仓量，支持月度/季度到期切换
 */
import { Component, createSignal, For, Show, createMemo } from 'solid-js';

interface OptionRow {
  strike: number;
  callBid: number;
  callAsk: number;
  callIV: number;
  callVolume: number;
  callOI: number;
  putBid: number;
  putAsk: number;
  putIV: number;
  putVolume: number;
  putOI: number;
  parity?: 'ITM' | 'ATM' | 'OTM';
}

// 模拟数据（真实数据来自AKShare期权API）
function generateMockOptions(spotPrice: number, _expiryLabel: string): OptionRow[] {
  const rows: OptionRow[] = [];
  const ATMStrike = Math.round(spotPrice / 10) * 10;
  const strikes = Array.from({ length: 21 }, (_, i) => ATMStrike - 100 + i * 10);

  strikes.forEach((strike) => {
    const moneyness = strike / spotPrice;
    const baseIV = 0.2 + Math.random() * 0.1;
    const iv = moneyness < 0.95 ? baseIV + 0.05 : moneyness > 1.05 ? baseIV - 0.03 : baseIV;
    const spread = 0.02 + Math.random() * 0.03;

    rows.push({
      strike,
      callBid: +(spotPrice * (1 - strike / spotPrice) * Math.exp(-0.05)).toFixed(3) || 0.05,
      callAsk:
        +(spotPrice * (1 - strike / spotPrice) * Math.exp(-0.05) + spread).toFixed(3) || 0.08,
      callIV: +(iv * 100).toFixed(2),
      callVolume: Math.floor(Math.random() * 50000),
      callOI: Math.floor(Math.random() * 200000),
      putBid: +(strike * Math.exp(-0.05) - spotPrice).toFixed(3) || 0.05,
      putAsk: +(strike * Math.exp(-0.05) - spotPrice + spread).toFixed(3) || 0.08,
      putIV: +(iv * 100).toFixed(2),
      putVolume: Math.floor(Math.random() * 50000),
      putOI: Math.floor(Math.random() * 200000),
      parity: moneyness < 0.98 ? 'OTM' : moneyness > 1.02 ? 'ITM' : 'ATM',
    });
  });
  return rows;
}

type ExpiryType = 'monthly' | 'quarterly';

export const OptionsChain: Component = () => {
  const [expiryType, setExpiryType] = createSignal<ExpiryType>('monthly');
  const [spotPrice] = createSignal(3850); // 沪深300指数模拟

  const optionsData = createMemo(() => generateMockOptions(spotPrice(), expiryType()));

  const expiryDates = {
    monthly: ['2026-04-23', '2026-05-21', '2026-06-18', '2026-07-16'],
    quarterly: ['2026-04-23', '2026-05-21', '2026-06-18'],
  };

  const [selectedExpiry, setSelectedExpiry] = createSignal(expiryDates.monthly[0]);

  const formatVolume = (v: number) => (v >= 10000 ? `${(v / 10000).toFixed(1)}万` : String(v));
  const formatOI = (v: number) => (v >= 10000 ? `${(v / 10000).toFixed(1)}万` : String(v));

  return (
    <div class="flex flex-col h-full">
      {/* Header */}
      <div class="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div class="flex items-center gap-4">
          <h3 class="font-bold text-sm">期权链</h3>
          {/* Expiry type tabs */}
          <div class="flex gap-1">
            <button
              class={`px-3 py-1 text-xs rounded ${expiryType() === 'monthly' ? 'bg-blue-600 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'}`}
              onClick={() => setExpiryType('monthly')}
            >
              月度
            </button>
            <button
              class={`px-3 py-1 text-xs rounded ${expiryType() === 'quarterly' ? 'bg-blue-600 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'}`}
              onClick={() => setExpiryType('quarterly')}
            >
              季度
            </button>
          </div>
          {/* Expiry date selector */}
          <select
            class="bg-white/10 text-xs rounded px-2 py-1 border border-white/10"
            value={selectedExpiry()}
            onChange={(e) => setSelectedExpiry(e.target.value)}
          >
            <For each={expiryDates[expiryType()]}>
              {(date) => <option value={date}>{date}</option>}
            </For>
          </select>
        </div>

        <div class="flex items-center gap-3 text-xs">
          <span class="text-gray-400">
            标的: <span class="text-white font-mono">沪深300 ETF</span>
          </span>
          <span class="text-gray-400">
            现价: <span class="text-green-400 font-mono">{spotPrice().toFixed(2)}</span>
          </span>
          <span class="text-gray-400">
            到期: <span class="text-white">{selectedExpiry()}</span>
          </span>
        </div>
      </div>

      {/* PUT/CALL spread analysis */}
      <div class="px-4 py-2 border-b border-white/10 flex gap-6 text-xs">
        <span class="text-gray-400">
          PUT买卖价差: <span class="text-red-400">0.03</span>
        </span>
        <span class="text-gray-400">
          CALL买卖价差: <span class="text-green-400">0.03</span>
        </span>
        <span class="text-gray-400">
          ATM波动率: <span class="text-yellow-400">22.5%</span>
        </span>
      </div>

      {/* Table */}
      <div class="flex-1 overflow-auto">
        <table class="w-full text-xs">
          <thead class="sticky top-0 bg-[#111827] z-10">
            <tr class="text-gray-400 border-b border-white/10">
              <th class="py-2 px-2 text-center font-medium" colspan="5">
                PUT 看跌期权
              </th>
              <th class="py-2 px-2 text-center font-bold text-white border-x border-white/20">
                行权价
              </th>
              <th class="py-2 px-2 text-center font-medium" colspan="5">
                CALL 看涨期权
              </th>
            </tr>
            <tr class="text-gray-500 border-b border-white/5">
              <th class="py-1 px-1 text-right">买价</th>
              <th class="py-1 px-1 text-right">卖价</th>
              <th class="py-1 px-1 text-right">IV%</th>
              <th class="py-1 px-1 text-right">成交量</th>
              <th class="py-1 px-1 text-right">持仓量</th>
              <th class="py-1 px-2 text-center border-x border-white/10 font-bold text-white">
                行权价
              </th>
              <th class="py-1 px-1 text-left">买价</th>
              <th class="py-1 px-1 text-left">卖价</th>
              <th class="py-1 px-1 text-left">IV%</th>
              <th class="py-1 px-1 text-left">成交量</th>
              <th class="py-1 px-1 text-left">持仓量</th>
            </tr>
          </thead>
          <tbody>
            <For each={optionsData()}>
              {(row) => (
                <tr
                  class={`border-b border-white/5 hover:bg-white/5 transition-colors ${
                    row.parity === 'ATM'
                      ? 'bg-blue-900/20'
                      : row.parity === 'ITM'
                        ? 'bg-red-900/10'
                        : 'bg-green-900/10'
                  }`}
                >
                  {/* PUT side */}
                  <td class="py-1 px-1 text-right font-mono text-red-400">
                    {row.putBid.toFixed(3)}
                  </td>
                  <td class="py-1 px-1 text-right font-mono text-red-300">
                    {row.putAsk.toFixed(3)}
                  </td>
                  <td class="py-1 px-1 text-right font-mono text-gray-400">
                    {row.putIV.toFixed(1)}%
                  </td>
                  <td class="py-1 px-1 text-right font-mono text-gray-300">
                    {formatVolume(row.putVolume)}
                  </td>
                  <td class="py-1 px-1 text-right font-mono text-gray-300">
                    {formatOI(row.putOI)}
                  </td>
                  {/* Strike */}
                  <td
                    class={`py-1 px-2 text-center font-mono font-bold border-x border-white/10 ${
                      row.parity === 'ATM' ? 'text-yellow-400 bg-yellow-900/30' : 'text-white'
                    }`}
                  >
                    {row.strike.toFixed(2)}
                    <Show when={row.parity !== 'ATM'}>
                      <span class="ml-1 text-[9px] text-gray-500">{row.parity}</span>
                    </Show>
                  </td>
                  {/* CALL side */}
                  <td class="py-1 px-1 text-left font-mono text-green-400">
                    {row.callBid.toFixed(3)}
                  </td>
                  <td class="py-1 px-1 text-left font-mono text-green-300">
                    {row.callAsk.toFixed(3)}
                  </td>
                  <td class="py-1 px-1 text-left font-mono text-gray-400">
                    {row.callIV.toFixed(1)}%
                  </td>
                  <td class="py-1 px-1 text-left font-mono text-gray-300">
                    {formatVolume(row.callVolume)}
                  </td>
                  <td class="py-1 px-1 text-left font-mono text-gray-300">
                    {formatOI(row.callOI)}
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>

      {/* Strategy quick buttons */}
      <div class="px-4 py-2 border-t border-white/10 flex gap-2">
        <span class="text-xs text-gray-400 mr-2">快速策略:</span>
        <For each={['牛市价差', '熊市价差', '跨式组合', '宽跨式', '领口策略']}>
          {(strategy) => (
            <button class="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20 text-gray-300 transition-colors">
              {strategy}
            </button>
          )}
        </For>
      </div>
    </div>
  );
};
