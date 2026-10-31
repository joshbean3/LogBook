import { eq, sql } from 'drizzle-orm';
import os from 'node:os';
import type { DB } from '../db/index.js';
import { leases } from '../db/schema.js';
import { uid } from './util.js';

/**
 * Advisory leases in the database, so the API and the worker (two processes on one SQLite file) never run the same
 * job at once, and two booting processes never race the migrations. A lease is a row: name, who holds it, when it
 * expires (ms). Taking one is a single upsert whose WHERE lets it through only when the row is expired or already
 * mine, so there is no read-then-write window. A holder that dies simply lets its lease expire.
 */

/** This process, as the holder column shows it: host, pid and a nonce (two processes on one host stay apart). */
export const HOLDER = `${os.hostname()}:${process.pid}:${uid('', 6)}`;

/** The table, as migration 0017 creates it; db/index.ts runs this first so the migrations can take the `migrations` lease. */
export const LEASES_DDL = 'CREATE TABLE IF NOT EXISTS `leases` (`name` text PRIMARY KEY NOT NULL, `holder` text NOT NULL, `expires_at` integer NOT NULL)';

export const acquireLease = (db: DB, name: string, ttlMs: number, holder = HOLDER, now = Date.now()): boolean => {
  const r = db.run(
    sql`INSERT INTO leases (name, holder, expires_at) VALUES (${name}, ${holder}, ${now + ttlMs})
        ON CONFLICT(name) DO UPDATE SET holder = excluded.holder, expires_at = excluded.expires_at
        WHERE leases.expires_at <= ${now} OR leases.holder = excluded.holder`,
  );
  return r.changes > 0;
};

/** Push my lease's expiry out; false when it is not mine any more (it expired and someone else took it). */
export const renewLease = (db: DB, name: string, ttlMs: number, holder = HOLDER, now = Date.now()): boolean => {
  const r = db.run(sql`UPDATE leases SET expires_at = ${now + ttlMs} WHERE name = ${name} AND holder = ${holder} AND expires_at > ${now}`);
  return r.changes > 0;
};

/** Give a lease up early. Only the holder's row goes. */
export const releaseLease = (db: DB, name: string, holder = HOLDER): boolean => db.run(sql`DELETE FROM leases WHERE name = ${name} AND holder = ${holder}`).changes > 0;

export const leaseOf = (db: DB, name: string) => db.select().from(leases).where(eq(leases.name, name)).get() ?? null;

/** Rows whose expiry is older than `olderThanMs`: housekeeping for the ops purge. */
export const purgeExpiredLeases = (db: DB, olderThanMs = 24 * 3600_000, now = Date.now()) => db.run(sql`DELETE FROM leases WHERE expires_at < ${now - olderThanMs}`).changes;

/**
 * Run `fn` under a lease: `{ ran: false }` when another process holds it. `keep` leaves the lease held afterwards
 * (a periodic job keeps its lease until the next period, so a second process cannot run it in between); otherwise
 * it is released on the way out.
 */
export const withLease = <T>(db: DB, name: string, ttlMs: number, fn: () => T, opts: { keep?: boolean; holder?: string } = {}): { ran: true; result: T } | { ran: false } => {
  const holder = opts.holder ?? HOLDER;
  if (!acquireLease(db, name, ttlMs, holder)) return { ran: false };
  let keep = opts.keep ?? false;
  try {
    const result = fn();
    if (result instanceof Promise) {
      keep = true; // async callers release themselves (see jobs.ts); never release under a promise still running
      return { ran: true, result: result.finally(() => (opts.keep ? undefined : releaseLease(db, name, holder))) as T };
    }
    return { ran: true, result };
  } finally {
    if (!keep) releaseLease(db, name, holder);
  }
};
