import { today } from '@logbook/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type DB } from '../db/index.js';
import { healthDays, healthSamples, healthWorkouts } from '../db/schema.js';
import { env } from '../env.js';
import { buildApp } from '../index.js';

type App = ReturnType<typeof buildApp>;
let app: App;
let db: DB;
let cookie = '';

const call = async (method: string, url: string, body?: unknown, headers: Record<string, string> = { cookie }) => {
  const res = await app.request(url, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};
const device = (token: string) => ({ authorization: `Bearer ${token}` });

const iso = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3_600_000).toISOString();
const sample = (uuid: string, type = 'hrv', value = 55, hoursAgo = 8) => ({ uuid, type, start: iso(hoursAgo), end: iso(hoursAgo), value, sourceBundle: 'com.apple.health.watch', sourceName: 'Josh’s Apple Watch', productType: 'Watch7,1' });
let n = 0;
const batch = (rows: Record<string, unknown[]> = {}, batchId = `b-${Date.now()}-${n++}`) => ({ batchId, payloadVersion: 1, samples: [], deletions: [], days: [], sleep: [], workouts: [], ...rows });

let token = '';
beforeEach(async () => {
  db = openDatabase(':memory:').db;
  app = buildApp(db);
  env.allowSetup = true;
  const res = await app.request('/api/auth/setup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'josh@example.com', password: 'password123' }) });
  cookie = (res.headers.get('set-cookie') ?? '').split(';')[0]!;
  const c = await call('POST', '/api/apple-health/connect', { deviceName: 'Josh’s iPhone', historyDays: 365, sleepGoalMin: 465 });
  expect(c.status).toBe(201);
  token = c.body.token;
});

describe('Apple Health: connecting and the device token', () => {
  it('mints a token once, starts history a year back, and keeps the sleep goal asked during connect', async () => {
    expect(token.length).toBeGreaterThan(30);
    const s = (await call('GET', '/api/apple-health/status')).body;
    expect(s).toMatchObject({ connected: true, sleepGoalMin: 465, devices: [{ name: 'Josh’s iPhone' }] });
    expect(s.historyFrom).toBe(new Date(Date.parse(today()) - 365 * 86_400_000).toISOString().slice(0, 10));
  });

  it('refuses a sync without a token, with a wrong one, and with the web session alone', async () => {
    expect((await call('POST', '/api/apple-health/sync', batch(), {})).status).toBe(401);
    expect((await call('POST', '/api/apple-health/sync', batch(), device('nope'))).status).toBe(401);
    expect((await call('POST', '/api/apple-health/sync', batch(), { cookie })).status).toBe(401);
  });

  it('keeps Fly’s /api/health check where it was', async () => {
    expect((await call('GET', '/api/health', undefined, {})).body.ok).toBe(true);
  });
});

describe('Apple Health: storing batches', () => {
  it('stores samples, sleep, days and workouts, and counts what arrived', async () => {
    const r = await call(
      'POST',
      '/api/apple-health/sync',
      batch({
        samples: [sample('s1'), sample('s2', 'resting_hr', 52)],
        sleep: [{ uuid: 'z1', start: iso(10), end: iso(9), stage: 'core', sourceBundle: 'com.apple.health', sourceName: 'Watch' }],
        days: [{ date: today(), metric: 'steps', value: 4212, buckets: [[100, 300]], dayStart: iso(12), tz: 'America/New_York' }],
        workouts: [{ uuid: 'w1', activity: 'running', start: iso(30), end: iso(29), durationSec: 3600, distanceM: 10000, hr: [[0, 120], [5, 130]], sourceBundle: 'com.apple.health', sourceName: 'Watch' }],
      }),
      device(token),
    );
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ stored: { samples: 2, deletions: 0, days: 1, sleep: 1, workouts: 1 }, dropped: 0 });
    const s = (await call('GET', '/api/apple-health/status')).body;
    expect(s.counts).toMatchObject({ samples: { hrv: 1, resting_hr: 1 }, days: 1, sleep: 1, workouts: 1 });
    expect(s.lastSyncAt).not.toBeNull();
  });

  it('lands a batch sent twice once, and a row sent twice once', async () => {
    const b = batch({ samples: [sample('s1')] }, 'same-batch-id');
    await call('POST', '/api/apple-health/sync', b, device(token));
    expect((await call('POST', '/api/apple-health/sync', b, device(token))).body.duplicate).toBe(true);
    await call('POST', '/api/apple-health/sync', batch({ samples: [sample('s1', 'hrv', 60)] }), device(token));
    const rows = db.select().from(healthSamples).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.value).toBe(60);
  });

  it('drops a bad row and keeps the rest: unknown type, malformed, a day in the future', async () => {
    const r = await call('POST', '/api/apple-health/sync', batch({ samples: [sample('ok1'), { ...sample('bad1'), type: 'mood' }, { uuid: 'x' }, { ...sample('fut1'), start: iso(-48), end: iso(-48) }] }), device(token));
    expect(r.body).toMatchObject({ stored: { samples: 1 }, dropped: 3 });
  });

  it('never brings back a deleted sample when an old batch arrives late', async () => {
    await call('POST', '/api/apple-health/sync', batch({ samples: [sample('s1')] }), device(token));
    await call('POST', '/api/apple-health/sync', batch({ deletions: [{ uuid: 's1', kind: 'sample' }] }), device(token));
    await call('POST', '/api/apple-health/sync', batch({ samples: [sample('s1')] }), device(token));
    expect(db.select().from(healthSamples).all()[0]!.deletedAt).not.toBeNull();
    expect((await call('GET', '/api/apple-health/status')).body.counts.samples.hrv).toBe(0);
  });

  it('freezes a day’s time zone the first time it lands, and still takes new sums', async () => {
    const day = { date: today(), metric: 'steps', value: 100, dayStart: iso(12), tz: 'America/New_York' };
    await call('POST', '/api/apple-health/sync', batch({ days: [day] }), device(token));
    await call('POST', '/api/apple-health/sync', batch({ days: [{ ...day, value: 900, tz: 'Europe/London', dayStart: iso(7) }] }), device(token));
    const row = db.select().from(healthDays).get()!;
    expect(row).toMatchObject({ value: 900, tz: 'America/New_York' });
  });

  it('keeps a workout’s heart rate when a later copy arrives without it', async () => {
    const w = { uuid: 'w1', activity: 'running', start: iso(30), end: iso(29), durationSec: 3600, hr: [[0, 120]], sourceBundle: 'b', sourceName: 'n' };
    await call('POST', '/api/apple-health/sync', batch({ workouts: [w] }), device(token));
    await call('POST', '/api/apple-health/sync', batch({ workouts: [{ ...w, hr: null, energyKcal: 600 }] }), device(token));
    expect(db.select().from(healthWorkouts).get()).toMatchObject({ energyKcal: 600, hrJson: '[[0,120]]' });
  });

  it('refuses an upload over 2 MB', async () => {
    const big = batch({ samples: Array.from({ length: 4000 }, (_, i) => ({ ...sample(`s${i}`), sourceName: 'x'.repeat(600) })) });
    expect((await call('POST', '/api/apple-health/sync', big, device(token))).status).toBe(413);
  });
});

describe('Apple Health: reconcile', () => {
  it('removes what Health no longer has in the window, and nothing outside it', async () => {
    await call('POST', '/api/apple-health/sync', batch({ samples: [sample('a', 'hrv', 50, 5), sample('b', 'hrv', 51, 6), sample('old', 'hrv', 49, 24 * 30)] }), device(token));
    const r = await call('POST', '/api/apple-health/reconcile', { kind: 'hrv', from: iso(24 * 14), to: iso(0), uuids: ['a'] }, device(token));
    expect(r.body).toEqual({ removed: 1 });
    const live = db.select().from(healthSamples).all().filter((x) => !x.deletedAt).map((x) => x.uuid);
    expect(live.sort()).toEqual(['a', 'old']);
  });

  it('skips, and says so, when Health returns nothing while the server has rows (access taken away)', async () => {
    await call('POST', '/api/apple-health/sync', batch({ samples: [sample('a')] }), device(token));
    expect((await call('POST', '/api/apple-health/reconcile', { kind: 'hrv', from: iso(24 * 14), to: iso(0), uuids: [] }, device(token))).body).toEqual({ removed: 0, skipped: true });
  });
});

describe('Apple Health: disconnect', () => {
  it('deletes every row, revokes the token, and refuses later syncs', async () => {
    await call('POST', '/api/apple-health/sync', batch({ samples: [sample('a')] }), device(token));
    expect((await call('DELETE', '/api/apple-health')).body).toEqual({ ok: true });
    expect(db.select().from(healthSamples).all()).toHaveLength(0);
    expect((await call('GET', '/api/apple-health/status')).body.connected).toBe(false);
    expect((await call('POST', '/api/apple-health/sync', batch({ samples: [sample('b')] }), device(token))).status).toBe(401);
  });
});
