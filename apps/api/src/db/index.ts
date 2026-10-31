import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../env.js';
import { acquireLease, LEASES_DDL, releaseLease } from '../lib/leases.js';
import { log } from '../lib/log.js';
import * as schema from './schema.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export interface OpenOptions {
  /** Run the migrations on open. Default: `RUN_MIGRATIONS !== '0'` (always for `pnpm db:migrate`, which passes true). */
  migrate?: boolean;
}

/**
 * One connection per process. WAL with `synchronous = NORMAL`: a committed write survives a process crash, and the
 * file is never corrupted by a power cut (at worst the last transactions before it are lost: the trade SQLite's own
 * docs recommend for WAL). The autocheckpoint (1000 pages, ~4 MB) plus the worker's PASSIVE checkpoint every five
 * minutes keep the -wal file small under a steady read load; 16 MB of page cache and temp tables in memory keep
 * the big journal and plan queries off the disk.
 */
export const openDatabase = (dbPath = env.DATABASE_PATH, opts: OpenOptions = {}) => {
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('wal_autocheckpoint = 1000');
  sqlite.pragma('cache_size = -16000');
  sqlite.pragma('temp_store = MEMORY');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  const db = drizzle(sqlite, { schema });
  if (opts.migrate ?? env.runMigrations) runMigrations(db, sqlite);
  return { db, sqlite, path: dbPath };
};

export type DB = ReturnType<typeof openDatabase>['db'];
export type SqliteHandle = Database.Database;
export { schema };

/** Where the migrations are: next to the built bundle in production, next to src in dev. */
export const migrationsFolder = (): string => {
  const candidates = [path.join(here, 'drizzle'), path.join(here, '..', 'drizzle'), path.join(here, '..', '..', 'drizzle')];
  const folder = candidates.find((p) => fs.existsSync(path.join(p, 'meta', '_journal.json')));
  if (!folder) throw new Error('Migrations folder not found. Run `pnpm db:generate`.');
  return folder;
};

const sleep = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const MIGRATION_LEASE_MS = 10 * 60_000;
const MIGRATION_WAIT_MS = 2 * 60_000;

/**
 * Apply the pending migrations under the `migrations` lease, so the API and the worker booting together apply them
 * once, in order: the second waits (up to two minutes) and then finds nothing to do. The leases table itself is
 * created here, idempotently, because it is older than the migration that declares it.
 */
export const runMigrations = (db: DB, sqlite: Database.Database) => {
  const folder = migrationsFolder();
  sqlite.exec(LEASES_DDL);
  const deadline = Date.now() + MIGRATION_WAIT_MS;
  let waited = false;
  while (!acquireLease(db, 'migrations', MIGRATION_LEASE_MS)) {
    if (Date.now() > deadline) throw new Error('Another process has held the migration lease for two minutes; giving up. If it died, delete the `migrations` row from `leases`.');
    if (!waited) log.info('waiting for the migration lease held by another process');
    waited = true;
    sleep(250);
  }
  try {
    migrate(db, { migrationsFolder: folder });
  } finally {
    releaseLease(db, 'migrations');
  }
};

export interface CheckpointResult {
  /** 1 when a reader or writer kept the checkpoint from finishing (PASSIVE never waits). */
  busy: number;
  /** Frames in the WAL before the checkpoint. */
  log: number;
  /** Frames written back into the main file. */
  checkpointed: number;
}

/** `PRAGMA wal_checkpoint(PASSIVE)`: write what the WAL holds back into the file without blocking anyone. The worker runs it every five minutes. */
export const checkpointPassive = (sqlite: Database.Database): CheckpointResult => {
  const rows = sqlite.pragma('wal_checkpoint(PASSIVE)') as CheckpointResult[];
  return rows[0] ?? { busy: 0, log: 0, checkpointed: 0 };
};

const sizeOf = (p: string): number => {
  try {
    return fs.statSync(p).size;
  } catch {
    return 0;
  }
};
/** Bytes in the -wal file next to the database (0 for :memory: or when there is none). */
export const walBytes = (dbPath: string): number => (dbPath === ':memory:' ? 0 : sizeOf(`${dbPath}-wal`));
/** Bytes of the database file itself. */
export const dbFileBytes = (dbPath: string): number => (dbPath === ':memory:' ? 0 : sizeOf(dbPath));
