import { and, eq, isNotNull, lt, sql } from 'drizzle-orm';
import { purgeExpiredSessions } from '../../auth.js';
import { checkpointPassive, type DB, type SqliteHandle } from '../../db/index.js';
import { idempotencyKeys, jobRuns } from '../../db/schema.js';
import { env } from '../../env.js';
import { acquireLease, HOLDER, purgeExpiredLeases } from '../../lib/leases.js';
import { log } from '../../lib/log.js';
import { purgeRateLimits } from '../../lib/ratelimit.js';
import { IDEMPOTENCY_TTL_MS } from '../../lib/requests.js';
import { nowISO, uid } from '../../lib/util.js';
import { syncAllConnections } from '../providers/index.js';
import { schedulerTick } from '../reminders.js';
import { nightlyBackup } from './backup.js';
import { reportError } from './errors.js';

/**
 * The background jobs, run by whichever process has RUN_JOBS for them (the API inline, or dist/worker.js). Each job
 * ticks on its own timer and runs under the lease `job:<name>`: the holder renews it every tick and keeps it a
 * little longer than the period, so a second process on the same file sees it held and skips, and takes over
 * within about one period if the holder dies. Every run is a row in `job_runs` (quiet jobs only when they did
 * something or failed); a failure is reported (`reportError`) and the next tick tries again.
 */

export interface JobContext {
  db: DB;
  sqlite: SqliteHandle;
  dbPath: string;
}
export type JobMeta = Record<string, unknown>;

export interface Job {
  name: string;
  /** How often the timer ticks. */
  everyMs: number;
  /** Daily job: it ticks every `everyMs` and runs once a day, the first tick at or after this UTC hour. */
  dailyAtUtcHour?: number;
  initialDelayMs?: number;
  /** How long the lease is held past a tick. Default: 1.5 × `everyMs`, at least 30 s. */
  leaseMs?: number;
  /** Record a run only when it returns something or fails. */
  quiet?: boolean;
  enabled?: () => boolean;
  run: (ctx: JobContext, now: Date) => Promise<JobMeta | null | void> | JobMeta | null | void;
}

export const JOB_RUNS_KEEP_MS = 14 * 24 * 3600_000;
const H = 3600_000;

export const leaseNameOf = (job: Pick<Job, 'name'>) => `job:${job.name}`;
export const leaseMsOf = (job: Pick<Job, 'everyMs' | 'leaseMs'>) => job.leaseMs ?? Math.max(30_000, Math.round(job.everyMs * 1.5));

/** The UTC date of the job's last run that finished well, if any. */
export const lastSuccessDate = (db: DB, name: string): string | null => {
  const row = db.select({ at: sql<string | null>`max(${jobRuns.finishedAt})` }).from(jobRuns).where(and(eq(jobRuns.name, name), eq(jobRuns.ok, 1), isNotNull(jobRuns.finishedAt))).get();
  return row?.at ? row.at.slice(0, 10) : null;
};

/** Is a daily job due now: at or past its hour, and not yet run today (UTC)? Independent of which process ran it. */
export const dailyDue = (db: DB, job: Job, now: Date): boolean => {
  if (job.dailyAtUtcHour === undefined) return true;
  if (now.getUTCHours() < job.dailyAtUtcHour) return false;
  return lastSuccessDate(db, job.name) !== now.toISOString().slice(0, 10);
};

export type RunOutcome = 'ran' | 'failed' | 'skipped' | 'not_due' | 'disabled';

/** One tick of one job: the lease, the row, the run, the report. Never throws. */
export const runJob = async (ctx: JobContext, job: Job, now = new Date(), holder = HOLDER): Promise<RunOutcome> => {
  const { db } = ctx;
  if (job.enabled && !job.enabled()) return 'disabled';
  let due: boolean;
  try {
    due = dailyDue(db, job, now);
  } catch (e) {
    reportError(e, { where: 'job', job: job.name, step: 'due' });
    return 'failed';
  }
  if (!due) return 'not_due';
  if (!acquireLease(db, leaseNameOf(job), leaseMsOf(job), holder, now.getTime())) {
    log.debug('job held elsewhere', { job: job.name });
    return 'skipped';
  }
  const id = uid('jr');
  const startedAt = now.toISOString();
  const started = Date.now();
  try {
    db.insert(jobRuns).values({ id, name: job.name, startedAt }).run();
  } catch (e) {
    reportError(e, { where: 'job', job: job.name, step: 'record' });
  }
  try {
    const meta = (await job.run(ctx, now)) ?? null;
    const ms = Date.now() - started;
    if (job.quiet && meta === null) db.delete(jobRuns).where(eq(jobRuns.id, id)).run();
    else {
      db.update(jobRuns)
        .set({ finishedAt: nowISO(), ok: 1, meta: meta ? JSON.stringify({ ...meta, ms }) : JSON.stringify({ ms }) })
        .where(eq(jobRuns.id, id))
        .run();
      log.info('job ran', { job: job.name, ms, ...(meta ?? {}) });
    }
    return 'ran';
  } catch (e) {
    const ms = Date.now() - started;
    const message = e instanceof Error ? e.message : String(e);
    try {
      db.update(jobRuns).set({ finishedAt: nowISO(), ok: 0, error: message.slice(0, 2000), meta: JSON.stringify({ ms }) }).where(eq(jobRuns.id, id)).run();
    } catch (e2) {
      log.error('job run not recorded', { job: job.name, err: e2 });
    }
    reportError(e, { where: 'job', job: job.name, runId: id, ms });
    return 'failed';
  }
};

/** `job_runs` older than 14 days, stale rate-limit windows, long-expired leases. */
export const purgeOps = (db: DB, now = Date.now()) => ({
  jobRuns: db.delete(jobRuns).where(lt(jobRuns.startedAt, new Date(now - JOB_RUNS_KEEP_MS).toISOString())).run().changes,
  rateLimits: purgeRateLimits(db, now),
  leases: purgeExpiredLeases(db, 24 * H, now),
});

export const defaultJobs = (): Job[] => [
  {
    // the 60 s loop that books the system reminders and sends what is due; a row only when something was sent
    name: 'reminders',
    everyMs: 60_000,
    initialDelayMs: 5_000,
    quiet: true,
    run: async ({ db }, now) => {
      const r = await schedulerTick(db, now);
      return r.sent || r.failed ? r : null;
    },
  },
  {
    // every connection keeps itself fresh: a sync on boot and then every 20 minutes (the syncs run in the background)
    name: 'provider-sync',
    everyMs: 20 * 60_000,
    initialDelayMs: 3_000,
    enabled: () => env.stravaConfigured || env.corosConfigured,
    run: ({ db }) => {
      syncAllConnections(db);
      return { kicked: true };
    },
  },
  {
    name: 'session-purge',
    everyMs: 6 * H,
    initialDelayMs: 30_000,
    run: ({ db }) => ({ deleted: purgeExpiredSessions(db).changes }),
  },
  {
    // PASSIVE: never blocks a reader or writer; a row only when frames moved
    name: 'wal-checkpoint',
    everyMs: 5 * 60_000,
    initialDelayMs: 5 * 60_000,
    quiet: true,
    run: ({ sqlite, dbPath }) => {
      if (dbPath === ':memory:') return null;
      const r = checkpointPassive(sqlite);
      return r.checkpointed > 0 || r.busy ? { ...r } : null;
    },
  },
  {
    // `VACUUM INTO backups/logbook-YYYY-MM-DD.db` once a day from 03:00 UTC, seven kept; it checks every five minutes
    // so a process that was down at 03:00 catches up when it comes back
    name: 'nightly-backup',
    everyMs: 5 * 60_000,
    dailyAtUtcHour: 3,
    initialDelayMs: 60_000,
    leaseMs: H,
    run: ({ sqlite, dbPath }, now) => nightlyBackup(sqlite, dbPath, now),
  },
  {
    name: 'idempotency-purge',
    everyMs: H,
    initialDelayMs: 2 * 60_000,
    run: ({ db }, now) => ({ deleted: db.delete(idempotencyKeys).where(lt(idempotencyKeys.createdAt, new Date(now.getTime() - IDEMPOTENCY_TTL_MS).toISOString())).run().changes }),
  },
  {
    name: 'ops-purge',
    everyMs: 6 * H,
    initialDelayMs: 3 * 60_000,
    run: ({ db }, now) => purgeOps(db, now.getTime()),
  },
];

export interface RunningJobs {
  names: string[];
  /** Stop the timers and wait for a running job, up to `capMs`. */
  stop: (capMs?: number) => Promise<void>;
}

/** Start the timers. Each job runs on its own setTimeout chain (never two ticks of one job at once). */
export const startJobs = (ctx: JobContext, jobs = defaultJobs()): RunningJobs => {
  let stopped = false;
  const timers = new Set<NodeJS.Timeout>();
  const running = new Set<Promise<unknown>>();
  const schedule = (job: Job, delay: number) => {
    if (stopped) return;
    const t = setTimeout(() => {
      timers.delete(t);
      if (stopped) return;
      const p = runJob(ctx, job).finally(() => {
        running.delete(p);
        schedule(job, job.everyMs);
      });
      running.add(p);
    }, delay);
    timers.add(t);
  };
  for (const job of jobs) schedule(job, job.initialDelayMs ?? job.everyMs);
  log.info('jobs started', { mode: env.RUN_JOBS, holder: HOLDER, jobs: jobs.map((j) => j.name) });
  return {
    names: jobs.map((j) => j.name),
    stop: async (capMs = 10_000) => {
      stopped = true;
      for (const t of timers) clearTimeout(t);
      timers.clear();
      if (!running.size) return;
      await Promise.race([Promise.allSettled([...running]), new Promise((r) => setTimeout(r, capMs).unref())]);
    },
  };
};
