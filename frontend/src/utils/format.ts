// ── Formatting utilities ─────────────────────────────────────

export function formatPrice(v: number, decimals = 2): string {
  if (!v && v !== 0) return '-';
  return v.toFixed(decimals);
}

export function formatVolume(v: number): string {
  if (!v && v !== 0) return '-';
  if (v >= 1_0000_0000) return (v / 1_0000_0000).toFixed(2) + '亿';
  if (v >= 1_0000) return (v / 1_0000).toFixed(2) + '万';
  return v.toLocaleString();
}

export function formatPercent(v: number, decimals = 2): string {
  if (!v && v !== 0) return '-';
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(decimals)}%`;
}

export function formatPnl(v: number): string {
  if (!v && v !== 0) return '0.00';
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}`;
}

export function formatAmount(v: number): string {
  if (!v && v !== 0) return '-';
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatTime(datetime: string): string {
  if (!datetime) return '-';
  try {
    const d = new Date(datetime);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    const ms = String(d.getMilliseconds()).padStart(3, '0');
    return `${h}:${m}:${s}.${ms}`;
  } catch {
    return datetime;
  }
}

export function formatDate(datetime: string): string {
  if (!datetime) return '-';
  try {
    const d = new Date(datetime);
    return d.toISOString().slice(0, 10);
  } catch {
    return datetime;
  }
}
