import {
  wrapSvg,
  text,
  donutRing,
  statTile,
  flame,
  languageBar,
  computeGrade,
} from './primitives.js';
import { escapeXml } from '../../utils/escape.js';
import { formatNumber } from './cards.js';

const WIDTH = 540;

function hidden(hide, field) {
  return Array.isArray(hide) && hide.includes(field);
}

// GitHub stats card: six-metric tile grid on the left + grade donut on
// the right, mirroring the `anuraghazra/github-readme-stats` layout.
export function renderGitHubStats(stats, { theme, title, hide = [], options = {} } = {}) {
  const t = title || `${stats.username}'s GitHub Stats`;
  const fmt = (n) => (n === null || n === undefined ? '—' : formatNumber(n, options.shortNumbers));

  // Compute grade from available metrics; if GraphQL data missing, scoring
  // uses only stars / followers / repo count.
  const grade = computeGrade({
    commits: stats.totalCommits ?? 0,
    prs: stats.totalPrs ?? 0,
    issues: stats.totalIssues ?? 0,
    stars: stats.stars ?? 0,
    followers: stats.followers ?? 0,
    contrib: stats.contrib ?? 0,
  });

  const rows = [];
  const rowY0 = 72;
  const rowH = 26;
  const addRow = (icon, label, value) => {
    const i = rows.length;
    const y = rowY0 + i * rowH;
    rows.push(
      // Icon pill (just a colored dot for simplicity — avoids inline svg icon packs)
      `<circle cx="30" cy="${y - 5}" r="5" fill="${icon}" />`,
      text(44, y, label, 'value'),
      text(360, y, fmt(value), 'value', 'text-anchor="end" font-weight="700"'),
    );
  };

  if (!hidden(hide, 'stars'))
    addRow(theme.ring || theme.accent, 'Total Stars Earned:', stats.stars);
  if (!hidden(hide, 'commits')) addRow(theme.title, 'Total Commits:', stats.totalCommits);
  if (!hidden(hide, 'prs')) addRow(theme.easy, 'Total PRs:', stats.totalPrs);
  if (!hidden(hide, 'issues')) addRow(theme.medium, 'Total Issues:', stats.totalIssues);
  if (!hidden(hide, 'contrib')) addRow(theme.hard, 'Contributions (yr):', stats.contrib);
  if (!hidden(hide, 'repos')) addRow(theme.muted, 'Public Repos:', stats.publicRepos);

  const gradeDonut = donutRing({
    cx: 460,
    cy: 125,
    r: 42,
    strokeWidth: 6,
    value: grade.percent,
    max: 100,
    color: theme.title,
    trackColor: theme.grid,
    centerText: grade.grade,
    centerSub: 'Grade',
    centerColor: theme.text,
    subColor: theme.muted,
    centerSize: 30,
  });

  const limitation = !stats.tokenUsed
    ? text(28, 210, 'GITHUB_TOKEN not set — commits / PRs / issues / contrib unavailable.', 'label')
    : '';

  const children = `
    ${text(28, 35, t, 'title')}
    <g class="cc-stagger">${rows.join('')}</g>
    ${gradeDonut}
    ${limitation}
  `;

  return wrapSvg({ width: WIDTH, height: 230, title: t, children, theme, options });
}

// GitHub streak card: three big numbers + animated ring + flame + date ranges.
// Mirrors DenverCoder1/github-readme-streak-stats layout.
export function renderGitHubStreak(stats, { theme, title, hide = [], options = {} } = {}) {
  const t = title || `${stats.username}'s GitHub Streak`;
  const fmt = (n) => (n === null || n === undefined ? '—' : formatNumber(n, options.shortNumbers));

  const total = stats.contrib ?? null;
  const cur = stats.currentStreak ?? null;
  const longest = stats.longestStreak ?? null;

  const colXs = [120, 270, 420];
  const parts = [text(28, 35, t, 'title')];

  // Determine date ranges from activeDates for a nice sub-label.
  const dates = Array.isArray(stats.activeDates) ? stats.activeDates : [];
  const first = dates[0];
  const last = dates[dates.length - 1];
  const fmtDate = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return `${months[Number.parseInt(m, 10) - 1] || ''} ${Number.parseInt(d, 10)}, ${y}`;
  };
  const sinceLabel = first ? `${fmtDate(first)} – Present` : '';

  if (!hidden(hide, 'total')) {
    parts.push(
      statTile({
        cx: colXs[0],
        y: 120,
        value: fmt(total),
        label: 'Total Contributions',
        valueColor: theme.text,
        labelColor: theme.muted,
        valueSize: 40,
      }),
    );
    if (sinceLabel) parts.push(text(colXs[0], 158, sinceLabel, 'label', 'text-anchor="middle"'));
  }

  if (!hidden(hide, 'current')) {
    parts.push(
      donutRing({
        cx: colXs[1],
        cy: 125,
        r: 54,
        strokeWidth: 4,
        value: cur ?? 0,
        max: Math.max(cur || 0, longest || 0, 30),
        color: theme.streak,
        trackColor: theme.grid,
        centerText: fmt(cur),
        centerSub: 'Current Streak',
        centerColor: theme.streak,
        subColor: theme.muted,
        centerSize: 36,
      }),
    );
    parts.push(flame({ cx: colXs[1], cy: 60, size: 26, color: theme.streak }));
    if (last)
      parts.push(text(colXs[1], 195, `Last: ${fmtDate(last)}`, 'label', 'text-anchor="middle"'));
  }

  if (!hidden(hide, 'longest')) {
    parts.push(
      statTile({
        cx: colXs[2],
        y: 120,
        value: fmt(longest),
        label: 'Longest Streak',
        valueColor: theme.text,
        labelColor: theme.muted,
        valueSize: 40,
      }),
    );
    if (first && last)
      parts.push(
        text(
          colXs[2],
          158,
          `${fmtDate(first)} – ${fmtDate(last)}`,
          'label',
          'text-anchor="middle"',
        ),
      );
  }

  const unavailable = !stats.tokenUsed
    ? text(28, 210, 'GITHUB_TOKEN not set — streaks require authenticated API.', 'label')
    : '';

  return wrapSvg({
    width: WIDTH,
    height: 230,
    title: t,
    children: `<g class="cc-stagger">${parts.join('\n  ')}</g>${unavailable}`,
    theme,
    options,
  });
}

// GitHub top languages card: stacked bar + two-column legend grid.
export function renderGitHubLangs(stats, { theme, title, hide: _hide = [], options = {} } = {}) {
  const t = title || `${stats.username} · Most Used Languages`;
  const limit = Number.isInteger(options.topLangs) ? options.topLangs : 8;
  const langs = (stats.languages || []).slice(0, limit);
  if (langs.length === 0) {
    const children = `${text(28, 35, t, 'title')}${text(28, 80, 'No language data available', 'label')}`;
    return wrapSvg({ width: WIDTH, height: 160, title: t, children, theme, options });
  }
  // Renormalize to the subset so bar + percents sum to 100.
  const total = langs.reduce((a, b) => a + b.bytes, 0);
  const items = langs.map((l) => ({
    name: l.name,
    color: l.color,
    percent: total > 0 ? (l.bytes / total) * 100 : 0,
  }));

  const bar = languageBar({
    x: 28,
    y: 72,
    width: WIDTH - 56,
    items,
    trackColor: theme.grid,
    labelColor: theme.text,
    barHeight: 10,
  });

  const rows = Math.ceil(items.length / 2);
  const height = 90 + rows * 20 + 20;
  const children = `${text(28, 35, t, 'title')}${bar}`;
  return wrapSvg({ width: WIDTH, height, title: t, children, theme, options });
}

// GitHub-only "profile card": compact hero with name, bio-free, repos +
// followers tiles. Lightweight alternative to the full stats card.
export function renderGitHubProfile(stats, { theme, title, hide: _hide = [], options = {} } = {}) {
  const t = title || `${stats.username} · GitHub`;
  const fmt = (n) => (n === null || n === undefined ? '—' : formatNumber(n, options.shortNumbers));
  const name = stats.name ? escapeXml(stats.name) : '';
  const subtitle = name
    ? `${name} · @${escapeXml(stats.username)}`
    : `@${escapeXml(stats.username)}`;
  const children = `
    ${text(28, 35, t, 'title')}
    <text x="28" y="56" class="subtitle">${subtitle}</text>
    <g class="cc-stagger">
      ${statTile({ cx: 110, y: 120, value: fmt(stats.publicRepos), label: 'Repos', valueColor: theme.text, labelColor: theme.muted })}
      ${statTile({ cx: 270, y: 120, value: fmt(stats.followers), label: 'Followers', valueColor: theme.text, labelColor: theme.muted })}
      ${statTile({ cx: 430, y: 120, value: fmt(stats.stars), label: 'Stars', valueColor: theme.text, labelColor: theme.muted })}
    </g>
  `;
  return wrapSvg({ width: WIDTH, height: 180, title: t, children, theme, options });
}
