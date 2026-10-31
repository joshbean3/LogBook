import { sql } from 'drizzle-orm';
import { Hono, type MiddlewareHandler } from 'hono';
import { randomUUID } from 'node:crypto';
import type { AuthedUser, AuthEnv } from '../../auth.js';
import { walBytes, type DB } from '../../db/index.js';
import { env } from '../../env.js';
import { log, logContext, withLogContext, type LogContext } from '../../lib/log.js';
import { clientIp } from '../../lib/ratelimit.js';
import { observeRequest, renderMetrics } from './metrics.js';
import { appVersion, uptimeSeconds } from './version.js';

/** Over this, a request is logged at warn as `slow request`. */
export const SLOW_REQUEST_MS = 1000;
const REQUEST_ID_RE = /^[A-Za-z0-9_.:-]{1,64}$/;

/**
 * The request middleware, first in the chain: a request id (`X-Request-Id` in, or a fresh UUID; always sent back),
 * the log context every line inside carries, the counters and histogram behind /api/metrics, and one line per
 * API request with method, path, status, ms, user and address. Static files are neither logged nor counted.
 */
export const requestLogging = (): MiddlewareHandler<AuthEnv> => async (c, next) => {
  const start = performance.now();
  const incoming = c.req.header('x-request-id');
  const requestId = incoming && REQUEST_ID_RE.test(incoming) ? incoming : randomUUID();
  const ctx: LogContext = { requestId };
  await withLogContext(ctx, () => next());
  const ms = Math.round((performance.now() - start) * 10) / 10;
  try {
    c.res.headers.set('x-request-id', requestId);
  } catch {
    // an immutable Response (one that came straight from fetch): the id stays in the log
  }
  const path = c.req.path;
  if (!path.startsWith('/api/')) return;
  const status = c.res.status;
  observeRequest(status, ms);
  const user = c.get('user') as AuthedUser | undefined;
  const fields = { method: c.req.method, path, status, ms, userId: user?.id, ip: clientIp(c.req.raw.headers) };
  if (ms > SLOW_REQUEST_MS) log.warn('slow request', { ...fields, requestId });
  else if (path === '/api/health' || path === '/api/ready') log.debug('request', { ...fields, requestId });
  else log.info('request', { ...fields, requestId });
};

/** After `requireAuth`: the user id onto the request's log context, so every line inside the handler carries it. */
export const logUser = (): MiddlewareHandler<AuthEnv> => async (c, next) => {
  const ctx = logContext();
  if (ctx) ctx.userId = c.get('user').id;
  await next();
};

export interface OpsOptions {
  dbPath: string;
  /** True once SIGTERM arrived: health answers 503 so the proxy drains this machine. */
  shuttingDown?: () => boolean;
}

/** `/health` and `/ready` (the same check: `SELECT 1`, 503 when it fails) and `/metrics`. Mounted under /api, before auth. */
export const opsRoutes = (db: DB, opts: OpsOptions) => {
  const r = new Hono<AuthEnv>();
  const health = (c: Parameters<MiddlewareHandler<AuthEnv>>[0]) => {
    const base = { uptime_s: uptimeSeconds(), version: appVersion() };
    if (opts.shuttingDown?.()) return c.json({ ok: false, db: 'closing', ...base }, 503);
    try {
      db.get(sql`SELECT 1`);
    } catch (e) {
      log.error('health check failed', { err: e });
      return c.json({ ok: false, db: 'error', error: e instanceof Error ? e.message : String(e), ...base }, 503);
    }
    return c.json({ ok: true, db: 'ok', wal_bytes: walBytes(opts.dbPath), ...base });
  };
  r.get('/health', health);
  r.get('/ready', health);
  r.get('/metrics', (c) => {
    if (env.METRICS_TOKEN) {
      const auth = c.req.header('authorization') ?? '';
      if (auth !== `Bearer ${env.METRICS_TOKEN}`) return c.text('unauthorized', 401);
    }
    return c.body(renderMetrics(db, opts.dbPath), 200, { 'content-type': 'text/plain; version=0.0.4; charset=utf-8' });
  });
  return r;
};
