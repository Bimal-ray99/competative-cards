import { describe, it, expect } from 'vitest';
import { renderCard } from '../../src/render/index.js';
import { normalizeLeetCode } from '../../src/services/stats.js';
import { leetcodeProfileFixture } from '../fixtures/leetcode.js';

const leet = normalizeLeetCode(leetcodeProfileFixture());

describe('sections -> hide translation', () => {
  it('keeps only requested sections on overview', () => {
    const svg = renderCard({
      type: 'overview',
      leetcode: leet,
      themeName: 'default',
      options: { sections: ['easy', 'medium'] },
    });
    expect(svg).toContain('Easy');
    expect(svg).toContain('Medium');
    expect(svg).not.toContain('Hard');
    expect(svg).not.toContain('Ranking');
    expect(svg).not.toContain('Current streak');
  });

  it('empty sections = include everything (back-compat)', () => {
    const svg = renderCard({
      type: 'overview',
      leetcode: leet,
      themeName: 'default',
      options: { sections: [] },
    });
    expect(svg).toContain('Easy');
    expect(svg).toContain('Hard');
    expect(svg).toMatch(/rank\s*#/i);
  });

  it('merges with explicit hide list (explicit wins)', () => {
    const svg = renderCard({
      type: 'overview',
      leetcode: leet,
      themeName: 'default',
      hide: ['hard'],
      options: { sections: ['easy', 'medium', 'hard'] },
    });
    expect(svg).toContain('Easy');
    expect(svg).not.toContain('Hard');
  });
});

describe('new card params', () => {
  it('short_numbers abbreviates', () => {
    const stats = { ...leet, ranking: 1_892_434 };
    const normal = renderCard({ type: 'overview', leetcode: stats, themeName: 'default' });
    const short = renderCard({
      type: 'overview',
      leetcode: stats,
      themeName: 'default',
      options: { shortNumbers: true },
    });
    expect(normal).toContain('1,892,434');
    expect(short).not.toContain('1,892,434');
    expect(short).toMatch(/1\.9M/);
  });

  it('disable_animations removes keyframes', () => {
    const anim = renderCard({ type: 'overview', leetcode: leet, themeName: 'default' });
    const noAnim = renderCard({
      type: 'overview',
      leetcode: leet,
      themeName: 'default',
      options: { disableAnimations: true },
    });
    expect(anim).toContain('@keyframes');
    expect(noAnim).not.toContain('@keyframes');
  });
});
