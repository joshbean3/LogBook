import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DB } from '../db/index.js';
import { authSessions, authThrottle, authTokens, users } from '../db/schema.js';
import { env } from '../env.js';
import { hashToken } from '../services/authTokens.js';
import { setMailTransport, type Mail } from '../services/mail.js';
import { EMAIL_DELAYS_SEC, EMAIL_FREE_FAILS, clientIp, resetThrottles } from '../services/throttle.js';
import { makeApp, signUp, type App } from '../test/helpers.js';
import { FORGOT_LIMITS } from './auth.js';

/** Password reset, change password, email verification, and the limits on the public doors (Contract 3). */
let app: App;
let db: DB;
let outbox: Mail[];
const PW = 'correct horse 42';
const post = async (url: string, body?: unknown, headers: Record<string, string> = {}) => {
  const res = await app.request(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed, headers: res.headers, cookie: (res.headers.get('set-cookie') ?? '').split(';')[0]! };
};
/** Let the mail that is sent after the answer land. */
const settle = () => new Promise((r) => setTimeout(r, 5));
const linkIn = (m: Mail) => /https?:\/\/\S+/.exec(m.text)![0];
const tokenIn = (m: Mail) => new URL(linkIn(m)).searchParams.get('reset') ?? new URL(linkIn(m)).searchParams.get('token')!;
const mailsTo = (to: string, subject: RegExp) => outbox.filter((m) => m.to === to && subject.test(m.subject));

beforeEach(() => {
  ({ app, db } = makeApp());
  resetThrottles();
  outbox = [];
  setMailTransport((m) => void outbox.push(m));
});
afterEach(() => {
  setMailTransport(null);
  env.signupPerHour = 0;
  vi.useRealTimers();
});

describe('POST /auth/forgot', () => {
  it('always answers 200 { ok: true }, account or not, and mails a link only to an account', async () => {
    await signUp(app, 'known@example.com', PW);
    outbox = [];
    for (const email of ['known@example.com', 'nobody@example.com', 'KNOWN@example.com ']) {
      const r = await post('/api/auth/forgot', { email });
      expect(r.status).toBe(200);
      expect(r.body).toEqual({ ok: true });
    }
    await settle();
    expect(outbox.map((m) => m.to)).toEqual(['known@example.com', 'known@example.com']);
    expect(outbox[0]!.subject).toBe('Reset your Orby password');
    expect(linkIn(outbox[0]!)).toMatch(new RegExp(`^${env.APP_URL}/login\\?reset=[A-Za-z0-9_-]{40,}$`));
    expect(outbox[0]!.text).toContain('30 minutes');
    expect((await post('/api/auth/forgot', { email: 'not an email' })).status).toBe(422);
  });

  it('is rate limited: three an hour per email and ten per address, and the answer stays the same', async () => {
    await signUp(app, 'known@example.com', PW);
    outbox = [];
    for (let i = 0; i < FORGOT_LIMITS.perEmail + 3; i++) expect((await post('/api/auth/forgot', { email: 'known@example.com' }, { 'fly-client-ip': `198.51.100.${i}` })).body).toEqual({ ok: true });
    await settle();
    expect(outbox).toHaveLength(FORGOT_LIMITS.perEmail);
    // one address asking about many emails stops sending after ten
    outbox = [];
    for (let i = 0; i < FORGOT_LIMITS.perIp + 4; i++) {
      await signUp(app, `many${i}@example.com`, PW);
    }
    outbox = [];
    for (let i = 0; i < FORGOT_LIMITS.perIp + 4; i++) expect((await post('/api/auth/forgot', { email: `many${i}@example.com` }, { 'fly-client-ip': '203.0.113.9' })).status).toBe(200);
    await settle();
    expect(outbox).toHaveLength(FORGOT_LIMITS.perIp);
  });

  it('stores the emailed token hashed, good for 30 minutes', async () => {
    const me = await signUp(app, 'known@example.com', PW);
    outbox = [];
    const before = Date.now();
    await post('/api/auth/forgot', { email: 'known@example.com' });
    await settle();
    const token = tokenIn(outbox[0]!);
    const rows = db.select().from(authTokens).where(eq(authTokens.userId, me.id)).all().filter((r) => r.kind === 'reset');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokenHash).toBe(hashToken(token));
    expect(rows[0]!.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(db.select().from(authTokens).all())).not.toContain(token);
    const ttl = Date.parse(rows[0]!.expiresAt) - before;
    expect(ttl).toBeGreaterThan(29 * 60_000);
    expect(ttl).toBeLessThanOrEqual(30 * 60_000 + 1000);
  });
});

describe('POST /auth/reset', () => {
  const askFor = async (email: string) => {
    outbox = [];
    await post('/api/auth/forgot', { email });
    await settle();
    return tokenIn(outbox[0]!);
  };

  it('sets the password, drops every session, and the token works once', async () => {
    const phone = await signUp(app, 'known@example.com', PW);
    const laptop = await post('/api/auth/login', { email: 'known@example.com', password: PW });
    expect(db.select().from(authSessions).where(eq(authSessions.userId, phone.id)).all()).toHaveLength(2);
    const token = await askFor('known@example.com');

    const r = await post('/api/auth/reset', { token, password: 'a brand new one 9' });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true });
    expect(db.select().from(authSessions).where(eq(authSessions.userId, phone.id)).all()).toHaveLength(0);
    expect((await phone.call('GET', '/api/me')).status).toBe(401);
    expect((await app.request('/api/me', { headers: { cookie: laptop.cookie } })).status).toBe(401);
    expect((await post('/api/auth/login', { email: 'known@example.com', password: PW })).status).toBe(401);
    expect((await post('/api/auth/login', { email: 'known@example.com', password: 'a brand new one 9' })).status).toBe(200);
    // the link came from the inbox, so the address counts as confirmed
    expect(db.select().from(users).where(eq(users.id, phone.id)).get()!.emailVerifiedAt).not.toBeNull();

    const again = await post('/api/auth/reset', { token, password: 'another one 123' });
    expect(again.status).toBe(400);
    expect(again.body).toEqual({ error: 'That reset link has expired or was already used. Ask for a new one.', code: 'reset_invalid' });
    expect((await post('/api/auth/login', { email: 'known@example.com', password: 'a brand new one 9' })).status).toBe(200);
  });

  it('refuses a token after 30 minutes, an unknown token, a verification token, and a weak password', async () => {
    const me = await signUp(app, 'known@example.com', PW);
    const verifyToken = tokenIn(mailsTo('known@example.com', /Confirm/)[0]!);
    const token = await askFor('known@example.com');
    expect((await post('/api/auth/reset', { token, password: 'short' })).status).toBe(422);
    expect((await post('/api/auth/reset', { token: 'x'.repeat(43), password: 'a brand new one 9' })).body.code).toBe('reset_invalid');
    expect((await post('/api/auth/reset', { token: verifyToken, password: 'a brand new one 9' })).body.code).toBe('reset_invalid');
    // 31 minutes later the real one is dead too
    db.update(authTokens).set({ expiresAt: new Date(Date.now() - 60_000).toISOString() }).where(eq(authTokens.userId, me.id)).run();
    expect((await post('/api/auth/reset', { token, password: 'a brand new one 9' })).body.code).toBe('reset_invalid');
    expect((await post('/api/auth/login', { email: 'known@example.com', password: PW })).status).toBe(200);
  });

  it('a newer link cancels the older one', async () => {
    await signUp(app, 'known@example.com', PW);
    const first = await askFor('known@example.com');
    const second = await askFor('known@example.com');
    expect((await post('/api/auth/reset', { token: first, password: 'a brand new one 9' })).status).toBe(400);
    expect((await post('/api/auth/reset', { token: second, password: 'a brand new one 9' })).status).toBe(200);
  });
});

describe('POST /me/password', () => {
  it('needs the current password (403 wrong_password), then signs out every other device and keeps this one', async () => {
    const phone = await signUp(app, 'known@example.com', PW);
    const laptop = await post('/api/auth/login', { email: 'known@example.com', password: PW });
    outbox = [];
    const wrong = await phone.call('POST', '/api/me/password', { current: 'not it', next: 'a brand new one 9' });
    expect(wrong.status).toBe(403);
    expect(wrong.body).toEqual({ error: 'That is not your current password.', code: 'wrong_password' });
    expect((await phone.call('POST', '/api/me/password', { current: PW, next: 'short' })).status).toBe(422);
    expect((await phone.call('POST', '/api/me/password', { next: 'a brand new one 9' })).status).toBe(422);

    const ok = await phone.call('POST', '/api/me/password', { current: PW, next: 'a brand new one 9' });
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ ok: true, signedOut: 1 });
    expect((await phone.call('GET', '/api/me')).status).toBe(200);
    expect((await app.request('/api/me', { headers: { cookie: laptop.cookie } })).status).toBe(401);
    expect((await post('/api/auth/login', { email: 'known@example.com', password: PW })).status).toBe(401);
    expect((await post('/api/auth/login', { email: 'known@example.com', password: 'a brand new one 9' })).status).toBe(200);
    await settle();
    expect(mailsTo('known@example.com', /password was changed/)).toHaveLength(1);
    expect((await app.request('/api/me/password', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status).toBe(401);
  });

  it('slows down guesses at the current password, per account', async () => {
    const me = await signUp(app, 'known@example.com', PW);
    for (let i = 0; i < 6; i++) expect((await me.call('POST', '/api/me/password', { current: `guess ${i}`, next: 'a brand new one 9' })).status).toBe(403);
    const locked = await me.call('POST', '/api/me/password', { current: PW, next: 'a brand new one 9' });
    expect(locked.status).toBe(429);
    expect(locked.body.code).toBe('rate_limited');
    // sign-in for the account is not locked by it
    expect((await post('/api/auth/login', { email: 'known@example.com', password: PW })).status).toBe(200);
  });
});

describe('email verification', () => {
  it('sign-up sends a verification mail whose link confirms the address once, with a small page', async () => {
    const me = await signUp(app, 'new@example.com', PW);
    await settle();
    const mail = mailsTo('new@example.com', /Confirm your email/);
    expect(mail).toHaveLength(1);
    const link = linkIn(mail[0]!);
    expect(link).toMatch(new RegExp(`^${env.APP_URL}/api/auth/verify\\?token=[A-Za-z0-9_-]{40,}$`));
    expect((await me.call('GET', '/api/me')).body.emailVerifiedAt).toBeNull();

    const res = await app.request(link.replace(env.APP_URL, ''));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    const html = await res.text();
    expect(html).toContain('Email confirmed');
    expect(html).not.toMatch(/<script/i);
    expect(typeof (await me.call('GET', '/api/me')).body.emailVerifiedAt).toBe('string');

    const again = await app.request(link.replace(env.APP_URL, ''));
    expect(again.status).toBe(410);
    expect(await again.text()).toContain('That link no longer works');
    expect((await app.request('/api/auth/verify')).status).toBe(410);
  });

  it('can be sent again, three times an hour, until the address is confirmed', async () => {
    const me = await signUp(app, 'new@example.com', PW);
    await settle();
    for (let i = 0; i < 3; i++) expect((await me.call('POST', '/api/me/verify-email')).body).toEqual({ ok: true, verified: false });
    expect((await me.call('POST', '/api/me/verify-email')).status).toBe(429);
    await settle();
    const mails = mailsTo('new@example.com', /Confirm your email/);
    expect(mails).toHaveLength(4);
    // only the newest link works
    expect((await app.request(linkIn(mails[0]!).replace(env.APP_URL, ''))).status).toBe(410);
    expect((await app.request(linkIn(mails[3]!).replace(env.APP_URL, ''))).status).toBe(200);
    expect((await me.call('POST', '/api/me/verify-email')).body).toEqual({ ok: true, verified: true });
  });
});

describe('who is knocking', () => {
  it('reads the address from Fly-Client-IP, else the last X-Forwarded-For hop, never the first', () => {
    const ip = (headers: Record<string, string>) => clientIp({ req: { header: (k: string) => headers[k.toLowerCase()] }, env: {} } as never);
    expect(ip({ 'fly-client-ip': '203.0.113.7', 'x-forwarded-for': '1.2.3.4, 203.0.113.7' })).toBe('203.0.113.7');
    expect(ip({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8, 203.0.113.7' })).toBe('203.0.113.7');
    expect(ip({ 'x-forwarded-for': '203.0.113.7' })).toBe('203.0.113.7');
    expect(ip({})).toBe('local');
  });

  it('a forged X-Forwarded-For does not reset the sign-in throttle, which keys on Fly-Client-IP', async () => {
    await signUp(app, 'known@example.com', PW);
    const statuses: number[] = [];
    // a different account each time, so only the per-address limit is in play
    for (let i = 0; i < 8; i++) statuses.push((await post('/api/auth/login', { email: `nobody${i}@example.com`, password: 'wrong wrong' }, { 'fly-client-ip': '203.0.113.7', 'x-forwarded-for': `10.0.0.${i}, 203.0.113.7` })).status);
    expect(statuses).toEqual([401, 401, 401, 401, 401, 401, 429, 429]);
    // and a forged header cannot lock out someone else's address
    expect((await post('/api/auth/login', { email: 'known@example.com', password: PW }, { 'fly-client-ip': '198.51.100.20', 'x-forwarded-for': '203.0.113.7, 198.51.100.20' })).status).toBe(200);
  });

  it('per-email delays grow, hold from any address, survive in the database, and clear on a good sign-in', async () => {
    await signUp(app, 'known@example.com', PW);
    vi.useFakeTimers({ toFake: ['Date'] });
    let now = Date.parse('2026-11-10T12:00:00Z');
    vi.setSystemTime(now);
    const attempt = (n: number, password = 'wrong wrong') => post('/api/auth/login', { email: 'known@example.com', password }, { 'fly-client-ip': `198.51.100.${n}` });
    for (let i = 0; i < EMAIL_FREE_FAILS; i++) expect((await attempt(i)).status).toBe(401);
    const delays: number[] = [];
    for (let i = 0; i < EMAIL_DELAYS_SEC.length + 1; i++) {
      // this failure starts a delay...
      expect((await attempt(50 + i)).status).toBe(401);
      // ...during which even the right password, from a fresh address, is refused
      const locked = await attempt(100 + i, PW);
      expect(locked.status).toBe(429);
      expect(locked.body.code).toBe('rate_limited');
      const wait = Number(locked.headers.get('retry-after'));
      delays.push(wait);
      now += wait * 1000 + 1000;
      vi.setSystemTime(now);
    }
    expect(delays).toEqual([...EMAIL_DELAYS_SEC, EMAIL_DELAYS_SEC.at(-1)!]);
    for (let i = 1; i < EMAIL_DELAYS_SEC.length; i++) expect(delays[i]!).toBeGreaterThan(delays[i - 1]!);
    // the count lives in SQLite under a hash, not the address
    const rows = db.select().from(authThrottle).all();
    expect(rows.some((r) => r.key.startsWith('login:') && r.count === EMAIL_FREE_FAILS + EMAIL_DELAYS_SEC.length + 1)).toBe(true);
    expect(JSON.stringify(rows)).not.toContain('known@example.com');
    // the delay over, the right password signs in and wipes the count
    expect((await attempt(200, PW)).status).toBe(200);
    expect(db.select().from(authThrottle).all().filter((r) => r.key.startsWith('login:'))).toEqual([]);
  });

  it('/auth/signup is limited per address', async () => {
    env.signupPerHour = 5;
    const from = (ip: string, i: number) => post('/api/auth/signup', { email: `s${ip}-${i}@example.com`, password: PW }, { 'fly-client-ip': ip });
    for (let i = 0; i < 5; i++) expect((await from('203.0.113.7', i)).status).toBe(201);
    const sixth = await from('203.0.113.7', 6);
    expect(sixth.status).toBe(429);
    expect(sixth.body).toEqual({ error: 'Too many new accounts from here. Try again in an hour.', code: 'rate_limited' });
    expect(Number(sixth.headers.get('retry-after'))).toBeGreaterThan(3000);
    // asking whether an address is taken is limited the same way
    expect((await post('/api/auth/signup', { email: 's203.0.113.7-0@example.com', password: PW }, { 'fly-client-ip': '203.0.113.7' })).status).toBe(429);
    expect((await from('198.51.100.20', 0)).status).toBe(201);
  });

  it('an unknown email costs the same time as a wrong password', async () => {
    await signUp(app, 'known@example.com', PW);
    const time = async (email: string, ip: string) => {
      const t0 = performance.now();
      const r = await post('/api/auth/login', { email, password: 'wrong wrong' }, { 'fly-client-ip': ip });
      expect(r.status).toBe(401);
      expect(r.body).toEqual({ error: 'That email and password don’t match.', code: 'bad_credentials' });
      return performance.now() - t0;
    };
    // warm the dummy hash once, then compare the best of three each (the password hash dominates both)
    await time('warm@example.com', '198.51.100.1');
    const best = async (email: (i: number) => string, net: number) => Math.min(...(await Promise.all([0, 1, 2].map(async (i) => i)).then(async (is) => {
      const out: number[] = [];
      for (const i of is) out.push(await time(email(i), `198.51.${net}.${i + 2}`));
      return out;
    })));
    const known = await best(() => 'known@example.com', 100);
    const unknown = await best((i) => `ghost${i}@example.com`, 101);
    expect(unknown).toBeGreaterThan(known * 0.5);
    expect(unknown).toBeLessThan(known * 2 + 20);
    // both do real password work: far more than a lookup
    expect(unknown).toBeGreaterThan(15);
  });
});
