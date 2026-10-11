import { zCredentials } from '@logbook/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { createSession, destroySession, hashPassword, requireAuth, userCount, verifyPassword, type AuthEnv } from '../auth.js';
import type { DB } from '../db/index.js';
import { users } from '../db/schema.js';
import { env } from '../env.js';
import { ApiError, nowISO, parseBody, uid } from '../lib/util.js';

/** A tiny in-memory throttle on failed sign-ins, per address. */
const failures = new Map<string, { n: number; until: number }>();
const check = (ip: string) => {
  const f = failures.get(ip);
  if (f && f.until > Date.now()) throw new ApiError(429, 'Too many attempts. Wait a minute and try again.', 'rate_limited');
};
const fail = (ip: string) => {
  const f = failures.get(ip) ?? { n: 0, until: 0 };
  f.n++;
  if (f.n >= 6) {
    f.until = Date.now() + 60_000;
    f.n = 0;
  }
  failures.set(ip, f);
};
const ipOf = (h: Headers) => h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('cf-connecting-ip') || 'local';

export const authRoutes = (db: DB) => {
  const r = new Hono<AuthEnv>();

  r.get('/status', (c) => {
    const n = userCount(db);
    return c.json({ hasAccount: n > 0, setupOpen: n === 0 && env.allowSetup });
  });

  r.post('/setup', async (c) => {
    if (userCount(db) > 0 || !env.allowSetup) throw new ApiError(403, 'Setup is closed. Sign in instead.', 'setup_closed');
    const { email, password } = await parseBody(c.req.raw, zCredentials);
    const id = uid('u');
    db.insert(users).values({ id, email, passwordHash: await hashPassword(password), createdAt: nowISO() }).run();
    createSession(db, c, id);
    return c.json({ id, email }, 201);
  });

  r.post('/login', async (c) => {
    const ip = ipOf(c.req.raw.headers);
    check(ip);
    const { email, password } = await parseBody(c.req.raw, zCredentials.extend({ password: zCredentials.shape.password.min(1) }));
    const row = db.select().from(users).where(eq(users.email, email)).get();
    if (!row || !(await verifyPassword(password, row.passwordHash))) {
      fail(ip);
      throw new ApiError(401, 'That email and password don’t match.', 'bad_credentials');
    }
    failures.delete(ip);
    createSession(db, c, row.id);
    return c.json({ id: row.id, email: row.email });
  });

  r.post('/logout', (c) => {
    destroySession(db, c);
    return c.json({ ok: true });
  });

  r.get('/me', requireAuth(db), (c) => c.json(c.get('user')));

  return r;
};
