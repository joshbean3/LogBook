import { sql } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import type { AuthEnv } from '../auth.js';
import type { DB } from '../db/index.js';
import { rateLimits } from '../db/schema.js';
import { ApiError } from './util.js';

/**
 * Rate limits that survive a restart and are shared by the API and the worker: fixed windows counted in the
 * `rate_limits` table (`key`, `window_start`, `count`), with a small in-memory cache in front. The cache answers
 * "already over" without a query and, for the soft per-IP limit on every request, batches its increments; the
 * per-user and per-address limits that matter (the assistant, plan drafts, sign-in) count every call in the table.
 * Over the limit: a 429 with a plain message and `Retry-After` (the seconds left in the window).
 */

export interface RateResult {
  ok: boolean;
  retryAfterSec: number;
  count: number;
  limit: number;
}
interface Cached {
  windowStart: number;
  count: number;
  /** Increments counted here but not yet written (batching). */
  pending: number;
}
const cache = new Map<string, Cached>();
const MAX_CACHE = 10_000;

/** Tests: forget the cache (and, with a db, the table). */
export const resetRateLimits = (db?: DB) => {
  cache.clear();
  if (db) db.delete(rateLimits).run();
};

/** Add `by` to the key's count in this window (a new window starts over) and return the count the table now holds. */
const bump = (db: DB, key: string, windowStart: number, by: number): number => {
  const row = db.get<{ count: number }>(
    sql`INSERT INTO rate_limits (key, window_start, count) VALUES (${key}, ${windowStart}, ${by})
        ON CONFLICT(key) DO UPDATE SET
          count = CASE WHEN rate_limits.window_start = excluded.window_start THEN rate_limits.count + excluded.count ELSE excluded.count END,
          window_start = excluded.window_start
        RETURNING count`,
  );
  return row?.count ?? by;
};

const retryAfter = (windowStart: number, windowMs: number, now: number) => Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000));

/** The database the short form of `checkRate` (no db argument) counts in; `buildApp` binds it. */
let boundDb: DB | null = null;
export const bindRateLimitDb = (db: DB | null) => {
  boundDb = db;
};

/**
 * Count one call against `key` and say whether it is within `limit` per `windowMs`. `batch` > 1 writes the table
 * every n-th call from this process (the soft global limit); the default writes every call, so the count is exact
 * across processes and restarts. The short form without a db uses the one `buildApp` bound (and counts in memory
 * only when none is).
 */
export function checkRate(db: DB, key: string, limit: number, windowMs: number, now?: number, opts?: { batch?: number }): RateResult;
export function checkRate(key: string, limit: number, windowMs: number, now?: number): RateResult;
export function checkRate(a: DB | string, b: string | number, c: number, d?: number, e?: number | { batch?: number }, f?: { batch?: number }): RateResult {
  if (typeof a === 'string') return countRate(boundDb, a, b as number, c, d ?? Date.now(), {});
  return countRate(a, b as string, c, d as number, (e as number | undefined) ?? Date.now(), f ?? {});
}

const countRate = (db: DB | null, key: string, limit: number, windowMs: number, now: number, opts: { batch?: number }): RateResult => {
  const windowStart = Math.floor(now / windowMs) * windowMs;
  let c = cache.get(key);
  if (c && c.windowStart !== windowStart) {
    cache.delete(key);
    c = undefined;
  }
  if (c && c.count >= limit) return { ok: false, retryAfterSec: retryAfter(windowStart, windowMs, now), count: c.count, limit };
  const batch = Math.max(1, opts.batch ?? 1);
  if (!c) {
    c = { windowStart, count: db ? bump(db, key, windowStart, 1) : 1, pending: 0 };
    if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string);
    cache.set(key, c);
  } else {
    c.count++;
    c.pending++;
    if (db && c.pending >= batch) {
      c.count = bump(db, key, windowStart, c.pending);
      c.pending = 0;
    }
  }
  if (c.count > limit) return { ok: false, retryAfterSec: retryAfter(windowStart, windowMs, now), count: c.count, limit };
  return { ok: true, retryAfterSec: 0, count: c.count, limit };
};

/** Is `key` at or over `limit` in the current window, without counting anything? Always asks the table. */
export const peekRate = (db: DB, key: string, limit: number, windowMs: number, now = Date.now()): RateResult => {
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const row = db.get<{ window_start: number; count: number }>(sql`SELECT window_start, count FROM rate_limits WHERE key = ${key}`);
  const count = row && row.window_start === windowStart ? row.count : 0;
  return { ok: count < limit, retryAfterSec: count < limit ? 0 : retryAfter(windowStart, windowMs, now), count, limit };
};

/** Forget a key (a successful sign-in clears the address's failures). */
export const clearRate = (db: DB, key: string) => {
  cache.delete(key);
  db.run(sql`DELETE FROM rate_limits WHERE key = ${key}`);
};

/** Rows whose window started more than two days ago (the longest window is a day): the ops purge. */
export const purgeRateLimits = (db: DB, now = Date.now()) => db.run(sql`DELETE FROM rate_limits WHERE window_start < ${now - 2 * 24 * 3600_000}`).changes;

const inWords = (sec: number) => (sec >= 3600 ? `${Math.ceil(sec / 3600)} h` : sec >= 60 ? `${Math.ceil(sec / 60)} min` : `${sec} s`);

const refuse = (c: { header: (k: string, v: string) => void }, r: RateResult, what: string): never => {
  c.header('retry-after', String(r.retryAfterSec));
  throw new ApiError(429, `${what} Try again in ${inWords(r.retryAfterSec)}.`, 'rate_limited');
};

/** Per-user: `limit` calls per `windowMs` on this route for the signed-in account (needs `requireAuth` before it). */
export const rateLimit = (name: string, limit: number, windowMs: number, what: string): MiddlewareHandler<AuthEnv> => async (c, next) => {
  const r = checkRate(c.get('db'), `${name}:${c.get('user').id}`, limit, windowMs);
  if (!r.ok) refuse(c, r, what);
  await next();
};

// ---------- by address ----------

/**
 * The caller's address behind Fly's proxy (`Fly-Client-IP`), any other proxy (`X-Forwarded-For`, first hop) or
 * Cloudflare, else `local`. Only the proxy in front of the server can be trusted to set these.
 */
export const clientIp = (h: Headers): string => h.get('fly-client-ip')?.trim() || h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('cf-connecting-ip')?.trim() || h.get('x-real-ip')?.trim() || 'local';

/** Per-address: `limit` calls per `windowMs` from one IP, on whatever routes it is mounted on. No sign-in needed. */
export const ipRateLimit = (db: DB, name: string, limit: number, windowMs: number, what: string, opts: { batch?: number } = {}): MiddlewareHandler<AuthEnv> => async (c, next) => {
  const r = checkRate(db, `${name}:${clientIp(c.req.raw.headers)}`, limit, windowMs, Date.now(), opts);
  if (!r.ok) refuse(c, r, what);
  await next();
};

// ---------- the sign-in throttle ----------

/** Six failed sign-ins from one address in a minute, and that minute is closed to it. */
export const LOGIN_THROTTLE = { failures: 6, windowMs: 60_000 };
const loginKey = (ip: string) => `login-fail:${ip}`;

/** Before checking a password: a 429 while the address is throttled. */
export const checkLoginThrottle = (db: DB, ip: string) => {
  const r = peekRate(db, loginKey(ip), LOGIN_THROTTLE.failures, LOGIN_THROTTLE.windowMs);
  if (!r.ok) throw new ApiError(429, 'Too many attempts. Wait a minute and try again.', 'rate_limited');
};
/** After a wrong password: count it. */
export const failLogin = (db: DB, ip: string) => checkRate(db, loginKey(ip), LOGIN_THROTTLE.failures, LOGIN_THROTTLE.windowMs);
/** After a right one: the address starts clean. */
export const clearLoginThrottle = (db: DB, ip: string) => clearRate(db, loginKey(ip));
