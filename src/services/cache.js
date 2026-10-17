// Bounded LRU-ish TTL cache. Insertion order of Map is reused as recency on set,
// but reads also refresh order so hot entries do not get evicted first.
export class TtlCache {
  constructor({ ttlSeconds = 600, maxEntries = 500 } = {}) {
    this.ttlMs = Math.max(0, ttlSeconds) * 1000;
    this.maxEntries = Math.max(1, maxEntries);
    this.store = new Map();
  }

  _isExpired(entry) {
    return this.ttlMs > 0 && Date.now() - entry.setAt > this.ttlMs;
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (this._isExpired(entry)) {
      this.store.delete(key);
      return undefined;
    }
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key, value) {
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, { value, setAt: Date.now() });
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      this.store.delete(oldest);
    }
  }

  delete(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }

  get size() {
    return this.store.size;
  }

  async getOrLoad(key, loader) {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const value = await loader();
    this.set(key, value);
    return value;
  }
}
