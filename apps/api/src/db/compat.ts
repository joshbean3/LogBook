import type Database from 'better-sqlite3';
import { createHash } from 'node:crypto';

/**
 * Production briefly ran a newer server (the v5 rebuild) before this version was put back. Its migrations are additive
 * except one (`0015_providers`), which this code cannot read:
 * - it moved `strava_accounts` into `provider_connections` and dropped it, so every signed-in request failed with
 *   "no such table: strava_accounts" (the bootstrap reads the Strava status);
 * - it rebuilt `activities` with a required `external_id` and a composite key, so a Strava sync from this code fails.
 *
 * This puts both back in the shape this code knows, carrying every row across (the connection and its tokens, every
 * activity, a Strava activity under its Strava id as before). It runs on every boot after the migrations and does
 * nothing on a database that was never upgraded, or that it has already repaired.
 *
 * The newer version's other tables (`provider_connections`, `assistant_threads`, `reminders`, …) are dropped by
 * migration 0020. On a database that still has `provider_connections` this repair therefore also runs before the
 * migrations (db/index.ts), so the Strava connection is carried back before its old home goes.
 */
export const repairAfterNewerVersion = (sqlite: Database.Database): string[] => {
  const hasTable = (t: string) => !!sqlite.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`).get(t);
  const columns = (t: string) => (sqlite.prepare(`PRAGMA table_info(${t})`).all() as Array<{ name: string }>).map((c) => c.name);
  const done: string[] = [];

  sqlite.transaction(() => {
    if (!hasTable('strava_accounts')) {
      sqlite.exec(`CREATE TABLE \`strava_accounts\` (
        \`user_id\` text PRIMARY KEY NOT NULL,
        \`athlete_id\` text NOT NULL,
        \`athlete_name\` text,
        \`access_token\` text NOT NULL,
        \`refresh_token\` text NOT NULL,
        \`expires_at\` integer NOT NULL,
        \`scope\` text,
        \`created_at\` text NOT NULL,
        \`last_sync_at\` text,
        \`last_error\` text
      )`);
      let copied = 0;
      if (hasTable('provider_connections')) {
        copied = sqlite
          .prepare(
            `INSERT OR IGNORE INTO strava_accounts (user_id, athlete_id, athlete_name, access_token, refresh_token, expires_at, scope, created_at, last_sync_at, last_error)
             SELECT user_id, external_athlete_id, athlete_name, access_token, refresh_token, expires_at, scope, connected_at, last_sync_at, last_error
             FROM provider_connections WHERE provider = 'strava'`,
          )
          .run().changes;
      }
      done.push(`strava_accounts recreated (${copied} connection${copied === 1 ? '' : 's'} carried back)`);
    }

    const cols = hasTable('activities') ? columns('activities') : [];
    if (cols.includes('external_id')) {
      sqlite.exec(`CREATE TABLE \`activities_compat\` (
        \`id\` text PRIMARY KEY NOT NULL,
        \`user_id\` text NOT NULL,
        \`date\` text NOT NULL,
        \`time\` text,
        \`name\` text NOT NULL,
        \`sport_type\` text NOT NULL,
        \`kind\` text NOT NULL,
        \`distance_m\` real DEFAULT 0 NOT NULL,
        \`moving_sec\` integer DEFAULT 0 NOT NULL,
        \`elapsed_sec\` integer DEFAULT 0 NOT NULL,
        \`elev_m\` real DEFAULT 0 NOT NULL,
        \`avg_hr\` integer,
        \`max_hr\` integer,
        \`cadence\` integer,
        \`laps_json\` text,
        \`perf_at\` text,
        \`perf_failed\` integer DEFAULT 0 NOT NULL,
        \`deleted_at\` text,
        \`updated_at\` text NOT NULL,
        \`polyline\` text
      )`);
      // a Strava activity goes back under its Strava id (this code syncs by it); a row another provider also recorded
      // (`duplicate_of`) stays out, so a run counts once
      const dup = cols.includes('duplicate_of') ? 'WHERE duplicate_of IS NULL' : '';
      const kept = sqlite
        .prepare(
          `INSERT OR IGNORE INTO activities_compat (id, user_id, date, time, name, sport_type, kind, distance_m, moving_sec, elapsed_sec, elev_m, avg_hr, max_hr, cadence, laps_json, perf_at, perf_failed, deleted_at, updated_at, polyline)
           SELECT CASE WHEN provider = 'strava' THEN external_id ELSE id END, user_id, date, time, name, sport_type, kind, distance_m, moving_sec, elapsed_sec, elev_m, avg_hr, max_hr, cadence, laps_json, perf_at, perf_failed, deleted_at, updated_at, polyline
           FROM activities ${dup}`,
        )
        .run().changes;
      sqlite.exec('DROP TABLE `activities`');
      sqlite.exec('ALTER TABLE `activities_compat` RENAME TO `activities`');
      sqlite.exec('CREATE INDEX IF NOT EXISTS `activities_user_date` ON `activities` (`user_id`, `date`)');
      done.push(`activities rebuilt in this version's shape (${kept} kept)`);
    }
  })();

  return done;
};

/**
 * Columns this code needs that a migration cannot add safely, because production may already have them from the newer
 * version: SQLite has no "add column if missing", and a plain ADD on a database that has the column stops the boot.
 * Each is added only when absent. Runs on every boot after the migrations.
 */
const ENSURED_COLUMNS: Array<{ table: string; column: string; type: string }> = [{ table: 'users', column: 'email_verified_at', type: 'text' }];
export const ensureColumns = (sqlite: Database.Database): string[] => {
  const done: string[] = [];
  for (const { table, column, type } of ENSURED_COLUMNS) {
    const cols = (sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((c) => c.name);
    if (!cols.length || cols.includes(column)) continue;
    sqlite.exec(`ALTER TABLE \`${table}\` ADD \`${column}\` ${type}`);
    done.push(`${table}.${column} added`);
  }
  return done;
};

/**
 * Sessions used to be stored under the cookie value itself. They are now stored under its SHA-256, so a copy of the
 * table signs nobody in. This rewrites any row still under a plain value (a 32-character id; a hash is 64 hex
 * characters), so nobody is signed out by the change. Runs on every boot; does nothing once done.
 */
export const hashLegacySessionIds = (sqlite: Database.Database): number => {
  const rows = sqlite.prepare(`SELECT id FROM auth_sessions WHERE length(id) <> 64 OR id GLOB '*[^0-9a-f]*'`).all() as Array<{ id: string }>;
  if (!rows.length) return 0;
  const set = sqlite.prepare('UPDATE OR REPLACE auth_sessions SET id = ? WHERE id = ?');
  sqlite.transaction(() => {
    for (const r of rows) set.run(createHash('sha256').update(r.id).digest('hex'), r.id);
  })();
  return rows.length;
};

/** The tables of this database that the schema does not know (kept by nothing, read by nothing). For `ops tables`. */
export const unknownTables = (sqlite: Database.Database, known: string[]): string[] => {
  const all = (sqlite.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_\\_%' ESCAPE '\\'`).all() as Array<{ name: string }>).map((r) => r.name);
  const have = new Set(known);
  return all.filter((t) => !have.has(t)).sort();
};
