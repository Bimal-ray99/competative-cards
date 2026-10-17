# competitive-cards

Open-source SVG stats cards for **LeetCode**, **Codeforces**, and **GitHub**
profiles. Embed real stats directly in your GitHub README. Self-host in a few
minutes, or deploy to Vercel in one click.

- **12 card types:** LeetCode overview / problems / streak / skills / languages,
  Codeforces rating, GitHub stats / streak / top-languages / profile, activity
  heatmap, and a combined card.
- **20+ named themes** (dark, light, radical, tokyonight, dracula, nord,
  gruvbox, synthwave, cobalt, …) plus fully custom hex overrides for
  semantic roles (bg, border, title, accent, streak, ring, fire, chip, …).
- **`sections` or `hide`** to control which fields appear.
- `short_numbers` (1.5K), `disable_animations`, `hide_border`,
  `transparent`, `border_radius`, `top_skills`, `top_langs`.
- `type=json` on `/api/card` for the raw computed data.
- **Dual-theme `<picture>` embed** that switches with GitHub's theme.
- Playground at `/` with live preview and copy-to-clipboard.
- Bounded in-memory cache, timeouts, bounded retries, rate limiting, and
  CSP + security headers on by default.

> **Honest caveats:** LeetCode has no stable public API. This project talks to
> their public GraphQL endpoint, which can change at any time. Streaks are
> computed from the submission calendar the upstream exposes; when that
> dataset is truncated, the card marks the result as **limited** rather than
> inventing a longer streak. See [Streak semantics](#streak-semantics).

---

## Quick start

```bash
git clone https://github.com/your-user/competitive-cards
cd competitive-cards
npm install
npm start
```

Server listens on `http://localhost:3000`.

```bash
curl 'http://localhost:3000/api/leetcode/alice'
curl 'http://localhost:3000/api/codeforces/tourist'
curl 'http://localhost:3000/api/card?leetcode=alice&theme=dark' -o alice.svg
```

### Embed in a GitHub README

```markdown
![LeetCode](https://your-host.example.com/api/card?leetcode=yourhandle&theme=github-dark)
![Codeforces](https://your-host.example.com/api/card?codeforces=yourhandle&type=rating)
![Combined](https://your-host.example.com/api/card?leetcode=yourhandle&codeforces=yourhandle&type=combined)
```

### Dual-theme embed (switches with GitHub's theme)

GitHub honors `prefers-color-scheme` inside a `<picture>` tag. Serve one SVG
per theme and the right one is shown automatically:

```html
<picture>
  <source
    media="(prefers-color-scheme: dark)"
    srcset="https://your-host.example.com/api/card?leetcode=you&theme=github-dark"
  />
  <source
    media="(prefers-color-scheme: light)"
    srcset="https://your-host.example.com/api/card?leetcode=you&theme=github-light"
  />
  <img alt="LeetCode stats" src="https://your-host.example.com/api/card?leetcode=you&theme=github-dark" />
</picture>
```

The playground at `/` builds this snippet for you with a Copy button.

---

## Endpoints

### `GET /api/health`
Returns `{ status: "ok", uptime: <seconds> }`.

### `GET /api/leetcode/:username`
Returns normalized LeetCode JSON stats:

```json
{
  "username": "alice",
  "ranking": 12345,
  "profileUrl": "https://leetcode.com/alice",
  "solved": { "easy": 60, "medium": 50, "hard": 13, "total": 123 },
  "available": { "easy": 750, "medium": 1600, "hard": 650, "total": 3000 },
  "totalSubmissions": 456,
  "acceptanceRate": 27.0,
  "streak": { "current": 5, "longest": 5, "lastActiveDate": "2026-10-16",
              "totalActiveDays": 5, "limited": true },
  "activity": { "timestamps": [...], "totalActiveDays": 5 }
}
```

### `GET /api/codeforces/:username`
Returns normalized Codeforces JSON stats including `currentRating`,
`maxRating`, `rank`, `maxRank`, `contests`, `ratingHistory`, and a deduplicated
solved-problem count.

### `GET /api/github/:username`
Returns normalized GitHub stats:

```json
{
  "username": "torvalds",
  "name": "Linus Torvalds",
  "publicRepos": 7,
  "followers": 220000,
  "stars": 190000,
  "languages": [{ "name": "C", "bytes": 123456, "percent": 73.5, "color": "#555555" }],
  "contrib": 3384,
  "currentStreak": 282,
  "longestStreak": 282,
  "totalCommits": 2700,
  "totalPrs": 250,
  "totalIssues": 21,
  "tokenUsed": true
}
```

Without `GITHUB_TOKEN` set, `contrib`, streaks, commits, PRs, and issues are
`null` and `tokenUsed` is `false`. The playground and SVG cards clearly label
these as unavailable rather than fabricating values.

### GitHub token

Set the `GITHUB_TOKEN` environment variable to a GitHub personal access token
(no scopes needed for public user stats). This enables:

- Total contributions (year window)
- Total commits / PRs / issues
- Current + longest streak with date ranges
- Grade donut on the `github-stats` card

Without a token, GitHub cards still work with public data (stars, repos,
followers, aggregated language bytes).

### `GET /api/card`
Returns an SVG. Query parameters:

| Param         | Values                                                     | Default    |
|---------------|------------------------------------------------------------|------------|
| `leetcode`    | LeetCode username                                          | —          |
| `codeforces`  | Codeforces handle                                          | —          |
| `leetcode`    | LeetCode username                                          | —          |
| `codeforces`  | Codeforces handle                                          | —          |
| `github`      | GitHub username                                            | —          |
| `type`        | `overview` \| `problems` \| `streak` \| `skills` \| `languages` \| `rating` \| `heatmap` \| `combined` \| `github-stats` \| `github-streak` \| `github-langs` \| `github-profile` \| `json` | `overview` |
| `theme`       | Any catalog name (`default`, `github-dark`, `github-light`, `radical`, `tokyonight`, `dracula`, `nord`, `gruvbox`, `monokai`, `onedark`, `cobalt`, `synthwave`, `highcontrast`, `solarized`, `solarized-dark`, `merko`, `rose`, `ocean`, `calm`, …). Unknown names fall back to `default`. See `GET /api/themes`. | `default`  |
| `title`       | Custom title text (escaped)                                | derived    |
| `hide`        | Comma-separated fields to hide                             | —          |
| `sections`    | Inverse of `hide`: comma-separated fields to **keep**      | all        |
| `hide_border` | `true` / `false`                                           | `false`    |
| `transparent` | `true` / `false` — fully transparent background            | `false`    |
| `disable_animations` | `true` / `false` — remove load animations           | `false`    |
| `short_numbers` | `true` / `false` — abbreviate (1,500 → 1.5K)             | `false`    |
| `radius`      | 0 – 60                                                     | `6`        |
| `top_skills`  | 1 – 12 (skills chips card)                                 | `12`       |
| `top_langs`   | 1 – 12 (languages chips card)                              | `12`       |
| `format=json` or `type=json` | Return JSON payload instead of SVG          | `svg`      |
| Fine colors   | Any of `bg`, `border`, `title`, `text`, `muted`, `accent`, `easy`, `medium`, `hard`, `streak`, `ring`, `fire`, `chip`, `chipText` (hex, with or without `#`). Legacy `bg_color`/`border_color`/`title_color`/`text_color`/`muted_color`/`accent_color` are aliases. | theme      |

Hideable fields (per card):

- Overview: `solved`, `easy`, `medium`, `hard`, `acceptance`, `ranking`, `streak`
- Problems: `easy`, `medium`, `hard`
- Streak card: `streak`, `total`, `active`
- Rating card: `rating`, `maxRating`, `rank`, `maxRank`, `contests`, `solved`, `graph`
- Combined: `leetcode`, `codeforces`, `ranking`, `streak`, `rank`, `solved`

Example:

```
/api/card?leetcode=alice&theme=custom&bg_color=0d1117&accent_color=ff7b00&hide=ranking,acceptance
```

---

## Streak semantics

- **Day** = UTC calendar day (`YYYY-MM-DD`). All timestamps are converted
  using UTC to avoid timezone drift across server regions.
- **Submission** = any submission event the upstream exposes with a
  timestamp. LeetCode's user calendar already represents accepted-only
  activity; Codeforces submissions include all verdicts, so streaks for
  Codeforces reflect submission activity, not solved-only activity. Solved
  counts are a separate metric and only count `verdict === 'OK'`.
- **Current streak** = the longest run of consecutive days ending on today
  or yesterday (UTC). If the most recent activity is older than yesterday,
  the current streak is **0**.
- **Longest streak** = the longest run of consecutive days ever observed in
  the input.
- Duplicate submissions on the same day collapse to a single day.
- If the upstream exposes only a limited calendar window, the result is
  marked `limited: true`. The card does not fabricate activity before the
  window.

---

## Environment variables

See [`.env.example`](./.env.example).

| Variable              | Default   | Purpose                                 |
|-----------------------|-----------|-----------------------------------------|
| `PORT`                | `3000`    | HTTP port                               |
| `HOST`                | `0.0.0.0` | Bind address                            |
| `CACHE_TTL_SECONDS`   | `600`     | TTL for cached upstream responses       |
| `CACHE_MAX_ENTRIES`   | `500`     | Bounded cache size                      |
| `UPSTREAM_TIMEOUT_MS` | `8000`    | Per-request timeout                     |
| `UPSTREAM_MAX_RETRIES`| `2`       | Retries for 429 / 5xx / network errors  |
| `RATE_LIMIT_WINDOW_MS`| `60000`   | Rate limit window (per IP)              |
| `RATE_LIMIT_MAX`      | `60`      | Max requests per IP per window          |
| `GITHUB_TOKEN`        | —         | Optional PAT. Unlocks GitHub streak + commit / PR / issue counts via GraphQL. |

---

## Deployment

### Docker

```bash
docker build -t competitive-cards .
docker run --rm -p 3000:3000 competitive-cards
```

### Vercel

A `vercel.json` is included. From a fresh checkout:

```bash
npm install -g vercel
vercel link
vercel deploy
```

Vercel routes `/api/*` to the serverless entrypoint `src/server-vercel.js` and
serves everything in `public/` as static assets. Multi-hour `s-maxage` with
`stale-while-revalidate` means card responses are served from Vercel's CDN —
most requests never touch the upstream.

---

## Development

```bash
npm install
npm run dev            # watch mode
npm test               # unit + integration tests
npm run lint
npm run format:check
```

All tests run against **mocked** upstream data; the suite does not depend on
live LeetCode or Codeforces.

### Project layout

```
src/
  app.js            Express app factory
  server.js         Entrypoint
  config/           Env-driven config
  routes/           API routes
  providers/
    leetcode/       Unofficial GraphQL client (isolated)
    codeforces/     Official API client
  services/
    stats.js        Normalization + cached accessors
    streak.js       Pure streak calculation
    cache.js        Bounded TTL cache
  render/
    index.js        Card dispatcher
    themes/         Theme palettes
    svg/            SVG primitives + card templates
  middleware/       Security headers, rate limiter, errors
  utils/            Validation, escaping, HTTP client
tests/
  unit/
  integration/
  fixtures/         Representative upstream payloads
```

### External API dependencies

- **LeetCode:** `POST https://leetcode.com/graphql` — unofficial. The schema
  can change without notice. Only user profile data is read.
- **Codeforces:** `https://codeforces.com/api/{user.info,user.rating,user.status}` —
  official and documented at <https://codeforces.com/apiHelp>.

Both calls use a short per-request timeout, a bounded retry policy on
`429`/`5xx`/network errors, and a bounded in-memory cache keyed by lowercased
handle. Requests are deduplicated at the cache layer.

---

## Security

- All usernames and query values are validated against strict allowlists.
- All text embedded in SVG output is XML-escaped — see
  [`escape.js`](src/utils/escape.js) and the injection tests in
  [`render.test.js`](tests/unit/render.test.js).
- Outbound requests only target the hard-coded LeetCode and Codeforces
  endpoints; the server never fetches arbitrary user-supplied URLs (no SSRF).
- Security headers (`X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy`) are set
  on every response.
- Error responses never leak stack traces or internal messages for `5xx`.
- Rate limiter is single-instance. Put a real one in front for multi-instance
  deployments.

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) to report security issues.

---

## Why self-host?

Public card services are often rate-limited by their upstreams and fail at the
worst time (when someone visits your profile). Hosting your own instance costs
nothing on free tiers of common PaaS and gives you a predictable surface.

---

## License

MIT. See [`LICENSE`](./LICENSE).
