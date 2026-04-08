/**
 * DataManager.tsx — 数据管理界面
 * 导入/导出CSV数据，查看采集进度
 */
import { Component, createSignal, For, Show } from 'solid-js';
import { importData, fetchCollectionProgress } from '../../hooks/useApi';
import type { CollectionProgress } from '../../hooks/useApi';

type Tab = 'import' | 'export' | 'progress';
type ExportTable = 'daily_bar' | 'positions' | 'orders';
type ImportTable = 'daily_bar' | 'positions' | 'orders';

const IMPORT_OPTIONS: { value: ImportTable; label: string }[] = [
  { value: 'daily_bar', label: '日K数据 (daily_bar)' },
  { value: 'positions', label: '持仓数据 (positions)' },
  { value: 'orders', label: '订单数据 (orders)' },
];

const EXPORT_OPTIONS: { value: ExportTable; label: string }[] = [
  { value: 'daily_bar', label: '日K数据 (daily_bar)' },
  { value: 'positions', label: '持仓数据 (positions)' },
  { value: 'orders', label: '订单数据 (orders)' },
];

export const DataManager: Component = () => {
  const [activeTab, setActiveTab] = createSignal<Tab>('import');

  // ── Import State ────────────────────────────────────────
  const [importTable, setImportTable] = createSignal<ImportTable>('daily_bar');
  const [selectedFile, setSelectedFile] = createSignal<File | null>(null);
  const [importing, setImporting] = createSignal(false);
  const [importMsg, setImportMsg] = createSignal('');

  // ── Export State ────────────────────────────────────────
  const [exportTable, setExportTable] = createSignal<ExportTable>('daily_bar');
  const [exporting, setExporting] = createSignal(false);
  const [exportMsg, setExportMsg] = createSignal('');

  // ── Progress State ──────────────────────────────────────
  const [progress, setProgress] = createSignal<CollectionProgress | null>(null);
  const [progressLoading, setProgressLoading] = createSignal(false);

  // ── Load Progress ───────────────────────────────────────
  async function loadProgress() {
    setProgressLoading(true);
    try {
      const res = await fetchCollectionProgress();
      if (res.code === '0' && res.data) {
        setProgress(res.data);
      } else {
        // 后端暂无此接口时显示空状态
        setProgress({
          total_stocks: 0,
          collected_stocks: 0,
          progress_pct: 0,
          status: 'idle',
          last_updated: '',
          message: '采集服务暂无数据',
        });
      }
    } catch {
      setProgress({
        total_stocks: 0,
        collected_stocks: 0,
        progress_pct: 0,
        status: 'idle',
        last_updated: '',
        message: '无法获取采集进度',
      });
    } finally {
      setProgressLoading(false);
    }
  }

  // ── Import Handler ──────────────────────────────────────
  function handleFileChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    if (input.files && input.files[0]) {
      setSelectedFile(input.files[0]);
      setImportMsg('');
    }
  }

  async function handleImport() {
    const file = selectedFile();
    if (!file) {
      setImportMsg('❌ 请先选择文件');
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv' && ext !== 'xlsx' && ext !== 'xls') {
      setImportMsg('❌ 仅支持 CSV 或 Excel 文件');
      return;
    }

    setImporting(true);
    setImportMsg('');
    try {
      const res = await importData(importTable(), file);
      if (res.code === '0' && res.data?.success) {
        setImportMsg(`✅ 成功导入 ${res.data.rows_imported} 行 → ${res.data.table_name}`);
        setSelectedFile(null);
        // Reset file input
        const input = document.getElementById('file-input') as HTMLInputElement;
        if (input) input.value = '';
      } else {
        setImportMsg(`❌ ${res.message || '导入失败'}`);
      }
    } catch (e: unknown) {
      setImportMsg(`❌ 导入异常: ${String(e)}`);
    } finally {
      setImporting(false);
    }
  }

  // ── Export Handler ──────────────────────────────────────
  async function handleExport() {
    setExporting(true);
    setExportMsg('');
    try {
      // 后端 /api/data/export?table=xxx&format=csv 返回 CSV 文件流
      const table = exportTable();
      const url = `/api/data/export?table=${encodeURIComponent(table)}&format=csv&limit=100000`;
      // 直接打开下载窗口
      window.open(url, '_blank');
      setExportMsg(`✅ 已发起导出请求: ${table}`);
    } catch (e: unknown) {
      setExportMsg(`❌ 导出异常: ${String(e)}`);
    } finally {
      setExporting(false);
    }
  }

  // ── Progress Bar Color ──────────────────────────────────
  function progressColor(pct: number): string {
    if (pct >= 80) return 'bg-green-500';
    if (pct >= 50) return 'bg-blue-500';
    if (pct >= 20) return 'bg-yellow-500';
    return 'bg-red-500';
  }

  function statusLabel(status: CollectionProgress['status']): string {
    return { idle: '空闲', running: '采集中', paused: '已暂停', error: '异常' }[status] ?? status;
  }

  return (
    <div class="h-full p-4 flex flex-col gap-4">
      {/* Page Title */}
      <div class="flex items-center gap-3">
        <span class="text-xl">📁</span>
        <h2 class="text-lg font-bold text-[var(--text-primary)]">数据管理</h2>
      </div>

      {/* Tab Bar */}
      <div class="flex gap-1 border-b border-[var(--border-color)]">
        <For each={['import', 'export', 'progress'] as Tab[]}>
          {(tab) => (
            <button
              class={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab() === tab
                  ? 'border-[var(--border-focus)] text-[var(--text-primary)]'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
              onClick={() => {
                setActiveTab(tab);
                if (tab === 'progress') loadProgress();
              }}
            >
              {tab === 'import' ? '📤 导入' : tab === 'export' ? '📥 导出' : '📊 采集进度'}
            </button>
          )}
        </For>
      </div>

      {/* ── Import Tab ────────────────────────────────────── */}
      <Show when={activeTab() === 'import'}>
        <div class="flex-1 flex flex-col gap-4">
          <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4 sm:p-5 space-y-4 w-full">
            <div class="form-group">
              <label class="form-label">目标数据表</label>
              <select
                class="form-input"
                value={importTable()}
                onChange={(e) => setImportTable(e.currentTarget.value as ImportTable)}
              >
                <For each={IMPORT_OPTIONS}>
                  {(opt) => <option value={opt.value}>{opt.label}</option>}
                </For>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">选择文件</label>
              <div
                class="border-2 border-dashed border-[var(--border-color)] rounded-lg p-6 text-center hover:border-[var(--border-focus)] transition-colors cursor-pointer"
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <input
                  id="file-input"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  class="hidden"
                  onChange={handleFileChange}
                />
                <Show when={!selectedFile()}>
                  <div class="text-[var(--text-muted)]">
                    <div class="text-2xl mb-2">📄</div>
                    <div class="text-sm">点击选择 CSV 或 Excel 文件</div>
                    <div class="text-xs mt-1">支持 .csv .xlsx .xls 格式</div>
                  </div>
                </Show>
                <Show when={selectedFile()}>
                  <div class="text-[var(--text-primary)]">
                    <div class="text-2xl mb-2">✅</div>
                    <div class="text-sm font-medium">{selectedFile()!.name}</div>
                    <div class="text-xs text-[var(--text-muted)] mt-1">
                      {(selectedFile()!.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                </Show>
              </div>
            </div>

            <Show when={importMsg()}>
              <div
                class={`text-sm px-3 py-2 rounded ${
                  importMsg().startsWith('✅')
                    ? 'text-green-400 bg-green-500/10'
                    : 'text-red-400 bg-red-500/10'
                }`}
              >
                {importMsg()}
              </div>
            </Show>

            <button
              class="btn btn-primary w-full"
              onClick={handleImport}
              disabled={importing() || !selectedFile()}
            >
              {importing() ? '导入中…' : '开始导入'}
            </button>

            <div class="text-xs text-[var(--text-muted)] space-y-1">
              <p>💡 导入说明：</p>
              <ul class="list-disc list-inside space-y-0.5 ml-2">
                <li>CSV 文件需包含表头行，字段名与数据库一致</li>
                <li>Excel 文件请确保数据在第一个工作表中</li>
                <li>日K数据表字段：ts_code, trade_date, open, high, low, close, volume</li>
              </ul>
            </div>
          </div>
        </div>
      </Show>

      {/* ── Export Tab ────────────────────────────────────── */}
      <Show when={activeTab() === 'export'}>
        <div class="flex-1 flex flex-col gap-4">
          <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4 sm:p-5 space-y-4 w-full">
            <div class="form-group">
              <label class="form-label">选择数据表</label>
              <select
                class="form-input"
                value={exportTable()}
                onChange={(e) => setExportTable(e.currentTarget.value as ExportTable)}
              >
                <For each={EXPORT_OPTIONS}>
                  {(opt) => <option value={opt.value}>{opt.label}</option>}
                </For>
              </select>
            </div>

            <Show when={exportMsg()}>
              <div
                class={`text-sm px-3 py-2 rounded ${
                  exportMsg().startsWith('✅')
                    ? 'text-green-400 bg-green-500/10'
                    : 'text-red-400 bg-red-500/10'
                }`}
              >
                {exportMsg()}
              </div>
            </Show>

            <button class="btn btn-primary w-full" onClick={handleExport} disabled={exporting()}>
              {exporting() ? '导出中…' : '导出 CSV'}
            </button>

            <div class="text-xs text-[var(--text-muted)] space-y-1">
              <p>💡 导出说明：</p>
              <ul class="list-disc list-inside space-y-0.5 ml-2">
                <li>导出格式为 UTF-8 编码的 CSV 文件</li>
                <li>日K数据表：包含所有A股历史日K线数据</li>
                <li>持仓数据表：当前账户持仓明细</li>
                <li>订单数据表：历史委托成交记录</li>
              </ul>
            </div>
          </div>
        </div>
      </Show>

      {/* ── Progress Tab ───────────────────────────────────── */}
      <Show when={activeTab() === 'progress'}>
        <div class="flex-1 flex flex-col gap-4">
          <div class="bg-[#111827]/80 rounded-lg border border-white/10 p-4 sm:p-5 space-y-6 w-full">
            {/* Header */}
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                日K数据采集进度
              </h3>
              <button
                class="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-1 rounded border border-[var(--border-color)] hover:border-[var(--border-focus)] transition-colors"
                onClick={loadProgress}
                disabled={progressLoading()}
              >
                {progressLoading() ? '刷新中…' : '🔄 刷新'}
              </button>
            </div>

            {/* Progress Info */}
            <Show
              when={progress()}
              fallback={
                <div class="text-center py-8 text-[var(--text-muted)]">
                  {progressLoading() ? '加载中…' : '暂无采集数据'}
                </div>
              }
            >
              {(prog) => (
                <div class="space-y-5">
                  {/* Stats Row */}
                  <div class="grid grid-cols-3 gap-4">
                    <div class="bg-[#1f2937] rounded-lg p-4 text-center">
                      <div class="text-2xl font-bold text-[var(--text-primary)] tabular-nums">
                        {prog().collected_stocks.toLocaleString()}
                      </div>
                      <div class="text-xs text-[var(--text-muted)] mt-1">已采集股票</div>
                    </div>
                    <div class="bg-[#1f2937] rounded-lg p-4 text-center">
                      <div class="text-2xl font-bold text-[var(--text-primary)] tabular-nums">
                        {prog().total_stocks.toLocaleString()}
                      </div>
                      <div class="text-xs text-[var(--text-muted)] mt-1">目标总数</div>
                    </div>
                    <div class="bg-[#1f2937] rounded-lg p-4 text-center">
                      <div
                        class={`text-2xl font-bold tabular-nums ${
                          prog().status === 'running'
                            ? 'text-green-400'
                            : prog().status === 'error'
                              ? 'text-red-400'
                              : prog().status === 'paused'
                                ? 'text-yellow-400'
                                : 'text-[var(--text-primary)]'
                        }`}
                      >
                        {prog().progress_pct.toFixed(1)}%
                      </div>
                      <div class="text-xs text-[var(--text-muted)] mt-1">
                        {statusLabel(prog().status)}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div class="space-y-2">
                    <div class="flex justify-between text-xs text-[var(--text-muted)]">
                      <span>采集进度</span>
                      <span>
                        {prog().collected_stocks} / {prog().total_stocks}
                      </span>
                    </div>
                    <div class="h-3 bg-[#1f2937] rounded-full overflow-hidden">
                      <div
                        class={`h-full rounded-full transition-all duration-500 ${progressColor(prog().progress_pct)}`}
                        style={{ width: `${Math.min(prog().progress_pct, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Status Message */}
                  <div class="text-xs text-[var(--text-muted)] flex items-center gap-2">
                    <span
                      class={`w-2 h-2 rounded-full ${
                        prog().status === 'running'
                          ? 'bg-green-400 animate-pulse'
                          : prog().status === 'error'
                            ? 'bg-red-400'
                            : prog().status === 'paused'
                              ? 'bg-yellow-400'
                              : 'bg-gray-500'
                      }`}
                    />
                    <span>{prog().message}</span>
                    <Show when={prog().last_updated}>
                      <span class="ml-auto">最后更新: {prog().last_updated}</span>
                    </Show>
                  </div>
                </div>
              )}
            </Show>

            {/* Table info */}
            <div class="text-xs text-[var(--text-muted)] space-y-1 border-t border-white/10 pt-4">
              <p>📊 数据库 DuckDB 表格:</p>
              <ul class="list-disc list-inside space-y-0.5 ml-2">
                <li>
                  <span class="font-mono text-[var(--text-secondary)]">daily_bar</span> —
                  A股日K线数据
                </li>
                <li>
                  <span class="font-mono text-[var(--text-secondary)]">positions</span> —
                  当前持仓记录
                </li>
                <li>
                  <span class="font-mono text-[var(--text-secondary)]">orders</span> — 历史委托记录
                </li>
              </ul>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};
