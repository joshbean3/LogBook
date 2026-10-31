import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { secureHeaders } from 'hono/secure-headers';
import fs from 'node:fs';
import type http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { requireAuth, type AuthEnv } from './auth.js';
import { openDatabase, type DB } from './db/index.js';
import { bodyLimit } from 'hono/body-limit';
import { idempotency } from './lib/requests.js';
import { ApiError } from './lib/util.js';
import { seedQuotes } from './db/seed.js';
import { env } from './env.js';
import { log, logContext } from './lib/log.js';
import { bindRateLimitDb, ipRateLimit } from './lib/ratelimit.js';
import { aiRoutes } from './routes/ai.js';
import { importRoutes } from './routes/import.js';
import { authRoutes } from './routes/auth.js';
import { coreRoutes } from './routes/core.js';
import { goalRoutes } from './routes/goals.js';
import { assistantRoutes } from './routes/assistant.js';
import { dayPlanRoutes } from './routes/dayplans.js';
import { journalRoutes } from './routes/journal.js';
import { meRoutes } from './routes/me.js';
import { planRoutes } from './routes/plans.js';
import { readsRoutes } from './routes/reads.js';
import { stravaRoutes } from './routes/strava.js';
import { connectionRoutes } from './routes/connections.js';
import { reminderRoutes } from './routes/reminders.js';
import { flushErrors, initErrorReporting, installProcessHandlers, reportError } from './services/ops/errors.js';
import { logUser, opsRoutes, requestLogging } from './services/ops/http.js';
import { startJobs } from './services/ops/jobs.js';
import { appVersion } from './services/ops/version.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Per address, before anything else: sign-in and sign-up tries, and a soft ceiling on everything. */
export const IP_LIMITS = {
  auth: { limit: 20, windowMs: 60_000 },
  all: { limit: 600, windowMs: 60_000 },
};

export interface AppOptions {
  /** The SQLite file, for /api/health's WAL size and /api/metrics (`:memory:` in tests). */
  dbPath?: string;
  /** The per-IP limits on /api/auth/* and /api/*. Default: on, except under test (a test suite signs in more than twenty times a minute). */
  ipLimits?: boolean;
  shuttingDown?: () => boolean;
}

export const buildApp = (db: DB, opts: AppOptions = {}) => {
  const app = new Hono<AuthEnv>();
  const dbPath = opts.dbPath ?? ':memory:';
  bindRateLimitDb(db);
  app.use(requestLogging());
  app.use(secureHeaders({ crossOriginEmbedderPolicy: false }));

  app.route('/api', opsRoutes(db, { dbPath, shuttingDown: opts.shuttingDown }));
  if (opts.ipLimits ?? env.NODE_ENV !== 'test') {
    app.use('/api/auth/*', ipRateLimit(db, 'ip-auth', IP_LIMITS.auth.limit, IP_LIMITS.auth.windowMs, 'Too many sign-in attempts from this address.'));
    // soft: counted in batches of ten per process, so the table sees a write every tenth request, not every one
    app.use('/api/*', ipRateLimit(db, 'ip-all', IP_LIMITS.all.limit, IP_LIMITS.all.windowMs, 'Too many requests from this address.', { batch: 10 }));
  }
  // request bodies: 1 MB everywhere, 25 MB for a plan draft's PDF or photo
  const tooBig = (c: { req: { path: string } }) => {
    throw new ApiError(413, `That request is too big (${c.req.path.endsWith('/plans/draft') ? '25 MB' : '1 MB'} at most).`, 'too_big');
  };
  app.use('/api/plans/draft', bodyLimit({ maxSize: 25 * 1024 * 1024, onError: tooBig }));
  app.use('/api/*', async (c, next) => (c.req.path.endsWith('/plans/draft') ? next() : bodyLimit({ maxSize: 1024 * 1024, onError: tooBig })(c, next)));
  app.route('/api/auth', authRoutes(db));
  app.route('/api/strava', stravaRoutes(db));
  app.route('/api/connections', connectionRoutes(db));
  const authed = new Hono<AuthEnv>();
  authed.use(requireAuth(db));
  authed.use(logUser());
  // contract 4: a write sent twice with the same Idempotency-Key (the outbox's replays) lands once
  authed.use(idempotency(db));
  authed.route('/', coreRoutes(db));
  authed.route('/', journalRoutes(db));
  authed.route('/', aiRoutes(db));
  authed.route('/', readsRoutes(db));
  authed.route('/', importRoutes(db));
  authed.route('/', meRoutes(db));
  authed.route('/', planRoutes(db));
  authed.route('/', goalRoutes(db));
  authed.route('/', assistantRoutes(db));
  authed.route('/', dayPlanRoutes(db));
  authed.route('/', reminderRoutes(db));
  app.route('/api', authed);

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      const code = (err as { code?: string }).code;
      return c.json({ error: err.message, code: code ?? null }, err.status);
    }
    const requestId = logContext()?.requestId ?? null;
    reportError(err, { where: 'request', method: c.req.method, path: c.req.path });
    return c.json({ error: 'Something went wrong on the server.', code: 'internal', requestId }, 500);
  });
  app.notFound((c) => (c.req.path.startsWith('/api/') ? c.json({ error: 'Not found', code: 'not_found' }, 404) : c.text('Not found', 404)));

  // ---------- the built web app, when present ----------
  const dist = env.WEB_DIST ?? [path.join(here, 'public'), path.join(here, '..', '..', 'web', 'dist'), path.join(here, '..', 'public')].find((p) => fs.existsSync(path.join(p, 'index.html')));
  if (dist && fs.existsSync(path.join(dist, 'index.html'))) {
    const root = path.relative(process.cwd(), dist) || '.';
    app.use(
      '/*',
      serveStatic({
        root,
        // the web build writes a .br and a .gz next to every script, stylesheet and svg (apps/web/scripts/precompress.mjs):
        // sent as they are, with Content-Encoding and Vary, so the 640 KB entry travels as 170 KB
        precompressed: true,
        onFound: (p, c) => {
          if (/\/assets\//.test(p) || /\.(woff2?|png|svg|ico|webp)(\.(br|gz))?$/.test(p)) c.header('cache-control', 'public, max-age=31536000, immutable');
          else c.header('cache-control', 'no-cache');
        },
      }),
    );
    // the app shell for every other path, compressed once here (it is a few KB, but it is the first byte of every open)
    const index = fs.readFileSync(path.join(dist, 'index.html'));
    const encoded = {
      br: zlib.brotliCompressSync(index, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: index.length } }),
      gzip: zlib.gzipSync(index, { level: 9 }),
    };
    app.get('*', (c) => {
      if (c.req.path.startsWith('/api/')) return c.json({ error: 'Not found', code: 'not_found' }, 404);
      c.header('cache-control', 'no-cache');
      c.header('content-type', 'text/html; charset=utf-8');
      c.header('vary', 'Accept-Encoding');
      const accepts = new Set((c.req.header('accept-encoding') ?? '').split(',').map((e) => e.trim().split(';')[0]));
      const enc = accepts.has('br') ? 'br' : accepts.has('gzip') ? 'gzip' : null;
      if (enc) {
        c.header('content-encoding', enc);
        return c.body(new Uint8Array(encoded[enc]));
      }
      return c.body(new Uint8Array(index));
    });
    log.info('serving web app', { dist });
  } else {
    log.info('no web build found; API only (run the web dev server or build it)');
  }
  return app;
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  installProcessHandlers('api');
  await initErrorReporting('api');
  const { db, sqlite, path: dbPath } = openDatabase();
  seedQuotes(db);
  let closing = false;
  const app = buildApp(db, { dbPath, shuttingDown: () => closing });
  const server = serve({ fetch: app.fetch, port: env.PORT, hostname: '0.0.0.0' }, (info) => {
    log.info('listening', { port: info.port, env: env.NODE_ENV, version: appVersion(), db: dbPath, jobs: env.RUN_JOBS });
  }) as http.Server;
  // the background jobs run here unless a worker process has them (RUN_JOBS=worker) or nobody does (off)
  const jobs = env.RUN_JOBS === 'inline' ? startJobs({ db, sqlite, dbPath }) : null;
  if (!jobs) log.warn('background jobs not run by this process', { RUN_JOBS: env.RUN_JOBS });

  // SIGTERM (a deploy, a stop): health goes 503, the listener closes, in-flight requests finish (10 s at most),
  // a running job finishes, then the database closes cleanly
  const shutdown = async (signal: string) => {
    if (closing) return;
    closing = true;
    log.info('shutting down', { signal });
    const force = setTimeout(() => {
      log.warn('shutdown took over 10 s; exiting anyway');
      process.exit(1);
    }, 10_000);
    force.unref();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeIdleConnections?.();
    });
    await jobs?.stop(5_000);
    await flushErrors(2_000);
    try {
      sqlite.close();
    } catch (e) {
      log.warn('database close failed', { err: e });
    }
    log.info('stopped');
    process.exit(0);
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
}
