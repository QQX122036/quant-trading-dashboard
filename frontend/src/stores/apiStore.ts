/**
 * apiStore.ts — API 状态管理
 * 管理所有 REST API 数据状态，基于 SolidJS createStore
 * 与 stores/index.ts (AppState/WS) 解耦
 */
import { createStore } from 'solid-js/store';
import type { OrderData, TradeData, PositionData, AccountData, ContractData } from '../types/vnpy';
import type { GatewayInfo, SendOrderReq } from '../types/api';
import type { BacktestProgress, BacktestResult, BacktestRunReq, BacktestTasksResponse } from '../hooks/useApi';
import * as api from '../hooks/useApi';
import { state as wsState, actions as wsActions } from './index';

// ── Types ────────────────────────────────────────────────────

export interface ApiState {
  gateways: GatewayInfo[];
  gatewayLoading: boolean;
  gatewayError: string | null;

  orders: OrderData[];
  ordersLoading: boolean;
  ordersError: string | null;

  trades: TradeData[];
  tradesLoading: boolean;
  tradesError: string | null;

  positions: PositionData[];
  positionsLoading: boolean;
  positionsError: string | null;

  accounts: AccountData[];
  accountsLoading: boolean;
  accountsError: string | null;

  contracts: ContractData[];
  contractsLoading: boolean;
  contractsError: string | null;

  backtestRunning: boolean;
  backtestProgress: BacktestProgress | null;
  backtestResult: BacktestResult | null;
  backtestError: string | null;
  backtestTasks: BacktestTasksResponse['tasks'];
  backtestTaskId: string | null;

  health: api.HealthInfo | null;
  healthLoading: boolean;
  healthError: string | null;
}

const [apiState, setApiState] = createStore<ApiState>({
  gateways: [],
  gatewayLoading: false,
  gatewayError: null,

  orders: [],
  ordersLoading: false,
  ordersError: null,

  trades: [],
  tradesLoading: false,
  tradesError: null,

  positions: [],
  positionsLoading: false,
  positionsError: null,

  accounts: [],
  accountsLoading: false,
  accountsError: null,

  contracts: [],
  contractsLoading: false,
  contractsError: null,

  backtestRunning: false,
  backtestProgress: null,
  backtestResult: null,
  backtestError: null,
  backtestTasks: [],
  backtestTaskId: null,

  health: null,
  healthLoading: false,
  healthError: null,
});

export { apiState };
export { setApiState };

// ── Helpers ─────────────────────────────────────────────────

function getErrorMsg(e: unknown): string {
  if (e && typeof e === 'object') {
    const err = e as Record<string, unknown>;
    if (err.error && typeof err.error === 'object') {
      return ((err.error as Record<string, unknown>).msg as string) || String(e);
    }
    return (err.message as string) || String(e);
  }
  return String(e);
}

// ── Actions ─────────────────────────────────────────────────

export const apiActions = {
  async fetchHealth() {
    setApiState('healthLoading', true);
    setApiState('healthError', null);
    try {
      const res = await api.fetchHealth();
      if (res.code === '0' && res.data) setApiState('health', res.data);
      else setApiState('healthError', res.message || '获取健康状态失败');
    } catch (e: unknown) {
      setApiState('healthError', getErrorMsg(e));
    } finally {
      setApiState('healthLoading', false);
    }
  },

  async fetchGateways() {
    setApiState('gatewayLoading', true);
    setApiState('gatewayError', null);
    try {
      const res = await api.fetchGateways();
      if (res.code === '0' && res.data) setApiState('gateways', res.data.gateways);
      else setApiState('gatewayError', res.message || '获取网关列表失败');
    } catch (e: unknown) {
      setApiState('gatewayError', getErrorMsg(e));
    } finally {
      setApiState('gatewayLoading', false);
    }
  },

  async connectGateway(gatewayName: string, setting: Record<string, string>) {
    return api.connectGateway(gatewayName, setting);
  },

  async disconnectGateway(gatewayName: string) {
    return api.disconnectGateway(gatewayName);
  },

  async fetchOrders(gateway?: string) {
    setApiState('ordersLoading', true);
    setApiState('ordersError', null);
    try {
      const res = await api.fetchOrders(gateway);
      if (res.code === '0' && res.data) {
        const d = res.data as unknown as { success: boolean; total: number; orders: OrderData[] };
        const orders = d.orders || [];
        setApiState('orders', orders);
        // Sync into WS store so both WS updates and REST initial load use the same source
        for (const order of orders) {
          wsActions.orders.upsertOrder(order);
        }
      } else {
        setApiState('ordersError', res.message || '获取订单失败');
      }
    } catch (e: unknown) {
      setApiState('ordersError', getErrorMsg(e));
    } finally {
      setApiState('ordersLoading', false);
    }
  },

  async cancelOrder(vt_orderid: string, symbol: string, exchange: string) {
    const res = await api.cancelOrder(vt_orderid, symbol, exchange);
    if (res.code === '0') setTimeout(() => apiActions.fetchOrders(), 200);
    return res;
  },

  async submitOrder(req: SendOrderReq) {
    const res = await api.submitOrder(req);
    if (res.code === '0') setTimeout(() => apiActions.fetchOrders(req.gateway), 200);
    return res;
  },

  async fetchTrades(gateway?: string) {
    setApiState('tradesLoading', true);
    setApiState('tradesError', null);
    try {
      const res = await api.fetchTrades(gateway);
      if (res.code === '0' && res.data) {
        const d = res.data as unknown as { success: boolean; total: number; trades: TradeData[] };
        const trades = d.trades || [];
        setApiState('trades', trades);
        // Sync into WS store: replace trades list with fresh REST data
        wsState.trades.items = trades;
      } else {
        setApiState('tradesError', res.message || '获取成交失败');
      }
    } catch (e: unknown) {
      setApiState('tradesError', getErrorMsg(e));
    } finally {
      setApiState('tradesLoading', false);
    }
  },

  async fetchPositions(gateway?: string) {
    setApiState('positionsLoading', true);
    setApiState('positionsError', null);
    try {
      const res = await api.fetchPositions(gateway);
      if (res.code === '0' && res.data) setApiState('positions', res.data.positions || []);
      else setApiState('positionsError', res.message || '获取持仓失败');
    } catch (e: unknown) {
      setApiState('positionsError', getErrorMsg(e));
    } finally {
      setApiState('positionsLoading', false);
    }
  },

  async fetchAccounts(gateway?: string) {
    setApiState('accountsLoading', true);
    setApiState('accountsError', null);
    try {
      const res = await api.fetchAccounts(gateway);
      if (res.code === '0' && res.data) {
        const d = res.data as unknown as { accounts: AccountData[] };
        setApiState('accounts', d.accounts || []);
      } else {
        setApiState('accountsError', res.message || '获取账户失败');
      }
    } catch (e: unknown) {
      setApiState('accountsError', getErrorMsg(e));
    } finally {
      setApiState('accountsLoading', false);
    }
  },

  async fetchContracts(keyword?: string) {
    setApiState('contractsLoading', true);
    setApiState('contractsError', null);
    try {
      const res = await api.fetchContracts(keyword);
      if (res.code === '0' && res.data) {
        const d = res.data as unknown as { success: boolean; total: number; contracts: ContractData[] };
        setApiState('contracts', d.contracts || []);
      } else {
        setApiState('contractsError', res.message || '获取合约失败');
      }
    } catch (e: unknown) {
      setApiState('contractsError', getErrorMsg(e));
    } finally {
      setApiState('contractsLoading', false);
    }
  },

  async fetchBacktestTasks() {
    try {
      const res = await api.fetchBacktestTasks();
      setApiState('backtestTasks', res.data?.tasks || []);
    } catch (e: unknown) {
      // silent fail for task list
    }
  },

  async runBacktest(req: BacktestRunReq): Promise<string | null> {
    setApiState('backtestRunning', true);
    setApiState('backtestError', null);
    setApiState('backtestProgress', null);
    setApiState('backtestResult', null);
    try {
      const res = await api.runBacktest(req);
      const taskId = res.data?.task_id;
      setApiState('backtestTaskId', taskId ?? null);

      const poll = async () => {
        try {
          const progRes = await api.getBacktestProgress(taskId ?? '');
          if (!progRes.data) {
            setApiState('backtestRunning', false);
            return;
          }
          const prog = progRes.data;
          setApiState('backtestProgress', prog);
          if (prog.status === 'pending' || prog.status === 'running') {
            setTimeout(poll, 1000);
          } else if (prog.status === 'completed') {
            const resultRes = await api.getBacktestResult(taskId ?? '');
            if (resultRes.data) setApiState('backtestResult', resultRes.data);
            setApiState('backtestRunning', false);
          } else {
            setApiState('backtestError', prog.message || '回测失败');
            setApiState('backtestRunning', false);
          }
        } catch (e: unknown) {
          setApiState('backtestError', getErrorMsg(e));
          setApiState('backtestRunning', false);
        }
      };
      setTimeout(poll, 500);
      return taskId ?? null;
    } catch (e: unknown) {
      setApiState('backtestError', getErrorMsg(e));
      setApiState('backtestRunning', false);
      return null;
    }
  },

  async refreshAll(gateway?: string) {
    await Promise.allSettled([
      apiActions.fetchHealth(),
      apiActions.fetchGateways(),
      apiActions.fetchOrders(gateway),
      apiActions.fetchTrades(gateway),
      apiActions.fetchPositions(gateway),
      apiActions.fetchAccounts(gateway),
    ]);
  },
};
