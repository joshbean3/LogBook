import { sql } from 'drizzle-orm';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type DB, type SqliteHandle } from '../../db/index.js';
import { jobRuns } from '../../db/schema.js';
import { acquireLease, leaseOf } from '../../lib/leases.js';
import { setLogSink } from '../../lib/log.js';
import { backupNow, pruneBackups } from './backup.js';
import { dailyDue, defaultJobs, purgeOps, runJob, startJobs, type Job, type JobContext } from './jobs.js';

let db: DB;
let sqlite: SqliteHandle;
let ctx: JobContext;
let lines: string[];
let restore: (l: string) => void;

beforeEach(() => {
  const o = openDatabase(':memory:');
  db = o.db;
  sqlite = o.sqlite;
  ctx = { db, sqlite, dbPath: ':memory:' };
  lines = [];
  restore = setLogSink((l) => lines.push(l));
});
afterEach(() => setLogSink(restore));

const runs = () => db.select().from(jobRuns).all();

describe('runJob', () => {
  it('records a run with its meta, and holds the lease afterwards', async () => {
    const job: Job = { name: 'hello', everyMs: 60_000, run: () => ({ did: 3 }) };
    const t0 = new Date('2026-10-31T10:00:00Z');
    expect(await runJob(ctx, job, t0, 'me')).toBe('ran');
    const [r] = runs();
    expect(r).toMatchObject({ name: 'hello', ok: 1, error: null, startedAt: '2026-10-31T10:00:00.000Z' });
    expect(JSON.parse(r!.meta!)).toMatchObject({ did: 3 });
    expect(r!.finishedAt).toBeTruthy();
    expect(leaseOf(db, 'job:hello')?.holder).toBe('me');
    // another process on the same file, a minute later: held (the lease lasts 1.5 periods)
    expect(await runJob(ctx, job, new Date(t0.getTime() + 60_000), 'other')).toBe('skipped');
    expect(runs()).toHaveLength(1);
    // the holder died: after the lease, the other takes over
    expect(await runJob(ctx, job, new Date(t0.getTime() + 91_000), 'other')).toBe('ran');
    expect(leaseOf(db, 'job:hello')?.holder).toBe('other');
  });

  it('a failure is recorded with its error and reported, and the job stays runnable', async () => {
    let n = 0;
    const job: Job = {
      name: 'flaky',
      everyMs: 60_000,
      run: () => {
        if (n++ === 0) throw new Error('boom');
        return { ok: true };
      },
    };
    expect(await runJob(ctx, job, new Date(), 'me')).toBe('failed');
    expect(runs()[0]).toMatchObject({ ok: 0, error: 'boom' });
    expect(lines.some((l) => l.includes('boom') && l.includes('flaky'))).toBe(true);
    expect(await runJob(ctx, job, new Date(), 'me')).toBe('ran');
    expect(runs().map((r) => r.ok)).toEqual([0, 1]);
  });

  it('a quiet job leaves no row when it did nothing', async () => {
    const job: Job = { name: 'q', everyMs: 60_000, quiet: true, run: () => null };
    expect(await runJob(ctx, job, new Date(), 'me')).toBe('ran');
    expect(runs()).toHaveLength(0);
    const loud: Job = { ...job, run: () => ({ sent: 1 }) };
    await runJob(ctx, loud, new Date(), 'me');
    expect(runs()).toHaveLength(1);
  });

  it('a disabled job does not run', async () => {
    expect(await runJob(ctx, { name: 'd', everyMs: 1, enabled: () => false, run: () => ({}) })).toBe('disabled');
  });

  it('a daily job runs once a day from its hour, whichever process ticks, and catches up after downtime', async () => {
    const job: Job = { name: 'daily', everyMs: 60_000, dailyAtUtcHour: 3, leaseMs: 3600_000, run: () => ({ done: true }) };
    expect(dailyDue(db, job, new Date('2026-10-31T02:59:00Z'))).toBe(false);
    expect(await runJob(ctx, job, new Date('2026-10-31T02:59:00Z'), 'a')).toBe('not_due');
    expect(await runJob(ctx, job, new Date('2026-10-31T03:00:30Z'), 'a')).toBe('ran');
    // same day, other process: not due (the table says it ran), not merely lease-held
    expect(await runJob(ctx, job, new Date('2026-10-31T09:00:00Z'), 'b')).toBe('not_due');
    // next day, the process was down at 03:00 and comes back at 11:00: it runs then (a's hour-long lease is long gone)
    expect(await runJob(ctx, job, new Date('2026-11-01T11:00:00Z'), 'b')).toBe('ran');
    expect(leaseOf(db, 'job:daily')?.holder).toBe('b');
    expect(runs().map((r) => r.startedAt.slice(0, 10))).toEqual(['2026-10-31', '2026-11-01']);
  });
});

describe('the default jobs', () => {
  it('are the seven families, and each runs against an in-memory database', async () => {
    const jobs = defaultJobs();
    expect(jobs.map((j) => j.name)).toEqual(['reminders', 'provider-sync', 'session-purge', 'wal-checkpoint', 'nightly-backup', 'idempotency-purge', 'ops-purge']);
    for (const job of jobs) {
      const r = await runJob(ctx, job, new Date('2026-10-31T04:00:00Z'), 'me');
      expect(['ran', 'disabled', 'not_due']).toContain(r);
    }
    expect(runs().every((r) => r.ok === 1)).toBe(true);
  });

  it('purgeOps drops job runs older than 14 days', () => {
    const old = new Date(Date.now() - 15 * 24 * 3600_000).toISOString();
    db.insert(jobRuns).values({ id: 'old', name: 'x', startedAt: old, finishedAt: old, ok: 1 }).run();
    db.insert(jobRuns).values({ id: 'new', name: 'x', startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), ok: 1 }).run();
    expect(purgeOps(db)).toMatchObject({ jobRuns: 1 });
    expect(runs().map((r) => r.id)).toEqual(['new']);
  });
});

describe('startJobs', () => {
  it('ticks on the timers and stops cleanly', async () => {
    let n = 0;
    const jobs = startJobs(ctx, [{ name: 'tick', everyMs: 30, initialDelayMs: 1, run: () => ({ n: ++n }) }]);
    await new Promise((r) => setTimeout(r, 120));
    await jobs.stop();
    const seen = n;
    expect(seen).toBeGreaterThanOrEqual(2);
    await new Promise((r) => setTimeout(r, 80));
    expect(n).toBe(seen);
    expect(runs().length).toBe(seen);
  });
});

describe('backups', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logbook-backup-'));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('VACUUM INTO writes a copy that opens, and the prune keeps seven', () => {
    db.run(sql`INSERT INTO leases (name, holder, expires_at) VALUES ('probe', 'x', 1)`);
    const r = backupNow(sqlite, dir, '2026-10-31');
    expect(r.file).toBe(path.join(dir, 'logbook-2026-10-31.db'));
    expect(r.bytes).toBeGreaterThan(0);
    const copy = openDatabase(r.file, { migrate: false });
    expect(copy.sqlite.prepare('SELECT holder FROM leases WHERE name = ?').get('probe')).toEqual({ holder: 'x' });
    expect(copy.sqlite.pragma('integrity_check', { simple: true })).toBe('ok');
    copy.sqlite.close();
    for (let d = 1; d <= 9; d++) fs.writeFileSync(path.join(dir, `logbook-2026-10-${String(d).padStart(2, '0')}.db`), '');
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'keep me');
    const removed = pruneBackups(dir, 7);
    expect(removed).toEqual(['logbook-2026-10-03.db', 'logbook-2026-10-02.db', 'logbook-2026-10-01.db']);
    expect(fs.readdirSync(dir).sort()).toEqual(['logbook-2026-10-04.db', 'logbook-2026-10-05.db', 'logbook-2026-10-06.db', 'logbook-2026-10-07.db', 'logbook-2026-10-08.db', 'logbook-2026-10-09.db', 'logbook-2026-10-31.db', 'notes.txt']);
  });

  it('a backup that was written again the same day replaces the earlier one', () => {
    backupNow(sqlite, dir, '2026-10-31');
    acquireLease(db, 'later', 1000, 'y');
    backupNow(sqlite, dir, '2026-10-31');
    const copy = openDatabase(path.join(dir, 'logbook-2026-10-31.db'), { migrate: false });
    expect(copy.sqlite.prepare('SELECT count(*) AS n FROM leases').get()).toEqual({ n: 1 });
    copy.sqlite.close();
    expect(fs.readdirSync(dir)).toEqual(['logbook-2026-10-31.db']);
  });
});
