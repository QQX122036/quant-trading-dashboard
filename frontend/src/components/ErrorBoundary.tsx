import { Component, JSX, Show, createUniqueId } from 'solid-js';
import { ErrorBoundary as SolidErrorBoundary } from 'solid-js';
import { getErrorTracker } from '../stores/errorStore';

interface ErrorFallbackProps {
  error: Error;
  onReset: () => void;
}

const ErrorFallback: Component<ErrorFallbackProps> = (props) => {
  return (
    <div class="flex flex-col items-center justify-center h-full gap-4 p-8">
      <div class="flex flex-col items-center gap-3 text-center max-w-md">
        {/* Error Icon */}
        <div class="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
          <svg class="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Error Title */}
        <div>
          <h3 class="text-lg font-semibold text-red-400">组件加载失败</h3>
          <p class="text-sm text-gray-500 mt-1">发生了意外错误，请尝试重置</p>
        </div>

        {/* Error Message (dev only) */}
        <Show when={import.meta.env.DEV}>
          <pre class="text-xs text-gray-600 bg-black/30 rounded p-2 w-full overflow-auto text-left">
            {props.error?.message || String(props.error)}
          </pre>
        </Show>

        {/* Reset Button */}
        <button
          onClick={props.onReset}
          class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          重试
        </button>
      </div>
    </div>
  );
};

interface ErrorBoundaryProps {
  children: JSX.Element;
  onError?: (error: Error, info: string) => void;
  /** 用于标识此边界的位置（如路由路径） */
  label?: string;
}

export const ErrorBoundary: Component<ErrorBoundaryProps> = (props) => {
  const boundaryId = createUniqueId();
  const tracker = getErrorTracker();

  return (
    <SolidErrorBoundary
      fallback={(error, reset) => {
        // 上报到错误追踪系统
        tracker.trackComponentError(error as Error, '', props.label ?? boundaryId);
        // 回调给父组件
        props.onError?.(error as Error, '');
        return <ErrorFallback error={error as Error} onReset={reset} />;
      }}
    >
      {props.children}
    </SolidErrorBoundary>
  );
};
