import { eq, lt } from 'drizzle-orm';
import type { Context } from 'hono';
import { createHash } from 'node:crypto';
import type { DB } from '../db/index.js';
import { authThrottle } from '../db/schema.js';
import { ApiError } from '../lib/util.js';

/**
 * Limits on the doors anyone can knock on: sign-in, sign-up, forgot password.
 *
 * Who is knocking: the address Fly reports in `Fly-Client-IP`. Never the first `X-Forwarded-For` entry, which is
 * whatever the client typed. Off Fly, the last `X-Forwarded-For` hop (the one the nearest proxy added), then the socket.
 */
export const clientIp = (c: Context): string => {
  const fly = c.req.header('fly-client-ip')?.trim();
  if (fly) return fly;
  const hops = (c.req.header('x-forwarded-for') ?? '').split(',').map((h) => h.trim()).filter(Boolean);
  if (hops.length) return hops[hops.length - 1]!;
  const socket = (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)?.incoming?.socket?.remoteAddress;
  return socket || 'local';
};

const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 32);
/** A counter key for an email: hashed, so the table never holds the address of someone who only failed to sign in. */
export const emailKey = (prefix: string, email: string) => `${prefix}:${sha(email.trim().toLowerCase())}`;
export const ipKey = (prefix: string, ip: string) => `${prefix}:${ip}`;

export const tooMany = (retryAfterSec: number, message = 'Too many attempts. Wait a minute and try again.') => new ApiError(429, message, 'rate_limited', { 'Retry-After': String(Math.max(1, Math.ceil(retryAfterSec))) });

// ---------- failed sign-ins per address, in memory (a restart forgiving them is fine) ----------
const failures = new Map<string, { n: number; until: number }>();
export const checkThrottle = (key: string, now = Date.now()) => {
  const f = failures.get(key);
  if (f && f.until > now) throw tooMany((f.until - now) / 1000);
};
export const failThrottle = (key: string, now = Date.now()) => {
  const f = failures.get(key) ?? { n: 0, until: 0 };
  f.n++;
  if (f.n >= 6) {
    f.until = now + 60_000;
    f.n = 0;
  }
  failures.set(key, f);
};
export const clearThrottle = (key: string) => failures.delete(key);
/** Forget every in-memory failure (tests). */
export const resetThrottles = () => {
  failures.clear();
  windows.clear();
};

// ---------- counters that survive a restart (auth_throttle) ----------

/**
 * Failed sign-ins for one email, with delays that grow: the first four cost nothing, then each further failure locks
 * sign-in for that email for longer (30 s, 1 min, 2 min, 5 min, then 15 min each time). A day without a failure, or a
 * successful sign-in, starts it again. Kept in SQLite so a deploy does not hand an attacker a fresh run.
 */
export const EMAIL_FREE_FAILS = 4;
export const EMAIL_DELAYS_SEC = [30, 60, 120, 300, 900];
const EMAIL_WINDOW_MS = 24 * 3600_000;

export const emailLockLeft = (db: DB, email: string, now = Date.now()): number => {
  const row = db.select().from(authThrottle).where(eq(authThrottle.key, emailKey('login', email))).get();
  return row && row.lockedUntil > now ? (row.lockedUntil - now) / 1000 : 0;
};
/** Refuse while a delay is in force for this email (the right password included: otherwise the delay protects nothing). */
export const checkEmailLock = (db: DB, email: string, now = Date.now()) => {
  const left = emailLockLeft(db, email, now);
  if (left > 0) throw tooMany(left, 'Too many attempts for this account. Try again in a little while, or reset your password.');
};
/** Count a failed sign-in for this email. Returns the delay now in force, in seconds (0 for the first few). */
export const failEmail = (db: DB, email: string, now = Date.now()): number => {
  const key = emailKey('login', email);
  const row = db.select().from(authThrottle).where(eq(authThrottle.key, key)).get();
  const live = row && now - row.windowStart < EMAIL_WINDOW_MS ? row : null;
  const count = (live?.count ?? 0) + 1;
  const over = count - EMAIL_FREE_FAILS;
  const delay = over > 0 ? EMAIL_DELAYS_SEC[Math.min(over, EMAIL_DELAYS_SEC.length) - 1]! : 0;
  const values = { key, count, windowStart: now, lockedUntil: delay ? now + delay * 1000 : 0 };
  db.insert(authThrottle).values(values).onConflictDoUpdate({ target: authThrottle.key, set: values }).run();
  return delay;
};
export const clearEmail = (db: DB, email: string) => db.delete(authThrottle).where(eq(authThrottle.key, emailKey('login', email))).run();

/**
 * A plain "at most `max` per window" counter. Returns the seconds until the window ends when the limit is already
 * reached (and counts nothing), else 0 after counting this one.
 */
export const hitLimit = (db: DB, key: string, max: number, windowMs: number, now = Date.now()): number => {
  const row = db.select().from(authThrottle).where(eq(authThrottle.key, key)).get();
  const live = row && now - row.windowStart < windowMs ? row : null;
  if (live && live.count >= max) return Math.max(1, (live.windowStart + windowMs - now) / 1000);
  const values = { key, count: (live?.count ?? 0) + 1, windowStart: live?.windowStart ?? now, lockedUntil: 0 };
  db.insert(authThrottle).values(values).onConflictDoUpdate({ target: authThrottle.key, set: values }).run();
  return 0;
};

/** Drop counters nobody has touched for two days. */
export const purgeThrottle = (db: DB, now = Date.now()) => db.delete(authThrottle).where(lt(authThrottle.windowStart, now - 2 * 864e5)).run().changes;

// ---------- plain in-memory windows (client error reports, the phone's sync calls): a restart forgetting them is fine ----------
const windows = new Map<string, { n: number; start: number }>();
/**
 * "At most `max` per window", in memory. Returns the seconds until the window ends when the limit is already reached
 * (and counts nothing), else 0 after counting this one.
 */
export const windowHit = (key: string, max: number, windowMs: number, now = Date.now()): number => {
  const w = windows.get(key);
  if (!w || now - w.start >= windowMs) {
    // keep the map small: drop windows that ended, once it has grown
    if (windows.size > 5000) for (const [k, v] of windows) if (now - v.start >= 3600_000) windows.delete(k);
    windows.set(key, { n: 1, start: now });
    return 0;
  }
  if (w.n >= max) return Math.max(1, (w.start + windowMs - now) / 1000);
  w.n++;
  return 0;
};
