import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { HTTPException } from 'hono/http-exception';
import { secureHeaders } from 'hono/secure-headers';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { sql } from 'drizzle-orm';
import { ZodError } from 'zod';
import { purgeExpiredSessions, requireAuth, type AuthEnv } from './auth.js';
import { openDatabase, type DB } from './db/index.js';
import { CSP, PERMISSIONS_POLICY, writeGuard } from './lib/guards.js';
import { logError, logLine, requestLog } from './lib/log.js';
import { idempotency } from './lib/requests.js';
import { seedQuotes } from './db/seed.js';
import { env } from './env.js';
import { aiRoutes } from './routes/ai.js';
import { importRoutes } from './routes/import.js';
import { authRoutes } from './routes/auth.js';
import { clientErrorRoutes } from './routes/clientErrors.js';
import { coreRoutes } from './routes/core.js';
import { goalRoutes } from './routes/goals.js';
import { assistantRoutes } from './routes/assistant.js';
import { dayPlanRoutes } from './routes/dayplans.js';
import { journalRoutes } from './routes/journal.js';
import { learnedRoutes } from './routes/learned.js';
import { timelineRoutes } from './routes/timeline.js';
import { meRoutes } from './routes/me.js';
import { planRoutes } from './routes/plans.js';
import { readsRoutes } from './routes/reads.js';
import { stravaRoutes } from './routes/strava.js';
import { appleHealthDeviceRoutes, appleHealthRoutes } from './routes/appleHealth.js';
import { purgeAudit } from './services/audit.js';
import { purgeTokens } from './services/authTokens.js';
import { backupConfigFrom, scheduleBackups } from './services/backup.js';
import { purgeDeleted } from './services/retention.js';
import { purgeThrottle } from './services/throttle.js';

const here = path.dirname(fileURLToPath(import.meta.url));
/** How long a shutdown waits for requests in flight. Below fly.toml's kill_timeout (15 s). */
export const SHUTDOWN_GRACE_MS = 10_000;

const KB = 1024;
const MB = 1024 * KB;
/** The body limit for ordinary routes, and the routes that may send more (a file, an export, a batch of readings). */
export const BODY_LIMIT = 256 * KB;
export const BODY_LIMITS: Array<{ path: string; bytes: number }> = [
  { path: '/api/assistant', bytes: 28 * MB },
  { path: '/api/plans/draft', bytes: 26 * MB },
  { path: '/api/import', bytes: 20 * MB },
  { path: '/api/apple-health/reconcile', bytes: 3 * MB },
  { path: '/api/apple-health/sync', bytes: 2 * MB },
  // contract 7: a client error report is small by design
  { path: '/api/client-errors', bytes: 8 * KB },
];
/** The routes that take a form upload (a file); every other write must be JSON. */
export const UPLOAD_ROUTES = ['/api/plans/draft'];
const tooBig = (bytes: number) =>
  bodyLimit({
    maxSize: bytes,
    onError: (c) => c.json({ error: bytes > BODY_LIMIT ? `That is too big to send. The limit here is ${Math.round(bytes / MB)} MB.` : 'That is too big to send.', code: 'too_big' }, 413),
  });
const limiters = new Map<number, ReturnType<typeof bodyLimit>>();
const limitFor = (path: string) => {
  const bytes = BODY_LIMITS.find((l) => l.path === path)?.bytes ?? BODY_LIMIT;
  let m = limiters.get(bytes);
  if (!m) limiters.set(bytes, (m = tooBig(bytes)));
  return m;
};

export const buildApp = (db: DB) => {
  const app = new Hono<AuthEnv>();
  // one structured line a request: method, route pattern, status, time and a hashed account id; never a body (lib/log.ts)
  app.use(requestLog());
  app.use(secureHeaders({ crossOriginEmbedderPolicy: false, contentSecurityPolicy: CSP, permissionsPolicy: PERMISSIONS_POLICY }));
  // every request body is capped before anything reads or parses it: 256 KB, more only on the routes that carry files
  app.use('/api/*', (c, next) => limitFor(c.req.path)(c, next));
  // a write must come from this app (no foreign Origin) and carry JSON, or a form on the upload routes (lib/guards.ts)
  app.use('/api/*', writeGuard(UPLOAD_ROUTES));

  // Fly's health check, and what the post-deploy check reads: whether the pieces a public server needs are configured
  // (yes or no only, nothing secret). It asks the database a question, so a locked or missing database reads as down.
  app.get('/api/health', (c) => {
    try {
      db.get(sql`select 1`);
    } catch (e) {
      logError('health', e);
      return c.json({ ok: false, time: new Date().toISOString() }, 503);
    }
    return c.json({ ok: true, time: new Date().toISOString(), ready: { mail: env.mailConfigured, claude: env.claudeConfigured, support: env.supportConfigured } });
  });
  // contract 7: client error reports. Mounted before anything that reads the session, and it never does (critic-04).
  app.route('/api/client-errors', clientErrorRoutes());
  // iOS Password AutoFill: which app may use passwords saved for this site. Served only when the team id is set.
  app.get('/.well-known/apple-app-site-association', (c) => {
    if (!env.APPLE_TEAM_ID) return c.json({ error: 'Not found', code: 'not_found' }, 404);
    c.header('cache-control', 'public, max-age=3600');
    return c.json({ webcredentials: { apps: [`${env.APPLE_TEAM_ID}.${env.APP_BUNDLE_ID}`] } });
  });
  app.route('/api/auth', authRoutes(db));
  app.route('/api/strava', stravaRoutes(db));
  // the phone's Apple Health sync engine, by device token (it may run with no web view and no session)
  app.route('/api/apple-health', appleHealthDeviceRoutes(db));
  const authed = new Hono<AuthEnv>();
  authed.use(requireAuth(db));
  // contract 4: a write sent twice with the same Idempotency-Key (the outbox's replays) lands once
  authed.use(idempotency(db));
  authed.route('/', coreRoutes(db));
  authed.route('/', journalRoutes(db));
  authed.route('/', learnedRoutes(db));
  authed.route('/', timelineRoutes(db));
  authed.route('/', aiRoutes(db));
  authed.route('/', readsRoutes(db));
  authed.route('/', importRoutes(db));
  authed.route('/', meRoutes(db));
  authed.route('/', planRoutes(db));
  authed.route('/', goalRoutes(db));
  authed.route('/', assistantRoutes(db));
  authed.route('/', dayPlanRoutes(db));
  authed.route('/', appleHealthRoutes(db));
  app.route('/api', authed);

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      const { code, headers } = err as { code?: string; headers?: Record<string, string> };
      for (const [k, v] of Object.entries(headers ?? {})) c.header(k, v);
      return c.json({ error: err.message, code: code ?? null }, err.status);
    }
    // a value that failed a schema outside parseBody (a path or query value): the request was wrong, not the server
    if (err instanceof ZodError) return c.json({ error: 'That request has a value Orby cannot read.', code: 'validation' }, 422);
    logError(`${c.req.method} ${c.req.routePath}`, err);
    console.error(err);
    return c.json({ error: 'Something went wrong on the server.', code: 'internal' }, 500);
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
    console.log(`Serving web app from ${dist}`);
  } else {
    console.log('No web build found; API only. Run the web dev server or build it.');
  }
  return app;
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { db, sqlite } = openDatabase();
  seedQuotes(db);
  const app = buildApp(db);
  const server = serve({ fetch: app.fetch, port: env.PORT, hostname: '0.0.0.0' }, (info) => {
    console.log(`Orby API listening on http://localhost:${info.port} (${env.NODE_ENV})`);
  });
  // No Strava loop: a sync runs when Strava's webhook says there is something new, when the app is opened (at most
  // every 15 minutes, routes/core.ts) and on a manual pull. Polling every account on a timer spent the app's shared
  // rate limit on nothing.
  if (env.isProd && !env.mailConfigured) console.warn('[mail] MAIL_API_KEY and MAIL_FROM are not set: password reset and verification mail will not be sent.');
  if (env.isProd && !env.claudeConfigured) console.warn('[claude] ANTHROPIC_API_KEY and ANTHROPIC_MODEL are not both set: the AI features are off.');
  // the nightly off-site backup, when the BACKUP_S3_* variables are set (services/backup.ts, RUNBOOK.md)
  const backup = backupConfigFrom(process.env);
  if (backup) scheduleBackups(sqlite, backup, { databasePath: env.DATABASE_PATH });
  else if (env.isProd) console.warn('[backup] BACKUP_S3_* is not set: there is no off-site backup, only the volume snapshots.');
  // At boot and four times a day: expired sessions, spent tokens, old counters and old security log rows go, and so
  // does anything deleted more than 30 days ago and any assistant proposal older than 90 days (services/retention.ts).
  const housekeeping = () => {
    try {
      purgeExpiredSessions(db);
      purgeTokens(db);
      purgeThrottle(db);
      purgeAudit(db);
      const gone = purgeDeleted(db);
      const total = Object.values(gone).reduce((a, n) => a + n, 0);
      if (total) logLine({ t: 'retention', at: new Date().toISOString(), rows: total, tables: Object.entries(gone).filter(([, n]) => n).map(([t, n]) => `${t}:${n}`).join(',') });
    } catch (e) {
      logError('housekeeping', e);
    }
  };
  housekeeping();
  setInterval(housekeeping, 6 * 3600_000).unref();

  // A deploy or a restart: stop taking connections, let the requests in flight finish, then close the database.
  // Fly sends SIGINT (fly.toml kill_signal) and waits kill_timeout (15 s) before it kills; this gives up after 10.
  let closing = false;
  const shutdown = (signal: string, code = 0) => {
    if (closing) return;
    closing = true;
    logLine({ t: 'shutdown', at: new Date().toISOString(), signal });
    const finish = () => {
      try {
        sqlite.close();
      } catch {
        /* already closed */
      }
      process.exit(code);
    };
    const giveUp = setTimeout(finish, SHUTDOWN_GRACE_MS);
    giveUp.unref();
    server.close(() => {
      clearTimeout(giveUp);
      finish();
    });
    // idle keep-alive connections would hold close() open until the timeout
    (server as { closeIdleConnections?: () => void }).closeIdleConnections?.();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  // a promise nobody caught is logged and the server carries on; an exception nobody caught leaves the process in an
  // unknown state, so it is logged and the server restarts cleanly
  process.on('unhandledRejection', (reason) => logError('unhandledRejection', reason));
  process.on('uncaughtException', (err) => {
    logError('uncaughtException', err);
    console.error(err);
    shutdown('uncaughtException', 1);
  });
}
