import { shiftDays, today, type HrZone } from '@logbook/shared';
import { and, asc, eq, gte, isNull, lte, notInArray, sql } from 'drizzle-orm';
import type { DB } from '../../db/index.js';
import { activities, hrZones, providerConnections } from '../../db/schema.js';
import { nowISO, uid } from '../../lib/util.js';
import { corosProvider } from './coros.js';
import { stravaProvider } from './strava.js';
import { PROVIDER_IDS, ProviderError, type ConnectionRow, type Provider, type ProviderActivity, type ProviderId, type WebhookEvent } from './types.js';

export { ProviderError, PROVIDER_IDS, type ProviderId, type ConnectionRow } from './types.js';

export const PROVIDERS: Record<ProviderId, Provider> = { strava: stravaProvider, coros: corosProvider };
export const providerOf = (id: string): Provider => {
  const p = (PROVIDERS as Record<string, Provider>)[id];
  if (!p) throw new ProviderError(`Unknown provider ${id}.`, 'not_configured');
  return p;
};
export const isProviderId = (id: string): id is ProviderId => (PROVIDER_IDS as readonly string[]).includes(id);

/** On connect: the last 120 days. After that: everything since the last sync, less two days of slack for late uploads. */
export const SYNC_WINDOW_DAYS = 120;
export const INCREMENTAL_SLACK_DAYS = 2;
/** A failed detail fetch is tried again after this long. */
export const PERF_RETRY_MS = 24 * 3600_000;
const DETAIL_LIMIT = 12;

/** Turn a provider's sport type into the three kinds the plan knows about. */
export const kindOf = (sportType: string): 'run' | 'lift' | 'cross' => (/run/i.test(sportType) ? 'run' : /weight|workout|crossfit|strength|hiit|intensity/i.test(sportType) ? 'lift' : 'cross');

// ---------- connections ----------

export const connectionOf = (db: DB, userId: string, provider: ProviderId): ConnectionRow | undefined =>
  db.select().from(providerConnections).where(and(eq(providerConnections.userId, userId), eq(providerConnections.provider, provider))).get();

export const connectionsOf = (db: DB, userId: string): ConnectionRow[] => db.select().from(providerConnections).where(eq(providerConnections.userId, userId)).all();

export const allConnections = (db: DB): ConnectionRow[] => db.select().from(providerConnections).all();

/** Owner of a provider's athlete id, for webhook deliveries. */
export const userForAthlete = (db: DB, provider: ProviderId, athleteId: string): string | null =>
  db.select({ userId: providerConnections.userId }).from(providerConnections).where(and(eq(providerConnections.provider, provider), eq(providerConnections.externalAthleteId, athleteId))).get()?.userId ?? null;

/** Finish an OAuth dance: store the tokens. Refuses an athlete another account already holds (UNIQUE(provider, athlete)). */
export const connect = async (db: DB, userId: string, provider: ProviderId, code: string, scope: string | null): Promise<ConnectionRow> => {
  const p = providerOf(provider);
  const t = await p.exchange(code, scope);
  const taken = userForAthlete(db, provider, t.athleteId);
  if (taken && taken !== userId) throw new ProviderError(`That ${p.name} account is already connected to another Logbook account.`, 'needs_reauth', provider);
  const now = nowISO();
  const values = { externalAthleteId: t.athleteId, athleteName: t.athleteName, accessToken: t.accessToken, refreshToken: t.refreshToken, expiresAt: t.expiresAt, scope: t.scope, status: 'ok', lastError: null, connectedAt: now };
  db.insert(providerConnections)
    .values({ userId, provider, cursor: null, lastSyncAt: null, ...values })
    .onConflictDoUpdate({ target: [providerConnections.userId, providerConnections.provider], set: values })
    .run();
  return connectionOf(db, userId, provider)!;
};

/** Drop the connection, telling the provider first. The activities already here stay. */
export const disconnect = async (db: DB, userId: string, provider: ProviderId): Promise<void> => {
  const conn = connectionOf(db, userId, provider);
  if (!conn) return;
  if (conn.status !== 'revoked') await providerOf(provider).revoke(conn);
  db.delete(providerConnections).where(and(eq(providerConnections.userId, userId), eq(providerConnections.provider, provider))).run();
};

/** Account deletion: every connection revoked, best effort. */
export const revokeAll = async (db: DB, userId: string): Promise<void> => {
  for (const c of connectionsOf(db, userId)) await disconnect(db, userId, c.provider as ProviderId).catch(() => undefined);
};

const setConn = (db: DB, conn: ConnectionRow, set: Partial<ConnectionRow>) => db.update(providerConnections).set(set).where(and(eq(providerConnections.userId, conn.userId), eq(providerConnections.provider, conn.provider))).run();

/** A connection with a live token, refreshed when it is about to expire. */
const freshConnection = async (db: DB, userId: string, provider: ProviderId): Promise<ConnectionRow> => {
  const p = providerOf(provider);
  if (!p.configured) throw new ProviderError(`${p.name} isn’t configured on this server.`, 'not_configured', provider);
  const conn = connectionOf(db, userId, provider);
  if (!conn) throw new ProviderError(`${p.name} isn’t connected.`, 'not_connected', provider);
  if (conn.status === 'needs_reauth' || conn.status === 'revoked') throw new ProviderError(`${p.name} access was revoked. Reconnect it.`, 'needs_reauth', provider);
  if (conn.expiresAt * 1000 > Date.now() + 60_000) return conn;
  try {
    const t = await p.refresh(conn);
    setConn(db, conn, { accessToken: t.accessToken, refreshToken: t.refreshToken, expiresAt: t.expiresAt });
    return { ...conn, accessToken: t.accessToken, refreshToken: t.refreshToken, expiresAt: t.expiresAt };
  } catch (e) {
    if (e instanceof ProviderError && e.code === 'needs_reauth') setConn(db, conn, { status: 'needs_reauth', lastError: e.message });
    throw e;
  }
};

// ---------- activities ----------

/** The row id the client knows: the provider's id itself for Strava (what every cache already holds), prefixed otherwise; never another user's. */
const rowIdFor = (db: DB, userId: string, provider: ProviderId, externalId: string): string => {
  const base = provider === 'strava' ? externalId : `${provider}_${externalId}`;
  const cur = db.select({ userId: activities.userId }).from(activities).where(eq(activities.id, base)).get();
  return !cur || cur.userId === userId ? base : `${base}_${uid('', 5)}`;
};

/** Insert or update one listed activity. Returns whether anything changed. */
export const upsertActivity = (db: DB, userId: string, provider: ProviderId, a: ProviderActivity): boolean => {
  const row = {
    date: a.startLocal.slice(0, 10),
    time: a.startLocal.slice(11, 16),
    name: a.name,
    sportType: a.sportType,
    kind: kindOf(a.sportType),
    distanceM: a.distanceM,
    movingSec: a.movingSec,
    elapsedSec: a.elapsedSec,
    elevM: a.elevM,
    avgHr: a.avgHr,
    maxHr: a.maxHr,
    cadence: a.cadence,
    polyline: a.polyline,
    deletedAt: null,
    updatedAt: nowISO(),
  };
  const cur = db.select().from(activities).where(and(eq(activities.userId, userId), eq(activities.provider, provider), eq(activities.externalId, a.externalId))).get();
  if (!cur) {
    db.insert(activities).values({ id: rowIdFor(db, userId, provider, a.externalId), userId, provider, externalId: a.externalId, ...row, lapsJson: null, perfAt: null, perfFailed: 0, perfFailedAt: null, duplicateOf: null }).run();
    return true;
  }
  if (cur.distanceM !== row.distanceM || cur.movingSec !== row.movingSec || cur.name !== row.name || cur.date !== row.date || cur.time !== row.time || cur.deletedAt) {
    const reperf = cur.movingSec !== row.movingSec || cur.distanceM !== row.distanceM;
    db.update(activities)
      .set({ ...row, perfAt: reperf ? null : cur.perfAt, perfFailed: reperf ? 0 : cur.perfFailed, perfFailedAt: reperf ? null : cur.perfFailedAt })
      .where(eq(activities.id, cur.id))
      .run();
    return true;
  }
  return false;
};

/** Soft-delete one activity a webhook said is gone. */
export const removeActivity = (db: DB, userId: string, provider: ProviderId, externalId: string): boolean =>
  db.update(activities).set({ deletedAt: nowISO(), updatedAt: nowISO() }).where(and(eq(activities.userId, userId), eq(activities.provider, provider), eq(activities.externalId, externalId), isNull(activities.deletedAt))).run().changes > 0;

const localMinutes = (date: string, time: string | null): number => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const [hh, mm] = (time ?? '00:00').split(':').map(Number) as [number, number];
  return Date.UTC(y, m - 1, d, hh, mm) / 60_000;
};

/** Start within two minutes, distance within 2%. */
export const DEDUPE_MINUTES = 2;
export const DEDUPE_DISTANCE = 0.02;
export const looksLikeSame = (a: { date: string; time: string | null; distanceM: number }, b: { date: string; time: string | null; distanceM: number }): boolean => {
  if (Math.abs(localMinutes(a.date, a.time) - localMinutes(b.date, b.time)) > DEDUPE_MINUTES) return false;
  const max = Math.max(a.distanceM, b.distanceM);
  return max === 0 ? true : Math.abs(a.distanceM - b.distanceM) <= max * DEDUPE_DISTANCE;
};

/**
 * Cross-provider dedupe over a date window: an activity another provider also recorded (same start within two minutes,
 * distance within 2%) is marked `duplicate_of` the canonical one and left out of status and miles. The canonical row
 * belongs to the provider connected first; a row whose twin is gone is cleared.
 */
export const dedupeActivities = (db: DB, userId: string, from: string, to: string): number => {
  const order = new Map(
    connectionsOf(db, userId)
      .sort((a, b) => a.connectedAt.localeCompare(b.connectedAt))
      .map((c, i) => [c.provider, i]),
  );
  const rank = (p: string) => order.get(p) ?? 99;
  const rows = db
    .select({ id: activities.id, provider: activities.provider, date: activities.date, time: activities.time, distanceM: activities.distanceM, duplicateOf: activities.duplicateOf })
    .from(activities)
    .where(and(eq(activities.userId, userId), isNull(activities.deletedAt), gte(activities.date, from), lte(activities.date, to)))
    .orderBy(asc(activities.date), asc(activities.time))
    .all();
  const want = new Map<string, string | null>(rows.map((r) => [r.id, null]));
  for (const a of rows) {
    if (want.get(a.id)) continue;
    for (const b of rows) {
      if (b.id === a.id || b.provider === a.provider || want.get(b.id)) continue;
      if (!looksLikeSame(a, b)) continue;
      const [keep, dup] = rank(a.provider) <= rank(b.provider) ? [a, b] : [b, a];
      want.set(dup.id, keep.id);
    }
  }
  let changed = 0;
  for (const r of rows) {
    const next = want.get(r.id) ?? null;
    if ((r.duplicateOf ?? null) !== next) {
      db.update(activities).set({ duplicateOf: next }).where(eq(activities.id, r.id)).run();
      changed++;
    }
  }
  return changed;
};

// ---------- sync ----------

/** One sync per connection at a time: the promise of the one running, so a second ask joins it instead of racing it. */
const inflight = new Map<string, Promise<SyncResult>>();
const key = (userId: string, provider: ProviderId) => `${userId}:${provider}`;
export const isSyncing = (userId: string, provider?: ProviderId) => (provider ? inflight.has(key(userId, provider)) : [...inflight.keys()].some((k) => k.startsWith(`${userId}:`)));

export interface SyncResult {
  changed: number;
  joined?: true;
}

/**
 * Sync one connection: list everything since the cursor (the last 120 days on connect, the last sync less two days after
 * that), upsert, and only when the whole listing came through soft-delete what the provider no longer lists in that
 * window. Then details for runs that lack them (a failed fetch is retried after 24 hours), then the cross-provider
 * dedupe. A sync already running for the connection is joined (`joined: true`).
 */
export const syncConnection = (db: DB, userId: string, provider: ProviderId, opts: { full?: boolean; detailLimit?: number } = {}): Promise<SyncResult> => {
  const k = key(userId, provider);
  const running = inflight.get(k);
  if (running) return running.then((r) => ({ ...r, joined: true }));
  const run = syncNow(db, userId, provider, opts).finally(() => inflight.delete(k));
  inflight.set(k, run);
  return run;
};

const syncNow = async (db: DB, userId: string, provider: ProviderId, opts: { full?: boolean; detailLimit?: number }): Promise<SyncResult> => {
  const p = providerOf(provider);
  let conn: ConnectionRow | undefined;
  try {
    conn = await freshConnection(db, userId, provider);
    const fullWindow = opts.full || !conn.lastSyncAt;
    const afterMs = fullWindow ? Date.now() - SYNC_WINDOW_DAYS * 864e5 : new Date(conn.lastSyncAt!).getTime() - INCREMENTAL_SLACK_DAYS * 864e5;
    const afterUnix = Math.floor(afterMs / 1000);
    const from = new Date(afterMs).toISOString().slice(0, 10);
    const seen: string[] = [];
    let changed = 0;
    // every page lands as it comes; a throw midway leaves `complete` false and nothing is deleted
    let complete = false;
    try {
      for await (const page of p.listSince(conn, afterUnix)) {
        for (const a of page) {
          seen.push(a.externalId);
          if (upsertActivity(db, userId, provider, a)) changed++;
        }
      }
      complete = true;
    } catch (e) {
      if (!seen.length) throw e;
      setConn(db, conn, { lastError: e instanceof Error ? e.message : String(e) });
    }
    if (complete) {
      const stale = db
        .select({ id: activities.id })
        .from(activities)
        .where(and(eq(activities.userId, userId), eq(activities.provider, provider), isNull(activities.deletedAt), gte(activities.date, from), seen.length ? notInArray(activities.externalId, seen) : undefined))
        .all();
      for (const s of stale) db.update(activities).set({ deletedAt: nowISO(), updatedAt: nowISO() }).where(eq(activities.id, s.id)).run();
      changed += stale.length;
    }

    // details for runs: laps and heart rate, newest first, a handful per sync to respect rate limits
    const retryBefore = new Date(Date.now() - PERF_RETRY_MS).toISOString();
    const need = db
      .select()
      .from(activities)
      .where(and(eq(activities.userId, userId), eq(activities.provider, provider), isNull(activities.deletedAt), isNull(activities.duplicateOf), eq(activities.kind, 'run'), isNull(activities.perfAt), sql`(${activities.perfFailedAt} is null or ${activities.perfFailedAt} < ${retryBefore})`))
      .all()
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, opts.detailLimit ?? DETAIL_LIMIT);
    for (const a of need) {
      try {
        const d = await p.detail(conn, a.externalId);
        db.update(activities)
          .set(d ? { lapsJson: d.laps ? JSON.stringify(d.laps) : null, avgHr: d.avgHr ?? a.avgHr, maxHr: d.maxHr ?? a.maxHr, cadence: d.cadence ?? a.cadence, perfAt: nowISO(), perfFailed: 0, perfFailedAt: null } : { perfAt: nowISO() })
          .where(eq(activities.id, a.id))
          .run();
        changed++;
      } catch (e) {
        if (e instanceof ProviderError && (e.code === 'rate_limited' || e.code === 'needs_reauth')) break;
        db.update(activities).set({ perfFailed: a.perfFailed + 1, perfFailedAt: nowISO() }).where(eq(activities.id, a.id)).run();
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    dedupeActivities(db, userId, from, shiftDays(today(), 1));
    if (complete) setConn(db, conn, { lastSyncAt: nowISO(), lastError: null, status: 'ok' });
    return { changed };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const c = conn ?? connectionOf(db, userId, provider);
    if (c) setConn(db, c, { lastError: msg, ...(e instanceof ProviderError && e.code === 'needs_reauth' ? { status: 'needs_reauth' } : {}) });
    throw e;
  }
};

/** Heart-rate zones from a provider that publishes them (Strava). */
export const syncZones = async (db: DB, userId: string, provider: ProviderId = 'strava'): Promise<HrZone[] | null> => {
  const p = providerOf(provider);
  if (!p.zones) return null;
  const conn = await freshConnection(db, userId, provider);
  const zones = await p.zones(conn);
  if (!zones) return null;
  db.insert(hrZones).values({ userId, zonesJson: JSON.stringify(zones), fetchedAt: nowISO() }).onConflictDoUpdate({ target: hrZones.userId, set: { zonesJson: JSON.stringify(zones), fetchedAt: nowISO() } }).run();
  return zones;
};

/** Kick off a sync without blocking the request; errors are recorded on the connection. */
export const syncInBackground = (db: DB, userId: string, provider: ProviderId, opts: { full?: boolean } = {}) => {
  void (async () => {
    try {
      await syncConnection(db, userId, provider, opts);
      if (providerOf(provider).zones) await syncZones(db, userId, provider);
    } catch (e) {
      console.warn(`${provider} sync failed:`, e instanceof Error ? e.message : e);
    }
  })();
};

/** The 20-minute loop: every connection that still works (never one waiting for a reconnect). */
export const syncAllConnections = (db: DB) => {
  for (const c of allConnections(db)) {
    if (c.status === 'needs_reauth' || c.status === 'revoked') continue;
    if (!providerOf(c.provider).configured) continue;
    syncInBackground(db, c.userId, c.provider as ProviderId);
  }
};

// ---------- webhooks ----------

/** Act on a provider's webhook events: a changed activity resyncs (or is removed), a deauthorization disconnects. */
export const handleWebhook = async (db: DB, provider: ProviderId, events: WebhookEvent[]): Promise<void> => {
  for (const ev of events) {
    const userId = userForAthlete(db, provider, ev.athleteId);
    if (!userId) continue;
    if (ev.type === 'deauthorize') {
      // the provider already revoked it: no call back to them
      db.delete(providerConnections).where(and(eq(providerConnections.userId, userId), eq(providerConnections.provider, provider))).run();
      continue;
    }
    if (ev.aspect === 'delete') {
      removeActivity(db, userId, provider, ev.externalId);
      continue;
    }
    setTimeout(() => syncInBackground(db, userId, provider), 1500);
  }
};

// ---------- status ----------

export type ConnectionState = 'ok' | 'needs_reauth' | 'error' | 'revoked' | 'disconnected';
export interface ConnectionStatus {
  provider: ProviderId;
  name: string;
  configured: boolean;
  connected: boolean;
  status: ConnectionState;
  athleteName: string | null;
  lastSyncAt: string | null;
  syncing: boolean;
  error: string | null;
}

export const connectionStatus = (db: DB, userId: string, provider: ProviderId): ConnectionStatus => {
  const p = providerOf(provider);
  const c = connectionOf(db, userId, provider);
  return {
    provider,
    name: p.name,
    configured: p.configured,
    connected: !!c,
    status: !c ? 'disconnected' : c.status === 'needs_reauth' || c.status === 'revoked' ? (c.status as ConnectionState) : c.lastError ? 'error' : 'ok',
    athleteName: c?.athleteName ?? null,
    lastSyncAt: c?.lastSyncAt ?? null,
    syncing: isSyncing(userId, provider),
    error: c?.lastError ?? null,
  };
};

export const connectionStatuses = (db: DB, userId: string): ConnectionStatus[] => PROVIDER_IDS.map((p) => connectionStatus(db, userId, p));

