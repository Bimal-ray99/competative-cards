import { describe, it, expect } from 'vitest';
import { formatNumber } from '../../src/render/svg/cards.js';

describe('formatNumber', () => {
  it('passes numbers through when disabled', () => {
    expect(formatNumber(1234, false)).toBe('1,234');
    expect(formatNumber(1_234_567, false)).toBe('1,234,567');
  });
  it('abbreviates when enabled', () => {
    expect(formatNumber(999, true)).toBe('999');
    expect(formatNumber(1500, true)).toBe('1.5K');
    expect(formatNumber(12_345, true)).toBe('12K');
    expect(formatNumber(1_234_567, true)).toBe('1.2M');
    expect(formatNumber(12_345_678, true)).toBe('12M');
    expect(formatNumber(1_200_000_000, true)).toBe('1.2B');
  });
  it('handles non-numbers', () => {
    expect(formatNumber('x', true)).toBe('x');
    expect(formatNumber(NaN, true)).toBe('NaN');
  });
});
