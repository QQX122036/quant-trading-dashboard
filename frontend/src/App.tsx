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
import { Router, Route, Navigate } from '@solidjs/router';
import { MainLayout } from './components/layout/MainLayout';
import { lazy, Suspense, Component, ParentProps } from 'solid-js';
import { I18nProvider } from './i18n';
import { PageErrorBoundary } from './components/common/ErrorBoundary';
import { RouteGuard } from './components/auth/RouteGuard';
import { LoginPage } from './components/auth/LoginPage';
import { usePerformanceMetrics, getPerformanceMonitor } from './hooks/usePerformanceMetrics';
import { useWebVitals } from './hooks/useWebVitals';
import { getErrorTracker } from './stores/errorStore';
import { KeyboardShortcuts } from './components/KeyboardShortcuts';

// ── Lazy Page Components ──────────────────────────────────────────────────────
// 使用 solid-js 的 lazy 函数
// 组件使用命名导出，需要重新导出为 default
const MarketOverview = lazy(() => import('./components/pages/MarketOverview').then(m => ({ default: m.MarketOverview })));
const StockDashboard = lazy(() => import('./components/pages/StockDashboard').then(m => ({ default: m.StockDashboard })));
const DashboardHome = lazy(() => import('./components/dashboard/DashboardHome').then(m => ({ default: m.DashboardHome })));
const BacktestAnalysis = lazy(() => import('./components/pages/BacktestAnalysis').then(m => ({ default: m.BacktestAnalysis })));
const TradeLog = lazy(() => import('./components/pages/TradeLog').then(m => ({ default: m.TradeLog })));
const PositionManagement = lazy(() => import('./components/pages/PositionManagement').then(m => ({ default: m.PositionManagement })));
const DataManager = lazy(() => import('./components/pages/DataManager').then(m => ({ default: m.DataManager })));
const StrategyManager = lazy(() => import('./components/pages/StrategyManager').then(m => ({ default: m.StrategyManager })));
const FactorDashboard = lazy(() => import('./components/pages/FactorDashboard').then(m => ({ default: m.FactorDashboard })));
const MultiFactorChart = lazy(() => import('./components/pages/MultiFactorChart').then(m => ({ default: m.MultiFactorChart })));
const PortfolioAnalysis = lazy(() => import('./components/pages/PortfolioAnalysis').then(m => ({ default: m.default })));
const SentimentPage = lazy(() => import('./components/pages/SentimentPage').then(m => ({ default: m.SentimentPage })));
const NewsSentiment = lazy(() => import('./components/news/NewsSentiment').then(m => ({ default: m.NewsSentiment })));
const AIAdvisor = lazy(() => import('./components/news/AIAdvisor').then(m => ({ default: m.AIAdvisor })));
const DerivativesPage = lazy(() => import('./components/pages/Derivatives/DerivativesPage').then(m => ({ default: m.DerivativesPage })));
const BacktestReport = lazy(() => import('./components/reports/BacktestReport').then(m => ({ default: m.BacktestReport })));
const StockReport = lazy(() => import('./components/reports/StockReport').then(m => ({ default: m.StockReport })));
const RiskAlert = lazy(() => import('./components/pages/RiskAlert').then(m => ({ default: m.default })));
const TestPage = lazy(() => import('./components/pages/TestPage').then(m => ({ default: m.TestPage })));

// ── DEV-ONLY Components — dynamically imported only in dev mode ───────────────
// These are ~900 lines of dev tooling (ErrorTracker + PerformanceAlerts + VitalBadge)
// that should NOT appear in the production bundle at all.
const DevPanels = lazy(() => import('./components/performance/DevPanels'));

// ── AboutDialog — dynamically imported (shown conditionally) ─────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AboutDialog = (lazy as any)(() => import('./components/dialogs/AboutDialog'));

// ── Loaders ──────────────────────────────────────────────────────────────────
const PageLoader = () => (
  <div class="flex flex-col items-center justify-center h-full gap-4 p-8">
    <div class="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
    <span class="text-gray-400 text-lg">加载中...</span>
  </div>
);

// ── Page Wrapper ─────────────────────────────────────────────────────────────
const PageWrapper = (Component: Component<any>) => () => (
  <PageErrorBoundary>
    <Suspense fallback={<PageLoader />}>
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
              <a href="#main-content" class="skip-link">跳转到主要内容</a>
              <MainLayout id="main-content">{props.children}</MainLayout>
            </RouteGuard>
          )}
        >
          <Route path="/" component={() => <Navigate href="/market" />} />
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
