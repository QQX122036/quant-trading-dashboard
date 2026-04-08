import { createStore } from 'solid-js/store';
import type {
  TickData,
  OrderData,
  TradeData,
  PositionData,
  AccountData,
  LogData,
  ContractData,
} from '../types/vnpy';

// ── AppState ────────────────────────────────────────────────

interface GatewayStatus {
  name: string;
  displayName: string;
  connected: boolean;
}

export interface AppState {
  connection: {
    gateways: Record<string, GatewayStatus>;
    wsStatus: 'connected' | 'disconnected' | 'reconnecting';
  };
  market: {
    ticks: Record<string, TickData>;
  };
  orders: {
    all: Record<string, OrderData>;
  };
  trades: {
    items: TradeData[];
    maxItems: number;
  };
  positions: {
    items: Record<string, PositionData>;
  };
  accounts: {
    items: Record<string, AccountData>;
  };
  logs: {
    items: LogData[];
    maxItems: number;
  };
  contracts: {
    items: Record<string, ContractData>;
  };
  ui: {
    selectedVtSymbol: string;
    activeRightTab: string;
    activeBottomTab: string;
    showConnectDialog: boolean;
    showGlobalDialog: boolean;
    showContractManager: boolean;
    showAboutDialog: boolean;
  };
}

const [state, setState] = createStore<AppState>({
  connection: {
    gateways: {},
    wsStatus: 'disconnected',
  },
  market: {
    ticks: {},
  },
  orders: {
    all: {},
  },
  trades: {
    items: [],
    maxItems: 1000,
  },
  positions: {
    items: {},
  },
  accounts: {
    items: {},
  },
  logs: {
    items: [],
    maxItems: 500,
  },
  contracts: {
    items: {},
  },
  ui: {
    selectedVtSymbol: '',
    activeRightTab: 'tick',
    activeBottomTab: 'position',
    showConnectDialog: false,
    showGlobalDialog: false,
    showContractManager: false,
    showAboutDialog: false,
  },
});

export { state };

// ── Actions ────────────────────────────────────────────────

export const actions = {
  connection: {
    setGatewayStatus(name: string, status: Partial<GatewayStatus>) {
      setState('connection', 'gateways', name, (prev) => ({ ...prev, ...status }));
    },
    setWsStatus(wsStatus: AppState['connection']['wsStatus']) {
      setState('connection', 'wsStatus', wsStatus);
    },
  },
  market: {
    upsertTick(tick: TickData) {
      setState('market', 'ticks', tick.symbol, tick);
    },
    removeTick(symbol: string) {
      setState('market', 'ticks', symbol, undefined as unknown as TickData);
    },
  },
  orders: {
    upsertOrder(order: OrderData) {
      setState('orders', 'all', order.vt_orderid, order);
    },
  },
  trades: {
    prependTrade(trade: TradeData) {
      setState('trades', 'items', (prev) => [trade, ...prev].slice(0, state.trades.maxItems));
    },
  },
  positions: {
    upsertPosition(pos: PositionData) {
      setState('positions', 'items', pos.vt_positionid, pos);
    },
  },
  accounts: {
    upsertAccount(acc: AccountData) {
      setState('accounts', 'items', acc.vt_accountid, acc);
    },
  },
  logs: {
    appendLog(log: LogData) {
      setState('logs', 'items', (prev) => [...prev, log].slice(-state.logs.maxItems));
    },
  },
  contracts: {
    upsertContract(contract: ContractData) {
      setState('contracts', 'items', contract.vt_symbol, contract);
    },
  },
  ui: {
    setSelectedSymbol(vt_symbol: string) {
      setState('ui', 'selectedVtSymbol', vt_symbol);
    },
    setActiveRightTab(tabId: string) {
      setState('ui', 'activeRightTab', tabId);
    },
    setActiveBottomTab(tabId: string) {
      setState('ui', 'activeBottomTab', tabId);
    },
    toggleDialog(dialog: 'connect' | 'global' | 'contract' | 'about') {
      const key =
        `show${dialog.charAt(0).toUpperCase() + dialog.slice(1)}Dialog` as keyof AppState['ui'];
      setState('ui', key, (v) => !v);
    },
  },
};
