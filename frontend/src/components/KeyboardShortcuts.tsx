/**
 * KeyboardShortcuts.tsx — 全局键盘快捷键
 * 使用 useEffect 监听 keydown，映射到对应动作
 */
import { Component, onMount, onCleanup, createSignal, Show, For } from 'solid-js';
import { state, actions } from '../stores';

interface ShortcutItem {
  key: string;
  label: string;
  action: string;
}

const SHORTCUTS: ShortcutItem[] = [
  { key: 'Ctrl+B', label: '打开交易面板', action: 'focusTrading' },
  { key: 'Ctrl+C', label: '聚焦撤单', action: 'focusCancel' },
  { key: 'Ctrl+D', label: '全局设置', action: 'openSettings' },
  { key: 'Ctrl+K', label: '聚焦K线搜索', action: 'focusKlineSearch' },
  { key: 'Ctrl+?', label: '显示快捷键面板', action: 'toggleHelp' },
  { key: 'Esc', label: '关闭弹窗', action: 'closeDialog' },
];

export const KeyboardShortcuts: Component = () => {
  const [showHelp, setShowHelp] = createSignal(false);

  function openGlobalDialog() {
    actions.ui.toggleDialog('global');
  }

  function closeAllDialogs() {
    if (state.ui.showAboutDialog) actions.ui.toggleDialog('about');
    if (state.ui.showGlobalDialog) actions.ui.toggleDialog('global');
    if (state.ui.showConnectDialog) actions.ui.toggleDialog('connect');
    if (state.ui.showContractManager) actions.ui.toggleDialog('contract');
    setShowHelp(false);
  }

  function focusTrading() {
    const el = document.querySelector('[data-shortcut="trading-widget"]') as HTMLElement;
    if (el) el.focus();
  }

  function focusCancel() {
    const el = document.querySelector('[data-shortcut="cancel-btn"]') as HTMLElement;
    if (el) el.focus();
  }

  function focusKlineSearch() {
    const el = document.querySelector('[data-shortcut="kline-search"]') as HTMLInputElement;
    if (el) el.focus();
  }

  function handleKeyDown(e: KeyboardEvent) {
    const ctrl = e.ctrlKey || e.metaKey;
    const key = e.key;

    // Ctrl+? or Ctrl+/ -> toggle help
    if (ctrl && (key === '?' || key === '/')) {
      e.preventDefault();
      setShowHelp((prev) => !prev);
      return;
    }

    // Esc -> close dialogs or help
    if (key === 'Escape') {
      if (showHelp()) {
        setShowHelp(false);
        return;
      }
      e.preventDefault();
      closeAllDialogs();
      return;
    }

    if (!ctrl) return;

    switch (key) {
      case 'B':
      case 'b':
        e.preventDefault();
        focusTrading();
        break;
      case 'C':
      case 'c':
        e.preventDefault();
        focusCancel();
        break;
      case 'D':
      case 'd':
        e.preventDefault();
        openGlobalDialog();
        break;
      case 'K':
      case 'k':
        e.preventDefault();
        focusKlineSearch();
        break;
    }
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <>
      {/* Help Panel */}
      <Show when={showHelp()}>
        <div
          class="fixed inset-0 z-[200] flex items-center justify-center bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowHelp(false);
          }}
        >
          <div class="bg-[#1f2937] border border-white/10 rounded-xl shadow-2xl w-96 overflow-hidden">
            <div class="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 class="text-sm font-bold text-[var(--text-primary)]">⌨️ 键盘快捷键</h3>
              <button
                class="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-lg leading-none"
                onClick={() => setShowHelp(false)}
              >
                ×
              </button>
            </div>
            <div class="p-4 space-y-1">
              <For each={SHORTCUTS}>
                {(s) => (
                  <div class="flex items-center justify-between py-1.5">
                    <span class="text-sm text-[var(--text-secondary)]">{s.label}</span>
                    <kbd class="px-2 py-0.5 bg-[#111827] border border-white/20 rounded text-xs font-mono text-[var(--text-primary)]">
                      {s.key}
                    </kbd>
                  </div>
                )}
              </For>
            </div>
            <div class="px-5 py-3 border-t border-white/10 text-xs text-[var(--text-muted)] text-center">
              按 Esc 关闭此面板
            </div>
          </div>
        </div>
      </Show>
    </>
  );
};
