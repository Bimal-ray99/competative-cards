// LeetCode and Codeforces usernames: alphanumeric plus `_`, `-`, `.`. 2-39 chars.
// Permissive enough to accept real handles while rejecting path traversal and
// control characters.
const USERNAME_RE = /^[A-Za-z0-9_.-]{1,39}$/;

export function isValidUsername(value) {
  return typeof value === 'string' && USERNAME_RE.test(value);
}

export function assertValidUsername(value, field = 'username') {
  if (!isValidUsername(value)) {
    const err = new Error(`Invalid ${field}`);
    err.statusCode = 400;
    throw err;
  }
  return value;
}

const HEX_RE = /^#?(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function isValidHexColor(value) {
  return typeof value === 'string' && HEX_RE.test(value);
}

export function parseList(value) {
  if (typeof value !== 'string' || value.length === 0) return [];
  return value
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

const ALLOWED_LAYOUTS = new Set(['default', 'compact']);
export function parseLayout(value) {
  if (typeof value !== 'string') return 'default';
  const v = value.toLowerCase();
  return ALLOWED_LAYOUTS.has(v) ? v : 'default';
}

// Theme names: alphanumeric plus `-` and `_`, 1–40 chars. The renderer
// resolves unknown names to the default theme, so this is purely about
// rejecting junk input before it enters logs or the SVG output.
const THEME_NAME_RE = /^[A-Za-z0-9_-]{1,40}$/;
export function parseTheme(value) {
  if (typeof value !== 'string') return 'default';
  const v = value.toLowerCase();
  return THEME_NAME_RE.test(v) ? v : 'default';
}

const ALLOWED_CARDS = new Set([
  'overview',
  'problems',
  'streak',
  'rating',
  'heatmap',
  'combined',
  'skills',
  'languages',
]);
export function parseCardType(value, fallback = 'overview') {
  if (typeof value !== 'string') return fallback;
  const v = value.toLowerCase();
  return ALLOWED_CARDS.has(v) ? v : fallback;
}
