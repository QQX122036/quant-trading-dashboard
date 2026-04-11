import { Component, createSignal, createEffect, onCleanup, Show, For } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { state, actions } from '../../stores';
import { authActions } from '../../stores/authStore';
import { logger } from '../../lib/logger';
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
  const [mobileMenuOpen, setMobileMenuOpen] = createSignal(false);
  const [isMobile, setIsMobile] = createSignal(false);
  const navigate = useNavigate();

  // Responsive check
  createEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    onCleanup(() => window.removeEventListener('resize', checkMobile));
  });

  const menus: MenuItem[] = [
    {
      label: '系统',
      children: [
        { label: '连接网关', action: () => actions.ui.toggleDialog('connect') },
        { label: '断开网关', action: () => logger.info('断开网关 clicked') },
        { label: '', divider: true },
        {
          label: '退出登录',
          action: () => {
            authActions.logout();
            navigate('/login');
          },
        },
      ],
    },
    {
      label: '功能',
      children: [
        { label: '市场总览', route: '/market' },
        { label: 'A股看板', route: '/dashboard' },
        { label: '回测分析', route: '/backtest' },
        { label: '多因子策略', route: '/multistrategy' },
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
        { label: '风险预警', route: '/risk' },
        { label: '衍生品', route: '/derivatives' },
      ],
    },
    {
      label: '帮助',
      children: [
        { label: '查询合约', action: () => actions.ui.toggleDialog('contract') },
        { label: '全局设置', action: () => actions.ui.toggleDialog('global') },
        { label: '用户设置', route: '/settings' },
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
      navigate(item.route); // 使用SolidJS Router的navigate
    }
    if (item.action) {
      item.action();
    }
    setActiveMenu(null);
  };

  const closeMenu = () => {
    setActiveMenu(null);
    setMobileMenuOpen(false);
  };

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
              role="menuitem"
              tabIndex={0}
            >
              {item.label}
            </button>
          );
        }}
      </For>
    );
  };

  return (
    <nav
      class="h-10 bg-[#111827] border-b border-white/10 flex items-center px-2 md:px-4 relative z-50"
      role="navigation"
      aria-label="主导航"
    >
      {/* Mobile: Hamburger Menu */}
      <Show when={isMobile()}>
        <button
          class="flex flex-col justify-center items-center w-10 h-10 gap-[5px] hover:bg-white/10 rounded"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen())}
          aria-label={mobileMenuOpen() ? '关闭菜单' : '打开菜单'}
          aria-expanded={mobileMenuOpen()}
          aria-controls="mobile-menu"
        >
          <span
            class={`w-5 h-0.5 bg-white rounded transition-all duration-200 ease-out origin-center ${mobileMenuOpen() ? 'rotate-45 translate-y-[5px]' : ''}`}
            aria-hidden="true"
          />
          <span
            class={`w-5 h-0.5 bg-white rounded transition-all duration-200 ease-out origin-center ${mobileMenuOpen() ? 'opacity-0 scale-50' : ''}`}
            aria-hidden="true"
          />
          <span
            class={`w-5 h-0.5 bg-white rounded transition-all duration-200 ease-out origin-center ${mobileMenuOpen() ? '-rotate-45 -translate-y-[5px]' : ''}`}
            aria-hidden="true"
          />
        </button>
      </Show>

      {/* Logo */}
      <div class="flex items-center gap-2 mr-4 md:mr-6">
        <span class="text-lg">📊</span>
        <span class="font-bold text-white text-sm md:text-base">VeighNa Web</span>
      </div>

      {/* Desktop: Menu Items */}
      <Show when={!isMobile()}>
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
                  aria-haspopup="true"
                  aria-expanded={activeMenu() === menu.label && !!menu.children}
                  aria-label={`${menu.label}菜单`}
                >
                  {menu.label}
                </button>

                <Show when={activeMenu() === menu.label && menu.children}>
                  <div
                    class="absolute top-full left-0 mt-1 min-w-40 bg-[#1f2937] border border-white/10 rounded shadow-lg py-1 z-50"
                    role="menu"
                    aria-label={`${menu.label}子菜单`}
                  >
                    {renderMenuItems(menu.children!)}
                  </div>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Spacer - desktop only */}
      <Show when={!isMobile()}>
        <div class="flex-1" />
      </Show>

      {/* Right Side */}
      <div class="flex items-center gap-2 md:gap-4 ml-auto">
        <Show when={!isMobile()}>
          <TimeDisplay />
        </Show>
        <LangToggle />
        <Show when={!isMobile()}>
          <ConnectionStatus />
        </Show>
      </div>

      {/* Mobile: Full-screen menu overlay */}
      <Show when={isMobile() && mobileMenuOpen()}>
        <div
          id="mobile-menu"
          class="fixed inset-0 top-10 bg-[#111827]/98 z-40 flex flex-col p-4 overflow-y-auto"
          style={{ animation: 'slideDown 0.25s ease-out' }}
          onClick={closeMenu}
          role="dialog"
          aria-label="移动端导航菜单"
        >
          <For each={menus}>
            {(menu) => (
              <div class="border-b border-white/10 py-2">
                <div class="text-sm font-bold text-gray-400 py-2">{menu.label}</div>
                <For each={menu.children}>
                  {(item) => {
                    if (item.divider) return <div class="border-t border-white/10 my-1" />;
                    return (
                      <button
                        class="w-full px-2 py-2 text-sm text-left hover:bg-white/10 rounded"
                        onClick={() => handleMenuClick(item)}
                      >
                        {item.label}
                      </button>
                    );
                  }}
                </For>
              </div>
            )}
          </For>
          {/* Mobile connection status */}
          <div class="mt-4 pt-4 border-t border-white/10">
            <ConnectionStatus />
          </div>
        </div>
      </Show>

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
    </nav>
  );
};

const TimeDisplay: Component = () => {
  const [time, setTime] = createSignal(new Date().toLocaleTimeString('zh-CN', { hour12: false }));

  createEffect(() => {
    const id = setInterval(() => {
      setTime(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
    }, 1000);
    return () => clearInterval(id);
  });

  return (
    <span
      class="text-sm text-gray-400 tabular-nums"
      aria-live="off"
      aria-atomic="true"
      aria-label={`当前时间 ${time()}`}
    >
      {time()}
    </span>
  );
};

const LangToggle: Component = () => {
  const { locale, setLocale } = useI18n();
  const toggle = () => setLocale(locale() === 'zh' ? 'en' : 'zh');
  return (
    <button
      class="flex items-center gap-1 px-2 py-1 rounded text-sm hover:bg-white/10 min-h-[44px] min-w-[44px] justify-center"
      onClick={toggle}
      title={locale() === 'zh' ? 'Switch to English' : '切换到中文'}
      aria-label={locale() === 'zh' ? '切换到英文' : '切换到中文'}
    >
      <span aria-hidden="true">🌐</span>
      <span class="text-xs text-gray-400 hidden sm:inline">
        {locale() === 'zh' ? 'EN' : '中文'}
      </span>
    </button>
  );
};

const ConnectionStatus: Component = () => {
  const wsStatus = () => state.connection.wsStatus;
  const gatewayCount = () =>
    Object.values(state.connection.gateways).filter((g) => g.connected).length;

  const statusConfig = () => {
    switch (wsStatus()) {
      case 'connected':
        return {
          color: 'bg-green-500',
          text: `已连接(${gatewayCount()})`,
          textColor: 'text-green-400',
        };
      case 'reconnecting':
        return {
          color: 'bg-yellow-500 animate-pulse',
          text: '重连中...',
          textColor: 'text-yellow-400',
        };
      default:
        return { color: 'bg-red-500', text: '未连接', textColor: 'text-gray-400' };
    }
  };

  return (
    <div
      class="flex items-center gap-2"
      aria-label={`WebSocket状态: ${statusConfig().text}`}
      role="status"
    >
      <div class={`w-2 h-2 rounded-full ${statusConfig().color}`} aria-hidden="true" />
      <span class={`text-sm ${statusConfig().textColor}`}>{statusConfig().text}</span>
    </div>
  );
};
