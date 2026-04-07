import { Component, JSX, createSignal, Show } from 'solid-js';

interface ErrorInfo {
  componentStack?: string;
}

interface Props {
  children: JSX.Element;
  /** 自定义 fallback，接收 error 和 reset 函数 */
  fallback?: (error: Error, reset: () => void) => JSX.Element;
  /** 是否向上传播错误（让外层 ErrorBoundary 也捕获） */
  propagate?: boolean;
}

/**
 * ErrorBoundary - React 风格错误边界（SolidJS 实现）
 *
 * 捕获子组件树的 JavaScript 错误，显示错误 UI 并允许恢复。
 *
 * 注意：不捕获以下类型的错误：
 * - React/Solid 事件处理器内的错误（onClick 等）
 * - 异步代码内的错误（setTimeout、Promise.then 等）
 * - 服务端渲染（SSR）期间的错误
 * - 自身抛出的错误
 */
export const ErrorBoundary: Component<Props> = (props) => {
  const [error, setError] = createSignal<Error | null>(null);
  const [info, setInfo] = createSignal<ErrorInfo | null>(null);

  const reset = () => {
    setError(null);
    setInfo(null);
  };

  // Derived state using createMemo-like pattern
  const hasError = () => error() !== null;

  const handleError = (err: Error, errInfo?: ErrorInfo) => {
    // 避免重复设置已捕获的错误
    if (error() === null) {
      setError(err);
      setInfo(errInfo || null);
    }

    if (props.propagate) {
      throw err;
    }
  };

  // Render children normally if no error
  return (
    <>
      <ErrorCapture onError={handleError}>
        <Show
          when={!hasError()}
          fallback={
            props.fallback ? (
              props.fallback(error()!, reset)
            ) : (
              <DefaultErrorFallback error={error()!} reset={reset} info={info()} />
            )
          }
        >
          {props.children}
        </Show>
      </ErrorCapture>
    </>
  );
};

/**
 * 内部错误捕获组件
 * 使用 children render 模式配合 try-catch 实现错误捕获
 */
const ErrorCapture: Component<{ children: JSX.Element; onError: (err: Error, info?: ErrorInfo) => void }> = (props) => {
  try {
    return <>{props.children}</>;
  } catch (err) {
    props.onError(err as Error);
    return null;
  }
};

/**
 * 默认错误展示 fallback UI
 */
const DefaultErrorFallback: Component<{ error: Error; reset: () => void; info?: ErrorInfo }> = (props) => {
  const errorMessage = () => props.error?.message || 'An unknown error occurred';
  const stack = () => props.error?.stack || '';

  return (
    <div class="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div class="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 max-w-2xl w-full">
        {/* Error icon */}
        <div class="flex items-center gap-3 mb-4">
          <div class="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg class="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div>
            <h2 class="text-xl font-bold text-red-400">Something went wrong</h2>
            <p class="text-sm text-gray-400">An error occurred in this component</p>
          </div>
        </div>

        {/* Error message */}
        <div class="bg-gray-900/50 rounded-lg p-4 mb-4">
          <p class="text-red-300 font-mono text-sm break-all">{errorMessage()}</p>
        </div>

        {/* Stack trace (collapsible) */}
        <details class="mb-4">
          <summary class="text-gray-400 text-sm cursor-pointer hover:text-gray-300">
            Stack Trace
          </summary>
          <pre class="mt-2 text-xs text-gray-500 overflow-x-auto max-h-48 rounded bg-gray-900 p-3">
            {stack()}
          </pre>
        </details>

        {/* Component stack if available */}
        {props.info?.componentStack && (
          <details class="mb-4">
            <summary class="text-gray-400 text-sm cursor-pointer hover:text-gray-300">
              Component Stack
            </summary>
            <pre class="mt-2 text-xs text-gray-500 overflow-x-auto max-h-48 rounded bg-gray-900 p-3">
              {props.info.componentStack}
            </pre>
          </details>
        )}

        {/* Actions */}
        <div class="flex gap-3 mt-6">
          <button
            onClick={() => window.location.reload()}
            class="flex-1 px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg font-medium transition-colors border border-red-500/30"
          >
            Reload Page
          </button>
          <button
            onClick={props.reset}
            class="flex-1 px-4 py-2.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 rounded-lg font-medium transition-colors border border-indigo-500/30"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * 页面级 ErrorBoundary - 专门用于包裹整个页面组件
 * 提供更友好的全页错误展示
 */
export const PageErrorBoundary: Component<{ children: JSX.Element }> = (props) => {
  return (
    <ErrorBoundary
      propagate={false}
      fallback={(error, reset) => (
        <div class="flex flex-col items-center justify-center h-[calc(100vh-120px)]">
          <div class="bg-gray-800/80 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-10 max-w-xl w-full text-center shadow-2xl">
            {/* Animated warning icon */}
            <div class="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center animate-pulse">
              <svg class="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>

            <h2 class="text-2xl font-bold text-white mb-2">Page Failed to Load</h2>
            <p class="text-gray-400 mb-6">{error.message || 'An unexpected error occurred'}</p>

            <div class="flex flex-col gap-3">
              <button
                onClick={reset}
                class="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-indigo-500/20"
              >
                Retry Loading
              </button>
              <button
                onClick={() => window.location.href = '/'}
                class="w-full px-6 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl font-medium transition-colors"
              >
                Go to Homepage
              </button>
            </div>

            {/* Error details for developers */}
            <details class="mt-6 text-left">
              <summary class="text-gray-500 text-xs cursor-pointer hover:text-gray-400">
                Technical Details
              </summary>
              <pre class="mt-2 text-xs text-gray-600 overflow-x-auto p-3 bg-gray-900/50 rounded-lg">
                {error.stack}
              </pre>
            </details>
          </div>
        </div>
      )}
    >
      {props.children}
    </ErrorBoundary>
  );
};

export default ErrorBoundary;
