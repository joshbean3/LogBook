import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { and, eq, lt, ne, sql } from 'drizzle-orm';
import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { DB } from './db/index.js';
import { authSessions, users } from './db/schema.js';
import { env } from './env.js';
import type { ISODate } from '@logbook/shared';
import { clientToday, LOCAL_DATE_HEADER } from './lib/requests.js';
import { ApiError, nowISO, uid } from './lib/util.js';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;
const PARAMS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export const hashPassword = async (pw: string): Promise<string> => {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 64, PARAMS);
  return `scrypt$${PARAMS.N}$${salt.toString('base64')}$${key.toString('base64')}`;
};

export const verifyPassword = async (pw: string, stored: string): Promise<boolean> => {
  const [algo, n, saltB64, keyB64] = stored.split('$');
  if (algo !== 'scrypt' || !n || !saltB64 || !keyB64) return false;
  const key = await scrypt(pw, Buffer.from(saltB64, 'base64'), 64, { ...PARAMS, N: Number(n) });
  const expected = Buffer.from(keyB64, 'base64');
  return key.length === expected.length && timingSafeEqual(key, expected);
};

export const COOKIE = 'logbook_session';
const DAYS = 60;

export const createSession = (db: DB, c: Context, userId: string) => {
  const id = uid('', 32);
  const expires = new Date(Date.now() + DAYS * 864e5);
  db.insert(authSessions).values({ id, userId, expiresAt: expires.toISOString(), createdAt: nowISO(), userAgent: c.req.header('user-agent')?.slice(0, 200) ?? null }).run();
  setCookie(c, COOKIE, id, { httpOnly: true, sameSite: 'Lax', secure: env.secureCookies, path: '/', expires });
};

export const destroySession = (db: DB, c: Context) => {
  const id = getCookie(c, COOKIE);
  if (id) db.delete(authSessions).where(eq(authSessions.id, id)).run();
  deleteCookie(c, COOKIE, { path: '/' });
};

export const purgeExpiredSessions = (db: DB) => db.delete(authSessions).where(lt(authSessions.expiresAt, nowISO())).run();

/** The session this request carries, or null. */
export const sessionOf = (db: DB, c: Context): { id: string; userId: string } | null => {
  const id = getCookie(c, COOKIE);
  if (!id) return null;
  const row = db.select({ id: authSessions.id, userId: authSessions.userId, expiresAt: authSessions.expiresAt }).from(authSessions).where(eq(authSessions.id, id)).get();
  return row && row.expiresAt >= nowISO() ? { id: row.id, userId: row.userId } : null;
};

/** Sign an account out everywhere, or everywhere but one session (`keep`). Returns how many sessions ended. */
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
export const hasLiveSession = (db: DB, c: Context): boolean => {
  const id = getCookie(c, COOKIE);
  if (!id) return false;
  const row = db.select({ expiresAt: authSessions.expiresAt }).from(authSessions).where(eq(authSessions.id, id)).get();
  return !!row && row.expiresAt >= nowISO();
};

export const requireAuth = (db: DB): MiddlewareHandler<AuthEnv> => async (c, next) => {
  const id = getCookie(c, COOKIE);
  if (!id) throw new ApiError(401, 'Sign in to continue', 'unauthenticated');
  const row = db
    .select({ id: users.id, email: users.email, name: users.name, onboardedAt: users.onboardedAt, expiresAt: authSessions.expiresAt })
    .from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
    .where(eq(authSessions.id, id))
    .get();
  if (!row || row.expiresAt < nowISO()) {
    deleteCookie(c, COOKIE, { path: '/' });
    throw new ApiError(401, 'Session expired. Sign in again.', 'unauthenticated');
  }
  // slide the expiry forward once a day of use
  const left = new Date(row.expiresAt).getTime() - Date.now();
  if (left < (DAYS - 1) * 864e5) {
    const expires = new Date(Date.now() + DAYS * 864e5);
    db.update(authSessions).set({ expiresAt: expires.toISOString() }).where(eq(authSessions.id, id)).run();
    setCookie(c, COOKIE, id, { httpOnly: true, sameSite: 'Lax', secure: env.secureCookies, path: '/', expires });
  }
  c.set('user', { id: row.id, email: row.email, name: row.name ?? null, onboardedAt: row.onboardedAt });
  c.set('db', db);
  c.set('today', clientToday(c.req.header(LOCAL_DATE_HEADER)));
  await next();
};

export const userCount = (db: DB): number => db.select({ n: sql<number>`count(*)` }).from(users).get()?.n ?? 0;
