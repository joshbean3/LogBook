import { env } from '../../env.js';
import { corosBucket } from './bucket.js';
import { ProviderError, type ConnectionRow, type Provider, type ProviderActivity, type ProviderDetail, type ProviderTokens, type WebhookEvent } from './types.js';

/**
 * COROS, through its self-service "Connect your data" OAuth app (https://open.coros.com). Wired end to end behind
 * COROS_CLIENT_ID / COROS_CLIENT_SECRET; the three endpoint roots come from env so a deployer can follow COROS's docs
 * without a code change.
 *
 * TODO confirm against COROS's developer docs before the first real connection:
 * - the authorize URL (`COROS_AUTH_URL`, default https://open.coros.com/oauth2/authorize) and its query names;
 * - the token exchange (`COROS_TOKEN_URL`, default https://open.coros.com/oauth2/accesstoken): form fields, and whether the
 *   answer is `{ access_token, refresh_token, openId, expires_in }` as mapped in `mapTokens`;
 * - the refresh endpoint (assumed `${COROS_TOKEN_URL}` with `grant_type=refresh_token`, else `/oauth2/refresh-token`);
 * - the activity list (`${COROS_API_URL}/v2/coros/sport/list?token&openId&startDate&endDate`, dates as YYYYMMDD, a
 *   window of at most 30 days per call) and the field names read in `mapActivity` (`labelId`, `mode`, `subMode`,
 *   `startTime`, `endTime`, `startTimezone` in quarter hours, `distance` in metres, `duration` in seconds,
 *   `avgHeartRate`, `maxHeartRate`, `avgFrequency`, `totalElevation`);
 * - the detail endpoint (`/v2/coros/sport/detail/query`) and its lap list, read in `mapDetail`;
 * - the webhook delivery shape (`{ sportDataList: [...] }` with the app's `client`/`secret` headers) and the
 *   deauthorization endpoint (`/oauth2/deauthorize`).
 */

const corosConfigured = () => env.corosConfigured;
const redirectUri = () => `${env.APP_URL}/api/connections/coros/callback`;

interface CorosTokens {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  openId?: string;
  open_id?: string;
  message?: string;
  result?: string;
}

/** Maps COROS's token answer onto ours; throws `needs_reauth` when the essentials are missing. */
export const mapTokens = (t: CorosTokens, prev?: Pick<ConnectionRow, 'refreshToken' | 'externalAthleteId' | 'athleteName' | 'scope'>): ProviderTokens => {
  const athleteId = t.openId ?? t.open_id ?? prev?.externalAthleteId;
  if (!t.access_token || !athleteId) throw new ProviderError(`COROS token answer was incomplete${t.message ? `: ${t.message}` : ''}.`, 'needs_reauth', 'coros');
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token ?? prev?.refreshToken ?? '',
    expiresAt: Math.floor(Date.now() / 1000) + (t.expires_in ?? 30 * 86400),
    scope: prev?.scope ?? null,
    athleteId,
    athleteName: prev?.athleteName ?? null,
  };
};

const tokenRequest = async (params: Record<string, string>): Promise<CorosTokens> => {
  const res = await fetch(env.COROS_TOKEN_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params).toString() });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 400 || res.status === 401) throw new ProviderError(`COROS rejected the token request: ${text.slice(0, 200)}`, 'needs_reauth', 'coros');
    throw new ProviderError(`COROS token endpoint returned ${res.status}`, 'unavailable', 'coros');
  }
  return (await res.json()) as CorosTokens;
};

const get = async <T>(path: string, query: Record<string, string>): Promise<T> => {
  corosBucket.take();
  const u = new URL(path, env.COROS_API_URL.endsWith('/') ? env.COROS_API_URL : `${env.COROS_API_URL}/`);
  for (const [k, v] of Object.entries(query)) u.searchParams.set(k, v);
  const res = await fetch(u.toString());
  if (res.status === 401 || res.status === 403) throw new ProviderError('COROS access was revoked. Reconnect it.', 'needs_reauth', 'coros');
  if (res.status === 429) {
    corosBucket.backoff();
    throw new ProviderError('COROS rate limit reached. Try again later.', 'rate_limited', 'coros');
  }
  if (!res.ok) throw new ProviderError(`COROS returned ${res.status} for ${path}`, 'unavailable', 'coros');
  const body = (await res.json()) as { result?: string; message?: string; data?: T };
  if (body.result && body.result !== '0000') {
    if (/token|auth/i.test(body.message ?? '')) throw new ProviderError(`COROS: ${body.message}`, 'needs_reauth', 'coros');
    throw new ProviderError(`COROS: ${body.message ?? body.result}`, 'unavailable', 'coros');
  }
  return (body.data ?? body) as T;
};

/** COROS sport modes (`mode`), as far as they are documented: 8 run, 9 bike, 10 swim, 13 triathlon, 14 ski, 15 fitness... */
const SPORT: Record<number, string> = { 8: 'Run', 9: 'Ride', 10: 'Swim', 13: 'Triathlon', 14: 'Ski', 15: 'Workout', 16: 'WeightTraining', 18: 'Hike', 19: 'Walk', 20: 'Row', 21: 'Climb', 24: 'Multisport' };

interface CorosSport {
  labelId: string | number;
  mode?: number;
  subMode?: number;
  name?: string;
  startTime?: number;
  endTime?: number;
  startTimezone?: number;
  distance?: number;
  duration?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  avgFrequency?: number;
  totalElevation?: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
const yyyymmdd = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;

/** Local start as `YYYY-MM-DDTHH:MM` from a unix start and COROS's quarter-hour time zone offset. */
export const mapActivity = (a: CorosSport): ProviderActivity => {
  const offsetSec = (a.startTimezone ?? 0) * 15 * 60;
  const local = new Date(((a.startTime ?? 0) + offsetSec) * 1000);
  const sport = a.mode != null ? (SPORT[a.mode] ?? `Mode${a.mode}`) : 'Workout';
  return {
    externalId: String(a.labelId),
    startLocal: `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`,
    name: a.name || sport,
    sportType: sport,
    distanceM: a.distance ?? 0,
    movingSec: a.duration ?? 0,
    elapsedSec: a.endTime && a.startTime ? a.endTime - a.startTime : (a.duration ?? 0),
    elevM: a.totalElevation ?? 0,
    avgHr: a.avgHeartRate ?? null,
    maxHr: a.maxHeartRate ?? null,
    cadence: a.avgFrequency ?? null,
    polyline: null,
  };
};

export const mapDetail = (d: { lapList?: Array<{ distance?: number; duration?: number; avgHeartRate?: number }>; avgHeartRate?: number; maxHeartRate?: number; avgFrequency?: number } | null): ProviderDetail | null => {
  if (!d) return null;
  return {
    laps: Array.isArray(d.lapList) ? d.lapList.slice(0, 60).map((l) => [Math.round(l.distance ?? 0), Math.round(l.duration ?? 0), l.avgHeartRate != null ? Math.round(l.avgHeartRate) : null]) : null,
    avgHr: d.avgHeartRate ?? null,
    maxHr: d.maxHeartRate ?? null,
    cadence: d.avgFrequency ?? null,
  };
};

export const corosProvider: Provider = {
  id: 'coros',
  name: 'COROS',
  get configured() {
    return corosConfigured();
  },
  authorizeUrl(state) {
    const u = new URL(env.COROS_AUTH_URL);
    u.searchParams.set('client_id', env.COROS_CLIENT_ID ?? '');
    u.searchParams.set('redirect_uri', redirectUri());
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('state', state);
    return u.toString();
  },
  async exchange(code, scope) {
    const t = await tokenRequest({ client_id: env.COROS_CLIENT_ID ?? '', client_secret: env.COROS_CLIENT_SECRET ?? '', redirect_uri: redirectUri(), code, grant_type: 'authorization_code' });
    return { ...mapTokens(t), scope };
  },
  async refresh(conn) {
    const t = await tokenRequest({ client_id: env.COROS_CLIENT_ID ?? '', client_secret: env.COROS_CLIENT_SECRET ?? '', refresh_token: conn.refreshToken, grant_type: 'refresh_token' });
    return mapTokens(t, conn);
  },
  async *listSince(conn, afterUnix) {
    // COROS lists by date window (30 days at most per call), newest last; the engine's "short page" is a window with nothing in it
    const end = new Date();
    let from = new Date(afterUnix * 1000);
    while (from <= end) {
      const to = new Date(Math.min(end.getTime(), from.getTime() + 29 * 86400_000));
      const list = await get<CorosSport[]>('v2/coros/sport/list', { token: conn.accessToken, openId: conn.externalAthleteId, startDate: yyyymmdd(from), endDate: yyyymmdd(to) });
      yield (Array.isArray(list) ? list : []).map(mapActivity);
      from = new Date(to.getTime() + 86400_000);
    }
  },
  async detail(conn, externalId) {
    try {
      const d = await get<Parameters<typeof mapDetail>[0]>('v2/coros/sport/detail/query', { token: conn.accessToken, openId: conn.externalAthleteId, labelId: externalId });
      return mapDetail(d);
    } catch (e) {
      if (e instanceof ProviderError && (e.code === 'rate_limited' || e.code === 'needs_reauth')) throw e;
      return null;
    }
  },
  /** COROS pushes `{ sportDataList: [{ openId, labelId, ... }] }` to the app's webhook; every entry is a create-or-update. */
  parseWebhook(body): WebhookEvent[] {
    const b = body as { sportDataList?: Array<{ openId?: string; labelId?: string | number }> } | null;
    if (!b || !Array.isArray(b.sportDataList)) return [];
    return b.sportDataList.filter((s) => s.openId && s.labelId != null).map((s) => ({ type: 'activity', aspect: 'update', athleteId: String(s.openId), externalId: String(s.labelId) }));
  },
  async revoke(conn) {
    try {
      const u = new URL('oauth2/deauthorize', env.COROS_API_URL.endsWith('/') ? env.COROS_API_URL : `${env.COROS_API_URL}/`);
      u.searchParams.set('token', conn.accessToken);
      await fetch(u.toString(), { method: 'POST' });
    } catch {
      /* already gone */
    }
  },
};
