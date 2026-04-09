/**
 * App.tsx — 量化交易看板主入口
 *
 * 代码分割策略:
 * 1. 页面组件全部 lazy() 动态导入（按路由分割）
 * 2. DEV-only 组件（ErrorTrackerPanel/PerformanceAlerts/VitalBadge）动态导入
 *    → 仅在 import.meta.env.DEV 下加载，prod bundle 完全剔除 ~900行
 * 3. AboutDialog 条件动态加载（不占用主chunk）
 * 4. i18n 初始仅加载当前语言，另一种语言按需加载
 * 5. KeyboardShortcuts 轻量常驻（~3KB）
 */
import { Router, Route } from '@solidjs/router';
import { MainLayout } from './components/layout/MainLayout';
import { Suspense, Component, ParentProps, lazy } from 'solid-js';
import { I18nProvider } from './i18n';
import { PageErrorBoundary } from './components/common/ErrorBoundary';
import { RouteGuard } from './components/auth/RouteGuard';
import { LoginPage } from './components/auth/LoginPage';
import { KeyboardShortcuts } from './components/KeyboardShortcuts';

// ── Page Components — ALL lazy-loaded for code-splitting ─────────────────────
// Why lazy(): App.tsx previously statically imported 20+ page components (including
// ECharts-heavy pages like BacktestAnalysis/PortfolioAnalysis/DashboardIndex),
// forcing them into the initial bundle and inflating FCP/LCP to 14.8s.
// Lazy imports ensure each route chunk is loaded only when navigated to.
// NOTE: components use named exports; (lazy as any) pattern matches AppRouter.tsx.
/* eslint-disable @typescript-eslint/no-explicit-any */
const MarketOverview = (lazy as any)(() => import('./components/pages/MarketOverview'));
const StockDashboard = (lazy as any)(() => import('./components/pages/StockDashboard'));
const DashboardHome = (lazy as any)(() => import('./components/dashboard/DashboardHome'));
const DashboardIndex = (lazy as any)(() => import('./components/pages/DashboardIndex'));
const BacktestAnalysis = (lazy as any)(() => import('./components/pages/BacktestAnalysis'));
const TradeLog = (lazy as any)(() => import('./components/pages/TradeLog'));
const PositionManagement = (lazy as any)(() => import('./components/pages/PositionManagement'));
const DataManager = (lazy as any)(() => import('./components/pages/DataManager'));
const StrategyManager = (lazy as any)(() => import('./components/pages/StrategyManager'));
const FactorDashboard = (lazy as any)(() => import('./components/pages/FactorDashboard'));
const MultiFactorChart = (lazy as any)(() => import('./components/pages/MultiFactorChart'));
const PortfolioAnalysis = (lazy as any)(() => import('./components/pages/PortfolioAnalysis'));
const SentimentPage = (lazy as any)(() => import('./components/pages/SentimentPage'));
const NewsSentiment = (lazy as any)(() => import('./components/news/NewsSentiment'));
const AIAdvisor = (lazy as any)(() => import('./components/news/AIAdvisor'));
const DerivativesPage = (lazy as any)(
  () => import('./components/pages/Derivatives/DerivativesPage')
);
const BacktestReport = (lazy as any)(() => import('./components/reports/BacktestReport'));
const StockReport = (lazy as any)(() => import('./components/reports/StockReport'));
const RiskAlert = (lazy as any)(() => import('./components/pages/RiskAlert'));
const TestPage = (lazy as any)(() => import('./components/pages/TestPage'));

/* eslint-disable @typescript-eslint/no-unused-vars */
// ── DEV-ONLY Components (dynamically imported in DEV only) ────────────────────
const DevPanels = (lazy as any)(() => import('./components/performance/DevPanels'));

// ── AboutDialog (modal — dynamically imported on first open) ──────────────────
const AboutDialog = (lazy as any)(() => import('./components/dialogs/AboutDialog'));
/* eslint-enable @typescript-eslint/no-explicit-any */
/* eslint-enable @typescript-eslint/no-unused-vars */

// ── Loaders ──────────────────────────────────────────────────────────────────
const PageLoader = () => (
  <div class="flex flex-col items-center justify-center h-full gap-4 p-8">
    <div class="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
    <span class="text-gray-400 text-lg">加载中...</span>
  </div>
);

// ── Page Wrapper ─────────────────────────────────────────────────────────────
const PageWrapper = (Component: Component<any>, Fallback?: Component) => () => (
  <PageErrorBoundary>
    <Suspense fallback={Fallback ? <Fallback /> : <PageLoader />}>
      <Component />
    </Suspense>
  </PageErrorBoundary>
);

// ── App ──────────────────────────────────────────────────────────────────────
const App = () => {
  // 暂时禁用性能监控和错误追踪器以排查问题
  // useWebVitals();
  // usePerformanceMetrics();
  // const tracker = getErrorTracker();
  // tracker.init();
  // const monitor = getPerformanceMonitor();
  // const handleNavigate = (path: string) => {
  //   monitor.markRouteEnd(path);
  //   monitor.markRouteStart(path);
  // };

  return (
    <I18nProvider>
      <Router>
        {/* Public routes */}
        <Route path="/login" component={LoginPage} />

        {/* Protected routes */}
        <Route
          path="/"
          component={(props: ParentProps) => (
            <RouteGuard>
              <a href="#main-content" class="skip-link">
                跳转到主要内容
              </a>
              <MainLayout id="main-content">{props.children}</MainLayout>
            </RouteGuard>
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
          <Route path="/portfolio" component={PageWrapper(PortfolioAnalysis)} />
          <Route path="/sentiment" component={PageWrapper(SentimentPage)} />
          <Route path="/news" component={PageWrapper(NewsSentiment)} />
          <Route path="/advisor" component={PageWrapper(AIAdvisor)} />
          <Route path="/derivatives" component={PageWrapper(DerivativesPage)} />
          <Route path="/backtest/report" component={PageWrapper(BacktestReport)} />
          <Route path="/stock/report" component={PageWrapper(StockReport)} />
          <Route path="/risk" component={PageWrapper(RiskAlert)} />
          <Route path="/test" component={PageWrapper(TestPage)} />
        </Route>
      </Router>

      <KeyboardShortcuts />
    </I18nProvider>
  );
};

export default App;
