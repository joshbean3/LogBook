import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase } from './index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const drizzleDir = path.join(here, '..', '..', 'drizzle');
const tmp: string[] = [];
afterEach(() => {
  for (const d of tmp.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

/** A migrations folder holding only the migrations up to `lastIdx`: the database production has before this deploy. */
const folderUpTo = (lastIdx: number) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lb-mig-'));
  tmp.push(dir);
  fs.mkdirSync(path.join(dir, 'meta'));
  const journal = JSON.parse(fs.readFileSync(path.join(drizzleDir, 'meta', '_journal.json'), 'utf8')) as { entries: Array<{ idx: number; tag: string }> };
  const entries = journal.entries.filter((e) => e.idx <= lastIdx);
  fs.writeFileSync(path.join(dir, 'meta', '_journal.json'), JSON.stringify({ ...journal, entries }));
  for (const e of entries) fs.copyFileSync(path.join(drizzleDir, `${e.tag}.sql`), path.join(dir, `${e.tag}.sql`));
  return dir;
};

const tableNames = (sqlite: Database.Database) => (sqlite.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as Array<{ name: string }>).map((r) => r.name);

describe('the first boot of this version on the production database', () => {
  it('keeps the Strava connection a newer server moved, drops the leftover tables, keeps habit checks of the owner and hashes sessions', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lb-db-'));
    tmp.push(dir);
    const file = path.join(dir, 'prod.db');
    // production today: this code's migrations up to 0017, a past upgrade by a newer server (provider_connections and its
    // other tables), and a session stored under its plain cookie value
    const before = new Database(file);
    migrate(drizzle(before), { migrationsFolder: folderUpTo(17) });
    before.exec(`
      INSERT INTO users (id, email, password_hash, created_at) VALUES ('u1', 'a@example.com', 'scrypt$x', '2026-01-01T00:00:00Z'), ('u2', 'b@example.com', 'scrypt$x', '2026-01-01T00:00:00Z');
      INSERT INTO habits (id, user_id, name, created_on) VALUES ('h1', 'u1', 'Read', '2026-01-01');
      INSERT INTO habit_checks (habit_id, user_id, date, done, updated_at) VALUES ('h1', 'u1', '2026-11-01', 1, '2026-11-01T00:00:00Z'), ('h1', 'u2', '2026-11-02', 1, '2026-11-02T00:00:00Z');
      INSERT INTO auth_sessions (id, user_id, created_at, expires_at) VALUES ('abcdefghijklmnopqrstuvwxyz012345', 'u1', '2026-11-01T00:00:00Z', '2099-01-01T00:00:00Z');
      CREATE TABLE provider_connections (user_id text NOT NULL, provider text NOT NULL, external_athlete_id text NOT NULL, athlete_name text,
        access_token text NOT NULL, refresh_token text NOT NULL, expires_at integer NOT NULL, scope text, cursor text, last_sync_at text,
        last_error text, status text DEFAULT 'ok' NOT NULL, connected_at text NOT NULL, PRIMARY KEY(user_id, provider));
      INSERT INTO provider_connections (user_id, provider, external_athlete_id, athlete_name, access_token, refresh_token, expires_at, scope, connected_at)
        VALUES ('u1', 'strava', '4242', 'A', 'acc', 'ref', 4102444800, 'read', '2026-10-01T00:00:00Z');
      DROP TABLE strava_accounts;
      CREATE TABLE assistant_threads (id text PRIMARY KEY, user_id text, title text);
      CREATE TABLE user_memory (id text PRIMARY KEY, user_id text, text text);
      CREATE TABLE reminders (id text PRIMARY KEY, user_id text);`);
    before.close();

    const { sqlite } = openDatabase(file);
    try {
      const names = tableNames(sqlite);
      for (const gone of ['provider_connections', 'assistant_threads', 'user_memory', 'reminders']) expect(names).not.toContain(gone);
      expect(names).toEqual(expect.arrayContaining(['strava_accounts', 'audit_log', 'auth_tokens', 'auth_throttle']));
      expect(sqlite.prepare('SELECT user_id, athlete_id, access_token FROM strava_accounts').all()).toEqual([{ user_id: 'u1', athlete_id: '4242', access_token: 'acc' }]);
      // the check u2 wrote under u1's habit is gone; u1's own stays
      expect(sqlite.prepare('SELECT user_id, date FROM habit_checks ORDER BY date').all()).toEqual([{ user_id: 'u1', date: '2026-11-01' }]);
      const sessions = sqlite.prepare('SELECT id FROM auth_sessions').all() as Array<{ id: string }>;
      expect(sessions).toHaveLength(1);
      expect(sessions[0]!.id).toMatch(/^[0-9a-f]{64}$/);
      const cols = (sqlite.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>).map((c) => c.name);
      expect(cols).toContain('email_verified_at');
    } finally {
      sqlite.close();
    }
    // a second boot changes nothing and does not fail
    const again = openDatabase(file);
    expect((again.sqlite.prepare('SELECT count(*) AS n FROM strava_accounts').get() as { n: number }).n).toBe(1);
    again.sqlite.close();
  });
});
