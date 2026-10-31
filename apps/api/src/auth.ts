import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { and, eq, lt, ne, sql } from 'drizzle-orm';
import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { DB } from './db/index.js';
import { authSessions, emailTokens, users } from './db/schema.js';
import { env } from './env.js';
import type { ISODate } from '@logbook/shared';
import { assertSameOrigin } from './lib/csrf.js';
import { clientToday, LOCAL_DATE_HEADER, TIMEZONE_HEADER } from './lib/requests.js';
import { isTimeZone } from './lib/tz.js';
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

// ---------- password policy ----------

export const PASSWORD_MIN = 10;
/**
 * The hundred passwords people reach for first (the usual leaked-list leaders). Anything on it is refused whatever its
 * length; most are shorter than ten anyway, so the list mostly catches the long ones ("1234567890", "qwertyuiop").
 */
const COMMON = new Set(
  `123456 123456789 12345678 1234567890 12345 1234567 123123 1234567891 12345678910 111111 000000 654321 666666 123321 696969 112233 11111111 121212 7777777 88888888 123123123 987654321 1q2w3e4r 1q2w3e4r5t 1qaz2wsx qwerty qwerty123 qwertyuiop qwerty1234 qwerty12345 qwertyui qweasdzxc asdfghjkl asdfgh zxcvbnm password password1 password12 password1234 password12345 passw0rd p@ssw0rd p@ssword passwort passwords letmein welcome welcome1 welcome123 admin admin123 administrator root toor login master hello hello123 abc123 abcd1234 abcdefgh abcdefghij abc123456 iloveyou iloveyou1 iloveyou123 lovely sunshine princess dragon monkey shadow football baseball basketball superman superman1 batman michael jennifer jessica charlie thomas daniel computer internet whatever trustno1 starwars pokemon fuckyou nothing secret liverpool chelsea arsenal manchester samsung google facebook logbook logbook123 changeme letmein123 default`.split(/\s+/),
);

/** Why this password will not do, in plain words; null when it is fine. The email (and its name part) are refused too. */
export const passwordProblem = (pw: string, email?: string | null): string | null => {
  if (pw.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  const low = pw.toLowerCase();
  if (COMMON.has(low)) return 'That password is too common. Pick something only you would guess.';
  if (email) {
    const e = email.trim().toLowerCase();
    const local = e.split('@')[0] ?? '';
    if (low === e || (local.length >= 4 && low.includes(local))) return 'Your password can’t be your email address.';
  }
  return null;
};

// ---------- sessions ----------

export const COOKIE = 'logbook_session';
const DAYS = 60;
/** How often a session's `last_seen_at` is written: at most once an hour. */
export const LAST_SEEN_EVERY_MS = 3600_000;

export const createSession = (db: DB, c: Context, userId: string): string => {
  const id = uid('', 32);
  const expires = new Date(Date.now() + DAYS * 864e5);
  const now = nowISO();
  db.insert(authSessions).values({ id, userId, expiresAt: expires.toISOString(), createdAt: now, lastSeenAt: now, userAgent: c.req.header('user-agent')?.slice(0, 200) ?? null }).run();
  setCookie(c, COOKIE, id, { httpOnly: true, sameSite: 'Lax', secure: env.secureCookies, path: '/', expires });
  return id;
};

export const destroySession = (db: DB, c: Context) => {
  const id = getCookie(c, COOKIE);
  if (id) db.delete(authSessions).where(eq(authSessions.id, id)).run();
  deleteCookie(c, COOKIE, { path: '/' });
};

/** End every session of the account but `keep` (a password change or reset signs the other devices out). Returns how many went. */
export const revokeOtherSessions = (db: DB, userId: string, keep: string | null): number =>
  db
    .delete(authSessions)
    .where(keep ? and(eq(authSessions.userId, userId), ne(authSessions.id, keep)) : eq(authSessions.userId, userId))
    .run().changes;

export const purgeExpiredSessions = (db: DB) => db.delete(authSessions).where(lt(authSessions.expiresAt, nowISO())).run();

/**
 * A user agent in three or four words for the sessions list: "Safari on iPhone", "Chrome on Mac", "Logbook for iOS".
 * Never the raw string (it is 100+ characters of version numbers).
 */
export const describeUserAgent = (ua: string | null | undefined): string => {
  if (!ua) return 'Unknown device';
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /CrOS/.test(ua) ? 'Chromebook' : /Linux/.test(ua) ? 'Linux' : null;
  if (/Logbook|Capacitor/i.test(ua)) return os ? `Logbook for ${os === 'iPhone' || os === 'iPad' ? 'iOS' : os}` : 'Logbook app';
  const browser = /Edg(e|A|iOS)?\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /Firefox\/|FxiOS/.test(ua) ? 'Firefox' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /curl\//.test(ua) ? 'curl' : null;
  if (browser && os) return `${browser} on ${os}`;
  return browser ?? os ?? 'Unknown device';
};

// ---------- mailed one-time tokens ----------

export type TokenKind = 'verify' | 'reset';
export const TOKEN_TTL_MS: Record<TokenKind, number> = { verify: 24 * 3600_000, reset: 3600_000 };
const hashToken = (raw: string) => createHash('sha256').update(raw).digest('hex');

/** Mint a token for the mail: 32 random bytes as base64url; only its sha256 is kept. Earlier unused tokens of the kind stay valid until they expire. */
export const issueToken = (db: DB, userId: string, kind: TokenKind): string => {
  const raw = randomBytes(32).toString('base64url');
  db.insert(emailTokens)
    .values({ id: uid('t'), userId, kind, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + TOKEN_TTL_MS[kind]).toISOString(), usedAt: null, createdAt: nowISO() })
    .run();
  return raw;
};

/** Spend a token: its row when it exists, is of the kind, is unused and unexpired (marked used here); else the reason. */
export const consumeToken = (db: DB, kind: TokenKind, raw: string): { ok: true; userId: string } | { ok: false; why: 'invalid' | 'expired' | 'used' } => {
  if (!raw || raw.length > 200) return { ok: false, why: 'invalid' };
  const row = db.select().from(emailTokens).where(and(eq(emailTokens.tokenHash, hashToken(raw)), eq(emailTokens.kind, kind))).get();
  if (!row) return { ok: false, why: 'invalid' };
  if (row.usedAt) return { ok: false, why: 'used' };
  if (row.expiresAt < nowISO()) return { ok: false, why: 'expired' };
  db.update(emailTokens).set({ usedAt: nowISO() }).where(eq(emailTokens.id, row.id)).run();
  return { ok: true, userId: row.userId };
};

/** Tokens nobody can use any more: expired, or spent over a day ago. */
export const purgeOldTokens = (db: DB) => db.delete(emailTokens).where(lt(emailTokens.expiresAt, new Date(Date.now() - 864e5).toISOString())).run();

// ---------- the session middleware ----------

export interface AuthedUser {
  id: string;
  email: string;
  /** The athlete's name (contract 6); null until given in Settings → You. */
  name: string | null;
  /** When onboarding finished; null until then (the app shows /welcome). */
  onboardedAt: string | null;
  /** When the address was confirmed; null until the mailed link is opened. */
  emailVerifiedAt: string | null;
}

/** `today`: the athlete's date for this request (`X-Local-Date`, see lib/requests.ts), never the server's when they differ. */
export type AuthEnv = { Variables: { user: AuthedUser; db: DB; today: ISODate; sessionId: string } };

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

/** How long an unverified account may use the assistant and the connections before the link must be opened. */
export const UNVERIFIED_GRACE_DAYS = 7;
export const UNVERIFIED_MESSAGE = 'Verify your email to keep using the assistant and connections. Open the link we sent, or ask for a new one in Settings › Account.';
/**
 * The routes an unverified account loses after the grace period: the assistant (it spends model calls) and the
 * connections (they hand our callback to a third party), except reading the connections list, which Settings draws.
 * `/strava/*` is the alias `routes/strava.ts` rewrites to (the path arrives rewritten).
 */
export const needsVerifiedEmail = (method: string, path: string): boolean => {
  if (/^\/api\/assistant(\/|$)/.test(path)) return true;
  if (/^(\/api\/connections|\/strava)(\/|$)/.test(path)) return !(method === 'GET' && /^(\/api\/connections|\/strava)\/?$/.test(path));
  return false;
};

export const requireAuth = (db: DB): MiddlewareHandler<AuthEnv> => async (c, next) => {
  // the origin check comes first: a forged request is refused before it can touch a session
  assertSameOrigin(c);
  const id = getCookie(c, COOKIE);
  if (!id) throw new ApiError(401, 'Sign in to continue', 'unauthenticated');
  const row = db
    .select({ id: users.id, email: users.email, name: users.name, onboardedAt: users.onboardedAt, timezone: users.timezone, createdAt: users.createdAt, emailVerifiedAt: users.emailVerifiedAt, expiresAt: authSessions.expiresAt, lastSeenAt: authSessions.lastSeenAt })
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
  // the sessions list says when each device was last here, to the hour
  if (!row.lastSeenAt || Date.now() - new Date(row.lastSeenAt).getTime() > LAST_SEEN_EVERY_MS) db.update(authSessions).set({ lastSeenAt: nowISO() }).where(eq(authSessions.id, id)).run();
  // the client says where it is (`X-Timezone`): kept on the account when it changes, for reminders and the assistant
  const tz = c.req.header(TIMEZONE_HEADER)?.trim();
  if (tz && tz !== row.timezone && isTimeZone(tz)) db.update(users).set({ timezone: tz }).where(eq(users.id, row.id)).run();
  // an address nobody confirmed in a week: the app stays open, the assistant and the connections wait for the link
  if (!row.emailVerifiedAt && Date.now() - new Date(row.createdAt).getTime() > UNVERIFIED_GRACE_DAYS * 864e5 && needsVerifiedEmail(c.req.method, c.req.path)) throw new ApiError(403, UNVERIFIED_MESSAGE, 'email_unverified');
  c.set('user', { id: row.id, email: row.email, name: row.name ?? null, onboardedAt: row.onboardedAt, emailVerifiedAt: row.emailVerifiedAt ?? null });
  c.set('db', db);
  c.set('sessionId', id);
  c.set('today', clientToday(c.req.header(LOCAL_DATE_HEADER)));
  await next();
};

export const userCount = (db: DB): number => db.select({ n: sql<number>`count(*)` }).from(users).get()?.n ?? 0;
