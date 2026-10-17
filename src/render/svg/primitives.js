import { escapeXml } from '../../utils/escape.js';

// All SVG output uses a system font stack. GitHub renders SVGs as <img>, so
// web fonts cannot be fetched; the system stack ensures consistent, high-
// quality rendering across GitHub's dark/light themes.
const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif';

// Deterministic uid per render so animations declared in one card don't
// collide with another card on the same page. Based on the input title +
// children length — not cryptographic; just needs to be stable + unique.
function makeUid(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  return `c${Math.abs(h).toString(36)}`;
}

export function wrapSvg({ width, height, title, children, theme, options = {} }) {
  const safeTitle = escapeXml(title || 'Competitive Programming Card');
  const radius = Number.isFinite(options.radius) ? Math.max(0, Math.min(60, options.radius)) : 8;
  const hideBorder = options.hideBorder === true;
  const transparent = options.transparent === true;
  const disableAnimations = options.disableAnimations === true;
  const bgFill = transparent ? 'none' : theme.bg;
  const stroke = hideBorder ? 'none' : theme.border;
  const uid = makeUid(`${safeTitle}|${width}x${height}`);

  // Animations are wrapped in `prefers-reduced-motion: no-preference` so
  // users who opt out of motion see static output. Keyframes are prefixed
  // with the uid so multiple cards on one page don't collide.
  const anim = disableAnimations
    ? ''
    : `
    @media (prefers-reduced-motion: no-preference) {
      @keyframes cc-fade-${uid} { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes cc-draw-${uid} { from { stroke-dashoffset: var(--cc-dash, 1000); } to { stroke-dashoffset: var(--cc-offset, 0); } }
      @keyframes cc-grow-${uid} { from { transform: scaleX(0); } to { transform: scaleX(1); } }
      @keyframes cc-pop-${uid} { 0% { font-size: 0px; opacity: 0; } 70% { font-size: 1.1em; } 100% { font-size: 1em; opacity: 1; } }
      @keyframes cc-glow-${uid} { from { opacity: 0.35; } to { opacity: 0.75; } }
      g.cc-stagger > * { animation: cc-fade-${uid} 480ms cubic-bezier(.2,.8,.2,1) both; }
      g.cc-stagger > *:nth-child(2) { animation-delay: 60ms; }
      g.cc-stagger > *:nth-child(3) { animation-delay: 120ms; }
      g.cc-stagger > *:nth-child(4) { animation-delay: 180ms; }
      g.cc-stagger > *:nth-child(5) { animation-delay: 240ms; }
      g.cc-stagger > *:nth-child(6) { animation-delay: 300ms; }
      g.cc-stagger > *:nth-child(7) { animation-delay: 360ms; }
      g.cc-ring-anim circle.cc-ring-fg { animation: cc-draw-${uid} 1200ms cubic-bezier(.2,.8,.2,1) both; }
      g.cc-bar-anim rect.cc-bar-fg { transform-origin: left center; animation: cc-grow-${uid} 900ms cubic-bezier(.2,.8,.2,1) both; }
      g.cc-glow { animation: cc-glow-${uid} 2.5s ease-in-out infinite alternate; }
      text.cc-pop { animation: cc-pop-${uid} 700ms cubic-bezier(.34,1.56,.64,1) both; }
    }
  `;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="cardTitle" font-family='${FONT_STACK}'>
  <title id="cardTitle">${safeTitle}</title>
  <style>
    .card-bg { fill: ${bgFill}; stroke: ${stroke}; stroke-width: 1; }
    text { font-family: ${FONT_STACK}; }
    .title { font-size: 20px; font-weight: 700; letter-spacing: -0.01em; fill: ${theme.title}; }
    .subtitle { font-size: 12px; font-weight: 500; fill: ${theme.muted}; letter-spacing: 0.02em; }
    .label { font-size: 12px; font-weight: 500; fill: ${theme.muted}; letter-spacing: 0.02em; }
    .section { font-size: 11px; font-weight: 700; fill: ${theme.muted}; text-transform: uppercase; letter-spacing: 0.1em; }
    .value { font-size: 14px; font-weight: 600; fill: ${theme.text}; }
    .big { font-size: 32px; font-weight: 800; letter-spacing: -0.02em; fill: ${theme.text}; }
    .hero { font-size: 44px; font-weight: 800; letter-spacing: -0.03em; fill: ${theme.text}; }
    .easy { fill: ${theme.easy}; }
    .medium { fill: ${theme.medium}; }
    .hard { fill: ${theme.hard}; }
    .streak { fill: ${theme.streak}; }
    .ringAccent { fill: ${theme.ring || theme.accent}; }${anim}
  </style>
  <rect class="card-bg" x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="${radius}" />
  ${children}
</svg>`;
}

export function text(x, y, content, cls = 'value', extraAttrs = '') {
  return `<text x="${x}" y="${y}" class="${cls}" ${extraAttrs}>${escapeXml(content)}</text>`;
}

export function progressBar({
  x,
  y,
  width,
  height,
  value,
  max,
  color,
  trackColor,
  trackOpacity = 0.18,
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const filled = Math.max(0, Math.round(width * ratio));
  // Track = same color as fill at low opacity (preferred) OR explicit trackColor.
  // The opacity trick keeps the bar visually unified across all themes and
  // avoids a muddy grey track that fights with the fill color.
  const track = trackColor
    ? `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${height / 2}" fill="${trackColor}" />`
    : `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${height / 2}" fill="${color}" fill-opacity="${trackOpacity}" />`;
  return `<g class="cc-bar-anim">
    ${track}
    <rect class="cc-bar-fg" x="${x}" y="${y}" width="${filled}" height="${height}" rx="${height / 2}" fill="${color}" />
  </g>`;
}

// Donut progress ring. `value` and `max` give the fill ratio; the arc is
// drawn via stroke-dasharray so animations work with just CSS. Center of the
// ring is `(cx, cy)`; outer radius is `r`; stroke width is `strokeWidth`.
// Optional `centerText` renders the headline value in the middle, with a
// smaller `centerSub` beneath.
export function donutRing({
  cx,
  cy,
  r,
  strokeWidth,
  value,
  max,
  color,
  trackColor,
  centerText,
  centerSub,
  centerColor,
  subColor,
  centerSize = 24,
  subSize = 10,
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const circ = 2 * Math.PI * r;
  const dash = circ * ratio;
  const gap = circ - dash;
  const centerSvg = centerText
    ? `<text x="${cx}" y="${cy + centerSize / 3}" text-anchor="middle" font-size="${centerSize}" font-weight="800" letter-spacing="-0.02em" fill="${centerColor || color}">${escapeXml(centerText)}</text>`
    : '';
  const subSvg = centerSub
    ? `<text x="${cx}" y="${cy + centerSize / 3 + subSize + 6}" text-anchor="middle" font-size="${subSize}" font-weight="600" letter-spacing="0.1em" fill="${subColor || trackColor}" text-transform="uppercase">${escapeXml(String(centerSub).toUpperCase())}</text>`
    : '';
  return `<g class="cc-ring-anim" style="--cc-dash:${circ.toFixed(2)}; --cc-offset:${(circ - dash).toFixed(2)}">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${trackColor}" stroke-width="${strokeWidth}" />
    <circle class="cc-ring-fg" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}" transform="rotate(-90 ${cx} ${cy})" />
    ${centerSvg}
    ${subSvg}
  </g>`;
}

// Flame glyph for streak cards. Scales with `size` and uses `color`.
export function flame({ cx, cy, size = 20, color = '#ff7b00' }) {
  const s = size / 20;
  return `<g transform="translate(${cx - 10 * s} ${cy - 10 * s}) scale(${s})" fill="${color}">
    <path d="M10 1.2 C 13 5 15.3 7.1 15.3 10.4 C 15.3 13.6 13 15.8 10 15.8 C 7 15.8 4.7 13.6 4.7 10.4 C 4.7 8.6 5.7 7.4 6.7 6 C 7.6 7.6 8 8 8 9.4 C 8 11.3 11.5 10.7 10 1.2 Z" />
  </g>`;
}

// Streak hero: ring with a notch cut at the top where the flame sits, giving a
// unified medallion look. The notch is produced by an SVG mask (ellipse hole)
// so no fiddly stroke-dash math is needed. A soft Gaussian-blur glow pulses
// behind the ring. All animations are opt-out via `prefers-reduced-motion`
// (handled in wrapSvg).
//
// Deterministic uid — same inputs produce same SVG. Required for the
// snapshot determinism test; also prevents cache-busting when the same card
// is re-rendered.
export function streakHero({
  cx,
  cy,
  r = 32,
  strokeWidth = 4,
  ringColor,
  fireColor,
  numberColor,
  labelColor,
  numberText,
  labelText = 'Current Streak',
}) {
  const uid = makeUid(`streak|${cx}|${cy}|${r}|${numberText}|${labelText}`);
  const notchRx = Math.max(8, Math.round(r * 0.32));
  const notchRy = Math.max(10, Math.round(r * 0.42));
  const fireScale = r / 48;
  // Fire path — rounded teardrop (not identical to any upstream source;
  // path tuned by hand for our scale + proportions).
  const firePath =
    'M24 2 C 29 10 36 18 36 28 C 36 36 30 42 24 42 C 18 42 12 36 12 28 C 12 22 15 18 18 14 C 20 18 21 20 22 22 C 23 20 24 18 24 2 Z';
  return `
    <defs>
      <mask id="ring-mask-${uid}" maskUnits="userSpaceOnUse">
        <rect x="${cx - r - 10}" y="${cy - r - 20}" width="${2 * r + 20}" height="${2 * r + 20}" fill="white" />
        <ellipse cx="${cx}" cy="${cy - r}" rx="${notchRx}" ry="${notchRy}" fill="black" />
      </mask>
      <filter id="ring-glow-${uid}" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="3" />
      </filter>
    </defs>
    <g class="cc-glow" filter="url(#ring-glow-${uid})" opacity="0.5">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${ringColor}" stroke-width="${strokeWidth}" />
    </g>
    <g mask="url(#ring-mask-${uid})">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${ringColor}" stroke-width="${strokeWidth}" />
    </g>
    <g transform="translate(${cx - 24 * fireScale} ${cy - r - 8 * fireScale}) scale(${fireScale})" fill="${fireColor}">
      <path d="${firePath}" />
    </g>
    <text class="cc-pop" x="${cx}" y="${cy + 8}" text-anchor="middle" font-size="24" font-weight="800" fill="${numberColor}">${escapeXml(String(numberText))}</text>
    <text x="${cx}" y="${cy + r + 18}" text-anchor="middle" font-size="11" font-weight="700" letter-spacing="0.06em" fill="${labelColor}">${escapeXml(labelText)}</text>
  `;
}

// Small stat tile: numeric value above a label. Centered on `(cx, y)`.
export function statTile({ cx, y, value, label, valueColor, labelColor, valueSize = 32 }) {
  const safeValue = escapeXml(String(value));
  const safeLabel = escapeXml(String(label));
  return `<g>
    <text x="${cx}" y="${y}" text-anchor="middle" font-size="${valueSize}" font-weight="800" letter-spacing="-0.02em" fill="${valueColor}">${safeValue}</text>
    <text x="${cx}" y="${y + 20}" text-anchor="middle" font-size="11" font-weight="700" letter-spacing="0.08em" fill="${labelColor}">${safeLabel.toUpperCase()}</text>
  </g>`;
}

export function approxTextWidth(str, fontSize = 12) {
  return Math.max(1, String(str).length) * (fontSize * 0.58);
}

// Monospace char width — SF Mono / JetBrains Mono / Consolas average ~0.6em
export function approxMonoWidth(str, fontSize = 13) {
  return Math.max(1, String(str).length) * (fontSize * 0.6);
}

// Dotted leader line — fills space between a left label and right value with
// evenly-spaced dots. Classic receipt / table-of-contents look. Returns an
// SVG string that renders a label-left + dots + value-right row.
export function receiptRow({
  x,
  y,
  width,
  label,
  value,
  labelColor,
  valueColor,
  dotColor,
  fontSize = 13,
  bold = false,
  highlightColor,
}) {
  const safeLabel = escapeXml(label);
  const safeValue = escapeXml(String(value));
  const weight = bold ? '700' : '500';
  const monoFont = 'ui-monospace, SF Mono, Consolas, "Liberation Mono", monospace';
  const labelW = approxMonoWidth(safeLabel, fontSize);
  const valueW = approxMonoWidth(safeValue, fontSize);
  const gapStart = x + labelW + 6;
  const gapEnd = x + width - valueW - 6;
  const gapW = Math.max(10, gapEnd - gapStart);
  const dotSpacing = fontSize * 0.55;
  const dotCount = Math.max(1, Math.floor(gapW / dotSpacing));
  const dots = [];
  for (let i = 0; i < dotCount; i += 1) {
    const dx = gapStart + i * dotSpacing + dotSpacing / 2;
    dots.push(
      `<circle cx="${dx.toFixed(1)}" cy="${y - fontSize / 3}" r="0.9" fill="${dotColor}" />`,
    );
  }
  const bg = highlightColor
    ? `<rect x="${x - 4}" y="${y - fontSize - 4}" width="${width + 8}" height="${fontSize + 10}" rx="4" fill="${highlightColor}" />`
    : '';
  return `${bg}<text x="${x}" y="${y}" font-family='${monoFont}' font-size="${fontSize}" font-weight="${weight}" fill="${labelColor}">${safeLabel}</text>${dots.join('')}<text x="${x + width}" y="${y}" text-anchor="end" font-family='${monoFont}' font-size="${fontSize}" font-weight="${weight}" fill="${valueColor}">${safeValue}</text>`;
}

// Perforated-edge divider line — mimics tear-off receipt perforation. Short
// dashes with gaps. Horizontal; spans [x1..x2] at vertical y.
export function perforatedLine({ x1, x2, y, color, dash = 4, gap = 4 }) {
  const w = x2 - x1;
  const stride = dash + gap;
  const n = Math.floor(w / stride);
  const parts = [];
  for (let i = 0; i < n; i += 1) {
    const sx = x1 + i * stride;
    parts.push(
      `<line x1="${sx}" y1="${y}" x2="${sx + dash}" y2="${y}" stroke="${color}" stroke-width="1" />`,
    );
  }
  return parts.join('');
}

// Hex-badge grade display for the combined "CPI" card. Six-sided polygon
// with centered grade letter + percent sublabel. Draws its own glow.
export function hexBadge({ cx, cy, r, grade, percent, color, bg, textColor }) {
  const points = [];
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    const px = cx + r * Math.cos(a);
    const py = cy + r * Math.sin(a);
    points.push(`${px.toFixed(1)},${py.toFixed(1)}`);
  }
  const path = points.join(' ');
  return `
    <polygon points="${path}" fill="${bg}" stroke="${color}" stroke-width="2.5" />
    <text x="${cx}" y="${cy + 2}" text-anchor="middle" dominant-baseline="middle" font-size="${Math.round(r * 0.8)}" font-weight="800" letter-spacing="-0.03em" fill="${textColor}">${escapeXml(String(grade))}</text>
    <text x="${cx}" y="${cy + r * 0.55}" text-anchor="middle" font-size="10" font-weight="700" letter-spacing="0.1em" fill="${color}">${escapeXml(String(percent))}%</text>
  `;
}

export function chip({ x, y, label, fill, textColor, borderColor, height = 24, accentColor }) {
  const padding = 12;
  const w = Math.round(approxTextWidth(label, 12) + padding * 2);
  const safeLabel = escapeXml(label);
  const accentDot = accentColor
    ? `<circle cx="${x + 10}" cy="${y + height / 2}" r="3" fill="${accentColor}" />`
    : '';
  const textX = accentColor ? x + 20 : x + w / 2;
  const anchor = accentColor ? 'start' : 'middle';
  const w2 = accentColor ? w + 10 : w;
  return {
    width: w2,
    svg: `<g>
      <rect x="${x}" y="${y}" width="${w2}" height="${height}" rx="${height / 2}" fill="${fill}" stroke="${borderColor}" stroke-width="1" />
      ${accentDot}
      <text x="${textX}" y="${y + height / 2 + 4}" text-anchor="${anchor}" font-size="12" font-weight="500" fill="${textColor}">${safeLabel}</text>
    </g>`,
  };
}

export function packChips(items, { x, y, maxWidth, rowGap = 8, chipGap = 6, chipHeight = 24 }) {
  if (!items || items.length === 0) return { svg: '', height: 0 };
  let cx = x;
  let cy = y;
  let rowH = chipHeight;
  const parts = [];
  for (const item of items) {
    const built = chip({ x: cx, y: cy, height: chipHeight, ...item });
    if (cx !== x && cx + built.width > x + maxWidth) {
      cy += chipHeight + rowGap;
      cx = x;
      const rebuilt = chip({ x: cx, y: cy, height: chipHeight, ...item });
      parts.push(rebuilt.svg);
      cx += rebuilt.width + chipGap;
    } else {
      parts.push(built.svg);
      cx += built.width + chipGap;
    }
    rowH = chipHeight;
  }
  const height = cy - y + rowH;
  return { svg: parts.join(''), height };
}

// Horizontal stacked language bar + legend grid. `items` is a list of
// `{ name, color, percent }` already normalized to percentages summing to 100.
export function languageBar({ x, y, width, items, trackColor, labelColor, barHeight = 10 }) {
  if (!items || items.length === 0) return '';
  let offset = 0;
  const segments = items
    .map((it, i) => {
      const w = (width * it.percent) / 100;
      const seg = `<rect x="${x + offset}" y="${y}" width="${w}" height="${barHeight}" fill="${it.color}" ${i === 0 ? `rx="${barHeight / 2}"` : ''} />`;
      offset += w;
      return seg;
    })
    .join('');
  const legend = items
    .map((it, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const lx = x + col * (width / 2);
      const ly = y + barHeight + 24 + row * 20;
      return `<g>
        <circle cx="${lx + 6}" cy="${ly - 4}" r="5" fill="${it.color}" />
        <text x="${lx + 18}" y="${ly}" font-size="12" font-weight="500" fill="${labelColor}">${escapeXml(it.name)} ${it.percent.toFixed(2)}%</text>
      </g>`;
    })
    .join('');
  const trackBg = `<rect x="${x}" y="${y}" width="${width}" height="${barHeight}" rx="${barHeight / 2}" fill="${trackColor}" />`;
  return `<g><g style="clip-path:inset(0 round ${barHeight / 2}px)">${trackBg}${segments}</g>${legend}</g>`;
}

// Compute a GitHub-style letter grade from a scored stat profile. Inspired
// by the formula in anuraghazra/github-readme-stats (MIT) but implemented
// from scratch. Returns `{ grade, percent }` where percent is 0..100.
export function computeGrade({
  commits = 0,
  prs = 0,
  issues = 0,
  stars = 0,
  followers = 0,
  contrib = 0,
}) {
  // Normalize each metric with log-weighted thresholds; sum weighted
  // contributions, convert to a percentile.
  const w = {
    commits: 2,
    prs: 3,
    issues: 1,
    stars: 4,
    followers: 1,
    contrib: 2,
  };
  const t = {
    commits: 1000,
    prs: 100,
    issues: 25,
    stars: 200,
    followers: 50,
    contrib: 25,
  };
  const score = (val, cap) => Math.min(1, Math.log1p(val) / Math.log1p(cap));
  const total =
    w.commits * score(commits, t.commits) +
    w.prs * score(prs, t.prs) +
    w.issues * score(issues, t.issues) +
    w.stars * score(stars, t.stars) +
    w.followers * score(followers, t.followers) +
    w.contrib * score(contrib, t.contrib);
  const maxTotal = Object.values(w).reduce((a, b) => a + b, 0);
  const percent = Math.round((total / maxTotal) * 100);
  let grade = 'C';
  if (percent >= 95) grade = 'S+';
  else if (percent >= 85) grade = 'S';
  else if (percent >= 75) grade = 'A+';
  else if (percent >= 65) grade = 'A';
  else if (percent >= 55) grade = 'A-';
  else if (percent >= 45) grade = 'B+';
  else if (percent >= 35) grade = 'B';
  else if (percent >= 25) grade = 'B-';
  else if (percent >= 15) grade = 'C+';
  return { grade, percent };
}
