import { For, Component, createMemo, onMount, createSignal } from 'solid-js';
import { state } from '../../stores';
import { fetchOrders, cancelOrder } from '../../hooks/useApi';
import { formatPrice, formatTime } from '../../utils/format';
import { directionBg, statusColor } from '../../utils/color';
import type { OrderStatus, OrderData } from '../../types/vnpy';

interface Column {
  field: string;
  header: string;
  width?: number;
  align?: string;
}

const COLUMNS: Column[] = [
  { field: 'vt_orderid',  header: '委托号',   width: 150 },
  { field: 'symbol',     header: '代码',     width: 80 },
  { field: 'exchange',   header: '交易所',   width: 60 },
  { field: 'direction',  header: '方向',     width: 50,  align: 'center' },
  { field: 'offset',     header: '开平',     width: 50,  align: 'center' },
  { field: 'type',       header: '类型',     width: 65 },
  { field: 'price',      header: '价格',     width: 90,  align: 'right' },
  { field: 'volume',     header: '数量',     width: 65,  align: 'right' },
  { field: 'traded',     header: '已成交',   width: 65,  align: 'right' },
  { field: 'status',     header: '状态',     width: 80,  align: 'center' },
  { field: 'datetime',   header: '时间',     width: 110 },
];

type OrderFilter = '全部' | '未成交' | '部分成交' | '已撤回';
const ORDER_FILTERS: OrderFilter[] = ['全部', '未成交', '部分成交', '已撤回'];

const FILTER_STATUS_MAP: Record<OrderFilter, OrderStatus | null> = {
  '全部':     null,
  '未成交':   '未成交',
  '部分成交': '部分成交',
  '已撤回':   '已撤销',
};

export const OrderMonitor: Component = () => {
  const [filter, setFilter] = createSignal<OrderFilter>('全部');

  // 仅显示未完成订单：过滤掉全部成交和已撤销
  const activeOrders = createMemo(() =>
    Object.values(state.orders.all)
      .filter((o) => o.status !== '全部成交' && o.status !== '已撤销')
      .sort((a, b) => b.datetime.localeCompare(a.datetime))
  );

  const filteredOrders = createMemo(() => {
    const f = FILTER_STATUS_MAP[filter()];
    if (!f) return activeOrders();
    return activeOrders().filter((o) => o.status === f);
  });

  onMount(async () => {
    try {
      const res = await fetchOrders();
      if (res.code === '0' && res.data?.orders) {
        for (const order of res.data.orders) {
          state.orders.all[order.vt_orderid] = order;
        }
      }
    } catch (e) {
      console.warn('[OrderMonitor] fetchOrders error', e);
    }
  });

  async function handleCancel(order: OrderData) {
    try {
      await cancelOrder(order.vt_orderid, order.symbol, order.exchange);
    } catch (e) {
      console.warn('[OrderMonitor] cancelOrder error', e);
    }
  }

  return (
    <div class="h-full flex flex-col overflow-hidden">
      {/* 状态过滤器 */}
      <div class="flex items-center gap-1 px-2 py-1.5 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <span class="text-xs text-[var(--text-muted)] mr-1">筛选:</span>
        {ORDER_FILTERS.map((f) => (
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
          {filteredOrders().length} / {activeOrders().length} 单
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
            <For each={filteredOrders()} fallback={
              <tr>
                <td colspan={COLUMNS.length} class="text-center py-8 text-[var(--text-muted)]">
                  暂无委托记录
                </td>
              </tr>
            }>
              {(order) => (
                <tr
                  class="border-b border-[var(--border-color)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
                  onDblClick={() => handleCancel(order)}
                  title="双击撤单"
                >
                  <For each={COLUMNS}>
                    {(col) => {
                      const val = (order as unknown as Record<string, unknown>)[col.field];
                      const textAlign = { left: 'text-left', right: 'text-right', center: 'text-center' }[col.align ?? 'left'];

                      if (col.field === 'direction') {
                        return (
                          <td class="px-1.5 py-1 text-center">
                            <span class={`inline-block px-1 py-0.5 rounded text-[10px] font-bold ${directionBg(val as string)}`}>
                              {val as string}
                            </span>
                          </td>
                        );
                      }
                      if (col.field === 'status') {
                        return (
                          <td class="px-1.5 py-1 text-center">
                            <span class={`inline-block px-1 py-0.5 rounded text-[10px] ${statusColor(val as string)}`}>
                              {val as string}
                            </span>
                          </td>
                        );
                      }
                      if (col.field === 'price') {
                        return <td class={`px-1.5 py-1 text-xs font-mono tabular-nums ${textAlign} text-[var(--text-primary)]`}>{formatPrice(val as number)}</td>;
                      }
                      if (col.field === 'datetime') {
                        return <td class={`px-1.5 py-1 text-xs font-mono ${textAlign} text-[var(--text-muted)]`}>{formatTime(val as string)}</td>;
                      }
                      return <td class={`px-1.5 py-1 text-xs ${textAlign} text-[var(--text-secondary)]`}>{String(val ?? '-')}</td>;
                    }}
                  </For>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </div>
  );
};
