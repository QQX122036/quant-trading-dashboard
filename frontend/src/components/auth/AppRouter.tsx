/**
 * AppRouter.tsx — 认证感知路由
 * 所有受保护路由须通过 RouteGuard，未登录跳转 /login
 * /login 路由独立渲染，不含 MainLayout
 */
import { Router, Route, Navigate } from '@solidjs/router';
import { lazy, Suspense } from 'solid-js';
import { MainLayout } from '../layout/MainLayout';
import { RouteGuard } from './RouteGuard';
import { LoginPage } from './LoginPage';
import { PageErrorBoundary } from '../common/ErrorBoundary';

// Lazy load all page components
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MarketOverview = (lazy as any)(() => import('../pages/MarketOverview'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StockDashboard = (lazy as any)(() => import('../pages/StockDashboard'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DashboardHome = (lazy as any)(() => import('../dashboard/DashboardHome'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Dashboard = (lazy as any)(() => import('../../pages/Dashboard'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BacktestAnalysis = (lazy as any)(() => import('../pages/BacktestAnalysis'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TradeLog = (lazy as any)(() => import('../pages/TradeLog'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PositionManagement = (lazy as any)(() => import('../pages/PositionManagement'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DataManager = (lazy as any)(() => import('../pages/DataManager'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StrategyManager = (lazy as any)(() => import('../pages/StrategyManager'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FactorDashboard = (lazy as any)(() => import('../pages/FactorDashboard'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MultiFactorChart = (lazy as any)(() => import('../pages/MultiFactorChart'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PortfolioAnalysis = (lazy as any)(() => import('../pages/PortfolioAnalysis'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SentimentPage = (lazy as any)(() => import('../pages/SentimentPage'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Sentiment = (lazy as any)(() => import('../../pages/Sentiment'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AlphaSignals = (lazy as any)(() => import('../../pages/AlphaSignals'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NewsSentiment = (lazy as any)(() => import('../news/NewsSentiment'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AIAdvisor = (lazy as any)(() => import('../news/AIAdvisor'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DerivativesPage = (lazy as any)(() => import('../pages/Derivatives/DerivativesPage'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BacktestReport = (lazy as any)(() => import('../reports/BacktestReport'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StockReport = (lazy as any)(() => import('../reports/StockReport'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Help = (lazy as any)(() => import('../../pages/Help'));

const PageLoader = () => (
  <div class="flex flex-col items-center justify-center h-full gap-4">
    <div class="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
    <span class="text-gray-400 text-sm">Loading...</span>
  </div>
);

// ── Protected Route Wrapper ────────────────────────────────
const ProtectedRoute = (props: { path: string; component: any }) => (
  <Route
    path={props.path}
    component={() => (
      <RouteGuard>
        <PageErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <props.component />
          </Suspense>
        </PageErrorBoundary>
      </RouteGuard>
    )}
  />
);

export const AppRouter = () => (
  <Router root={(props) => <MainLayout>{props.children}</MainLayout>}>
    {/* Public routes — no auth guard */}
    <Route path="/login" component={() => <LoginPage />} />

    {/* Protected routes — auth guard */}
    <ProtectedRoute path="/" component={() => <Navigate href="/market" />} />
    <ProtectedRoute path="/market" component={MarketOverview} />
    <ProtectedRoute path="/dashboard" component={Dashboard} />
    <ProtectedRoute path="/dashboard/home" component={DashboardHome} />
    <ProtectedRoute path="/stock/dashboard" component={StockDashboard} />
    <ProtectedRoute path="/backtest" component={BacktestAnalysis} />
    <ProtectedRoute path="/trades" component={TradeLog} />
    <ProtectedRoute path="/positions" component={PositionManagement} />
    <ProtectedRoute path="/data" component={DataManager} />
    <ProtectedRoute path="/strategies" component={StrategyManager} />
    <ProtectedRoute path="/factors" component={FactorDashboard} />
    <ProtectedRoute path="/multifactor" component={MultiFactorChart} />
    <ProtectedRoute path="/portfolio" component={PortfolioAnalysis} />
    <ProtectedRoute path="/sentiment" component={SentimentPage} />
    <ProtectedRoute path="/sentiment-analysis" component={Sentiment} />
    <ProtectedRoute path="/alpha-signals" component={AlphaSignals} />
    <ProtectedRoute path="/news" component={NewsSentiment} />
    <ProtectedRoute path="/advisor" component={AIAdvisor} />
    <ProtectedRoute path="/derivatives" component={DerivativesPage} />
    <ProtectedRoute path="/backtest/report" component={BacktestReport} />
    <ProtectedRoute path="/stock/report" component={StockReport} />
    <ProtectedRoute path="/help" component={Help} />

    {/* Catch-all */}
    <Route path="*" component={() => <Navigate href="/market" />} />
  </Router>
);

export default AppRouter;
