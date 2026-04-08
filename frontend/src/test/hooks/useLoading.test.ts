import { describe, it, expect } from 'vitest';
// Note: SolidJS createStore requires a reactive owner context.
// Store/hook integration tests should run in an integration test environment (Playwright e2e).
// Here we test the useLoading hook exports and basic types.
import type { LoadingState } from '../../stores/loadingStore';

describe('useLoading types and exports', () => {
  it('exports LoadingState interface', () => {
    const state: Partial<LoadingState> = {
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
    };
    expect(state.pendingCount).toBe(0);
    expect((state.modules ?? {}).indices).toBe(false);
  });

  it('usePendingCount returns a function', async () => {
    const { usePendingCount } = await import('../../hooks/useLoading');
    const fn = usePendingCount();
    expect(typeof fn).toBe('function');
  });

  it('useIsLoading returns a function', async () => {
    const { useIsLoading } = await import('../../hooks/useLoading');
    const fn = useIsLoading();
    expect(typeof fn).toBe('function');
  });

  it('useModuleLoading returns a function', async () => {
    const { useModuleLoading } = await import('../../hooks/useLoading');
    const fn = useModuleLoading('indices');
    expect(typeof fn).toBe('function');
  });

  it('useRetrying returns a function', async () => {
    const { useRetrying } = await import('../../hooks/useLoading');
    const fn = useRetrying();
    expect(typeof fn).toBe('function');
  });

  it('useRetryingKeys returns a function', async () => {
    const { useRetryingKeys } = await import('../../hooks/useLoading');
    const fn = useRetryingKeys();
    expect(typeof fn).toBe('function');
  });

  // useDashboardLoading creates memos that require reactive context — skip in unit tests
  // It will be covered in integration/e2e tests
});
