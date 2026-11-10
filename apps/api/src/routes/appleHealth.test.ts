import { today } from '@logbook/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type DB } from '../db/index.js';
import type Database from 'better-sqlite3';
import { healthDays, healthSamples, healthWorkouts, sleepSegments } from '../db/schema.js';
import { readConsentLog } from '../services/consent.js';
import { env } from '../env.js';
import { buildApp } from '../index.js';

type App = ReturnType<typeof buildApp>;
let app: App;
let db: DB;
let sqlite: Database.Database;
let cookie = '';
let userId = '';

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
  ({ db, sqlite } = openDatabase(':memory:'));
  app = buildApp(db);
  env.allowSetup = true;
  env.allowSignup = true;
  const res = await app.request('/api/auth/setup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'josh@example.com', password: 'password123' }) });
  cookie = (res.headers.get('set-cookie') ?? '').split(';')[0]!;
  userId = ((await res.json()) as { id: string }).id;
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

  it('changes the sleep goal from Settings, within 4 to 12 hours', async () => {
    expect((await call('PUT', '/api/apple-health/sleep-goal', { sleepGoalMin: 480 })).body).toEqual({ sleepGoalMin: 480 });
    expect((await call('GET', '/api/apple-health/status')).body.sleepGoalMin).toBe(480);
    expect((await call('PUT', '/api/apple-health/sleep-goal', { sleepGoalMin: 60 })).status).toBe(422);
  });

  it('keeps Fly’s /api/health check where it was', async () => {
    expect((await call('GET', '/api/health', undefined, {})).body.ok).toBe(true);
  });
});

describe('Apple Health: storing batches', () => {
  it('stores heart rate variability, resting heart rate and sleep, counts what arrived, and never keeps the source name', async () => {
    const r = await call(
      'POST',
      '/api/apple-health/sync',
      batch({
        samples: [sample('s1'), sample('s2', 'resting_hr', 52)],
        sleep: [{ uuid: 'z1', start: iso(10), end: iso(9), stage: 'core', sourceBundle: 'com.apple.health', sourceName: 'Josh’s Apple Watch' }],
      }),
      device(token),
    );
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ stored: { samples: 2, deletions: 0, days: 0, sleep: 1, workouts: 0 }, dropped: 0 });
    const s = (await call('GET', '/api/apple-health/status')).body;
    expect(s.counts).toEqual({ samples: { hrv: 1, resting_hr: 1 }, days: 0, sleep: 1, workouts: 0 });
    expect(s.lastSyncAt).not.toBeNull();
    // the device's name ("Josh’s Apple Watch") is not stored anywhere
    expect(db.select().from(healthSamples).all().map((x) => x.sourceName)).toEqual(['', '']);
    expect(db.select().from(sleepSegments).all().map((x) => x.sourceName)).toEqual(['']);
    expect(JSON.stringify(sqlite.prepare("select * from health_samples union all select uuid, user_id, 'sleep', start_at, end_at, 0, '', source_bundle, source_name, product_type, 0, tz, deleted_at, updated_at from sleep_segments").all())).not.toContain('Apple Watch');
  });

  it('refuses any other type with 422 and stores nothing of that batch: another sample type, a day sum, a workout', async () => {
    const refused = async (rows: Record<string, unknown[]>, names: string) => {
      const r = await call('POST', '/api/apple-health/sync', batch({ samples: [sample('good-one')], ...rows }), device(token));
      expect(r.status).toBe(422);
      expect(r.body).toEqual({ error: `Logbook only takes sleep, heart rate variability and resting heart rate from Apple Health. Not accepted: ${names}.`, code: 'health_type' });
    };
    for (const type of ['respiratory_rate', 'spo2', 'wrist_temp', 'vo2max', 'walking_hr', 'body_mass', 'mood']) await refused({ samples: [sample('ok1'), { ...sample('x1'), type }] }, type);
    await refused({ days: [{ date: today(), metric: 'steps', value: 4212, buckets: [[100, 300]], dayStart: iso(12), tz: 'America/New_York' }] }, 'day sums');
    await refused({ days: [{ date: today(), metric: 'hr', value: null, dayStart: iso(12), tz: 'America/New_York' }] }, 'day sums');
    await refused({ workouts: [{ uuid: 'w1', activity: 'running', start: iso(30), end: iso(29), durationSec: 3600, distanceM: 10000, hr: [[0, 120]], sourceBundle: 'com.apple.health', sourceName: 'Watch' }] }, 'workouts');
    await refused({ samples: [{ ...sample('x'), type: 'spo2' }], workouts: [{ uuid: 'w' }], days: [{}] }, 'day sums, spo2, workouts');
    expect(db.select().from(healthSamples).all()).toHaveLength(0);
    expect(db.select().from(healthDays).all()).toHaveLength(0);
    expect(db.select().from(healthWorkouts).all()).toHaveLength(0);
    // reconcile is held to the same three kinds
    for (const kind of ['workout', 'spo2', 'steps']) expect((await call('POST', '/api/apple-health/reconcile', { kind, from: iso(48), to: iso(0), uuids: [] }, device(token))).status).toBe(422);
    for (const kind of ['hrv', 'resting_hr', 'sleep']) expect((await call('POST', '/api/apple-health/reconcile', { kind, from: iso(48), to: iso(0), uuids: [] }, device(token))).status).toBe(200);
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

  it('drops a bad row and keeps the rest: malformed, no type, a day in the future', async () => {
    const r = await call('POST', '/api/apple-health/sync', batch({ samples: [sample('ok1'), { uuid: 'x' }, { ...sample('bad1'), value: 'high' }, { ...sample('fut1'), start: iso(-48), end: iso(-48) }] }), device(token));
    expect(r.body).toMatchObject({ stored: { samples: 1 }, dropped: 3 });
  });

  it('never brings back a deleted sample when an old batch arrives late', async () => {
    await call('POST', '/api/apple-health/sync', batch({ samples: [sample('s1')] }), device(token));
    await call('POST', '/api/apple-health/sync', batch({ deletions: [{ uuid: 's1', kind: 'sample' }] }), device(token));
    await call('POST', '/api/apple-health/sync', batch({ samples: [sample('s1')] }), device(token));
    expect(db.select().from(healthSamples).all()[0]!.deletedAt).not.toBeNull();
    expect((await call('GET', '/api/apple-health/status')).body.counts.samples.hrv).toBe(0);
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

describe('Apple Health: the daily numbers (GET /apple-health/daily)', () => {
  const NY = 'America/New_York';
  /** A reading at a New York wall-clock time in November 2026 (UTC-5). */
  const ny = (day: string, time: string) => new Date(`${day}T${time}:00-05:00`).toISOString();
  const hrv = (uuid: string, day: string, time: string, value: number, tz: string | null = NY) => ({ uuid, type: 'hrv', start: ny(day, time), end: ny(day, time), value, tz, sourceBundle: 'com.apple.health', sourceName: '' });
  const rhr = (uuid: string, day: string, time: string, value: number, tz: string | null = NY) => ({ ...hrv(uuid, day, time, value, tz), type: 'resting_hr' });
  const seg = (uuid: string, from: [string, string], to: [string, string], stage: string, tz: string | null = NY) => ({ uuid, start: ny(...from), end: ny(...to), stage, tz, sourceBundle: 'com.apple.health', sourceName: '' });
  const daily = (q: string, c = cookie) => call('GET', `/api/apple-health/daily?${q}`, undefined, { cookie: c });

  it('answers one row per day with minutes asleep, average HRV and average resting heart rate, null where there is nothing', async () => {
    const r = await call(
      'POST',
      '/api/apple-health/sync',
      batch({
        samples: [hrv('h1', '2026-11-03', '02:10', 48), hrv('h2', '2026-11-03', '04:40', 55), hrv('h3', '2026-11-04', '03:00', 61.26), rhr('r1', '2026-11-03', '07:00', 51), rhr('r2', '2026-11-03', '19:00', 54), rhr('r3', '2026-11-05', '07:00', 49)],
        sleep: [
          // the night of Nov 2 to 3: asleep 23:00 to 06:30 with 30 minutes awake in it
          seg('z1', ['2026-11-02', '22:45'], ['2026-11-03', '06:40'], 'in_bed'),
          seg('z2', ['2026-11-02', '23:00'], ['2026-11-03', '01:00'], 'core'),
          seg('z3', ['2026-11-03', '01:00'], ['2026-11-03', '02:00'], 'deep'),
          seg('z4', ['2026-11-03', '02:00'], ['2026-11-03', '02:30'], 'awake'),
          seg('z5', ['2026-11-03', '02:30'], ['2026-11-03', '05:00'], 'rem'),
          seg('z6', ['2026-11-03', '05:00'], ['2026-11-03', '06:30'], 'core'),
          // the same night recorded by a second source: not counted twice
          { ...seg('p1', ['2026-11-02', '23:10'], ['2026-11-03', '06:00'], 'asleep'), sourceBundle: 'com.example.sleepapp' },
          // a nap that afternoon counts toward the same day
          seg('z7', ['2026-11-03', '14:00'], ['2026-11-03', '14:20'], 'asleep'),
          // the next night starts before midnight and belongs to Nov 4
          seg('z8', ['2026-11-03', '21:30'], ['2026-11-04', '05:30'], 'asleep'),
        ],
      }),
      device(token),
    );
    expect(r.status).toBe(200);
    const d = await daily('from=2026-11-02&to=2026-11-06');
    expect(d.status).toBe(200);
    expect(d.body).toEqual({
      days: [
        { date: '2026-11-02', sleepMin: null, hrvMs: null, restingHr: null },
        { date: '2026-11-03', sleepMin: 7 * 60 + 20, hrvMs: 51.5, restingHr: 53 },
        { date: '2026-11-04', sleepMin: 8 * 60, hrvMs: 61.3, restingHr: null },
        { date: '2026-11-05', sleepMin: null, hrvMs: null, restingHr: 49 },
        { date: '2026-11-06', sleepMin: null, hrvMs: null, restingHr: null },
      ],
    });
  });

  it('places a reading with no time zone by the tz it is asked with, then by the person’s latest reading, then UTC', async () => {
    // 9:30 pm in New York is already the next day in UTC
    await call('POST', '/api/apple-health/sync', batch({ samples: [rhr('late', '2026-11-03', '21:30', 50, null)] }), device(token));
    const on = (rows: Array<{ date: string; restingHr: number | null }>) => rows.find((x) => x.restingHr !== null)!.date;
    expect(on((await daily('from=2026-11-02&to=2026-11-05')).body.days)).toBe('2026-11-04');
    expect(on((await daily(`from=2026-11-02&to=2026-11-05&tz=${encodeURIComponent(NY)}`)).body.days)).toBe('2026-11-03');
    // a zone nobody has heard of is ignored, not an error
    expect((await daily('from=2026-11-02&to=2026-11-05&tz=Mars/Olympus')).status).toBe(200);
    // once any reading says where the person is, readings without a zone follow it
    await call('POST', '/api/apple-health/sync', batch({ samples: [hrv('zoned', '2026-11-04', '03:00', 60)] }), device(token));
    expect(on((await daily('from=2026-11-02&to=2026-11-05')).body.days)).toBe('2026-11-03');
  });

  it('is for the signed-in account only, leaves out deleted readings, and still answers after the phone disconnects nothing', async () => {
    await call('POST', '/api/apple-health/sync', batch({ samples: [hrv('h1', '2026-11-03', '03:00', 48), hrv('h2', '2026-11-03', '04:00', 90)] }), device(token));
    await call('POST', '/api/apple-health/sync', batch({ deletions: [{ uuid: 'h2', kind: 'sample' }] }), device(token));
    expect((await daily('from=2026-11-03&to=2026-11-03')).body.days).toEqual([{ date: '2026-11-03', sleepMin: null, hrvMs: 48, restingHr: null }]);
    expect((await call('GET', '/api/apple-health/daily?from=2026-11-03&to=2026-11-03', undefined, {})).status).toBe(401);
    // the device token is not a way to read
    expect((await call('GET', '/api/apple-health/daily?from=2026-11-03&to=2026-11-03', undefined, device(token))).status).toBe(401);
    const res = await app.request('/api/auth/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'other@example.com', password: 'password123' }) });
    const other = (res.headers.get('set-cookie') ?? '').split(';')[0]!;
    expect((await daily('from=2026-11-03&to=2026-11-03', other)).body.days).toEqual([{ date: '2026-11-03', sleepMin: null, hrvMs: null, restingHr: null }]);
  });

  it('takes at most 400 days a call and needs real dates in order', async () => {
    expect((await daily('from=2025-10-08&to=2026-11-11')).body.days).toHaveLength(400);
    const over = await daily('from=2025-10-07&to=2026-11-11');
    expect(over.status).toBe(422);
    expect(over.body).toEqual({ error: 'Ask for at most 400 days at a time.', code: 'too_many_days' });
    expect((await daily('from=2026-11-05&to=2026-11-03')).status).toBe(422);
    expect((await daily('from=yesterday&to=2026-11-03')).status).toBe(422);
    expect((await daily('to=2026-11-03')).status).toBe(422);
  });
});

describe('Apple Health: consent and sign out', () => {
  it('records connecting and disconnecting in the consent log', async () => {
    const kinds = () => readConsentLog(db, userId).map((e) => `${e.kind}:${e.value}`);
    expect(kinds()).toEqual(['apple_health:true']);
    await call('DELETE', '/api/apple-health');
    await call('DELETE', '/api/apple-health');
    expect(kinds()).toEqual(['apple_health:true', 'apple_health:false']);
    for (const e of readConsentLog(db, userId)) expect(e).toMatchObject({ version: '2026-11', at: expect.any(String) });
  });

  it('POST /auth/logout revokes the device token sent with it, and only a device of that account', async () => {
    const deviceId = (await call('GET', '/api/apple-health/status')).body.devices[0].id as string;
    // another account cannot revoke this phone by naming its id
    const res = await app.request('/api/auth/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'other@example.com', password: 'password123' }) });
    const other = (res.headers.get('set-cookie') ?? '').split(';')[0]!;
    expect((await call('POST', '/api/auth/logout', { healthTokenId: deviceId }, { cookie: other })).body).toEqual({ ok: true, healthRevoked: false });
    expect((await call('POST', '/api/apple-health/sync', batch({ samples: [sample('a')] }), device(token))).status).toBe(200);
    // signing out from the phone that holds it ends its token with the session
    const out = await call('POST', '/api/auth/logout', { healthTokenId: deviceId });
    expect(out.body).toEqual({ ok: true, healthRevoked: true });
    expect((await call('POST', '/api/apple-health/sync', batch({ samples: [sample('b')] }), device(token))).status).toBe(401);
    expect((await call('GET', '/api/me')).status).toBe(401);
  });

  it('a plain sign out (no body) still works, and the token dies with the account', async () => {
    const res = await app.request('/api/auth/logout', { method: 'POST', headers: { cookie } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, healthRevoked: false });
    // the device keeps syncing for the account it belongs to until that account is gone
    expect((await call('POST', '/api/apple-health/sync', batch({ samples: [sample('a')] }), device(token))).status).toBe(200);
    const login = await app.request('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'josh@example.com', password: 'password123' }) });
    const again = (login.headers.get('set-cookie') ?? '').split(';')[0]!;
    expect((await call('DELETE', '/api/me', { password: 'password123' }, { cookie: again })).status).toBe(200);
    expect((await call('POST', '/api/apple-health/sync', batch({ samples: [sample('c')] }), device(token))).status).toBe(401);
  });
});
