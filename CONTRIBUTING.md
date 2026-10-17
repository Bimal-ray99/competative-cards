# Contributing

Thanks for considering a contribution.

## Development setup

```bash
git clone https://github.com/your-user/competitive-cards
cd competitive-cards
npm install
npm test
```

## Before you open a PR

- Run `npm test` and make sure the whole suite passes.
- Run `npm run lint` and `npm run format:check`.
- Add tests for new behavior. Tests must use mocked upstream data — never
  rely on live LeetCode or Codeforces responses.
- Keep PRs focused. One behavior change per PR beats a mega-PR.

## Guidelines

- **Never fabricate statistics.** If the upstream does not provide a value,
  show an unavailable / limited state instead of inventing one.
- **No HTML scraping** when a structured endpoint exists for the same data.
- Keep provider-specific code inside `src/providers/<name>/`. Normalization
  belongs in `src/services/stats.js`. SVG output belongs in `src/render/`.
- Validate and sanitize everything that comes from the user.
- All text written into SVG output must be XML-escaped. See `src/utils/escape.js`.

## Reporting a bug

Open an issue using the bug-report template. Include:

- The URL / endpoint called
- The query parameters
- What you saw vs. what you expected
- Node version and OS

## Reporting a security issue

Please **do not** open a public issue for security problems. Email the
maintainers listed on the repo page, or use GitHub's private vulnerability
reporting.

## Code of conduct

By participating you agree to abide by the [Code of Conduct](./CODE_OF_CONDUCT.md).
