import { fetchLeetCodeProfile, parseSubmissionCalendar } from '../providers/leetcode/index.js';
import {
  fetchCodeforcesUser,
  fetchCodeforcesSubmissions,
  dedupeAcceptedProblems,
} from '../providers/codeforces/index.js';
import { fetchGitHubProfile, colorFor } from '../providers/github/index.js';
import { calculateStreak } from './streak.js';
import { TtlCache } from './cache.js';
import { config } from '../config/index.js';

function pickCount(bucket, difficulty) {
  if (!Array.isArray(bucket)) return 0;
  const entry = bucket.find((b) => b && b.difficulty === difficulty);
  return entry && typeof entry.count === 'number' ? entry.count : 0;
}

function sumAll(bucket) {
  if (!Array.isArray(bucket)) return 0;
  const entry = bucket.find((b) => b && b.difficulty === 'All');
  return entry && typeof entry.count === 'number' ? entry.count : 0;
}

function normalizeLanguages(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((l) => l && typeof l.languageName === 'string')
    .map((l) => ({
      name: l.languageName,
      solved: Number.isFinite(l.problemsSolved) ? l.problemsSolved : 0,
    }))
    .sort((a, b) => b.solved - a.solved);
}

function normalizeSkills(tagBuckets) {
  if (!tagBuckets || typeof tagBuckets !== 'object') return [];
  const seen = new Map();
  for (const bucket of ['advanced', 'intermediate', 'fundamental']) {
    const list = Array.isArray(tagBuckets[bucket]) ? tagBuckets[bucket] : [];
    for (const t of list) {
      if (!t || typeof t.tagName !== 'string') continue;
      const slug = typeof t.tagSlug === 'string' ? t.tagSlug : t.tagName;
      if (seen.has(slug)) continue;
      seen.set(slug, {
        name: t.tagName,
        slug,
        solved: Number.isFinite(t.problemsSolved) ? t.problemsSolved : 0,
        tier: bucket,
      });
    }
  }
  return [...seen.values()].sort((a, b) => b.solved - a.solved);
}

export function normalizeLeetCode(data) {
  const user = data?.matchedUser;
  if (!user) return null;
  const ac = user.submitStatsGlobal?.acSubmissionNum || [];
  const total = user.submitStatsGlobal?.totalSubmissionNum || [];
  const totals = data.allQuestionsCount || [];

  const solved = {
    easy: pickCount(ac, 'Easy'),
    medium: pickCount(ac, 'Medium'),
    hard: pickCount(ac, 'Hard'),
    total: sumAll(ac),
  };

  const available = {
    easy: pickCount(totals, 'Easy'),
    medium: pickCount(totals, 'Medium'),
    hard: pickCount(totals, 'Hard'),
    total: sumAll(totals),
  };

  const totalSubmissions = sumAll(total);
  const totalAccepted = sumAll(ac);
  const acceptanceRate =
    totalSubmissions > 0 ? Math.round((totalAccepted / totalSubmissions) * 1000) / 10 : null;

  const activityTimestamps = parseSubmissionCalendar(user.userCalendar?.submissionCalendar);
  const streak = calculateStreak(activityTimestamps, {
    limited: activityTimestamps.length > 0,
  });
  // LeetCode's own userCalendar.streak is computed in LeetCode's TZ (not UTC)
  // and matches what the profile UI shows. Prefer it over our UTC calc for
  // `current`. Longest stays calculated (upstream doesn't expose it).
  if (typeof user.userCalendar?.streak === 'number') {
    streak.current = user.userCalendar.streak;
  }

  return {
    username: user.username,
    realName: user.profile?.realName || null,
    ranking: typeof user.profile?.ranking === 'number' ? user.profile.ranking : null,
    profileUrl: `https://leetcode.com/${user.username}`,
    solved,
    available,
    totalSubmissions,
    acceptanceRate,
    streak,
    activity: {
      timestamps: activityTimestamps,
      totalActiveDays:
        typeof user.userCalendar?.totalActiveDays === 'number'
          ? user.userCalendar.totalActiveDays
          : streak.totalActiveDays,
    },
    languages: normalizeLanguages(user.languageProblemCount),
    skills: normalizeSkills(user.tagProblemCounts),
  };
}

export function normalizeCodeforces({ info, ratingHistory }, submissions = []) {
  if (!info) return null;
  const accepted = dedupeAcceptedProblems(submissions);
  const activity = submissions
    .map((s) => (typeof s.creationTimeSeconds === 'number' ? s.creationTimeSeconds : null))
    .filter((v) => v !== null);
  const streak = calculateStreak(activity, { limited: submissions.length > 0 });

  const solvedByRating = {};
  for (const p of accepted) {
    const bucket = p.rating ? String(Math.floor(p.rating / 100) * 100) : 'unrated';
    solvedByRating[bucket] = (solvedByRating[bucket] || 0) + 1;
  }

  const ratingPoints = ratingHistory.map((r) => ({
    contestId: r.contestId,
    contestName: r.contestName,
    rank: r.rank,
    ratingUpdateTimeSeconds: r.ratingUpdateTimeSeconds,
    oldRating: r.oldRating,
    newRating: r.newRating,
  }));

  return {
    username: info.handle,
    profileUrl: `https://codeforces.com/profile/${info.handle}`,
    currentRating: typeof info.rating === 'number' ? info.rating : null,
    maxRating: typeof info.maxRating === 'number' ? info.maxRating : null,
    rank: info.rank || null,
    maxRank: info.maxRank || null,
    contests: ratingPoints.length,
    ratingHistory: ratingPoints,
    solved: {
      total: accepted.length,
      byRating: solvedByRating,
    },
    streak,
    activityTimestamps: activity,
  };
}

export function normalizeGitHub({ user, graphqlData, ownRepos, languageBytes, stars, tokenUsed }) {
  if (!user) return null;

  // Language percentages from aggregated bytes.
  const totalBytes = Object.values(languageBytes || {}).reduce((a, b) => a + b, 0);
  const languages = Object.entries(languageBytes || {})
    .map(([name, bytes]) => ({
      name,
      bytes,
      percent: totalBytes > 0 ? (bytes / totalBytes) * 100 : 0,
      color: colorFor(name),
    }))
    .sort((a, b) => b.bytes - a.bytes);

  let contrib = null;
  let currentStreak = null;
  let longestStreak = null;
  let totalCommits = null;
  let totalPrs = null;
  let totalIssues = null;
  let followers = user.followers;
  let activeDates = null;

  if (graphqlData && graphqlData.user) {
    const g = graphqlData.user;
    totalCommits = g.contributionsCollection?.totalCommitContributions ?? null;
    totalPrs = g.pullRequests?.totalCount ?? null;
    totalIssues = g.issues?.totalCount ?? null;
    followers = g.followers?.totalCount ?? followers;

    const cal = g.contributionsCollection?.contributionCalendar;
    if (cal) {
      contrib = cal.totalContributions ?? null;
      const days = (cal.weeks || []).flatMap((w) => w.contributionDays || []);
      const activeDays = days
        .filter((d) => d && Number(d.contributionCount) > 0)
        .map((d) => d.date);
      activeDates = activeDays;
      const streak = calculateStreak(activeDays, { limited: false });
      currentStreak = streak.current;
      longestStreak = streak.longest;
    }
  }

  return {
    username: user.login,
    name: user.name || null,
    avatarUrl: user.avatar_url || null,
    profileUrl: user.html_url || `https://github.com/${user.login}`,
    publicRepos: user.public_repos ?? ownRepos?.length ?? 0,
    followers: followers ?? 0,
    following: user.following ?? 0,
    stars,
    languages,
    contrib,
    currentStreak,
    longestStreak,
    totalCommits,
    totalPrs,
    totalIssues,
    activeDates,
    tokenUsed: !!tokenUsed,
  };
}

const leetCache = new TtlCache(config.cache);
const cfCache = new TtlCache(config.cache);
const ghCache = new TtlCache(config.cache);

export async function getLeetCodeStats(username, { cache = leetCache } = {}) {
  const key = `lc:${username.toLowerCase()}`;
  return cache.getOrLoad(key, async () => {
    const data = await fetchLeetCodeProfile(username);
    const normalized = normalizeLeetCode(data);
    if (!normalized) {
      const err = new Error('LeetCode user not found');
      err.statusCode = 404;
      throw err;
    }
    return normalized;
  });
}

export async function getCodeforcesStats(handle, { cache = cfCache } = {}) {
  const key = `cf:${handle.toLowerCase()}`;
  return cache.getOrLoad(key, async () => {
    const [user, submissions] = await Promise.all([
      fetchCodeforcesUser(handle),
      fetchCodeforcesSubmissions(handle).catch((err) => {
        if (err && err.statusCode === 404) return [];
        throw err;
      }),
    ]);
    return normalizeCodeforces(user, submissions);
  });
}

export async function getGitHubStats(username, { cache = ghCache } = {}) {
  const key = `gh:${username.toLowerCase()}`;
  return cache.getOrLoad(key, async () => {
    const raw = await fetchGitHubProfile(username);
    return normalizeGitHub(raw);
  });
}

export const _caches = { leetCache, cfCache, ghCache };
