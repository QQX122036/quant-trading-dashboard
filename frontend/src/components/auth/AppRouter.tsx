/**
 * AppRouter.tsx — 路由配置（已删除鉴权和懒加载）
 * 所有路由公开，页面组件直接静态导入
 */
import { Router, Route, Navigate } from '@solidjs/router';
import { Suspense } from 'solid-js';
import { MainLayout } from '../layout/MainLayout';
import { PageErrorBoundary } from '../common/ErrorBoundary';

// ── Page Components — 直接静态导入（删除懒加载） ─────────────────────────────
import { MarketOverview } from '../../pages/MarketOverview';
import { StockDashboard } from '../../pages/StockDashboard';
import { DashboardHome } from '../../dashboard/DashboardHome';
import { Dashboard } from '../../pages/Dashboard';
import { BacktestAnalysis } from '../../pages/BacktestAnalysis';
import { TradeLog } from '../../pages/TradeLog';
import { PositionManagement } from '../../pages/PositionManagement';
import { DataManager } from '../../pages/DataManager';
import { StrategyManager } from '../../pages/StrategyManager';
import { FactorDashboard } from '../../pages/FactorDashboard';
import { MultiFactorChart } from '../../pages/MultiFactorChart';
import { MultiStrategyChart } from '../../pages/MultiStrategyChart';
import { PortfolioAnalysis } from '../../pages/PortfolioAnalysis';
import { SentimentPage } from '../../pages/SentimentPage';
import { Sentiment } from '../../pages/Sentiment';
import { AlphaSignals } from '../../pages/AlphaSignals';
import { NewsSentiment } from '../../news/NewsSentiment';
import { AIAdvisor } from '../../news/AIAdvisor';
import { DerivativesPage } from '../../pages/Derivatives/DerivativesPage';
import { BacktestReport } from '../../reports/BacktestReport';
import { StockReport } from '../../reports/StockReport';
import { Help } from '../../pages/Help';

// ── Loaders ──────────────────────────────────────────────────────────────────
const PageLoader = () => (
  <div class="flex flex-col items-center justify-center h-full gap-4">
    <div class="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
    <span class="text-gray-400 text-sm">Loading...</span>
  </div>
);

// ── App ──────────────────────────────────────────────────────────────────────
export const AppRouter = () => (
  <Router root={(props) => <MainLayout>{props.children}</MainLayout>}>
    {/* 所有路由公开 — 已删除鉴权 RouteGuard */}
    <Route path="/" component={() => <Navigate href="/market" />} />
    <Route path="/market" component={MarketOverview} />
    <Route path="/dashboard" component={Dashboard} />
    <Route path="/dashboard/home" component={DashboardHome} />
    <Route path="/stock/dashboard" component={StockDashboard} />
    <Route path="/backtest" component={BacktestAnalysis} />
    <Route path="/trades" component={TradeLog} />
    <Route path="/positions" component={PositionManagement} />
    <Route path="/data" component={DataManager} />
    <Route path="/strategies" component={StrategyManager} />
    <Route path="/factors" component={FactorDashboard} />
    <Route path="/multifactor" component={MultiFactorChart} />
    <Route path="/multistrategy" component={MultiStrategyChart} />
    <Route path="/portfolio" component={PortfolioAnalysis} />
    <Route path="/sentiment" component={SentimentPage} />
    <Route path="/sentiment-analysis" component={Sentiment} />
    <Route path="/alpha-signals" component={AlphaSignals} />
    <Route path="/news" component={NewsSentiment} />
    <Route path="/advisor" component={AIAdvisor} />
    <Route path="/derivatives" component={DerivativesPage} />
    <Route path="/backtest/report" component={BacktestReport} />
    <Route path="/stock/report" component={StockReport} />
    <Route path="/help" component={Help} />

    {/* Catch-all */}
    <Route path="*" component={() => <Navigate href="/market" />} />
  </Router>
);

export default AppRouter;
