import { createHmac, timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import { requireAuth, type AuthEnv } from '../auth.js';
import type { DB } from '../db/index.js';
import { env } from '../env.js';
import { ApiError } from '../lib/util.js';
import { authorizeUrl, disconnect, exchangeCode, StravaError, stravaStatus, syncActivities, syncZones, userForAthlete } from '../services/strava.js';

const sign = (userId: string, ts: number, app: 0 | 1) => createHmac('sha256', env.SESSION_SECRET).update(`${userId}.${ts}.${app}`).digest('base64url');
/** The OAuth state: who started it, when, and whether to land back in the iOS app or the web app. */
const makeState = (userId: string, app: 0 | 1 = 0) => {
  const ts = Date.now();
  return `${userId}.${ts}.${app}.${sign(userId, ts, app)}`;
};
const readState = (state: string | undefined): { userId: string; app: boolean } | null => {
  const [userId, tsS, appS, sig] = (state ?? '').split('.');
  if (!userId || !tsS || !appS || !sig) return null;
  const ts = Number(tsS);
  const app = appS === '1' ? 1 : 0;
  if (!Number.isFinite(ts) || Date.now() - ts > 15 * 60_000) return null;
  const expected = sign(userId, ts, app);
  return expected.length === sig.length && timingSafeEqual(Buffer.from(expected), Buffer.from(sig)) ? { userId, app: app === 1 } : null;
};
/** Where a finished OAuth dance lands: the web app's Settings, or the iOS app via its URL scheme. */
const landing = (app: boolean, query: string) => (app ? `logbook://settings?${query}` : `/settings?${query}`);

const toApiError = (e: unknown): never => {
  if (e instanceof StravaError) throw new ApiError(e.code === 'rate_limited' ? 429 : e.code === 'unavailable' ? 502 : 400, e.message, e.code);
  throw e;
};

/** Kick off a full sync without blocking the request; errors are recorded on the account. */
export const syncInBackground = (db: DB, userId: string) => {
  void (async () => {
    try {
      await syncActivities(db, userId);
      await syncZones(db, userId);
    } catch (e) {
      console.warn('Strava sync failed:', e instanceof Error ? e.message : e);
    }
  })();
};

export const stravaRoutes = (db: DB) => {
  const r = new Hono<AuthEnv>();
  const auth = requireAuth(db);

  r.get('/connect', auth, (c) => {
    if (!env.stravaConfigured) throw new ApiError(400, 'Strava isn’t configured on this server. Add STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET.', 'not_configured');
    return c.redirect(authorizeUrl(makeState(c.get('user').id)));
  });

  /** For the iOS app: the authorize URL to open in the system browser; the callback deep-links back. */
  r.get('/connect-url', auth, (c) => {
    if (!env.stravaConfigured) throw new ApiError(400, 'Strava isn’t configured on this server.', 'not_configured');
    return c.json({ url: authorizeUrl(makeState(c.get('user').id, 1)) });
  });

  r.get('/callback', async (c) => {
    const q = c.req.query();
    const st = readState(q.state);
    if (!st) return c.redirect('/settings?strava=error&reason=state');
    const { userId, app } = st;
    if (q.error) return c.redirect(landing(app, `strava=error&reason=${encodeURIComponent(q.error)}`));
    if (!q.code) return c.redirect(landing(app, 'strava=error&reason=nocode'));
    try {
      await exchangeCode(db, userId, q.code, q.scope ?? null);
    } catch (e) {
      return c.redirect(landing(app, `strava=error&reason=${encodeURIComponent(e instanceof Error ? e.message : 'token')}`));
    }
    syncInBackground(db, userId);
    return c.redirect(landing(app, 'strava=connected'));
  });

  r.post('/disconnect', auth, async (c) => {
    await disconnect(db, c.get('user').id);
    return c.json(stravaStatus(db, c.get('user').id));
  });

  r.get('/status', auth, (c) => c.json(stravaStatus(db, c.get('user').id)));

  r.post('/sync', auth, async (c) => {
    const userId = c.get('user').id;
    try {
      const out = await syncActivities(db, userId);
      if (!('skipped' in out)) await syncZones(db, userId).catch(() => null);
      return c.json({ ...out, status: stravaStatus(db, userId) });
    } catch (e) {
      return toApiError(e);
    }
  });

  // ---------- webhook: Strava calls GET once to verify, then POSTs events ----------
  r.get('/webhook', (c) => {
    const q = c.req.query();
    if (q['hub.mode'] === 'subscribe' && q['hub.verify_token'] === env.STRAVA_WEBHOOK_VERIFY_TOKEN) return c.json({ 'hub.challenge': q['hub.challenge'] });
    throw new ApiError(403, 'Bad verify token');
  });

  r.post('/webhook', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { object_type?: string; owner_id?: number } | null;
    if (body?.object_type === 'activity' && body.owner_id != null) {
      const userId = userForAthlete(db, String(body.owner_id));
      if (userId) setTimeout(() => syncInBackground(db, userId), 1500);
    }
    return c.json({ ok: true });
  });

  return r;
};
