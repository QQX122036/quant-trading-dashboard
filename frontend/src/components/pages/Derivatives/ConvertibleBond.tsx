/**
 * ConvertibleBond.tsx — 可转债模块
 * 双低策略：低溢价率 + 低价格
 * 转股溢价率 = (转股价 - 正股现价) / 正股现价
 * 纯债价值 = 到期本息 / (1+到期收益率)^剩余年限
 */
import { Component, createSignal, createMemo, For } from 'solid-js';

interface CBItem {
  code: string;         // 转债代码
  name: string;         // 转债名称
  stockCode: string;    // 正股代码
  stockName: string;    // 正股名称
  price: number;        // 转债价格
  premium: number;       // 转股溢价率 (%)
  conversionPrice: number; // 转股价
  stockPrice: number;   // 正股现价
  conversionValue: number; // 转股价值 = 正股现价 / 转股价 * 100
  pureBondValue: number;   // 纯债价值
  bondFloor: number;       // 债底（纯债价值底）
  ytm: number;           // 到期收益率
  maturityDate: string;  // 到期日
  residualYears: number; // 剩余年限
  volume: number;        // 成交量(万元)
 的双低Score: number;   // 双低评分 = price + premium*100
}

function generateMockCBs(): CBItem[] {
  const data: Omit<CBItem, 'conversionValue' | 'pureBondValue' | 'bondFloor' | 'residualYears' | '的双低Score'>[] = [
    { code: '113050', name: '南银转债', stockCode: '601009', stockName: '南京银行', price: 108.5, premium: 8.5, conversionPrice: 10.10, stockPrice: 9.32, ytm: 0.85, maturityDate: '2027-06-15', volume: 3200 },
    { code: '113009', name: '广汽转债', stockCode: '601238', stockName: '广汽集团', price: 105.2, premium: 12.3, conversionPrice: 14.50, stockPrice: 12.91, ytm: 1.52, maturityDate: '2026-11-08', volume: 1800 },
    { code: '128136', name: '立讯转债', stockCode: '002475', stockName: '立讯精密', price: 118.6, premium: 5.2, conversionPrice: 45.20, stockPrice: 42.95, ytm: -1.20, maturityDate: '2026-03-20', volume: 4500 },
    { code: '127045', name: '招路转债', stockCode: '001965', stockName: '招商公路', price: 112.3, premium: 15.8, conversionPrice: 8.90, stockPrice: 7.68, ytm: 0.45, maturityDate: '2027-08-12', volume: 2100 },
    { code: '113055', name: '成银转债', stockCode: '601838', stockName: '成都银行', price: 115.8, premium: 3.2, conversionPrice: 14.05, stockPrice: 13.62, ytm: 0.22, maturityDate: '2027-11-30', volume: 5600 },
    { code: '128095', name: '恩捷转债', stockCode: '002812', stockName: '恩捷股份', price: 98.5, premium: 22.1, conversionPrice: 68.50, stockPrice: 56.12, ytm: 2.85, maturityDate: '2026-05-22', volume: 1200 },
    { code: '123139', name: '铂科转债', stockCode: '300811', stockName: '铂科新材', price: 105.8, premium: 18.5, conversionPrice: 76.20, stockPrice: 64.30, ytm: 1.15, maturityDate: '2027-02-18', volume: 890 },
    { code: '113527', name: '宝丰转债', stockCode: '600989', stockName: '宝丰能源', price: 108.2, premium: 25.3, conversionPrice: 10.80, stockPrice: 8.62, ytm: 0.68, maturityDate: '2027-09-05', volume: 2300 },
    { code: '128034', name: '福莱转债', stockCode: '601865', stockName: '福莱特', price: 102.5, premium: 30.2, conversionPrice: 15.20, stockPrice: 11.68, ytm: 3.12, maturityDate: '2026-07-28', volume: 980 },
    { code: '110081', name: '闻泰转债', stockCode: '600745', stockName: '闻泰科技', price: 112.5, premium: 9.8, conversionPrice: 98.50, stockPrice: 89.71, ytm: 0.55, maturityDate: '2027-04-06', volume: 3100 },
  ];

  return data.map((item) => {
    const conversionValue = (item.stockPrice / item.conversionPrice) * 100;
    // 纯债价值 = 到期本息 / (1+ytm)^剩余年限
    const residualYears = Math.max(0.5, (new Date(item.maturityDate).getTime() - Date.now()) / (365 * 24 * 3600 * 1000));
    const pureBondValue = 100 / Math.pow(1 + item.ytm / 100, residualYears);
    const bondFloor = pureBondValue * 0.92; // 债底通常是纯债价值的92%
    const 双低Score = item.price + item.premium * 100;

    return { ...item, conversionValue, pureBondValue, bondFloor, residualYears, 的双低Score };
  });
}

type SortKey = 'price' | 'premium' | '双低Score' | 'conversionValue' | 'ytm' | 'volume';

export const ConvertibleBond: Component = () => {
  const [cbs] = createSignal<CBItem[]>(generateMockCBs());
  const [sortKey, setSortKey] = createSignal<SortKey>('双低Score');
  const [sortAsc, setSortAsc] = createSignal(true);
  const [filterDoubleLow, setFilterDoubleLow] = createSignal(false);
  const [showITMOnly, setShowITMOnly] = createSignal(false);

  const sortedCBs = createMemo(() => {
    let result = [...cbs()];
    if (filterDoubleLow()) {
      result = result.filter((cb) => cb.price < 115 && cb.premium < 20);
    }
    if (showITMOnly()) {
      result = result.filter((cb) => cb.conversionValue > 100);
    }
    result.sort((a, b) => {
      const diff = (a[sortKey()] as number) - (b[sortKey()] as number);
      return sortAsc() ? diff : -diff;
    });
    return result;
  });

  const handleSort = (key: SortKey) => {
    if (sortKey() === key) {
      setSortAsc(!sortAsc());
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey() !== key) return null;
    return sortAsc() ? ' ▲' : ' ▼';
  };

  const formatVolume = (v: number) => v >= 10000 ? `${(v / 10000).toFixed(1)}亿` : `${v}万`;
  const premiumColor = (v: number) => v < 10 ? 'text-green-400' : v < 20 ? 'text-yellow-400' : 'text-red-400';
  const priceColor = (v: number) => v < 105 ? 'text-green-400' : v > 130 ? 'text-red-400' : 'text-white';
  const doubleLowColor = (v: number) => v < 120 ? 'text-green-400' : v < 150 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div class="flex flex-col h-full">
      {/* Header */}
      <div class="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <h3 class="font-bold text-sm">可转债</h3>
        <div class="flex items-center gap-3">
          {/* 双低筛选 */}
          <label class="flex items-center gap-1.5 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={filterDoubleLow()}
              onChange={(e) => setFilterDoubleLow(e.target.checked)}
              class="accent-blue-500"
            />
            <span class="text-gray-400">双低策略</span>
            <span class="text-[10px] text-gray-600">(价格&lt;115 + 溢价&lt;20%)</span>
          </label>
          {/* 溢价标的 */}
          <label class="flex items-center gap-1.5 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={showITMOnly()}
              onChange={(e) => setShowITMOnly(e.target.checked)}
              class="accent-blue-500"
            />
            <span class="text-gray-400">转股价值&gt;100</span>
          </label>
        </div>
      </div>

      {/* Stats summary */}
      <div class="flex gap-4 px-4 py-2 border-b border-white/10 bg-[#0d1117]/50">
        <div class="text-xs text-gray-400">
          双低均值: <span class="text-yellow-400 font-mono font-bold">{sortedCBs().length > 0 ? (sortedCBs().reduce((a, b) => a + b.的双低Score, 0) / sortedCBs().length).toFixed(1) : '-'}</span>
        </div>
        <div class="text-xs text-gray-400">
          平均溢价率: <span class="text-blue-400 font-mono">{sortedCBs().length > 0 ? (sortedCBs().reduce((a, b) => a + b.premium, 0) / sortedCBs().length).toFixed(1) : '-'}%</span>
        </div>
        <div class="text-xs text-gray-400">
          平均价格: <span class="text-white font-mono">{sortedCBs().length > 0 ? (sortedCBs().reduce((a, b) => a + b.price, 0) / sortedCBs().length).toFixed(1) : '-'}</span>
        </div>
        <div class="text-xs text-gray-400">
          标的数量: <span class="text-white font-mono">{sortedCBs().length}</span>
        </div>
      </div>

      {/* Table */}
      <div class="flex-1 overflow-auto">
        <table class="w-full text-xs">
          <thead class="sticky top-0 bg-[#111827] z-10">
            <tr class="text-gray-400 border-b border-white/10">
              <th class="py-2 px-2 text-left">转债名称</th>
              <th class="py-2 px-2 text-right cursor-pointer hover:text-white" onClick={() => handleSort('price')}>价格{sortIndicator('price')}</th>
              <th class="py-2 px-2 text-right cursor-pointer hover:text-white" onClick={() => handleSort('premium')}>转股溢价率{sortIndicator('premium')}</th>
              <th class="py-2 px-2 text-right cursor-pointer hover:text-white" onClick={() => handleSort('conversionValue')}>转股价值{sortIndicator('conversionValue')}</th>
              <th class="py-2 px-2 text-right">纯债价值</th>
              <th class="py-2 px-2 text-right">债底</th>
              <th class="py-2 px-2 text-right cursor-pointer hover:text-white" onClick={() => handleSort('ytm')}>到期收益率{sortIndicator('ytm')}</th>
              <th class="py-2 px-2 text-right cursor-pointer hover:text-white" onClick={() => handleSort('双低Score')}>双低评分{sortIndicator('双低Score')}</th>
              <th class="py-2 px-2 text-right cursor-pointer hover:text-white" onClick={() => handleSort('volume')}>成交量{sortIndicator('volume')}</th>
              <th class="py-2 px-2 text-left">正股</th>
              <th class="py-2 px-2 text-right">剩余年限</th>
            </tr>
          </thead>
          <tbody>
            <For each={sortedCBs()}>
              {(cb) => (
                <tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td class="py-1.5 px-2">
                    <div class="font-mono text-white font-medium">{cb.code}</div>
                    <div class="text-[10px] text-gray-500">{cb.name}</div>
                  </td>
                  <td class={`py-1.5 px-2 text-right font-mono font-medium ${priceColor(cb.price)}`}>
                    {cb.price.toFixed(2)}
                  </td>
                  <td class={`py-1.5 px-2 text-right font-mono ${premiumColor(cb.premium)}`}>
                    {cb.premium.toFixed(2)}%
                  </td>
                  <td class={`py-1.5 px-2 text-right font-mono ${cb.conversionValue >= 100 ? 'text-green-400' : 'text-gray-400'}`}>
                    {cb.conversionValue.toFixed(1)}
                  </td>
                  <td class="py-1.5 px-2 text-right font-mono text-gray-400">
                    {cb.pureBondValue.toFixed(2)}
                  </td>
                  <td class="py-1.5 px-2 text-right font-mono text-gray-500">
                    {cb.bondFloor.toFixed(2)}
                  </td>
                  <td class={`py-1.5 px-2 text-right font-mono ${cb.ytm >= 0 ? 'text-gray-300' : 'text-red-400'}`}>
                    {cb.ytm >= 0 ? '+' : ''}{cb.ytm.toFixed(2)}%
                  </td>
                  <td class={`py-1.5 px-2 text-right font-mono font-bold ${doubleLowColor(cb.的双低Score)}`}>
                    {cb.的双低Score.toFixed(1)}
                  </td>
                  <td class="py-1.5 px-2 text-right font-mono text-gray-400">
                    {formatVolume(cb.volume)}
                  </td>
                  <td class="py-1.5 px-2">
                    <div class="text-gray-300">{cb.stockName}</div>
                    <div class="text-[10px] text-gray-500 font-mono">{cb.stockCode}</div>
                  </td>
                  <td class="py-1.5 px-2 text-right font-mono text-gray-500">
                    {cb.residualYears.toFixed(1)}年
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>

      {/* Formula explanation */}
      <div class="px-4 py-2 border-t border-white/10 text-[10px] text-gray-600 grid grid-cols-2 gap-x-4">
        <div>转股溢价率 = (转股价 - 正股现价) / 正股现价 × 100%</div>
        <div>纯债价值 = 100 / (1 + 到期收益率)^剩余年限</div>
      </div>
    </div>
  );
};
