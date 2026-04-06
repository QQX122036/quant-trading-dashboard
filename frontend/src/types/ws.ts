// ── WebSocket message types ────────────────────────────────

export type WsMessageType =
  | 'tick'
  | 'tick_bar'
  | 'order'
  | 'trade'
  | 'position'
  | 'account'
  | 'log'
  | 'contract'
  | 'timer'
  | 'error'
  | 'subscribe'
  | 'unsubscribe'
  | 'pong';

export interface WsMessage {
  type: WsMessageType;
  timestamp: string;
  data?: unknown;
  code?: string;
  message?: string;
}

export interface WsTickMessage extends WsMessage {
  type: 'tick';
  data: import('./vnpy').TickData;
}

export interface WsOrderMessage extends WsMessage {
  type: 'order';
  data: import('./vnpy').OrderData;
}

export interface WsTradeMessage extends WsMessage {
  type: 'trade';
  data: import('./vnpy').TradeData;
}

export type WsStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
