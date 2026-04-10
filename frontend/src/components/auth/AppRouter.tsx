/**
 * AppRouter.tsx — 路由配置（使用懒加载路由 + Suspense骨架屏）
 *
 * 变更说明：
 * - 所有页面组件使用 lazy() 实现路由级代码分割
 * - Suspense fallback 展示骨架屏，避免白屏
 * - 首屏仅加载核心布局 + /market，最大化削减初始 bundle
 */
import { Router } from '@solidjs/router';
import { Suspense } from 'solid-js';
import { MainLayout } from '../layout/MainLayout';
import { PageErrorBoundary } from '../common/ErrorBoundary';
import { pageRoutes } from './PageRoutes';
import { I18nProvider } from '../../i18n';

// ── 全局 Suspense 骨架屏 ───────────────────────────────────────────────────────
const PageSkeleton = () => (
  <div class="min-h-screen bg-[#0A0E17] flex items-center justify-center">
    <div class="flex flex-col items-center gap-4">
      <div class="w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      <span class="text-sm text-gray-500 font-medium">页面加载中...</span>
    </div>
  </div>
);

export const AppRouter = () => (
  <I18nProvider>
    <PageErrorBoundary>
      <Router root={(props) => <MainLayout>{props.children}</MainLayout>}>
        <Suspense fallback={<PageSkeleton />}>{pageRoutes}</Suspense>
      </Router>
    </PageErrorBoundary>
  </I18nProvider>
);

export default AppRouter;
