import { Component, For, createSignal, onMount, Show } from 'solid-js';
import {
  fetchStrategies,
  startStrategy,
  stopStrategy,
  deleteStrategy,
  updateStrategy,
  StrategyItem,
} from '../../hooks/useApi';
import { logger } from '../../lib/logger';
import { formatPrice } from '../../utils/format';
import { pnlColor } from '../../utils/color';

// ── Helpers ────────────────────────────────────────────────

function formatDuration(seconds?: number): string {
  if (!seconds) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ── Edit Dialog ────────────────────────────────────────────

interface EditDialogProps {
  strategy: StrategyItem;
  onConfirm: (data: { strategy_type: string; params: Record<string, unknown> }) => void;
  onClose: () => void;
}

const EditDialog: Component<EditDialogProps> = (props) => {
  const [strategyType, setStrategyType] = createSignal(props.strategy.strategy_type);
  const [paramsJson, setParamsJson] = createSignal(
    JSON.stringify(props.strategy.params ?? {}, null, 2)
  );
  const [error, setError] = createSignal('');

  const handleConfirm = () => {
    try {
      const params = JSON.parse(paramsJson());
      if (typeof params !== 'object' || Array.isArray(params)) {
        setError('params 必须是 JSON 对象');
        return;
      }
      props.onConfirm({ strategy_type: strategyType(), params });
    } catch {
      setError('JSON 格式错误，请检查语法');
    }
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div class="bg-[#1a2035] rounded-xl border border-white/10 w-[520px] max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div class="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h3 class="text-base font-semibold text-white">编辑策略参数</h3>
          <button
            class="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-[var(--text-muted)]"
            onClick={props.onClose}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div class="flex-1 overflow-auto px-5 py-4 space-y-4">
          <div>
            <label class="block text-xs text-[var(--text-muted)] mb-1.5">策略名称</label>
            <div class="text-sm text-[var(--text-secondary)] px-3 py-2 bg-white/5 rounded border border-white/10">
              {props.strategy.name}
            </div>
          </div>

          <div>
            <label class="block text-xs text-[var(--text-muted)] mb-1.5">策略类型</label>
            <input
              type="text"
              value={strategyType()}
              onInput={(e) => setStrategyType(e.currentTarget.value)}
              class="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-[var(--text-muted)] focus:outline-none focus:border-[#6366f1]"
              placeholder="例如: DualThrust, RBreak"
            />
          </div>

          <div>
            <label class="block text-xs text-[var(--text-muted)] mb-1.5">策略参数 (JSON)</label>
            <textarea
              value={paramsJson()}
              onInput={(e) => setParamsJson(e.currentTarget.value)}
              rows={12}
              class="w-full bg-[#0d1020] border border-white/10 rounded px-3 py-2 text-xs text-[var(--text-secondary)] font-mono focus:outline-none focus:border-[#6366f1] resize-none leading-relaxed"
              placeholder='{"window": 20, "multiplier": 2.0}'
            />
          </div>

          <Show when={error()}>
            <div class="text-xs text-red-400 bg-red-400/10 rounded px-3 py-2">{error()}</div>
          </Show>
        </div>

        {/* Footer */}
        <div class="flex items-center justify-end gap-3 px-5 py-4 border-t border-white/10">
          <button
            class="px-4 py-2 text-sm rounded bg-white/10 hover:bg-white/20 text-[var(--text-secondary)]"
            onClick={props.onClose}
          >
            取消
          </button>
          <button
            class="px-4 py-2 text-sm rounded bg-[#6366f1] hover:bg-[#5254cc] text-white font-medium"
            onClick={handleConfirm}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────

const COLUMNS = [
  { field: 'name', header: '策略名称', width: 140 },
  { field: 'strategy_type', header: '类型', width: 100 },
  { field: 'status', header: '状态', width: 80 },
  { field: 'running_time', header: '运行时长', width: 90 },
  { field: 'pnl', header: '累计盈亏', width: 100 },
];

export const StrategyManager: Component = () => {
  const [strategies, setStrategies] = createSignal<StrategyItem[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [editingStrategy, setEditingStrategy] = createSignal<StrategyItem | null>(null);
  const [actionLoading, setActionLoading] = createSignal<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchStrategies();
      if (res.code === '0' && res.data?.strategies) {
        setStrategies(res.data.strategies);
      }
    } catch (e) {
      logger.warn('[StrategyManager] fetchStrategies error', { error: e });
    } finally {
      setLoading(false);
    }
  };

  onMount(load);

  const handleStart = async (id: string) => {
    setActionLoading(id);
    try {
      await startStrategy(id);
      await load();
    } catch (e) {
      logger.warn('[StrategyManager] startStrategy error', { error: e });
    } finally {
      setActionLoading(null);
    }
  };

  const handleStop = async (id: string) => {
    setActionLoading(id);
    try {
      await stopStrategy(id);
      await load();
    } catch (e) {
      logger.warn('[StrategyManager] stopStrategy error', { error: e });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除该策略吗？')) return;
    setActionLoading(id);
    try {
      await deleteStrategy(id);
      await load();
    } catch (e) {
      logger.warn('[StrategyManager] deleteStrategy error', { error: e });
    } finally {
      setActionLoading(null);
    }
  };

  const handleEditConfirm = async (data: {
    strategy_type: string;
    params: Record<string, unknown>;
  }) => {
    const s = editingStrategy();
    if (!s) return;
    try {
      await updateStrategy(s.id, data);
      setEditingStrategy(null);
      await load();
    } catch (e) {
      logger.warn('[StrategyManager] updateStrategy error', { error: e });
    }
  };

  return (
    <div class="h-full flex flex-col p-4 gap-4">
      {/* Header */}
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold">策略管理</h2>
        <button
          class="px-4 py-2 text-sm rounded bg-[#6366f1] hover:bg-[#5254cc] text-white font-medium"
          onClick={load}
          disabled={loading()}
        >
          {loading() ? '刷新中...' : '刷新'}
        </button>
      </div>

      {/* Strategy Table */}
      <div class="flex-1 bg-[#111827]/80 rounded-lg border border-white/10 overflow-hidden">
        <div class="h-full overflow-auto">
          <table class="w-full border-collapse text-xs">
            <thead class="sticky top-0 z-10 bg-[var(--bg-tertiary)]">
              <tr>
                <For each={COLUMNS}>
                  {(col) => (
                    <th
                      class="px-2 py-2.5 text-[var(--text-muted)] font-normal border-b border-[var(--border-color)] whitespace-nowrap"
                      style={{ width: col.width ? `${col.width}px` : undefined }}
                    >
                      {col.header}
                    </th>
                  )}
                </For>
                <th class="px-2 py-2.5 text-[var(--text-muted)] font-normal border-b border-[var(--border-color)]">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              <For
                each={strategies()}
                fallback={
                  <tr>
                    <td
                      colspan={COLUMNS.length + 1}
                      class="text-center py-12 text-[var(--text-muted)]"
                    >
                      {loading() ? '加载中...' : '暂无策略'}
                    </td>
                  </tr>
                }
              >
                {(strategy) => (
                  <tr class="border-b border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition-colors">
                    <For each={COLUMNS}>
                      {(col) => {
                        const val = (strategy as unknown as Record<string, unknown>)[col.field];
                        if (col.field === 'status') {
                          return (
                            <td class="px-2 py-2.5">
                              <span
                                class={`inline-flex items-center gap-1.5 text-xs ${
                                  val === 'running'
                                    ? 'text-green-400'
                                    : val === 'error'
                                      ? 'text-red-400'
                                      : 'text-[var(--text-muted)]'
                                }`}
                              >
                                <span
                                  class={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                    val === 'running'
                                      ? 'bg-green-400 animate-pulse'
                                      : val === 'error'
                                        ? 'bg-red-400'
                                        : 'bg-gray-500'
                                  }`}
                                />
                                {val === 'running' ? '运行中' : val === 'error' ? '错误' : '已停止'}
                              </span>
                            </td>
                          );
                        }
                        if (col.field === 'running_time') {
                          return (
                            <td class="px-2 py-2.5 text-xs text-[var(--text-secondary)]">
                              {formatDuration(val as number)}
                            </td>
                          );
                        }
                        if (col.field === 'pnl') {
                          const pnl = val as number;
                          return (
                            <td
                              class={`px-2 py-2.5 text-xs font-mono tabular-nums ${pnlColor(pnl)}`}
                            >
                              {pnl >= 0 ? '+' : ''}
                              {formatPrice(pnl)}
                            </td>
                          );
                        }
                        return (
                          <td class="px-2 py-2.5 text-xs text-[var(--text-secondary)]">
                            {String(val ?? '-')}
                          </td>
                        );
                      }}
                    </For>
                    {/* Actions */}
                    <td class="px-2 py-2.5">
                      <div class="flex items-center gap-2">
                        <Show when={strategy.status === 'running'}>
                          <button
                            class="px-2 py-1 text-xs rounded bg-orange-500/20 hover:bg-orange-500/30 text-orange-400"
                            onClick={() => handleStop(strategy.id)}
                            disabled={actionLoading() === strategy.id}
                          >
                            {actionLoading() === strategy.id ? '停盘中...' : '停止'}
                          </button>
                        </Show>
                        <Show when={strategy.status !== 'running'}>
                          <button
                            class="px-2 py-1 text-xs rounded bg-green-500/20 hover:bg-green-500/30 text-green-400"
                            onClick={() => handleStart(strategy.id)}
                            disabled={actionLoading() === strategy.id}
                          >
                            {actionLoading() === strategy.id ? '启动中...' : '启动'}
                          </button>
                        </Show>
                        <button
                          class="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20 text-[var(--text-secondary)]"
                          onClick={() => setEditingStrategy(strategy)}
                        >
                          编辑
                        </button>
                        <button
                          class="px-2 py-1 text-xs rounded hover:bg-red-500/20 text-red-400"
                          onClick={() => handleDelete(strategy.id)}
                          disabled={actionLoading() === strategy.id}
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </div>

      {/* Strategy Logs Panel */}
      <div class="bg-[#111827]/80 rounded-lg border border-white/10 overflow-hidden">
        <div class="px-3 py-2 border-b border-[var(--border-color)]">
          <h3 class="text-xs font-semibold text-[var(--text-muted)]">最新策略日志</h3>
        </div>
        <div class="h-36 overflow-auto font-mono text-xs">
          <For
            each={strategies()
              .flatMap((s) => (s.logs ?? []).map((log) => ({ ...s, logText: log })))
              .slice(-5)}
            fallback={
              <div class="flex items-center justify-center h-full text-[var(--text-muted)]">
                暂无日志
              </div>
            }
          >
            {(item) => (
              <div class="flex gap-3 px-3 py-0.5 border-b border-[var(--border-color)]/50 hover:bg-[var(--bg-hover)]">
                <span class="text-[var(--text-muted)] whitespace-nowrap">[{item.name}]</span>
                <span class="text-[var(--text-secondary)]">{item.logText}</span>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* Edit Dialog */}
      <Show when={editingStrategy()}>
        <EditDialog
          strategy={editingStrategy()!}
          onConfirm={handleEditConfirm}
          onClose={() => setEditingStrategy(null)}
        />
      </Show>
    </div>
  );
};
