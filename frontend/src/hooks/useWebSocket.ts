/**
 * useWebSocket.ts — WebSocket Hook
 * 连接管理 / 断线重连 / 订阅/取消订阅
 */
import { createSignal, onCleanup } from 'solid-js';
import type { WsMessage, WsStatus } from '../types/ws';

type WsHandler = (msg: WsMessage) => void;

// Use env var or empty string (Vite dev server proxy handles /ws → backend)
const WS_URL = (import.meta.env.VITE_WS_URL as string | undefined) ?? '/ws';
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT = 10;
const PING_INTERVAL = 20000;

export function createWebSocket() {
  let ws: WebSocket | null = null;
  let reconnectCount = 0;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const [status, setStatus] = createSignal<WsStatus>('disconnected');
  const [error, setError] = createSignal<string | null>(null);

  // 全局消息处理器
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlers = new Map<WsMessage['type'] | '*', Set<WsHandler>>();

  function addHandler(type: WsMessage['type'], handler: WsHandler) {
    if (!handlers.has(type)) handlers.set(type, new Set());
    handlers.get(type)!.add(handler);
  }

  function removeHandler(type: WsMessage['type'], handler: WsHandler) {
    handlers.get(type)?.delete(handler);
  }

  function dispatch(msg: WsMessage) {
    const hs = handlers.get(msg.type);
    if (hs) hs.forEach((h) => h(msg));
  }

  function startPing() {
    stopPing();
    pingTimer = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() }));
      }
    }, PING_INTERVAL);
  }

  function stopPing() {
    if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
  }

  function connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

    setStatus('connecting');
    setError(null);

    try {
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        setStatus('connected');
        setError(null);
        reconnectCount = 0;
        startPing();
        // 发送订阅消息（之前订阅过的）
        pendingSubscriptions.forEach((req) => {
          ws!.send(JSON.stringify(req));
        });
      };

      ws.onmessage = (event) => {
        try {
          const msg: WsMessage = JSON.parse(event.data);
          if (msg.type === 'pong') return; // 忽略 pong
          dispatch(msg);
        } catch (e) {
          console.warn('[WS] parse error', e);
        }
      };

      ws.onerror = (e) => {
        console.warn('[WS] error', e);
        setError('连接错误');
      };

      ws.onclose = () => {
        setStatus('disconnected');
        stopPing();
        // 自动重连
        if (reconnectCount < MAX_RECONNECT) {
          reconnectCount++;
          setStatus('reconnecting');
          reconnectTimer = setTimeout(connect, RECONNECT_DELAY);
        } else {
          setError('重连次数超限，请刷新页面');
        }
      };
    } catch (e: unknown) {
      setError((e as Error)?.message || '创建 WebSocket 失败');
      setStatus('disconnected');
    }
  }

  function disconnect() {
    reconnectCount = MAX_RECONNECT; // 阻止重连
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    stopPing();
    ws?.close();
    ws = null;
    setStatus('disconnected');
  }

  function send(msg: object) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  // 订阅/取消订阅（离线时加入待发队列）
  const pendingSubscriptions = new Set<object>();

  function subscribe(req: { symbols?: string[]; exchanges?: string[] }) {
    const payload = {
      type: 'sub',
      channels: req.symbols?.map(_s => 'quote') ?? ['quote'],
      filters: {
        symbol: req.symbols,
        exchange: req.exchanges,
      },
      req_id: Date.now().toString(),
    };
    pendingSubscriptions.add(payload);
    send(payload);
  }

  function unsubscribe(req: { symbols?: string[]; exchanges?: string[] }) {
    const payload = {
      type: 'unsub',
      channels: req.symbols?.map(_s => 'quote') ?? ['quote'],
      filters: {
        symbol: req.symbols,
        exchange: req.exchanges,
      },
      req_id: Date.now().toString(),
    };
    pendingSubscriptions.delete(payload);
    send(payload);
  }

  onCleanup(() => {
    disconnect();
    handlers.clear();
  });

  return {
    status,
    error,
    connect,
    disconnect,
    send,
    subscribe,
    unsubscribe,
    addHandler,
    removeHandler,
  };
}

// ── Singleton 全局 WS 实例 ────────────────────────────────
let _instance: ReturnType<typeof createWebSocket> | null = null;

export function getWsInstance() {
  if (!_instance) _instance = createWebSocket();
  return _instance;
}

// ── 便捷 Hook: useMarketWS ────────────────────────────────
import { createEffect } from 'solid-js';
import { actions } from '../stores/index';
import type { TickData, OrderData, TradeData, PositionData, AccountData, LogData } from '../types/vnpy';

export function useMarketWS() {
  const ws = getWsInstance();

  // 自动连接
  createEffect(() => {
    if (ws.status() === 'disconnected') {
      ws.connect();
    }
  });

  // 同步 WS 状态到 store
  createEffect(() => {
    actions.connection.setWsStatus(ws.status());
  });

  // 注册所有数据处理器
  const tickHandler: WsHandler = (msg) => {
    if (msg.type === 'tick' && msg.data) {
      actions.market.upsertTick(msg.data as TickData);
    }
  };
  const orderHandler: WsHandler = (msg) => {
    if (msg.type === 'order' && msg.data) {
      actions.orders.upsertOrder(msg.data as OrderData);
    }
  };
  const tradeHandler: WsHandler = (msg) => {
    if (msg.type === 'trade' && msg.data) {
      actions.trades.prependTrade(msg.data as TradeData);
    }
  };
  const positionHandler: WsHandler = (msg) => {
    if (msg.type === 'position' && msg.data) {
      actions.positions.upsertPosition(msg.data as PositionData);
    }
  };
  const accountHandler: WsHandler = (msg) => {
    if (msg.type === 'account' && msg.data) {
      actions.accounts.upsertAccount(msg.data as AccountData);
    }
  };
  const logHandler: WsHandler = (msg) => {
    if (msg.type === 'log' && msg.data) {
      actions.logs.appendLog(msg.data as LogData);
    }
  };

  ws.addHandler('tick', tickHandler);
  ws.addHandler('order', orderHandler);
  ws.addHandler('trade', tradeHandler);
  ws.addHandler('position', positionHandler);
  ws.addHandler('account', accountHandler);
  ws.addHandler('log', logHandler);

  onCleanup(() => {
    ws.removeHandler('tick', tickHandler);
    ws.removeHandler('order', orderHandler);
    ws.removeHandler('trade', tradeHandler);
    ws.removeHandler('position', positionHandler);
    ws.removeHandler('account', accountHandler);
    ws.removeHandler('log', logHandler);
  });

  return ws;
}
