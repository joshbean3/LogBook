import { env } from '../../env.js';
import { stravaBucket } from './bucket.js';
import { ProviderError, type ConnectionRow, type Provider, type ProviderActivity, type ProviderDetail, type ProviderTokens, type WebhookEvent } from './types.js';

const API = 'https://www.strava.com/api/v3';
const PER_PAGE = 100;
const MAX_PAGES = 10;

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { id: number; firstname?: string; lastname?: string };
}

const tokenRequest = async (params: Record<string, string>): Promise<TokenResponse> => {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: env.STRAVA_CLIENT_ID, client_secret: env.STRAVA_CLIENT_SECRET, ...params }),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 400 || res.status === 401) throw new ProviderError(`Strava rejected the token request: ${text.slice(0, 200)}`, 'needs_reauth', 'strava');
    throw new ProviderError(`Strava token endpoint returned ${res.status}`, 'unavailable', 'strava');
  }
  return (await res.json()) as TokenResponse;
};

const get = async <T>(token: string, path: string): Promise<T> => {
  stravaBucket.take();
  const res = await fetch(`${API}${path}`, { headers: { authorization: `Bearer ${token}` } });
  if (res.status === 401) throw new ProviderError('Strava access was revoked. Reconnect it.', 'needs_reauth', 'strava');
  if (res.status === 429) {
    stravaBucket.backoff();
    throw new ProviderError('Strava rate limit reached. Try again in 15 minutes.', 'rate_limited', 'strava');
  }
  if (!res.ok) throw new ProviderError(`Strava returned ${res.status} for ${path}`, 'unavailable', 'strava');
  return (await res.json()) as T;
};

interface SummaryActivity {
  id: number;
  name: string;
  sport_type?: string;
  type?: string;
  start_date_local: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_cadence?: number;
  has_heartrate?: boolean;
  map?: { summary_polyline?: string | null };
}
interface DetailedActivity extends SummaryActivity {
  laps?: Array<{ distance: number; moving_time: number; average_heartrate?: number }>;
}

const toActivity = (a: SummaryActivity): ProviderActivity => {
  const sport = a.sport_type ?? a.type ?? 'Workout';
  return {
    externalId: String(a.id),
    startLocal: a.start_date_local.slice(0, 16),
    name: a.name || sport,
    sportType: sport,
    distanceM: a.distance ?? 0,
    movingSec: a.moving_time ?? 0,
    elapsedSec: a.elapsed_time ?? 0,
    elevM: a.total_elevation_gain ?? 0,
    avgHr: a.has_heartrate === false ? null : a.average_heartrate != null ? Math.round(a.average_heartrate) : null,
    maxHr: a.has_heartrate === false ? null : a.max_heartrate != null ? Math.round(a.max_heartrate) : null,
    cadence: a.average_cadence ? Math.round(a.average_cadence * 2) : null,
    polyline: a.map?.summary_polyline || null,
  };
};

export const stravaProvider: Provider = {
  id: 'strava',
  name: 'Strava',
  get configured() {
    return env.stravaConfigured;
  },
  authorizeUrl(state) {
    const u = new URL('https://www.strava.com/oauth/authorize');
    u.searchParams.set('client_id', env.STRAVA_CLIENT_ID ?? '');
    u.searchParams.set('redirect_uri', `${env.APP_URL}/api/strava/callback`);
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('approval_prompt', 'auto');
    u.searchParams.set('scope', 'read,activity:read_all,profile:read_all');
    u.searchParams.set('state', state);
    return u.toString();
  },
  async exchange(code, scope) {
    const t = await tokenRequest({ code, grant_type: 'authorization_code' });
    return { accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: t.expires_at, scope, athleteId: String(t.athlete?.id ?? ''), athleteName: [t.athlete?.firstname, t.athlete?.lastname].filter(Boolean).join(' ') || null };
  },
  async refresh(conn) {
    const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: conn.refreshToken });
    return { accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: t.expires_at, scope: conn.scope, athleteId: conn.externalAthleteId, athleteName: conn.athleteName };
  },
  async *listSince(conn, afterUnix) {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const list = await get<SummaryActivity[]>(conn.accessToken, `/athlete/activities?after=${afterUnix}&per_page=${PER_PAGE}&page=${page}`);
      yield list.map(toActivity);
      if (list.length < PER_PAGE) return;
    }
  },
  async detail(conn, externalId): Promise<ProviderDetail> {
    const d = await get<DetailedActivity>(conn.accessToken, `/activities/${externalId}?include_all_efforts=false`);
    return {
      laps: Array.isArray(d.laps) ? d.laps.slice(0, 60).map((l) => [Math.round(l.distance || 0), Math.round(l.moving_time || 0), l.average_heartrate != null ? Math.round(l.average_heartrate) : null]) : null,
      avgHr: d.has_heartrate === false ? null : d.average_heartrate != null ? Math.round(d.average_heartrate) : null,
      maxHr: d.has_heartrate === false ? null : d.max_heartrate != null ? Math.round(d.max_heartrate) : null,
      cadence: d.average_cadence ? Math.round(d.average_cadence * 2) : null,
    };
  },
  /**
   * Strava's events: `{ object_type: 'activity'|'athlete', aspect_type: 'create'|'update'|'delete', object_id, owner_id,
   * updates: { authorized: 'false' } }`. An athlete update with `authorized: false` is a deauthorization.
   */
  parseWebhook(body): WebhookEvent[] {
    const b = body as { object_type?: string; aspect_type?: string; object_id?: number | string; owner_id?: number | string; updates?: Record<string, string> } | null;
    if (!b || b.owner_id == null) return [];
    const athleteId = String(b.owner_id);
    if (b.object_type === 'athlete') return b.updates?.authorized === 'false' ? [{ type: 'deauthorize', athleteId }] : [];
    if (b.object_type === 'activity' && b.object_id != null) {
      const aspect = b.aspect_type === 'delete' ? 'delete' : b.aspect_type === 'update' ? 'update' : 'create';
      return [{ type: 'activity', aspect, athleteId, externalId: String(b.object_id) }];
    }
    return [];
  },
  async revoke(conn) {
    try {
      await fetch('https://www.strava.com/oauth/deauthorize', { method: 'POST', headers: { authorization: `Bearer ${conn.accessToken}` } });
    } catch {
      /* Strava may already have revoked it */
    }
  },
  async zones(conn) {
    const z = await get<{ heart_rate?: { zones?: Array<{ min: number; max: number }> } }>(conn.accessToken, '/athlete/zones');
    const list = z.heart_rate?.zones;
    if (!Array.isArray(list) || !list.length) return null;
    return list.map((r, i) => ({ zone: i + 1, min: r.min ?? 0, max: r.max == null || r.max === -1 ? null : r.max }));
  },
};
