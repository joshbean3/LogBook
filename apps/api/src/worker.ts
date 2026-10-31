import { openDatabase } from './db/index.js';
import { env } from './env.js';
import { HOLDER } from './lib/leases.js';
import { log } from './lib/log.js';
import { flushErrors, initErrorReporting, installProcessHandlers } from './services/ops/errors.js';
import { startJobs } from './services/ops/jobs.js';
import { appVersion } from './services/ops/version.js';

/**
 * The worker: the background jobs (reminders, provider syncs, session and key purges, the WAL checkpoint, the
 * nightly backup) in a process of their own, on the same SQLite file as the API. Run it with RUN_JOBS=worker on
 * the worker and RUN_JOBS=off on the API; the leases in the database keep each job on one process whatever the
 * two are set to. It needs the file the API writes, so on Fly it only makes sense on the same machine (README:
 * The worker process).
 */
installProcessHandlers('worker');
await initErrorReporting('worker');

if (env.RUN_JOBS === 'off') {
  log.warn('RUN_JOBS=off: this worker has nothing to run; idling so the supervisor does not restart it in a loop');
  setInterval(() => undefined, 2 ** 30);
} else {
  if (env.RUN_JOBS === 'inline') log.warn('RUN_JOBS=inline: the API process runs the jobs too; set RUN_JOBS=off there (the leases keep the two apart meanwhile)');
  const { db, sqlite, path: dbPath } = openDatabase();
  const jobs = startJobs({ db, sqlite, dbPath });
  log.info('worker started', { version: appVersion(), holder: HOLDER, db: dbPath, jobs: jobs.names });

  let closing = false;
  const shutdown = async (signal: string) => {
    if (closing) return;
    closing = true;
    log.info('worker shutting down', { signal });
    const force = setTimeout(() => {
      log.warn('shutdown took over 10 s; exiting anyway');
      process.exit(1);
    }, 10_000);
    force.unref();
    await jobs.stop(8_000);
    await flushErrors(2_000);
    try {
      sqlite.close();
    } catch (e) {
      log.warn('database close failed', { err: e });
    }
    log.info('worker stopped');
    process.exit(0);
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
}
