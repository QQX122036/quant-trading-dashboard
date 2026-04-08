import { describe, it, expect } from 'vitest';
import {
  formatPrice,
  formatVolume,
  formatPercent,
  formatPnl,
  formatAmount,
  formatTime,
  formatDate,
} from '../../utils/format';

describe('formatPrice', () => {
  it('formats positive numbers with default 2 decimals', () => {
    expect(formatPrice(1234.5)).toBe('1,234.50');
  });

  it('formats zero correctly', () => {
    expect(formatPrice(0)).toBe('0.00');
  });

  it('handles null/undefined', () => {
    expect(formatPrice(undefined as any)).toBe('-');
    expect(formatPrice(null as any)).toBe('-');
  });

  it('formats with custom decimal places', () => {
    expect(formatPrice(1234.567, 3)).toBe('1,234.567');
    expect(formatPrice(1234.5, 0)).toBe('1,235');
  });
});

describe('formatVolume', () => {
  it('formats small numbers with locale string', () => {
    expect(formatVolume(1234)).toBe('1,234');
  });

  it('formats 万 volumes', () => {
    expect(formatVolume(50000)).toBe('5.00万');
  });

  it('formats 亿 volumes', () => {
    expect(formatVolume(150000000)).toBe('1.50亿');
  });

  it('formats zero', () => {
    expect(formatVolume(0)).toBe('0');
  });

  it('handles null/undefined', () => {
    expect(formatVolume(undefined as any)).toBe('-');
  });
});

describe('formatPercent', () => {
  it('adds + sign for positive values', () => {
    expect(formatPercent(5.5)).toBe('+5.50%');
  });

  it('no sign for zero', () => {
    expect(formatPercent(0)).toBe('+0.00%');
  });

  it('negative values keep - sign', () => {
    expect(formatPercent(-3.25)).toBe('-3.25%');
  });

  it('custom decimal places', () => {
    expect(formatPercent(5.555, 3)).toBe('+5.555%');
  });
});

describe('formatPnl', () => {
  it('adds + sign for positive values', () => {
    expect(formatPnl(1234.56)).toBe('+1234.56');
  });

  it('adds + sign for zero', () => {
    expect(formatPnl(0)).toBe('+0.00');
  });

  it('negative values keep - sign', () => {
    expect(formatPnl(-999.99)).toBe('-999.99');
  });
});

describe('formatAmount', () => {
  it('formats with 2 decimal places', () => {
    expect(formatAmount(1234567.89)).toBe('1,234,567.89');
  });

  it('handles zero', () => {
    expect(formatAmount(0)).toBe('0.00');
  });

  it('handles null/undefined', () => {
    expect(formatAmount(undefined as any)).toBe('-');
  });
});

describe('formatTime', () => {
  it('formats ISO datetime correctly', () => {
    const result = formatTime('2026-04-05T10:30:45.123');
    expect(result).toMatch(/10:30:45\.123/);
  });

  it('returns - for empty input', () => {
    expect(formatTime('')).toBe('-');
  });

  it('pads hours/minutes/seconds', () => {
    const result = formatTime('2026-04-05T01:02:03.004');
    expect(result).toBe('01:02:03.004');
  });
});

describe('formatDate', () => {
  it('extracts date part from ISO string', () => {
    expect(formatDate('2026-04-05T10:30:45')).toBe('2026-04-05');
  });

  it('returns - for empty input', () => {
    expect(formatDate('')).toBe('-');
  });
});
