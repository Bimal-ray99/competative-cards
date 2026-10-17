import {
  wrapSvg,
  text,
  progressBar,
  packChips,
  streakHero,
  receiptRow,
  perforatedLine,
  hexBadge,
  computeGrade,
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

// Shared receipt-style block renderer. Returns `{ svg, height }` placed at
// `(x, y)` within a canvas of `width` px. Composable: overview + CF + duet
// all build with this. Row types:
//   { label, value, color?, bold?, fontSize? }   — dotted-leader row
//   { divider: true, strong? }                   — perforated divider
//   { spacer: 10 }                               — vertical space
export function receiptBlock({ x, y, width, title, subtitle, meta, rows, footer, theme }) {
  const pad = 20;
  const monoFont = 'ui-monospace, SF Mono, Consolas, "Liberation Mono", monospace';
  const rowX = x + pad;
  const rowW = width - pad * 2;
  const parts = [];
  let cy = y;

  parts.push(perforatedLine({ x1: x + pad, x2: x + width - pad, y: cy + 10, color: theme.muted }));
  cy += 28;

  parts.push(
    `<text x="${x + width / 2}" y="${cy}" text-anchor="middle" font-family='${monoFont}' font-size="15" font-weight="800" letter-spacing="0.14em" fill="${theme.title}">${escapeXml(String(title))}</text>`,
  );
  cy += 18;

  if (subtitle) {
    parts.push(
      `<text x="${x + width / 2}" y="${cy}" text-anchor="middle" font-family='${monoFont}' font-size="11" font-weight="500" letter-spacing="0.06em" fill="${theme.muted}">${escapeXml(String(subtitle))}</text>`,
    );
    cy += 16;
  }
  if (meta) {
    parts.push(
      `<text x="${x + width / 2}" y="${cy}" text-anchor="middle" font-family='${monoFont}' font-size="10" font-weight="400" fill="${theme.muted}">${escapeXml(String(meta))}</text>`,
    );
    cy += 14;
  }

  cy += 8;
  parts.push(
    perforatedLine({ x1: x + pad, x2: x + width - pad, y: cy, color: theme.muted }),
  );
  cy += 18;

  const rowBodies = [];
  for (const row of rows) {
    if (!row) continue;
    if (row.divider) {
      cy += 2;
      parts.push(
        perforatedLine({
          x1: x + pad,
          x2: x + width - pad,
          y: cy,
          color: row.strong ? theme.muted : theme.border,
          dash: row.strong ? 4 : 2,
          gap: row.strong ? 4 : 3,
        }),
      );
      cy += 10;
      continue;
    }
    if (row.spacer) {
      cy += row.spacer;
      continue;
    }
    const fs = row.fontSize || 13;
    rowBodies.push(
      receiptRow({
        x: rowX,
        y: cy + fs,
        width: rowW,
        label: row.label,
        value: row.value,
        labelColor: row.color || theme.text,
        valueColor: row.valueColor || theme.text,
        dotColor: theme.border,
        bold: !!row.bold,
        fontSize: fs,
      }),
    );
    cy += fs + 10;
  }
  if (rowBodies.length > 0) parts.push(`<g class="cc-stagger">${rowBodies.join('')}</g>`);

  if (footer) {
    cy += 6;
    parts.push(
      perforatedLine({ x1: x + pad, x2: x + width - pad, y: cy, color: theme.border, dash: 2, gap: 3 }),
    );
    cy += 20;
    parts.push(
      `<text x="${x + width / 2}" y="${cy}" text-anchor="middle" font-family='${monoFont}' font-size="10" font-weight="700" letter-spacing="0.14em" fill="${theme.muted}">${escapeXml(footer)}</text>`,
    );
    cy += 10;
  }

  cy += 8;
  parts.push(perforatedLine({ x1: x + pad, x2: x + width - pad, y: cy, color: theme.muted }));
  cy += 10;

  return { svg: parts.join('\n  '), height: cy - y };
}

// Row-builder for LeetCode receipt. Returns `rows` array suitable for
// `receiptBlock`. Used by overview card + duet card so both share formatting.
function buildLeetCodeRows(stats, hide, options) {
  const fmt = (n) => formatNumber(n, options?.shortNumbers);
  const show = (k) => !hidden(hide, k);
  const rows = [];
  if (show('easy'))
    rows.push({
      label: 'Easy',
      value: `${fmt(stats.solved.easy)} / ${fmt(stats.available.easy)}`,
      color: options?.theme?.easy || '#00b8a3',
      valueColor: options?.theme?.text,
    });
  if (show('medium'))
    rows.push({
      label: 'Medium',
      value: `${fmt(stats.solved.medium)} / ${fmt(stats.available.medium)}`,
      color: options?.theme?.medium || '#ffc01e',
      valueColor: options?.theme?.text,
    });
  if (show('hard'))
    rows.push({
      label: 'Hard',
      value: `${fmt(stats.solved.hard)} / ${fmt(stats.available.hard)}`,
      color: options?.theme?.hard || '#ff375f',
      valueColor: options?.theme?.text,
    });
  rows.push({ divider: true });
  if (show('solved'))
    rows.push({
      label: 'TOTAL',
      value: `${fmt(stats.solved.total)} / ${fmt(stats.available.total)}`,
      color: options?.theme?.text,
      valueColor: options?.theme?.title,
      bold: true,
      fontSize: 14,
    });
  if (show('acceptance') && stats.acceptanceRate !== null)
    rows.push({
      label: 'Acceptance',
      value: `${stats.acceptanceRate}%`,
      color: options?.theme?.muted,
      valueColor: options?.theme?.text,
    });
  if (show('streak'))
    rows.push({
      label: 'Current Streak',
      value: `${stats.streak.current} days`,
      color: options?.theme?.streak,
      valueColor: options?.theme?.streak,
      bold: true,
    });
  return rows;
}

// Receipt-style LeetCode overview. Mono font, dotted leader lines, perforated
// edges top + bottom like a tear-off receipt. Original look — zero clones
// use this format for stats cards.
export function renderLeetCodeOverview(stats, { theme, title, hide = [], options = {} } = {}) {
  const t = title || `COMPETITIVE SOLVES`;
  const fmt = (n) => formatNumber(n, options.shortNumbers);

  const showSolved = !hidden(hide, 'solved');
  const showEasy = !hidden(hide, 'easy');
  const showMedium = !hidden(hide, 'medium');
  const showHard = !hidden(hide, 'hard');
  const showStreak = !hidden(hide, 'streak');
  const showAcceptance = !hidden(hide, 'acceptance') && stats.acceptanceRate !== null;
  const showRanking = !hidden(hide, 'ranking') && stats.ranking !== null;

  const sections = Array.isArray(options.sections) ? options.sections : [];
  const wantSkills = sections.includes('skills');
  const wantLangs = sections.includes('languages');
  const wantHeatmap = sections.includes('heatmap');
  const composite = wantSkills || wantLangs || wantHeatmap;

  // Narrower, tighter column. Receipt layout is single-column vertical.
  const cardW = composite ? 540 : 420;
  const pad = 24;
  const rowX = pad;
  const rowW = cardW - pad * 2;

  const monoFont = 'ui-monospace, SF Mono, Consolas, "Liberation Mono", monospace';

  const parts = [];

  // Perforated top edge.
  parts.push(perforatedLine({ x1: pad, x2: cardW - pad, y: 14, color: theme.muted }));

  // Header block — big centered title in mono.
  parts.push(
    `<text x="${cardW / 2}" y="42" text-anchor="middle" font-family='${monoFont}' font-size="16" font-weight="800" letter-spacing="0.14em" fill="${theme.title}">${escapeXml(t)}</text>`,
  );
  parts.push(
    `<text x="${cardW / 2}" y="60" text-anchor="middle" font-family='${monoFont}' font-size="11" font-weight="500" letter-spacing="0.06em" fill="${theme.muted}">@${escapeXml(stats.username)}</text>`,
  );

  // Date + rank meta
  const dateStr = new Date().toISOString().slice(0, 10);
  parts.push(
    `<text x="${cardW / 2}" y="76" text-anchor="middle" font-family='${monoFont}' font-size="10" font-weight="400" fill="${theme.muted}">${dateStr}${showRanking ? '  ·  rank #' + fmt(stats.ranking) : ''}</text>`,
  );

  parts.push(perforatedLine({ x1: pad, x2: cardW - pad, y: 92, color: theme.muted }));

  // Dotted-leader rows — difficulty breakdown
  let rY = 118;
  const rowGap = 24;
  const rowGroup = [];

  if (showEasy)
    rowGroup.push(
      receiptRow({
        x: rowX,
        y: rY,
        width: rowW,
        label: 'Easy',
        value: `${fmt(stats.solved.easy)} / ${fmt(stats.available.easy)}`,
        labelColor: theme.easy,
        valueColor: theme.text,
        dotColor: theme.border,
      }),
    );
  if (showEasy) rY += rowGap;
  if (showMedium)
    rowGroup.push(
      receiptRow({
        x: rowX,
        y: rY,
        width: rowW,
        label: 'Medium',
        value: `${fmt(stats.solved.medium)} / ${fmt(stats.available.medium)}`,
        labelColor: theme.medium,
        valueColor: theme.text,
        dotColor: theme.border,
      }),
    );
  if (showMedium) rY += rowGap;
  if (showHard)
    rowGroup.push(
      receiptRow({
        x: rowX,
        y: rY,
        width: rowW,
        label: 'Hard',
        value: `${fmt(stats.solved.hard)} / ${fmt(stats.available.hard)}`,
        labelColor: theme.hard,
        valueColor: theme.text,
        dotColor: theme.border,
      }),
    );
  if (showHard) rY += rowGap;

  // Dashed separator before summary
  rY += 4;
  parts.push(
    perforatedLine({ x1: pad, x2: cardW - pad, y: rY - 10, color: theme.border, dash: 2, gap: 3 }),
  );

  if (showSolved)
    rowGroup.push(
      receiptRow({
        x: rowX,
        y: rY,
        width: rowW,
        label: 'TOTAL',
        value: `${fmt(stats.solved.total)} / ${fmt(stats.available.total)}`,
        labelColor: theme.text,
        valueColor: theme.title,
        dotColor: theme.border,
        bold: true,
        fontSize: 14,
      }),
    );
  if (showSolved) rY += 28;

  if (showAcceptance)
    rowGroup.push(
      receiptRow({
        x: rowX,
        y: rY,
        width: rowW,
        label: 'Acceptance',
        value: `${stats.acceptanceRate}%`,
        labelColor: theme.muted,
        valueColor: theme.text,
        dotColor: theme.border,
      }),
    );
  if (showAcceptance) rY += rowGap;

  if (showStreak)
    rowGroup.push(
      receiptRow({
        x: rowX,
        y: rY,
        width: rowW,
        label: 'Current Streak',
        value: `${stats.streak.current} days`,
        labelColor: theme.streak,
        valueColor: theme.streak,
        dotColor: theme.border,
        bold: true,
      }),
    );
  if (showStreak) rY += rowGap;

  parts.push(`<g class="cc-stagger">${rowGroup.join('')}</g>`);

  // Thank-you footer line
  rY += 6;
  parts.push(
    perforatedLine({ x1: pad, x2: cardW - pad, y: rY, color: theme.muted, dash: 2, gap: 3 }),
  );
  rY += 20;
  parts.push(
    `<text x="${cardW / 2}" y="${rY}" text-anchor="middle" font-family='${monoFont}' font-size="10" font-weight="700" letter-spacing="0.12em" fill="${theme.muted}">— KEEP SOLVING —</text>`,
  );
  rY += 16;

  const heroHeight = rY + 12;
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

// Codeforces rank color accents — standard CF title tiers. Used to tint the
// "Rank" row label so grandmasters / IMs look visually distinct.
const CF_RANK_COLORS = {
  newbie: '#808080',
  pupil: '#008000',
  specialist: '#03a89e',
  expert: '#0000ff',
  'candidate master': '#a600a6',
  master: '#ff8c00',
  'international master': '#ff8c00',
  grandmaster: '#ff0000',
  'international grandmaster': '#ff0000',
  'legendary grandmaster': '#ff0000',
  tourist: '#ff0000',
};
function cfRankColor(rank, fallback) {
  if (typeof rank !== 'string') return fallback;
  return CF_RANK_COLORS[rank.toLowerCase()] || fallback;
}

// Row-builder for Codeforces receipt. Shared by rating card + duet.
function buildCfRows(stats, hide, options) {
  const fmt = (n) => formatNumber(n, options?.shortNumbers);
  const show = (k) => !hidden(hide, k);
  const theme = options?.theme || {};
  const rankColor = cfRankColor(stats.rank, theme.title);
  const rows = [];
  if (show('rating'))
    rows.push({
      label: 'Current rating',
      value: stats.currentRating ?? 'unrated',
      color: theme.text,
      valueColor: rankColor,
      bold: true,
    });
  if (show('maxRating'))
    rows.push({
      label: 'Max rating',
      value: stats.maxRating ?? 'unrated',
      color: theme.muted,
      valueColor: theme.text,
    });
  rows.push({ divider: true });
  if (show('rank'))
    rows.push({
      label: 'Rank',
      value: stats.rank ?? '—',
      color: theme.muted,
      valueColor: rankColor,
      bold: true,
    });
  if (show('maxRank'))
    rows.push({
      label: 'Max rank',
      value: stats.maxRank ?? '—',
      color: theme.muted,
      valueColor: cfRankColor(stats.maxRank, theme.text),
    });
  rows.push({ divider: true });
  if (show('contests'))
    rows.push({
      label: 'Contests',
      value: fmt(stats.contests),
      color: theme.muted,
      valueColor: theme.text,
    });
  if (show('solved'))
    rows.push({
      label: 'Problems solved',
      value: fmt(stats.solved.total),
      color: theme.text,
      valueColor: theme.title,
      bold: true,
      fontSize: 14,
    });
  return rows;
}

// Codeforces receipt — mirrors LeetCode overview styling. Optional sparkline
// graph of rating history appended below the receipt block.
export function renderCodeforcesRating(stats, { theme, title, hide = [], options = {} } = {}) {
  const t = title || `CODEFORCES PROFILE`;
  const fmt = (n) => formatNumber(n, options.shortNumbers);
  const dateStr = new Date().toISOString().slice(0, 10);
  const rankColor = cfRankColor(stats.rank, theme.title);

  const rows = [];
  if (!hidden(hide, 'rating'))
    rows.push({
      label: 'Current rating',
      value: stats.currentRating ?? 'unrated',
      color: theme.text,
      valueColor: rankColor,
      bold: true,
    });
  if (!hidden(hide, 'maxRating'))
    rows.push({
      label: 'Max rating',
      value: stats.maxRating ?? 'unrated',
      color: theme.muted,
      valueColor: theme.text,
    });
  if (!hidden(hide, 'rank'))
    rows.push({ divider: true });
  if (!hidden(hide, 'rank'))
    rows.push({
      label: 'Rank',
      value: stats.rank ?? '—',
      color: theme.muted,
      valueColor: rankColor,
      bold: true,
    });
  if (!hidden(hide, 'maxRank'))
    rows.push({
      label: 'Max rank',
      value: stats.maxRank ?? '—',
      color: theme.muted,
      valueColor: cfRankColor(stats.maxRank, theme.text),
    });
  rows.push({ divider: true });
  if (!hidden(hide, 'contests'))
    rows.push({
      label: 'Contests',
      value: fmt(stats.contests),
      color: theme.muted,
      valueColor: theme.text,
    });
  if (!hidden(hide, 'solved'))
    rows.push({
      label: 'Problems solved',
      value: fmt(stats.solved.total),
      color: theme.text,
      valueColor: theme.title,
      bold: true,
      fontSize: 14,
    });

  const cardW = 420;
  const block = receiptBlock({
    x: 0,
    y: 0,
    width: cardW,
    title: t,
    subtitle: `@${stats.username}`,
    meta: dateStr,
    rows,
    footer: '— ONE MORE CONTEST —',
    theme,
  });

  // Rating sparkline below (optional)
  let graph = '';
  let graphH = 0;
  if (!hidden(hide, 'graph') && stats.ratingHistory.length >= 2) {
    const pts = stats.ratingHistory;
    const minR = Math.min(...pts.map((p) => p.newRating));
    const maxR = Math.max(...pts.map((p) => p.newRating));
    const span = Math.max(1, maxR - minR);
    const gx = 24;
    const gy = block.height + 10;
    const gw = cardW - 48;
    const gh = 60;
    const path = pts
      .map((p, i) => {
        const px = gx + (i / (pts.length - 1)) * gw;
        const py = gy + gh - ((p.newRating - minR) / span) * gh;
        return `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`;
      })
      .join(' ');
    graph = `
      <text x="${gx}" y="${gy - 6}" font-size="10" font-weight="700" letter-spacing="0.1em" fill="${theme.muted}">RATING HISTORY</text>
      <path d="${path}" fill="none" stroke="${rankColor}" stroke-width="2" />
      <text x="${gx}" y="${gy + gh + 14}" font-size="9" fill="${theme.muted}">min ${minR}</text>
      <text x="${gx + gw}" y="${gy + gh + 14}" text-anchor="end" font-size="9" fill="${theme.muted}">max ${maxR}</text>
    `;
    graphH = gh + 30;
  }

  return wrapSvg({
    width: cardW,
    height: block.height + graphH + 10,
    title: t,
    children: `${block.svg}${graph}`,
    theme,
    options,
  });
}

// Duet: two full receipt blocks side-by-side in one canvas, one per provider.
// Different layout from `combined` (which is CPI hex badge + tiles) — this is
// the "both full cards in one SVG" variant for a profile README that wants
// both receipts without using two <img> tags.
export function renderDuet(leet, cf, { theme, title, hide = [], options = {} } = {}) {
  const name = leet?.username || cf?.username || 'profile';
  const t = title || `${escapeXml(name)} · DUET`;
  const fmt = (n) => formatNumber(n, options.shortNumbers);

  const colW = 400;
  const gap = 16;
  const marginX = 20;
  const headerH = 56;
  const cardW = marginX * 2 + colW * 2 + gap;
  const dateStr = new Date().toISOString().slice(0, 10);

  const blocks = [];
  let colHeights = [0, 0];

  if (leet) {
    const lcRows = buildLeetCodeRows(leet, hide, { ...options, theme });
    const lcMeta = leet.ranking !== null ? `${dateStr}  ·  rank #${fmt(leet.ranking)}` : dateStr;
    const b = receiptBlock({
      x: marginX,
      y: headerH,
      width: colW,
      title: 'LEETCODE',
      subtitle: `@${leet.username}`,
      meta: lcMeta,
      rows: lcRows,
      footer: '— KEEP SOLVING —',
      theme,
    });
    blocks.push(b.svg);
    colHeights[0] = b.height;
  }
  if (cf) {
    const cfRows = buildCfRows(cf, hide, { ...options, theme });
    const b = receiptBlock({
      x: marginX + colW + gap,
      y: headerH,
      width: colW,
      title: 'CODEFORCES',
      subtitle: `@${cf.username}`,
      meta: dateStr,
      rows: cfRows,
      footer: '— ONE MORE CONTEST —',
      theme,
    });
    blocks.push(b.svg);
    colHeights[1] = b.height;
  }

  // Shared header above both receipts
  const header = `
    <text x="${marginX}" y="30" font-family="ui-monospace, SF Mono, Consolas, monospace" font-size="18" font-weight="800" letter-spacing="0.1em" fill="${theme.title}">${escapeXml(String(t))}</text>
    <text x="${marginX}" y="46" font-family="ui-monospace, SF Mono, Consolas, monospace" font-size="11" font-weight="500" letter-spacing="0.08em" fill="${theme.muted}">COMPETITIVE PROGRAMMING STATEMENT</text>
    <line x1="${marginX}" y1="${headerH - 4}" x2="${cardW - marginX}" y2="${headerH - 4}" stroke="${theme.border}" stroke-opacity="0.4" stroke-width="1" />
  `;

  const cardH = headerH + Math.max(...colHeights) + 20;

  return wrapSvg({
    width: cardW,
    height: cardH,
    title: t,
    children: `${header}${blocks.join('\n  ')}`,
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

// Compute a unified "Competitive Programming Index" from LC + CF stats.
// Weighted blend normalized to 0..100 + letter grade. Pure function so it
// stays testable + deterministic.
function computeCpi(leet, cf) {
  // LeetCode subscore (0..100): weighted solved progress + log-scaled streak
  let lcScore = null;
  if (leet) {
    const easyR = leet.available.easy > 0 ? leet.solved.easy / leet.available.easy : 0;
    const medR = leet.available.medium > 0 ? leet.solved.medium / leet.available.medium : 0;
    const hardR = leet.available.hard > 0 ? leet.solved.hard / leet.available.hard : 0;
    const solveMix = easyR * 0.15 + medR * 0.5 + hardR * 0.35;
    const streakBoost = Math.min(1, Math.log1p(leet.streak.current) / Math.log1p(100));
    lcScore = Math.round(100 * (solveMix * 0.75 + streakBoost * 0.25));
  }
  // Codeforces subscore (0..100): rating normalized against 3500 ceiling
  let cfScore = null;
  if (cf) {
    const rating = cf.currentRating ?? 0;
    const contestBoost = Math.min(1, Math.log1p(cf.contests || 0) / Math.log1p(200));
    const ratingNorm = Math.min(1, Math.max(0, (rating - 0) / 3500));
    cfScore = Math.round(100 * (ratingNorm * 0.8 + contestBoost * 0.2));
  }
  const parts = [lcScore, cfScore].filter((v) => v !== null);
  const cpi = parts.length === 0 ? 0 : Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
  const grade = computeGrade({
    commits: 0,
    prs: 0,
    issues: 0,
    stars: cpi * 10,
    followers: cpi * 2,
    contrib: cpi,
  });
  return { cpi, grade: grade.grade, lcScore, cfScore };
}

// Combined card redesigned around a single unified "CPI" grade donut on the
// left + two provider tiles stacked on the right. Shows at-a-glance whole-
// profile strength rather than two concatenated row lists.
export function renderCombined(leet, cf, { theme, title, hide = [], options = {} } = {}) {
  const name = leet?.username || cf?.username || 'profile';
  const t = title || `${escapeXml(name)} · CPI`;
  const fmt = (n) => formatNumber(n, options.shortNumbers);
  const { cpi, grade, lcScore, cfScore } = computeCpi(leet, cf);

  const cardW = 540;
  const cardH = 240;
  const monoFont = 'ui-monospace, SF Mono, Consolas, "Liberation Mono", monospace';

  const parts = [];
  parts.push(text(26, 36, t, 'title'));
  parts.push(
    text(
      26,
      56,
      'Competitive Programming Index',
      'subtitle',
      `font-family='${monoFont}' letter-spacing="0.08em"`,
    ),
  );
  parts.push(
    `<line x1="26" y1="72" x2="${cardW - 26}" y2="72" stroke="${theme.border}" stroke-opacity="0.5" stroke-width="1" />`,
  );

  // Hex badge grade (left column)
  parts.push(
    hexBadge({
      cx: 120,
      cy: 160,
      r: 60,
      grade,
      percent: cpi,
      color: theme.ring || theme.accent,
      bg: theme.grid,
      textColor: theme.text,
    }),
  );
  parts.push(
    text(
      120,
      232,
      'OVERALL',
      'section',
      'text-anchor="middle" font-size="10" letter-spacing="0.15em"',
    ),
  );

  // Provider tiles (right column)
  const tileX = 230;
  const tileW = cardW - tileX - 26;

  if (leet && !hidden(hide, 'leetcode')) {
    parts.push(
      providerTile({
        x: tileX,
        y: 96,
        width: tileW,
        height: 60,
        logo: 'LC',
        logoColor: '#ffa116',
        labelColor: theme.muted,
        textColor: theme.text,
        title: 'LeetCode',
        primary: `${fmt(leet.solved.total)} solved`,
        secondary: `streak ${leet.streak.current}d · acc ${leet.acceptanceRate ?? 0}%`,
        score: lcScore,
        scoreColor: theme.ring || theme.accent,
        bg: theme.grid,
        border: theme.border,
      }),
    );
  }
  if (cf && !hidden(hide, 'codeforces')) {
    parts.push(
      providerTile({
        x: tileX,
        y: 164,
        width: tileW,
        height: 60,
        logo: 'CF',
        logoColor: '#1f8acb',
        labelColor: theme.muted,
        textColor: theme.text,
        title: 'Codeforces',
        primary: `${cf.currentRating ?? 'unrated'} rating`,
        secondary: `${cf.rank ?? '—'} · ${cf.contests} contests`,
        score: cfScore,
        scoreColor: theme.title,
        bg: theme.grid,
        border: theme.border,
      }),
    );
  }

  return wrapSvg({
    width: cardW,
    height: cardH,
    title: t,
    children: `<g class="cc-stagger">${parts.join('\n  ')}</g>`,
    theme,
    options,
  });
}

// Inline helper — provider tile with logo badge + primary metric + score bar.
function providerTile({
  x,
  y,
  width,
  height,
  logo,
  logoColor,
  labelColor,
  textColor,
  title,
  primary,
  secondary,
  score,
  scoreColor,
  bg,
  border,
}) {
  const scorePct = Math.max(0, Math.min(100, score || 0));
  const barX = x + 54;
  const barW = width - 60;
  return `
    <g>
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="8" fill="${bg}" stroke="${border}" stroke-width="1" />
      <rect x="${x}" y="${y}" width="44" height="${height}" rx="8" fill="${logoColor}" fill-opacity="0.18" />
      <text x="${x + 22}" y="${y + height / 2 + 6}" text-anchor="middle" font-size="18" font-weight="800" fill="${logoColor}">${escapeXml(logo)}</text>
      <text x="${barX}" y="${y + 18}" font-size="11" font-weight="700" letter-spacing="0.08em" text-transform="uppercase" fill="${labelColor}">${escapeXml(title)}</text>
      <text x="${barX}" y="${y + 36}" font-size="14" font-weight="700" fill="${textColor}">${escapeXml(primary)}</text>
      <text x="${barX}" y="${y + 50}" font-size="10" font-weight="500" fill="${labelColor}">${escapeXml(secondary)}</text>
      <rect x="${barX}" y="${y + 55}" width="${barW}" height="3" rx="1.5" fill="${scoreColor}" fill-opacity="0.18" />
      <rect x="${barX}" y="${y + 55}" width="${Math.round((barW * scorePct) / 100)}" height="3" rx="1.5" fill="${scoreColor}" />
    </g>
  `;
}
