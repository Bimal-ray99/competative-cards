// LeetCode has no officially documented stable public API. This provider talks
// to the public GraphQL endpoint used by leetcode.com itself. Behavior may
// change without notice; the provider is intentionally defensive and never
// fabricates missing fields.

import { UpstreamError, fetchWithTimeout } from '../../utils/http.js';
import { config } from '../../config/index.js';

const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql';

const USER_PROFILE_QUERY = `
  query userProfile($username: String!) {
    matchedUser(username: $username) {
      username
      profile {
        realName
        ranking
        userAvatar
      }
      submitStatsGlobal {
        acSubmissionNum { difficulty count submissions }
        totalSubmissionNum { difficulty count submissions }
      }
      userCalendar {
        streak
        totalActiveDays
        submissionCalendar
      }
      languageProblemCount {
        languageName
        problemsSolved
      }
      tagProblemCounts {
        advanced { tagName tagSlug problemsSolved }
        intermediate { tagName tagSlug problemsSolved }
        fundamental { tagName tagSlug problemsSolved }
      }
    }
    allQuestionsCount {
      difficulty
      count
    }
  }
`;

async function postGraphql(query, variables, { signal } = {}) {
  const headers = {
    'content-type': 'application/json',
    referer: 'https://leetcode.com',
    origin: 'https://leetcode.com',
  };
  let res;
  try {
    res = await fetchWithTimeout(LEETCODE_GRAPHQL_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
      signal,
    });
  } catch (err) {
    const isAbort = err && (err.name === 'AbortError' || err.code === 'ABORT_ERR');
    throw new UpstreamError(isAbort ? 'LeetCode timeout' : 'LeetCode network error', {
      statusCode: isAbort ? 504 : 502,
      provider: 'leetcode',
      cause: err,
    });
  }
  if (res.status === 404) {
    throw new UpstreamError('LeetCode user not found', {
      statusCode: 404,
      provider: 'leetcode',
    });
  }
  if (res.status === 429) {
    throw new UpstreamError('LeetCode rate limited', {
      statusCode: 429,
      provider: 'leetcode',
    });
  }
  if (res.status >= 500) {
    throw new UpstreamError(`LeetCode upstream ${res.status}`, {
      statusCode: res.status,
      provider: 'leetcode',
    });
  }
  if (res.status !== 200) {
    throw new UpstreamError(`LeetCode unexpected status ${res.status}`, {
      statusCode: 502,
      provider: 'leetcode',
    });
  }
  let body;
  try {
    body = await res.json();
  } catch (err) {
    throw new UpstreamError('Malformed response from LeetCode', {
      statusCode: 502,
      provider: 'leetcode',
      cause: err,
    });
  }
  if (body.errors && body.errors.length > 0) {
    const message = body.errors[0]?.message || 'LeetCode GraphQL error';
    throw new UpstreamError(message, {
      statusCode: /not found/i.test(message) ? 404 : 502,
      provider: 'leetcode',
    });
  }
  return body.data;
}

export async function fetchLeetCodeProfile(username, { fetcher = postGraphql } = {}) {
  if (typeof username !== 'string' || username.length === 0) {
    const err = new Error('username required');
    err.statusCode = 400;
    throw err;
  }
  const data = await fetcher(USER_PROFILE_QUERY, { username });
  if (!data || !data.matchedUser) {
    throw new UpstreamError('LeetCode user not found', {
      statusCode: 404,
      provider: 'leetcode',
    });
  }
  return data;
}

export function parseSubmissionCalendar(raw) {
  if (!raw) return [];
  let obj;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return [];
    }
  } else {
    obj = raw;
  }
  if (!obj || typeof obj !== 'object') return [];
  const timestamps = [];
  for (const key of Object.keys(obj)) {
    const n = Number.parseInt(key, 10);
    if (Number.isFinite(n)) timestamps.push(n);
  }
  return timestamps;
}

export const _internal = { LEETCODE_GRAPHQL_URL, postGraphql };
export { config as _config };
