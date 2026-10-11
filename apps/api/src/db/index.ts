import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../env.js';
import * as schema from './schema.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export const openDatabase = (dbPath = env.DATABASE_PATH) => {
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  const db = drizzle(sqlite, { schema });
  // migrations live next to the built bundle in production and next to src in dev
  const candidates = [path.join(here, 'drizzle'), path.join(here, '..', 'drizzle'), path.join(here, '..', '..', 'drizzle')];
  const folder = candidates.find((p) => fs.existsSync(path.join(p, 'meta', '_journal.json')));
  if (!folder) throw new Error('Migrations folder not found. Run `pnpm db:generate`.');
  migrate(db, { migrationsFolder: folder });
  return { db, sqlite };
};

export type DB = ReturnType<typeof openDatabase>['db'];
export { schema };
