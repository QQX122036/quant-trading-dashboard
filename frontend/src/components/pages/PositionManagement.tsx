import { Component, createSignal } from 'solid-js';
import { PositionMonitor } from '../monitors/PositionMonitor';
import { AccountMonitor } from '../monitors/AccountMonitor';
import { apiState } from '../../stores/apiStore';

export const PositionManagement: Component = () => {
  const [showConfirm, setShowConfirm] = createSignal(false);

  const handleCloseAll = () => {
    setShowConfirm(true);
  };

  const confirmCloseAll = async () => {
    setShowConfirm(false);
    try {
      const positions = apiState.positions || [];
      for (const pos of positions) {
        if (pos.symbol && pos.volume > 0) {
          await fetch('/api/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              symbol: pos.symbol,
              exchange: pos.exchange,
              direction: pos.direction === '多' ? 'sell' : 'buy',
              offset: 'close',
              type: 'market',
              volume: pos.volume,
            }),
          });
        }
      }
    } catch (e) {
      console.error('[PositionManagement] 全部平仓失败:', e);
    }
  };

  const handleExportCSV = () => {
    const positions = apiState.positions || [];
    if (positions.length === 0) {
      alert('暂无持仓数据可导出');
      return;
    }
    const headers = ['代码', '交易所', '方向', '数量', '昨仓', '均价', '盈亏'];
    const rows = positions.map((p) => [
      p.symbol || '',
      p.exchange || '',
      p.direction || '',
      p.volume || 0,
      p.yd_position || 0,
      p.price || 0,
      p.pnl || 0,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `positions_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div class="h-full flex flex-col p-4 gap-4">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold">持仓管理</h2>
        <div class="flex gap-2">
          <button
            class="px-4 py-2 text-sm rounded bg-white/10 hover:bg-white/20 transition-colors"
            onClick={handleCloseAll}
          >
            全部平仓
          </button>
          <button
            class="px-4 py-2 text-sm rounded bg-white/10 hover:bg-white/20 transition-colors"
            onClick={handleExportCSV}
          >
            导出CSV
          </button>
        </div>
      </div>

      {showConfirm() && (
        <div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div class="bg-[#1a2332] border border-white/20 rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 class="text-lg font-bold text-yellow-400 mb-3">确认全部平仓？</h3>
            <p class="text-gray-300 text-sm mb-4">此操作将以市价卖出所有持仓，请确认。</p>
            <div class="flex gap-3 justify-end">
              <button
                class="px-4 py-2 text-sm rounded bg-white/10 hover:bg-white/20 transition-colors"
                onClick={() => setShowConfirm(false)}
              >
                取消
              </button>
              <button
                class="px-4 py-2 text-sm rounded bg-red-600 hover:bg-red-500 text-white font-bold transition-colors"
                onClick={confirmCloseAll}
              >
                确认平仓
              </button>
            </div>
          </div>
        </div>
      )}

      <div class="bg-[#111827]/80 rounded-lg border border-white/10 overflow-hidden">
        <AccountMonitor />
      </div>

      <div class="flex-1 bg-[#111827]/80 rounded-lg border border-white/10 overflow-hidden">
        <PositionMonitor />
      </div>
    </div>
  );
};
