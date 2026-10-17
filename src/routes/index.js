import { Router } from 'express';
import { getLeetCodeStats, getCodeforcesStats } from '../services/stats.js';
import { renderCard } from '../render/index.js';
import { assertValidUsername, parseList, parseTheme, parseCardType } from '../utils/validate.js';
import { THEME_NAMES } from '../render/themes/index.js';

const COLOR_OVERRIDE_KEYS = [
  // legacy generic names (kept for back-compat)
  'bg_color',
  'border_color',
  'title_color',
  'text_color',
  'muted_color',
  'accent_color',
  // semantic names
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

function parseBool(value) {
  return value === 'true' || value === '1' || value === 'yes';
}

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

// `sections` is the inverse of `hide`: user lists what to KEEP. We can
// translate it into a hide-list once we know the valid field names for the
// requested card. The renderer owns that mapping, so we pass the raw list
// through to the dispatcher.
function parseSections(value) {
  return parseList(value);
}

export function createRouter({ stats = { getLeetCodeStats, getCodeforcesStats } } = {}) {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  router.get('/themes', (_req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.json({ themes: THEME_NAMES });
  });

  router.get('/leetcode/:username', async (req, res, next) => {
    try {
      const username = assertValidUsername(req.params.username, 'leetcode username');
      const data = await stats.getLeetCodeStats(username);
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  router.get('/codeforces/:username', async (req, res, next) => {
    try {
      const username = assertValidUsername(req.params.username, 'codeforces handle');
      const data = await stats.getCodeforcesStats(username);
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  router.get('/card', async (req, res, next) => {
    try {
      const { leetcode, codeforces, theme, hide, sections, title } = req.query;
      const type = parseCardType(req.query.type);
      const themeName = parseTheme(theme);
      const hideList = parseList(hide);
      const sectionList = parseSections(sections);

      const overrides = {};
      for (const key of COLOR_OVERRIDE_KEYS) {
        if (typeof req.query[key] === 'string') overrides[key] = req.query[key];
      }

      const options = {
        radius: Number.parseInt(req.query.radius, 10),
        hideBorder: parseBool(req.query.hide_border),
        transparent: parseBool(req.query.transparent),
        disableAnimations: parseBool(req.query.disable_animations),
        shortNumbers: parseBool(req.query.short_numbers),
        topSkills: clampInt(req.query.top_skills, 1, 12, 12),
        topLangs: clampInt(req.query.top_langs, 1, 12, 12),
        sections: sectionList,
      };

      let leetData = null;
      let cfData = null;
      if (typeof leetcode === 'string' && leetcode.length > 0) {
        assertValidUsername(leetcode, 'leetcode');
        leetData = await stats.getLeetCodeStats(leetcode);
      }
      if (typeof codeforces === 'string' && codeforces.length > 0) {
        assertValidUsername(codeforces, 'codeforces');
        cfData = await stats.getCodeforcesStats(codeforces);
      }

      if (!leetData && !cfData) {
        const err = new Error('At least one of leetcode or codeforces is required');
        err.statusCode = 400;
        throw err;
      }

      const outputType = req.query.format === 'json' || req.query.type === 'json' ? 'json' : 'svg';
      if (outputType === 'json') {
        res.setHeader(
          'Cache-Control',
          'public, max-age=600, s-maxage=3600, stale-while-revalidate=86400',
        );
        res.json({ leetcode: leetData, codeforces: cfData });
        return;
      }

      const svg = renderCard({
        type,
        leetcode: leetData,
        codeforces: cfData,
        themeName,
        overrides,
        title: typeof title === 'string' ? title : undefined,
        hide: hideList,
        options,
      });

      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      res.setHeader(
        'Cache-Control',
        'public, max-age=600, s-maxage=3600, stale-while-revalidate=86400',
      );
      res.send(svg);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
