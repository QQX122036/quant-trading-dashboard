import { Component } from 'solid-js';

interface IndexCardProps {
  ts_code: string;
  name: string;
  displayName: string;
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  loading?: boolean;
  error?: string | null;
}

export const IndexCard: Component<IndexCardProps> = (props) => {
  const isUp = () => props.changePercent >= 0;
  const hasData = () => !props.loading && props.price > 0 && !props.error;

  return (
    <div
      class="bg-[#111827]/80 rounded-lg border border-white/10 p-4 hover:border-white/20 hover:bg-[#1a2332]/80 transition-all duration-200 hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 cursor-default"
      role="region"
      aria-label={`${props.displayName}指数行情`}
    >
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm text-gray-400" id={`idx-label-${props.ts_code}`}>
          {props.displayName}
        </span>
        <span
          class={`text-xs px-2 py-0.5 rounded ${
            props.loading
              ? 'bg-gray-500/20 text-gray-400'
              : isUp()
                ? 'bg-red-500/20 text-red-400'
                : 'bg-green-500/20 text-green-400'
          }`}
          role="status"
          aria-live="polite"
          aria-label={props.loading ? '加载中' : isUp() ? '上涨' : '下跌'}
        >
          {props.loading ? '加载中' : isUp() ? '▲' : '▼'}
        </span>
      </div>

      {props.loading ? (
        <div class="animate-pulse" aria-busy="true" aria-label="数据加载中">
          <div class="h-8 bg-white/5 rounded w-3/4 mb-2" />
          <div class="h-4 bg-white/5 rounded w-1/2" />
        </div>
      ) : props.error ? (
        <div class="text-gray-500 text-sm py-2" role="alert" aria-invalid="true">
          {props.error}
        </div>
      ) : hasData() ? (
        <>
          <div
            class="text-2xl font-bold tabular-nums mb-1 text-white tracking-tight"
            aria-labelledby={`idx-label-${props.ts_code}`}
          >
            {props.price.toLocaleString('zh-CN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div
            class={`text-sm tabular-nums font-medium ${isUp() ? 'text-[#EF4444]' : 'text-[#22C55E]'}`}
            aria-label={`涨跌额${isUp() ? '+' : ''}${props.change.toFixed(2)}元, 涨跌幅${isUp() ? '+' : ''}${props.changePercent.toFixed(2)}%`}
          >
            {isUp() ? '+' : ''}
            {props.change.toFixed(2)}
            <span class="ml-1 opacity-75" aria-hidden="true">
              ({isUp() ? '+' : ''}
              {props.changePercent.toFixed(2)}%)
            </span>
          </div>
        </>
      ) : (
        <div class="text-gray-500 text-sm py-2" aria-label="暂无数据">
          暂无数据
        </div>
      )}
    </div>
  );
};
