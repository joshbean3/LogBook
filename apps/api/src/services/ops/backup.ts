import fs from 'node:fs';
import path from 'node:path';
import type { SqliteHandle } from '../../db/index.js';
import { env } from '../../env.js';
import { log } from '../../lib/log.js';

/**
 * The nightly logical backup: `VACUUM INTO` writes a compact, consistent copy of the live database while the app
 * keeps running (it reads through the same connection, so it sees one transaction's worth of state). Litestream
 * is the continuous copy; these files are the one you can open with any sqlite3 and the one `scripts/restore.sh`
 * takes. Seven are kept.
 */

export const backupDirFor = (dbPath: string): string => env.BACKUP_DIR ?? path.join(path.dirname(path.resolve(dbPath)), 'backups');

export const backupFileName = (date: string) => `logbook-${date}.db`;
const BACKUP_RE = /^logbook-\d{4}-\d{2}-\d{2}\.db$/;

export interface BackupResult {
  file: string;
  bytes: number;
}

/** Write `<dir>/logbook-<date>.db` from the open database (through a temp file, so a crash never leaves a half copy). */
export const backupNow = (sqlite: SqliteHandle, dir: string, date = new Date().toISOString().slice(0, 10)): BackupResult => {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, backupFileName(date));
  const tmp = `${file}.tmp`;
  fs.rmSync(tmp, { force: true });
  sqlite.prepare('VACUUM INTO ?').run(tmp);
  fs.renameSync(tmp, file);
  return { file, bytes: fs.statSync(file).size };
};

/** Keep the newest `keep` dated copies (by name, which is by date); return what was removed. */
export const pruneBackups = (dir: string, keep = env.BACKUP_KEEP): string[] => {
  let names: string[];
  try {
    names = fs.readdirSync(dir).filter((n) => BACKUP_RE.test(n));
  } catch {
    return [];
  }
  names.sort().reverse();
  const removed = names.slice(Math.max(0, keep));
  for (const n of removed) fs.rmSync(path.join(dir, n), { force: true });
  return removed;
};

/** The job: a copy for today, then the prune. Nothing for an in-memory database. */
export const nightlyBackup = (sqlite: SqliteHandle, dbPath: string, now = new Date()) => {
  if (dbPath === ':memory:') return null;
  const dir = backupDirFor(dbPath);
  const r = backupNow(sqlite, dir, now.toISOString().slice(0, 10));
  const removed = pruneBackups(dir);
  log.info('backup written', { file: r.file, bytes: r.bytes, removed });
  return { ...r, removed };
};
