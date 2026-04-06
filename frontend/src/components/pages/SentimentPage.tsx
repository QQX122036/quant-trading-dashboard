/**
 * SentimentPage.tsx — 市场情绪与资金流向完整页面
 * 路由: /sentiment
 */
import { Component } from 'solid-js';
import { MoneyFlowPanel } from '../market/MoneyFlowPanel';
import { SentimentGauge } from '../market/SentimentGauge';
import { SectorMoneyFlow } from '../market/SectorMoneyFlow';

export const SentimentPage: Component = () => {
  return (
    <div class="p-4 space-y-4">
      {/* 顶部：情绪指数量表 */}
      <SentimentGauge />

      {/* 中部：资金流向堆叠面积图 */}
      <MoneyFlowPanel tsCode="000001.SH" />

      {/* 底部：板块资金流向表格 */}
      <SectorMoneyFlow />
    </div>
  );
};
