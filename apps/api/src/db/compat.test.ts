import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { repairAfterNewerVersion } from './compat.js';
import { openDatabase } from './index.js';
import { activities, stravaAccounts } from './schema.js';

/** What the newer server's 0015_providers did to a database of this version (its destructive part, verbatim in effect). */
const upgradeLikeV5 = (sqlite: ReturnType<typeof openDatabase>['sqlite']) => {
  sqlite.exec(`
    CREATE TABLE provider_connections (user_id text NOT NULL, provider text NOT NULL, external_athlete_id text NOT NULL, athlete_name text,
      access_token text NOT NULL, refresh_token text NOT NULL, expires_at integer NOT NULL, scope text, cursor text, last_sync_at text,
      last_error text, status text DEFAULT 'ok' NOT NULL, connected_at text NOT NULL, PRIMARY KEY(user_id, provider));
    INSERT INTO provider_connections (user_id, provider, external_athlete_id, athlete_name, access_token, refresh_token, expires_at, scope, connected_at)
      SELECT user_id, 'strava', athlete_id, athlete_name, access_token, refresh_token, expires_at, scope, created_at FROM strava_accounts;
    DROP TABLE strava_accounts;
    CREATE TABLE activities_new (id text NOT NULL, user_id text NOT NULL, provider text DEFAULT 'strava' NOT NULL, external_id text NOT NULL,
      date text NOT NULL, time text, name text NOT NULL, sport_type text NOT NULL, kind text NOT NULL, distance_m real DEFAULT 0 NOT NULL,
      moving_sec integer DEFAULT 0 NOT NULL, elapsed_sec integer DEFAULT 0 NOT NULL, elev_m real DEFAULT 0 NOT NULL, avg_hr integer, max_hr integer,
      cadence integer, laps_json text, perf_at text, perf_failed integer DEFAULT 0 NOT NULL, perf_failed_at text, polyline text, duplicate_of text,
      deleted_at text, updated_at text NOT NULL, PRIMARY KEY(user_id, provider, external_id));
    INSERT INTO activities_new (id, user_id, provider, external_id, date, time, name, sport_type, kind, distance_m, moving_sec, elapsed_sec, elev_m, perf_failed, polyline, deleted_at, updated_at)
      SELECT id, user_id, 'strava', id, date, time, name, sport_type, kind, distance_m, moving_sec, elapsed_sec, elev_m, perf_failed, polyline, deleted_at, updated_at FROM activities;
    DROP TABLE activities;
    ALTER TABLE activities_new RENAME TO activities;
    CREATE UNIQUE INDEX activities_id ON activities (id);
    CREATE INDEX activities_user_date ON activities (user_id, date);`);
};

const run = (id: string, name: string) => ({ id, userId: 'u1', date: '2026-10-30', time: '07:02', name, sportType: 'Run', kind: 'run', distanceM: 8046, movingSec: 2400, elapsedSec: 2450, elevM: 30, avgHr: 150, maxHr: 170, cadence: 174, lapsJson: null, perfAt: null, perfFailed: 0, polyline: '_p~iF~ps|U', deletedAt: null, updatedAt: '2026-10-30T08:00:00Z' });

describe('a database a newer server upgraded, read by this version', () => {
  it('does nothing to a database this version made', () => {
    const { sqlite } = openDatabase(':memory:');
    expect(repairAfterNewerVersion(sqlite)).toEqual([]);
  });

  it('puts back the Strava connection and the activities, every row, and this code reads and writes them again', () => {
    const { db, sqlite } = openDatabase(':memory:');
    db.insert(stravaAccounts).values({ userId: 'u1', athleteId: '4242', athleteName: 'Josh B', accessToken: 'acc', refreshToken: 'ref', expiresAt: 4102444800, scope: 'read', connectedAt: '2026-10-01T00:00:00Z', lastSyncAt: null, lastError: null }).run();
    db.insert(activities).values([run('13000000001', 'Morning Run'), { ...run('13000000002', 'Tempo'), deletedAt: '2026-10-31T00:00:00Z' }]).run();
    upgradeLikeV5(sqlite);
    // a run another provider recorded too, marked as its duplicate: it stays out
    sqlite.exec(`INSERT INTO activities (id, user_id, provider, external_id, date, name, sport_type, kind, updated_at, duplicate_of) VALUES ('c1', 'u1', 'coros', 'c-77', '2026-10-30', 'Morning Run', 'Run', 'run', '2026-10-30T08:00:00Z', '13000000001')`);
    expect(() => db.select().from(stravaAccounts).all()).toThrow(/no such table: strava_accounts/);

    const done = repairAfterNewerVersion(sqlite);
    expect(done).toEqual(['strava_accounts recreated (1 connection carried back)', "activities rebuilt in this version's shape (2 kept)"]);

    expect(db.select().from(stravaAccounts).where(eq(stravaAccounts.userId, 'u1')).get()).toMatchObject({ athleteId: '4242', athleteName: 'Josh B', accessToken: 'acc', refreshToken: 'ref', connectedAt: '2026-10-01T00:00:00Z' });
    const rows = db.select().from(activities).all();
    expect(rows.map((r) => [r.id, r.name, !!r.polyline, !!r.deletedAt])).toEqual([
      ['13000000001', 'Morning Run', true, false],
      ['13000000002', 'Tempo', true, true],
    ]);
    // this version's Strava sync writes by the Strava id, with no provider columns
    db.insert(activities).values(run('13000000003', 'Long Run')).run();
    db.insert(activities).values({ ...run('13000000001', 'Morning Run (edited)') }).onConflictDoUpdate({ target: activities.id, set: { name: 'Morning Run (edited)' } }).run();
    expect(db.select().from(activities).all().map((r) => r.name)).toEqual(['Morning Run (edited)', 'Tempo', 'Long Run']);

    // once repaired, every later boot leaves it alone
    expect(repairAfterNewerVersion(sqlite)).toEqual([]);
  });
});
