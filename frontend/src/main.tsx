/* @refresh reload */
import { render } from 'solid-js/web';
import './index.css';
import App from './App';

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error('Root element not found.');
}

// ============================================================
// Global Uncaught Error Handler
// 捕获未被 ErrorBoundary 捕获的 JavaScript 错误
// 注意：这不捕获异步错误（setTimeout/Promise）和事件处理器错误
// those are handled by ErrorBoundary
// ============================================================
window.addEventListener('error', (event) => {
  // 避免重复报告已被 ErrorBoundary 捕获的错误
  if (event.defaultPrevented) return;

  const error = event.error;
  if (!error) return;

  // 记录错误到控制台
  console.error('[Global Error Handler] Uncaught error:', error.message, error.stack);

  // 可以在这里添加错误上报服务，如 Sentry
  // if (typeof window.Sentry !== 'undefined') {
  //   window.Sentry.captureException(error, { extra: { colno: event.colno, lineno: event.lineno } });
  // }
});

// 捕获未处理的 Promise  rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Global Error Handler] Unhandled promise rejection:', event.reason);
});

// ============================================================
// Web Vitals 监控初始化
// ============================================================
import { useWebVitals } from './hooks/useWebVitals';

let webVitalsReported = false;
function initWebVitals() {
  if (webVitalsReported) return;
  webVitalsReported = true;
  try {
    useWebVitals();
  } catch (e) {
    console.warn('[WebVitals] Init failed:', e);
  }
}

// 延迟到 DOM 渲染完成后初始化，确保 FCP/LCP 测量准确
if (document.readyState === 'complete') {
  initWebVitals();
} else {
  window.addEventListener('load', initWebVitals, { once: true });
}

render(() => <App />, root!);
