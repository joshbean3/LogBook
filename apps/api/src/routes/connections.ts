import { createHmac, timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import { requireAuth, type AuthEnv } from '../auth.js';
import type { DB } from '../db/index.js';
import { env } from '../env.js';
import { ApiError } from '../lib/util.js';
import { bindCorosStore, corosAuthorizeUrl } from '../services/providers/coros.js';
import { connect, connectionStatus, connectionStatuses, disconnect, handleWebhook, isProviderId, ProviderError, providerOf, syncConnection, syncInBackground, syncZones, type ProviderId } from '../services/providers/index.js';

const sign = (userId: string, ts: number, app: 0 | 1, provider: string, extra: string) => createHmac('sha256', env.SESSION_SECRET).update(`${userId}.${ts}.${app}.${provider}.${extra}`).digest('base64url');
/**
 * The OAuth state: who started it, when, which provider, whether to land back in the iOS app or the web app, and an
 * optional `extra` the provider needs back at the callback (COROS: its sealed PKCE verifier; base64url, so no dots).
 * The signature covers all of it.
 */
export const makeState = (userId: string, provider: ProviderId, app: 0 | 1 = 0, extra = '') => {
  const ts = Date.now();
  return `${userId}.${ts}.${app}.${provider}.${extra}.${sign(userId, ts, app, provider, extra)}`;
};
export const readState = (state: string | undefined, provider: ProviderId): { userId: string; app: boolean; extra: string } | null => {
  const [userId, tsS, appS, prov, extra, sig] = (state ?? '').split('.');
  if (!userId || !tsS || !appS || !prov || extra === undefined || !sig || prov !== provider) return null;
  const ts = Number(tsS);
  const app = appS === '1' ? 1 : 0;
  if (!Number.isFinite(ts) || Date.now() - ts > 15 * 60_000) return null;
  const expected = sign(userId, ts, app, provider, extra);
  return expected.length === sig.length && timingSafeEqual(Buffer.from(expected), Buffer.from(sig)) ? { userId, app: app === 1, extra } : null;
};
/** Where a finished OAuth dance lands: the web app's Settings, or the iOS app via its URL scheme. */
const landing = (app: boolean, query: string) => (app ? `logbook://settings?${query}` : `/settings?${query}`);

export const toApiError = (e: unknown): never => {
  if (e instanceof ProviderError) throw new ApiError(e.code === 'rate_limited' ? 429 : e.code === 'unavailable' ? 502 : 400, e.message, e.code);
  throw e;
};

const providerParam = (id: string): ProviderId => {
  if (!isProviderId(id)) throw new ApiError(404, 'No such provider.', 'not_found');
  return id;
};

/**
 * Integrations behind one interface: `GET /connections` lists every provider with its status; per provider: the
 * authorize URL (`/connect` redirects, `/connect-url` answers it for the iOS app), the OAuth callback, disconnect, sync,
 * and the provider's webhook. `/api/strava/*` keeps its old paths as aliases (routes/strava.ts).
 */
export const connectionRoutes = (db: DB) => {
  const r = new Hono<AuthEnv>();
  const auth = requireAuth(db);
  bindCorosStore(db);

  /** The authorize URL. COROS discovers its endpoints and registers itself first, and seals a PKCE verifier into the state. */
  const authorizeUrl = async (id: ProviderId, userId: string, app: 0 | 1): Promise<string> => {
    const p = providerOf(id);
    if (!p.configured) throw new ApiError(400, `${p.name} isn’t configured on this server.`, 'not_configured');
    try {
      return id === 'coros' ? await corosAuthorizeUrl(db, (sealed) => makeState(userId, id, app, sealed)) : p.authorizeUrl(makeState(userId, id, app));
    } catch (e) {
      return toApiError(e);
    }
  };

  r.get('/', auth, (c) => c.json(connectionStatuses(db, c.get('user').id)));

  r.get('/:provider/connect', auth, async (c) => c.redirect(await authorizeUrl(providerParam(c.req.param('provider')), c.get('user').id, 0)));

  r.get('/:provider/connect-url', auth, async (c) => c.json({ url: await authorizeUrl(providerParam(c.req.param('provider')), c.get('user').id, 1) }));

  r.get('/:provider/callback', async (c) => {
    const id = providerParam(c.req.param('provider'));
    const q = c.req.query();
    const st = readState(q.state, id);
    if (!st) return c.redirect(`/settings?${id}=error&reason=state`);
    const { userId, app, extra } = st;
    if (q.error) return c.redirect(landing(app, `${id}=error&reason=${encodeURIComponent(q.error)}`));
    if (!q.code) return c.redirect(landing(app, `${id}=error&reason=nocode`));
    try {
      // COROS's exchange takes the sealed PKCE verifier from the state where the others take the granted scope
      await connect(db, userId, id, q.code, id === 'coros' ? extra : (q.scope ?? null));
    } catch (e) {
      return c.redirect(landing(app, `${id}=error&reason=${encodeURIComponent(e instanceof Error ? e.message : 'token')}`));
    }
    syncInBackground(db, userId, id, { full: true });
    return c.redirect(landing(app, `${id}=connected`));
  });

  r.post('/:provider/disconnect', auth, async (c) => {
    const id = providerParam(c.req.param('provider'));
    await disconnect(db, c.get('user').id, id);
    return c.json(connectionStatus(db, c.get('user').id, id));
  });

  r.get('/:provider/status', auth, (c) => c.json(connectionStatus(db, c.get('user').id, providerParam(c.req.param('provider')))));

  r.post('/:provider/sync', auth, async (c) => {
    const id = providerParam(c.req.param('provider'));
    const userId = c.get('user').id;
    try {
      const out = await syncConnection(db, userId, id);
      // a joined sync is the background one the bootstrap started: it syncs the zones itself
      if (!out.joined && providerOf(id).zones) await syncZones(db, userId, id).catch(() => null);
      return c.json({ ...out, status: connectionStatus(db, userId, id) });
    } catch (e) {
      return toApiError(e);
    }
  });

  // ---------- webhooks: Strava calls GET once to verify, then POSTs events; COROS POSTs deliveries ----------
  r.get('/:provider/webhook', (c) => {
    providerParam(c.req.param('provider'));
    const q = c.req.query();
    if (q['hub.mode'] === 'subscribe' && q['hub.verify_token'] === env.STRAVA_WEBHOOK_VERIFY_TOKEN) return c.json({ 'hub.challenge': q['hub.challenge'] });
    throw new ApiError(403, 'Bad verify token');
  });

  r.post('/:provider/webhook', async (c) => {
    const id = providerParam(c.req.param('provider'));
    const body = (await c.req.json().catch(() => null)) as unknown;
    await handleWebhook(db, id, providerOf(id).parseWebhook(body, c.req.raw.headers));
    return c.json({ ok: true });
  });

  return r;
};
