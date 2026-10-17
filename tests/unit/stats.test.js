import { describe, it, expect } from 'vitest';
import { normalizeLeetCode, normalizeCodeforces } from '../../src/services/stats.js';
import { leetcodeProfileFixture } from '../fixtures/leetcode.js';
import { cfUserFixture, cfSubmissionsFixture } from '../fixtures/codeforces.js';
import { dedupeAcceptedProblems } from '../../src/providers/codeforces/index.js';

describe('normalizeLeetCode', () => {
  it('maps solved/available buckets correctly', () => {
    const n = normalizeLeetCode(leetcodeProfileFixture());
    expect(n.solved).toEqual({ easy: 60, medium: 50, hard: 13, total: 123 });
    expect(n.available).toEqual({ easy: 750, medium: 1600, hard: 650, total: 3000 });
  });

  it('computes acceptance rate from totals', () => {
    const n = normalizeLeetCode(leetcodeProfileFixture());
    // total submissions = 456, accepted = 123 → ~27.0%
    expect(n.acceptanceRate).toBeCloseTo(27, 0);
  });

  it('ranks are preserved', () => {
    const n = normalizeLeetCode(leetcodeProfileFixture());
    expect(n.ranking).toBe(12345);
  });

  it('returns null for missing user', () => {
    expect(normalizeLeetCode({})).toBeNull();
    expect(normalizeLeetCode({ matchedUser: null })).toBeNull();
  });

  it('populates streak from calendar', () => {
    const n = normalizeLeetCode(leetcodeProfileFixture());
    expect(n.streak.totalActiveDays).toBe(5);
    expect(n.streak.longest).toBe(5);
    expect(n.streak.current).toBeGreaterThanOrEqual(1);
  });
});

describe('dedupeAcceptedProblems', () => {
  it('deduplicates by stable contest+index key', () => {
    const out = dedupeAcceptedProblems(cfSubmissionsFixture);
    const keys = out.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain('100-A');
    expect(keys).toContain('100-B');
    expect(keys).toContain('102-C');
  });
  it('ignores non-OK verdicts', () => {
    const out = dedupeAcceptedProblems(cfSubmissionsFixture);
    expect(out.find((p) => p.key === '101-A')).toBeUndefined();
  });
});

describe('normalizeCodeforces', () => {
  it('exposes rating, max rating, rank', () => {
    const n = normalizeCodeforces(cfUserFixture, cfSubmissionsFixture);
    expect(n.currentRating).toBe(1850);
    expect(n.maxRating).toBe(1920);
    expect(n.rank).toBe('candidate master');
    expect(n.contests).toBe(3);
  });
  it('solved count excludes failed and duplicate submissions', () => {
    const n = normalizeCodeforces(cfUserFixture, cfSubmissionsFixture);
    expect(n.solved.total).toBe(3);
  });
  it('buckets solved by rating', () => {
    const n = normalizeCodeforces(cfUserFixture, cfSubmissionsFixture);
    expect(n.solved.byRating.unrated).toBe(1);
    expect(n.solved.byRating['800']).toBe(1);
    expect(n.solved.byRating['1200']).toBe(1);
  });
});
