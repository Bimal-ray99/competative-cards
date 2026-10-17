import { describe, it, expect } from 'vitest';
import { normalizeLeetCode } from '../../src/services/stats.js';
import { leetcodeProfileFixture } from '../fixtures/leetcode.js';
import { renderCard } from '../../src/render/index.js';

describe('LeetCode skills + languages', () => {
  const stats = normalizeLeetCode(leetcodeProfileFixture());

  it('normalizes languages sorted by solved desc', () => {
    expect(stats.languages).toEqual([
      { name: 'Python3', solved: 85 },
      { name: 'Java', solved: 4 },
    ]);
  });

  it('normalizes skills, dedupes across tiers (first occurrence wins)', () => {
    const dp = stats.skills.find((s) => s.slug === 'dp');
    expect(dp).toBeTruthy();
    expect(dp.solved).toBe(10);
    expect(dp.tier).toBe('advanced');
    const slugs = stats.skills.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('skills sorted by solved desc', () => {
    for (let i = 1; i < stats.skills.length; i += 1) {
      expect(stats.skills[i - 1].solved).toBeGreaterThanOrEqual(stats.skills[i].solved);
    }
  });

  it('renders skills card and respects top_skills limit', () => {
    const full = renderCard({ type: 'skills', leetcode: stats, themeName: 'default' });
    const limited = renderCard({
      type: 'skills',
      leetcode: stats,
      themeName: 'default',
      options: { topSkills: 1 },
    });
    // All sorted-by-solved tags appear when unlimited.
    expect(full).toContain('Array');
    expect(full).toContain('Dynamic Programming');
    // Only the top (Array, 57 solved) when limit = 1.
    expect(limited).toContain('Array');
    expect(limited).not.toContain('Dynamic Programming');
  });

  it('renders languages card', () => {
    const svg = renderCard({ type: 'languages', leetcode: stats, themeName: 'default' });
    expect(svg).toContain('Python3');
    expect(svg).toContain('Java');
  });
});
