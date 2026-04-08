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
import { Suspense, Component, ParentProps } from 'solid-js';
import { I18nProvider } from './i18n';
import { PageErrorBoundary } from './components/common/ErrorBoundary';
import { RouteGuard } from './components/auth/RouteGuard';
import { LoginPage } from './components/auth/LoginPage';
import { usePerformanceMetrics, getPerformanceMonitor } from './hooks/usePerformanceMetrics';
import { useWebVitals } from './hooks/useWebVitals';
import { getErrorTracker } from './stores/errorStore';
import { KeyboardShortcuts } from './components/KeyboardShortcuts';

// ── Page Components (static imports) ──────────────────────────────────────────
import { MarketOverview } from './components/pages/MarketOverview';
import { StockDashboard } from './components/pages/StockDashboard';
import { DashboardHome } from './components/dashboard/DashboardHome';
import { BacktestAnalysis } from './components/pages/BacktestAnalysis';
import { TradeLog } from './components/pages/TradeLog';
import { PositionManagement } from './components/pages/PositionManagement';
import { DataManager } from './components/pages/DataManager';
import { StrategyManager } from './components/pages/StrategyManager';
import { FactorDashboard } from './components/pages/FactorDashboard';
import { MultiFactorChart } from './components/pages/MultiFactorChart';
import PortfolioAnalysis from './components/pages/PortfolioAnalysis';
import { SentimentPage } from './components/pages/SentimentPage';
import { NewsSentiment } from './components/news/NewsSentiment';
import { AIAdvisor } from './components/news/AIAdvisor';
import { DerivativesPage } from './components/pages/Derivatives/DerivativesPage';
import { BacktestReport } from './components/reports/BacktestReport';
import { StockReport } from './components/reports/StockReport';
import RiskAlert from './components/pages/RiskAlert';
import { TestPage } from './components/pages/TestPage';

// ── DEV-ONLY Components ────────────────────────────────────────────────────────
import DevPanels from './components/performance/DevPanels';

// ── AboutDialog ──────────────────────────────────────────────────────────────
import { AboutDialog } from './components/dialogs/AboutDialog';

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
