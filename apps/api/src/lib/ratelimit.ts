import type { MiddlewareHandler } from 'hono';
import type { AuthEnv } from '../auth.js';
import { ApiError } from './util.js';

/**
 * A per-user sliding-window limit kept in memory (one process serves the app). `limit` calls per `windowMs`; over it,
 * a 429 with a plain message and `Retry-After`. Tests reset it with `resetRateLimits`.
 */
const hits = new Map<string, number[]>();

export const resetRateLimits = () => hits.clear();

export const checkRate = (key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfterSec: number } => {
  const list = (hits.get(key) ?? []).filter((t) => t > now - windowMs);
  if (list.length >= limit) {
    hits.set(key, list);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((list[0]! + windowMs - now) / 1000)) };
  }
  list.push(now);
  hits.set(key, list);
  return { ok: true, retryAfterSec: 0 };
};

export const rateLimit = (name: string, limit: number, windowMs: number, what: string): MiddlewareHandler<AuthEnv> => async (c, next) => {
  const r = checkRate(`${name}:${c.get('user').id}`, limit, windowMs);
  if (!r.ok) {
    c.header('retry-after', String(r.retryAfterSec));
    throw new ApiError(429, `${what} Try again in ${r.retryAfterSec >= 3600 ? `${Math.ceil(r.retryAfterSec / 3600)} h` : r.retryAfterSec >= 60 ? `${Math.ceil(r.retryAfterSec / 60)} min` : `${r.retryAfterSec} s`}.`, 'rate_limited');
  }
  await next();
};
