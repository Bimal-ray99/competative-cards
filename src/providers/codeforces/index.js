// Codeforces exposes a documented public API at https://codeforces.com/apiHelp
// This provider uses user.info, user.rating, and user.status. Only accepted
// submissions ("verdict === 'OK'") count toward solved-problem totals, and we
// deduplicate by stable problem identifier `${contestId}-${index}`.

import { fetchJson, UpstreamError } from '../../utils/http.js';

const CF_BASE = 'https://codeforces.com/api';

async function callCfApi(path, params, options = {}) {
  const url = new URL(`${CF_BASE}/${path}`);
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const body = await fetchJson(url.toString(), {
    provider: 'codeforces',
    acceptStatuses: [200, 400],
    ...options,
  });
  if (!body || typeof body !== 'object') {
    throw new UpstreamError('Malformed Codeforces response', {
      statusCode: 502,
      provider: 'codeforces',
    });
  }
  if (body.status !== 'OK') {
    const comment = typeof body.comment === 'string' ? body.comment : 'Codeforces API error';
    const notFound = /not found/i.test(comment);
    throw new UpstreamError(comment, {
      statusCode: notFound ? 404 : 502,
      provider: 'codeforces',
    });
  }
  return body.result;
}

export async function fetchCodeforcesUser(handle, { fetcher = callCfApi } = {}) {
  if (typeof handle !== 'string' || handle.length === 0) {
    const err = new Error('handle required');
    err.statusCode = 400;
    throw err;
  }
  const [infoList, ratingList] = await Promise.all([
    fetcher('user.info', { handles: handle }),
    fetcher('user.rating', { handle }).catch((err) => {
      // user.rating may legitimately return empty for unrated users; the API
      // signals this via status OK + empty array, which is handled above.
      // Only swallow 404s here so a brand-new user still gets info.
      if (err && err.statusCode === 404) return [];
      throw err;
    }),
  ]);

  if (!Array.isArray(infoList) || infoList.length === 0) {
    throw new UpstreamError('Codeforces user not found', {
      statusCode: 404,
      provider: 'codeforces',
    });
  }

  return { info: infoList[0], ratingHistory: Array.isArray(ratingList) ? ratingList : [] };
}

export async function fetchCodeforcesSubmissions(
  handle,
  { count = 2000, fetcher = callCfApi } = {},
) {
  const list = await fetcher('user.status', { handle, from: 1, count });
  if (!Array.isArray(list)) return [];
  return list;
}

export function dedupeAcceptedProblems(submissions) {
  const seen = new Set();
  const result = [];
  for (const s of submissions || []) {
    if (!s || s.verdict !== 'OK' || !s.problem) continue;
    const p = s.problem;
    const key =
      p.contestId !== undefined && p.index !== undefined
        ? `${p.contestId}-${p.index}`
        : p.name
          ? `name:${p.name}`
          : null;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push({
      key,
      contestId: p.contestId,
      index: p.index,
      name: p.name,
      rating: typeof p.rating === 'number' ? p.rating : null,
      tags: Array.isArray(p.tags) ? p.tags : [],
      creationTimeSeconds: typeof s.creationTimeSeconds === 'number' ? s.creationTimeSeconds : null,
    });
  }
  return result;
}

export const _internal = { CF_BASE, callCfApi };
