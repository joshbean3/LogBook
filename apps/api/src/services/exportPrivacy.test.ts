import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../db/index.js';
import { openDatabase } from '../db/index.js';
import { readConsent, readConsentLog } from './consent.js';
import { makeApp, signUp, type Account, type App } from '../test/helpers.js';

/** The export carries the consent log and the Apple Health data; an import can never carry consent in (gap-leg-08, settings-11). */
let app: App;
let db: DB;
let me: Account;
const iso = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3_600_000).toISOString();

beforeEach(async () => {
  ({ app, db } = makeApp());
  me = await signUp(app, 'export@example.com');
});

describe('GET /export', () => {
  it('includes the consent log and what Orby holds from Apple Health, without tokens or device names from the readings', async () => {
    await me.call('PUT', '/api/me/consent', { training: true, recall: false });
    const connect = await me.call('POST', '/api/apple-health/connect', { deviceName: 'My iPhone', sleepGoalMin: 450 });
    const sync = await app.request('/api/apple-health/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${connect.body.token}` },
      body: JSON.stringify({
        batchId: 'batch-0001',
        payloadVersion: 1,
        samples: [
          { uuid: 's1', type: 'hrv', start: iso(8), end: iso(8), value: 55, tz: 'America/Denver', sourceBundle: 'com.apple.health.watch', sourceName: 'Sam’s Apple Watch', productType: 'Watch7,1' },
          { uuid: 's2', type: 'resting_hr', start: iso(7), end: iso(7), value: 51, sourceBundle: 'com.apple.health.watch', sourceName: 'Sam’s Apple Watch' },
          { uuid: 's3', type: 'hrv', start: iso(6), end: iso(6), value: 99, sourceBundle: 'com.apple.health.watch', sourceName: 'Sam’s Apple Watch' },
        ],
        sleep: [{ uuid: 'z1', start: iso(10), end: iso(9), stage: 'deep', tz: 'America/Denver', sourceBundle: 'com.apple.health.watch', sourceName: 'Sam’s Apple Watch' }],
        deletions: [],
      }),
    });
    expect(sync.status).toBe(200);
    await app.request('/api/apple-health/sync', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${connect.body.token}` }, body: JSON.stringify({ batchId: 'batch-0002', payloadVersion: 1, deletions: [{ uuid: 's3', kind: 'sample' }] }) });

    const res = await me.call('GET', '/api/export');
    expect(res.status).toBe(200);
    const x = res.body;
    expect(x.consentLog.map((e: { kind: string; value: boolean }) => `${e.kind}:${e.value}`)).toEqual(['training:true', 'recall:false', 'apple_health:true']);
    for (const e of x.consentLog) expect(e).toMatchObject({ at: expect.any(String), version: '2026-11' });
    expect(x.health).toMatchObject({ connectedAt: expect.any(String), historyFrom: expect.any(String), devices: [{ name: 'My iPhone', revokedAt: null }] });
    expect(x.health.samples).toEqual([
      { uuid: 's1', type: 'hrv', start: expect.any(String), end: expect.any(String), value: 55, unit: 'ms', userEntered: false, tz: 'America/Denver', source: 'com.apple.health.watch', productType: 'Watch7,1' },
      { uuid: 's2', type: 'resting_hr', start: expect.any(String), end: expect.any(String), value: 51, unit: 'bpm', userEntered: false, tz: null, source: 'com.apple.health.watch', productType: null },
    ]);
    expect(x.health.sleep).toEqual([{ uuid: 'z1', start: expect.any(String), end: expect.any(String), stage: 'deep', tz: 'America/Denver', source: 'com.apple.health.watch', productType: null }]);
    expect(x.settings.sleepGoalMin).toBe(450);
    const text = JSON.stringify(x);
    expect(text).not.toContain(connect.body.token);
    expect(text).not.toContain('tokenHash');
    expect(text).not.toContain('Apple Watch');
    // an account with nothing connected still has the sections, empty
    const other = await signUp(app, 'export2@example.com');
    expect((await other.call('GET', '/api/export')).body).toMatchObject({ consentLog: [], health: { connectedAt: null, devices: [], samples: [], sleep: [] } });
  });
});

describe('POST /import', () => {
  it('never imports consent, the consent log, intros or status: a file cannot say yes for anyone', async () => {
    await me.call('PUT', '/api/me/consent', { training: true, recall: true, reads: true });
    await me.call('PUT', '/api/me/status', { kind: 'sick', until: null });
    await me.call('POST', '/api/me/intros/enroll');
    const file = (await me.call('GET', '/api/export')).body;
    expect(file.settings.consent).toMatchObject({ training: true });

    const fresh = await signUp(app, 'import@example.com');
    const r = await fresh.call('POST', '/api/import', file);
    expect(r.status).toBe(200);
    expect(readConsent(db, fresh.id)).toEqual({ training: false, recall: false, reads: false, health: null, at: null, version: null });
    expect(readConsentLog(db, fresh.id)).toEqual([]);
    expect((await fresh.call('GET', '/api/me')).body.status).toBeNull();
    expect((await fresh.call('GET', '/api/me/intros')).body).toEqual({ seen: null });
    // so the AI gate still holds for the account the file went into
    expect((await fresh.call('PUT', '/api/me/consent', {})).body.consent.at).toBeNull();
    // a hand-made file fares no better
    const crafted = { ...file, settings: { consent: { training: true, recall: true, reads: true, at: '2026-01-01T00:00:00Z', version: 'x' }, consentLog: [{ kind: 'training', value: true, at: 'x', version: 'x' }], recallSent: { date: '2020-01-01', n: -99 }, evil: { a: 1 } } };
    const third = await signUp(app, 'import3@example.com');
    expect((await third.call('POST', '/api/import', crafted)).status).toBe(200);
    expect(readConsent(db, third.id).at).toBeNull();
    expect((await third.call('GET', '/api/export')).body.settings).toEqual({});
  });

  it('imports the settings on the allow-list, each checked', async () => {
    await me.call('PATCH', '/api/morning/settings', { wake: 345 });
    await me.call('POST', '/api/journal/tags', { label: 'Cold plunge' });
    await me.call('PUT', '/api/apple-health/sleep-goal', { sleepGoalMin: 480 });
    const file = (await me.call('GET', '/api/export')).body;

    const fresh = await signUp(app, 'import@example.com');
    expect((await fresh.call('POST', '/api/import', file)).body.imported.settings).toBe(3);
    const got = (await fresh.call('GET', '/api/export')).body.settings;
    expect(Object.keys(got).sort()).toEqual(['journalTags', 'morning', 'sleepGoalMin']);
    expect(got.morning.wake).toBe(345);
    expect(got.journalTags.some((t: { label: string }) => t.label === 'Cold plunge')).toBe(true);
    expect(got.sleepGoalMin).toBe(480);

    // values that do not pass their check are left out, not stored as they came
    const bad = { ...file, settings: { morning: 'not an object', journalTags: [{ id: 'x y', label: '' }], sleepGoalMin: 99999 } };
    const third = await signUp(app, 'import3@example.com');
    expect((await third.call('POST', '/api/import', bad)).status).toBe(200);
    expect((await third.call('GET', '/api/export')).body.settings).toEqual({});
  });
});

describe('migration 0019 (Apple Health narrowed)', () => {
  it('removes readings of types no screen shows and the stored device names, and keeps the three that stay', () => {
    const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'drizzle');
    const sql = fs.readFileSync(path.join(MIGRATIONS, '0019_health_narrow.sql'), 'utf8');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'logbook-mig19-'));
    try {
      const file = path.join(tmp, 'db.sqlite');
      openDatabase(file).sqlite.close();
      const raw = new Database(file);
      const at = new Date().toISOString();
      const sample = raw.prepare('insert into health_samples (user_id, uuid, type, start_at, end_at, value, unit, source_bundle, source_name, user_entered, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)');
      for (const [i, type] of ['hrv', 'resting_hr', 'spo2', 'vo2max', 'body_mass', 'wrist_temp', 'respiratory_rate', 'walking_hr'].entries()) sample.run('u1', `s${i}`, type, at, at, 50, 'x', 'com.apple.health', 'Sam’s Apple Watch', at);
      raw.prepare('insert into sleep_segments (user_id, uuid, start_at, end_at, stage, source_bundle, source_name, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)').run('u1', 'z1', at, at, 'core', 'com.apple.health', 'Sam’s Apple Watch', at);
      raw.prepare('insert into health_days (user_id, date, metric, value, day_start_at, tz, updated_at) values (?, ?, ?, ?, ?, ?, ?)').run('u1', '2026-11-01', 'steps', 4000, at, 'UTC', at);
      raw.prepare('insert into health_workouts (user_id, uuid, activity, start_at, end_at, duration_sec, source_bundle, source_name, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)').run('u1', 'w1', 'running', at, at, 60, 'b', 'n', at);
      for (const stmt of sql.split('--> statement-breakpoint')) raw.exec(stmt);
      expect((raw.prepare('select type from health_samples order by type').all() as Array<{ type: string }>).map((r) => r.type)).toEqual(['hrv', 'resting_hr']);
      expect(raw.prepare('select count(*) n from health_days').get()).toEqual({ n: 0 });
      expect(raw.prepare('select count(*) n from health_workouts').get()).toEqual({ n: 0 });
      expect(raw.prepare('select count(*) n from sleep_segments').get()).toEqual({ n: 1 });
      expect(raw.prepare("select count(*) n from health_samples where source_name <> ''").get()).toEqual({ n: 0 });
      expect(raw.prepare("select count(*) n from sleep_segments where source_name <> ''").get()).toEqual({ n: 0 });
      raw.close();
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
