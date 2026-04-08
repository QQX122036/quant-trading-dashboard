import { Component, createSignal, For } from 'solid-js';
import { actions } from '../../stores';

// SIM参数默认值
const DEFAULT_SIM = {
  slippage: 0.0,
  commissionRatio: 0.0003,
};

// 风控参数默认值
const DEFAULT_RISK = {
  maxPosition: 5,
  maxDailyLoss: 10000,
};

// 本地存储键名
const SETTINGS_KEY = 'app_settings';

// 保存设置到本地存储
function saveSettingsLocal(settings: Record<string, unknown>) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

export const GlobalDialog: Component = () => {
  const [simSlippage, setSimSlippage] = createSignal(DEFAULT_SIM.slippage);
  const [simCommission, setSimCommission] = createSignal(DEFAULT_SIM.commissionRatio);
  const [maxPosition, setMaxPosition] = createSignal(DEFAULT_RISK.maxPosition);
  const [maxDailyLoss, setMaxDailyLoss] = createSignal(DEFAULT_RISK.maxDailyLoss);
  const [theme, setTheme] = createSignal<'dark' | 'light'>('dark');
  const [saving, setSaving] = createSignal(false);
  const [msg, setMsg] = createSignal('');

  function close() {
    actions.ui.toggleDialog('global');
    setMsg('');
  }

  async function handleSave() {
    setSaving(true);
    setMsg('');
    try {
      const settings = {
        theme: theme(),
        simSlippage: simSlippage(),
        simCommission: simCommission(),
        maxPosition: maxPosition(),
        maxDailyLoss: maxDailyLoss(),
      };

      if (saveSettingsLocal(settings)) {
        document.documentElement.setAttribute('data-theme', theme());
        setMsg('✅ 设置已保存');
        setTimeout(close, 800);
      } else {
        setMsg('❌ 保存失败');
      }
    } catch (e) {
      setMsg('❌ 保存失败: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div class="dialog-overlay" onClick={(e) => e.target === e.currentTarget && close()}>
      <div class="dialog-panel">
        <div class="dialog-header">
          <span class="text-sm font-bold text-[var(--text-primary)]">⚙️ 全局设置</span>
          <button
            class="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-lg leading-none"
            onClick={close}
          >
            ×
          </button>
        </div>

        <div class="dialog-body space-y-6">
          {/* ── SIM 参数 ── */}
          <section>
            <h3 class="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
              SIM 参数
            </h3>
            <div class="grid grid-cols-2 gap-4">
              <div class="form-group">
                <label class="form-label">滑点 (tick)</label>
                <input
                  class="form-input"
                  type="number"
                  min="0"
                  step="1"
                  value={simSlippage()}
                  onInput={(e) => setSimSlippage(parseFloat(e.currentTarget.value) || 0)}
                />
              </div>
              <div class="form-group">
                <label class="form-label">成交比例 (%)</label>
                <input
                  class="form-input"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={(simCommission() * 100).toFixed(2)}
                  onInput={(e) => setSimCommission(parseFloat(e.currentTarget.value) / 100 || 0)}
                />
              </div>
            </div>
          </section>

          {/* ── 风控参数 ── */}
          <section>
            <h3 class="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
              风控参数
            </h3>
            <div class="grid grid-cols-2 gap-4">
              <div class="form-group">
                <label class="form-label">最大仓位 (手)</label>
                <input
                  class="form-input"
                  type="number"
                  min="1"
                  step="1"
                  value={maxPosition()}
                  onInput={(e) => setMaxPosition(parseInt(e.currentTarget.value) || 1)}
                />
              </div>
              <div class="form-group">
                <label class="form-label">单日最大亏损 (元)</label>
                <input
                  class="form-input"
                  type="number"
                  min="0"
                  step="1000"
                  value={maxDailyLoss()}
                  onInput={(e) => setMaxDailyLoss(parseFloat(e.currentTarget.value) || 0)}
                />
              </div>
            </div>
          </section>

          {/* ── 界面主题 ── */}
          <section>
            <h3 class="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
              界面主题
            </h3>
            <div class="flex gap-3">
              <For each={['dark', 'light'] as const}>
                {(t) => (
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="theme"
                      value={t}
                      checked={theme() === t}
                      onChange={() => setTheme(t)}
                      class="accent-[var(--border-focus)]"
                    />
                    <span
                      class={`text-sm ${theme() === t ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}
                    >
                      {t === 'dark' ? '🌙 深色' : '☀️ 浅色'}
                    </span>
                  </label>
                )}
              </For>
            </div>
          </section>

          {msg() && (
            <div
              class={`text-sm px-3 py-2 rounded ${msg().startsWith('✅') ? 'text-[var(--color-pnl-pos)]' : 'text-[var(--color-pnl-neg)]'}`}
            >
              {msg()}
            </div>
          )}
        </div>

        <div class="dialog-footer">
          <button class="btn btn-secondary" onClick={close}>
            取消
          </button>
          <button class="btn btn-primary" onClick={handleSave} disabled={saving()}>
            {saving() ? '保存中…' : '保存设置'}
          </button>
        </div>
      </div>
    </div>
  );
};
