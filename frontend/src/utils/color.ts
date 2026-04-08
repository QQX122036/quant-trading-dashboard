// ── Color utilities ─────────────────────────────────────────

import type { Direction, OrderStatus } from '../types/vnpy';

export function directionColor(d: Direction | string): string {
  if (d === '多') return 'text-[var(--color-up)]';
  if (d === '空') return 'text-[var(--color-down)]';
  return 'text-[var(--text-primary)]';
}

export function directionBg(d: Direction | string): string {
  if (d === '多') return 'bg-red-500/20 text-red-400';
  if (d === '空') return 'bg-cyan-500/20 text-cyan-400';
  return 'bg-gray-500/20 text-gray-400';
}

export function statusColor(s: OrderStatus | string): string {
  const map: Record<string, string> = {
    提交中: 'bg-gray-600 text-white',
    未成交: 'bg-blue-600 text-white',
    部分成交: 'bg-yellow-600 text-black',
    全部成交: 'bg-green-700 text-white',
    已撤销: 'bg-gray-500 text-white',
    拒单: 'bg-red-700 text-white',
  };
  return map[s] || 'bg-gray-400 text-black';
}

export function priceChangeColor(v: number | undefined): string {
  if (!v) return 'text-[var(--text-primary)]';
  return v > 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]';
}

export function pnlColor(v: number | undefined): string {
  if (!v) return 'text-[var(--text-primary)]';
  return v >= 0 ? 'text-[var(--color-pnl-pos)]' : 'text-[var(--color-pnl-neg)]';
}
