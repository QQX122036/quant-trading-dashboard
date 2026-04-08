/**
 * loadingStore.ts — 全局请求 Loading 状态追踪
 * 追踪所有挂起请求的 loading 状态
 *
 * Uses lazy initialization to avoid SolidJS reactive owner context issues in tests.
 */
import { createStore } from 'solid-js/store';

export interface LoadingState {
  pendingCount: number;
  modules: {
    indices: boolean;
    positions: boolean;
    accounts: boolean;
    orders: boolean;
    trades: boolean;
    marketOverview: boolean;
    kline: boolean;
    strategies: boolean;
    backtest: boolean;
    [key: string]: boolean;
  };
  retrying: Set<string>;
  lastUpdate: string | null;
}

type StoreInit = {
  state: LoadingState;
  setState: any;
};

let _init: StoreInit | null = null;

function getStore(): StoreInit {
  if (!_init) {
    // Defer createStore to first access (not module load time)
    // This avoids reactive owner context issues in test environments
    const [state, setState] = createStore<LoadingState>({
      pendingCount: 0,
      modules: {
        indices: false,
        positions: false,
        accounts: false,
        orders: false,
        trades: false,
        marketOverview: false,
        kline: false,
        strategies: false,
        backtest: false,
      },
      retrying: new Set<string>(),
      lastUpdate: null,
    });
    _init = { state, setState };
  }
  return _init;
}

export const loadingState: LoadingState = new Proxy({} as LoadingState, {
  get(_target, prop) {
    const store = getStore();
    return store.state[prop as keyof LoadingState];
  },
});

export const loadingActions = {
  start(module: string, key?: string) {
    const store = getStore();
    store.setState('pendingCount', (n: number) => n + 1);
    if (module) store.setState('modules', module, true);
    if (key) {
      store.setState('retrying', (s: Set<string>) => {
        const next = new Set(s);
        next.delete(key);
        return next;
      });
    }
  },

  end(module: string) {
    const store = getStore();
    store.setState('pendingCount', (n: number) => Math.max(0, n - 1));
    if (module) store.setState('modules', module, false);
    store.setState('lastUpdate', new Date().toLocaleTimeString('zh-CN'));
  },

  retryStart(key: string) {
    const store = getStore();
    store.setState('retrying', (s: Set<string>) => {
      const next = new Set(s);
      next.add(key);
      return next;
    });
  },

  fail(module: string, key?: string) {
    this.end(module);
    if (key) {
      const store = getStore();
      store.setState('retrying', (s: Set<string>) => {
        const next = new Set(s);
        next.delete(key);
        return next;
      });
    }
  },

  reset() {
    const store = getStore();
    store.setState({
      pendingCount: 0,
      modules: {
        indices: false,
        positions: false,
        accounts: false,
        orders: false,
        trades: false,
        marketOverview: false,
        kline: false,
        strategies: false,
        backtest: false,
      },
      retrying: new Set<string>(),
      lastUpdate: new Date().toLocaleTimeString('zh-CN'),
    });
  },
};
