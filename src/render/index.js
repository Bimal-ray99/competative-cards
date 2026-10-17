import { resolveTheme } from './themes/index.js';
import {
  renderLeetCodeOverview,
  renderLeetCodeProblems,
  renderStreakCard,
  renderCodeforcesRating,
  renderHeatmap,
  renderCombined,
  renderSkills,
  renderLanguages,
  renderDuet,
} from './svg/cards.js';

const FIELDS_BY_TYPE = {
  overview: ['solved', 'easy', 'medium', 'hard', 'acceptance', 'ranking', 'streak'],
  problems: ['easy', 'medium', 'hard'],
  streak: ['streak', 'total', 'active'],
  rating: ['rating', 'maxRating', 'rank', 'maxRank', 'contests', 'solved', 'graph'],
  heatmap: [],
  combined: ['leetcode', 'codeforces', 'ranking', 'streak', 'rank', 'solved'],
  duet: [
    'easy',
    'medium',
    'hard',
    'solved',
    'acceptance',
    'streak',
    'rating',
    'maxRating',
    'rank',
    'maxRank',
    'contests',
  ],
  skills: [],
  languages: [],
};

function mergeHide(hide = [], sections = [], type) {
  const explicit = Array.isArray(hide) ? [...hide] : [];
  if (!sections || sections.length === 0) return explicit;
  const fields = FIELDS_BY_TYPE[type] || [];
  // If no section name overlaps the type's own fields, the user is passing a
  // "composite" sections list (e.g. `sections=skills,languages,heatmap` on
  // the overview card). Those are additive sections handled by the renderer
  // directly — do NOT translate them into hide-everything-else.
  const overlapsType = sections.some((s) => fields.includes(s));
  if (!overlapsType) return explicit;
  const keep = new Set(sections);
  for (const f of fields) if (!keep.has(f) && !explicit.includes(f)) explicit.push(f);
  return explicit;
}

export function renderCard({
  type,
  leetcode,
  codeforces,
  themeName,
  overrides,
  title,
  hide,
  options = {},
}) {
  const theme = resolveTheme(themeName, overrides || {});
  const effectiveHide = mergeHide(hide, options.sections, type);
  const opts = { theme, title, hide: effectiveHide, options };
  switch (type) {
    case 'overview':
      if (!leetcode) throw badRequest('overview card requires leetcode user');
      return renderLeetCodeOverview(leetcode, opts);
    case 'problems':
      if (!leetcode) throw badRequest('problems card requires leetcode user');
      return renderLeetCodeProblems(leetcode, opts);
    case 'streak':
      if (!leetcode) throw badRequest('streak card requires leetcode user');
      return renderStreakCard(leetcode, opts);
    case 'rating':
      if (!codeforces) throw badRequest('rating card requires codeforces user');
      return renderCodeforcesRating(codeforces, opts);
    case 'heatmap':
      if (!leetcode && !codeforces) throw badRequest('heatmap requires a user');
      return renderHeatmap(leetcode || codeforces, opts);
    case 'combined':
      if (!leetcode && !codeforces) throw badRequest('combined requires at least one user');
      return renderCombined(leetcode, codeforces, opts);
    case 'skills':
      if (!leetcode) throw badRequest('skills card requires leetcode user');
      return renderSkills(leetcode, opts);
    case 'languages':
      if (!leetcode) throw badRequest('languages card requires leetcode user');
      return renderLanguages(leetcode, opts);
    default:
      throw badRequest(`Unknown card type: ${type}`);
  }
}

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}
