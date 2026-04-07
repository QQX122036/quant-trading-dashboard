/**
 * useApiResource.ts — 统一异步数据获取 Hook
 *
 * 封装 apiFetch，自动管理 loading/error/retry 状态，
 * 兼容现有 loadingStore 全局追踪 + 组件内局部状态。
 *
 * @example
 * // 之前（每个组件都要写一堆信号）
 * const [loading, setLoading] = createSignal(false);
 * const [error, setError] = createSignal<string | null>(null);
 * const [data, setData] = createSignal<T | null>(null);
 * onMount(async () => {
 *   setLoading(true);
 *   try { setData(await apiFetch(...)); }
 *   catch (e) { setError(String(e)); }
 *   finally { setLoading(false); }
 * });
 *
 * // 之后（一行调用）
 * const resource = createApiResource(() => props.tsCode(), (code) =>
 *   apiFetch<KLineData[]>(`/api/data/kline?ts_code=${code}`)
 * );
 */
import { createSignal, onCleanup } from 'solid-js';
import { apiFetch, type ApiResponse } from './useApi';
import { loadingActions } from '../stores/loadingStore';

export interface RetryState {
  active: boolean;
  attempt: number;
  delay: number;
}

export interface ApiResource<T> {
  /** 当前数据（未加载前为 undefined） */
  data: () => T | undefined;
  /** 是否正在加载（首次或刷新） */
  loading: () => boolean;
  /** 是否有错误 */
  error: () => Error | null;
  /** 是否有数据（哪怕是空数组也算有） */
  ready: () => boolean;
  /** 重试状态 */
  retry: () => RetryState;
  /** 触发重新加载 */
  mutate: () => void;
}

/**
 * 创建统一的 API 资源 hook
 * @param source 响应式数据源（变化时自动重新获取）
 * @param fetcher 基于 source 计算 path 并获取数据的函数
 * @param module  全局 loadingStore 的模块名（可选）
 */
export function createApiResource<T>(
  source: () => unknown,
  fetcher: (src: unknown) => Promise<ApiResponse<T>>,
  module?: string
): ApiResource<T> {
  const [data, setData] = createSignal<T | undefined>(undefined);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<Error | null>(null);
  const [retryState, setRetryState] = createSignal<RetryState>({ active: false, attempt: 0, delay: 0 });

  let abortController: AbortController | null = null;

  const load = async () => {
    // abort 旧请求
    abortController?.abort();
    abortController = new AbortController();

    setLoading(true);
    setError(null);
    if (module) loadingActions.start(module);

    try {
      const result = await fetcher(source());
      if (!abortController.signal.aborted) {
        if (result.code === 0 || result.code === '0') {
          setData(result.data as T);
        } else {
          setError(new Error(result.message ?? `API error: ${result.code}`));
        }
      }
    } catch (e: unknown) {
      if (!abortController.signal.aborted) {
        setError(e instanceof Error ? e : new Error(String(e)));
      }
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false);
        if (module) loadingActions.end(module);
      }
    }
  };

  // 首次加载
  load();

  // 响应式重新加载（source 变化时）
  // 用 createEffect 监听 source 变化
  let prevSource = source();
  const checkSource = () => {
    const current = source();
    if (current !== prevSource) {
      prevSource = current;
      load();
    }
  };
  // 每秒检查一次 source 变化（简单实现，避免深度比较开销）
  const interval = setInterval(checkSource, 1000);

  onCleanup(() => {
    clearInterval(interval);
    abortController?.abort();
    if (module && loading()) loadingActions.fail(module);
  });

  return {
    data,
    loading,
    error,
    ready: () => data() !== undefined && !loading() && !error(),
    retry: retryState,
    mutate: load,
  };
}

/**
 * 手动控制的 API 资源（不监听 source 变化）
 * 适合搜索、分页等需要主动触发加载的场景
 */
export function createManualResource<T>(
  fetchFn: () => Promise<ApiResponse<T>>,
  module?: string
): ApiResource<T> & { execute: () => Promise<void> } {
  const [data, setData] = createSignal<T | undefined>(undefined);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<Error | null>(null);
  const [retryState, setRetryState] = createSignal<RetryState>({ active: false, attempt: 0, delay: 0 });

  const execute = async () => {
    setLoading(true);
    setError(null);
    if (module) loadingActions.start(module);

    try {
      const result = await fetchFn();
      if (result.code === 0 || result.code === '0') {
        setData(result.data as T);
      } else {
        setError(new Error(result.message ?? `API error: ${result.code}`));
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
      if (module) loadingActions.end(module);
    }
  };

  return {
    data,
    loading,
    error,
    ready: () => data() !== undefined && !loading() && !error(),
    retry: retryState,
    mutate: execute,
    execute,
  };
}
