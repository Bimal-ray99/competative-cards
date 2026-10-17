import { isValidHexColor } from '../../utils/validate.js';
import { CATALOG, THEME_NAMES } from './catalog.js';

// Aliases map legacy / shorthand names onto canonical catalog entries so
// older URLs keep working. Resolver silently falls back to `default` for
// unknown names.
const ALIASES = {
  dark: 'default',
  light: 'github-light',
  github_dark: 'github-dark',
  github_light: 'github-light',
  'tokyo-night': 'tokyonight',
  'one-dark': 'onedark',
};

// Back-compat export for anything that imported `THEMES`.
export const THEMES = {
  dark: CATALOG.default,
  light: CATALOG['github-light'],
};

export { THEME_NAMES };

// Fine-grained color override keys. Keep the names in sync with CSS roles
// in `svg/primitives.js` and `svg/cards.js`. Older generic keys
// (`bg_color`, `text_color`, etc.) remain supported and alias into the
// matching semantic role for backward compatibility.
const SEMANTIC_KEYS = [
  'bg',
  'border',
  'title',
  'text',
  'muted',
  'accent',
  'easy',
  'medium',
  'hard',
  'streak',
  'ring',
  'fire',
  'grid',
  'chip',
  'chipText',
];

const LEGACY_ALIASES = {
  bg_color: 'bg',
  border_color: 'border',
  title_color: 'title',
  text_color: 'text',
  muted_color: 'muted',
  accent_color: 'accent',
};

function pickHex(value, fallback) {
  return isValidHexColor(value) ? (value.startsWith('#') ? value : `#${value}`) : fallback;
}

export function resolveTheme(name, overrides = {}) {
  const raw = typeof name === 'string' ? name.toLowerCase() : 'default';
  const requested = ALIASES[raw] || raw;
  const base = CATALOG[requested] || CATALOG.default;

  if (!overrides || Object.keys(overrides).length === 0) return base;

  const merged = { ...base };

  for (const [legacy, canonical] of Object.entries(LEGACY_ALIASES)) {
    if (overrides[legacy]) merged[canonical] = pickHex(overrides[legacy], base[canonical]);
  }
  for (const key of SEMANTIC_KEYS) {
    if (overrides[key]) merged[key] = pickHex(overrides[key], merged[key]);
  }

  return merged;
}
