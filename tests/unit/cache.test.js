import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TtlCache } from '../../src/services/cache.js';

describe('TtlCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns undefined for missing keys', () => {
    const c = new TtlCache();
    expect(c.get('x')).toBeUndefined();
  });

  it('stores and retrieves', () => {
    const c = new TtlCache();
    c.set('x', 1);
    expect(c.get('x')).toBe(1);
  });

  it('expires entries after ttl', () => {
    const c = new TtlCache({ ttlSeconds: 1 });
    c.set('x', 1);
    expect(c.get('x')).toBe(1);
    vi.advanceTimersByTime(1500);
    expect(c.get('x')).toBeUndefined();
  });

  it('evicts oldest beyond maxEntries', () => {
    const c = new TtlCache({ maxEntries: 2, ttlSeconds: 60 });
    c.set('a', 1);
    c.set('b', 2);
    c.set('c', 3);
    expect(c.get('a')).toBeUndefined();
    expect(c.get('b')).toBe(2);
    expect(c.get('c')).toBe(3);
  });

  it('getOrLoad invokes loader only on miss', async () => {
    const c = new TtlCache({ ttlSeconds: 60 });
    const loader = vi.fn().mockResolvedValue({ v: 1 });
    const a = await c.getOrLoad('k', loader);
    const b = await c.getOrLoad('k', loader);
    expect(a).toEqual({ v: 1 });
    expect(b).toEqual({ v: 1 });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('reading refreshes recency', () => {
    const c = new TtlCache({ maxEntries: 2, ttlSeconds: 60 });
    c.set('a', 1);
    c.set('b', 2);
    expect(c.get('a')).toBe(1);
    c.set('c', 3);
    expect(c.get('b')).toBeUndefined();
    expect(c.get('a')).toBe(1);
  });
});
