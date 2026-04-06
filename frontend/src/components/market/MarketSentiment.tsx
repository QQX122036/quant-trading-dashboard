import { Component } from 'solid-js';
import type { SentimentType } from '../../types/api';

interface MarketSentimentProps {
  sentiment: SentimentType;
  upRatio?: number;
}

export const MarketSentiment: Component<MarketSentimentProps> = (props) => {
  const config = () => {
    switch (props.sentiment) {
      case 'bullish':
        return {
          emoji: '🟢',
          text: '偏多',
          description: '市场氛围活跃，多头占据优势',
          color: 'text-[#22C55E]',
          bgClass: 'bg-green-500/10 border-green-500/30',
        };
      case 'bearish':
        return {
          emoji: '🔴',
          text: '偏空',
          description: '市场氛围较弱，空头占据优势',
          color: 'text-[#EF4444]',
          bgClass: 'bg-red-500/10 border-red-500/30',
        };
      default:
        return {
          emoji: '🟡',
          text: '震荡',
          description: '市场方向不明，建议观望',
          color: 'text-[#F59E0B]',
          bgClass: 'bg-yellow-500/10 border-yellow-500/30',
        };
    }
  };

  return (
    <div class={`rounded-lg border p-4 ${config().bgClass}`}>
      <h3 class="text-sm text-gray-400 mb-2">市场情绪</h3>
      <div class="flex items-center gap-3">
        <span class="text-3xl">{config().emoji}</span>
        <div>
          <div class={`text-xl font-bold ${config().color}`}>{config().text}</div>
          <div class="text-xs text-gray-500">{config().description}</div>
          {props.upRatio !== undefined && (
            <div class="text-xs text-gray-600 mt-0.5">
              上涨比 {props.upRatio < 0 ? '' : ''}{(props.upRatio * 100).toFixed(1)}%
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
