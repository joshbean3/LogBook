import { Hono } from 'hono';
import type { AuthEnv } from '../auth.js';
import type { DB } from '../db/index.js';
import { syncInBackground as syncProviderInBackground } from '../services/providers/index.js';
import { connectionRoutes } from './connections.js';

/** Kick off a full Strava sync without blocking the request; errors are recorded on the connection. */
export const syncInBackground = (db: DB, userId: string) => syncProviderInBackground(db, userId, 'strava');

/**
 * `/api/strava/*`: the paths the client has always called, served by the provider routes as `/api/connections/strava/*`.
 * Strava's OAuth app and webhook subscription point here, so these paths stay.
 */
export const stravaRoutes = (db: DB) => {
  const r = new Hono<AuthEnv>();
  const inner = connectionRoutes(db);
  r.all('/*', (c) => {
    const url = new URL(c.req.url);
    // the inner app is unmounted: its paths start at the provider
    url.pathname = url.pathname.replace(/^\/api\/strava(\/|$)/, '/strava$1');
    return inner.fetch(new Request(url.toString(), c.req.raw), c.env);
  });
  return r;
};
