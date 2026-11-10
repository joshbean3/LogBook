import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { and, eq, lt, ne, or, sql } from 'drizzle-orm';
import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { DB } from './db/index.js';
import { authSessions, users } from './db/schema.js';
import { env } from './env.js';
import type { ISODate } from '@logbook/shared';
import { clientToday, LOCAL_DATE_HEADER } from './lib/requests.js';
import { ApiError, nowISO, uid } from './lib/util.js';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;
/**
 * scrypt at OWASP's floor (N=2^15, r=8, p=3: the equal-cost setting to N=2^17, p=1, at a quarter of the memory).
 * Every parameter rides in the stored string, `scrypt$N$r$p$salt$key`, so they can be raised later: a sign-in with a
 * hash made under weaker settings is hashed again on the spot (`needsRehash`). The older `scrypt$N$salt$key` form
 * (r=8, p=1) still verifies.
 */
export const HASH_PARAMS = { N: 2 ** 15, r: 8, p: 3 } as const;
const MAXMEM = 256 * 1024 * 1024;
const KEY_LEN = 64;

export const hashPassword = async (pw: string): Promise<string> => {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, KEY_LEN, { ...HASH_PARAMS, maxmem: MAXMEM });
  return ['scrypt', HASH_PARAMS.N, HASH_PARAMS.r, HASH_PARAMS.p, salt.toString('base64'), key.toString('base64')].join('$');
};

/** The parts of a stored hash, in either form, or null when it is not one of ours. */
const parseHash = (stored: string): { N: number; r: number; p: number; salt: Buffer; key: Buffer; full: boolean } | null => {
  const parts = stored.split('$');
  if (parts[0] !== 'scrypt' || (parts.length !== 6 && parts.length !== 4)) return null;
  const full = parts.length === 6;
  const N = Number(parts[1]);
  const r = full ? Number(parts[2]) : 8;
  const p = full ? Number(parts[3]) : 1;
  const salt = full ? parts[4] : parts[2];
  const key = full ? parts[5] : parts[3];
  if (!salt || !key) return null;
  // refuse settings no hash of ours ever had, before spending memory on them
  if (!Number.isInteger(Math.log2(N)) || N < 2 ** 14 || N > 2 ** 20 || !Number.isInteger(r) || r < 1 || r > 16 || !Number.isInteger(p) || p < 1 || p > 16) return null;
  return { N, r, p, salt: Buffer.from(salt, 'base64'), key: Buffer.from(key, 'base64'), full };
};

export const verifyPassword = async (pw: string, stored: string): Promise<boolean> => {
  const h = parseHash(stored);
  if (!h || !h.key.length) return false;
  const key = await scrypt(pw, h.salt, h.key.length, { N: h.N, r: h.r, p: h.p, maxmem: MAXMEM });
  return key.length === h.key.length && timingSafeEqual(key, h.key);
};

/** Whether a stored hash was made under weaker settings than today's, so the next successful sign-in should replace it. */
export const needsRehash = (stored: string): boolean => {
  const h = parseHash(stored);
  return !h || !h.full || h.N * h.r * h.p < HASH_PARAMS.N * HASH_PARAMS.r * HASH_PARAMS.p;
};

export const COOKIE = 'logbook_session';
/** A session slides forward 60 days at a time while it is used, and ends 180 days after sign-in whatever the use. */
const DAYS = 60;
export const SESSION_MAX_DAYS = 180;
const DAY_MS = 864e5;

/** What the database keeps for a session: the SHA-256 of the cookie value, so a copy of the table signs nobody in. */
export const sessionKey = (cookieValue: string) => createHash('sha256').update(cookieValue).digest('hex');
/** The last moment a session made at `createdAt` may live. */
const capOf = (createdAt: string) => new Date(createdAt).getTime() + SESSION_MAX_DAYS * DAY_MS;
const cookieOptions = (expires: Date) => ({ httpOnly: true, sameSite: 'Lax' as const, secure: env.secureCookies, path: '/', expires });
const live = (row: { expiresAt: string; createdAt: string } | undefined, now = Date.now()): boolean => !!row && row.expiresAt >= new Date(now).toISOString() && capOf(row.createdAt) > now;

export const createSession = (db: DB, c: Context, userId: string) => {
  const value = uid('', 32);
  const expires = new Date(Date.now() + DAYS * DAY_MS);
  db.insert(authSessions).values({ id: sessionKey(value), userId, expiresAt: expires.toISOString(), createdAt: nowISO(), userAgent: c.req.header('user-agent')?.slice(0, 200) ?? null }).run();
  setCookie(c, COOKIE, value, cookieOptions(expires));
};

export const destroySession = (db: DB, c: Context) => {
  const value = getCookie(c, COOKIE);
  if (value) db.delete(authSessions).where(eq(authSessions.id, sessionKey(value))).run();
  deleteCookie(c, COOKIE, { path: '/' });
};

/** Drop sessions past their sliding expiry, and any older than the 180-day cap. */
export const purgeExpiredSessions = (db: DB, now = Date.now()) =>
  db
    .delete(authSessions)
    .where(or(lt(authSessions.expiresAt, new Date(now).toISOString()), lt(authSessions.createdAt, new Date(now - SESSION_MAX_DAYS * DAY_MS).toISOString())))
    .run();

/** The session this request carries, or null. `id` is the stored key (the hash), never the cookie value. */
export const sessionOf = (db: DB, c: Context): { id: string; userId: string } | null => {
  const value = getCookie(c, COOKIE);
  if (!value) return null;
  const row = db.select({ id: authSessions.id, userId: authSessions.userId, expiresAt: authSessions.expiresAt, createdAt: authSessions.createdAt }).from(authSessions).where(eq(authSessions.id, sessionKey(value))).get();
  return row && live(row) ? { id: row.id, userId: row.userId } : null;
};

/** Sign an account out everywhere, or everywhere but one session (`keep`, a stored key). Returns how many sessions ended. */
export const dropSessions = (db: DB, userId: string, keep?: string): number =>
  db
    .delete(authSessions)
    .where(keep ? and(eq(authSessions.userId, userId), ne(authSessions.id, keep)) : eq(authSessions.userId, userId))
    .run().changes;

let dummy: Promise<string> | null = null;
/**
 * A sign-in for an address with no account does the same password work as one with a wrong password, against a hash
 * of nothing, so the answer's timing does not say which addresses have accounts.
 */
export const verifyDummy = async (pw: string): Promise<false> => {
  dummy ??= hashPassword(randomBytes(18).toString('base64'));
  await verifyPassword(pw, await dummy);
  return false;
};

export interface AuthedUser {
  id: string;
  email: string;
  /** The athlete's name (contract 6); null until given in Settings → You. */
  name: string | null;
  /** When onboarding finished; null until then (the app shows /welcome). */
  onboardedAt: string | null;
}

/** `today`: the athlete's date for this request (`X-Local-Date`, see lib/requests.ts), never the server's when they differ. */
export type AuthEnv = { Variables: { user: AuthedUser; db: DB; today: ISODate } };

/**
 * Whether this request carries a live session, asked quietly: no 401, no side effects. `GET /auth/status` answers it so a
 * signed-out cold open can go to /start or /login without a failed request in the console.
 */
export const hasLiveSession = (db: DB, c: Context): boolean => !!sessionOf(db, c);

export const requireAuth = (db: DB): MiddlewareHandler<AuthEnv> => async (c, next) => {
  const value = getCookie(c, COOKIE);
  if (!value) throw new ApiError(401, 'Sign in to continue', 'unauthenticated');
  const id = sessionKey(value);
  const row = db
    .select({ id: users.id, email: users.email, name: users.name, onboardedAt: users.onboardedAt, expiresAt: authSessions.expiresAt, createdAt: authSessions.createdAt })
    .from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
    .where(eq(authSessions.id, id))
    .get();
  if (!row || !live(row)) {
    deleteCookie(c, COOKIE, { path: '/' });
    throw new ApiError(401, 'Session expired. Sign in again.', 'unauthenticated');
  }
  // slide the expiry forward once a day of use, never past the cap
  const left = new Date(row.expiresAt).getTime() - Date.now();
  if (left < (DAYS - 1) * DAY_MS) {
    const expires = new Date(Math.min(Date.now() + DAYS * DAY_MS, capOf(row.createdAt)));
    if (expires.getTime() > new Date(row.expiresAt).getTime()) {
      db.update(authSessions).set({ expiresAt: expires.toISOString() }).where(eq(authSessions.id, id)).run();
      setCookie(c, COOKIE, value, cookieOptions(expires));
    }
  }
  c.set('user', { id: row.id, email: row.email, name: row.name ?? null, onboardedAt: row.onboardedAt });
  c.set('db', db);
  c.set('today', clientToday(c.req.header(LOCAL_DATE_HEADER)));
  await next();
};

export const userCount = (db: DB): number => db.select({ n: sql<number>`count(*)` }).from(users).get()?.n ?? 0;
