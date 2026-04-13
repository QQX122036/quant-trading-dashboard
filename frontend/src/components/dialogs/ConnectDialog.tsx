import { Component, onMount, onCleanup } from 'solid-js';
import { actions } from '../../stores';

export const ConnectDialog: Component = () => {
  let dialogRef: HTMLDivElement | undefined;
  let firstFocusableRef: HTMLButtonElement | HTMLInputElement | undefined;
  let _lastFocusableRef: HTMLButtonElement | undefined;

  onMount(() => {
    // Focus trap: store first and last focusable elements
    const focusableSelectors =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusableEls = dialogRef?.querySelectorAll<HTMLElement>(focusableSelectors);
    firstFocusableRef = focusableEls?.[0] as HTMLButtonElement | HTMLInputElement;
    _lastFocusableRef = focusableEls?.[focusableEls.length - 1] as HTMLButtonElement;

    // Focus the first interactive element
    firstFocusableRef?.focus();

    // Prevent background scroll
    document.body.style.overflow = 'hidden';
  });

  onCleanup(() => {
    document.body.style.overflow = '';
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      actions.ui.toggleDialog('connect');
      return;
    }
    // Focus trap: Tab cycles within dialog
    if (e.key === 'Tab') {
      const focusableSelectors =
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
      const focusableEls = Array.from(
        dialogRef?.querySelectorAll<HTMLElement>(focusableSelectors) || []
      );
      if (focusableEls.length === 0) return;

      const first = focusableEls[0];
      const last = focusableEls[focusableEls.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };

  return (
    <div
      class="dialog-overlay"
      onClick={(e) => e.target === e.currentTarget && actions.ui.toggleDialog('connect')}
      role="dialog"
      aria-modal="true"
      aria-labelledby="connect-dialog-title"
      onKeyDown={handleKeyDown}
    >
      <div class="dialog-panel" role="document" ref={dialogRef}>
        <div class="dialog-header">
          <span id="connect-dialog-title" class="text-sm font-bold text-[var(--text-primary)]">
            连接网关
          </span>
          <button
            class="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-lg leading-none"
            onClick={() => actions.ui.toggleDialog('connect')}
            aria-label="关闭对话框"
          >
            ×
          </button>
        </div>
        <div class="dialog-body space-y-4">
          <div class="form-group">
            <label class="form-label" for="gateway-type">
              网关类型
            </label>
            <select id="gateway-type" class="form-input">
              <option value="DUCKDB_SIM">DUCKDB_SIM — 模拟交易</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="gateway-name">
              网关名称
            </label>
            <input
              id="gateway-name"
              class="form-input"
              type="text"
              placeholder="DUCKDB_SIM"
              aria-placeholder="DUCKDB_SIM"
            />
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn btn-secondary" onClick={() => actions.ui.toggleDialog('connect')}>
            取消
          </button>
          <button class="btn btn-primary">连接</button>
        </div>
      </div>
    </div>
  );
};
