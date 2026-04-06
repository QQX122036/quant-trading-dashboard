import { Component, createMemo, onMount, For } from 'solid-js';
import { state } from '../../stores';
import { fetchAccounts } from '../../hooks/useApi';
import { formatAmount } from '../../utils/format';
import { pnlColor } from '../../utils/color';

export const AccountMonitor: Component = () => {
  const accounts = createMemo(() => Object.values(state.accounts.items));

  const totalBalance = createMemo(() =>
    accounts().reduce((s, a) => s + (a.balance || 0), 0)
  );
  const totalAvailable = createMemo(() =>
    accounts().reduce((s, a) => s + (a.available || 0), 0)
  );
  const totalFrozen = createMemo(() =>
    accounts().reduce((s, a) => s + (a.frozen || 0), 0)
  );

  // 当日盈亏（暂无专门字段，显示0占位，WebSocket推送后自动更新）
  const dailyPnl = createMemo(() => 0);

  onMount(async () => {
    try {
      const res = await fetchAccounts();
      if (res.code === '0' && res.data?.accounts) {
        for (const acc of res.data.accounts) {
          state.accounts.items[acc.vt_accountid] = acc;
        }
      }
    } catch (e) {
      console.warn('[AccountMonitor] fetchAccounts error', e);
    }
  });

  const cards = createMemo(() => [
    { label: '总权益',    value: totalBalance(),   color: '' },
    { label: '可用资金',  value: totalAvailable(), color: 'text-[var(--color-up)]' },
    { label: '冻结资金',  value: totalFrozen(),    color: 'text-yellow-400' },
    { label: '当日盈亏',  value: dailyPnl(),        color: pnlColor(dailyPnl()) },
  ]);

  return (
    <div class="grid grid-cols-2 gap-2 p-2">
      <For each={cards()}>
        {(card) => (
          <div class="bg-[#0A0E17] rounded p-2">
            <div class="text-[10px] text-[var(--text-muted)] mb-0.5">{card.label}</div>
            <div class={`text-base font-bold tabular-nums ${card.color || 'text-[var(--text-primary)]'}`}>
              {formatAmount(card.value)}
            </div>
          </div>
        )}
      </For>
    </div>
  );
};
