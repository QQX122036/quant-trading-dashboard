/**
 * App.tsx — 量化交易看板主入口
 *
 * 修改说明:
 * 1. 移除 RouteGuard 鉴权组件，所有路由直接访问
 * 2. 移除 lazy() 懒加载，改为直接静态导入
 */
import { Router, Route } from '@solidjs/router';
import { MainLayout } from './components/layout/MainLayout';
import { Suspense, Component, ParentProps } from 'solid-js';
import { I18nProvider } from './i18n';
import { PageErrorBoundary } from './components/common/ErrorBoundary';
import { KeyboardShortcuts } from './components/KeyboardShortcuts';

// ── Page Components — 全量直接静态导入（删除懒加载） ─────────────────────────
import { MarketOverview } from './components/pages/MarketOverview';
import { StockDashboard } from './components/pages/StockDashboard';
import { DashboardHome } from './components/dashboard/DashboardHome';
import { DashboardIndex } from './components/pages/DashboardIndex';
import { BacktestAnalysis } from './components/pages/BacktestAnalysis';
import { TradeLog } from './components/pages/TradeLog';
import { PositionManagement } from './components/pages/PositionManagement';
import { DataManager } from './components/pages/DataManager';
import { StrategyManager } from './components/pages/StrategyManager';
import { FactorDashboard } from './components/pages/FactorDashboard';
import { MultiFactorChart } from './components/pages/MultiFactorChart';
import { MultiStrategyChart } from './components/pages/MultiStrategyChart';
import PortfolioAnalysis from './components/pages/PortfolioAnalysis';
import { SentimentPage } from './components/pages/SentimentPage';
import { NewsSentiment } from './components/news/NewsSentiment';
import { AIAdvisor } from './components/news/AIAdvisor';
import { DerivativesPage } from './components/pages/Derivatives/DerivativesPage';
import { BacktestReport } from './components/reports/BacktestReport';
import { StockReport } from './components/reports/StockReport';
import RiskAlert from './components/pages/RiskAlert';
import { TestPage } from './components/pages/TestPage';
import Dashboard from './pages/Dashboard';
import Sentiment from './pages/Sentiment';
import AlphaSignals from './pages/AlphaSignals';
import Help from './pages/Help';

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
  return (
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
  );
};

export default App;
