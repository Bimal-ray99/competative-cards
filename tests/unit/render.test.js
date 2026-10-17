import { describe, it, expect } from 'vitest';
import { renderCard } from '../../src/render/index.js';
import { resolveTheme } from '../../src/render/themes/index.js';
import { normalizeLeetCode, normalizeCodeforces } from '../../src/services/stats.js';
import { leetcodeProfileFixture } from '../fixtures/leetcode.js';
import { cfUserFixture, cfSubmissionsFixture } from '../fixtures/codeforces.js';

const leet = normalizeLeetCode(leetcodeProfileFixture({ username: '<img src=x>' }));
const cf = normalizeCodeforces(cfUserFixture, cfSubmissionsFixture);

describe('renderCard', () => {
  it('renders a valid SVG for overview', () => {
    const svg = renderCard({ type: 'overview', leetcode: leet, themeName: 'dark' });
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.includes('</svg>')).toBe(true);
  });

  it('escapes untrusted username in title to prevent injection', () => {
    const svg = renderCard({ type: 'overview', leetcode: leet, themeName: 'dark' });
    expect(svg).not.toContain('<img src=x>');
    expect(svg).toContain('&lt;img src=x&gt;');
  });

  it('respects the hide list for ranking', () => {
    const withRank = renderCard({ type: 'overview', leetcode: leet, themeName: 'dark' });
    const hidden = renderCard({
      type: 'overview',
      leetcode: leet,
      themeName: 'dark',
      hide: ['ranking'],
    });
    // Rank line appears in header as "rank #N" (mono) when visible.
    expect(withRank).toMatch(/rank\s*#/i);
    expect(hidden).not.toMatch(/rank\s*#/i);
  });

  it('renders light theme with light bg', () => {
    const theme = resolveTheme('light');
    expect(theme.bg).toBe('#ffffff');
  });

  it('custom theme accepts hex overrides', () => {
    const theme = resolveTheme('custom', { bg_color: '#123456', title_color: 'abcdef' });
    expect(theme.bg).toBe('#123456');
    expect(theme.title).toBe('#abcdef');
  });

  it('rejects invalid hex in custom theme and keeps default', () => {
    const theme = resolveTheme('custom', { bg_color: 'drop table' });
    expect(theme.bg).not.toBe('drop table');
  });

  it('renders codeforces rating card including graph', () => {
    const svg = renderCard({ type: 'rating', codeforces: cf, themeName: 'dark' });
    expect(svg).toMatch(/CODEFORCES/i);
    expect(svg).toContain('<path');
  });

  it('renders combined card from both providers', () => {
    const svg = renderCard({ type: 'combined', leetcode: leet, codeforces: cf, themeName: 'dark' });
    expect(svg).toContain('LeetCode');
    expect(svg).toContain('Codeforces');
  });

  it('throws 400 for missing data', () => {
    try {
      renderCard({ type: 'overview', themeName: 'dark' });
    } catch (err) {
      expect(err.statusCode).toBe(400);
      return;
    }
    throw new Error('expected throw');
  });

  it('deterministic output for same input', () => {
    const a = renderCard({ type: 'overview', leetcode: leet, themeName: 'dark' });
    const b = renderCard({ type: 'overview', leetcode: leet, themeName: 'dark' });
    expect(a).toBe(b);
  });
});
