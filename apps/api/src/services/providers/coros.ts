import { z } from 'zod';
import type { DB } from '../../db/index.js';
import { env } from '../../env.js';
import { corosBucket } from './bucket.js';
import { McpClient, toolData, type McpTool } from './mcp.js';
import * as oauth from './oauth.js';
import { ProviderError, type ConnectionRow, type Provider, type ProviderActivity, type ProviderDetail, type ProviderTokens, type WebhookEvent } from './types.js';

/**
 * COROS, as a client of its official MCP server (https://mcp.coros.com/mcp), the one route COROS offers without a
 * partner application. The server registers itself as an OAuth client on the first connect (`oauth.ts`), then reads
 * activities with the server's tools over JSON-RPC (`mcp.ts`): `querySportRecords` for a date window,
 * `getActivityDetail` and `queryActivityLapData` per activity, `queryUserInfo` once to name the account.
 *
 * What is verified: the discovery chain, the endpoints, PKCE S256, the token lifetimes (30 days, refresh 180 days,
 * rotating), the tool names. What is NOT: the tools' argument and result field names. So the mapping below is an
 * adapter, not a contract: argument names are taken from the server's own `tools/list` schema (falling back to the
 * likeliest names), results are read with a passthrough schema and tolerant field picking, and the first record that
 * cannot be mapped is logged once at debug level. Everything that guesses lives in this file.
 *
 * COROS has no webhook: the 20-minute loop is the only way activities arrive.
 */

export const COROS_SCOPE = 'openid mcp.tools offline_access';
/** One `querySportRecords` call covers at most this many days; the sync window is walked in such steps. */
export const COROS_WINDOW_DAYS = 30;

const TOOLS = { records: 'querySportRecords', detail: 'getActivityDetail', laps: 'queryActivityLapData', user: 'queryUserInfo' } as const;

// ---------- wiring: discovery, the registered client, the store ----------

/** The database the registered client is kept in. Bound by the connection routes; refresh and revoke have no other way to it. */
let store: DB | null = null;
export const bindCorosStore = (db: DB) => {
  store = db;
};

const discovery = () => oauth.discover(env.COROS_MCP_URL, 'coros');

const client = async (db: DB | null = store): Promise<oauth.OAuthClient> => {
  const d = await discovery();
  if (!db) {
    if (env.COROS_CLIENT_ID) return { clientId: env.COROS_CLIENT_ID, clientSecret: env.COROS_CLIENT_SECRET ?? null };
    throw new ProviderError('COROS’s client registration store is not bound.', 'not_configured', 'coros');
  }
  return oauth.ensureClient(db, 'coros', d, COROS_SCOPE, { envClientId: env.COROS_CLIENT_ID, envClientSecret: env.COROS_CLIENT_SECRET });
};

const mcpFor = async (conn: Pick<ConnectionRow, 'accessToken'>): Promise<McpClient> => new McpClient((await discovery()).endpoint, conn.accessToken, 'coros', corosBucket);

/**
 * The connect route's half of the OAuth dance, async because it discovers and registers: a PKCE pair, the verifier
 * sealed into the state the caller signs, the authorize URL. `exchange` gets the sealed verifier back as its second
 * argument (the Provider interface has no slot for it, so for COROS that argument is the handoff, not a scope).
 */
export const corosAuthorizeUrl = async (db: DB, makeState: (sealed: string) => string): Promise<string> => {
  const d = await discovery();
  const c = await client(db);
  const pkce = oauth.newPkce();
  const state = makeState(oauth.sealPkce({ verifier: pkce.verifier, issuer: d.issuer }));
  return oauth.authorizeUrl(d, c, { provider: 'coros', state, challenge: pkce.challenge, scope: COROS_SCOPE });
};

/** Tests: forget the tool schemas and the sport types seen. */
export const resetCoros = () => {
  shapes.clear();
  sportOf.clear();
  loggedSample = false;
};

// ---------- tokens ----------

interface CorosTokens {
  access_token?: string;
  refresh_token?: string;
  /** Seconds from now (COROS's OAuth answer) ... */
  expires_in?: number;
  /** ... or unix seconds (an already computed token set). */
  expires_at?: number;
  scope?: string | null;
  openId?: string;
  open_id?: string;
  message?: string;
}

/** Maps a token answer onto ours; throws `needs_reauth` when the essentials are missing. */
export const mapTokens = (t: CorosTokens, prev?: Pick<ConnectionRow, 'refreshToken' | 'externalAthleteId' | 'athleteName' | 'scope'>, athleteName: string | null = null): ProviderTokens => {
  const athleteId = t.openId ?? t.open_id ?? prev?.externalAthleteId;
  if (!t.access_token || !athleteId) throw new ProviderError(`COROS token answer was incomplete${t.message ? `: ${t.message}` : ''}.`, 'needs_reauth', 'coros');
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token ?? prev?.refreshToken ?? '',
    expiresAt: t.expires_at ?? Math.floor(Date.now() / 1000) + (t.expires_in ?? 30 * 86400),
    scope: t.scope ?? prev?.scope ?? null,
    athleteId,
    athleteName: athleteName ?? prev?.athleteName ?? null,
  };
};

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
/** The first of `keys` present on `o` (case-insensitive), as a string / number. */
const pickStr = (o: Record<string, unknown>, keys: string[]): string | null => {
  for (const k of keys) {
    const v = str(o[k] ?? o[k.toLowerCase()] ?? o[k.toUpperCase()]);
    if (v != null) return v;
  }
  return null;
};
const pickNum = (o: Record<string, unknown>, keys: string[]): number | null => {
  for (const k of keys) {
    const v = num(o[k] ?? o[k.toLowerCase()]);
    if (v != null) return v;
  }
  return null;
};

/** Who the tokens belong to: the id_token's subject, else what `queryUserInfo` says. The name is best effort. */
const identify = async (mcp: McpClient, idToken: string | null): Promise<{ id: string; name: string | null }> => {
  const sub = oauth.idTokenSubject(idToken);
  let info: Record<string, unknown> | null = null;
  try {
    const data = toolData(await mcp.callTool(TOOLS.user, {}));
    info = obj(data) ? (obj(obj(data)!.data) ?? obj(obj(data)!.user) ?? obj(data)) : null;
  } catch (e) {
    if (e instanceof ProviderError && (e.code === 'needs_reauth' || e.code === 'rate_limited')) throw e;
  }
  const id = sub ?? (info ? pickStr(info, ['userId', 'openId', 'id', 'uid', 'sub', 'accountId', 'email']) : null);
  if (!id) throw new ProviderError('COROS did not say which account was connected.', 'needs_reauth', 'coros');
  const name = info ? pickStr(info, ['nickname', 'nickName', 'name', 'userName', 'displayName']) : null;
  return { id, name };
};

// ---------- the tools' argument names, from the server's own schemas ----------

interface Prop {
  type?: string | string[];
  format?: string;
  description?: string;
}
interface Shape {
  props: Record<string, Prop>;
  required: string[];
}
const shapes = new Map<string, Promise<Map<string, Shape>>>();

const toolShapes = (mcp: McpClient): Promise<Map<string, Shape>> => {
  const hit = shapes.get(mcp.endpoint);
  if (hit) return hit;
  const run = mcp
    .listTools()
    .then((tools: McpTool[]) => new Map(tools.map((t) => [t.name, { props: (t.inputSchema?.properties ?? {}) as Record<string, Prop>, required: t.inputSchema?.required ?? [] }])))
    .catch((e: unknown) => {
      shapes.delete(mcp.endpoint);
      if (e instanceof ProviderError && (e.code === 'needs_reauth' || e.code === 'rate_limited')) throw e;
      return new Map<string, Shape>();
    });
  shapes.set(mcp.endpoint, run);
  return run;
};

const keyLike = (shape: Shape | undefined, patterns: RegExp[]): string | null => {
  const keys = Object.keys(shape?.props ?? {});
  for (const re of patterns) {
    const k = keys.find((k) => re.test(k));
    if (k) return k;
  }
  return null;
};
const isNumeric = (p: Prop | undefined) => (Array.isArray(p?.type) ? p.type : [p?.type]).some((t) => t === 'number' || t === 'integer');

const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
/** A date argument in the form the schema asks for: unix seconds (or millis) for numbers, YYYYMMDD when the description says so, else YYYY-MM-DD. */
const dateArg = (p: Prop | undefined, ms: number): string | number => {
  if (isNumeric(p)) return /milli|\bms\b/i.test(p?.description ?? '') ? ms : Math.floor(ms / 1000);
  if (/yyyymmdd/i.test(p?.description ?? '')) return isoDate(ms).replace(/-/g, '');
  if (/date-time|datetime|iso.?8601|timestamp/i.test(`${p?.format ?? ''} ${p?.description ?? ''}`)) return new Date(ms).toISOString();
  return isoDate(ms);
};

/** `querySportRecords` arguments for a window: the schema's own start/end names, else `startDate`/`endDate`. */
export const recordsArgs = (shape: Shape | undefined, fromMs: number, toMs: number): Record<string, unknown> => {
  const start = keyLike(shape, [/^(start|from|begin)/i, /start|from|begin/i]) ?? 'startDate';
  const end = keyLike(shape, [/^(end|to|until|finish)/i, /end|until|finish/i]) ?? 'endDate';
  return { [start]: dateArg(shape?.props[start], fromMs), [end]: dateArg(shape?.props[end], toMs) };
};

/** `getActivityDetail` / `queryActivityLapData` arguments: the label id under the schema's name, the sport type when it is asked for and known. */
export const activityArgs = (shape: Shape | undefined, labelId: string, sportType: unknown): Record<string, unknown> => {
  const idKey = keyLike(shape, [/label/i, /^(activity|sport|record)?id$/i, /id$/i]) ?? 'labelId';
  const sportKey = keyLike(shape, [/sport.?type/i, /sport|mode/i]) ?? 'sportType';
  const args: Record<string, unknown> = { [idKey]: isNumeric(shape?.props[idKey]) && num(labelId) != null ? num(labelId) : labelId };
  if (sportType != null && sportType !== '') args[sportKey] = isNumeric(shape?.props[sportKey]) ? (num(sportType) ?? sportType) : sportType;
  return args;
};

// ---------- the results: records, details, laps ----------

/** A tool's data is an object with unknown keys; `passthrough` keeps them all for the pickers. */
const zRecord = z.looseObject({});

const LIST_KEYS = ['records', 'sportRecords', 'sportDataList', 'activities', 'list', 'dataList', 'items', 'results', 'data'];
/** The array of records inside a tool's data: the data itself, a well-known key, one level of `data`, else the first array of objects. */
export const findRecords = (data: unknown): Record<string, unknown>[] => {
  const asRecords = (v: unknown) => (Array.isArray(v) ? v.map((x) => zRecord.safeParse(x)).filter((r) => r.success).map((r) => r.data as Record<string, unknown>) : null);
  const direct = asRecords(data);
  if (direct) return direct;
  const o = obj(data);
  if (!o) return [];
  for (const k of LIST_KEYS) {
    const hit = asRecords(o[k]);
    if (hit) return hit;
  }
  const inner = obj(o.data) ?? obj(o.result);
  if (inner) return findRecords(inner);
  for (const v of Object.values(o)) {
    const hit = asRecords(v);
    if (hit?.length && typeof hit[0] === 'object') return hit;
  }
  return [];
};

/** COROS sport modes by number, as far as they are documented: 8 run, 9 bike, 10 swim... Strings pass through. */
const SPORT: Record<number, string> = { 8: 'Run', 9: 'Ride', 10: 'Swim', 13: 'Triathlon', 14: 'Ski', 15: 'Workout', 16: 'WeightTraining', 18: 'Hike', 19: 'Walk', 20: 'Row', 21: 'Climb', 24: 'Multisport' };
const sportName = (v: unknown): string | null => {
  const n = num(v);
  if (n != null) return SPORT[n] ?? `Mode${n}`;
  return str(v);
};

/** A time zone field as seconds east of UTC: COROS's quarter hours, else minutes, else seconds, else `+08:00`, else an IANA name. */
const offsetSec = (tz: unknown, atMs: number): number | null => {
  const n = num(tz);
  if (n != null) return Math.abs(n) <= 56 ? n * 900 : Math.abs(n) <= 1440 ? n * 60 : n;
  const s = str(tz);
  if (!s) return null;
  const m = /^([+-])(\d{2}):?(\d{2})$/.exec(s);
  if (m) return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 3600 + Number(m[3]) * 60);
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: s, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(atMs));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    return Math.round((Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - atMs) / 1000);
  } catch {
    return null;
  }
};

const localOf = (ms: number) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

/**
 * The local start (`YYYY-MM-DDTHH:MM`) from whatever names the start: a unix time (seconds or millis) shifted by the
 * record's time zone, a date-time string with its own offset (its wall clock is the local time), one without (already
 * local), or a bare day (`2026-10-31`, `20261031`). Empty when nothing names it.
 */
const startLocalOf = (r: Record<string, unknown>): { startLocal: string; startMs: number | null } => {
  const tz = r.startTimezone ?? r.timezone ?? r.timeZone ?? r.utcOffset ?? r.tz;
  const raw = r.startTime ?? r.startTimestamp ?? r.startDate ?? r.startTimeLocal ?? r.date ?? r.happenDay ?? r.time;
  const n = num(raw);
  if (n != null) {
    if (n >= 19000101 && n <= 21001231 && String(raw).length === 8) {
      const s = String(raw);
      return { startLocal: `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00`, startMs: null };
    }
    const ms = n > 1e11 ? n : n * 1000;
    return { startLocal: localOf(ms + (offsetSec(tz, ms) ?? 0) * 1000), startMs: ms };
  }
  const s = str(raw);
  if (!s) return { startLocal: '', startMs: null };
  if (/^\d{8}$/.test(s)) return { startLocal: `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00`, startMs: null };
  const m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/.exec(s);
  if (!m) return { startLocal: '', startMs: null };
  const hasOffset = /(Z|[+-]\d{2}:?\d{2})$/i.test(s);
  const parsed = Date.parse(s);
  if (hasOffset && /Z$/i.test(s) && Number.isFinite(parsed)) {
    const off = offsetSec(tz, parsed);
    return { startLocal: off == null ? `${m[1]}T${m[2] ?? '00:00'}` : localOf(parsed + off * 1000), startMs: parsed };
  }
  return { startLocal: `${m[1]}T${m[2] ?? '00:00'}`, startMs: Number.isFinite(parsed) ? parsed : null };
};

let loggedSample = false;
const logSample = (what: string, r: Record<string, unknown>) => {
  if (loggedSample) return;
  loggedSample = true;
  console.debug(`[coros] ${what}; the adapter in providers/coros.ts needs this shape:`, JSON.stringify(r).slice(0, 1500));
};

/** The raw sport value per label id, from the listing: `getActivityDetail` wants both. */
const sportOf = new Map<string, unknown>();

/** One listed record onto our shape. `externalId` is empty (and the record skipped) when nothing names the activity. */
export const mapActivity = (r: Record<string, unknown>): ProviderActivity => {
  const externalId = pickStr(r, ['labelId', 'label_id', 'activityId', 'sportId', 'id']) ?? '';
  const sportRaw = r.sportType ?? r.sport_type ?? r.sportMode ?? r.mode ?? r.sport ?? r.type;
  const sport = sportName(sportRaw) ?? 'Workout';
  const { startLocal, startMs } = startLocalOf(r);
  if (externalId) sportOf.set(externalId, sportRaw ?? null);
  if (!externalId || !startLocal) logSample(externalId ? 'a record without a start time' : 'a record without an id', r);
  const distanceKm = pickNum(r, ['distanceKm', 'distance_km']);
  const distance = pickNum(r, ['distance', 'distanceM', 'totalDistance', 'distanceMeters']) ?? (distanceKm != null ? distanceKm * 1000 : 0);
  const moving = pickNum(r, ['duration', 'movingTime', 'workoutTime', 'sportTime', 'totalTime', 'activeTime', 'time']) ?? 0;
  const endMs = pickNum(r, ['endTime', 'endTimestamp']);
  const endSec = endMs != null && startMs != null ? Math.round(((endMs > 1e11 ? endMs : endMs * 1000) - startMs) / 1000) : null;
  const elapsed = pickNum(r, ['elapsedTime', 'totalElapsedTime', 'elapsedSec']) ?? (endSec != null && endSec > 0 ? endSec : moving);
  const hr = (keys: string[]) => {
    const v = pickNum(r, keys);
    return v != null && v > 0 ? Math.round(v) : null;
  };
  return {
    externalId,
    startLocal,
    name: pickStr(r, ['name', 'title', 'sportName', 'activityName']) ?? sport,
    sportType: sport,
    distanceM: Math.max(0, distance),
    movingSec: Math.max(0, Math.round(moving)),
    elapsedSec: Math.max(0, Math.round(elapsed)),
    elevM: pickNum(r, ['totalElevation', 'elevationGain', 'totalAscent', 'ascent', 'elevGain', 'climb']) ?? 0,
    avgHr: hr(['avgHeartRate', 'avgHr', 'averageHeartRate', 'avgHeartrate', 'heartRate']),
    maxHr: hr(['maxHeartRate', 'maxHr', 'maxHeartrate']),
    cadence: hr(['avgCadence', 'averageCadence', 'cadence', 'avgFrequency', 'avgStepFrequency']),
    polyline: null,
  };
};

/** The lap records inside the lap tool's data: under a lap-named key, else wherever `findRecords` finds a list. */
const lapsOf = (lapData: unknown): Record<string, unknown>[] => {
  const o = obj(lapData);
  for (const k of ['laps', 'lapList', 'lapData']) {
    const hit = o ? findRecords(o[k]) : [];
    if (hit.length) return hit;
  }
  return findRecords(lapData);
};

/** The detail (heart rate, cadence) and the laps as `[metres, seconds, hr | null]`, at most 60. */
export const mapDetail = (detail: unknown, lapData: unknown): ProviderDetail | null => {
  const d0 = obj(detail);
  const d = d0 ? (obj(d0.data) ?? obj(d0.detail) ?? obj(d0.activity) ?? d0) : null;
  const laps = lapsOf(lapData);
  if (!d && !laps.length) return null;
  const hr = (o: Record<string, unknown>, keys: string[]) => {
    const v = pickNum(o, keys);
    return v != null && v > 0 ? Math.round(v) : null;
  };
  return {
    laps: laps.length
      ? laps.slice(0, 60).map((l) => [Math.round(pickNum(l, ['distance', 'lapDistance', 'distanceM']) ?? 0), Math.round(pickNum(l, ['duration', 'time', 'lapTime', 'movingTime', 'totalTime', 'elapsedTime']) ?? 0), hr(l, ['avgHeartRate', 'avgHr', 'averageHeartRate', 'heartRate'])])
      : null,
    avgHr: d ? hr(d, ['avgHeartRate', 'avgHr', 'averageHeartRate']) : null,
    maxHr: d ? hr(d, ['maxHeartRate', 'maxHr']) : null,
    cadence: d ? hr(d, ['avgCadence', 'averageCadence', 'cadence', 'avgFrequency']) : null,
  };
};

// ---------- the provider ----------

export const corosProvider: Provider = {
  id: 'coros',
  name: 'COROS',
  get configured() {
    return env.corosConfigured;
  },
  /** The sync version cannot discover or make a PKCE pair: the connect routes use `corosAuthorizeUrl`. */
  authorizeUrl() {
    throw new ProviderError('COROS’s authorize URL needs discovery and a PKCE pair: use corosAuthorizeUrl.', 'unavailable', 'coros');
  },
  /** `handoff` is the sealed PKCE verifier the connect route put in the state (see `corosAuthorizeUrl`), not a scope. */
  async exchange(code, handoff) {
    const pkce = oauth.openPkce(handoff);
    if (!pkce) throw new ProviderError('The COROS connect attempt lost its PKCE verifier. Start again.', 'needs_reauth', 'coros');
    const d = await discovery();
    if (pkce.issuer !== d.issuer) throw new ProviderError('COROS’s authorization server changed between connect and callback. Start again.', 'needs_reauth', 'coros');
    const t = await oauth.exchange(d, await client(), 'coros', code, pkce.verifier);
    const who = await identify(new McpClient(d.endpoint, t.accessToken, 'coros', corosBucket), t.idToken);
    return mapTokens({ access_token: t.accessToken, refresh_token: t.refreshToken ?? undefined, expires_at: t.expiresAt, scope: t.scope ?? COROS_SCOPE, openId: who.id }, undefined, who.name);
  },
  async refresh(conn) {
    const t = await oauth.refresh(await discovery(), await client(), 'coros', conn);
    return mapTokens({ access_token: t.accessToken, refresh_token: t.refreshToken ?? undefined, expires_at: t.expiresAt, scope: t.scope ?? undefined }, conn);
  },
  /** The window since `afterUnix`, 30 days per `querySportRecords` call, through tomorrow (COROS's days are local ones). */
  async *listSince(conn, afterUnix) {
    const mcp = await mcpFor(conn);
    const shape = (await toolShapes(mcp)).get(TOOLS.records);
    const end = Date.now() + 86400_000;
    let from = afterUnix * 1000;
    while (from <= end) {
      const to = Math.min(end, from + COROS_WINDOW_DAYS * 86400_000 - 1);
      const data = toolData(await mcp.callTool(TOOLS.records, recordsArgs(shape, from, to)));
      yield findRecords(data)
        .map(mapActivity)
        .filter((a) => a.externalId && a.startLocal);
      from = to + 1;
    }
  },
  /** The detail, then the laps (missing laps are not an error). Throws on failure so the engine retries in a day. */
  async detail(conn, externalId) {
    const mcp = await mcpFor(conn);
    const shapes = await toolShapes(mcp);
    const sport = sportOf.get(externalId);
    const detail = toolData(await mcp.callTool(TOOLS.detail, activityArgs(shapes.get(TOOLS.detail), externalId, sport)));
    let laps: unknown = null;
    try {
      laps = toolData(await mcp.callTool(TOOLS.laps, activityArgs(shapes.get(TOOLS.laps), externalId, sport)));
    } catch (e) {
      if (e instanceof ProviderError && (e.code === 'needs_reauth' || e.code === 'rate_limited')) throw e;
    }
    const mapped = mapDetail(detail, laps);
    if (!mapped) throw new ProviderError(`COROS’s detail for ${externalId} was not in a shape the adapter reads.`, 'unavailable', 'coros');
    return mapped;
  },
  /** COROS's MCP server has no webhook: nothing ever arrives here; the 20-minute loop is the only source of activities. */
  parseWebhook(): WebhookEvent[] {
    return [];
  },
  async revoke(conn) {
    try {
      await oauth.revoke(await discovery(), await client(), conn);
    } catch {
      /* already gone, or no store bound */
    }
  },
};
