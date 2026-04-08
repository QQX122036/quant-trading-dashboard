import { describe, it, expect } from 'vitest';
import {
  directionColor,
  directionBg,
  statusColor,
  priceChangeColor,
  pnlColor,
} from '../../utils/color';

describe('directionColor', () => {
  it('returns up color for 多', () => {
    const result = directionColor('多');
    expect(typeof result).toBe('string');
    expect(result).toContain('color-up');
  });

  it('returns down color for 空', () => {
    const result = directionColor('空');
    expect(typeof result).toBe('string');
    expect(result).toContain('color-down');
  });

  it('returns default for unknown direction', () => {
    const result = directionColor('unknown' as any);
    expect(typeof result).toBe('string');
    expect(result).toContain('text-primary');
  });
});

describe('directionBg', () => {
  it('returns long background for 多', () => {
    const result = directionBg('多');
    expect(typeof result).toBe('string');
    expect(result).toContain('red');
  });

  it('returns short background for 空', () => {
    const result = directionBg('空');
    expect(typeof result).toBe('string');
    expect(result).toContain('cyan');
  });

  it('returns default for unknown', () => {
    const result = directionBg('unknown' as any);
    expect(typeof result).toBe('string');
    expect(result).toContain('gray');
  });
});

describe('statusColor', () => {
  it('maps 提交中 to gray', () => {
    const result = statusColor('提交中');
    expect(result).toContain('gray');
  });

  it('maps 未成交 to blue', () => {
    const result = statusColor('未成交');
    expect(result).toContain('blue');
  });

  it('maps 部分成交 to yellow', () => {
    const result = statusColor('部分成交');
    expect(result).toContain('yellow');
  });

  it('maps 全部成交 to green', () => {
    const result = statusColor('全部成交');
    expect(result).toContain('green');
  });

  it('maps 已撤销 to gray', () => {
    const result = statusColor('已撤销');
    expect(result).toContain('gray');
  });

  it('maps 拒单 to red', () => {
    const result = statusColor('拒单');
    expect(result).toContain('red');
  });

  it('returns default for unknown status', () => {
    const result = statusColor('unknown' as any);
    expect(result).toContain('gray');
  });
});

describe('priceChangeColor', () => {
  it('returns up color for positive values', () => {
    const result = priceChangeColor(5);
    expect(result).toContain('color-up');
  });

  it('returns down color for negative values', () => {
    const result = priceChangeColor(-5);
    expect(result).toContain('color-down');
  });

  it('returns default for zero', () => {
    const result = priceChangeColor(0);
    expect(result).toContain('text-primary');
  });

  it('returns default for undefined', () => {
    const result = priceChangeColor(undefined);
    expect(result).toContain('text-primary');
  });
});

describe('pnlColor', () => {
  it('returns positive color for profit', () => {
    const result = pnlColor(100);
    expect(result).toContain('pnl-pos');
  });

  it('returns negative color for loss', () => {
    const result = pnlColor(-50);
    expect(result).toContain('pnl-neg');
  });

  it('returns default for zero', () => {
    const result = pnlColor(0);
    expect(result).toContain('text-primary');
  });

  it('returns default for undefined', () => {
    const result = pnlColor(undefined);
    expect(result).toContain('text-primary');
  });
});
