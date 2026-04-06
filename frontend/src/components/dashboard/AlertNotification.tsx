/**
 * AlertNotification.tsx — 消息通知中心
 * - 预警信号列表（红色价格预警/橙色量能预警）
 * - 委托成交推送（WS 实时）
 * - 系统通知（连接状态/错误提示）
 * - AlertMonitor 组件集成
 */
import { Component, createSignal, createMemo, For, onMount, onCleanup } from 'solid-js';
import { state, actions } from '../../stores';
import { getWsInstance } from '../../hooks/useWebSocket';
import type { WsMessage } from '../../types/ws';
import type { OrderData, TradeData, LogData } from '../../types/vnpy';

type NotifType = 'price_alert' | 'volume_alert' | 'trade' | 'order' | 'system';

interface Notification {
  id: string;
  type: NotifType;
  message: string;
  detail?: string;
  timestamp: string;
  level: 'red' | 'orange' | 'green' | 'blue' | 'gray';
}

export const AlertNotification: Component = () => {
  const [notifications, setNotifications] = createSignal<Notification[]>([]);
  const [activeTab, setActiveTab] = createSignal<NotifType | 'all'>('all');
  const ws = getWsInstance();

  function addNotif(type: NotifType, message: string, detail?: string, level: Notification['level'] = 'blue') {
    const notif: Notification = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type, message, detail,
      timestamp: new Date().toLocaleTimeString('zh-CN'),
      level,
    };
    setNotifications(prev => [notif, ...prev].slice(0, 100));
  }

  // 系统通知处理
  const systemHandler = (msg: WsMessage) => {
    if (msg.type === 'error') {
      addNotif('system', `错误: ${msg.message || 'Unknown'}`, undefined, 'red');
    }
  };

  // 成交推送
  const tradeHandler = (msg: WsMessage) => {
    if (msg.type === 'trade' && msg.data) {
      const t = msg.data as TradeData;
      const isBuy = t.direction === '多' || t.direction === 'long';
      addNotif(
        'trade',
        `成交 ${isBuy ? '买入' : '卖出'} ${t.symbol} × ${t.volume}`,
        `价格: ${t.price} | 时间: ${t.datetime}`,
        isBuy ? 'green' : 'red',
      );
    }
  };

  // 订单更新
  const orderHandler = (msg: WsMessage) => {
    if (msg.type === 'order' && msg.data) {
      const o = msg.data as OrderData;
      if (o.status === '全部成交') {
        addNotif('order', `订单成交 ${o.symbol}`, `状态: ${o.status}`, 'green');
      } else if (o.status === '拒单') {
        addNotif('order', `订单拒单 ${o.symbol}`, `原因: ${o.status}`, 'red');
      }
    }
  };

  // 日志处理
  const logHandler = (msg: WsMessage) => {
    if (msg.type === 'log' && msg.data) {
      const l = msg.data as LogData;
      if (l.level === 'ERROR') {
        addNotif('system', `[ERROR] ${l.msg}`, l.gateway_name, 'red');
      } else if (l.level === 'WARNING') {
        addNotif('system', `[WARNING] ${l.msg}`, l.gateway_name, 'orange');
      }
    }
  };

  // 价格预警模拟（根据 tick 变化检测）
  const tickHandler = (msg: WsMessage) => {
    if (msg.type === 'tick' && msg.data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = msg.data as any;
      const sym = d.symbol as string;
      const price = d.last_price as number;
      // 简单的预警阈值检测（示例）
      if (sym === '600519.SH' && price > 2000) {
        addNotif('price_alert', `贵州茅台价格预警`, `现价: ${price.toFixed(2)}`, 'red');
      }
    }
  };

  onMount(() => {
    // 监听 WS 状态变化
    const statusHandler = () => {
      const s = ws.status();
      if (s === 'connected') addNotif('system', 'WebSocket 已连接', undefined, 'green');
      else if (s === 'disconnected') addNotif('system', 'WebSocket 连接断开', undefined, 'orange');
    };

    ws.addHandler('error', systemHandler);
    ws.addHandler('trade', tradeHandler);
    ws.addHandler('order', orderHandler);
    ws.addHandler('log', logHandler);
    ws.addHandler('tick', tickHandler);

    // 初始系统通知
    addNotif('system', '通知中心已就绪', `WS状态: ${ws.status()}`, 'blue');
  });

  onCleanup(() => {
    ws.removeHandler('error', systemHandler);
    ws.removeHandler('trade', tradeHandler);
    ws.removeHandler('order', orderHandler);
    ws.removeHandler('log', logHandler);
    ws.removeHandler('tick', tickHandler);
  });

  const filtered = createMemo(() => {
    const tab = activeTab();
    const all = notifications();
    if (tab === 'all') return all;
    return all.filter(n => n.type === tab);
  });

  const tabs: Array<{ key: NotifType | 'all'; label: string; color: string }> = [
    { key: 'all', label: '全部', color: 'text-gray-300' },
    { key: 'price_alert', label: '⚠价格', color: 'text-red-400' },
    { key: 'volume_alert', label: '📊量能', color: 'text-orange-400' },
    { key: 'trade', label: '📋成交', color: 'text-green-400' },
    { key: 'order', label: '📝委托', color: 'text-blue-400' },
    { key: 'system', label: '🔔系统', color: 'text-gray-400' },
  ];

  const levelColors: Record<Notification['level'], string> = {
    red: 'border-l-red-500 bg-red-950/20',
    orange: 'border-l-orange-500 bg-orange-950/20',
    green: 'border-l-green-500 bg-green-950/20',
    blue: 'border-l-blue-500 bg-blue-950/20',
    gray: 'border-l-gray-500 bg-gray-900/20',
  };

  return (
    <div class="h-full flex flex-col bg-[#111827]/80">
      {/* Tabs */}
      <div class="flex items-center px-3 py-1.5 border-b border-white/10 gap-1 overflow-x-auto flex-shrink-0">
        <For each={tabs}>
          {(tab) => (
            <button
              class="px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap transition-colors"
              classList={{
                [tab.color]: true,
                'bg-white/10': activeTab() === tab.key,
                'hover:bg-white/5': activeTab() !== tab.key,
              }}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          )}
        </For>
      </div>

      {/* Notification list */}
      <div class="flex-1 overflow-auto">
        <For each={filtered()} fallback={
          <div class="flex items-center justify-center h-full text-xs text-gray-600">暂无通知</div>
        }>
          {(notif) => (
            <div class={`flex items-start gap-2 px-3 py-1.5 border-b border-white/5 border-l-2 ${levelColors[notif.level]}`}>
              <div class="flex-1 min-w-0">
                <div class="text-[11px] text-gray-200 truncate">{notif.message}</div>
                {notif.detail && <div class="text-[10px] text-gray-500 truncate">{notif.detail}</div>}
              </div>
              <div class="text-[9px] text-gray-600 whitespace-nowrap flex-shrink-0 mt-0.5">{notif.timestamp}</div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};
