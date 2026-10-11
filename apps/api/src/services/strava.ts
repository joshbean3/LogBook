import { shiftDays, today, type HrZone, type Lap, type StravaStatus } from '@logbook/shared';
import { and, eq, gte, isNull, notInArray } from 'drizzle-orm';
import type { DB } from '../db/index.js';
import { activities, hrZones, stravaAccounts } from '../db/schema.js';
import { env } from '../env.js';
import { nowISO } from '../lib/util.js';

const API = 'https://www.strava.com/api/v3';
const SYNC_WINDOW_DAYS = 120;

export class StravaError extends Error {
  constructor(
    message: string,
    public code: 'not_connected' | 'needs_reauth' | 'rate_limited' | 'unavailable' | 'not_configured',
  ) {
    super(message);
  }
}

/** Turn Strava's sport_type into the three kinds the plan knows about. */
export const kindOf = (sportType: string): 'run' | 'lift' | 'cross' => (/run/i.test(sportType) ? 'run' : /weight|workout|crossfit|strength|hiit|intensity/i.test(sportType) ? 'lift' : 'cross');

export const authorizeUrl = (state: string) => {
  const u = new URL('https://www.strava.com/oauth/authorize');
  u.searchParams.set('client_id', env.STRAVA_CLIENT_ID ?? '');
  u.searchParams.set('redirect_uri', `${env.APP_URL}/api/strava/callback`);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('approval_prompt', 'auto');
  u.searchParams.set('scope', 'read,activity:read_all,profile:read_all');
  u.searchParams.set('state', state);
  return u.toString();
};

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
    if (res.status === 400 || res.status === 401) throw new StravaError(`Strava rejected the token request: ${text.slice(0, 200)}`, 'needs_reauth');
    throw new StravaError(`Strava token endpoint returned ${res.status}`, 'unavailable');
  }
  return (await res.json()) as TokenResponse;
};

export const exchangeCode = async (db: DB, userId: string, code: string, scope: string | null) => {
  const t = await tokenRequest({ code, grant_type: 'authorization_code' });
  const name = [t.athlete?.firstname, t.athlete?.lastname].filter(Boolean).join(' ') || null;
  db.insert(stravaAccounts)
    .values({ userId, athleteId: String(t.athlete?.id ?? ''), athleteName: name, accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: t.expires_at, scope, connectedAt: nowISO(), lastSyncAt: null, lastError: null })
    .onConflictDoUpdate({ target: stravaAccounts.userId, set: { athleteId: String(t.athlete?.id ?? ''), athleteName: name, accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: t.expires_at, scope, connectedAt: nowISO(), lastError: null } })
    .run();
};

export const disconnect = async (db: DB, userId: string) => {
  const acct = db.select().from(stravaAccounts).where(eq(stravaAccounts.userId, userId)).get();
  if (acct) {
    try {
      await fetch('https://www.strava.com/oauth/deauthorize', { method: 'POST', headers: { authorization: `Bearer ${acct.accessToken}` } });
    } catch {
      /* Strava may already have revoked it */
    }
    db.delete(stravaAccounts).where(eq(stravaAccounts.userId, userId)).run();
  }
};

const accessToken = async (db: DB, userId: string): Promise<string> => {
  if (!env.stravaConfigured) throw new StravaError('Strava isn’t configured on this server.', 'not_configured');
  const acct = db.select().from(stravaAccounts).where(eq(stravaAccounts.userId, userId)).get();
  if (!acct) throw new StravaError('Strava isn’t connected.', 'not_connected');
  if (acct.expiresAt * 1000 > Date.now() + 60_000) return acct.accessToken;
  const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: acct.refreshToken });
  db.update(stravaAccounts).set({ accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: t.expires_at }).where(eq(stravaAccounts.userId, userId)).run();
  return t.access_token;
};

const get = async <T>(token: string, path: string): Promise<T> => {
  const res = await fetch(`${API}${path}`, { headers: { authorization: `Bearer ${token}` } });
  if (res.status === 401) throw new StravaError('Strava access was revoked. Reconnect it.', 'needs_reauth');
  if (res.status === 429) throw new StravaError('Strava rate limit reached. Try again in 15 minutes.', 'rate_limited');
  if (!res.ok) throw new StravaError(`Strava returned ${res.status} for ${path}`, 'unavailable');
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

const syncing = new Set<string>();
export const isSyncing = (userId: string) => syncing.has(userId);

/**
 * Pull the last 120 days of activities, upsert summaries, then fetch laps + heart rate for runs that
 * haven't been detailed yet. Activities that vanished from Strava are soft-deleted.
 */
export const syncActivities = async (db: DB, userId: string, opts: { detailLimit?: number } = {}) => {
  if (syncing.has(userId)) return { skipped: true };
  syncing.add(userId);
  try {
    const token = await accessToken(db, userId);
    const after = Math.floor((Date.now() - SYNC_WINDOW_DAYS * 864e5) / 1000);
    const seen: string[] = [];
    let changed = 0;
    for (let page = 1; page <= 5; page++) {
      const list = await get<SummaryActivity[]>(token, `/athlete/activities?after=${after}&per_page=100&page=${page}`);
      for (const a of list) {
        const id = String(a.id);
        seen.push(id);
        const sport = a.sport_type ?? a.type ?? 'Workout';
        const row = {
          userId,
          date: a.start_date_local.slice(0, 10),
          time: a.start_date_local.slice(11, 16),
          name: a.name || sport,
          sportType: sport,
          kind: kindOf(sport),
          distanceM: a.distance ?? 0,
          movingSec: a.moving_time ?? 0,
          elapsedSec: a.elapsed_time ?? 0,
          elevM: a.total_elevation_gain ?? 0,
          avgHr: a.has_heartrate === false ? null : a.average_heartrate != null ? Math.round(a.average_heartrate) : null,
          maxHr: a.has_heartrate === false ? null : a.max_heartrate != null ? Math.round(a.max_heartrate) : null,
          cadence: a.average_cadence ? Math.round(a.average_cadence * 2) : null,
          polyline: a.map?.summary_polyline || null,
          deletedAt: null,
          updatedAt: nowISO(),
        };
        const cur = db.select().from(activities).where(eq(activities.id, id)).get();
        if (!cur) {
          db.insert(activities).values({ id, ...row, lapsJson: null, perfAt: null, perfFailed: 0 }).run();
          changed++;
        } else if (cur.distanceM !== row.distanceM || cur.movingSec !== row.movingSec || cur.name !== row.name || cur.date !== row.date || cur.deletedAt) {
          db.update(activities).set({ ...row, perfAt: cur.movingSec !== row.movingSec || cur.distanceM !== row.distanceM ? null : cur.perfAt }).where(eq(activities.id, id)).run();
          changed++;
        }
      }
      if (list.length < 100) break;
    }
    // gone from Strava inside the window: hide them here too
    const cutoff = shiftDays(today(), -SYNC_WINDOW_DAYS);
    const stale = db
      .select({ id: activities.id })
      .from(activities)
      .where(and(eq(activities.userId, userId), isNull(activities.deletedAt), gte(activities.date, cutoff), seen.length ? notInArray(activities.id, seen) : undefined))
      .all();
    for (const s of stale) db.update(activities).set({ deletedAt: nowISO() }).where(eq(activities.id, s.id)).run();

    // details for runs: laps and heart rate, newest first, a handful per sync to respect rate limits
    const need = db
      .select()
      .from(activities)
      .where(and(eq(activities.userId, userId), isNull(activities.deletedAt), eq(activities.kind, 'run'), isNull(activities.perfAt), eq(activities.perfFailed, 0)))
      .all()
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, opts.detailLimit ?? 12);
    for (const a of need) {
      try {
        const d = await get<DetailedActivity>(token, `/activities/${a.id}?include_all_efforts=false`);
        const laps: Lap[] | null = Array.isArray(d.laps) ? d.laps.slice(0, 60).map((l) => [Math.round(l.distance || 0), Math.round(l.moving_time || 0), l.average_heartrate != null ? Math.round(l.average_heartrate) : null]) : null;
        db.update(activities)
          .set({
            lapsJson: laps ? JSON.stringify(laps) : null,
            avgHr: d.has_heartrate === false ? null : d.average_heartrate != null ? Math.round(d.average_heartrate) : a.avgHr,
            maxHr: d.has_heartrate === false ? null : d.max_heartrate != null ? Math.round(d.max_heartrate) : a.maxHr,
            cadence: d.average_cadence ? Math.round(d.average_cadence * 2) : a.cadence,
            perfAt: nowISO(),
          })
          .where(eq(activities.id, a.id))
          .run();
        changed++;
      } catch (e) {
        if (e instanceof StravaError && e.code === 'rate_limited') break;
        db.update(activities).set({ perfFailed: 1 }).where(eq(activities.id, a.id)).run();
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    db.update(stravaAccounts).set({ lastSyncAt: nowISO(), lastError: null }).where(eq(stravaAccounts.userId, userId)).run();
    return { changed };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    db.update(stravaAccounts).set({ lastError: msg }).where(eq(stravaAccounts.userId, userId)).run();
    throw e;
  } finally {
    syncing.delete(userId);
  }
};

export const syncZones = async (db: DB, userId: string) => {
  const token = await accessToken(db, userId);
  const z = await get<{ heart_rate?: { zones?: Array<{ min: number; max: number }> } }>(token, '/athlete/zones');
  const list = z.heart_rate?.zones;
  if (!Array.isArray(list) || !list.length) return null;
  const zones: HrZone[] = list.map((r, i) => ({ zone: i + 1, min: r.min ?? 0, max: r.max == null || r.max === -1 ? null : r.max }));
  db.insert(hrZones).values({ userId, zonesJson: JSON.stringify(zones), fetchedAt: nowISO() }).onConflictDoUpdate({ target: hrZones.userId, set: { zonesJson: JSON.stringify(zones), fetchedAt: nowISO() } }).run();
  return zones;
};

export const stravaStatus = (db: DB, userId: string): StravaStatus => {
  const acct = db.select().from(stravaAccounts).where(eq(stravaAccounts.userId, userId)).get();
  return {
    configured: env.stravaConfigured,
    connected: !!acct,
    athleteName: acct?.athleteName ?? null,
    lastSyncAt: acct?.lastSyncAt ?? null,
    syncing: syncing.has(userId),
    error: acct?.lastError ?? null,
  };
};

/** Owner of a Strava athlete id, for webhook deliveries. */
export const userForAthlete = (db: DB, athleteId: string) => db.select({ userId: stravaAccounts.userId }).from(stravaAccounts).where(eq(stravaAccounts.athleteId, athleteId)).get()?.userId ?? null;
