import { describe, it, expect } from 'vitest';
import {
  isValidUsername,
  assertValidUsername,
  isValidHexColor,
  parseList,
  parseLayout,
  parseTheme,
  parseCardType,
} from '../../src/utils/validate.js';

describe('isValidUsername', () => {
  it('accepts common handles', () => {
    expect(isValidUsername('tourist')).toBe(true);
    expect(isValidUsername('user_name-99')).toBe(true);
    expect(isValidUsername('a.b.c')).toBe(true);
  });
  it('rejects path traversal and control characters', () => {
    expect(isValidUsername('../etc/passwd')).toBe(false);
    expect(isValidUsername('name\nextra')).toBe(false);
    expect(isValidUsername(' ')).toBe(false);
    expect(isValidUsername('')).toBe(false);
    expect(isValidUsername('x'.repeat(40))).toBe(false);
  });
});

describe('assertValidUsername', () => {
  it('throws 400 on invalid input', () => {
    try {
      assertValidUsername('../x');
    } catch (err) {
      expect(err.statusCode).toBe(400);
      return;
    }
    throw new Error('did not throw');
  });
});

describe('isValidHexColor', () => {
  it('accepts hex colors with and without hash', () => {
    expect(isValidHexColor('fff')).toBe(true);
    expect(isValidHexColor('ffffff')).toBe(true);
    expect(isValidHexColor('ffffffff')).toBe(true);
  });
  it('rejects non-hex', () => {
    expect(isValidHexColor('red')).toBe(false);
    expect(isValidHexColor('zzz')).toBe(false);
    expect(isValidHexColor('')).toBe(false);
  });
});

describe('parseList', () => {
  it('splits, trims, lowercases', () => {
    expect(parseList(' Easy, HARD , medium ')).toEqual(['easy', 'hard', 'medium']);
  });
  it('empty-safe', () => {
    expect(parseList('')).toEqual([]);
    expect(parseList(undefined)).toEqual([]);
  });
});

describe('parseLayout / parseTheme / parseCardType', () => {
  it('falls back on invalid values', () => {
    expect(parseLayout('nope')).toBe('default');
    expect(parseTheme('')).toBe('default');
    expect(parseTheme('bad space')).toBe('default');
    expect(parseCardType('nope')).toBe('overview');
  });
  it('accepts allowed values', () => {
    expect(parseLayout('compact')).toBe('compact');
    expect(parseTheme('tokyonight')).toBe('tokyonight');
    expect(parseTheme('github-dark')).toBe('github-dark');
    expect(parseCardType('rating')).toBe('rating');
    expect(parseCardType('skills')).toBe('skills');
  });
});
