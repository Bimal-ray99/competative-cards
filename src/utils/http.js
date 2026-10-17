import { config } from '../config/index.js';

export class UpstreamError extends Error {
  constructor(message, { statusCode, cause, provider } = {}) {
    super(message);
    this.name = 'UpstreamError';
    this.statusCode = statusCode;
    this.provider = provider;
    if (cause) this.cause = cause;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchWithTimeout(url, options = {}) {
  const { timeoutMs = config.upstream.timeoutMs, ...rest } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = {
      'user-agent': config.upstream.userAgent,
      accept: 'application/json',
      ...(rest.headers || {}),
    };
    return await fetch(url, { ...rest, headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson(url, options = {}) {
  const {
    retries = config.upstream.maxRetries,
    retryBaseMs = 250,
    provider,
    acceptStatuses = [200],
    ...fetchOptions
  } = options;

  let attempt = 0;
  let lastError;
  while (attempt <= retries) {
    try {
      const res = await fetchWithTimeout(url, fetchOptions);
      if (!acceptStatuses.includes(res.status)) {
        if (res.status === 429 || res.status >= 500) {
          lastError = new UpstreamError(`Upstream status ${res.status}`, {
            statusCode: res.status,
            provider,
          });
          attempt += 1;
          if (attempt > retries) throw lastError;
          await sleep(retryBaseMs * 2 ** (attempt - 1));
          continue;
        }
        throw new UpstreamError(`Upstream status ${res.status}`, {
          statusCode: res.status,
          provider,
        });
      }
      const text = await res.text();
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch (parseErr) {
        throw new UpstreamError('Malformed JSON from upstream', {
          statusCode: 502,
          provider,
          cause: parseErr,
        });
      }
    } catch (err) {
      if (err instanceof UpstreamError) throw err;
      const isAbort = err && (err.name === 'AbortError' || err.code === 'ABORT_ERR');
      lastError = new UpstreamError(isAbort ? 'Upstream timeout' : 'Upstream network error', {
        statusCode: isAbort ? 504 : 502,
        provider,
        cause: err,
      });
      attempt += 1;
      if (attempt > retries) throw lastError;
      await sleep(retryBaseMs * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}
