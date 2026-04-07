import { Component, createSignal, Show, For } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { state, actions } from '../../stores';
import { GlobalDialog } from '../dialogs/GlobalDialog';
import { ContractManager } from '../dialogs/ContractManager';
import { ConnectDialog } from '../dialogs/ConnectDialog';
import { useI18n } from '../../i18n';

interface MenuChildItem {
  label: string;
  action?: () => void;
  route?: string;
  divider?: boolean;
}

interface MenuItem {
  label: string;
  children?: MenuChildItem[];
}

export const MenuBar: Component = () => {
  const [activeMenu, setActiveMenu] = createSignal<string | null>(null);
  const navigate = useNavigate();

  const menus: MenuItem[] = [
    {
      label: '系统',
      children: [
        { label: '连接网关', action: () => actions.ui.toggleDialog('connect') },
        { label: '断开网关', action: () => console.log('断开网关') },
        { label: '', divider: true },
        { label: '退出系统', action: () => window.close() },
      ],
    },
    {
      label: '功能',
      children: [
        { label: '市场总览', route: '/market' },
        { label: 'A股看板', route: '/dashboard' },
        { label: '回测分析', route: '/backtest' },
        { label: '交易记录', route: '/trades' },
        { label: '持仓管理', route: '/positions' },
        { label: '组合分析', route: '/portfolio' },
        { label: '', divider: true },
        { label: '数据管理', route: '/data' },
        { label: '', divider: true },
        { label: '市场情绪', route: '/sentiment' },
        { label: '新闻舆情', route: '/news' },
        { label: '智能投顾', route: '/advisor' },
        { label: '', divider: true },
        { label: '衍生品', route: '/derivatives' },
      ],
    },
    {
      label: '帮助',
      children: [
        { label: '查询合约', action: () => actions.ui.toggleDialog('contract') },
        { label: '全局设置', action: () => actions.ui.toggleDialog('global') },
        { label: '', divider: true },
        { label: '关于系统', action: () => actions.ui.toggleDialog('about') },
      ],
    },
  ];

  const toggleMenu = (label: string) => {
    setActiveMenu(activeMenu() === label ? null : label);
  };

  const handleMenuClick = (item: MenuChildItem) => {
    if (item.route) {
      navigate(item.route);  // 使用SolidJS Router的navigate
    }
    if (item.action) {
      item.action();
    }
    setActiveMenu(null);
  };

  const closeMenu = () => setActiveMenu(null);

  const renderMenuItems = (children: MenuChildItem[]) => {
    return (
      <For each={children}>
        {(item) => {
          if (item.divider) {
            return <div class="border-t border-white/10 my-1" />;
          }
          return (
            <button
              class="w-full px-4 py-1.5 text-sm text-left hover:bg-white/10"
              onClick={() => handleMenuClick(item)}
            >
              {item.label}
            </button>
          );
        }}
      </For>
    );
  };

  return (
    <div class="h-10 bg-[#111827] border-b border-white/10 flex items-center px-4 relative z-50">
      {/* Logo */}
      <div class="flex items-center gap-2 mr-6">
        <span class="text-lg">📊</span>
        <span class="font-bold text-white">VeighNa Web</span>
      </div>

      {/* Menu Items */}
      <div class="flex items-center gap-1">
        <For each={menus}>
          {(menu) => (
            <div class="relative">
              <button
                class={`px-3 py-1.5 text-sm rounded hover:bg-white/10 ${
                  activeMenu() === menu.label ? 'bg-white/10' : ''
                }`}
                onClick={() => toggleMenu(menu.label)}
                onMouseEnter={() => activeMenu() && setActiveMenu(menu.label)}
              >
                {menu.label}
              </button>

              <Show when={activeMenu() === menu.label && menu.children}>
                <div class="absolute top-full left-0 mt-1 min-w-40 bg-[#1f2937] border border-white/10 rounded shadow-lg py-1 z-50">
                  {renderMenuItems(menu.children!)}
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>

      {/* Spacer */}
      <div class="flex-1" />

      {/* Right Side */}
      <div class="flex items-center gap-4">
        <LangToggle />
        <TimeDisplay />
        <ConnectionStatus />
      </div>

      {/* Click outside to close menu */}
      <Show when={activeMenu()}>
        <div class="fixed inset-0 z-40" onClick={closeMenu} />
      </Show>

      {/* Connect Dialog */}
      <Show when={state.ui.showConnectDialog}>
        <ConnectDialog />
      </Show>
      <Show when={state.ui.showGlobalDialog}>
        <GlobalDialog />
      </Show>
      <Show when={state.ui.showContractManager}>
        <ContractManager />
      </Show>
      {/* AboutDialog is rendered in App.tsx */}
    </div>
  );
};

const TimeDisplay: Component = () => {
  const [time, setTime] = createSignal(new Date().toLocaleTimeString('zh-CN', { hour12: false }));

  if (typeof window !== 'undefined') {
    setInterval(() => {
      setTime(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
    }, 1000);
  }

  return <span class="text-sm text-gray-400 tabular-nums">{time()}</span>;
};

const LangToggle: Component = () => {
  const { locale, setLocale } = useI18n();
  const toggle = () => setLocale(locale() === 'zh' ? 'en' : 'zh');
  return (
    <button
      class="flex items-center gap-1 px-2 py-1 rounded text-sm hover:bg-white/10 min-h-[44px] min-w-[44px] justify-center"
      onClick={toggle}
      title={locale() === 'zh' ? 'Switch to English' : '切换到中文'}
    >
      <span>🌐</span>
      <span class="text-xs text-gray-400 hidden sm:inline">{locale() === 'zh' ? 'EN' : '中文'}</span>
    </button>
  );
};

const ConnectionStatus: Component = () => {
  const wsStatus = () => state.connection.wsStatus;
  const gatewayCount = () => Object.values(state.connection.gateways).filter(g => g.connected).length;

  const statusConfig = () => {
    switch (wsStatus()) {
      case 'connected':
        return { color: 'bg-green-500', text: `已连接(${gatewayCount()})`, textColor: 'text-green-400' };
      case 'reconnecting':
        return { color: 'bg-yellow-500 animate-pulse', text: '重连中...', textColor: 'text-yellow-400' };
      default:
        return { color: 'bg-red-500', text: '未连接', textColor: 'text-gray-400' };
    }
  };

  return (
    <div class="flex items-center gap-2" title={`WebSocket: ${wsStatus()}`}>
      <div class={`w-2 h-2 rounded-full ${statusConfig().color}`} />
      <span class={`text-sm ${statusConfig().textColor}`}>{statusConfig().text}</span>
    </div>
  );
};


