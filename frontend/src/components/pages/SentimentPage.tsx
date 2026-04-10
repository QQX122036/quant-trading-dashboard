/**
 * SentimentPage.tsx — 市场情绪完整页面
 * 路由: /sentiment
 *
 * 组件结构（Fintech Dark + Glassmorphism + Bento Grid）:
 *  ┌─────────────────────────────────────────────┐
 *  │  SentimentGauge — 恐慌/贪婪仪表盘 + 波动率   │
 *  ├────────────────────┬────────────────────────┤
 *  │ 情绪走势折线图      │ 情绪与市场对比图        │
 *  │ SentimentTrendChart│ SentimentMarketCompare  │
 *  ├────────────────────┴────────────────────────┤
 *  │ 板块情绪热力图 SectorSentimentHeatmap       │
 *  ├─────────────────────────────────────────────┤
 *  │ 资金流向堆叠面积图 MoneyFlowPanel            │
 *  ├─────────────────────────────────────────────┤
 *  │ 板块资金流向表格 SectorMoneyFlow             │
 *  └─────────────────────────────────────────────┘
 */
import { Component, createSignal } from 'solid-js';
import { SentimentGauge } from '../market/SentimentGauge';
import { SentimentTrendChart } from '../market/SentimentTrendChart';
import { SentimentMarketCompare } from '../market/SentimentMarketCompare';
import { SectorSentimentHeatmap } from '../market/SectorSentimentHeatmap';
import { MoneyFlowPanel } from '../market/MoneyFlowPanel';
import { SectorMoneyFlow } from '../market/SectorMoneyFlow';

export const SentimentPage: Component = () => {
  const [tsCode, _setTsCode] = createSignal('000001.SH');
  const [indexCode, setIndexCode] = createSignal('000001.SH');

  return (
    <div class="h-full overflow-auto bg-[#0A0E17]">
      {/* ── Header ── */}
      <div class="sticky top-0 z-10 bg-[#0A0E17]/90 backdrop-blur-sm border-b border-white/5 px-4 py-3 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-3">
          <h2 class="text-sm font-bold text-white">📊 市场情绪监控</h2>
          <div class="text-xs text-gray-500">同花顺/东方财富级情绪分析</div>
        </div>
        <div class="flex items-center gap-2">
          <label class="text-xs text-gray-500">
            指数:
            <input
              type="text"
              value={indexCode()}
              onInput={(e) => setIndexCode(e.currentTarget.value)}
              placeholder="000001.SH"
              class="ml-1 bg-[#1f2937] border border-white/10 rounded px-2 py-0.5 text-xs text-gray-200 w-24 focus:outline-none focus:border-blue-500/50"
            />
          </label>
        </div>
      </div>

      {/* ── Bento Grid Layout ── */}
      <div class="p-4 space-y-4">
        {/* Row 1: Sentiment Gauge (full width) */}
        <div class="grid grid-cols-1">
          <SentimentGauge />
        </div>

        {/* Row 2: Trend + Compare side by side */}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SentimentTrendChart tsCode={tsCode()} days={30} />
          <SentimentMarketCompare indexCode={indexCode()} days={30} />
        </div>

        {/* Row 3: Sector Sentiment Heatmap (full width) */}
        <div class="grid grid-cols-1">
          <SectorSentimentHeatmap maxItems={28} />
        </div>

        {/* Row 4: Money Flow (full width) */}
        <div class="grid grid-cols-1">
          <MoneyFlowPanel tsCode={tsCode()} />
        </div>

        {/* Row 5: Sector Money Flow Table (full width) */}
        <div class="grid grid-cols-1">
          <SectorMoneyFlow />
        </div>
      </div>
    </div>
  );
};
