import { Component, createSignal, Show } from 'solid-js';
import { PortfolioOverview } from './PortfolioOverview';
import { CorrelationMatrix } from './CorrelationMatrix';
import { RiskContribution } from './RiskContribution';
import { PortfolioSimulator } from './PortfolioSimulator';

type TabKey = 'overview' | 'correlation' | 'risk' | 'simulator';

// Tab state - module level for cross-component sharing
const [activeTab, setActiveTab] = createSignal<TabKey>('overview');

const TabButton: Component<{ label: string; tabKey: TabKey }> = (props) => (
  <button
    class={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
      activeTab() === props.tabKey
        ? 'bg-[#1f2937] text-white border border-white/20 border-b-transparent'
        : 'text-gray-400 hover:text-white hover:bg-white/5'
    }`}
    onClick={() => setActiveTab(props.tabKey)}
  >
    {props.label}
  </button>
);

const TabContent: Component = () => {
  const tabVal = activeTab();
  return (
    <div class="h-full" data-tab={tabVal}>
      <Show when={tabVal === 'overview'}>
        <PortfolioOverview />
      </Show>
      <Show when={tabVal === 'correlation'}>
        <CorrelationMatrix />
      </Show>
      <Show when={tabVal === 'risk'}>
        <RiskContribution />
      </Show>
      <Show when={tabVal === 'simulator'}>
        <PortfolioSimulator />
      </Show>
    </div>
  );
};

const PortfolioAnalysis: Component = () => {
  return (
    <div class="h-full flex flex-col p-4 gap-4 overflow-auto">
      {/* Page Header */}
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-bold text-white">组合分析</h1>
      </div>

      {/* Tab Navigation */}
      <div class="flex gap-2 border-b border-white/10 pb-2">
        <TabButton label="持仓概览" tabKey="overview" />
        <TabButton label="相关性矩阵" tabKey="correlation" />
        <TabButton label="风险贡献" tabKey="risk" />
        <TabButton label="模拟调仓" tabKey="simulator" />
      </div>

      {/* Tab Content */}
      <div class="flex-1 min-h-0">
        <TabContent />
      </div>
    </div>
  );
};

export default PortfolioAnalysis;
export { PortfolioAnalysis };
export { activeTab, setActiveTab };
