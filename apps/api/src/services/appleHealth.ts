import {
  ASLEEP_STAGES,
  HEALTH_ACCEPTED,
  HEALTH_DAILY_MAX_DAYS,
  HEALTH_SAMPLE_TYPES,
  HEALTH_UNITS,
  daysBetween,
  eachDay,
  zHealthConnect,
  zHealthDeletion,
  zHealthSample,
  zSleepSegmentIn,
  shiftDays,
  type HealthDailyRow,
  type HealthStatus,
  type HealthSyncAnswer,
  type SleepStageName,
} from '@logbook/shared';
import { and, asc, count, desc, eq, gte, inArray, isNull, lte, max, min, ne, notInArray, sql } from 'drizzle-orm';
import crypto from 'node:crypto';
import type { z } from 'zod';
import type { DB } from '../db/index.js';
import { healthBatches, healthDays, healthDevices, healthSamples, healthSync, healthWorkouts, sleepSegments } from '../db/schema.js';
import { ApiError, nowISO, uid } from '../lib/util.js';
import { readSetting, writeSetting } from '../routes/core.js';

/**
 * Apple Health on the server (docs/health/apple-health.md §3.5): connecting mints a device token, a batch is stored row by
 * row (a bad row is dropped and counted, never the batch), re-sent batches and rows land once, a deleted sample is never
 * brought back, and reconcile removes what Health no longer has, but never everything at once.
 */

const SLEEP_GOAL_KEY = 'sleepGoalMin';
const hash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
/** A day ahead is the most a phone's clock can be off; later than that is a wrong clock, not a reading. */
const tooFuture = (iso: string) => Date.parse(iso) > Date.now() + 24 * 3600 * 1000;

/** The source of sample readings (the App Review demo account, db/seed-review.ts): never the phone's, so a reconcile leaves them. */
export const SAMPLE_HEALTH_BUNDLE = 'app.logbook.sample';

// ---------- connecting ----------
/**
 * Connect a phone. A token is minted for its sync engine, and the earlier live token of the same phone is revoked, so
 * tokens do not pile up on reconnect and one from before stops working. "The same phone" is the vendor id the app
 * sends (`deviceKey`), else the sign-in the request came from (`sessionId`).
 */
export const connectHealth = (db: DB, userId: string, input: z.infer<typeof zHealthConnect>, today: string, sessionId?: string | null) => {
  const at = nowISO();
  const deviceKey = input.deviceKey ? hash(`device:${input.deviceKey}`) : sessionId ? hash(`session:${sessionId}`) : null;
  const historyFrom = shiftDays(today, -input.historyDays);
  const had = db.select().from(healthSync).where(eq(healthSync.userId, userId)).get();
  if (had) db.update(healthSync).set({ historyFrom, lastError: null }).where(eq(healthSync.userId, userId)).run();
  else db.insert(healthSync).values({ userId, connectedAt: at, historyFrom, typesSeenJson: '[]' }).run();
  if (input.sleepGoalMin) writeSetting(db, userId, SLEEP_GOAL_KEY, input.sleepGoalMin);
  const token = crypto.randomBytes(32).toString('base64url');
  const id = uid('hd');
  const replaced = deviceKey ? db.update(healthDevices).set({ revokedAt: at }).where(and(eq(healthDevices.userId, userId), eq(healthDevices.deviceKey, deviceKey), isNull(healthDevices.revokedAt))).run().changes : 0;
  db.insert(healthDevices).values({ id, userId, tokenHash: hash(token), name: input.deviceName || 'iPhone', createdAt: at, lastSeenAt: null, revokedAt: null, deviceKey }).run();
  return { token, deviceId: id, historyFrom, replaced };
};

/** The device a token belongs to and its account, or null (unknown, revoked, or the account disconnected). Marks it seen. */
export const deviceOf = (db: DB, token: string | null | undefined): { deviceId: string; userId: string } | null => {
  if (!token) return null;
  const d = db.select().from(healthDevices).where(eq(healthDevices.tokenHash, hash(token))).get();
  if (!d || d.revokedAt) return null;
  if (!db.select({ u: healthSync.userId }).from(healthSync).where(eq(healthSync.userId, d.userId)).get()) return null;
  db.update(healthDevices).set({ lastSeenAt: nowISO() }).where(eq(healthDevices.id, d.id)).run();
  return { deviceId: d.id, userId: d.userId };
};
export const deviceUser = (db: DB, token: string | null | undefined): string | null => deviceOf(db, token)?.userId ?? null;

/** Disconnect: every device token revoked, every Health row gone, the connection removed. */
export const disconnectHealth = (db: DB, userId: string) => {
  const at = nowISO();
  db.transaction((tx) => {
    tx.update(healthDevices).set({ revokedAt: at }).where(and(eq(healthDevices.userId, userId), isNull(healthDevices.revokedAt))).run();
    for (const t of [healthSamples, healthDays, sleepSegments, healthWorkouts, healthBatches]) tx.delete(t).where(eq(t.userId, userId)).run();
    tx.delete(healthSync).where(eq(healthSync.userId, userId)).run();
  });
};

// ---------- storing a batch ----------
const each = <T>(rows: unknown[], schema: z.ZodType<T>, ok: (row: T) => boolean = () => true): { good: T[]; bad: number } => {
  const good: T[] = [];
  let bad = 0;
  for (const raw of rows) {
    const r = schema.safeParse(raw);
    if (r.success && ok(r.data)) good.push(r.data);
    else bad++;
  }
  return { good, bad };
};

export interface BatchEnvelope {
  batchId: string;
  samples: unknown[];
  deletions: unknown[];
  days: unknown[];
  sleep: unknown[];
  workouts: unknown[];
}

/**
 * What a batch carries that Logbook does not take: sample types other than the two it shows, any day sum, any workout.
 * Empty when the batch is fine. A row with no readable type is not listed here: it is dropped and counted as before.
 */
export const unacceptedIn = (b: BatchEnvelope): string[] => {
  const out = new Set<string>();
  for (const row of b.samples) {
    const type = (row as { type?: unknown } | null)?.type;
    if (typeof type === 'string' && !(HEALTH_SAMPLE_TYPES as readonly string[]).includes(type)) out.add(type.slice(0, 40));
  }
  if (b.days.length) out.add('day sums');
  if (b.workouts.length) out.add('workouts');
  return [...out].sort();
};

/** 422 `health_type` when a batch carries anything but sleep, heart rate variability and resting heart rate. Nothing of such a batch is stored. */
export const assertAccepted = (b: BatchEnvelope) => {
  const extra = unacceptedIn(b);
  if (extra.length) throw new ApiError(422, `Orby only takes ${HEALTH_ACCEPTED} from Apple Health. Not accepted: ${extra.slice(0, 8).join(', ')}.`, 'health_type');
};

export const storeBatch = (db: DB, userId: string, b: BatchEnvelope): HealthSyncAnswer => {
  assertAccepted(b);
  const empty = { samples: 0, deletions: 0, days: 0, sleep: 0, workouts: 0 };
  if (db.select().from(healthBatches).where(and(eq(healthBatches.userId, userId), eq(healthBatches.batchId, b.batchId))).get()) return { stored: empty, dropped: 0, duplicate: true };

  const samples = each(b.samples, zHealthSample, (s) => !tooFuture(s.start) && Date.parse(s.end) >= Date.parse(s.start));
  const deletions = each(b.deletions, zHealthDeletion);
  const sleep = each(b.sleep, zSleepSegmentIn, (s) => !tooFuture(s.start) && Date.parse(s.end) > Date.parse(s.start));
  const at = nowISO();

  db.transaction((tx) => {
    for (const s of samples.good) {
      // the source's name is usually the person's device name ("Sam's Apple Watch"): never kept. The bundle and the
      // hardware type are enough to tell a Watch from a phone.
      const row = { userId, uuid: s.uuid, type: s.type, startAt: s.start, endAt: s.end, value: s.value, unit: HEALTH_UNITS[s.type], sourceBundle: s.sourceBundle, sourceName: '', productType: s.productType ?? null, userEntered: !!s.userEntered, tz: s.tz ?? null, deletedAt: null, updatedAt: at };
      // the update leaves deleted_at alone: a late re-send never brings a deleted sample back
      const { deletedAt: _keep, userId: _u, uuid: _id, ...set } = row;
      tx.insert(healthSamples).values(row).onConflictDoUpdate({ target: [healthSamples.userId, healthSamples.uuid], set }).run();
    }
    for (const s of sleep.good) {
      const row = { userId, uuid: s.uuid, startAt: s.start, endAt: s.end, stage: s.stage, sourceBundle: s.sourceBundle, sourceName: '', productType: s.productType ?? null, tz: s.tz ?? null, deletedAt: null, updatedAt: at };
      const { deletedAt: _keep, userId: _u, uuid: _id, ...set } = row;
      tx.insert(sleepSegments).values(row).onConflictDoUpdate({ target: [sleepSegments.userId, sleepSegments.uuid], set }).run();
    }
    const byKind = { sample: healthSamples, sleep: sleepSegments, workout: healthWorkouts } as const;
    for (const kind of ['sample', 'sleep', 'workout'] as const) {
      const ids = deletions.good.filter((x) => x.kind === kind).map((x) => x.uuid);
      for (let i = 0; i < ids.length; i += 500) {
        const t = byKind[kind];
        tx.update(t)
          .set({ deletedAt: at })
          .where(and(eq(t.userId, userId), inArray(t.uuid, ids.slice(i, i + 500)), isNull(t.deletedAt)))
          .run();
      }
    }
    tx.insert(healthBatches).values({ userId, batchId: b.batchId, storedAt: at }).run();
    const seen = new Set<string>(JSON.parse(tx.select({ j: healthSync.typesSeenJson }).from(healthSync).where(eq(healthSync.userId, userId)).get()?.j ?? '[]') as string[]);
    for (const s of samples.good) seen.add(s.type);
    if (sleep.good.length) seen.add('sleep');
    tx.update(healthSync).set({ lastSyncAt: at, lastError: null, typesSeenJson: JSON.stringify([...seen].sort()) }).where(eq(healthSync.userId, userId)).run();
  });

  return {
    stored: { samples: samples.good.length, deletions: deletions.good.length, days: 0, sleep: sleep.good.length, workouts: 0 },
    dropped: samples.bad + deletions.bad + sleep.bad,
  };
};

// ---------- reconcile ----------
/**
 * Health's deletion records can expire before the phone reads them, so once a day the phone sends the UUIDs Health still
 * has in a window, and the rest of that window is marked deleted. An empty list while the server has rows means access
 * was taken away or history was limited, not that everything was deleted: then nothing happens and the answer says so.
 */
export const reconcileHealth = (db: DB, userId: string, r: { kind: string; from: string; to: string; uuids: string[] }) => {
  const t = r.kind === 'sleep' ? sleepSegments : healthSamples;
  // sample readings (the App Review demo account, db/seed-review.ts) are not the phone's, so a phone never removes them
  const scope = and(eq(t.userId, userId), gte(t.startAt, r.from), lte(t.startAt, r.to), isNull(t.deletedAt), ne(t.sourceBundle, SAMPLE_HEALTH_BUNDLE), ...(t === healthSamples ? [eq(healthSamples.type, r.kind)] : []));
  const have = db.select({ n: count() }).from(t).where(scope).get()?.n ?? 0;
  if (!r.uuids.length && have > 0) return { removed: 0, skipped: true as const };
  const keep = new Set(r.uuids);
  const ids = db
    .select({ uuid: t.uuid })
    .from(t)
    .where(r.uuids.length && r.uuids.length <= 900 ? and(scope, notInArray(t.uuid, r.uuids)) : scope)
    .all()
    .map((x) => x.uuid)
    .filter((u) => !keep.has(u));
  const at = nowISO();
  for (let i = 0; i < ids.length; i += 500)
    db.update(t)
      .set({ deletedAt: at })
      .where(and(eq(t.userId, userId), inArray(t.uuid, ids.slice(i, i + 500))))
      .run();
  return { removed: ids.length };
};

// ---------- status ----------
export const healthStatus = (db: DB, userId: string): HealthStatus => {
  const s = db.select().from(healthSync).where(eq(healthSync.userId, userId)).get();
  const sleepGoalMin = readSetting<number>(db, userId, SLEEP_GOAL_KEY);
  const devices = db
    .select()
    .from(healthDevices)
    .where(and(eq(healthDevices.userId, userId), isNull(healthDevices.revokedAt)))
    .all()
    .map((d) => ({ id: d.id, name: d.name, lastSeenAt: d.lastSeenAt }));
  if (!s) return { connected: false, connectedAt: null, lastSyncAt: null, lastError: null, historyFrom: null, sleepGoalMin, counts: { samples: {}, days: 0, sleep: 0, workouts: 0 }, span: { from: null, to: null }, devices: [] };
  const samples: Record<string, number> = {};
  for (const type of HEALTH_SAMPLE_TYPES) samples[type] = 0;
  for (const row of db
    .select({ type: healthSamples.type, n: count() })
    .from(healthSamples)
    .where(and(eq(healthSamples.userId, userId), isNull(healthSamples.deletedAt)))
    .groupBy(healthSamples.type)
    .all())
    samples[row.type] = row.n;
  const days = db.select({ n: sql<number>`count(distinct ${healthDays.date})`, from: min(healthDays.date), to: max(healthDays.date) }).from(healthDays).where(eq(healthDays.userId, userId)).get();
  const sleep = db.select({ n: count() }).from(sleepSegments).where(and(eq(sleepSegments.userId, userId), isNull(sleepSegments.deletedAt))).get()?.n ?? 0;
  const workouts = db.select({ n: count() }).from(healthWorkouts).where(and(eq(healthWorkouts.userId, userId), isNull(healthWorkouts.deletedAt))).get()?.n ?? 0;
  return {
    connected: true,
    connectedAt: s.connectedAt,
    lastSyncAt: s.lastSyncAt,
    lastError: s.lastError,
    historyFrom: s.historyFrom,
    sleepGoalMin,
    counts: { samples, days: days?.n ?? 0, sleep, workouts },
    span: healthSpan(db, userId, days?.from ?? null, days?.to ?? null),
    devices,
  };
};

// ---------- the daily numbers a screen shows ----------
const dateFormatters = new Map<string, Intl.DateTimeFormat | null>();
/** A formatter that names the local date in a time zone, or null when the zone is not one this machine knows. */
const formatterFor = (tz: string): Intl.DateTimeFormat | null => {
  if (!dateFormatters.has(tz)) {
    let f: Intl.DateTimeFormat | null = null;
    try {
      f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch {
      f = null;
    }
    dateFormatters.set(tz, f);
  }
  return dateFormatters.get(tz) ?? null;
};
export const isTimeZone = (tz: string | null | undefined): tz is string => !!tz && tz.length <= 60 && !!formatterFor(tz);
/** The calendar date of an instant in a time zone (`YYYY-MM-DD`). */
export const localDate = (ms: number, tz: string): string => (formatterFor(tz) ?? formatterFor('UTC')!).format(new Date(ms));

/** Sleep that starts from 6 pm counts toward the night that ends the next morning. */
const SLEEP_DAY_SHIFT_MS = 6 * 3600_000;
const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * The first and last local days with a reading, counted the way `healthDaily` counts them: samples on the day they were
 * taken, sleep on the night it ends. health_days stays empty with the three types this release reads (sleep, HRV,
 * resting heart rate), so the span comes from the samples and sleep segments, with any health_days rows added in.
 */
const healthSpan = (db: DB, userId: string, daysFrom: string | null, daysTo: string | null): { from: string | null; to: string | null } => {
  const sampleWhere = and(eq(healthSamples.userId, userId), isNull(healthSamples.deletedAt), inArray(healthSamples.type, [...HEALTH_SAMPLE_TYPES]));
  const segmentWhere = and(eq(sleepSegments.userId, userId), isNull(sleepSegments.deletedAt), inArray(sleepSegments.stage, [...ASLEEP_STAGES]));
  const sample = (order: typeof asc) => db.select({ startAt: healthSamples.startAt, tz: healthSamples.tz }).from(healthSamples).where(sampleWhere).orderBy(order(healthSamples.startAt)).limit(1).get();
  const segment = (order: typeof asc) => db.select({ startAt: sleepSegments.startAt, tz: sleepSegments.tz }).from(sleepSegments).where(segmentWhere).orderBy(order(sleepSegments.startAt)).limit(1).get();
  const readings = [
    { r: sample(asc), shift: 0 },
    { r: sample(desc), shift: 0 },
    { r: segment(asc), shift: SLEEP_DAY_SHIFT_MS },
    { r: segment(desc), shift: SLEEP_DAY_SHIFT_MS },
  ].filter((x): x is { r: { startAt: string; tz: string | null }; shift: number } => !!x.r);
  // a reading with no zone takes the zone of the latest one that has one, then UTC (as in healthDaily)
  const fallback = [...readings].sort((a, b) => (a.r.startAt < b.r.startAt ? 1 : -1)).find((x) => isTimeZone(x.r.tz))?.r.tz ?? 'UTC';
  const dates = readings.flatMap(({ r, shift }) => {
    const ms = Date.parse(r.startAt);
    return Number.isNaN(ms) ? [] : [localDate(ms + shift, isTimeZone(r.tz) ? r.tz : fallback)];
  });
  if (daysFrom) dates.push(daysFrom);
  if (daysTo) dates.push(daysTo);
  dates.sort();
  return { from: dates[0] ?? null, to: dates.at(-1) ?? null };
};

/**
 * Contract 4. One row per day from `from` to `to`: minutes asleep, average heart rate variability (ms) and average
 * resting heart rate (bpm), each null when Apple Health had nothing. Read from the stored samples and sleep segments,
 * with or without a connected device (the review account's sample days are plain rows).
 *
 * A reading belongs to the calendar day it was taken on, in the time zone it was taken in. Where a reading carries no
 * zone, `tz` (the app's own zone, when it sends one) is used, then the zone of the person's latest reading, then UTC.
 * Sleep is counted once however many sources recorded the night (see `asleepMin` below).
 */
export const healthDaily = (db: DB, userId: string, from: string, to: string, tz?: string | null): HealthDailyRow[] => {
  if (from > to) throw new ApiError(422, 'from must be on or before to', 'validation');
  if (daysBetween(from, to) + 1 > HEALTH_DAILY_MAX_DAYS) throw new ApiError(422, `Ask for at most ${HEALTH_DAILY_MAX_DAYS} days at a time.`, 'too_many_days');
  // the stored timestamps are whatever the phone sent, so the window is cut wide here and exactly below
  const lo = `${shiftDays(from, -2)}T00:00:00`;
  const hi = `${shiftDays(to, 3)}T00:00:00`;
  const samples = db
    .select({ type: healthSamples.type, startAt: healthSamples.startAt, value: healthSamples.value, tz: healthSamples.tz })
    .from(healthSamples)
    .where(and(eq(healthSamples.userId, userId), isNull(healthSamples.deletedAt), inArray(healthSamples.type, [...HEALTH_SAMPLE_TYPES]), gte(healthSamples.startAt, lo), lte(healthSamples.startAt, hi)))
    .all();
  const segments = db
    .select({ startAt: sleepSegments.startAt, endAt: sleepSegments.endAt, stage: sleepSegments.stage, tz: sleepSegments.tz, bundle: sleepSegments.sourceBundle, product: sleepSegments.productType })
    .from(sleepSegments)
    .where(and(eq(sleepSegments.userId, userId), isNull(sleepSegments.deletedAt), inArray(sleepSegments.stage, [...ASLEEP_STAGES]), gte(sleepSegments.startAt, lo), lte(sleepSegments.startAt, hi)))
    .all();
  const fallback = isTimeZone(tz) ? tz : ([...segments, ...samples].sort((a, b) => (a.startAt < b.startAt ? 1 : -1)).find((r) => isTimeZone(r.tz))?.tz ?? 'UTC');
  const zoneOf = (r: { tz: string | null }) => (isTimeZone(r.tz) ? r.tz : fallback);

  const sums = new Map<string, { hrv: number; hrvN: number; rhr: number; rhrN: number }>();
  for (const s of samples) {
    const ms = Date.parse(s.startAt);
    if (Number.isNaN(ms)) continue;
    const d = localDate(ms, zoneOf(s));
    const cur = sums.get(d) ?? { hrv: 0, hrvN: 0, rhr: 0, rhrN: 0 };
    if (s.type === 'hrv') {
      cur.hrv += s.value;
      cur.hrvN++;
    } else {
      cur.rhr += s.value;
      cur.rhrN++;
    }
    sums.set(d, cur);
  }
  // each night by source: a Watch and an app (or the phone) often record the same night, and they do not agree
  const nights = new Map<string, Map<string, { spans: Array<[number, number]>; staged: boolean }>>();
  for (const g of segments) {
    const a = Date.parse(g.startAt);
    const b = Date.parse(g.endAt);
    if (Number.isNaN(a) || Number.isNaN(b) || b <= a) continue;
    const d = localDate(a + SLEEP_DAY_SHIFT_MS, zoneOf(g));
    const sources = nights.get(d) ?? new Map<string, { spans: Array<[number, number]>; staged: boolean }>();
    const key = `${g.bundle}|${g.product ?? ''}`;
    const src = sources.get(key) ?? { spans: [], staged: false };
    src.spans.push([a, b]);
    if (g.stage !== 'asleep') src.staged = true;
    sources.set(key, src);
    nights.set(d, sources);
  }
  /** Minutes covered by the spans, overlaps counted once. */
  const covered = (spans: Array<[number, number]>): number => {
    spans.sort((x, y) => x[0] - y[0]);
    let total = 0;
    let [curA, curB] = spans[0]!;
    for (const [a, b] of spans.slice(1)) {
      if (a <= curB) curB = Math.max(curB, b);
      else {
        total += curB - curA;
        [curA, curB] = [a, b];
      }
    }
    return Math.round((total + curB - curA) / 60_000);
  };
  /**
   * One source speaks for a night, so two recordings of it are never added together and one source's "asleep" never
   * papers over another's "awake": the source that recorded sleep stages when one did, and of those the one with the
   * most sleep.
   */
  const asleepMin = (sources: Map<string, { spans: Array<[number, number]>; staged: boolean }>): number => {
    const all = [...sources.values()].map((s) => ({ staged: s.staged, min: covered(s.spans) }));
    const pool = all.some((s) => s.staged) ? all.filter((s) => s.staged) : all;
    return Math.max(...pool.map((s) => s.min));
  };
  return eachDay(from, to).map((date) => {
    const v = sums.get(date);
    const n = nights.get(date);
    return { date, sleepMin: n?.size ? asleepMin(n) : null, hrvMs: v?.hrvN ? round1(v.hrv / v.hrvN) : null, restingHr: v?.rhrN ? Math.round(v.rhr / v.rhrN) : null };
  });
};
export type { SleepStageName };
