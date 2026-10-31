import { zCredentials } from '@logbook/shared';
import { and, asc, eq } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import { deleteCookie } from 'hono/cookie';
import { z } from 'zod';
import {
  COOKIE,
  consumeToken,
  createSession,
  describeUserAgent,
  destroySession,
  hashPassword,
  hasLiveSession,
  issueToken,
  passwordProblem,
  requireAuth,
  revokeOtherSessions,
  spendToken,
  userCount,
  verifyPassword,
  type AuthEnv,
} from '../auth.js';
import type { DB } from '../db/index.js';
import { authSessions, users } from '../db/schema.js';
import { env } from '../env.js';
import { csrf } from '../lib/csrf.js';
import { checkRate, rateLimit } from '../lib/ratelimit.js';
import { ApiError, nowISO, parseBody, uid } from '../lib/util.js';
import { lastMail, resetMail, sendMail, sentMails, tokenOf, verifyMail } from '../services/mail.js';

/** A tiny in-memory throttle on failed sign-ins (and failed password checks), per address. */
const failures = new Map<string, { n: number; until: number }>();
export const checkThrottle = (ip: string) => {
  const f = failures.get(ip);
  if (f && f.until > Date.now()) throw new ApiError(429, 'Too many attempts. Wait a minute and try again.', 'rate_limited');
};
export const failThrottle = (ip: string) => {
  const f = failures.get(ip) ?? { n: 0, until: 0 };
  f.n++;
  if (f.n >= 6) {
    f.until = Date.now() + 60_000;
    f.n = 0;
  }
  failures.set(ip, f);
};
export const clearThrottle = (ip: string) => failures.delete(ip);
export const ipOf = (h: Headers) => h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('cf-connecting-ip') || 'local';

/** The limits on the mailing routes: resend 3 an hour per account; forgot 5 an hour per address of origin, 3 per email. */
export const RESEND_LIMIT = { limit: 3, windowMs: 3600_000 };
export const FORGOT_IP_LIMIT = { limit: 5, windowMs: 3600_000 };
export const FORGOT_EMAIL_LIMIT = { limit: 3, windowMs: 3600_000 };

const zToken = z.string().trim().min(1).max(200);
const zPassword = z.string().min(1).max(200);

/** The verify link for `userId`, and the mail on its way. Never throws: a mail that fails to send is logged and reported in the answer. */
export const sendVerification = async (db: DB, userId: string, email: string): Promise<boolean> => {
  const token = issueToken(db, userId, 'verify');
  const r = await sendMail(verifyMail(email, `${env.APP_URL}/verify?token=${token}`));
  return r.ok;
};

const publicUser = (u: { id: string; email: string; name: string | null; onboardedAt: string | null; emailVerifiedAt: string | null }) => ({ id: u.id, email: u.email, name: u.name ?? null, onboardedAt: u.onboardedAt, emailVerifiedAt: u.emailVerifiedAt ?? null });

export const authRoutes = (db: DB) => {
  const r = new Hono<AuthEnv>();
  // every write here (sign in, sign up, forgot, reset, verify) must come from the app: see lib/csrf.ts
  r.use('*', csrf);

  /** Can this visitor make an account? The first one when setup is open; any more only with ALLOW_SIGNUP. */
  const canCreate = (n: number) => (n === 0 && (env.allowSetup || env.allowSignup)) || (n > 0 && env.allowSignup);

  /** `signedIn`: this visitor has a live session (the app asks before it requests anything that needs one). */
  r.get('/status', (c) => {
    const n = userCount(db);
    return c.json({ hasAccount: n > 0, setupOpen: canCreate(n), signupOpen: canCreate(n), signedIn: hasLiveSession(db, c) });
  });

  /**
   * Create an account and sign it in. The new account has `onboardedAt: null`, so the app sends it to /welcome, and
   * `emailVerifiedAt: null` with a verify link on its way (`verificationSent` says whether the mail went).
   */
  const create = async (c: Context<AuthEnv>) => {
    if (!canCreate(userCount(db))) throw new ApiError(403, 'Setup is closed. Sign in instead.', 'setup_closed');
    const { email, password } = await parseBody(c.req.raw, zCredentials);
    const weak = passwordProblem(password, email);
    if (weak) throw new ApiError(422, weak, 'weak_password');
    if (db.select({ id: users.id }).from(users).where(eq(users.email, email)).get()) throw new ApiError(409, 'There is already an account with that email. Sign in instead.', 'email_taken');
    const id = uid('u');
    db.insert(users).values({ id, email, passwordHash: await hashPassword(password), createdAt: nowISO(), onboardedAt: null, emailVerifiedAt: null }).run();
    createSession(db, c, id);
    const verificationSent = await sendVerification(db, id, email);
    return c.json({ id, email, name: null, onboardedAt: null, emailVerifiedAt: null, verificationSent }, 201);
  };
  r.post('/setup', create);
  r.post('/signup', create);

  r.post('/login', async (c) => {
    const ip = ipOf(c.req.raw.headers);
    checkThrottle(ip);
    const { email, password } = await parseBody(c.req.raw, zCredentials.extend({ password: zCredentials.shape.password.min(1) }));
    const row = db.select().from(users).where(eq(users.email, email)).get();
    if (!row || !(await verifyPassword(password, row.passwordHash))) {
      failThrottle(ip);
      throw new ApiError(401, 'That email and password don’t match.', 'bad_credentials');
    }
    clearThrottle(ip);
    createSession(db, c, row.id);
    return c.json(publicUser(row));
  });

  r.post('/logout', (c) => {
    destroySession(db, c);
    return c.json({ ok: true });
  });

  r.get('/me', requireAuth(db), (c) => c.json(c.get('user')));

  // ---------- email verification ----------

  /** The mailed link lands here with its token (no session needed: the link may open in another browser). */
  r.post('/verify', async (c) => {
    const { token } = await parseBody(c.req.raw, z.object({ token: zToken }));
    const t = consumeToken(db, 'verify', token);
    if (!t.ok) throw new ApiError(400,t.why === 'expired' ? 'This link has expired. Ask for a new one.' : t.why === 'used' ? 'This link was already used.' : 'This link isn’t right. Ask for a new one.', `token_${t.why}`);
    const u = db.select().from(users).where(eq(users.id, t.userId)).get();
    if (!u) throw new ApiError(400, 'This link isn’t right. Ask for a new one.', 'token_invalid');
    const emailVerifiedAt = u.emailVerifiedAt ?? nowISO();
    if (!u.emailVerifiedAt) db.update(users).set({ emailVerifiedAt }).where(eq(users.id, u.id)).run();
    return c.json({ ok: true, email: u.email, emailVerifiedAt });
  });

  /** A fresh link to the signed-in account's address: three an hour. */
  r.post('/verify/resend', requireAuth(db), rateLimit('verify-resend', RESEND_LIMIT.limit, RESEND_LIMIT.windowMs, 'Three verification mails an hour is the limit.'), async (c) => {
    const u = c.get('user');
    if (u.emailVerifiedAt) return c.json({ ok: true, sent: false, emailVerifiedAt: u.emailVerifiedAt });
    const sent = await sendVerification(db, u.id, u.email);
    return c.json({ ok: true, sent, emailVerifiedAt: null });
  });

  // ---------- password reset ----------

  /** Always a 200 (no account enumeration): the mail goes only when there is an account. 5 an hour per address of origin, 3 per email. */
  r.post('/forgot', async (c) => {
    const ip = ipOf(c.req.raw.headers);
    const { email } = await parseBody(c.req.raw, z.object({ email: zCredentials.shape.email }));
    const byIp = checkRate(`forgot-ip:${ip}`, FORGOT_IP_LIMIT.limit, FORGOT_IP_LIMIT.windowMs);
    const byEmail = byIp.ok ? checkRate(`forgot-email:${email}`, FORGOT_EMAIL_LIMIT.limit, FORGOT_EMAIL_LIMIT.windowMs) : byIp;
    if (!byIp.ok || !byEmail.ok) {
      const sec = byIp.ok ? byEmail.retryAfterSec : byIp.retryAfterSec;
      c.header('retry-after', String(sec));
      throw new ApiError(429, `Too many reset requests. Try again in ${sec >= 60 ? `${Math.ceil(sec / 60)} min` : `${sec} s`}.`, 'rate_limited');
    }
    const u = db.select({ id: users.id, email: users.email }).from(users).where(eq(users.email, email)).get();
    if (u) {
      const token = issueToken(db, u.id, 'reset');
      await sendMail(resetMail(u.email, `${env.APP_URL}/reset?token=${token}`));
    }
    return c.json({ ok: true });
  });

  /** The reset link's token and the new password: sets it, signs every other device out, signs this one in. */
  r.post('/reset', async (c) => {
    const { token, password } = await parseBody(c.req.raw, z.object({ token: zToken, password: zPassword }));
    // the policy is checked before the token is spent, so a weak first choice does not burn the link
    const t = consumeToken(db, 'reset', token, { spend: false });
    if (!t.ok) throw new ApiError(400,t.why === 'expired' ? 'This link has expired. Ask for a new one.' : t.why === 'used' ? 'This link was already used. Ask for a new one.' : 'This link isn’t right. Ask for a new one.', `token_${t.why}`);
    const u = db.select().from(users).where(eq(users.id, t.userId)).get();
    if (!u) throw new ApiError(400, 'This link isn’t right. Ask for a new one.', 'token_invalid');
    const weak = passwordProblem(password, u.email);
    if (weak) throw new ApiError(422, weak, 'weak_password');
    spendToken(db, t.tokenId);
    const now = nowISO();
    // the address received the link, which proves it as well as the verify mail would
    db.update(users).set({ passwordHash: await hashPassword(password), passwordChangedAt: now, emailVerifiedAt: u.emailVerifiedAt ?? now }).where(eq(users.id, u.id)).run();
    revokeOtherSessions(db, u.id, null);
    createSession(db, c, u.id);
    return c.json(publicUser({ ...u, emailVerifiedAt: u.emailVerifiedAt ?? now }));
  });

  /** Settings › Account › Change password: the current one, then the new one. Every other device is signed out. */
  r.post('/password', requireAuth(db), async (c) => {
    const ip = ipOf(c.req.raw.headers);
    checkThrottle(ip);
    const { current, password } = await parseBody(c.req.raw, z.object({ current: zPassword, password: zPassword }));
    const u = db.select().from(users).where(eq(users.id, c.get('user').id)).get();
    if (!u || !(await verifyPassword(current, u.passwordHash))) {
      failThrottle(ip);
      throw new ApiError(403, 'That password doesn’t match.', 'bad_password');
    }
    clearThrottle(ip);
    const weak = passwordProblem(password, u.email);
    if (weak) throw new ApiError(422, weak, 'weak_password');
    db.update(users).set({ passwordHash: await hashPassword(password), passwordChangedAt: nowISO() }).where(eq(users.id, u.id)).run();
    const revoked = revokeOtherSessions(db, u.id, c.get('sessionId'));
    return c.json({ ok: true, revoked });
  });

  // ---------- sessions ----------

  const sessionView = (s: typeof authSessions.$inferSelect, current: string) => ({ id: s.id, current: s.id === current, device: describeUserAgent(s.userAgent), createdAt: s.createdAt, lastSeenAt: s.lastSeenAt ?? s.createdAt, expiresAt: s.expiresAt });

  /** Every live session of the account, this one marked `current`, oldest first. */
  r.get('/sessions', requireAuth(db), (c) => {
    const now = nowISO();
    const rows = db.select().from(authSessions).where(eq(authSessions.userId, c.get('user').id)).orderBy(asc(authSessions.createdAt)).all();
    return c.json(rows.filter((s) => s.expiresAt >= now).map((s) => sessionView(s, c.get('sessionId'))));
  });

  /** Sign one device out. Ending this one clears the cookie too (the app shows sign in). */
  r.delete('/sessions/:id', requireAuth(db), (c) => {
    const id = c.req.param('id');
    const gone = db.delete(authSessions).where(and(eq(authSessions.id, id), eq(authSessions.userId, c.get('user').id))).run().changes;
    if (!gone) throw new ApiError(404, 'That session is already over.', 'not_found');
    if (id === c.get('sessionId')) deleteCookie(c, COOKIE, { path: '/' });
    return c.json({ ok: true, current: id === c.get('sessionId') });
  });

  /** "Sign out everywhere else": every session but this one. */
  r.post('/sessions/revoke-others', requireAuth(db), (c) => c.json({ ok: true, revoked: revokeOtherSessions(db, c.get('user').id, c.get('sessionId')) }));

  // ---------- dev ----------

  /** Outside production: the last mail the server composed, with its token, so a verify or reset can be walked by hand. */
  if (!env.isProd)
    r.get('/dev/last-mail', (c) => {
      const m = lastMail();
      return c.json(m ? { ...m, token: tokenOf(m), count: sentMails.length } : null);
    });

  return r;
};
