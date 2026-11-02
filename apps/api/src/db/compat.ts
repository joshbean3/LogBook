import type Database from 'better-sqlite3';

/**
 * Production briefly ran a newer server (the v5 rebuild) before this version was put back. Its migrations are additive
 * except one (`0015_providers`), which this code cannot read:
 * - it moved `strava_accounts` into `provider_connections` and dropped it, so every signed-in request failed with
 *   "no such table: strava_accounts" (the bootstrap reads the Strava status);
 * - it rebuilt `activities` with a required `external_id` and a composite key, so a Strava sync from this code fails.
 *
 * This puts both back in the shape this code knows, carrying every row across (the connection and its tokens, every
 * activity, a Strava activity under its Strava id as before). It runs on every boot after the migrations and does
 * nothing on a database that was never upgraded, or that it has already repaired. The newer tables it does not touch
 * (`provider_connections`, `assistant_threads`, `reminders`, …) are ignored by this code and kept, so nothing is lost.
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
