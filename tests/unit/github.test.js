import { describe, it, expect } from 'vitest';
import { normalizeGitHub } from '../../src/services/stats.js';
import { renderCard } from '../../src/render/index.js';
import { computeGrade } from '../../src/render/svg/primitives.js';
import { githubFixture } from '../fixtures/github.js';

describe('normalizeGitHub', () => {
  it('returns null when user is missing', () => {
    expect(normalizeGitHub({ user: null })).toBeNull();
  });

  it('aggregates stars and sums language bytes', () => {
    const g = normalizeGitHub(githubFixture());
    expect(g.username).toBe('alice');
    expect(g.stars).toBe(10 + 20 + 30 + 40 + 50);
    const total = g.languages.reduce((a, b) => a + b.bytes, 0);
    expect(total).toBe(150_000 + 90_000 + 60_000 + 30_000);
  });

  it('sorts languages by bytes desc and attaches a color', () => {
    const g = normalizeGitHub(githubFixture());
    expect(g.languages[0].name).toBe('JavaScript');
    expect(g.languages[g.languages.length - 1].name).toBe('C++');
    for (const l of g.languages) expect(l.color).toMatch(/^#|^hsl/);
  });

  it('exposes contributionCalendar totals and derived streak when token used', () => {
    const g = normalizeGitHub(githubFixture({ withGraphql: true }));
    expect(g.tokenUsed).toBe(true);
    expect(g.contrib).toBe(3384);
    expect(g.totalCommits).toBe(2700);
    expect(g.totalPrs).toBe(250);
    expect(g.totalIssues).toBe(21);
    // Fixture has a 6-day run (Feb 26-28 + Mar 1-3), all consecutive.
    expect(g.longestStreak).toBe(6);
  });

  it('leaves auth-only fields null without a token', () => {
    const g = normalizeGitHub(githubFixture({ withGraphql: false }));
    expect(g.tokenUsed).toBe(false);
    expect(g.contrib).toBeNull();
    expect(g.totalCommits).toBeNull();
    expect(g.totalPrs).toBeNull();
    expect(g.currentStreak).toBeNull();
    expect(g.longestStreak).toBeNull();
    expect(g.stars).toBeGreaterThan(0);
  });
});

describe('computeGrade', () => {
  it('low-activity profile grades near C', () => {
    const { grade, percent } = computeGrade({
      commits: 10,
      prs: 1,
      issues: 0,
      stars: 2,
      followers: 1,
      contrib: 10,
    });
    expect(['C', 'C+', 'B-']).toContain(grade);
    expect(percent).toBeGreaterThanOrEqual(0);
    expect(percent).toBeLessThanOrEqual(100);
  });

  it('elite profile grades S-tier', () => {
    const { grade } = computeGrade({
      commits: 10_000,
      prs: 2_000,
      issues: 500,
      stars: 5_000,
      followers: 1_000,
      contrib: 10_000,
    });
    expect(['S', 'S+']).toContain(grade);
  });

  it('percent monotonically increases with activity', () => {
    const a = computeGrade({ commits: 10, prs: 1, issues: 0, stars: 1 });
    const b = computeGrade({ commits: 1000, prs: 100, issues: 50, stars: 500 });
    expect(b.percent).toBeGreaterThan(a.percent);
  });
});

describe('GitHub cards', () => {
  const stats = normalizeGitHub(githubFixture());

  it('renders github-stats with a grade donut + metric rows', () => {
    const svg = renderCard({ type: 'github-stats', github: stats, themeName: 'default' });
    expect(svg).toContain('Total Stars Earned:');
    expect(svg).toContain('Total Commits:');
    // Grade sub-label is rendered uppercase inside the donut.
    expect(svg).toMatch(/>GRADE</);
  });

  it('renders github-streak with Current Streak center + date range', () => {
    const svg = renderCard({ type: 'github-streak', github: stats, themeName: 'default' });
    // Center sub-labels are uppercased in SVG output.
    expect(svg).toMatch(/>CURRENT STREAK</);
    expect(svg).toContain('>TOTAL CONTRIBUTIONS<');
    expect(svg).toContain('>LONGEST STREAK<');
    // Fixture starts on Feb 26, 2025.
    expect(svg).toContain('Feb 26, 2025');
  });

  it('renders github-langs stacked bar + legend with percentages', () => {
    const svg = renderCard({ type: 'github-langs', github: stats, themeName: 'default' });
    expect(svg).toContain('JavaScript');
    expect(svg).toContain('TypeScript');
    expect(svg).toContain('%');
  });

  it('renders github-profile with uppercased tile labels', () => {
    const svg = renderCard({ type: 'github-profile', github: stats, themeName: 'default' });
    expect(svg).toContain('@alice');
    expect(svg).toContain('>REPOS<');
    expect(svg).toContain('>FOLLOWERS<');
    expect(svg).toContain('>STARS<');
  });

  it('shows token hint when GITHUB_TOKEN is not set', () => {
    const noToken = normalizeGitHub(githubFixture({ withGraphql: false }));
    const svg = renderCard({ type: 'github-stats', github: noToken, themeName: 'default' });
    expect(svg).toContain('GITHUB_TOKEN not set');
  });

  it('combined card includes GitHub section', () => {
    const svg = renderCard({ type: 'combined', github: stats, themeName: 'default' });
    expect(svg).toContain('GitHub');
    expect(svg).toContain('repos');
    expect(svg).toContain('stars');
  });
});
