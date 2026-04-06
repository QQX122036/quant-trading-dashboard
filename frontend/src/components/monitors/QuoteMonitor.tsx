import { For, Component, createMemo, onMount, createSignal } from 'solid-js';
import { fetchQuotes, cancelQuote } from '../../hooks/useApi';
import { formatPrice, formatTime } from '../../utils/format';
import type { QuoteData, QuoteStatus } from '../../types/vnpy';

interface Column {
  field: string;
  header: string;
  width?: number;
  align?: 'left' | 'right' | 'center';
}

const COLUMNS: Column[] = [
  { field: 'quote_id',   header: '报价号',   width: 130 },
  { field: 'source',     header: '来源',     width: 55,  align: 'center' },
  { field: 'ts_code',    header: '代码',     width: 90 },
  { field: 'bid_offset', header: '买开平',   width: 55,  align: 'center' },
  { field: 'bid_volume_1', header: '买量',  width: 65,  align: 'right' },
  { field: 'bid_price_1', header: '买价',   width: 80,  align: 'right' },
  { field: 'ask_price_1', header: '卖价',   width: 80,  align: 'right' },
  { field: 'ask_volume_1', header: '卖量',  width: 65,  align: 'right' },
  { field: 'ask_offset', header: '卖开平',   width: 55,  align: 'center' },
  { field: 'bid_price_2', header: '买二',   width: 70,  align: 'right' },
  { field: 'ask_price_2', header: '卖二',   width: 70,  align: 'right' },
  { field: 'status',     header: '状态',     width: 70,  align: 'center' },
  { field: 'time',       header: '时间',     width: 100 },
];

type QuoteFilter = '全部' | '活跃' | '已成交' | '已撤销';
const QUOTE_FILTERS: QuoteFilter[] = ['全部', '活跃', '已成交', '已撤销'];

const STATUS_COLOR: Record<QuoteStatus, string> = {
  '活跃':   'bg-green-700 text-white',
  '已成交': 'bg-blue-600 text-white',
  '已撤销': 'bg-gray-500 text-white',
};

const OFFSET_COLOR: Record<string, string> = {
  '开': 'bg-red-500/20 text-red-400',
  '平': 'bg-cyan-500/20 text-cyan-400',
};

export const QuoteMonitor: Component = () => {
  const [filter, setFilter] = createSignal<QuoteFilter>('全部');
  const [quotes, setQuotes] = createSignal<QuoteData[]>([]);
  const [loading, setLoading] = createSignal(false);

  const filteredQuotes = createMemo(() => {
    const f = filter();
    if (f === '全部') return quotes();
    return quotes().filter((q) => q.status === f);
  });

  onMount(async () => {
    setLoading(true);
    try {
      const res = await fetchQuotes();
      if (res.code === '0' && res.data?.quotes) {
        setQuotes(res.data.quotes);
      }
    } catch (e) {
      console.warn('[QuoteMonitor] fetchQuotes error', e);
    } finally {
      setLoading(false);
    }
  });

  async function handleCancel(quote: QuoteData) {
    if (quote.status === '已撤销') return;
    try {
      await cancelQuote(quote.quote_id);
      // 更新本地状态
      setQuotes((prev) =>
        prev.map((q) =>
          q.quote_id === quote.quote_id ? { ...q, status: '已撤销' as QuoteStatus } : q
        )
      );
    } catch (e) {
      console.warn('[QuoteMonitor] cancelQuote error', e);
    }
  }

  return (
    <div class="h-full flex flex-col overflow-hidden">
      {/* 状态过滤器 */}
      <div class="flex items-center gap-1 px-2 py-1.5 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <span class="text-xs text-[var(--text-muted)] mr-1">筛选:</span>
        {QUOTE_FILTERS.map((f) => (
          <button
            class={`px-2 py-0.5 rounded text-[11px] transition-colors ${
              filter() === f
                ? 'bg-[var(--bg-active)] text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
        <span class="ml-auto text-[10px] text-[var(--text-muted)]">
          {filteredQuotes().length} / {quotes().length} 笔
        </span>
      </div>

      <div class="flex-1 overflow-auto">
        <table class="w-full border-collapse text-xs">
          <thead class="sticky top-0 z-10 bg-[var(--bg-tertiary)]">
            <tr>
              <For each={COLUMNS}>
                {(col) => (
                  <th
                    class="px-1.5 py-2 text-[var(--text-muted)] font-normal border-b border-[var(--border-color)] whitespace-nowrap"
                    style={{ width: col.width ? `${col.width}px` : undefined, 'text-align': (col.align ?? 'left') as any }}
                  >
                    {col.header}
                  </th>
                )}
              </For>
            </tr>
          </thead>
          <tbody>
            {loading() ? (
              <tr>
                <td colspan={COLUMNS.length} class="text-center py-8 text-[var(--text-muted)]">
                  加载中...
                </td>
              </tr>
            ) : (
              <For each={filteredQuotes()} fallback={
                <tr>
                  <td colspan={COLUMNS.length} class="text-center py-8 text-[var(--text-muted)]">
                    暂无报价记录
                  </td>
                </tr>
              }>
                {(quote) => (
                  <tr
                    class="border-b border-[var(--border-color)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
                    onDblClick={() => handleCancel(quote)}
                    title="双击撤报价"
                  >
                    <For each={COLUMNS}>
                      {(col) => {
                        const val = (quote as unknown as Record<string, unknown>)[col.field];
                        const textAlign = { left: 'text-left', right: 'text-right', center: 'text-center' }[col.align ?? 'left'];

                        if (col.field === 'bid_offset' || col.field === 'ask_offset') {
                          return (
                            <td class="px-1.5 py-1 text-center">
                              <span class={`inline-block px-1 py-0.5 rounded text-[10px] font-bold ${OFFSET_COLOR[String(val)] ?? ''}`}>
                                {String(val ?? '-')}
                              </span>
                            </td>
                          );
                        }
                        if (col.field === 'status') {
                          return (
                            <td class="px-1.5 py-1 text-center">
                              <span class={`inline-block px-1 py-0.5 rounded text-[10px] ${STATUS_COLOR[String(val) as QuoteStatus] ?? ''}`}>
                                {String(val ?? '-')}
                              </span>
                            </td>
                          );
                        }
                        if (col.field === 'bid_price_1' || col.field === 'ask_price_1' ||
                            col.field === 'bid_price_2' || col.field === 'ask_price_2') {
                          return <td class={`px-1.5 py-1 text-xs font-mono tabular-nums ${textAlign} text-[var(--text-primary)]`}>{formatPrice(Number(val))}</td>;
                        }
                        if (col.field === 'bid_volume_1' || col.field === 'ask_volume_1') {
                          return <td class={`px-1.5 py-1 text-xs font-mono tabular-nums ${textAlign} text-[var(--text-secondary)]`}>{Number(val).toLocaleString()}</td>;
                        }
                        if (col.field === 'time') {
                          return <td class={`px-1.5 py-1 text-xs font-mono ${textAlign} text-[var(--text-muted)]`}>{formatTime(String(val))}</td>;
                        }
                        return <td class={`px-1.5 py-1 text-xs ${textAlign} text-[var(--text-secondary)]`}>{String(val ?? '-')}</td>;
                      }}
                    </For>
                  </tr>
                )}
              </For>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
