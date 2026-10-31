import { shiftDays, today } from '@logbook/shared';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq, ne } from 'drizzle-orm';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type DB } from '../db/index.js';
import { activities, providerConnections } from '../db/schema.js';
import { env } from '../env.js';
import { buildApp } from '../index.js';
import { stravaBucket, TokenBucket } from './providers/bucket.js';
import { mapActivity, mapTokens } from './providers/coros.js';
import { dedupeActivities, handleWebhook, looksLikeSame, syncAllConnections, syncConnection, upsertActivity } from './providers/index.js';
import { stravaProvider } from './providers/strava.js';
import { ProviderError } from './providers/types.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = path.join(here, '..', '..', 'drizzle');

type App = ReturnType<typeof buildApp>;
let app: App;
let db: DB;
let cookie = '';
let userId = '';
const realFetch = globalThis.fetch;

const call = async (method: string, url: string, body?: unknown, c = cookie) => {
  const res = await app.request(url, { method, headers: { 'content-type': 'application/json', cookie: c }, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { status: res.status, body: parsed as any, location: res.headers.get('location') };
};
const connect = (uid: string, athlete = '1', provider = 'strava', extra: Partial<typeof providerConnections.$inferInsert> = {}) =>
  db.insert(providerConnections).values({ userId: uid, provider, externalAthleteId: athlete, athleteName: 'A', accessToken: 't', refreshToken: 'r', expiresAt: Math.floor(Date.now() / 1000) + 3600, scope: null, cursor: null, lastSyncAt: null, lastError: null, status: 'ok', connectedAt: new Date().toISOString(), ...extra }).run();
const strava = (id: number, date: string, meters: number, extra: Record<string, unknown> = {}) => ({ id, name: 'Run', sport_type: 'Run', start_date_local: `${date}T06:30:00Z`, distance: meters, moving_time: 1500, elapsed_time: 1500, total_elevation_gain: 10, ...extra });

beforeEach(async () => {
  db = openDatabase(':memory:').db;
  app = buildApp(db);
  env.allowSetup = true;
  env.stravaConfigured = true;
  stravaBucket.reset();
  const res = await app.request('/api/auth/setup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'josh@example.com', password: 'password123' }) });
  cookie = (res.headers.get('set-cookie') ?? '').split(';')[0]!;
  userId = (await call('GET', '/api/me')).body.id;
});
afterEach(() => {
  globalThis.fetch = realFetch;
  env.stravaConfigured = false;
});

describe('migration 0015', () => {
  it('moves a connected Strava account into provider_connections and keys activities by provider and external id', () => {
    const journal = JSON.parse(fs.readFileSync(path.join(MIGRATIONS, 'meta', '_journal.json'), 'utf8'));
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'logbook-mig15-'));
    try {
      fs.mkdirSync(path.join(tmp, 'meta'));
      const before = { ...journal, entries: journal.entries.filter((e: { idx: number }) => e.idx <= 14) };
      fs.writeFileSync(path.join(tmp, 'meta', '_journal.json'), JSON.stringify(before));
      for (const e of before.entries) fs.copyFileSync(path.join(MIGRATIONS, `${e.tag}.sql`), path.join(tmp, `${e.tag}.sql`));
      const raw = new Database(':memory:');
      const old = drizzle(raw);
      migrate(old, { migrationsFolder: tmp });
      raw.prepare("insert into users (id, email, password_hash, created_at) values ('u1', 'josh@example.com', 'x', '2026-01-01T00:00:00Z')").run();
      raw.prepare("insert into strava_accounts (user_id, athlete_id, athlete_name, access_token, refresh_token, expires_at, scope, created_at, last_sync_at, last_error) values ('u1', '42', 'Josh B', 'acc', 'ref', 1800000000, 'read,activity:read_all', '2026-02-01T00:00:00Z', '2026-10-30T06:00:00Z', null)").run();
      raw.prepare("insert into activities (id, user_id, date, time, name, sport_type, kind, distance_m, moving_sec, elapsed_sec, elev_m, updated_at) values ('777', 'u1', '2026-10-30', '06:30', 'Morning Run', 'Run', 'run', 8046, 2400, 2500, 20, '2026-10-30T07:00:00Z')").run();
      migrate(old, { migrationsFolder: MIGRATIONS });
      expect(raw.prepare("select name from sqlite_master where type = 'table' and name = 'strava_accounts'").all()).toEqual([]);
      expect(raw.prepare('select * from provider_connections').all()).toEqual([expect.objectContaining({ user_id: 'u1', provider: 'strava', external_athlete_id: '42', athlete_name: 'Josh B', access_token: 'acc', refresh_token: 'ref', expires_at: 1800000000, scope: 'read,activity:read_all', status: 'ok', connected_at: '2026-02-01T00:00:00Z', last_sync_at: '2026-10-30T06:00:00Z' })]);
      const a = raw.prepare('select * from activities').all() as Array<Record<string, unknown>>;
      expect(a).toEqual([expect.objectContaining({ id: '777', provider: 'strava', external_id: '777', distance_m: 8046, duplicate_of: null, perf_failed_at: null })]);
      // two accounts on the same athlete id no longer collide: the key is (user, provider, external id), `id` stays unique
      raw.prepare("insert into users (id, email, password_hash, created_at) values ('u2', 'b@example.com', 'x', '2026-01-01T00:00:00Z')").run();
      raw.prepare("insert into activities (id, user_id, provider, external_id, date, name, sport_type, kind, updated_at) values ('777_x', 'u2', 'strava', '777', '2026-10-30', 'Run', 'Run', 'run', 'now')").run();
      expect(() => raw.prepare("insert into activities (id, user_id, provider, external_id, date, name, sport_type, kind, updated_at) values ('dup', 'u1', 'strava', '777', '2026-10-30', 'Run', 'Run', 'run', 'now')").run()).toThrow(/UNIQUE|PRIMARY/);
      raw.close();
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('the sync engine', () => {
  it('takes the 120-day window on connect, then everything since the last sync less two days; pages until a short page', async () => {
    connect(userId);
    const asks: string[] = [];
    globalThis.fetch = (async (url: string | URL | Request) => {
      const u = String(url);
      asks.push(u);
      if (u.includes('/athlete/activities')) {
        const page = Number(/&page=(\d+)/.exec(u)?.[1]);
        if (page === 1) return new Response(JSON.stringify(Array.from({ length: 100 }, (_, i) => strava(1000 + i, shiftDays(today(), -i), 5000))), { status: 200 });
        return new Response(JSON.stringify([strava(7, shiftDays(today(), -1), 5000)]), { status: 200 });
      }
      return new Response(JSON.stringify({ laps: [] }), { status: 200 });
    }) as typeof fetch;
    const first = await syncConnection(db, userId, 'strava', { detailLimit: 0 });
    expect(first.changed).toBe(101);
    const lists = asks.filter((u) => u.includes('/athlete/activities'));
    expect(lists).toHaveLength(2);
    const after = Number(/after=(\d+)/.exec(lists[0]!)?.[1]);
    expect(Math.abs(after - (Date.now() / 1000 - 120 * 86400))).toBeLessThan(120);
    const conn = db.select().from(providerConnections).where(eq(providerConnections.userId, userId)).get()!;
    expect(conn.lastSyncAt).toBeTruthy();
    expect(conn.status).toBe('ok');
    asks.length = 0;
    await syncConnection(db, userId, 'strava', { detailLimit: 0 });
    const again = Number(/after=(\d+)/.exec(asks.find((u) => u.includes('/athlete/activities'))!)?.[1]);
    expect(Math.abs(again - (new Date(conn.lastSyncAt!).getTime() / 1000 - 2 * 86400))).toBeLessThan(5);
  });

  it('never soft-deletes on a partial listing, and retries a failed detail after 24 hours', async () => {
    connect(userId);
    db.update(providerConnections).set({ lastSyncAt: new Date().toISOString() }).where(eq(providerConnections.userId, userId)).run();
    upsertActivity(db, userId, 'strava', { externalId: '5', startLocal: `${shiftDays(today(), -1)}T06:30`, name: 'Run', sportType: 'Run', distanceM: 5000, movingSec: 1500, elapsedSec: 1500, elevM: 0, avgHr: null, maxHr: null, cadence: null, polyline: null });
    let pages = 0;
    globalThis.fetch = (async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes('/athlete/activities')) {
        pages++;
        if (pages === 1) return new Response(JSON.stringify(Array.from({ length: 100 }, (_, i) => strava(2000 + i, shiftDays(today(), -1), 3000))), { status: 200 });
        return new Response('down', { status: 503 });
      }
      return new Response('nope', { status: 500 });
    }) as typeof fetch;
    const r = await syncConnection(db, userId, 'strava', { detailLimit: 2 });
    expect(r.changed).toBe(100);
    const five = db.select().from(activities).where(eq(activities.externalId, '5')).get()!;
    expect(five.deletedAt).toBeNull(); // the window never came through whole
    const conn = db.select().from(providerConnections).where(eq(providerConnections.userId, userId)).get()!;
    expect(conn.lastError).toMatch(/503/);
    // the two details tried failed: stamped, and not retried within the day
    const failed = db.select().from(activities).where(eq(activities.userId, userId)).all().filter((a) => a.perfFailedAt);
    expect(failed).toHaveLength(2);
    let details = 0;
    globalThis.fetch = (async (url: string | URL | Request) => {
      const u = String(url);
      // the same hundred again (a listing that came back empty would mean they are gone), then the details
      if (u.includes('/athlete/activities')) return new Response(JSON.stringify(/&page=1/.test(u) ? [strava(5, shiftDays(today(), -1), 5000), ...Array.from({ length: 99 }, (_, i) => strava(2000 + i, shiftDays(today(), -1), 3000))] : []), { status: 200 });
      details++;
      return new Response(JSON.stringify({ laps: [{ distance: 1609, moving_time: 500, average_heartrate: 150 }] }), { status: 200 });
    }) as typeof fetch;
    await syncConnection(db, userId, 'strava', { detailLimit: 2 });
    expect(details).toBe(2); // two others, not the two that failed an hour ago
    // a day later the first failure is tried again (the rest already have their details)
    db.update(activities).set({ perfAt: 'x' }).where(ne(activities.id, failed[0]!.id)).run();
    db.update(activities).set({ perfFailedAt: new Date(Date.now() - 25 * 3600_000).toISOString() }).where(eq(activities.id, failed[0]!.id)).run();
    details = 0;
    await syncConnection(db, userId, 'strava', { detailLimit: 10 });
    expect(details).toBe(1);
    expect(db.select().from(activities).where(eq(activities.id, failed[0]!.id)).get()).toMatchObject({ perfAt: expect.any(String), perfFailed: 0, perfFailedAt: null, lapsJson: '[[1609,500,150]]' });
  });

  it('marks the connection needs_reauth on a 401 and the loop leaves it alone', async () => {
    connect(userId);
    globalThis.fetch = (async () => new Response('', { status: 401 })) as typeof fetch;
    await expect(syncConnection(db, userId, 'strava')).rejects.toBeInstanceOf(ProviderError);
    expect(db.select().from(providerConnections).where(eq(providerConnections.userId, userId)).get()!.status).toBe('needs_reauth');
    let hits = 0;
    globalThis.fetch = (async () => {
      hits++;
      return new Response('[]', { status: 200 });
    }) as typeof fetch;
    syncAllConnections(db);
    await new Promise((r) => setTimeout(r, 30));
    expect(hits).toBe(0);
    expect((await call('GET', '/api/connections')).body).toEqual([expect.objectContaining({ provider: 'strava', connected: true, status: 'needs_reauth' }), expect.objectContaining({ provider: 'coros', connected: false, status: 'disconnected' })]);
  });

  it('shares one token bucket across accounts and backs off on a 429', async () => {
    const t = { now: 0 };
    const b = new TokenBucket('strava', 3, 1000, () => t.now);
    b.take();
    b.take();
    b.take();
    expect(() => b.take()).toThrow(/rate limit/);
    t.now = 1001;
    expect(b.remaining()).toBe(3);
    b.backoff(500);
    expect(() => b.take()).toThrow(/rate limit/);
    t.now = 1600;
    b.take();
    // the real bucket: a 429 from Strava blocks every account's next call
    connect(userId, '1');
    globalThis.fetch = (async () => new Response('', { status: 429 })) as typeof fetch;
    await expect(syncConnection(db, userId, 'strava')).rejects.toMatchObject({ code: 'rate_limited' });
    expect(stravaBucket.remaining()).toBe(0);
  });
});

describe('webhooks', () => {
  it('honours aspect_type: a delete hides one activity, an athlete deauthorization disconnects', async () => {
    connect(userId, '42');
    upsertActivity(db, userId, 'strava', { externalId: '9', startLocal: `${today()}T06:30`, name: 'Run', sportType: 'Run', distanceM: 5000, movingSec: 1500, elapsedSec: 1500, elevM: 0, avgHr: null, maxHr: null, cadence: null, polyline: null });
    expect(stravaProvider.parseWebhook({ object_type: 'activity', aspect_type: 'delete', object_id: 9, owner_id: 42 }, new Headers())).toEqual([{ type: 'activity', aspect: 'delete', athleteId: '42', externalId: '9' }]);
    expect(stravaProvider.parseWebhook({ object_type: 'athlete', aspect_type: 'update', object_id: 42, owner_id: 42, updates: { authorized: 'false' } }, new Headers())).toEqual([{ type: 'deauthorize', athleteId: '42' }]);
    expect(stravaProvider.parseWebhook({ object_type: 'athlete', aspect_type: 'update', object_id: 42, owner_id: 42, updates: {} }, new Headers())).toEqual([]);
    const r = await call('POST', '/api/strava/webhook', { object_type: 'activity', aspect_type: 'delete', object_id: 9, owner_id: 42 });
    expect(r.status).toBe(200);
    expect(db.select().from(activities).where(eq(activities.externalId, '9')).get()!.deletedAt).toBeTruthy();
    await handleWebhook(db, 'strava', [{ type: 'deauthorize', athleteId: '42' }]);
    expect(db.select().from(providerConnections).all()).toEqual([]);
    // the verification ping still answers on the old path
    expect((await call('GET', `/api/strava/webhook?hub.mode=subscribe&hub.verify_token=${env.STRAVA_WEBHOOK_VERIFY_TOKEN}&hub.challenge=abc`)).body).toEqual({ 'hub.challenge': 'abc' });
  });
});

describe('cross-provider dedupe', () => {
  it('marks a run both providers recorded as a duplicate of the first provider’s, and status counts it once', async () => {
    connect(userId, '1', 'strava', { connectedAt: '2026-01-01T00:00:00Z' });
    connect(userId, 'c1', 'coros', { connectedAt: '2026-06-01T00:00:00Z' });
    const d = today();
    const base = { name: 'Run', sportType: 'Run', movingSec: 1500, elapsedSec: 1500, elevM: 0, avgHr: null, maxHr: null, cadence: null, polyline: null };
    upsertActivity(db, userId, 'strava', { ...base, externalId: 's1', startLocal: `${d}T06:30`, distanceM: 8050 });
    upsertActivity(db, userId, 'coros', { ...base, externalId: 'c1', startLocal: `${d}T06:31`, distanceM: 8000 });
    upsertActivity(db, userId, 'coros', { ...base, externalId: 'c2', startLocal: `${d}T18:00`, distanceM: 3000 });
    expect(looksLikeSame({ date: d, time: '06:30', distanceM: 8050 }, { date: d, time: '06:32', distanceM: 8000 })).toBe(true);
    expect(looksLikeSame({ date: d, time: '06:30', distanceM: 8050 }, { date: d, time: '06:33', distanceM: 8000 })).toBe(false);
    expect(looksLikeSame({ date: d, time: '06:30', distanceM: 8050 }, { date: d, time: '06:31', distanceM: 7000 })).toBe(false);
    expect(dedupeActivities(db, userId, shiftDays(d, -1), d)).toBe(1);
    const rows = db.select().from(activities).where(eq(activities.userId, userId)).all();
    expect(rows.find((r) => r.externalId === 'c1')!.duplicateOf).toBe(rows.find((r) => r.externalId === 's1')!.id);
    expect(rows.find((r) => r.externalId === 'c2')!.duplicateOf).toBeNull();
    const seen = (await call('GET', `/api/activities?from=${d}&to=${d}`)).body as Array<{ id: string; miles: number }>;
    expect(seen.map((a) => a.id).sort()).toEqual(['coros_c2', 's1']);
    // the week counts 8 miles once (5 + 1.9 at 18:00), not 13
    const month = (await call('GET', `/api/months/${d.slice(0, 7)}`)).body;
    expect(month.activities).toHaveLength(2);
    // the Strava row goes: the COROS one stands on its own again
    db.update(activities).set({ deletedAt: 'x' }).where(eq(activities.externalId, 's1')).run();
    dedupeActivities(db, userId, shiftDays(d, -1), d);
    expect(db.select().from(activities).where(eq(activities.externalId, 'c1')).get()!.duplicateOf).toBeNull();
  });
});

describe('connection routes', () => {
  it('lists providers, hands out connect URLs, disconnects, and keeps /api/strava as an alias', async () => {
    const list = (await call('GET', '/api/connections')).body as Array<{ provider: string; configured: boolean; connected: boolean }>;
    expect(list.map((c) => c.provider)).toEqual(['strava', 'coros']);
    expect(list[0]).toMatchObject({ configured: true, connected: false, status: 'disconnected', name: 'Strava' });
    expect(list[1]).toMatchObject({ configured: false, connected: false, name: 'COROS' });
    const url = (await call('GET', '/api/connections/strava/connect-url')).body.url as string;
    expect(url).toMatch(/^https:\/\/www\.strava\.com\/oauth\/authorize\?/);
    expect(new URL(url).searchParams.get('redirect_uri')).toBe(`${env.APP_URL}/api/strava/callback`);
    expect((await call('GET', '/api/strava/connect-url')).body.url).toMatch(/strava\.com/);
    expect((await call('GET', '/api/connections/coros/connect-url')).status).toBe(400);
    expect((await call('GET', '/api/connections/garmin/status')).status).toBe(404);
    const redirect = await call('GET', '/api/connections/strava/connect');
    expect(redirect.status).toBe(302);
    expect(redirect.location).toMatch(/strava\.com/);
    // a bad state lands on Settings with the reason
    expect((await call('GET', '/api/connections/strava/callback?state=bad&code=x')).location).toBe('/settings?strava=error&reason=state');
    connect(userId);
    expect((await call('GET', '/api/strava/status')).body).toMatchObject({ connected: true, athleteName: 'A', status: 'ok' });
    let revoked = 0;
    globalThis.fetch = (async (url: string | URL | Request) => {
      if (String(url).includes('deauthorize')) revoked++;
      return new Response('{}', { status: 200 });
    }) as typeof fetch;
    expect((await call('POST', '/api/strava/disconnect')).body.connected).toBe(false);
    expect(revoked).toBe(1);
    expect((await call('GET', '/api/bootstrap')).body.connections).toEqual([expect.objectContaining({ provider: 'strava', connected: false }), expect.objectContaining({ provider: 'coros' })]);
    // deleting the account revokes what is connected
    connect(userId);
    expect((await call('DELETE', '/api/me', { password: 'password123' })).status).toBe(200);
    expect(revoked).toBe(2);
  });
});

describe('COROS mapping', () => {
  it('reads the documented fields and insists on a token and an openId', () => {
    const a = mapActivity({ labelId: 'L1', mode: 8, startTime: 1761892200, startTimezone: -16, distance: 8000, duration: 2400, avgHeartRate: 150, totalElevation: 30 });
    expect(a).toMatchObject({ externalId: 'L1', sportType: 'Run', distanceM: 8000, movingSec: 2400, avgHr: 150, elevM: 30 });
    expect(a.startLocal).toBe('2025-10-31T02:30');
    expect(mapTokens({ access_token: 'a', refresh_token: 'r', openId: 'o', expires_in: 100 })).toMatchObject({ accessToken: 'a', refreshToken: 'r', athleteId: 'o' });
    expect(() => mapTokens({ message: 'bad code' })).toThrow(/incomplete/);
  });
});
