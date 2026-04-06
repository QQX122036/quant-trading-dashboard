import { Router, Route, Navigate } from '@solidjs/router';
import { MainLayout } from './components/layout/MainLayout';
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
import { SentimentPage } from './components/pages/SentimentPage';
import { NewsSentiment } from './components/news/NewsSentiment';
import { AIAdvisor } from './components/news/AIAdvisor';
import PortfolioAnalysis from './components/pages/PortfolioAnalysis';
import { DerivativesPage } from './components/pages/Derivatives/DerivativesPage';
import { BacktestReport } from './components/reports/BacktestReport';
import { StockReport } from './components/reports/StockReport';
import { KeyboardShortcuts } from './components/KeyboardShortcuts';
import { AboutDialog } from './components/dialogs/AboutDialog';
import { I18nProvider } from './i18n';

const App = () => {
  return (
    <I18nProvider>
      <Router root={(props) => <MainLayout>{props.children}</MainLayout>}>
        <Route path="/" component={() => <Navigate href="/market" />} />
        <Route path="/market" component={MarketOverview} />
        <Route path="/dashboard" component={StockDashboard} />
        <Route path="/dashboard/home" component={DashboardHome} />
        <Route path="/backtest" component={BacktestAnalysis} />
        <Route path="/trades" component={TradeLog} />
        <Route path="/positions" component={PositionManagement} />
        <Route path="/data" component={DataManager} />
        <Route path="/strategies" component={StrategyManager} />
        <Route path="/factors" component={FactorDashboard} />
        <Route path="/multifactor" component={MultiFactorChart} />
        <Route path="/portfolio" component={PortfolioAnalysis} />
        <Route path="/sentiment" component={SentimentPage} />
        <Route path="/news" component={NewsSentiment} />
        <Route path="/advisor" component={AIAdvisor} />
        <Route path="/derivatives" component={DerivativesPage} />
        <Route path="/backtest/report" component={BacktestReport} />
        <Route path="/stock/report" component={StockReport} />
      </Router>

      {/* Global keyboard shortcuts */}
      <KeyboardShortcuts />

      {/* About dialog (shown conditionally via store) */}
      <AboutDialog />
    </I18nProvider>
  );
};

export default App;
