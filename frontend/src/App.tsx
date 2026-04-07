import { Router, Route, Navigate } from '@solidjs/router';
import { MainLayout } from './components/layout/MainLayout';
import { lazy, Suspense } from 'solid-js';
import { KeyboardShortcuts } from './components/KeyboardShortcuts';
import { AboutDialog } from './components/dialogs/AboutDialog';
import { I18nProvider } from './i18n';
import { PageErrorBoundary } from './components/common/ErrorBoundary';

// Lazy load all page components for code splitting
// @solidjs/router uses its own lazy() with different typing from solid-js
// Cast to any to resolve TS mismatch between module namespace types vs { default: Component }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MarketOverview = (lazy as any)(() => import('./components/pages/MarketOverview'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StockDashboard = (lazy as any)(() => import('./components/pages/StockDashboard'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DashboardHome = (lazy as any)(() => import('./components/dashboard/DashboardHome'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BacktestAnalysis = (lazy as any)(() => import('./components/pages/BacktestAnalysis'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TradeLog = (lazy as any)(() => import('./components/pages/TradeLog'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PositionManagement = (lazy as any)(() => import('./components/pages/PositionManagement'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DataManager = (lazy as any)(() => import('./components/pages/DataManager'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StrategyManager = (lazy as any)(() => import('./components/pages/StrategyManager'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FactorDashboard = (lazy as any)(() => import('./components/pages/FactorDashboard'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MultiFactorChart = (lazy as any)(() => import('./components/pages/MultiFactorChart'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PortfolioAnalysis = (lazy as any)(() => import('./components/pages/PortfolioAnalysis'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SentimentPage = (lazy as any)(() => import('./components/pages/SentimentPage'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NewsSentiment = (lazy as any)(() => import('./components/news/NewsSentiment'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AIAdvisor = (lazy as any)(() => import('./components/news/AIAdvisor'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DerivativesPage = (lazy as any)(() => import('./components/pages/Derivatives/DerivativesPage'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BacktestReport = (lazy as any)(() => import('./components/reports/BacktestReport'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StockReport = (lazy as any)(() => import('./components/reports/StockReport'));

// Loading skeleton components for different page types
const PageLoader = () => (
  <div class="flex flex-col items-center justify-center h-full gap-4">
    <div class="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
    <span class="text-gray-400 text-sm">Loading...</span>
  </div>
);

const ChartSkeleton = () => (
  <div class="space-y-3 animate-pulse">
    <div class="h-6 bg-gray-700/50 rounded w-1/3" />
    <div class="h-64 bg-gray-800/50 rounded-lg" />
    <div class="flex gap-2">
      <div class="h-4 bg-gray-700/50 rounded w-20" />
      <div class="h-4 bg-gray-700/50 rounded w-20" />
      <div class="h-4 bg-gray-700/50 rounded w-20" />
    </div>
  </div>
);

const TableSkeleton = () => (
  <div class="space-y-2 animate-pulse">
    <div class="h-8 bg-gray-800/50 rounded" />
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} class="h-12 bg-gray-800/30 rounded" />
    ))}
  </div>
);

const CardSkeleton = () => (
  <div class="bg-gray-800/30 rounded-xl p-4 animate-pulse">
    <div class="h-4 bg-gray-700/50 rounded w-1/2 mb-3" />
    <div class="h-8 bg-gray-700/50 rounded w-3/4" />
  </div>
);

const App = () => {
  return (
    <I18nProvider>
      <Router root={(props) => <MainLayout>{props.children}</MainLayout>}>
        <Route path="/" component={() => <Navigate href="/market" />} />
        <Route path="/market" component={() => <PageErrorBoundary><Suspense fallback={<PageLoader />}><MarketOverview /></Suspense></PageErrorBoundary>} />
        <Route path="/dashboard" component={() => <PageErrorBoundary><Suspense fallback={<PageLoader />}><StockDashboard /></Suspense></PageErrorBoundary>} />
        <Route path="/dashboard/home" component={() => <PageErrorBoundary><Suspense fallback={<PageLoader />}><DashboardHome /></Suspense></PageErrorBoundary>} />
        <Route path="/backtest" component={() => <PageErrorBoundary><Suspense fallback={<PageLoader />}><BacktestAnalysis /></Suspense></PageErrorBoundary>} />
        <Route path="/trades" component={() => <PageErrorBoundary><Suspense fallback={<PageLoader />}><TradeLog /></Suspense></PageErrorBoundary>} />
        <Route path="/positions" component={() => <PageErrorBoundary><Suspense fallback={<PageLoader />}><PositionManagement /></Suspense></PageErrorBoundary>} />
        <Route path="/data" component={() => <PageErrorBoundary><Suspense fallback={<PageLoader />}><DataManager /></Suspense></PageErrorBoundary>} />
        <Route path="/strategies" component={() => <PageErrorBoundary><Suspense fallback={<PageLoader />}><StrategyManager /></Suspense></PageErrorBoundary>} />
        <Route path="/factors" component={() => <PageErrorBoundary><Suspense fallback={<PageLoader />}><FactorDashboard /></Suspense></PageErrorBoundary>} />
        <Route path="/multifactor" component={() => <PageErrorBoundary><Suspense fallback={<PageLoader />}><MultiFactorChart /></Suspense></PageErrorBoundary>} />
        <Route path="/portfolio" component={() => <PageErrorBoundary><Suspense fallback={<PageLoader />}><PortfolioAnalysis /></Suspense></PageErrorBoundary>} />
        <Route path="/sentiment" component={() => <PageErrorBoundary><Suspense fallback={<PageLoader />}><SentimentPage /></Suspense></PageErrorBoundary>} />
        <Route path="/news" component={() => <PageErrorBoundary><Suspense fallback={<PageLoader />}><NewsSentiment /></Suspense></PageErrorBoundary>} />
        <Route path="/advisor" component={() => <PageErrorBoundary><Suspense fallback={<PageLoader />}><AIAdvisor /></Suspense></PageErrorBoundary>} />
        <Route path="/derivatives" component={() => <PageErrorBoundary><Suspense fallback={<PageLoader />}><DerivativesPage /></Suspense></PageErrorBoundary>} />
        <Route path="/backtest/report" component={() => <PageErrorBoundary><Suspense fallback={<PageLoader />}><BacktestReport result={null} /></Suspense></PageErrorBoundary>} />
        <Route path="/stock/report" component={() => <PageErrorBoundary><Suspense fallback={<PageLoader />}><StockReport /></Suspense></PageErrorBoundary>} />
      </Router>

      {/* Global keyboard shortcuts */}
      <KeyboardShortcuts />

      {/* About dialog (shown conditionally via store) */}
      <AboutDialog />
    </I18nProvider>
  );
};

export default App;
