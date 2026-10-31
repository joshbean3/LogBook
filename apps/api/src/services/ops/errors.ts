import os from 'node:os';
import { env } from '../../env.js';
import { log, logContext } from '../../lib/log.js';
import { appVersion } from './version.js';

/**
 * Error reporting: every unexpected error goes to the log (with the request id and user id when known) and, when
 * SENTRY_DSN is set, to Sentry. The SDK is imported only then: without a DSN the process never loads it.
 */
type SentryModule = typeof import('@sentry/node');
let sentry: SentryModule | null = null;

export type ProcessRole = 'api' | 'worker';

export const initErrorReporting = async (role: ProcessRole): Promise<boolean> => {
  if (!env.SENTRY_DSN) return false;
  const S = await import('@sentry/node');
  S.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV, release: `logbook@${appVersion()}`, serverName: `${os.hostname()}/${role}`, tracesSampleRate: 0 });
  S.setTag('process', role);
  sentry = S;
  log.info('error reporting on', { sink: 'sentry', role });
  return true;
};

export interface ErrorContext {
  /** What was going on: `request`, `job`, `unhandledRejection`... */
  where?: string;
  requestId?: string;
  userId?: string;
  job?: string;
  [k: string]: unknown;
}

const TAGS = new Set(['where', 'requestId', 'job', 'method', 'path', 'process']);

/** Log it, and send it on when Sentry is configured. Safe to call with anything thrown. */
export const reportError = (err: unknown, ctx: ErrorContext = {}) => {
  const c: ErrorContext = { ...(logContext() ?? {}), ...ctx };
  const { where = 'error', ...fields } = c;
  log.error(where, { err, ...fields });
  if (!sentry) return;
  const S = sentry;
  try {
    S.withScope((scope) => {
      if (c.userId) scope.setUser({ id: c.userId });
      for (const [k, v] of Object.entries(c)) {
        if (v === undefined || k === 'userId') continue;
        if (TAGS.has(k)) scope.setTag(k, String(v));
        else scope.setExtra(k, v);
      }
      S.captureException(err instanceof Error ? err : new Error(typeof err === 'string' ? err : JSON.stringify(err)));
    });
  } catch (e) {
    log.warn('sentry report failed', { err: e });
  }
};

/** Wait for queued reports to leave before the process exits. */
export const flushErrors = (timeoutMs = 2000): Promise<boolean> => (sentry ? sentry.flush(timeoutMs) : Promise.resolve(true));

/** A rejected promise nobody awaited is reported and the process goes on; an uncaught exception is reported and the process exits 1. */
export const installProcessHandlers = (role: ProcessRole) => {
  process.on('unhandledRejection', (reason) => reportError(reason, { where: 'unhandledRejection', process: role }));
  process.on('uncaughtException', (err) => {
    reportError(err, { where: 'uncaughtException', process: role });
    void flushErrors(2000).finally(() => process.exit(1));
  });
};
