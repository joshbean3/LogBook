import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { describeUserAgent, needsVerifiedEmail, passwordProblem, UNVERIFIED_GRACE_DAYS } from '../auth.js';
import { openDatabase, type DB } from '../db/index.js';
import { env } from '../env.js';
import { buildApp } from '../index.js';
import { originAllowed } from '../lib/csrf.js';
import { resetRateLimits } from '../lib/ratelimit.js';
import { lastMail, resetSentMails, sendMail, sentMails, tokenOf } from '../services/mail.js';
import { FORGOT_IP_LIMIT, RESEND_LIMIT } from './auth.js';

type App = ReturnType<typeof buildApp>;
let app: App;
let db: DB;
let sqlite: ReturnType<typeof openDatabase>['sqlite'];

const PW = 'a-long-enough-password';
const call = async (method: string, url: string, body?: unknown, cookie?: string, headers: Record<string, string> = {}) => {
  const res = await app.request(url, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, setCookie: res.headers.get('set-cookie'), headers: res.headers };
};
const cookieOf = (setCookie: string | null) => (setCookie ?? '').split(';')[0]!;
const signUp = async (email: string, password = PW, ua?: string) => {
  const r = await call('POST', '/api/auth/signup', { email, password }, undefined, ua ? { 'user-agent': ua } : {});
  return { ...r, cookie: cookieOf(r.setCookie) };
};
const login = async (email: string, password = PW, ua?: string) => {
  const r = await call('POST', '/api/auth/login', { email, password }, undefined, ua ? { 'user-agent': ua } : {});
  return { ...r, cookie: cookieOf(r.setCookie) };
};
const setCreatedAt = (email: string, daysAgo: number) => sqlite.prepare('update users set created_at = ? where email = ?').run(new Date(Date.now() - daysAgo * 864e5).toISOString(), email);

beforeEach(() => {
  const o = openDatabase(':memory:');
  db = o.db;
  sqlite = o.sqlite;
  app = buildApp(db);
  env.allowSignup = true;
  env.allowSetup = true;
  env.isProd = false;
  resetRateLimits(db);
  resetSentMails();
});
afterEach(() => {
  env.isProd = false;
  env.mailConfigured = false;
  vi.restoreAllMocks();
});

describe('the mailer', () => {
  it('without a key, records the mail instead of sending it', async () => {
    const r = await sendMail({ to: 'a@example.com', subject: 'Hi', text: 'Hello' });
    expect(r).toEqual({ ok: true });
    expect(sentMails).toHaveLength(1);
    expect(lastMail()).toMatchObject({ to: 'a@example.com', subject: 'Hi', via: 'console' });
  });

  it('with a key, posts to Resend; a refusal or a network failure answers ok:false and never throws', async () => {
    env.mailConfigured = true;
    const good = vi.fn(async () => new Response(JSON.stringify({ id: 'em_1' }), { status: 200 }));
    expect(await sendMail({ to: 'a@example.com', subject: 'Hi', text: 'Hello' }, good as unknown as typeof fetch)).toEqual({ ok: true, id: 'em_1' });
    const sent = JSON.parse((good.mock.calls[0] as unknown as [string, { body: string }])[1].body) as { to: string[]; from: string; subject: string };
    expect(sent).toMatchObject({ to: ['a@example.com'], subject: 'Hi' });
    expect(sent.from).toBe(env.MAIL_FROM);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const refused = vi.fn(async () => new Response('nope', { status: 422 }));
    expect(await sendMail({ to: 'a@example.com', subject: 'Hi', text: 'Hello' }, refused as unknown as typeof fetch)).toEqual({ ok: false });
    const down = vi.fn(async () => {
      throw new Error('ECONNRESET');
    });
    expect(await sendMail({ to: 'a@example.com', subject: 'Hi', text: 'Hello' }, down as unknown as typeof fetch)).toEqual({ ok: false });
    expect(sentMails.map((m) => m.via)).toEqual(['resend', 'failed', 'failed']);
  });
});

describe('email verification', () => {
  it('sign-up sends the verify mail with a 24 h link; opening it marks the account verified, once', async () => {
    const { status, body, cookie } = await signUp('new@example.com');
    expect(status).toBe(201);
    expect(body).toMatchObject({ email: 'new@example.com', emailVerifiedAt: null, verificationSent: true });
    const mail = lastMail();
    expect(mail).toMatchObject({ to: 'new@example.com', subject: 'Verify your email for Logbook' });
    expect(mail!.text).toContain(`${env.APP_URL}/verify?token=`);
    expect(mail!.text).toContain('24 hours');
    const token = tokenOf(mail)!;
    expect(token.length).toBeGreaterThan(30);
    // only a hash is kept
    expect((sqlite.prepare('select token_hash from email_tokens').get() as { token_hash: string }).token_hash).not.toContain(token);
    expect((await call('GET', '/api/me', undefined, cookie)).body.emailVerifiedAt).toBeNull();
    expect((await call('GET', '/api/bootstrap', undefined, cookie)).body.user.emailVerifiedAt).toBeNull();

    // the link works without the session (it may open in another browser)
    const ok = await call('POST', '/api/auth/verify', { token });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ ok: true, email: 'new@example.com' });
    expect((await call('GET', '/api/auth/me', undefined, cookie)).body.emailVerifiedAt).toMatch(/^\d{4}-/);
    // once
    const again = await call('POST', '/api/auth/verify', { token });
    expect(again.status).toBe(400);
    expect(again.body.code).toBe('token_used');
    expect((await call('POST', '/api/auth/verify', { token: 'nonsense' })).body.code).toBe('token_invalid');
  });

  it('an expired link says so', async () => {
    await signUp('new@example.com');
    const token = tokenOf(lastMail())!;
    sqlite.prepare("update email_tokens set expires_at = '2000-01-01T00:00:00.000Z'").run();
    const r = await call('POST', '/api/auth/verify', { token });
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ code: 'token_expired', error: expect.stringMatching(/expired/) });
  });

  it('resend mails a fresh link, three an hour, and says so once verified', async () => {
    const { cookie } = await signUp('new@example.com');
    for (let i = 0; i < RESEND_LIMIT.limit; i++) {
      const r = await call('POST', '/api/auth/verify/resend', {}, cookie);
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ ok: true, sent: true });
    }
    expect(sentMails).toHaveLength(1 + RESEND_LIMIT.limit);
    const over = await call('POST', '/api/auth/verify/resend', {}, cookie);
    expect(over.status).toBe(429);
    expect(over.body.error).toMatch(/Three verification mails/);
    // the older links still work until they expire
    await call('POST', '/api/auth/verify', { token: tokenOf(sentMails[1]!) });
    resetRateLimits(db);
    expect((await call('POST', '/api/auth/verify/resend', {}, cookie)).body).toMatchObject({ sent: false, emailVerifiedAt: expect.any(String) });
  });

  it(`after ${UNVERIFIED_GRACE_DAYS} days unverified, the assistant and the connections answer 403 email_unverified; the rest of the app stays open`, async () => {
    const { cookie } = await signUp('new@example.com');
    setCreatedAt('new@example.com', UNVERIFIED_GRACE_DAYS + 1);
    const ask = await call('POST', '/api/assistant', { text: 'hi' }, cookie);
    expect(ask.status).toBe(403);
    expect(ask.body).toMatchObject({ code: 'email_unverified', error: expect.stringMatching(/Verify your email/) });
    expect((await call('POST', '/api/connections/strava/sync', {}, cookie)).body.code).toBe('email_unverified');
    expect((await call('GET', '/api/connections/strava/connect-url', undefined, cookie)).body.code).toBe('email_unverified');
    // reading the list is fine (Settings draws it), as is everything else
    expect((await call('GET', '/api/connections', undefined, cookie)).status).toBe(200);
    expect((await call('GET', '/api/bootstrap', undefined, cookie)).status).toBe(200);
    expect((await call('GET', '/api/todos', undefined, cookie)).status).toBe(200);
    // verifying lifts it
    await call('POST', '/api/auth/verify', { token: tokenOf(lastMail()) });
    expect((await call('POST', '/api/assistant', { text: 'hi' }, cookie)).body.code).not.toBe('email_unverified');
    // and a young account is never gated
    const young = await signUp('young@example.com');
    expect((await call('POST', '/api/assistant', { text: 'hi' }, young.cookie)).body.code).not.toBe('email_unverified');
  });

  it('needsVerifiedEmail names the gated routes', () => {
    expect(needsVerifiedEmail('POST', '/api/assistant')).toBe(true);
    expect(needsVerifiedEmail('GET', '/api/assistant/thread')).toBe(true);
    expect(needsVerifiedEmail('GET', '/api/connections')).toBe(false);
    expect(needsVerifiedEmail('GET', '/strava')).toBe(false);
    expect(needsVerifiedEmail('GET', '/api/connections/strava/connect')).toBe(true);
    expect(needsVerifiedEmail('POST', '/strava/sync')).toBe(true);
    expect(needsVerifiedEmail('POST', '/api/todos')).toBe(false);
  });

  it('PATCH /me { email, password } changes the address and starts verification again', async () => {
    const { cookie } = await signUp('old@example.com');
    await call('POST', '/api/auth/verify', { token: tokenOf(lastMail()) });
    await signUp('taken@example.com');
    expect((await call('PATCH', '/api/me', { email: 'new@example.com', password: 'wrong-password-here' }, cookie)).status).toBe(403);
    expect((await call('PATCH', '/api/me', { email: 'new@example.com' }, cookie)).status).toBe(403);
    expect((await call('PATCH', '/api/me', { email: 'taken@example.com', password: PW }, cookie)).status).toBe(409);
    const r = await call('PATCH', '/api/me', { email: 'New@Example.com', password: PW }, cookie);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ email: 'new@example.com', emailVerifiedAt: null, verificationSent: true });
    expect(lastMail()).toMatchObject({ to: 'new@example.com', subject: 'Verify your email for Logbook' });
    await call('POST', '/api/auth/verify', { token: tokenOf(lastMail()) });
    expect((await call('GET', '/api/me', undefined, cookie)).body.emailVerifiedAt).toMatch(/^\d{4}-/);
    // name and note still work on their own
    expect((await call('PATCH', '/api/me', { name: 'Josh' }, cookie)).body.name).toBe('Josh');
  });
});

describe('password policy', () => {
  it('ten characters, nothing common, not the email', () => {
    expect(passwordProblem('short')).toMatch(/at least 10/);
    expect(passwordProblem('1234567890')).toMatch(/too common/);
    expect(passwordProblem('QWERTYUIOP')).toMatch(/too common/);
    expect(passwordProblem('josh.bean@example.com', 'josh.bean@example.com')).toMatch(/email/);
    expect(passwordProblem('xxjosh.beanxx', 'josh.bean@example.com')).toMatch(/email/);
    expect(passwordProblem('correct horse battery', 'josh.bean@example.com')).toBeNull();
  });

  it('sign-up refuses a weak password with a plain message', async () => {
    const short = await signUp('a@example.com', 'short123');
    expect(short.status).toBe(422);
    const common = await signUp('a@example.com', 'qwertyuiop');
    expect(common.status).toBe(422);
    expect(common.body).toMatchObject({ code: 'weak_password', error: expect.stringMatching(/too common/) });
    expect((await signUp('a@example.com', 'a@example.com')).body.error).toMatch(/email/);
    expect((await signUp('a@example.com')).status).toBe(201);
  });
});

describe('password reset', () => {
  it('forgot answers 200 whoever asks, mails a link only to an account, and the link sets the password once', async () => {
    const { cookie } = await signUp('me@example.com');
    const nobody = await call('POST', '/api/auth/forgot', { email: 'nobody@example.com' });
    expect(nobody.status).toBe(200);
    expect(nobody.body).toEqual({ ok: true });
    expect(sentMails).toHaveLength(1); // the sign-up mail only
    const r = await call('POST', '/api/auth/forgot', { email: 'ME@example.com ' });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true });
    const mail = lastMail();
    expect(mail).toMatchObject({ to: 'me@example.com', subject: 'Reset your Logbook password' });
    expect(mail!.text).toContain(`${env.APP_URL}/reset?token=`);
    expect(mail!.text).toContain('one hour');
    const token = tokenOf(mail)!;

    // a weak choice does not burn the link
    const weak = await call('POST', '/api/auth/reset', { token, password: 'short' });
    expect(weak.status).toBe(422);
    expect(weak.body.code).toBe('weak_password');
    const other = await login('me@example.com');
    const done = await call('POST', '/api/auth/reset', { token, password: 'brand-new-password-1' });
    expect(done.status).toBe(200);
    expect(done.body).toMatchObject({ email: 'me@example.com' });
    const fresh = cookieOf(done.setCookie);
    expect(fresh).toMatch(/^logbook_session=/);
    // the old sessions are over, the new one lives, the old password is gone
    expect((await call('GET', '/api/me', undefined, cookie)).status).toBe(401);
    expect((await call('GET', '/api/me', undefined, other.cookie)).status).toBe(401);
    expect((await call('GET', '/api/me', undefined, fresh)).status).toBe(200);
    expect((await login('me@example.com', PW)).status).toBe(401);
    expect((await login('me@example.com', 'brand-new-password-1')).status).toBe(200);
    expect((await call('GET', '/api/me', undefined, fresh)).body.passwordChangedAt).toMatch(/^\d{4}-/);
    // single use
    const again = await call('POST', '/api/auth/reset', { token, password: 'brand-new-password-2' });
    expect(again.status).toBe(400);
    expect(again.body.code).toBe('token_used');
  });

  it('an expired or unknown reset link says so without touching the password', async () => {
    await signUp('me@example.com');
    await call('POST', '/api/auth/forgot', { email: 'me@example.com' });
    const token = tokenOf(lastMail())!;
    sqlite.prepare("update email_tokens set expires_at = '2000-01-01T00:00:00.000Z' where kind = 'reset'").run();
    const r = await call('POST', '/api/auth/reset', { token, password: 'brand-new-password-1' });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('token_expired');
    expect((await call('POST', '/api/auth/reset', { token: 'nonsense', password: 'brand-new-password-1' })).body.code).toBe('token_invalid');
    // a verify token is not a reset token
    const verify = tokenOf(sentMails[0]!)!;
    expect((await call('POST', '/api/auth/reset', { token: verify, password: 'brand-new-password-1' })).body.code).toBe('token_invalid');
    expect((await login('me@example.com', PW)).status).toBe(200);
  });

  it('forgot is limited to 5 an hour per address of origin and 3 per email', async () => {
    await signUp('me@example.com');
    for (let i = 0; i < 3; i++) expect((await call('POST', '/api/auth/forgot', { email: 'me@example.com' })).status).toBe(200);
    const email = await call('POST', '/api/auth/forgot', { email: 'me@example.com' });
    expect(email.status).toBe(429);
    expect(email.headers.get('retry-after')).toMatch(/^\d+$/);
    expect(sentMails).toHaveLength(4);
    // the IP has one left (4 asked so far), then it is done whatever the address
    expect((await call('POST', '/api/auth/forgot', { email: 'other@example.com' })).status).toBe(200);
    expect((await call('POST', '/api/auth/forgot', { email: 'third@example.com' })).status).toBe(429);
    // another address of origin is its own count
    expect((await call('POST', '/api/auth/forgot', { email: 'third@example.com' }, undefined, { 'x-forwarded-for': '203.0.113.9' })).status).toBe(200);
    expect(FORGOT_IP_LIMIT.limit).toBe(5);
  });

  it('Settings › Change password needs the current one, keeps this session and ends the others', async () => {
    const { cookie } = await signUp('me@example.com');
    const phone = await login('me@example.com');
    expect((await call('POST', '/api/auth/password', { current: 'not-it-at-all', password: 'brand-new-password-1' }, cookie)).status).toBe(403);
    expect((await call('POST', '/api/auth/password', { current: PW, password: 'short' }, cookie)).status).toBe(422);
    const r = await call('POST', '/api/auth/password', { current: PW, password: 'brand-new-password-1' }, cookie);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, revoked: 1 });
    expect((await call('GET', '/api/me', undefined, cookie)).status).toBe(200);
    expect((await call('GET', '/api/me', undefined, phone.cookie)).status).toBe(401);
    expect((await login('me@example.com', 'brand-new-password-1')).status).toBe(200);
  });
});

describe('sessions', () => {
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  const MAC_CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  it('summarises user agents', () => {
    expect(describeUserAgent(IPHONE)).toBe('Safari on iPhone');
    expect(describeUserAgent(MAC_CHROME)).toBe('Chrome on Mac');
    expect(describeUserAgent('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36')).toBe('Chrome on Android');
    expect(describeUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0')).toBe('Firefox on Windows');
    expect(describeUserAgent('curl/8.4.0')).toBe('curl');
    expect(describeUserAgent(null)).toBe('Unknown device');
  });

  it('lists every device with this one marked, ends one, ends the others, and ending this one signs it out', async () => {
    const { cookie } = await signUp('me@example.com', PW, IPHONE);
    const mac = await login('me@example.com', PW, MAC_CHROME);
    const third = await login('me@example.com', PW);
    const list = (await call('GET', '/api/auth/sessions', undefined, cookie)).body as Array<{ id: string; current: boolean; device: string; createdAt: string; lastSeenAt: string }>;
    expect(list).toHaveLength(3);
    expect(list.map((s) => [s.device, s.current])).toEqual([
      ['Safari on iPhone', true],
      ['Chrome on Mac', false],
      ['Unknown device', false],
    ]);
    expect(list[0]!.lastSeenAt).toMatch(/^\d{4}-/);
    // the Mac sees itself as current
    expect((await call('GET', '/api/auth/sessions', undefined, mac.cookie)).body.find((s: { current: boolean }) => s.current).device).toBe('Chrome on Mac');

    const macId = list[1]!.id;
    expect((await call('DELETE', `/api/auth/sessions/${macId}`, undefined, cookie)).body).toEqual({ ok: true, current: false });
    expect((await call('GET', '/api/me', undefined, mac.cookie)).status).toBe(401);
    expect((await call('DELETE', `/api/auth/sessions/${macId}`, undefined, cookie)).status).toBe(404);
    // another account cannot end my sessions
    const stranger = await signUp('stranger@example.com');
    expect((await call('DELETE', `/api/auth/sessions/${list[2]!.id}`, undefined, stranger.cookie)).status).toBe(404);

    expect((await call('POST', '/api/auth/sessions/revoke-others', {}, cookie)).body).toEqual({ ok: true, revoked: 1 });
    expect((await call('GET', '/api/me', undefined, third.cookie)).status).toBe(401);
    expect((await call('GET', '/api/auth/sessions', undefined, cookie)).body).toHaveLength(1);

    const self = await call('DELETE', `/api/auth/sessions/${list[0]!.id}`, undefined, cookie);
    expect(self.body).toEqual({ ok: true, current: true });
    expect(self.setCookie).toMatch(/logbook_session=;/);
    expect((await call('GET', '/api/me', undefined, cookie)).status).toBe(401);
  });

  it('last_seen_at moves at most once an hour', async () => {
    const { cookie } = await signUp('me@example.com');
    const read = () => (sqlite.prepare('select last_seen_at from auth_sessions').get() as { last_seen_at: string }).last_seen_at;
    const first = read();
    await call('GET', '/api/me', undefined, cookie);
    expect(read()).toBe(first);
    sqlite.prepare('update auth_sessions set last_seen_at = ?').run(new Date(Date.now() - 2 * 3600_000).toISOString());
    await call('GET', '/api/me', undefined, cookie);
    expect(read() > first).toBe(true);
  });
});

describe('origin check', () => {
  it('knows our origins', () => {
    expect(originAllowed(env.APP_URL)).toBe(true);
    expect(originAllowed('capacitor://localhost')).toBe(true);
    expect(originAllowed('http://localhost:5173')).toBe(true);
    expect(originAllowed('https://evil.example')).toBe(false);
    expect(originAllowed('null')).toBe(false);
    env.isProd = true;
    expect(originAllowed('http://localhost:5173')).toBe(false);
    expect(originAllowed('http://localhost')).toBe(true);
    expect(originAllowed(env.APP_URL)).toBe(true);
  });

  it('refuses a write from another origin, takes ours, the app header, and reads from anywhere', async () => {
    const { cookie } = await signUp('me@example.com');
    const evil = { origin: 'https://evil.example' };
    const r = await call('PATCH', '/api/me', { name: 'Josh' }, cookie, evil);
    expect(r.status).toBe(403);
    expect(r.body).toMatchObject({ code: 'bad_origin', error: expect.stringMatching(/didn’t come from Logbook/) });
    expect((await call('POST', '/api/auth/logout', {}, cookie, evil)).status).toBe(403);
    expect((await call('POST', '/api/auth/login', { email: 'me@example.com', password: PW }, undefined, { referer: 'https://evil.example/page' })).status).toBe(403);
    // still signed in: a forged request touched nothing
    expect((await call('GET', '/api/me', undefined, cookie, evil)).status).toBe(200);
    expect((await call('PATCH', '/api/me', { name: 'Josh' }, cookie, { origin: env.APP_URL })).status).toBe(200);
    expect((await call('PATCH', '/api/me', { name: 'Josh' }, cookie, { referer: `${env.APP_URL}/today` })).status).toBe(200);
    expect((await call('PATCH', '/api/me', { name: 'Josh' }, cookie, { origin: 'capacitor://localhost' })).status).toBe(200);
    expect((await call('PATCH', '/api/me', { name: 'Josh' }, cookie, { origin: 'https://evil.example', 'x-requested-with': 'logbook' })).status).toBe(200);
  });

  it('in production a write with no origin at all needs the app header; outside it passes (curl, the tests)', async () => {
    const { cookie } = await signUp('me@example.com');
    expect((await call('PATCH', '/api/me', { name: 'Josh' }, cookie)).status).toBe(200);
    env.isProd = true;
    const bare = await call('PATCH', '/api/me', { name: 'Josh' }, cookie);
    expect(bare.status).toBe(403);
    expect(bare.body.code).toBe('bad_origin');
    expect((await call('PATCH', '/api/me', { name: 'Josh' }, cookie, { 'x-requested-with': 'logbook' })).status).toBe(200);
  });

  it('provider webhooks and OAuth callbacks are not behind it', async () => {
    env.isProd = true;
    // the Strava webhook POST from Strava's servers: no origin, no header; it is refused for its content, never for its origin
    const hook = await call('POST', '/api/connections/strava/webhook', { aspect_type: 'create', object_type: 'activity' });
    expect(hook.body?.code).not.toBe('bad_origin');
    expect(hook.status).not.toBe(403);
    const alias = await call('POST', '/api/strava/webhook', { aspect_type: 'create', object_type: 'activity' });
    expect(alias.body?.code).not.toBe('bad_origin');
    const cb = await call('GET', '/api/connections/strava/callback?state=bad&code=x');
    expect(cb.body?.code).not.toBe('bad_origin');
  });
});

describe('dev route', () => {
  it('GET /auth/dev/last-mail shows the last mail and its token outside production', async () => {
    await signUp('me@example.com');
    const r = await call('GET', '/api/auth/dev/last-mail');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ to: 'me@example.com', token: expect.any(String), count: 1 });
  });
});
