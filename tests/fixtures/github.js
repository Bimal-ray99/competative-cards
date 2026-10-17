// GitHub provider fixture (shape mirrors our `fetchGitHubProfile` return
// value so tests can call `normalizeGitHub` directly).

export function githubFixture({ username = 'alice', withGraphql = true } = {}) {
  const user = {
    login: username,
    name: 'Alice Example',
    avatar_url: 'https://example.com/a.png',
    html_url: `https://github.com/${username}`,
    public_repos: 42,
    followers: 150,
    following: 5,
  };
  const ownRepos = Array.from({ length: 5 }, (_, i) => ({
    full_name: `${username}/repo-${i}`,
    stargazers_count: (i + 1) * 10,
    fork: false,
  }));
  const languageBytes = {
    JavaScript: 150_000,
    TypeScript: 90_000,
    Python: 60_000,
    'C++': 30_000,
  };
  const stars = ownRepos.reduce((a, r) => a + r.stargazers_count, 0);

  const graphqlData = withGraphql
    ? {
        user: {
          login: username,
          followers: { totalCount: 150 },
          following: { totalCount: 5 },
          repositories: { totalCount: 42 },
          pullRequests: { totalCount: 250 },
          issues: { totalCount: 21 },
          contributionsCollection: {
            totalCommitContributions: 2700,
            contributionCalendar: {
              totalContributions: 3384,
              weeks: [
                {
                  contributionDays: [
                    { date: '2025-02-26', contributionCount: 1 },
                    { date: '2025-02-27', contributionCount: 3 },
                    { date: '2025-02-28', contributionCount: 2 },
                  ],
                },
                {
                  contributionDays: [
                    { date: '2025-03-01', contributionCount: 5 },
                    { date: '2025-03-02', contributionCount: 2 },
                    { date: '2025-03-03', contributionCount: 1 },
                  ],
                },
              ],
            },
          },
        },
      }
    : null;

  return {
    user,
    graphqlData,
    repos: ownRepos,
    ownRepos,
    languageBytes,
    stars,
    tokenUsed: withGraphql,
  };
}
