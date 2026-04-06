/**
 * TradingWidget.tsx — 交易面板组件
 * 真实下单功能对接 SimEngine
 *
 * 功能：
 * 1. 网关连接 (POST /api/gateway/connect)
 * 2. 下单 (POST /api/order/send)
 * 3. 撤单 (POST /api/order/cancel)
 * 4. 成交回报 WebSocket 实时更新
 * 5. 持仓变化实时显示
 */
import { Component, createSignal, createEffect, For, Show, onMount, onCleanup } from 'solid-js';
import { state, actions } from '../../stores';
import { apiActions } from '../../stores/apiStore';
import { getWsInstance } from '../../hooks/useWebSocket';
import { formatPrice, formatVolume, formatPercent } from '../../utils/format';
import { directionBg } from '../../utils/color';
import type { OrderData, PositionData, TickData } from '../../types/vnpy';

const GATEWAY_NAME = 'DUCKDB_SIM';

export const TradingWidget: Component = () => {
  // ── Local UI State ──────────────────────────────────────────
  const [direction, setDirection] = createSignal<'多' | '空'>('多');
  const [offset, setOffset] = createSignal<'开' | '平'>('开');
  const [price, setPrice] = createSignal<string>('');
  const [volume, setVolume] = createSignal<string>('100');
  const [submitting, setSubmitting] = createSignal(false);
  const [submitError, setSubmitError] = createSignal<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = createSignal<string | null>(null);
  const [activeOrders, setActiveOrders] = createSignal<OrderData[]>([]);
  const [connecting, setConnecting] = createSignal(false);

  // ── Derived ─────────────────────────────────────────────────
  const selected = () => state.ui.selectedVtSymbol;
  const tick = (): TickData | undefined => selected() ? state.market.ticks[selected()] : undefined;

  // 解析 vt_symbol -> symbol + exchange
  const symbolExchange = () => {
    const vt = selected();
    if (!vt) return { symbol: '', exchange: '' };
    // 格式: "600519.SSE" -> symbol="600519", exchange="SSE"
    const parts = vt.split('.');
    return {
      symbol: parts[0] || '',
      exchange: parts[1] || 'SSE',
    };
  };

  const positions = () => {
    const pos = state.positions.items;
    return Object.values(pos).filter(p => p.gateway_name === GATEWAY_NAME);
  };

  const selectedPosition = () => {
    const se = symbolExchange();
    if (!se.symbol) return undefined;
    return positions().find(p => p.symbol === se.symbol);
  };

  const depth = (): { bid: [number, number][]; ask: [number, number][] } => {
    const t = tick();
    if (!t) return { bid: [], ask: [] };
    return {
      bid: [
        [t.bid_price_1, t.bid_volume_1],
        [t.bid_price_2, t.bid_volume_2],
        [t.bid_price_3, t.bid_volume_3],
        [t.bid_price_4, t.bid_volume_4],
        [t.bid_price_5, t.bid_volume_5],
      ],
      ask: [
        [t.ask_price_1, t.ask_volume_1],
        [t.ask_price_2, t.ask_volume_2],
        [t.ask_price_3, t.ask_volume_3],
        [t.ask_price_4, t.ask_volume_4],
        [t.ask_price_5, t.ask_volume_5],
      ],
    };
  };

  const change = () => {
    const t = tick();
    if (!t || !t.pre_close) return { v: 0, p: 0 };
    const c = t.last_price - t.pre_close;
    return { v: c, p: (c / t.pre_close) * 100 };
  };

  // ── Gateway Connection ──────────────────────────────────────
  const connectGateway = async () => {
    setConnecting(true);
    try {
      const res = await apiActions.connectGateway(GATEWAY_NAME, {});
      if (res.code === '0' && (res.data as any)?.success) {
        // 连接成功，刷新数据
        await apiActions.refreshAll(GATEWAY_NAME);
      } else {
        setSubmitError((res.message as string) || '网关连接失败');
      }
    } catch (e: unknown) {
      setSubmitError(String(e));
    } finally {
      setConnecting(false);
    }
  };

  // ── WebSocket Handlers ──────────────────────────────────────
  const ws = getWsInstance();

  const orderHandler = (msg: any) => {
    if (msg.type === 'order') {
      const order = msg.data as OrderData;
      if (order.gateway_name === GATEWAY_NAME) {
        // 更新本地活跃订单
        setActiveOrders(prev => {
          const existing = prev.findIndex(o => o.vt_orderid === order.vt_orderid);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = order;
            return updated;
          }
          return [order, ...prev];
        });
        // 同时更新全局 store
        actions.orders.upsertOrder(order);
      }
    }
  };

  const tradeHandler = (msg: any) => {
    if (msg.type === 'trade') {
      const trade = msg.data;
      if (trade.gateway_name === GATEWAY_NAME) {
        actions.trades.prependTrade(trade);
        // 刷新持仓
        apiActions.fetchPositions(GATEWAY_NAME);
        apiActions.fetchAccounts(GATEWAY_NAME);
      }
    }
  };

  const positionHandler = (msg: any) => {
    if (msg.type === 'position') {
      const pos = msg.data as PositionData;
      if (pos.gateway_name === GATEWAY_NAME) {
        actions.positions.upsertPosition(pos);
      }
    }
  };

  onMount(async () => {
    // 注册 WS 处理器
    ws.addHandler('order', orderHandler as any);
    ws.addHandler('trade', tradeHandler as any);
    ws.addHandler('position', positionHandler as any);

    // 连接网关
    await connectGateway();

    // 获取当前合约信息
    if (selected()) {
      const t = tick();
      if (t) {
        setPrice(String(t.last_price || 0));
      }
    }
  });

  onCleanup(() => {
    ws.removeHandler('order', orderHandler as any);
    ws.removeHandler('trade', tradeHandler as any);
    ws.removeHandler('position', positionHandler as any);
  });

  // 当选中的合约变化时，更新价格显示
  createEffect(() => {
    const t = tick();
    if (t?.last_price) {
      setPrice(String(t.last_price));
    }
  });

  // ── Submit Order ─────────────────────────────────────────────
  const handleSubmit = async () => {
    const se = symbolExchange();
    if (!se.symbol) {
      setSubmitError('请先选择合约');
      return;
    }
    const priceVal = parseFloat(price());
    const volumeVal = parseInt(volume());
    if (!priceVal || priceVal <= 0) {
      setSubmitError('请输入有效价格');
      return;
    }
    if (!volumeVal || volumeVal <= 0) {
      setSubmitError('请输入有效数量');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      // 映射方向: 多->long, 空->short
      const dirMap: Record<string, string> = { '多': 'long', '空': 'short' };
      // 映射开平: 开->open, 平->close
      const offsetMap: Record<string, string> = { '开': 'open', '平': 'close' };

      const req = {
        symbol: se.symbol,
        exchange: se.exchange,
        direction: dirMap[direction()] as 'long' | 'short',
        type: 'limit',
        volume: volumeVal,
        price: priceVal,
        offset: offsetMap[offset()] as 'open' | 'close',
        reference: 'TradingWidget',
        gateway: GATEWAY_NAME,
      };

      const res = await apiActions.submitOrder(req);

      if (res.code === '0' && (res.data as any)?.success) {
        setSubmitSuccess('下单成功');
        setTimeout(() => setSubmitSuccess(null), 3000);
        // 立即刷新订单
        await apiActions.fetchOrders(GATEWAY_NAME);
        await apiActions.fetchTrades(GATEWAY_NAME);
        await apiActions.fetchPositions(GATEWAY_NAME);
      } else {
        setSubmitError((res.message as string) || '下单失败');
      }
    } catch (e: unknown) {
      setSubmitError(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Cancel Order ─────────────────────────────────────────────
  const handleCancel = async (order: OrderData) => {
    try {
      const res = await apiActions.cancelOrder(order.vt_orderid, order.symbol, order.exchange);
      if (res.code === '0') {
        setActiveOrders(prev => prev.filter(o => o.vt_orderid !== order.vt_orderid));
        await apiActions.fetchOrders(GATEWAY_NAME);
      } else {
        setSubmitError((res.message as string) || '撤单失败');
      }
    } catch (e: unknown) {
      setSubmitError(String(e));
    }
  };

  // ── Cancel All ──────────────────────────────────────────────
  const handleCancelAll = async () => {
    const orders = activeOrders();
    for (const order of orders) {
      await handleCancel(order);
    }
  };

  return (
    <div class="h-full flex flex-col bg-[var(--bg-secondary)] border-r border-[var(--border-color)] overflow-y-auto">
      {/* Header */}
      <div class="px-3 py-2 border-b border-[var(--border-color)] flex items-center justify-between">
        <div class="text-xs font-bold text-[var(--text-secondary)] tracking-widest">交易面板</div>
        <Show when={connecting()}>
          <span class="text-xs text-[var(--text-muted)] animate-pulse">连接中...</span>
        </Show>
      </div>

      {/* Selected contract */}
      <div class="px-3 py-2 border-b border-[var(--border-color)]">
        <div class="text-sm text-[var(--text-primary)]">{tick()?.name || '未选择合约'}</div>
        <div class="text-xs text-[var(--text-muted)]">{selected() || '-'}</div>
      </div>

      {/* Price display */}
      <div class="px-3 py-3 border-b border-[var(--border-color)]">
        <div class="text-2xl font-bold tabular-nums" style={{ color: change().v >= 0 ? 'var(--color-up)' : 'var(--color-down)' }}>
          {formatPrice(tick()?.last_price || 0)}
        </div>
        <div class="flex gap-3 mt-1 text-xs">
          <span class={change().v >= 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}>
            {change().v >= 0 ? '+' : ''}{formatPrice(change().v)}
          </span>
          <span class={change().v >= 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}>
            {formatPercent(change().p)}
          </span>
        </div>
      </div>

      {/* Position display */}
      <Show when={selectedPosition()}>
        {(pos) => (
          <div class="px-3 py-2 border-b border-[var(--border-color)]">
            <div class="text-xs text-[var(--text-muted)] mb-1">持仓</div>
            <div class="flex gap-4 text-xs">
              <span class={pos().direction === '多' ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}>
                {pos().direction === '多' ? '多' : '空'}{pos().volume}股
              </span>
              <span class="text-[var(--text-secondary)]">
                均价 {formatPrice(pos().price)}
              </span>
              <span class={pos().pnl >= 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}>
                {pos().pnl >= 0 ? '+' : ''}{formatPrice(pos().pnl)}
              </span>
            </div>
          </div>
        )}
      </Show>

      {/* Depth */}
      <div class="px-3 py-2 border-b border-[var(--border-color)]">
        <div class="text-xs text-[var(--text-muted)] mb-1">盘口</div>
        <div class="grid grid-cols-2 gap-x-2 text-xs">
          {/* Ask (sell) */}
          <div class="space-y-0.5">
            {depth().ask.slice().reverse().map(([p, v]) => (
              <div class="flex justify-between items-center">
                <span class="text-[var(--color-ask)] font-mono tabular-nums">{formatPrice(p)}</span>
                <span class="text-[var(--text-secondary)] tabular-nums">{formatVolume(v as number)}</span>
              </div>
            ))}
          </div>
          {/* Bid (buy) */}
          <div class="space-y-0.5">
            {depth().bid.map(([p, v]) => (
              <div class="flex justify-between items-center">
                <span class="text-[var(--color-bid)] font-mono tabular-nums">{formatPrice(p)}</span>
                <span class="text-[var(--text-secondary)] tabular-nums">{formatVolume(v as number)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Order form */}
      <div class="px-3 py-3 space-y-2 flex-1">
        <div class="text-xs text-[var(--text-muted)]">下单</div>

        {/* Direction */}
        <div class="grid grid-cols-2 gap-1">
          {(['多', '空'] as const).map((d) => (
            <button
              class="py-2 rounded text-sm font-bold border transition-colors"
              classList={{
                [directionBg(d)]: true,
                'border-transparent': direction() !== d,
                'border-[var(--border-focus)]': direction() === d,
                'ring-1 ring-inset ring-white/20': direction() === d,
              }}
              onClick={() => setDirection(d)}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Offset */}
        <div class="grid grid-cols-2 gap-1">
          {(['开', '平'] as const).map((o) => (
            <button
              class="py-1.5 rounded text-xs border transition-colors"
              classList={{
                'bg-[var(--bg-active)] text-white border-transparent': offset() === o,
                'border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--border-focus)]': offset() !== o,
              }}
              onClick={() => setOffset(o)}
            >
              {o}
            </button>
          ))}
        </div>

        {/* Price */}
        <div>
          <label class="text-xs text-[var(--text-muted)]">价格</label>
          <input
            type="number"
            class="mt-1 w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded px-2 py-1.5 text-sm text-[var(--text-primary)] font-mono tabular-nums focus:border-[var(--border-focus)] focus:outline-none"
            value={price()}
            onInput={(e) => setPrice(e.currentTarget.value)}
            placeholder={formatPrice(tick()?.last_price || 0)}
          />
        </div>

        {/* Volume */}
        <div>
          <label class="text-xs text-[var(--text-muted)]">数量</label>
          <input
            type="number"
            class="mt-1 w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded px-2 py-1.5 text-sm text-[var(--text-primary)] font-mono tabular-nums focus:border-[var(--border-focus)] focus:outline-none"
            value={volume()}
            onInput={(e) => setVolume(e.currentTarget.value)}
            placeholder="100"
          />
        </div>

        {/* Feedback */}
        <Show when={submitError()}>
          <div class="text-xs text-red-400 bg-red-500/10 rounded px-2 py-1">{submitError()}</div>
        </Show>
        <Show when={submitSuccess()}>
          <div class="text-xs text-green-400 bg-green-500/10 rounded px-2 py-1">{submitSuccess()}</div>
        </Show>

        {/* Submit */}
        <button
          class="w-full py-2 rounded bg-[var(--bg-active)] hover:bg-[var(--border-focus)] text-white text-sm font-bold transition-colors disabled:opacity-50"
          onClick={handleSubmit}
          disabled={submitting() || !selected()}
        >
          {submitting() ? '提交中...' : '委托下单'}
        </button>
        <button
          class="w-full py-1.5 rounded border border-[var(--border-color)] hover:border-red-500 text-[var(--text-muted)] hover:text-red-400 text-xs transition-colors"
          onClick={handleCancelAll}
        >
          全部撤单
        </button>

        {/* Active orders */}
        <Show when={activeOrders().length > 0}>
          <div class="mt-2 space-y-1">
            <div class="text-xs text-[var(--text-muted)]">活动订单</div>
            <For each={activeOrders()}>
              {(order) => (
                <div class="flex items-center justify-between text-xs bg-[var(--bg-tertiary)] rounded px-2 py-1">
                  <div class="flex flex-col">
                    <span class={order.direction === '多' ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}>
                      {order.direction}{order.offset}{order.volume}@{formatPrice(order.price)}
                    </span>
                    <span class="text-[var(--text-muted)] text-[10px]">{order.status}</span>
                  </div>
                  <button
                    class="text-red-400 hover:text-red-300 text-[10px]"
                    onClick={() => handleCancel(order)}
                  >
                    ✕
                  </button>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  );
};
