/**
 * DerivativesPage.tsx — 衍生品综合页面
 * 整合期权链、期货、可转债、Greeks风险面板
 */
import { Component, createSignal, Show, For } from 'solid-js';
import { OptionsChain } from './OptionsChain';
import { FuturesModule } from './FuturesModule';
import { ConvertibleBond } from './ConvertibleBond';
import { GreeksPanel } from './GreeksPanel';

type TabId = 'options' | 'futures' | 'cb' | 'greeks';

export const DerivativesPage: Component = () => {
  const [activeTab, setActiveTab] = createSignal<TabId>('options');

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'options', label: '期权链', icon: '📊' },
    { id: 'futures', label: '期货', icon: '📈' },
    { id: 'cb', label: '可转债', icon: '💰' },
    { id: 'greeks', label: 'Greeks风险', icon: '⚠️' },
  ];

  return (
    <div class="h-full flex flex-col">
      {/* Tab bar */}
      <div class="flex items-center gap-1 px-4 py-2 border-b border-white/10 bg-[#111827]/60">
        <For each={tabs}>
          {(tab) => (
            <button
              class={`px-4 py-1.5 text-xs rounded-t transition-colors flex items-center gap-1.5 ${
                activeTab() === tab.id
                  ? 'bg-[#1f2937] border border-white/10 border-b-0 text-white font-bold'
                  : 'bg-transparent text-gray-400 hover:text-white hover:bg-white/5'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          )}
        </For>
      </div>

      {/* Tab content */}
      <div class="flex-1 min-h-0 overflow-hidden">
        <Show when={activeTab() === 'options'}>
          <div class="h-full">
            <OptionsChain />
          </div>
        </Show>
        <Show when={activeTab() === 'futures'}>
          <div class="h-full">
            <FuturesModule />
          </div>
        </Show>
        <Show when={activeTab() === 'cb'}>
          <div class="h-full">
            <ConvertibleBond />
          </div>
        </Show>
        <Show when={activeTab() === 'greeks'}>
          <div class="h-full">
            <GreeksPanel />
          </div>
        </Show>
      </div>
    </div>
  );
};
