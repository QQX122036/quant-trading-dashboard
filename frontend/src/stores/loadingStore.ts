/**
 * loadingStore.ts — 全局请求 Loading 状态追踪
 * 追踪所有挂起请求的 loading 状态
 */
import { createStore } from 'solid-js/store';

export interface LoadingState {
  // 挂起请求数量（按 key 分类）
  pendingCount: number;
  // 各模块的 loading 状态
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
  // 当前正在重试的请求
  retrying: Set<string>;
  // 最后更新时间
  lastUpdate: string | null;
}

const [loadingState, setLoadingState] = createStore<LoadingState>({
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
  retrying: new Set(),
  lastUpdate: null,
});

export { loadingState };

// ── Loading Actions ───────────────────────────────────────

export const loadingActions = {
  /** 开始一个请求（增加计数 + 标记模块） */
  start(module: string, key?: string) {
    setLoadingState('pendingCount', (n) => n + 1);
    if (module) {
      setLoadingState('modules', module, true);
    }
    if (key) {
      setLoadingState('retrying', (s) => {
        const next = new Set(s);
        next.delete(key);
        return next;
      });
    }
  },

  /** 结束一个请求（减少计数 + 取消模块标记） */
  end(module: string) {
    setLoadingState('pendingCount', (n) => Math.max(0, n - 1));
    if (module) {
      setLoadingState('modules', module, false);
    }
    setLoadingState('lastUpdate', new Date().toLocaleTimeString('zh-CN'));
  },

  /** 请求失败，开始重试 */
  retryStart(key: string) {
    setLoadingState('retrying', (s) => {
      const next = new Set(s);
      next.add(key);
      return next;
    });
  },

  /** 请求最终失败 */
  fail(module: string, key?: string) {
    this.end(module);
    if (key) {
      setLoadingState('retrying', (s) => {
        const next = new Set(s);
        next.delete(key);
        return next;
      });
    }
  },

  /** 重置所有状态 */
  reset() {
    setLoadingState({
      pendingCount: 0,
      modules: Object.fromEntries(Object.keys(loadingState.modules).map((k) => [k, false])),
      retrying: new Set(),
      lastUpdate: new Date().toLocaleTimeString('zh-CN'),
    });
  },
};
