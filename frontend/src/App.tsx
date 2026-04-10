/**
 * App.tsx — 量化交易看板主入口
 *
 * 修改说明 (2026-04-10):
 * 1. 移除 RouteGuard 鉴权组件，所有路由直接访问
 * 2. 所有非首页组件使用 lazy() 动态导入，实现路由级代码分割
 * 3. 首页 DashboardIndex 保持直接导入（首屏体验）
 */
import { Router, Route } from '@solidjs/router';
import { MainLayout } from './components/layout/MainLayout';
import { Suspense, Component, ParentProps, lazy } from 'solid-js';
import { I18nProvider } from './i18n';
import { PageErrorBoundary } from './components/common/ErrorBoundary';
import { KeyboardShortcuts } from './components/KeyboardShortcuts';
import { useWebVitals } from './hooks/useWebVitals';

// ── Page Components — 首页直接导入，其他懒加载 ──────────────────────────────
import { DashboardIndex } from './components/pages/DashboardIndex'; // 首屏关键，直接导入

// 懒加载：非首页页面（路由级代码分割）
const MarketOverview = lazy(() => import('./components/pages/MarketOverview'));
const StockDashboard = lazy(() => import('./components/pages/StockDashboard'));
const DashboardHome = lazy(() => import('./components/dashboard/DashboardHome'));
const BacktestAnalysis = lazy(() => import('./components/pages/BacktestAnalysis'));
const TradeLog = lazy(() => import('./components/pages/TradeLog'));
const PositionManagement = lazy(() => import('./components/pages/PositionManagement'));
const DataManager = lazy(() => import('./components/pages/DataManager'));
const StrategyManager = lazy(() => import('./components/pages/StrategyManager'));
const FactorDashboard = lazy(() => import('./components/pages/FactorDashboard'));
const MultiFactorChart = lazy(() => import('./components/pages/MultiFactorChart'));
const MultiStrategyChart = lazy(() => import('./components/pages/MultiStrategyChart'));
const PortfolioAnalysis = lazy(() => import('./components/pages/PortfolioAnalysis'));
const SentimentPage = lazy(() => import('./components/pages/SentimentPage'));
const NewsSentiment = lazy(() => import('./components/news/NewsSentiment'));
const AIAdvisor = lazy(() => import('./components/news/AIAdvisor'));
const DerivativesPage = lazy(() => import('./components/pages/Derivatives/DerivativesPage'));
const BacktestReport = lazy(() => import('./components/reports/BacktestReport'));
const StockReport = lazy(() => import('./components/reports/StockReport'));
const RiskAlert = lazy(() => import('./components/pages/RiskAlert'));
const TestPage = lazy(() => import('./components/pages/TestPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Sentiment = lazy(() => import('./pages/Sentiment'));
const AlphaSignals = lazy(() => import('./pages/AlphaSignals'));
const Help = lazy(() => import('./pages/Help'));

// ── Loaders ──────────────────────────────────────────────────────────────────
const PageLoader = () => (
  <div class="flex flex-col items-center justify-center h-full gap-4 p-8">
    <div class="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
    <span class="text-gray-400 text-lg">加载中...</span>
  </div>
);

// ── Page Wrapper (for lazy components) ─────────────────────────────────────
const PageWrapper = (Component: Component<any>) => () => (
  <PageErrorBoundary>
    <Suspense fallback={<PageLoader />}>
      <Component />
    </Suspense>
  </PageErrorBoundary>
);

// ── Page Wrapper for non-lazy (DashboardIndex) ─────────────────────────────
const PageWrapperSync = (Component: Component<any>) => () => (
  <PageErrorBoundary>
    <Suspense fallback={<PageLoader />}>
      <Component />
    </Suspense>
  </PageErrorBoundary>
);

// ── Web Vitals Init ──────────────────────────────────────────────────────────
const WebVitalsInit: Component = () => {
  useWebVitals();
  return null;
};

// ── App ──────────────────────────────────────────────────────────────────────
const App: Component = () => {
  return (
    <>
      <WebVitalsInit />
      <I18nProvider>
        <Router>
          {/* 所有路由直接访问，无鉴权 */}
          <Route
            path="/"
            component={(props: ParentProps) => (
              <>
                <a href="#main-content" class="skip-link">
                  跳转到主要内容
                </a>
                <MainLayout id="main-content">{props.children}</MainLayout>
              </>
            )}
          >
            <Route path="/" component={PageWrapper(DashboardIndex)} />
            <Route path="/market" component={PageWrapper(MarketOverview)} />
            <Route path="/dashboard" component={PageWrapper(StockDashboard)} />
            <Route path="/dashboard/home" component={PageWrapper(DashboardHome)} />
            <Route path="/backtest" component={PageWrapper(BacktestAnalysis)} />
            <Route path="/trades" component={PageWrapper(TradeLog)} />
            <Route path="/positions" component={PageWrapper(PositionManagement)} />
            <Route path="/data" component={PageWrapper(DataManager)} />
            <Route path="/strategies" component={PageWrapper(StrategyManager)} />
            <Route path="/factors" component={PageWrapper(FactorDashboard)} />
            <Route path="/multifactor" component={PageWrapper(MultiFactorChart)} />
            <Route path="/multistrategy" component={PageWrapper(MultiStrategyChart)} />
            <Route path="/portfolio" component={PageWrapper(PortfolioAnalysis)} />
            <Route path="/sentiment" component={PageWrapper(SentimentPage)} />
            <Route path="/news" component={PageWrapper(NewsSentiment)} />
            <Route path="/advisor" component={PageWrapper(AIAdvisor)} />
            <Route path="/derivatives" component={PageWrapper(DerivativesPage)} />
            <Route path="/backtest/report" component={PageWrapper(BacktestReport)} />
            <Route path="/stock/report" component={PageWrapper(StockReport)} />
            <Route path="/risk" component={PageWrapper(RiskAlert)} />
            <Route path="/test" component={PageWrapper(TestPage)} />
            <Route path="/sentiment-analysis" component={PageWrapper(Sentiment)} />
            <Route path="/alpha-signals" component={PageWrapper(AlphaSignals)} />
            <Route path="/help" component={PageWrapper(Help)} />
          </Route>
        </Router>

        <KeyboardShortcuts />
      </I18nProvider>
    </>
  );
};

export default App;
