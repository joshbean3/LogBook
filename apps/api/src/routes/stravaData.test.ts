import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DB } from '../db/index.js';
import { activities, authSessions, coachReads, healthDevices, hrZones, stravaAccounts, users } from '../db/schema.js';
import { DEV_SESSION_SECRET, env, OLD_DEFAULT_WEBHOOK_TOKEN, productionProblems } from '../env.js';
import { DEAUTHORIZE_RETRY_MS } from '../services/strava.js';
import { makeApp, signUp, type Account, type App } from '../test/helpers.js';

/** Strava data leaves when the person leaves: on disconnect, on a revoke at Strava, and with the account. */
let app: App;
let db: DB;
let me: Account;
let other: Account;
const PW = 'correct horse 42';
const realFetch = globalThis.fetch;
let stravaCalls: Array<{ url: string; auth: string | null }>;
let stravaUp = true;

const seedStrava = (userId: string, athleteId: string) => {
  const now = new Date().toISOString();
  db.insert(stravaAccounts).values({ userId, athleteId, athleteName: 'An Athlete', accessToken: `acc-${athleteId}`, refreshToken: `ref-${athleteId}`, expiresAt: Math.floor(Date.now() / 1000) + 3600, scope: 'read', connectedAt: now, lastSyncAt: null, lastError: null }).run();
  db.insert(hrZones).values({ userId, zonesJson: '[{"zone":1,"min":0,"max":120}]', fetchedAt: now }).run();
  for (let i = 0; i < 3; i++) db.insert(activities).values({ id: `${athleteId}00${i}`, userId, date: '2026-11-0' + (i + 1), time: '07:00', name: `Run ${i}`, sportType: 'Run', kind: 'run', distanceM: 5000, movingSec: 1500, elapsedSec: 1500, elevM: 10, avgHr: 150, maxHr: 170, cadence: 170, polyline: 'abc', lapsJson: '[[1609,480,150]]', deletedAt: null, updatedAt: now, perfAt: null, perfFailed: 0 }).run();
  db.insert(coachReads).values({ userId, date: '2026-11-01', key: `${athleteId}000`, text: 'A note written from the run.', createdAt: now }).run();
};
const stravaRows = (userId: string) => ({
  accounts: db.select().from(stravaAccounts).where(eq(stravaAccounts.userId, userId)).all().length,
  zones: db.select().from(hrZones).where(eq(hrZones.userId, userId)).all().length,
  activities: db.select().from(activities).where(eq(activities.userId, userId)).all().length,
  notes: db.select().from(coachReads).where(eq(coachReads.userId, userId)).all().length,
});
const GONE = { accounts: 0, zones: 0, activities: 0, notes: 0 };
const ALL = { accounts: 1, zones: 1, activities: 3, notes: 1 };

beforeEach(async () => {
  ({ app, db } = makeApp());
  me = await signUp(app, 'strava@example.com', PW);
  other = await signUp(app, 'strava2@example.com', PW);
  seedStrava(me.id, '111');
  seedStrava(other.id, '222');
  stravaCalls = [];
  stravaUp = true;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (!u.includes('strava.com')) return realFetch(url as never, init);
    stravaCalls.push({ url: u, auth: new Headers(init?.headers).get('authorization') });
    if (!stravaUp) throw new Error('connect ETIMEDOUT');
    return new Response('{}', { status: 200 });
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.useRealTimers();
  delete (env as { STRAVA_WEBHOOK_SUBSCRIPTION_ID?: string }).STRAVA_WEBHOOK_SUBSCRIPTION_ID;
  env.isProd = false;
});

describe('POST /strava/disconnect', () => {
  it('deauthorizes at Strava and deletes activities, laps, zones and tokens for that account only', async () => {
    const r = await me.call('POST', '/api/strava/disconnect');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ connected: false, deauthorized: true, deleted: { activities: 3, zones: 1, notes: 1, accounts: 1 } });
    expect(stravaCalls).toEqual([{ url: 'https://www.strava.com/oauth/deauthorize', auth: 'Bearer acc-111' }]);
    expect(stravaRows(me.id)).toEqual(GONE);
    expect(stravaRows(other.id)).toEqual(ALL);
    // nothing of it is left to show
    expect((await me.call('GET', '/api/bootstrap')).body).toMatchObject({ zones: null, strava: { connected: false } });
    expect((await me.call('GET', '/api/activities?from=2026-11-01&to=2026-11-30')).body).toEqual([]);
  });

  it('is one transaction: when a delete fails, nothing is deleted', async () => {
    const { purgeStravaData } = await import('../services/strava.js');
    // break the last table the purge touches
    db.run('ALTER TABLE strava_accounts RENAME TO strava_accounts_x');
    expect(() => purgeStravaData(db, me.id)).toThrow();
    db.run('ALTER TABLE strava_accounts_x RENAME TO strava_accounts');
    expect(stravaRows(me.id)).toEqual(ALL);
  });

  it('still deletes when Strava is down, and tries the deauthorize once more a minute later', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    stravaUp = false;
    const r = await me.call('POST', '/api/strava/disconnect');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ connected: false, deauthorized: false });
    expect(stravaRows(me.id)).toEqual(GONE);
    expect(stravaCalls).toHaveLength(1);
    stravaUp = true;
    await vi.advanceTimersByTimeAsync(DEAUTHORIZE_RETRY_MS + 10);
    expect(stravaCalls).toHaveLength(2);
    expect(stravaCalls[1]).toEqual({ url: 'https://www.strava.com/oauth/deauthorize', auth: 'Bearer acc-111' });
    // one retry, not a loop
    await vi.advanceTimersByTimeAsync(10 * DEAUTHORIZE_RETRY_MS);
    expect(stravaCalls).toHaveLength(2);
  });
});

describe('the Strava webhook', () => {
  const hook = (body: unknown) => app.request('/api/strava/webhook', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

  it('an athlete event with authorized false deletes the same data, with no call back to Strava', async () => {
    env.STRAVA_WEBHOOK_SUBSCRIPTION_ID = '4242';
    const res = await hook({ object_type: 'athlete', aspect_type: 'update', owner_id: 111, object_id: 111, subscription_id: 4242, updates: { authorized: 'false' } });
    expect(res.status).toBe(200);
    expect(stravaRows(me.id)).toEqual(GONE);
    expect(stravaRows(other.id)).toEqual(ALL);
    expect(stravaCalls).toEqual([]);
    // an athlete event that is not a revoke changes nothing
    await hook({ object_type: 'athlete', aspect_type: 'update', owner_id: 222, subscription_id: 4242, updates: { title: 'x' } });
    expect(stravaRows(other.id)).toEqual(ALL);
  });

  it('checks subscription_id: a wrong or missing one is refused and does nothing', async () => {
    env.STRAVA_WEBHOOK_SUBSCRIPTION_ID = '4242';
    for (const subscription_id of [1, '4243', undefined]) {
      const res = await hook({ object_type: 'athlete', owner_id: 111, subscription_id, updates: { authorized: 'false' } });
      expect(res.status).toBe(403);
    }
    expect(stravaRows(me.id)).toEqual(ALL);
    // in production an event is refused until the subscription id is set at all
    delete (env as { STRAVA_WEBHOOK_SUBSCRIPTION_ID?: string }).STRAVA_WEBHOOK_SUBSCRIPTION_ID;
    env.isProd = true;
    expect((await hook({ object_type: 'athlete', owner_id: 111, subscription_id: 4242, updates: { authorized: 'false' } })).status).toBe(403);
    expect(stravaRows(me.id)).toEqual(ALL);
  });

  it('has no default verify token: without one set, nobody can verify a subscription', async () => {
    const was = env.STRAVA_WEBHOOK_VERIFY_TOKEN;
    try {
      env.STRAVA_WEBHOOK_VERIFY_TOKEN = undefined;
      for (const token of ['logbook-verify', '', 'undefined']) expect((await app.request(`/api/strava/webhook?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=abc`)).status).toBe(403);
      env.STRAVA_WEBHOOK_VERIFY_TOKEN = 'a-long-random-string-0123456789';
      const ok = await app.request('/api/strava/webhook?hub.mode=subscribe&hub.verify_token=a-long-random-string-0123456789&hub.challenge=abc');
      expect(await ok.json()).toEqual({ 'hub.challenge': 'abc' });
    } finally {
      env.STRAVA_WEBHOOK_VERIFY_TOKEN = was;
    }
  });
});

describe('DELETE /me', () => {
  it('deauthorizes Strava first, then removes the account, its Apple Health device tokens and every session', async () => {
    const connect = await me.call('POST', '/api/apple-health/connect', { deviceName: 'iPhone' });
    const laptop = await app.request('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'strava@example.com', password: PW }) });
    const laptopCookie = (laptop.headers.get('set-cookie') ?? '').split(';')[0]!;
    expect(db.select().from(authSessions).where(eq(authSessions.userId, me.id)).all()).toHaveLength(2);

    const r = await me.call('DELETE', '/api/me', { password: PW });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, strava: { deauthorized: true } });
    expect(stravaCalls).toEqual([{ url: 'https://www.strava.com/oauth/deauthorize', auth: 'Bearer acc-111' }]);
    expect(stravaRows(me.id)).toEqual(GONE);
    expect(db.select().from(users).where(eq(users.id, me.id)).all()).toEqual([]);
    expect(db.select().from(authSessions).where(eq(authSessions.userId, me.id)).all()).toEqual([]);
    expect(db.select().from(healthDevices).where(eq(healthDevices.userId, me.id)).all()).toEqual([]);
    expect((await app.request('/api/me', { headers: { cookie: laptopCookie } })).status).toBe(401);
    // the phone's Apple Health token died with the account
    const sync = await app.request('/api/apple-health/sync', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${connect.body.token}` }, body: JSON.stringify({ batchId: 'batch-0001', payloadVersion: 1 }) });
    expect(sync.status).toBe(401);
    expect(stravaRows(other.id)).toEqual(ALL);
  });

  it('still completes when Strava is down', async () => {
    stravaUp = false;
    const r = await me.call('DELETE', '/api/me', { password: PW });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, strava: { deauthorized: false } });
    expect(db.select().from(users).where(eq(users.id, me.id)).all()).toEqual([]);
    expect(stravaRows(me.id)).toEqual(GONE);
    expect(stravaCalls).toHaveLength(1);
  });

  it('an account with no Strava makes no call to Strava', async () => {
    const plain = await signUp(app, 'plain@example.com', PW);
    const r = await plain.call('DELETE', '/api/me', { password: PW });
    expect(r.body).toMatchObject({ ok: true, strava: null });
    expect(stravaCalls).toEqual([]);
  });
});

describe('starting in production', () => {
  const base = { isProd: true, SESSION_SECRET: 'a-real-secret-that-is-long-enough', stravaConfigured: false };
  it('refuses with Strava keys set and the default, a short or a missing webhook token', () => {
    for (const token of [OLD_DEFAULT_WEBHOOK_TOKEN, undefined, '', 'short']) {
      const problems = productionProblems({ ...base, stravaConfigured: true, STRAVA_WEBHOOK_VERIFY_TOKEN: token });
      expect(problems).toHaveLength(1);
      expect(problems[0]).toMatch(/STRAVA_WEBHOOK_VERIFY_TOKEN must be a long random string/);
    }
    expect(OLD_DEFAULT_WEBHOOK_TOKEN).toBe('logbook-verify');
  });
  it('starts with a real token, or with no Strava keys at all (the 1.0 setup)', () => {
    expect(productionProblems({ ...base, stravaConfigured: true, STRAVA_WEBHOOK_VERIFY_TOKEN: 'f3a9c1d2e4b5a6978877665544332211' })).toEqual([]);
    expect(productionProblems({ ...base })).toEqual([]);
    expect(productionProblems({ ...base, STRAVA_WEBHOOK_VERIFY_TOKEN: OLD_DEFAULT_WEBHOOK_TOKEN })).toEqual([]);
  });
  it('still refuses the built-in session secret, and checks nothing outside production', () => {
    expect(productionProblems({ ...base, SESSION_SECRET: DEV_SESSION_SECRET })).toEqual(['Set SESSION_SECRET in production.']);
    expect(productionProblems({ isProd: false, SESSION_SECRET: DEV_SESSION_SECRET, stravaConfigured: true, STRAVA_WEBHOOK_VERIFY_TOKEN: OLD_DEFAULT_WEBHOOK_TOKEN })).toEqual([]);
  });
  it('index.ts has no Strava polling loop', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/syncInBackground|syncAll|20 \* 60_000/);
    expect(src.match(/setInterval\(/g)).toHaveLength(1);
  });
});
