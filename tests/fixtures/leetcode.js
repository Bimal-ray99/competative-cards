export function leetcodeProfileFixture({ username = 'alice' } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const day = 86_400;
  const calendar = {};
  // 5 consecutive days ending today
  for (let i = 0; i < 5; i += 1) calendar[String(now - i * day)] = 1 + i;
  return {
    matchedUser: {
      username,
      profile: {
        realName: 'Alice Example',
        ranking: 12345,
        userAvatar: 'https://example.com/a.png',
      },
      submitStatsGlobal: {
        acSubmissionNum: [
          { difficulty: 'All', count: 123, submissions: 456 },
          { difficulty: 'Easy', count: 60, submissions: 100 },
          { difficulty: 'Medium', count: 50, submissions: 300 },
          { difficulty: 'Hard', count: 13, submissions: 56 },
        ],
        totalSubmissionNum: [
          { difficulty: 'All', count: 456, submissions: 456 },
          { difficulty: 'Easy', count: 100, submissions: 100 },
          { difficulty: 'Medium', count: 300, submissions: 300 },
          { difficulty: 'Hard', count: 56, submissions: 56 },
        ],
      },
      userCalendar: {
        streak: 5,
        totalActiveDays: 5,
        submissionCalendar: JSON.stringify(calendar),
      },
      languageProblemCount: [
        { languageName: 'Python3', problemsSolved: 85 },
        { languageName: 'Java', problemsSolved: 4 },
      ],
      tagProblemCounts: {
        advanced: [{ tagName: 'Dynamic Programming', tagSlug: 'dp', problemsSolved: 10 }],
        intermediate: [
          { tagName: 'Binary Search', tagSlug: 'binary-search', problemsSolved: 11 },
          { tagName: 'Depth-First Search', tagSlug: 'dfs', problemsSolved: 12 },
        ],
        fundamental: [
          { tagName: 'Array', tagSlug: 'array', problemsSolved: 57 },
          { tagName: 'Hash Table', tagSlug: 'hash-table', problemsSolved: 21 },
          // Duplicate across tiers must dedupe.
          { tagName: 'Dynamic Programming', tagSlug: 'dp', problemsSolved: 99 },
        ],
      },
    },
    allQuestionsCount: [
      { difficulty: 'All', count: 3000 },
      { difficulty: 'Easy', count: 750 },
      { difficulty: 'Medium', count: 1600 },
      { difficulty: 'Hard', count: 650 },
    ],
  };
}
