import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { purgeExpiredSessions, requireAuth, type AuthEnv } from './auth.js';
import { openDatabase, type DB } from './db/index.js';
import { stravaAccounts } from './db/schema.js';
import { seedQuotes } from './db/seed.js';
import { env } from './env.js';
import { aiRoutes } from './routes/ai.js';
import { authRoutes } from './routes/auth.js';
import { coreRoutes } from './routes/core.js';
import { journalRoutes } from './routes/journal.js';
import { stravaRoutes, syncInBackground } from './routes/strava.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export const buildApp = (db: DB) => {
  const app = new Hono<AuthEnv>();
  if (!env.isProd) app.use(logger());
  app.use(secureHeaders({ crossOriginEmbedderPolicy: false }));

  app.get('/api/health', (c) => c.json({ ok: true, time: new Date().toISOString() }));
  app.route('/api/auth', authRoutes(db));
  app.route('/api/strava', stravaRoutes(db));
  const authed = new Hono<AuthEnv>();
  authed.use(requireAuth(db));
  authed.route('/', coreRoutes(db));
  authed.route('/', journalRoutes(db));
  authed.route('/', aiRoutes(db));
  app.route('/api', authed);

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      const code = (err as { code?: string }).code;
      return c.json({ error: err.message, code: code ?? null }, err.status);
    }
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
        onFound: (p, c) => {
          if (/\/assets\//.test(p) || /\.(woff2?|png|svg|ico|webp)$/.test(p)) c.header('cache-control', 'public, max-age=31536000, immutable');
          else c.header('cache-control', 'no-cache');
        },
      }),
    );
    const index = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
    app.get('*', (c) => {
      if (c.req.path.startsWith('/api/')) return c.json({ error: 'Not found', code: 'not_found' }, 404);
      c.header('cache-control', 'no-cache');
      return c.html(index);
    });
    console.log(`Serving web app from ${dist}`);
  } else {
    console.log('No web build found; API only. Run the web dev server or build it.');
  }
  return app;
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { db } = openDatabase();
  seedQuotes(db);
  purgeExpiredSessions(db);
  const app = buildApp(db);
  serve({ fetch: app.fetch, port: env.PORT, hostname: '0.0.0.0' }, (info) => {
    console.log(`Logbook API listening on http://localhost:${info.port} (${env.NODE_ENV})`);
  });
  // Strava keeps itself fresh: a sync on boot and then every 20 minutes, for every connected account
  const syncAll = () => {
    for (const a of db.select({ userId: stravaAccounts.userId }).from(stravaAccounts).all()) syncInBackground(db, a.userId);
  };
  if (env.stravaConfigured) {
    setTimeout(syncAll, 3000);
    setInterval(syncAll, 20 * 60_000).unref();
  }
  setInterval(() => purgeExpiredSessions(db), 6 * 3600_000).unref();
}
