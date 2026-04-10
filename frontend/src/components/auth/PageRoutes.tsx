/**
 * PageRoutes.tsx — 路由懒加载（代码分割）
 *
 * 使用 solid-js lazy() 实现路由级代码分割：
 * - 首屏仅加载核心布局 + /market
 * - 其他页面按需加载，不阻塞首屏
 */
import { lazy } from 'solid-js';
import { Route } from '@solidjs/router';
import { Navigate } from '@solidjs/router';

// ── 懒加载页面组件 ────────────────────────────────────────────────────────────
// 每个 lazy() 调用会创建独立的 chunk 文件，按需加载
const MarketOverview = lazy(() =>
  import('../pages/MarketOverview').then((m) => ({ default: m.MarketOverview }))
);
const StockDashboard = lazy(() =>
  import('../pages/StockDashboard').then((m) => ({ default: m.StockDashboard }))
);
const DashboardHome = lazy(() =>
  import('../dashboard/DashboardHome').then((m) => ({ default: m.DashboardHome }))
);
const Dashboard = lazy(() => import('../../pages/Dashboard').then((m) => ({ default: m.default })));
const BacktestAnalysis = lazy(() =>
  import('../pages/BacktestAnalysis').then((m) => ({ default: m.BacktestAnalysis }))
);
const TradeLog = lazy(() => import('../pages/TradeLog').then((m) => ({ default: m.TradeLog })));
const PositionManagement = lazy(() =>
  import('../pages/PositionManagement').then((m) => ({ default: m.PositionManagement }))
);
const DataManager = lazy(() =>
  import('../pages/DataManager').then((m) => ({ default: m.DataManager }))
);
const StrategyManager = lazy(() =>
  import('../pages/StrategyManager').then((m) => ({ default: m.StrategyManager }))
);
const FactorDashboard = lazy(() =>
  import('../pages/FactorDashboard').then((m) => ({ default: m.FactorDashboard }))
);
const MultiFactorChart = lazy(() =>
  import('../pages/MultiFactorChart').then((m) => ({ default: m.MultiFactorChart }))
);
const MultiStrategyChart = lazy(() =>
  import('../pages/MultiStrategyChart').then((m) => ({ default: m.MultiStrategyChart }))
);
const PortfolioAnalysis = lazy(() =>
  import('../pages/PortfolioAnalysis').then((m) => ({ default: m.default }))
);
const SentimentPage = lazy(() =>
  import('../pages/SentimentPage').then((m) => ({ default: m.SentimentPage }))
);
const Sentiment = lazy(() => import('../../pages/Sentiment').then((m) => ({ default: m.default })));
const AlphaSignals = lazy(() =>
  import('../../pages/AlphaSignals').then((m) => ({ default: m.default }))
);
const NewsSentiment = lazy(() =>
  import('../news/NewsSentiment').then((m) => ({ default: m.NewsSentiment }))
);
const AIAdvisor = lazy(() => import('../news/AIAdvisor').then((m) => ({ default: m.AIAdvisor })));
const DerivativesPage = lazy(() =>
  import('../pages/Derivatives/DerivativesPage').then((m) => ({ default: m.DerivativesPage }))
);
const BacktestReport = lazy(() =>
  import('../reports/BacktestReport').then((m) => ({ default: m.BacktestReport }))
);
const StockReport = lazy(() =>
  import('../reports/StockReport').then((m) => ({ default: m.StockReport }))
);
const Help = lazy(() => import('../../pages/Help').then((m) => ({ default: m.default })));

// ── 懒加载包装器（带骨架屏）────────────────────────────────────────────────────
const SkeletonPage = () => (
  <div class="min-h-screen bg-[#0A0E17] flex items-center justify-center">
    <div class="flex flex-col items-center gap-4">
      <div class="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      <span class="text-sm text-gray-500">加载中...</span>
    </div>
  </div>
);

// ── 路由配置（懒加载）─────────────────────────────────────────────────────────
export const pageRoutes = (
  <>
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
    <Route path="/factors" component={FactorDashboard as any} />
    <Route path="/multifactor" component={MultiFactorChart as any} />
    <Route path="/multistrategy" component={MultiStrategyChart} />
    <Route path="/portfolio" component={PortfolioAnalysis} />
    <Route path="/sentiment" component={SentimentPage} />
    <Route path="/sentiment-analysis" component={Sentiment} />
    <Route path="/alpha-signals" component={AlphaSignals} />
    <Route path="/news" component={NewsSentiment} />
    <Route path="/advisor" component={AIAdvisor} />
    <Route path="/derivatives" component={DerivativesPage} />
    <Route path="/backtest/report" component={BacktestReport as any} />
    <Route path="/stock/report" component={StockReport as any} />
    <Route path="/help" component={Help} />
    <Route path="*" component={() => <Navigate href="/market" />} />
  </>
);

export { SkeletonPage };
