import { Component, createSignal, createMemo, For, onMount } from 'solid-js';
import { state, actions } from '../../stores';
import { fetchContracts } from '../../hooks/useApi';
import type { ContractData } from '../../types/vnpy';

const COLUMNS = [
  { field: 'symbol',      header: '代码',     width: 80  },
  { field: 'name',        header: '名称',     width: 120 },
  { field: 'exchange',     header: '交易所',   width: 70  },
  { field: 'product',     header: '类型',     width: 65  },
  { field: 'size',        header: '合约乘数',  width: 75  },
  { field: 'price_tick',  header: '最小变动',  width: 85  },
];

export const ContractManager: Component = () => {
  const [keyword, setKeyword] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [allContracts, setAllContracts] = createSignal<ContractData[]>([]);

  onMount(async () => {
    setLoading(true);
    try {
      const res = await fetchContracts();
      if (res.code === '0' && res.data?.contracts) {
        setAllContracts(res.data.contracts);
        for (const c of res.data.contracts) {
          state.contracts.items[c.vt_symbol] = c;
        }
      }
    } catch (e) {
      console.warn('[ContractManager] fetchContracts error', e);
    } finally {
      setLoading(false);
    }
  });

  async function handleSearch() {
    setLoading(true);
    try {
      const kw = keyword().trim();
      const res = await fetchContracts(kw || undefined);
      if (res.code === '0' && res.data?.contracts) {
        setAllContracts(res.data.contracts);
      }
    } catch (e) {
      console.warn('[ContractManager] search error', e);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleSearch();
  }

  function close() {
    actions.ui.toggleDialog('contract');
  }

  const filtered = createMemo(() => {
    const kw = keyword().toLowerCase().trim();
    if (!kw) return allContracts();
    return allContracts().filter(
      (c) =>
        c.symbol.toLowerCase().includes(kw) ||
        c.name.toLowerCase().includes(kw) ||
        c.vt_symbol.toLowerCase().includes(kw)
    );
  });

  return (
    <div class="dialog-overlay" onClick={(e) => e.target === e.currentTarget && close()}>
      <div class="dialog-panel" style={{ width: '680px', 'max-height': '80vh' }}>
        <div class="dialog-header">
          <span class="text-sm font-bold text-[var(--text-primary)]">📋 合约查询</span>
          <button class="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-lg leading-none" onClick={close}>×</button>
        </div>

        <div class="dialog-body">
          {/* 搜索栏 */}
          <div class="flex gap-2 mb-4">
            <input
              class="form-input flex-1"
              type="text"
              placeholder="输入代码或名称搜索…"
              value={keyword()}
              onInput={(e) => setKeyword(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
            />
            <button class="btn btn-primary" onClick={handleSearch} disabled={loading()}>
              {loading() ? '搜索中…' : '🔍 搜索'}
            </button>
          </div>

          {/* 合约列表 */}
          <div style={{ 'max-height': '420px', overflow: 'auto' }}>
            <table class="w-full border-collapse text-xs">
              <thead class="sticky top-0 z-10 bg-[var(--bg-tertiary)]">
                <tr>
                  <For each={COLUMNS}>
                    {(col) => (
                      <th
                        class="px-2 py-2 text-[var(--text-muted)] font-normal border-b border-[var(--border-color)] whitespace-nowrap"
                        style={{ width: col.width ? `${col.width}px` : undefined, 'text-align': 'left' }}
                      >
                        {col.header}
                      </th>
                    )}
                  </For>
                </tr>
              </thead>
              <tbody>
                <For each={filtered()} fallback={
                  <tr>
                    <td colspan={COLUMNS.length} class="text-center py-8 text-[var(--text-muted)]">
                      {loading() ? '加载中…' : '暂无合约数据'}
                    </td>
                  </tr>
                }>
                  {(contract) => (
                    <tr
                      class="border-b border-[var(--border-color)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
                      onClick={() => {
                        actions.ui.setSelectedSymbol(contract.vt_symbol);
                        close();
                      }}
                      title="点击选中合约"
                    >
                      <For each={COLUMNS}>
                        {(col) => {
                          const val = (contract as unknown as Record<string, unknown>)[col.field];
                          if (col.field === 'price_tick') {
                            return <td class="px-2 py-1.5 text-xs font-mono tabular-nums text-[var(--text-secondary)]">{(val as number).toFixed(val === 0 ? 4 : (val as number) < 1 ? 4 : 2)}</td>;
                          }
                          return <td class="px-2 py-1.5 text-xs text-[var(--text-secondary)]">{String(val ?? '-')}</td>;
                        }}
                      </For>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
          <div class="text-xs text-[var(--text-muted)] mt-2">
            共 {filtered().length} 条合约，双击行选中并关闭
          </div>
        </div>

        <div class="dialog-footer">
          <button class="btn btn-secondary" onClick={close}>关闭</button>
        </div>
      </div>
    </div>
  );
};
