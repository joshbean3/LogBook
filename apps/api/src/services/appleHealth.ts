import {
  HEALTH_SAMPLE_TYPES,
  HEALTH_UNITS,
  zHealthConnect,
  zHealthDay,
  zHealthDeletion,
  zHealthSample,
  zHealthWorkout,
  zSleepSegmentIn,
  shiftDays,
  type HealthStatus,
  type HealthSyncAnswer,
} from '@logbook/shared';
import { and, count, eq, gte, inArray, isNull, lte, max, min, notInArray, sql } from 'drizzle-orm';
import crypto from 'node:crypto';
import type { z } from 'zod';
import type { DB } from '../db/index.js';
import { healthBatches, healthDays, healthDevices, healthSamples, healthSync, healthWorkouts, sleepSegments } from '../db/schema.js';
import { nowISO, uid } from '../lib/util.js';
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

// ---------- connecting ----------
export const connectHealth = (db: DB, userId: string, input: z.infer<typeof zHealthConnect>, today: string) => {
  const at = nowISO();
  const historyFrom = shiftDays(today, -input.historyDays);
  const had = db.select().from(healthSync).where(eq(healthSync.userId, userId)).get();
  if (had) db.update(healthSync).set({ historyFrom, lastError: null }).where(eq(healthSync.userId, userId)).run();
  else db.insert(healthSync).values({ userId, connectedAt: at, historyFrom, typesSeenJson: '[]' }).run();
  if (input.sleepGoalMin) writeSetting(db, userId, SLEEP_GOAL_KEY, input.sleepGoalMin);
  const token = crypto.randomBytes(32).toString('base64url');
  const id = uid('hd');
  db.insert(healthDevices).values({ id, userId, tokenHash: hash(token), name: input.deviceName || 'iPhone', createdAt: at, lastSeenAt: null, revokedAt: null }).run();
  return { token, deviceId: id, historyFrom };
};

/** The account a device token belongs to, or null (unknown, revoked, or the account disconnected). Marks it seen. */
export const deviceUser = (db: DB, token: string | null | undefined): string | null => {
  if (!token) return null;
  const d = db.select().from(healthDevices).where(eq(healthDevices.tokenHash, hash(token))).get();
  if (!d || d.revokedAt) return null;
  if (!db.select({ u: healthSync.userId }).from(healthSync).where(eq(healthSync.userId, d.userId)).get()) return null;
  db.update(healthDevices).set({ lastSeenAt: nowISO() }).where(eq(healthDevices.id, d.id)).run();
  return d.userId;
};

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

export const storeBatch = (db: DB, userId: string, b: BatchEnvelope): HealthSyncAnswer => {
  const empty = { samples: 0, deletions: 0, days: 0, sleep: 0, workouts: 0 };
  if (db.select().from(healthBatches).where(and(eq(healthBatches.userId, userId), eq(healthBatches.batchId, b.batchId))).get()) return { stored: empty, dropped: 0, duplicate: true };

  const samples = each(b.samples, zHealthSample, (s) => !tooFuture(s.start) && Date.parse(s.end) >= Date.parse(s.start));
  const deletions = each(b.deletions, zHealthDeletion);
  const days = each(b.days, zHealthDay);
  const sleep = each(b.sleep, zSleepSegmentIn, (s) => !tooFuture(s.start) && Date.parse(s.end) > Date.parse(s.start));
  const workouts = each(b.workouts, zHealthWorkout, (w) => !tooFuture(w.start) && Date.parse(w.end) >= Date.parse(w.start));
  const at = nowISO();

  db.transaction((tx) => {
    for (const s of samples.good) {
      const row = { userId, uuid: s.uuid, type: s.type, startAt: s.start, endAt: s.end, value: s.value, unit: HEALTH_UNITS[s.type], sourceBundle: s.sourceBundle, sourceName: s.sourceName, productType: s.productType ?? null, userEntered: !!s.userEntered, tz: s.tz ?? null, deletedAt: null, updatedAt: at };
      // the update leaves deleted_at alone: a late re-send never brings a deleted sample back
      const { deletedAt: _keep, userId: _u, uuid: _id, ...set } = row;
      tx.insert(healthSamples).values(row).onConflictDoUpdate({ target: [healthSamples.userId, healthSamples.uuid], set }).run();
    }
    for (const s of sleep.good) {
      const row = { userId, uuid: s.uuid, startAt: s.start, endAt: s.end, stage: s.stage, sourceBundle: s.sourceBundle, sourceName: s.sourceName, productType: s.productType ?? null, tz: s.tz ?? null, deletedAt: null, updatedAt: at };
      const { deletedAt: _keep, userId: _u, uuid: _id, ...set } = row;
      tx.insert(sleepSegments).values(row).onConflictDoUpdate({ target: [sleepSegments.userId, sleepSegments.uuid], set }).run();
    }
    for (const w of workouts.good) {
      const row = {
        userId,
        uuid: w.uuid,
        activity: w.activity,
        startAt: w.start,
        endAt: w.end,
        durationSec: w.durationSec,
        distanceM: w.distanceM ?? null,
        energyKcal: w.energyKcal ?? null,
        avgHr: w.avgHr ?? null,
        maxHr: w.maxHr ?? null,
        hrJson: w.hr?.length ? JSON.stringify(w.hr) : null,
        sourceBundle: w.sourceBundle,
        sourceName: w.sourceName,
        productType: w.productType ?? null,
        tz: w.tz ?? null,
        deletedAt: null,
        updatedAt: at,
      };
      const { deletedAt: _keep, userId: _u, uuid: _id, ...set } = row;
      // heart rate that arrived later (re-read for 48 hours) replaces a shorter one, never a longer one with nothing
      tx.insert(healthWorkouts)
        .values(row)
        .onConflictDoUpdate({ target: [healthWorkouts.userId, healthWorkouts.uuid], set: { ...set, hrJson: set.hrJson ?? sql`${healthWorkouts.hrJson}` } })
        .run();
    }
    for (const d of days.good) {
      // the day's start and time zone are frozen the first time it lands: a later trip never re-cuts the day
      tx.insert(healthDays)
        .values({ userId, date: d.date, metric: d.metric, value: d.value, bucketsJson: d.buckets ? JSON.stringify(d.buckets) : null, dayStartAt: d.dayStart, tz: d.tz, updatedAt: at })
        .onConflictDoUpdate({ target: [healthDays.userId, healthDays.date, healthDays.metric], set: { value: d.value, bucketsJson: d.buckets ? JSON.stringify(d.buckets) : null, updatedAt: at } })
        .run();
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
    if (workouts.good.length) seen.add('workout');
    for (const d of days.good) seen.add(d.metric);
    tx.update(healthSync).set({ lastSyncAt: at, lastError: null, typesSeenJson: JSON.stringify([...seen].sort()) }).where(eq(healthSync.userId, userId)).run();
  });

  return {
    stored: { samples: samples.good.length, deletions: deletions.good.length, days: days.good.length, sleep: sleep.good.length, workouts: workouts.good.length },
    dropped: samples.bad + deletions.bad + days.bad + sleep.bad + workouts.bad,
  };
};

// ---------- reconcile ----------
/**
 * Health's deletion records can expire before the phone reads them, so once a day the phone sends the UUIDs Health still
 * has in a window, and the rest of that window is marked deleted. An empty list while the server has rows means access
 * was taken away or history was limited, not that everything was deleted: then nothing happens and the answer says so.
 */
export const reconcileHealth = (db: DB, userId: string, r: { kind: string; from: string; to: string; uuids: string[] }) => {
  const t = r.kind === 'sleep' ? sleepSegments : r.kind === 'workout' ? healthWorkouts : healthSamples;
  const scope = and(eq(t.userId, userId), gte(t.startAt, r.from), lte(t.startAt, r.to), isNull(t.deletedAt), ...(t === healthSamples ? [eq(healthSamples.type, r.kind)] : []));
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
    span: { from: days?.from ?? null, to: days?.to ?? null },
    devices,
  };
};
