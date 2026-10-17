import { config } from '../config/index.js';

// Simple in-memory fixed-window rate limiter. Suitable for single-instance
// deployments; put a real limiter in front for multi-instance.
export function rateLimit({
  windowMs = config.rateLimit.windowMs,
  max = config.rateLimit.max,
} = {}) {
  const buckets = new Map();
  return (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    let bucket = buckets.get(ip);
    if (!bucket || now - bucket.start > windowMs) {
      bucket = { start: now, count: 0 };
      buckets.set(ip, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      res.setHeader('Retry-After', Math.ceil((bucket.start + windowMs - now) / 1000));
      res.status(429).json({ error: 'Too many requests' });
      return;
    }
    // Housekeeping: cap bucket map size.
    if (buckets.size > 10_000) {
      const cutoff = now - windowMs;
      for (const [k, v] of buckets) if (v.start < cutoff) buckets.delete(k);
    }
    next();
  };
}
