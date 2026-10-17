// GitHub provider. Two modes:
//
//   - Public (no token): uses the unauthenticated REST API for basic profile
//     info (stars, followers, repo count) and language bytes aggregated across
//     the user's top repositories. Contribution counts, streaks, and PR/
//     issue totals are left `null` and the card marks them as unavailable.
//
//   - With `GITHUB_TOKEN` (classic PAT, no scopes required for public data):
//     uses GitHub's GraphQL API to pull total commits, PRs, issues, and the
//     contributionsCollection calendar for streak + date range calculations.
//
// Rate limits for unauthenticated REST are 60 req/hour per IP; the stats
// service caches aggressively to stay well below that. GraphQL rate limits
// are much higher once a token is set.

import { UpstreamError, fetchJson, fetchWithTimeout } from '../../utils/http.js';
import { config } from '../../config/index.js';

const REST_BASE = 'https://api.github.com';
const GRAPHQL_URL = 'https://api.github.com/graphql';

const COLOR_MAP = {
  // minimal fallback map; GitHub's full linguist colors are large. Entries
  // added here are rendered with brand colors in the language bar.
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  Java: '#b07219',
  Kotlin: '#A97BFF',
  Go: '#00ADD8',
  Rust: '#dea584',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Shell: '#89e051',
  PHP: '#4F5D95',
  Ruby: '#701516',
  Swift: '#F05138',
  Dart: '#00B4AB',
  Vue: '#41b883',
  Scala: '#c22d40',
  Elixir: '#6e4a7e',
  Haskell: '#5e5086',
  Lua: '#000080',
  Perl: '#0298c3',
  'Jupyter Notebook': '#DA5B0B',
  Dockerfile: '#384d54',
};

function colorFor(name, fallback) {
  if (COLOR_MAP[name]) return COLOR_MAP[name];
  // Deterministic hash → HSL so unknown languages still get a stable color.
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  return fallback || `hsl(${hue} 55% 55%)`;
}

function restHeaders(token) {
  const headers = {
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
  };
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

async function fetchUser(username, { token, fetcher = fetchJson } = {}) {
  try {
    return await fetcher(`${REST_BASE}/users/${encodeURIComponent(username)}`, {
      provider: 'github',
      headers: restHeaders(token),
    });
  } catch (err) {
    if (err && err.statusCode === 403) {
      throw new UpstreamError(
        token
          ? 'GitHub rate limited (403). Try again later.'
          : 'GitHub public rate limit hit (60/hr per IP). Set GITHUB_TOKEN to raise the cap.',
        { statusCode: 429, provider: 'github' },
      );
    }
    throw err;
  }
}

async function fetchRepos(username, { token, fetcher = fetchJson, perPage = 100 } = {}) {
  // Public user repos. Pagination capped at 2 pages to bound work; most
  // users have fewer than 200 public repos and the top ones dominate the
  // language breakdown.
  const pages = [];
  for (let page = 1; page <= 2; page += 1) {
    const list = await fetcher(
      `${REST_BASE}/users/${encodeURIComponent(username)}/repos?per_page=${perPage}&page=${page}&sort=updated`,
      { provider: 'github', headers: restHeaders(token) },
    );
    if (!Array.isArray(list) || list.length === 0) break;
    pages.push(...list);
    if (list.length < perPage) break;
  }
  return pages;
}

async function fetchRepoLanguages(fullName, { token, fetcher = fetchJson } = {}) {
  return fetcher(`${REST_BASE}/repos/${fullName}/languages`, {
    provider: 'github',
    headers: restHeaders(token),
  });
}

const GRAPHQL_PROFILE_QUERY = `
  query userStats($login: String!) {
    user(login: $login) {
      login
      name
      avatarUrl
      followers { totalCount }
      following { totalCount }
      repositories(first: 1, ownerAffiliations: OWNER, privacy: PUBLIC) {
        totalCount
      }
      pullRequests(first: 1, states: [OPEN, MERGED, CLOSED]) { totalCount }
      issues(first: 1, states: [OPEN, CLOSED]) { totalCount }
      contributionsCollection {
        totalCommitContributions
        totalPullRequestContributions
        totalIssueContributions
        totalPullRequestReviewContributions
        restrictedContributionsCount
        contributionCalendar {
          totalContributions
          weeks { contributionDays { date contributionCount } }
        }
      }
    }
  }
`;

async function postGraphQL(query, variables, { token }) {
  if (!token) {
    throw new UpstreamError('GITHUB_TOKEN is required for this GitHub query', {
      statusCode: 400,
      provider: 'github',
    });
  }
  const timeoutMs = config.upstream.timeoutMs;
  let res;
  try {
    res = await fetchWithTimeout(GRAPHQL_URL, {
      method: 'POST',
      timeoutMs,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        accept: 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch (err) {
    const isAbort = err && (err.name === 'AbortError' || err.code === 'ABORT_ERR');
    throw new UpstreamError(isAbort ? 'GitHub timeout' : 'GitHub network error', {
      statusCode: isAbort ? 504 : 502,
      provider: 'github',
      cause: err,
    });
  }
  if (res.status === 401) {
    throw new UpstreamError('GitHub token invalid or expired', {
      statusCode: 500,
      provider: 'github',
    });
  }
  if (res.status === 429 || res.status >= 500) {
    throw new UpstreamError(`GitHub upstream status ${res.status}`, {
      statusCode: 502,
      provider: 'github',
    });
  }
  if (res.status !== 200) {
    throw new UpstreamError(`GitHub unexpected status ${res.status}`, {
      statusCode: 502,
      provider: 'github',
    });
  }
  let body;
  try {
    body = await res.json();
  } catch (err) {
    throw new UpstreamError('Malformed GitHub response', {
      statusCode: 502,
      provider: 'github',
      cause: err,
    });
  }
  if (body.errors && body.errors.length > 0) {
    const message = body.errors[0]?.message || 'GitHub GraphQL error';
    throw new UpstreamError(message, {
      statusCode: /not.*found/i.test(message) ? 404 : 502,
      provider: 'github',
    });
  }
  return body.data;
}

export async function fetchGitHubProfile(
  username,
  {
    token = process.env.GITHUB_TOKEN,
    graphql = postGraphQL,
    rest = { fetchUser, fetchRepos, fetchRepoLanguages },
  } = {},
) {
  if (typeof username !== 'string' || username.length === 0) {
    const err = new Error('username required');
    err.statusCode = 400;
    throw err;
  }

  let graphqlData = null;
  if (token) {
    try {
      graphqlData = await graphql(GRAPHQL_PROFILE_QUERY, { login: username }, { token });
      if (!graphqlData?.user) {
        throw new UpstreamError('GitHub user not found', {
          statusCode: 404,
          provider: 'github',
        });
      }
    } catch (err) {
      if (err && err.statusCode === 404) throw err;
      // Fall through to public REST on GraphQL failures that aren't 404.
      graphqlData = null;
    }
  }

  const user = await rest.fetchUser(username, { token });
  if (!user || !user.login) {
    throw new UpstreamError('GitHub user not found', {
      statusCode: 404,
      provider: 'github',
    });
  }

  // Only pull a bounded set of repos to compute language bytes. Includes
  // forks when the user has no non-fork repos.
  //
  // Public GitHub REST allows only 60 req/hour per IP. Each top repo takes 1
  // languages call, so cap to top 10 without a token (ten top-starred repos
  // dominate the language breakdown anyway) and 30 with a token.
  const repos = await rest.fetchRepos(username, { token });
  const ownRepos = repos.filter((r) => r && !r.fork);
  const languageBytes = {};
  let stars = 0;
  const topLimit = token ? 30 : 10;
  const topRepos = (ownRepos.length > 0 ? ownRepos : repos)
    .slice()
    .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
    .slice(0, topLimit);
  for (const repo of ownRepos)
    stars += Number.isFinite(repo.stargazers_count) ? repo.stargazers_count : 0;

  // Fetch languages per repo in parallel but bounded.
  const CONCURRENCY = 5;
  const fullNames = topRepos.map((r) => r.full_name).filter(Boolean);
  for (let i = 0; i < fullNames.length; i += CONCURRENCY) {
    const slice = fullNames.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      slice.map((name) => rest.fetchRepoLanguages(name, { token })),
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value && typeof r.value === 'object') {
        for (const [lang, bytes] of Object.entries(r.value)) {
          if (typeof bytes === 'number') languageBytes[lang] = (languageBytes[lang] || 0) + bytes;
        }
      }
    }
  }

  return { user, graphqlData, repos, ownRepos, languageBytes, stars, tokenUsed: !!graphqlData };
}

export { COLOR_MAP, colorFor };
