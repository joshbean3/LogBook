import { passwordProblem, zConsentInput, zCredentials, zForgotPassword, zLogin, zLogout, zResetPassword } from '@logbook/shared';
import { and, eq, isNull } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import { createSession, destroySession, dropSessions, hashPassword, hasLiveSession, needsRehash, requireAuth, sessionOf, userCount, verifyDummy, verifyPassword, type AuthEnv } from '../auth.js';
import type { DB } from '../db/index.js';
import { healthDevices, users } from '../db/schema.js';
import { env } from '../env.js';
import { ApiError, nowISO, parseBody, uid } from '../lib/util.js';
import { audit } from '../services/audit.js';
import { consumeToken, issueToken, peekToken } from '../services/authTokens.js';
import { writeConsent } from '../services/consent.js';
import { resetMail, sendMail, verifyMail } from '../services/mail.js';
import { checkEmailLock, checkThrottle, clearEmail, clearThrottle, clientIp, emailKey, failEmail, failThrottle, hitLimit, ipKey, tooMany } from '../services/throttle.js';

/** Reset links asked for: per email and per address, an hour. Past either, the answer is still 200 and nothing is sent. */
export const FORGOT_LIMITS = { perEmail: 3, perIp: 10, windowMs: 3600_000 } as const;
const HOUR = 3600_000;

/** Send the "confirm your email" link for an account. Not awaited by callers: the answer never waits on the mail provider. */
export const sendVerification = (db: DB, user: { id: string; email: string }) => sendMail(verifyMail(user.email, `${env.APP_URL}/api/auth/verify?token=${issueToken(db, user.id, 'verify')}`));

/** The small page the verification link opens (in Safari, outside the app). No script, no external assets. */
const verifyPage = (ok: boolean) => {
  const title = ok ? 'Email confirmed' : 'That link no longer works';
  const line = ok ? 'Thanks. You can close this page and go back to Logbook.' : 'It was used already or it has expired. Your account is fine. Sign in to Logbook as usual.';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${title} · Logbook</title><style>:root{color-scheme:light dark}body{margin:0;min-height:100vh;display:grid;place-items:center;font:17px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f5f7fa;color:#1a1d21}main{max-width:26rem;padding:2rem 1.5rem;text-align:center}h1{font-size:1.5rem;margin:0 0 .5rem}p{margin:0;color:#4a5058}@media (prefers-color-scheme:dark){body{background:#101215;color:#f2f4f6}p{color:#b5bbc3}}</style></head><body><main><h1>${title}</h1><p>${line}</p></main></body></html>`;
};

export const authRoutes = (db: DB) => {
  const r = new Hono<AuthEnv>();

  /** Can this visitor make an account? The first one when setup is open; any more only with ALLOW_SIGNUP. */
  const canCreate = (n: number) => (n === 0 && (env.allowSetup || env.allowSignup)) || (n > 0 && env.allowSignup);

  /** `signedIn`: this visitor has a live session (the app asks before it requests anything that needs one). */
  r.get('/status', (c) => {
    const n = userCount(db);
    return c.json({ hasAccount: n > 0, setupOpen: canCreate(n), signupOpen: canCreate(n), signedIn: hasLiveSession(db, c) });
  });

  /**
   * Create an account and sign it in. The new account has `onboardedAt: null`, so the app sends it to /welcome, and a
   * "confirm your email" link is sent to its address. At most SIGNUP_PER_HOUR accounts an hour from one address.
   */
  const create = async (c: Context<AuthEnv>) => {
    if (!canCreate(userCount(db))) throw new ApiError(403, 'Setup is closed. Sign in instead.', 'setup_closed');
    // `consent`: a choice made before the account existed (optional). With none, nothing is stored and nothing is granted.
    const { email, password, consent } = await parseBody(c.req.raw, zCredentials.extend({ consent: zConsentInput.optional() }));
    // the same rules the form shows: not one of the most common passwords, not the email (shared `passwordProblem`)
    const weak = passwordProblem(password, email);
    if (weak) throw new ApiError(422, weak, 'weak_password');
    if (env.signupPerHour > 0) {
      const wait = hitLimit(db, ipKey('signup', clientIp(c)), env.signupPerHour, HOUR);
      if (wait) throw tooMany(wait, 'Too many new accounts from here. Try again in an hour.');
    }
    if (db.select({ id: users.id }).from(users).where(eq(users.email, email)).get()) throw new ApiError(409, 'There is already an account with that email. Sign in instead.', 'email_taken');
    const id = uid('u');
    db.insert(users).values({ id, email, passwordHash: await hashPassword(password), createdAt: nowISO(), onboardedAt: null }).run();
    audit(db, 'signup', id);
    if (consent) writeConsent(db, id, consent);
    createSession(db, c, id);
    void sendVerification(db, { id, email });
    return c.json({ id, email, name: null, onboardedAt: null }, 201);
  };
  r.post('/setup', create);
  r.post('/signup', create);

  /**
   * Sign in. Two limits: failures from one address (six, then a minute), and failures for one email whatever the
   * address (delays that grow, kept across restarts). An address with no account costs the same time as a wrong password.
   */
  r.post('/login', async (c) => {
    const ip = ipKey('login', clientIp(c));
    checkThrottle(ip);
    const { email, password } = await parseBody(c.req.raw, zLogin);
    checkEmailLock(db, email);
    const row = db.select().from(users).where(eq(users.email, email)).get();
    const ok = row ? await verifyPassword(password, row.passwordHash) : await verifyDummy(password);
    if (!row || !ok) {
      failThrottle(ip);
      failEmail(db, email);
      audit(db, 'login_failed', row?.id ?? null);
      throw new ApiError(401, 'That email and password don’t match.', 'bad_credentials');
    }
    clearThrottle(ip);
    clearEmail(db, email);
    // a hash made under older, weaker settings is replaced now, while the password is in hand
    if (needsRehash(row.passwordHash)) db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, row.id)).run();
    audit(db, 'login', row.id);
    createSession(db, c, row.id);
    return c.json({ id: row.id, email: row.email, name: row.name ?? null, onboardedAt: row.onboardedAt });
  });

  /**
   * Sign out. An optional body `{ healthTokenId }` (the `deviceId` Apple Health connect answered) revokes that device's
   * sync token too, so a signed-out phone stops uploading. Only a device of the signed-in account can be revoked.
   */
  r.post('/logout', async (c) => {
    const session = sessionOf(db, c);
    const raw = await c.req.text().catch(() => '');
    let body: unknown = {};
    try {
      body = raw.trim() ? JSON.parse(raw) : {};
    } catch {
      body = {};
    }
    const parsed = zLogout.safeParse(body);
    const deviceId = parsed.success ? parsed.data.healthTokenId : undefined;
    let healthRevoked = false;
    if (session && deviceId) healthRevoked = db.update(healthDevices).set({ revokedAt: nowISO() }).where(and(eq(healthDevices.id, deviceId), eq(healthDevices.userId, session.userId), isNull(healthDevices.revokedAt))).run().changes > 0;
    destroySession(db, c);
    if (session) audit(db, 'logout', session.userId);
    return c.json({ ok: true, healthRevoked });
  });

  /**
   * Ask for a reset link. Always `200 { ok: true }`, at once, whether or not the address has an account (the mail goes
   * out after the answer). Three an hour per email and ten per address; past that the answer is the same and nothing is sent.
   */
  r.post('/forgot', async (c) => {
    const { email } = await parseBody(c.req.raw, zForgotPassword);
    const overIp = hitLimit(db, ipKey('forgot', clientIp(c)), FORGOT_LIMITS.perIp, FORGOT_LIMITS.windowMs);
    const overEmail = overIp ? 1 : hitLimit(db, emailKey('forgot', email), FORGOT_LIMITS.perEmail, FORGOT_LIMITS.windowMs);
    if (!overIp && !overEmail) {
      const row = db.select({ id: users.id, email: users.email }).from(users).where(eq(users.email, email)).get();
      if (row) {
        audit(db, 'password_reset_asked', row.id);
        void sendMail(resetMail(row.email, `${env.APP_URL}/login?reset=${issueToken(db, row.id, 'reset')}`));
      }
    }
    return c.json({ ok: true });
  });

  /**
   * Set a new password with the token from the emailed link. The token works once, for 30 minutes. Every session of the
   * account ends (the person signs in again with the new password), and the address counts as confirmed: the link came
   * from its inbox.
   */
  r.post('/reset', async (c) => {
    const ip = ipKey('reset', clientIp(c));
    checkThrottle(ip);
    const { token, password } = await parseBody(c.req.raw, zResetPassword);
    // checked before the link is spent, so a refused password can be changed and sent again with the same link
    const early = passwordProblem(password);
    if (early) throw new ApiError(422, early, 'weak_password');
    const owner = peekToken(db, token, 'reset');
    const ownerEmail = owner ? db.select({ email: users.email }).from(users).where(eq(users.id, owner)).get()?.email : null;
    const weak = ownerEmail ? passwordProblem(password, ownerEmail) : null;
    if (weak) throw new ApiError(422, weak, 'weak_password');
    const userId = consumeToken(db, token, 'reset');
    const row = userId ? db.select({ id: users.id, email: users.email, emailVerifiedAt: users.emailVerifiedAt }).from(users).where(eq(users.id, userId)).get() : null;
    if (!row) {
      failThrottle(ip);
      throw new ApiError(400, 'That reset link has expired or was already used. Ask for a new one.', 'reset_invalid');
    }
    const hash = await hashPassword(password);
    db.transaction(() => {
      db.update(users).set({ passwordHash: hash, emailVerifiedAt: row.emailVerifiedAt ?? nowISO() }).where(eq(users.id, row.id)).run();
      dropSessions(db, row.id);
    });
    clearEmail(db, row.email);
    audit(db, 'password_reset', row.id);
    return c.json({ ok: true });
  });

  /** The link in the verification mail: marks the address confirmed and answers a small page. */
  r.get('/verify', (c) => {
    const userId = consumeToken(db, c.req.query('token') ?? '', 'verify');
    if (userId) {
      db.update(users).set({ emailVerifiedAt: nowISO() }).where(and(eq(users.id, userId), isNull(users.emailVerifiedAt))).run();
      audit(db, 'email_verified', userId);
    }
    c.header('cache-control', 'no-store');
    c.header('referrer-policy', 'no-referrer');
    return c.html(verifyPage(!!userId), userId ? 200 : 410);
  });

  r.get('/me', requireAuth(db), (c) => c.json(c.get('user')));

  return r;
};
