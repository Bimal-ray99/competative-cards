import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchJson, UpstreamError } from '../../src/utils/http.js';

const originalFetch = globalThis.fetch;

describe('fetchJson', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('parses successful JSON response', async () => {
    globalThis.fetch.mockResolvedValue({ status: 200, text: async () => '{"a":1}' });
    const out = await fetchJson('https://example.com');
    expect(out).toEqual({ a: 1 });
  });

  it('retries on 500 then succeeds', async () => {
    globalThis.fetch
      .mockResolvedValueOnce({ status: 500, text: async () => '' })
      .mockResolvedValueOnce({ status: 200, text: async () => '{"ok":true}' });
    const out = await fetchJson('https://example.com', { retries: 1, retryBaseMs: 1 });
    expect(out).toEqual({ ok: true });
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('throws UpstreamError on 4xx (no retry)', async () => {
    globalThis.fetch.mockResolvedValue({ status: 404, text: async () => '' });
    await expect(
      fetchJson('https://example.com', { retries: 2, retryBaseMs: 1 }),
    ).rejects.toBeInstanceOf(UpstreamError);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('wraps timeouts', async () => {
    const err = new Error('aborted');
    err.name = 'AbortError';
    globalThis.fetch.mockRejectedValue(err);
    await expect(fetchJson('https://example.com', { retries: 0 })).rejects.toMatchObject({
      statusCode: 504,
    });
  });

  it('throws on malformed JSON', async () => {
    globalThis.fetch.mockResolvedValue({ status: 200, text: async () => '{broken' });
    await expect(fetchJson('https://example.com')).rejects.toMatchObject({ statusCode: 502 });
  });
});
