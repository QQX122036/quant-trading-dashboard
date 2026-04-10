/**
 * useLoading.ts — 追踪所有挂起请求的 Loading hook
 * 用于组件中判断全局请求状态
 */
import { createMemo } from 'solid-js';
import { loadingState, loadingActions } from '../stores/loadingStore';

/**
 * 获取全局 pending 请求数
 */
export function usePendingCount(): () => number {
  return () => loadingState.pendingCount;
}

/**
 * 是否任意请求正在加载
 */
export function useIsLoading(): () => boolean {
  return () => loadingState.pendingCount > 0;
}

/**
 * 特定模块是否正在加载
 */
export function useModuleLoading(module: string): () => boolean {
  return () => loadingState.modules[module] ?? false;
}

/**
 * 是否有请求正在重试
 */
export function useRetrying(): () => boolean {
  return () => loadingState.retrying.size > 0;
}

/**
 * 获取当前重试中的 key 列表
 */
export function useRetryingKeys(): () => string[] {
  return () => Array.from(loadingState.retrying);
}

/**
 * 便捷 hook：获取 DashboardHome 相关模块的 loading 状态
 */
export function useDashboardLoading() {
  const indices = useModuleLoading('indices');
  const positions = useModuleLoading('positions');
  const accounts = useModuleLoading('accounts');
  const isAnyLoading = useIsLoading();

  return createMemo(() => ({
    indices: indices(),
    positions: positions(),
    accounts: accounts(),
    isAnyLoading: isAnyLoading(),
  }));
}

/**
 * 带 start/end 控制的请求包装器
 * 自动追踪 loading 状态 + 暴露 retry 信息
 */
export async function withLoading<T>(
  module: string,
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  loadingActions.start(module, key);
  try {
    const result = await fn();
    loadingActions.end(module);
    return result;
  } catch (e: unknown) {
    loadingActions.fail(module, key);
    throw e;
  }
}

/**
 * 带重试回调的 loading 包装器
 */
export async function withLoadingAndRetry<_T>(
  module: string,
  key: string,
  _onRetry?: (attempt: number, delay: number) => void
): Promise<{
  act: <T2>(fn: () => Promise<T2>) => Promise<T2>;
}> {
  return {
    act: async <T2>(fn: () => Promise<T2>) => {
      loadingActions.start(module, key);
      let _attempt = 0;
      try {
        const result = await fn();
        loadingActions.end(module);
        return result;
      } catch (e: unknown) {
        loadingActions.fail(module, key);
        throw e;
      }
    },
  };
}
