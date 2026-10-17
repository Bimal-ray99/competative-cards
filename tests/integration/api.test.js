import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import { createRouter } from '../../src/routes/index.js';
import { errorHandler, notFound } from '../../src/middleware/errors.js';
import { securityHeaders } from '../../src/middleware/security.js';
import { leetcodeProfileFixture } from '../fixtures/leetcode.js';
import { cfUserFixture, cfSubmissionsFixture } from '../fixtures/codeforces.js';
import { normalizeLeetCode, normalizeCodeforces } from '../../src/services/stats.js';

function buildTestApp({ shouldFail = false } = {}) {
  const app = express();
  app.use(securityHeaders);
  const stats = {
    getLeetCodeStats: async (username) => {
      if (shouldFail) throw new Error('boom');
      return normalizeLeetCode(leetcodeProfileFixture({ username }));
    },
    getCodeforcesStats: async () => normalizeCodeforces(cfUserFixture, cfSubmissionsFixture),
  };
  app.use('/api', createRouter({ stats }));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

async function request(app, path) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      fetch(`http://127.0.0.1:${port}${path}`)
        .then(async (r) => {
          const body = await r.text();
          server.close();
          resolve({ status: r.status, headers: r.headers, body });
        })
        .catch((err) => {
          server.close();
          reject(err);
        });
    });
  });
}

describe('API routes', () => {
  let app;
  beforeAll(() => {
    app = buildTestApp();
  });

  it('health check returns ok', async () => {
    const res = await request(app, '/api/health');
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).status).toBe('ok');
  });

  it('returns leetcode stats json', async () => {
    const res = await request(app, '/api/leetcode/alice');
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.username).toBe('alice');
    expect(data.solved.total).toBe(123);
  });

  it('rejects invalid username with 400', async () => {
    const res = await request(app, '/api/leetcode/..%2Fpasswd');
    expect(res.status).toBe(400);
  });

  it('serves SVG card', async () => {
    const res = await request(app, '/api/card?leetcode=alice&theme=dark');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/svg+xml');
    expect(res.body.startsWith('<svg')).toBe(true);
  });

  it('400 when no provider is given', async () => {
    const res = await request(app, '/api/card');
    expect(res.status).toBe(400);
  });

  it('handles upstream failure as 500 without leaking stack', async () => {
    const failingApp = buildTestApp({ shouldFail: true });
    const res = await request(failingApp, '/api/leetcode/alice');
    expect(res.status).toBe(500);
    expect(res.body).not.toContain('boom');
  });

  it('sets security headers', async () => {
    const res = await request(app, '/api/health');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
  });
});
