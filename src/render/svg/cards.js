import {
  wrapSvg,
  text,
  progressBar,
  packChips,
  donutRing,
  statTile,
  streakHero,
} from './primitives.js';
import { escapeXml } from '../../utils/escape.js';

const WIDTH = 540;
const DEFAULT_HEIGHT = 220;

function hidden(hide, field) {
  return Array.isArray(hide) && hide.includes(field);
}

// Formats a number using "short" notation (e.g. 1500 -> 1.5K). When
// `enabled` is false, returns `n.toLocaleString('en-US')`.
export function formatNumber(n, enabled) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return String(n);
  if (!enabled) return n.toLocaleString('en-US');
  const abs = Math.abs(n);
  if (abs < 1000) return String(n);
  if (abs < 1_000_000) return `${(n / 1000).toFixed(abs < 10_000 ? 1 : 0).replace(/\.0$/, '')}K`;
  if (abs < 1_000_000_000)
    return `${(n / 1_000_000).toFixed(abs < 10_000_000 ? 1 : 0).replace(/\.0$/, '')}M`;
  return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
}

// Weekly-heatmap renderer, inlined so composite overview can reuse it.
// Returns `{ svg, height }` relative to top-left `(x, y)` and `widthPx`.
function heatmapBlock({ stats, x, y, widthPx, theme }) {
  const timestamps = stats.activity?.timestamps || stats.activityTimestamps || [];
  const counts = new Map();
  for (const ts of timestamps) {
    const ms = ts > 1e12 ? ts : ts * 1000;
    const d = new Date(ms);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const cellSize = 10;
  const cellGap = 2;
  // 53 weeks ≈ 1 year, but cap by available width.
  const perWeek = cellSize + cellGap;
  const maxWeeks = Math.max(12, Math.floor((widthPx - 20) / perWeek));
  const weeks = Math.min(53, maxWeeks);
  const now = new Date();
  const startDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  startDay.setUTCDate(startDay.getUTCDate() - weeks * 7 + 1);
  const palette = theme.heatmap;
  const maxCount = Math.max(1, ...counts.values());
  const bucketOf = (c) => {
    if (c <= 0) return 0;
    const r = c / maxCount;
    if (r < 0.25) return 1;
    if (r < 0.5) return 2;
    if (r < 0.75) return 3;
    return 4;
  };
  const cells = [];
  for (let w = 0; w < weeks; w += 1) {
    for (let d = 0; d < 7; d += 1) {
      const cur = new Date(startDay);
      cur.setUTCDate(startDay.getUTCDate() + w * 7 + d);
      if (cur > now) continue;
      const key = `${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, '0')}-${String(cur.getUTCDate()).padStart(2, '0')}`;
      const c = counts.get(key) || 0;
      const cx = x + w * perWeek;
      const cy = y + d * perWeek;
      cells.push(
        `<rect x="${cx}" y="${cy}" width="${cellSize}" height="${cellSize}" rx="2" fill="${palette[bucketOf(c)]}" />`,
      );
    }
  }
  const h = 7 * perWeek;
  return { svg: cells.join(''), height: h };
}

export function renderLeetCodeOverview(stats, { theme, title, hide = [], options = {} } = {}) {
  const t = title || `${stats.username} · LeetCode`;
  const fmt = (n) => formatNumber(n, options.shortNumbers);

  const showSolved = !hidden(hide, 'solved');
  const showEasy = !hidden(hide, 'easy');
  const showMedium = !hidden(hide, 'medium');
  const showHard = !hidden(hide, 'hard');
  const showStreak = !hidden(hide, 'streak');
  const showAcceptance = !hidden(hide, 'acceptance') && stats.acceptanceRate !== null;
  const showRanking = !hidden(hide, 'ranking') && stats.ranking !== null;

  // Composite mode activates when `sections` requests sections beyond the
  // hero (skills, languages, heatmap). Card grows wider + taller to fit.
  const sections = Array.isArray(options.sections) ? options.sections : [];
  const wantSkills = sections.includes('skills');
  const wantLangs = sections.includes('languages');
  const wantHeatmap = sections.includes('heatmap');
  const composite = wantSkills || wantLangs || wantHeatmap;

  // Dynamic 2 or 3 column layout. Columns:
  //   LEFT  (cx 92):  solved donut
  //   MID   (bar grid): difficulty bars
  //   RIGHT (cx right): streak hero OR acceptance tile
  const compact = !showStreak && !showAcceptance;
  const baseW = compact ? 480 : 580;
  const cardW = composite ? 780 : baseW;
  const barX = 200;
  const barW = composite ? 300 : 220;

  const subtitle = showRanking
    ? `Ranking #${fmt(stats.ranking)}  ·  ${stats.solved.total}/${stats.available.total} solved`
    : `${stats.solved.total}/${stats.available.total} solved`;

  const parts = [
    text(26, 34, t, 'title'),
    text(26, 54, subtitle, 'subtitle'),
    // Hairline divider under header for visual anchor.
    `<line x1="26" y1="68" x2="${cardW - 26}" y2="68" stroke="${theme.border}" stroke-opacity="0.5" stroke-width="1" />`,
  ];

  if (showSolved) {
    parts.push(
      donutRing({
        cx: 92,
        cy: 160,
        r: 46,
        strokeWidth: 8,
        value: stats.solved.total,
        max: stats.available.total,
        color: theme.ring || theme.accent,
        trackColor: theme.grid,
        centerText: fmt(stats.solved.total),
        centerSub: 'solved',
        centerColor: theme.text,
        subColor: theme.muted,
        centerSize: 24,
      }),
    );
  }

  // Difficulty rows — label left, counts right, bar below. Low-opacity track
  // keeps the bar visually unified with the fill color across any theme.
  const diffRows = [
    showEasy && ['Easy', stats.solved.easy, stats.available.easy, theme.easy],
    showMedium && ['Medium', stats.solved.medium, stats.available.medium, theme.medium],
    showHard && ['Hard', stats.solved.hard, stats.available.hard, theme.hard],
  ].filter(Boolean);

  const rowH = 36;
  const barsBlockH = diffRows.length * rowH;
  const barsStartY = 108 + Math.max(0, (3 * rowH - barsBlockH) / 2);
  const barParts = [];
  diffRows.forEach((row, i) => {
    const [label, value, max, color] = row;
    const bY = barsStartY + i * rowH;
    barParts.push(
      text(barX, bY, label, 'label', `font-size="12" font-weight="600" fill="${color}"`),
      text(
        barX + barW,
        bY,
        `${fmt(value)} / ${fmt(max)}`,
        'value',
        'text-anchor="end" font-size="11" font-weight="500"',
      ),
      progressBar({
        x: barX,
        y: bY + 7,
        width: barW,
        height: 6,
        value,
        max,
        color,
      }),
    );
  });
  if (barParts.length > 0) parts.push(`<g class="cc-stagger">${barParts.join('')}</g>`);

  // Streak / acceptance anchored to right-hand column, which shifts with cardW.
  const rightCx = cardW - 80;
  if (showStreak) {
    const curVal = stats.streak.current;
    parts.push(
      streakHero({
        cx: rightCx,
        cy: 155,
        r: 36,
        strokeWidth: 4,
        ringColor: theme.ring || theme.streak,
        fireColor: theme.fire || theme.streak,
        numberColor: theme.streak,
        labelColor: theme.muted,
        numberText: curVal,
        labelText: 'Current Streak',
      }),
    );
  } else if (showAcceptance) {
    parts.push(
      statTile({
        cx: rightCx,
        y: 168,
        value: `${stats.acceptanceRate}%`,
        label: 'acceptance',
        valueColor: theme.text,
        labelColor: theme.muted,
      }),
    );
  }

  const heroHeight = 240;
  let currentY = heroHeight;
  const extra = [];

  // Composite sections appended below hero with hairline divider on top.
  const addDivider = () => {
    extra.push(
      `<line x1="26" y1="${currentY - 1}" x2="${cardW - 26}" y2="${currentY - 1}" stroke="${theme.border}" stroke-opacity="0.5" stroke-width="1" />`,
    );
  };

  if (wantSkills) {
    addDivider();
    const skillsLimit = Number.isInteger(options.topSkills) ? options.topSkills : 12;
    const skills = (stats.skills || []).slice(0, skillsLimit);
    extra.push(text(26, currentY + 22, 'Skills', 'section'));
    if (skills.length === 0) {
      extra.push(text(26, currentY + 46, 'No skills data available', 'label'));
      currentY += 70;
    } else {
      const items = skills.map((s) => ({
        label: `${s.name} ×${s.solved}`,
        fill: theme.chip,
        textColor: theme.chipText,
        borderColor: theme.border,
      }));
      const packed = packChips(items, { x: 26, y: currentY + 32, maxWidth: cardW - 52 });
      extra.push(packed.svg);
      currentY += 42 + packed.height;
    }
  }

  if (wantLangs) {
    addDivider();
    const langLimit = Number.isInteger(options.topLangs) ? options.topLangs : 12;
    const langs = (stats.languages || []).slice(0, langLimit);
    extra.push(text(26, currentY + 22, 'Languages', 'section'));
    if (langs.length === 0) {
      extra.push(text(26, currentY + 46, 'No language data available', 'label'));
      currentY += 70;
    } else {
      const items = langs.map((l) => ({
        label: `${l.name} ×${l.solved}`,
        fill: theme.chip,
        textColor: theme.chipText,
        borderColor: theme.accent,
      }));
      const packed = packChips(items, { x: 26, y: currentY + 32, maxWidth: cardW - 52 });
      extra.push(packed.svg);
      currentY += 42 + packed.height;
    }
  }

  if (wantHeatmap) {
    addDivider();
    extra.push(text(26, currentY + 22, 'Submission heatmap', 'section'));
    const hm = heatmapBlock({
      stats,
      x: 26,
      y: currentY + 36,
      widthPx: cardW - 52,
      theme,
    });
    extra.push(hm.svg);
    currentY += 42 + hm.height + 10;
  }

  const height = currentY;
  const limited = stats.streak.limited
    ? text(26, height - 14, 'Streak based on available calendar window', 'label')
    : '';

  return wrapSvg({
    width: cardW,
    height,
    title: t,
    children: `${parts.join('\n  ')}${extra.join('\n  ')}${limited}`,
    theme,
    options,
  });
}

export function renderLeetCodeProblems(stats, { theme, title, hide = [], options = {} } = {}) {
  const t = title || `${stats.username} · Problems`;
  const bar = (y, label, value, max, color) => {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return `${text(25, y, label, 'label')}${text(WIDTH - 25, y, `${value} / ${max} (${pct}%)`, 'value', 'text-anchor="end"')}${progressBar(
      { x: 25, y: y + 6, width: WIDTH - 50, height: 8, value, max, color, trackColor: theme.grid },
    )}`;
  };
  const parts = [text(25, 35, t, 'title')];
  let y = 70;
  if (!hidden(hide, 'easy')) {
    parts.push(bar(y, 'Easy', stats.solved.easy, stats.available.easy, theme.easy));
    y += 40;
  }
  if (!hidden(hide, 'medium')) {
    parts.push(bar(y, 'Medium', stats.solved.medium, stats.available.medium, theme.medium));
    y += 40;
  }
  if (!hidden(hide, 'hard')) {
    parts.push(bar(y, 'Hard', stats.solved.hard, stats.available.hard, theme.hard));
    y += 40;
  }
  return wrapSvg({
    width: WIDTH,
    height: Math.max(DEFAULT_HEIGHT, y + 10),
    title: t,
    children: parts.join('\n  '),
    theme,
    options,
  });
}

// Three-column streak hero: Total / Current (ring + flame + glow) / Longest.
// Mid column uses mask-cut ring so the flame sits in a notch at the top.
export function renderStreakCard(stats, { theme, title, hide = [], options = {} } = {}) {
  const t = title || `${stats.username} · Streak`;
  const fmt = (n) => formatNumber(n, options.shortNumbers);

  const total = stats.streak.totalActiveDays;
  const cur = stats.streak.current;
  const longest = stats.streak.longest;
  const fmtDate = (iso) => {
    if (!iso || typeof iso !== 'string') return '';
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
    const mi = Number.parseInt(m, 10) - 1;
    const label = months[mi] || '';
    return `${label} ${Number.parseInt(d, 10)}, ${y}`;
  };
  const lastLabel =
    stats.streak.lastActiveDate && cur > 0 ? `Last: ${fmtDate(stats.streak.lastActiveDate)}` : '';

  // 3 equal columns across a 500px canvas (margin 20).
  const cardW = 500;
  const colXs = [cardW / 6, cardW / 2, (5 * cardW) / 6];
  const parts = [text(20, 32, t, 'title')];

  const cy = 128;

  if (!hidden(hide, 'total')) {
    parts.push(`<g>
      <text x="${colXs[0]}" y="${cy + 8}" text-anchor="middle" font-size="26" font-weight="800" fill="${theme.text}">${fmt(total)}</text>
      <text x="${colXs[0]}" y="${cy + 36}" text-anchor="middle" font-size="11" font-weight="700" letter-spacing="0.06em" fill="${theme.muted}">Active days</text>
    </g>`);
  }

  if (!hidden(hide, 'streak')) {
    parts.push(
      streakHero({
        cx: colXs[1],
        cy,
        r: 42,
        strokeWidth: 4,
        ringColor: theme.ring || theme.streak,
        fireColor: theme.fire || theme.streak,
        numberColor: theme.streak,
        labelColor: theme.muted,
        numberText: fmt(cur),
        labelText: 'Current Streak',
      }),
    );
  }

  if (!hidden(hide, 'active')) {
    parts.push(`<g>
      <text x="${colXs[2]}" y="${cy + 8}" text-anchor="middle" font-size="26" font-weight="800" fill="${theme.text}">${fmt(longest)}</text>
      <text x="${colXs[2]}" y="${cy + 36}" text-anchor="middle" font-size="11" font-weight="700" letter-spacing="0.06em" fill="${theme.muted}">Highest Streak</text>
    </g>`);
  }

  const lastNote = lastLabel
    ? text(cardW / 2, 210, lastLabel, 'label', 'text-anchor="middle" font-size="10"')
    : '';
  const limitedNote = stats.streak.limited
    ? text(20, 225, 'Streak uses the submission calendar window exposed by LeetCode.', 'label')
    : '';

  return wrapSvg({
    width: cardW,
    height: 240,
    title: t,
    children: `<g class="cc-stagger">${parts.join('\n  ')}</g>${lastNote}${limitedNote}`,
    theme,
    options,
  });
}

export function renderCodeforcesRating(stats, { theme, title, hide = [], options = {} } = {}) {
  const t = title || `Codeforces · ${stats.username}`;
  const rows = [];
  let y = 70;
  const addRow = (label, value, cls = 'value') => {
    rows.push(text(25, y, label, 'label'));
    rows.push(text(WIDTH - 25, y, String(value), cls, 'text-anchor="end"'));
    y += 26;
  };
  if (!hidden(hide, 'rating')) addRow('Current rating', stats.currentRating ?? 'unrated');
  if (!hidden(hide, 'maxRating')) addRow('Max rating', stats.maxRating ?? 'unrated');
  if (!hidden(hide, 'rank')) addRow('Rank', stats.rank ?? '—');
  if (!hidden(hide, 'maxRank')) addRow('Max rank', stats.maxRank ?? '—');
  if (!hidden(hide, 'contests')) addRow('Contests', stats.contests);
  if (!hidden(hide, 'solved')) addRow('Solved', stats.solved.total);

  // Rating graph (optional)
  let graph = '';
  if (!hidden(hide, 'graph') && stats.ratingHistory.length >= 2) {
    const pts = stats.ratingHistory;
    const minR = Math.min(...pts.map((p) => p.newRating));
    const maxR = Math.max(...pts.map((p) => p.newRating));
    const span = Math.max(1, maxR - minR);
    const gx = 25;
    const gy = y + 10;
    const gw = WIDTH - 50;
    const gh = 60;
    const path = pts
      .map((p, i) => {
        const px = gx + (i / (pts.length - 1)) * gw;
        const py = gy + gh - ((p.newRating - minR) / span) * gh;
        return `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`;
      })
      .join(' ');
    graph = `<path d="${path}" fill="none" stroke="${theme.accent}" stroke-width="2" />`;
    y = gy + gh + 10;
  }

  const children = `${text(25, 35, t, 'title')}${rows.join('\n  ')}${graph}`;
  return wrapSvg({
    width: WIDTH,
    height: Math.max(DEFAULT_HEIGHT, y),
    title: t,
    children,
    theme,
    options,
  });
}

export function renderHeatmap(stats, { theme, title, hide: _hide = [], options = {} } = {}) {
  const t = title || `${stats.username} · Activity`;
  const timestamps = stats.activity?.timestamps || stats.activityTimestamps || [];
  const counts = new Map();
  for (const ts of timestamps) {
    const ms = ts > 1e12 ? ts : ts * 1000;
    const d = new Date(ms);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const cellSize = 10;
  const cellGap = 2;
  const weeks = 30;
  const now = new Date();
  const startDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  startDay.setUTCDate(startDay.getUTCDate() - weeks * 7 + 1);

  const palette = theme.heatmap;
  const maxCount = Math.max(1, ...counts.values());
  const bucketOf = (c) => {
    if (c <= 0) return 0;
    const r = c / maxCount;
    if (r < 0.25) return 1;
    if (r < 0.5) return 2;
    if (r < 0.75) return 3;
    return 4;
  };

  const cells = [];
  for (let w = 0; w < weeks; w += 1) {
    for (let d = 0; d < 7; d += 1) {
      const cur = new Date(startDay);
      cur.setUTCDate(startDay.getUTCDate() + w * 7 + d);
      if (cur > now) continue;
      const key = `${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, '0')}-${String(cur.getUTCDate()).padStart(2, '0')}`;
      const c = counts.get(key) || 0;
      const bucket = bucketOf(c);
      const x = 25 + w * (cellSize + cellGap);
      const y = 60 + d * (cellSize + cellGap);
      cells.push(
        `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="2" fill="${palette[bucket]}" />`,
      );
    }
  }

  const height = 60 + 7 * (cellSize + cellGap) + 20;
  const children = `${text(25, 35, t, 'title')}${cells.join('')}`;
  return wrapSvg({ width: WIDTH, height, title: t, children, theme, options });
}

export function renderSkills(stats, { theme, title, hide: _hide = [], options = {} } = {}) {
  const t = title || `${stats.username} · Top Skills`;
  const limit = Number.isInteger(options.topSkills) ? options.topSkills : 12;
  const skills = (stats.skills || []).slice(0, limit);
  if (skills.length === 0) {
    const children = `${text(25, 35, t, 'title')}${text(25, 70, 'No skills data available', 'label')}`;
    return wrapSvg({ width: WIDTH, height: DEFAULT_HEIGHT, title: t, children, theme, options });
  }
  const items = skills.map((s) => ({
    label: `${s.name} ×${s.solved}`,
    fill: theme.chip,
    textColor: theme.chipText,
    borderColor: theme.border,
  }));
  const packed = packChips(items, { x: 25, y: 60, maxWidth: WIDTH - 50 });
  const height = Math.max(DEFAULT_HEIGHT, 60 + packed.height + 20);
  const children = `${text(25, 35, t, 'title')}${packed.svg}`;
  return wrapSvg({ width: WIDTH, height, title: t, children, theme, options });
}

export function renderLanguages(stats, { theme, title, hide: _hide = [], options = {} } = {}) {
  const t = title || `${stats.username} · Languages`;
  const limit = Number.isInteger(options.topLangs) ? options.topLangs : 12;
  const langs = (stats.languages || []).slice(0, limit);
  if (langs.length === 0) {
    const children = `${text(25, 35, t, 'title')}${text(25, 70, 'No language data available', 'label')}`;
    return wrapSvg({ width: WIDTH, height: DEFAULT_HEIGHT, title: t, children, theme, options });
  }
  const items = langs.map((l) => ({
    label: `${l.name} ×${l.solved}`,
    fill: theme.chip,
    textColor: theme.chipText,
    borderColor: theme.accent,
  }));
  const packed = packChips(items, { x: 25, y: 60, maxWidth: WIDTH - 50 });
  const height = Math.max(DEFAULT_HEIGHT, 60 + packed.height + 20);
  const children = `${text(25, 35, t, 'title')}${packed.svg}`;
  return wrapSvg({ width: WIDTH, height, title: t, children, theme, options });
}

export function renderCombined(leet, cf, gh, { theme, title, hide = [], options = {} } = {}) {
  const name = leet?.username || cf?.username || gh?.username || 'profile';
  const t = title || `${escapeXml(name)} · Competitive Programming`;
  const fmt = (n) => formatNumber(n, options.shortNumbers);
  const rows = [text(25, 35, t, 'title')];
  let y = 70;
  const addRow = (label, value, cls = 'value') => {
    rows.push(text(25, y, label, 'label'));
    rows.push(text(WIDTH - 25, y, String(value), cls, 'text-anchor="end"'));
    y += 24;
  };
  const section = (name) => {
    rows.push(text(25, y, name, 'value', 'font-weight="700"'));
    y += 22;
  };
  if (leet && !hidden(hide, 'leetcode')) {
    section('LeetCode');
    addRow('  solved', `${fmt(leet.solved.total)} / ${fmt(leet.available.total)}`);
    if (!hidden(hide, 'ranking') && leet.ranking !== null)
      addRow('  ranking', `#${fmt(leet.ranking)}`);
    if (!hidden(hide, 'streak')) addRow('  streak', `${leet.streak.current} d`, 'streak');
    y += 6;
  }
  if (cf && !hidden(hide, 'codeforces')) {
    section('Codeforces');
    addRow('  rating', `${cf.currentRating ?? 'unrated'} (max ${cf.maxRating ?? '—'})`);
    if (!hidden(hide, 'rank')) addRow('  rank', cf.rank ?? '—');
    if (!hidden(hide, 'solved')) addRow('  solved', fmt(cf.solved.total));
    y += 6;
  }
  if (gh && !hidden(hide, 'github')) {
    section('GitHub');
    addRow('  repos', fmt(gh.publicRepos));
    addRow('  stars', fmt(gh.stars));
    if (gh.contrib !== null) addRow('  contrib (yr)', fmt(gh.contrib));
    if (gh.currentStreak !== null) addRow('  streak', `${gh.currentStreak} d`, 'streak');
  }
  return wrapSvg({
    width: WIDTH,
    height: Math.max(DEFAULT_HEIGHT, y + 10),
    title: t,
    children: rows.join('\n  '),
    theme,
    options,
  });
}
