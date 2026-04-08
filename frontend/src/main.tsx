/* @refresh reload */
import { render } from 'solid-js/web';
import './index.css';
import App from './App';

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error('Root element not found.');
}

// ============================================================
// Global Uncaught Error Handler - 暂时禁用以排查性能问题
// ============================================================
// const tracker = getErrorTracker();
// window.addEventListener('error', (event) => { ... });
// window.addEventListener('unhandledrejection', (event) => { ... });
// window.addEventListener('error', (event) => { ... }, true);

// 正常渲染 App
render(() => <App />, root!);
