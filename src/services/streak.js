// Streak semantics (consistent across all providers in this project):
//
//   - A "submission" is any submission event the upstream exposes with a
//     timestamp. Whether only accepted submissions count is decided by the
//     caller: pass an already-filtered list if you want accepted-only.
//     Providers in this project pass accepted-only submissions for LeetCode's
//     calendar (which already counts accepted) and all submissions for
//     Codeforces unless noted.
//   - Days are UTC calendar days (YYYY-MM-DD). Timestamps are converted using
//     UTC to avoid timezone ambiguity across server regions. The upstream day
//     boundary is approximated; if a provider exposes its own day buckets,
//     prefer those over raw timestamps.
//   - Multiple submissions on the same date collapse to a single day.
//   - Current streak = the longest run of consecutive dates ending on either
//     today or yesterday (UTC). If the most recent date is older than
//     yesterday, current streak is 0.
//   - Longest streak = the longest run of consecutive dates ever observed.
//   - If the input is empty, both streaks are 0 and `limited` is set when the
//     caller indicates the dataset is truncated.

const MS_PER_DAY = 86_400_000;

export function toUtcDateString(input) {
  let date;
  if (input instanceof Date) {
    date = input;
  } else if (typeof input === 'number') {
    const ms = input > 1e12 ? input : input * 1000;
    date = new Date(ms);
  } else if (typeof input === 'string') {
    date = new Date(input);
  } else {
    return null;
  }
  if (Number.isNaN(date.getTime())) return null;
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dateStringToUtcMs(s) {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function todayUtcString(now = Date.now()) {
  return toUtcDateString(new Date(now));
}

function yesterdayUtcString(now = Date.now()) {
  return toUtcDateString(new Date(now - MS_PER_DAY));
}

export function normalizeToDates(entries) {
  const set = new Set();
  for (const entry of entries || []) {
    const dateStr = toUtcDateString(entry);
    if (dateStr) set.add(dateStr);
  }
  return [...set].sort();
}

export function calculateStreak(entries, options = {}) {
  const { now = Date.now(), limited = false } = options;
  const dates = normalizeToDates(entries);

  if (dates.length === 0) {
    return {
      current: 0,
      longest: 0,
      lastActiveDate: null,
      totalActiveDays: 0,
      limited,
    };
  }

  let longest = 1;
  let run = 1;
  for (let i = 1; i < dates.length; i += 1) {
    const prevMs = dateStringToUtcMs(dates[i - 1]);
    const curMs = dateStringToUtcMs(dates[i]);
    if (curMs - prevMs === MS_PER_DAY) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }

  const today = todayUtcString(now);
  const yesterday = yesterdayUtcString(now);
  const lastActive = dates[dates.length - 1];

  let current = 0;
  if (lastActive === today || lastActive === yesterday) {
    current = 1;
    for (let i = dates.length - 2; i >= 0; i -= 1) {
      const prevMs = dateStringToUtcMs(dates[i]);
      const nextMs = dateStringToUtcMs(dates[i + 1]);
      if (nextMs - prevMs === MS_PER_DAY) current += 1;
      else break;
    }
  }

  return {
    current,
    longest,
    lastActiveDate: lastActive,
    totalActiveDays: dates.length,
    limited,
  };
}
