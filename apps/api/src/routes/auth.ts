import { zCredentials } from '@logbook/shared';
import { eq } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import { createSession, destroySession, hashPassword, requireAuth, userCount, verifyPassword, type AuthEnv } from '../auth.js';
import type { DB } from '../db/index.js';
import { users } from '../db/schema.js';
import { env } from '../env.js';
import { ApiError, nowISO, parseBody, uid } from '../lib/util.js';

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

export const authRoutes = (db: DB) => {
  const r = new Hono<AuthEnv>();

  /** Can this visitor make an account? The first one when setup is open; any more only with ALLOW_SIGNUP. */
  const canCreate = (n: number) => (n === 0 && (env.allowSetup || env.allowSignup)) || (n > 0 && env.allowSignup);

  r.get('/status', (c) => {
    const n = userCount(db);
    return c.json({ hasAccount: n > 0, setupOpen: canCreate(n), signupOpen: canCreate(n) });
  });

  /** Create an account and sign it in. The new account has `onboardedAt: null`, so the app sends it to /welcome. */
  const create = async (c: Context<AuthEnv>) => {
    if (!canCreate(userCount(db))) throw new ApiError(403, 'Setup is closed. Sign in instead.', 'setup_closed');
    const { email, password } = await parseBody(c.req.raw, zCredentials);
    if (db.select({ id: users.id }).from(users).where(eq(users.email, email)).get()) throw new ApiError(409, 'There is already an account with that email. Sign in instead.', 'email_taken');
    const id = uid('u');
    db.insert(users).values({ id, email, passwordHash: await hashPassword(password), createdAt: nowISO(), onboardedAt: null }).run();
    createSession(db, c, id);
    return c.json({ id, email, onboardedAt: null }, 201);
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
    return c.json({ id: row.id, email: row.email, onboardedAt: row.onboardedAt });
  });

  r.post('/logout', (c) => {
    destroySession(db, c);
    return c.json({ ok: true });
  });

  r.get('/me', requireAuth(db), (c) => c.json(c.get('user')));

  return r;
};
