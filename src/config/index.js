const parseInt10 = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export const config = {
  port: parseInt10(process.env.PORT, 3000),
  host: process.env.HOST || '0.0.0.0',
  env: process.env.NODE_ENV || 'development',
  cache: {
    ttlSeconds: parseInt10(process.env.CACHE_TTL_SECONDS, 180),
    maxEntries: parseInt10(process.env.CACHE_MAX_ENTRIES, 500),
  },
  upstream: {
    timeoutMs: parseInt10(process.env.UPSTREAM_TIMEOUT_MS, 8000),
    maxRetries: parseInt10(process.env.UPSTREAM_MAX_RETRIES, 2),
    userAgent: 'competitive-cards/0.1 (+https://github.com/your-user/competitive-cards)',
  },
  rateLimit: {
    windowMs: parseInt10(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
    max: parseInt10(process.env.RATE_LIMIT_MAX, 60),
  },
};
