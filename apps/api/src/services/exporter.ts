import { createHash } from 'node:crypto';
import { cleanBands, DAY_TAG_LABEL_MAX, DAY_TAG_MAX, emptyBands, isISODate, zDayPlanPut, type DayBands, normalizeMorningSettings, type ConsentEvent, type ExportActivity, type ExportV2, type LegacyMorningDay } from '@logbook/shared';
import { LEARNING_MAX, type Learning } from '@logbook/shared';
import { and, asc, eq, isNull, type SQL } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { z } from 'zod';
import type { DB } from '../db/index.js';
import {
  activities,
  coachReads,
  habitChecks,
  habits,
  journalEntries,
  liftSets,
  links,
  morningDays,
  planBlocks,
  quotePrefs,
  todos,
  trainingSessions,
  userQuotes,
  userSettings,
  users,
} from '../db/schema.js';
import { goalEvents, goals, todoGroups } from '../db/schema.js';
import { learnings } from '../db/schema.js';
import { recallItems } from '../db/schema.js';
import { assistantActions, dayPlans, dayTags, healthDevices, healthSamples, healthSync, sleepSegments } from '../db/schema.js';
import { toBlock, toEntry, toGoal, toGoalEvent, toHabit, toLift, toSession, toTodo, toTodoGroup } from '../lib/map.js';
import { nowISO } from '../lib/util.js';
import { toLink } from '../routes/reads.js';
import { readConsentLog } from './consent.js';

/**
 * Contract 3: `GET /export` is the whole account as one JSON document (version 2), and `POST /import` takes it back,
 * into the same account or a fresh one, idempotently by id. Soft-deleted rows are not exported (they are gone to the
 * athlete); to-dos keep their `deletedOn` (it is part of the to-do).
 */
/** A planned day (morning, afternoon, evening), by the ids of the to-dos and sessions placed in each part. */
export interface DayPlanExport {
  date: string;
  bands: DayBands;
  updatedAt: string;
}
/** What the assistant proposed and what came of it (kept 90 days; not read back on import). */
export interface AssistantActionExport {
  id: string;
  ask: string;
  summary: string;
  labels: unknown;
  status: string;
  createdAt: string;
  appliedAt: string | null;
}
const parseJson = (raw: string | null, fallback: unknown): unknown => {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

export const exportAccount = (
  db: DB,
  userId: string,
): ExportV2 & { learnings: Learning[] } & { recall: RecallExport[] } & { dayTags: DayTagExport[] } & { consentLog: ConsentEvent[]; health: HealthExport; dayPlans: DayPlanExport[]; assistantActions: AssistantActionExport[] } => {
  const u = db.select().from(users).where(eq(users.id, userId)).get()!;
  const settings: Record<string, unknown> = {};
  for (const s of db.select().from(userSettings).where(eq(userSettings.userId, userId)).all()) {
    try {
      settings[s.key] = JSON.parse(s.json);
    } catch {
      /* a broken document is left out */
    }
  }
  let trainingProfile: unknown = null;
  try {
    trainingProfile = u.trainingProfile ? JSON.parse(u.trainingProfile) : null;
  } catch {
    trainingProfile = null;
  }
  const acts: ExportActivity[] = db
    .select()
    .from(activities)
    .where(and(eq(activities.userId, userId), isNull(activities.deletedAt)))
    .all()
    .map((a) => ({
      id: a.id,
      date: a.date,
      time: a.time,
      name: a.name,
      sportType: a.sportType,
      kind: a.kind as ExportActivity['kind'],
      distanceM: a.distanceM,
      movingSec: a.movingSec,
      elapsedSec: a.elapsedSec,
      elevM: a.elevM,
      avgHr: a.avgHr,
      maxHr: a.maxHr,
      cadence: a.cadence,
      laps: a.lapsJson ? (JSON.parse(a.lapsJson) as ExportActivity['laps']) : null,
      perfAt: a.perfAt,
      polyline: a.polyline,
    }));
  // the stored columns as they are (spec §4.3): an export is a backup, so the legacy fields ride along; only `wake` is read back
  const morning: Record<string, LegacyMorningDay> = {};
  for (const m of db.select().from(morningDays).where(eq(morningDays.userId, userId)).all()) morning[m.date] = { mode: m.mode as LegacyMorningDay['mode'], type: m.type, miles: m.miles, minutes: m.minutes, wake: m.wake };
  return {
    version: 2,
    exportedAt: nowISO(),
    user: { id: u.id, email: u.email, name: u.name ?? null, createdAt: u.createdAt, onboardedAt: u.onboardedAt },
    settings,
    trainingProfile,
    habits: db.select().from(habits).where(eq(habits.userId, userId)).all().map(toHabit),
    checks: db
      .select()
      .from(habitChecks)
      .where(eq(habitChecks.userId, userId))
      .all()
      .map((x) => ({ habitId: x.habitId, date: x.date, done: x.done, note: x.note })),
    blocks: db
      .select()
      .from(planBlocks)
      .where(and(eq(planBlocks.userId, userId), isNull(planBlocks.deletedAt)))
      .all()
      .map((b) => toBlock(b)),
    sessions: db
      .select()
      .from(trainingSessions)
      .where(and(eq(trainingSessions.userId, userId), isNull(trainingSessions.deletedAt)))
      .all()
      .map(toSession),
    activities: acts,
    lifts: db
      .select()
      .from(liftSets)
      .where(and(eq(liftSets.userId, userId), isNull(liftSets.deletedAt)))
      .all()
      .map(toLift),
    todos: db.select().from(todos).where(eq(todos.userId, userId)).all().map(toTodo),
    todoGroups: db.select().from(todoGroups).where(and(eq(todoGroups.userId, userId), isNull(todoGroups.deletedAt))).all().map(toTodoGroup),
    goals: db.select().from(goals).where(and(eq(goals.userId, userId), isNull(goals.deletedAt))).all().map(toGoal),
    goalEvents: db.select().from(goalEvents).where(eq(goalEvents.userId, userId)).all().map(toGoalEvent),
    journal: db
      .select()
      .from(journalEntries)
      .where(and(eq(journalEntries.userId, userId), isNull(journalEntries.deletedAt)))
      .all()
      .map(toEntry),
    quotes: {
      own: db
        .select()
        .from(userQuotes)
        .where(and(eq(userQuotes.userId, userId), isNull(userQuotes.deletedAt)))
        .all()
        .map((q) => ({ id: q.id, text: q.text, author: q.author, createdAt: q.createdAt })),
      prefs: db
        .select()
        .from(quotePrefs)
        .where(eq(quotePrefs.userId, userId))
        .all()
        .map((p) => ({ quoteId: p.quoteId, fav: p.fav, hidden: p.hidden })),
    },
    links: db
      .select()
      .from(links)
      .where(and(eq(links.userId, userId), isNull(links.deletedAt)))
      .all()
      .map(toLink),
    morningDays: morning,
    coach: db
      .select()
      .from(coachReads)
      .where(eq(coachReads.userId, userId))
      .all()
      .map((x) => ({ date: x.date, key: x.key, text: x.text, createdAt: x.createdAt })),
    // what I learned (absent in older exports)
    learnings: db
      .select()
      .from(learnings)
      .where(and(eq(learnings.userId, userId), isNull(learnings.deletedAt)))
      .all()
      .map((l) => ({ id: l.id, date: l.date, text: l.text, createdAt: l.createdAt, editedAt: l.editedAt })),
    // "Remember when": what was boosted, hidden and summarised (absent in older exports; not read back on import)
    recall: db
      .select()
      .from(recallItems)
      .where(eq(recallItems.userId, userId))
      .all()
      .map((r) => ({ kind: r.sourceKind, id: r.sourceId, boost: r.boost, hidden: r.hidden, summary: r.summary, summarizedAt: r.summarizedAt, lastShown: r.lastShown })),
    // day tags, a yes or a no per tag per day (absent in older exports; the tag list is in settings.journalTags)
    dayTags: db
      .select()
      .from(dayTags)
      .where(eq(dayTags.userId, userId))
      .all()
      .map((t) => ({ date: t.date, tag: t.tag, value: t.value })),
    // every answer to a permission step and every Apple Health connect or disconnect, oldest first (not read back on import)
    consentLog: readConsentLog(db, userId),
    // what Logbook holds from Apple Health (not read back on import: the phone has it and sends it again on connect)
    health: exportHealth(db, userId),
    // planned days (read back on import; a day already planned keeps its own plan)
    dayPlans: db
      .select()
      .from(dayPlans)
      .where(eq(dayPlans.userId, userId))
      .all()
      .map((d) => ({ date: d.date, bands: cleanBands({ ...emptyBands(), ...(parseJson(d.bands, {}) as Partial<DayBands>) }), updatedAt: d.updatedAt })),
    // what the assistant proposed and what came of it (not read back on import; the stored change itself stays out)
    assistantActions: db
      .select()
      .from(assistantActions)
      .where(eq(assistantActions.userId, userId))
      .all()
      .map((a) => ({ id: a.id, ask: a.ask, summary: a.summary, labels: parseJson(a.labels, []), status: a.status, createdAt: a.createdAt, appliedAt: a.appliedAt })),
  };
};

/**
 * Where each table that holds a person's rows ends up in the export (`exported`, the key path in the file), or why it is
 * left out (`leftOut`). A test walks every table in `USER_TABLES` and fails when one is in neither, so a new table cannot
 * be forgotten.
 */
export const EXPORT_COVERAGE: Record<string, { exported: string; leftOut?: never } | { leftOut: string; exported?: never }> = {
  auth_sessions: { leftOut: 'Sign-in sessions are keys to the account, not data about the person.' },
  auth_tokens: { leftOut: 'Password reset and verification links are single-use keys, not data.' },
  user_settings: { exported: 'settings' },
  habits: { exported: 'habits' },
  habit_checks: { exported: 'checks' },
  plan_blocks: { exported: 'blocks' },
  training_sessions: { exported: 'sessions' },
  lift_sets: { exported: 'lifts' },
  todos: { exported: 'todos' },
  todo_groups: { exported: 'todoGroups' },
  goals: { exported: 'goals' },
  goal_events: { exported: 'goalEvents' },
  assistant_actions: { exported: 'assistantActions' },
  day_plans: { exported: 'dayPlans' },
  morning_days: { exported: 'morningDays' },
  journal_entries: { exported: 'journal' },
  learnings: { exported: 'learnings' },
  user_quotes: { exported: 'quotes.own' },
  quote_prefs: { exported: 'quotes.prefs' },
  daily_picks: { leftOut: 'Which quote or memory was shown on a day: a rotation counter, worked out again by the app.' },
  shown_items: { leftOut: 'When each quote or memory was last shown: a rotation counter, worked out again by the app.' },
  recall_items: { exported: 'recall' },
  strava_accounts: { leftOut: 'The Strava connection holds access tokens only; the runs it brought are under activities.' },
  activities: { exported: 'activities' },
  hr_zones: { leftOut: 'Heart rate zones copied from Strava, read back from Strava on connect; no screen shows them.' },
  coach_reads: { exported: 'coach' },
  links: { exported: 'links' },
  idempotency_keys: { leftOut: 'Short-lived request receipts that stop a retried change from landing twice.' },
  day_tags: { exported: 'dayTags' },
  health_devices: { exported: 'health.devices' },
  health_samples: { exported: 'health.samples' },
  health_days: { leftOut: 'Daily step and energy sums: no longer filled since Apple Health was narrowed (migration 0019 cleared them).' },
  sleep_segments: { exported: 'health.sleep' },
  health_workouts: { leftOut: 'Workouts from Apple Health: no longer filled since Apple Health was narrowed (migration 0019 cleared them).' },
  health_batches: { leftOut: 'Receipts for upload batches already stored, so a re-sent batch is not written twice.' },
  health_sync: { exported: 'health.connectedAt' },
};

/**
 * The Apple Health part of an export: the connection, the phones connected (never their tokens), and every reading kept:
 * heart rate variability and resting heart rate samples, and sleep segments with their stages. Deleted readings are left out.
 */
export interface HealthExport {
  connectedAt: string | null;
  historyFrom: string | null;
  lastSyncAt: string | null;
  devices: Array<{ name: string; connectedAt: string; lastSeenAt: string | null; revokedAt: string | null }>;
  samples: Array<{ uuid: string; type: string; start: string; end: string; value: number; unit: string; userEntered: boolean; tz: string | null; source: string; productType: string | null }>;
  sleep: Array<{ uuid: string; start: string; end: string; stage: string; tz: string | null; source: string; productType: string | null }>;
}
export const exportHealth = (db: DB, userId: string): HealthExport => {
  const sync = db.select().from(healthSync).where(eq(healthSync.userId, userId)).get();
  return {
    connectedAt: sync?.connectedAt ?? null,
    historyFrom: sync?.historyFrom ?? null,
    lastSyncAt: sync?.lastSyncAt ?? null,
    devices: db
      .select()
      .from(healthDevices)
      .where(eq(healthDevices.userId, userId))
      .all()
      .map((d) => ({ name: d.name, connectedAt: d.createdAt, lastSeenAt: d.lastSeenAt, revokedAt: d.revokedAt })),
    samples: db
      .select()
      .from(healthSamples)
      .where(and(eq(healthSamples.userId, userId), isNull(healthSamples.deletedAt)))
      .orderBy(asc(healthSamples.startAt))
      .all()
      .map((r) => ({ uuid: r.uuid, type: r.type, start: r.startAt, end: r.endAt, value: r.value, unit: r.unit, userEntered: r.userEntered, tz: r.tz, source: r.sourceBundle, productType: r.productType })),
    sleep: db
      .select()
      .from(sleepSegments)
      .where(and(eq(sleepSegments.userId, userId), isNull(sleepSegments.deletedAt)))
      .orderBy(asc(sleepSegments.startAt))
      .all()
      .map((r) => ({ uuid: r.uuid, start: r.startAt, end: r.endAt, stage: r.stage, tz: r.tz, source: r.sourceBundle, productType: r.productType })),
  };
};
type RecallExport = { kind: string; id: string; boost: boolean; hidden: boolean; summary: string | null; summarizedAt: string | null; lastShown: string | null };
type DayTagExport = { date: string; tag: string; value: boolean };

// ---------- import ----------

const zDay = z.string().refine(isISODate);
const zId = z.string().min(1).max(120);
const str = (max: number) => z.string().max(max);
const opt = <T extends z.ZodType>(t: T) => t.nullable().optional();
/**
 * The most rows of each kind one import takes: far above years of daily use, low enough that a crafted file cannot make
 * the server write millions of rows (the body itself is capped at 20 MB in index.ts).
 */
export const IMPORT_CAPS = {
  habits: 500,
  checks: 100_000,
  blocks: 1_000,
  sessions: 50_000,
  activities: 50_000,
  lifts: 100_000,
  todos: 50_000,
  todoGroups: 200,
  goals: 20_000,
  goalEvents: 100_000,
  journal: 50_000,
  quotesOwn: 10_000,
  quotesPrefs: 20_000,
  links: 20_000,
  morningDays: 20_000,
  coach: 50_000,
  learnings: 50_000,
  dayTags: 100_000,
  dayPlans: 20_000,
} as const;

/** A version 2 export. Lenient where it costs nothing (extra fields are ignored), strict where a bad row would break the app. */
export const zExportV2 = z.object({
  version: z.literal(2),
  user: z.object({ name: opt(str(60)) }).passthrough().optional(),
  settings: z.record(z.string(), z.unknown()).default({}),
  trainingProfile: z.unknown().optional(),
  habits: z.array(z.object({ id: zId, name: str(80).min(1), position: z.number().int().default(0), createdOn: zDay, archivedOn: opt(zDay) })).max(IMPORT_CAPS.habits).default([]),
  checks: z.array(z.object({ habitId: zId, date: zDay, done: z.boolean(), note: opt(str(280)) })).max(IMPORT_CAPS.checks).default([]),
  blocks: z.array(z.object({ id: zId, name: str(120), start: zDay, end: zDay, source: opt(str(40)), summary: opt(str(600)), createdAt: z.string() })).max(IMPORT_CAPS.blocks).default([]),
  sessions: z
    .array(
      z.object({
        id: zId,
        date: zDay,
        position: z.number().int().default(0),
        kind: z.enum(['run', 'lift', 'cross', 'rest']),
        type: opt(str(40)),
        title: opt(str(120)),
        details: opt(str(2000)),
        miles: opt(z.number()),
        minutes: opt(z.number()),
        blockId: opt(zId),
        movedFrom: opt(zDay),
        mark: opt(z.enum(['done', 'floor', 'skip', 'sick'])),
        effort: opt(z.number().int().min(1).max(10)),
      }),
    )
    .max(IMPORT_CAPS.sessions).default([]),
  activities: z
    .array(
      z.object({
        id: zId,
        date: zDay,
        time: opt(str(8)),
        name: str(200),
        sportType: str(60),
        kind: z.enum(['run', 'lift', 'cross']),
        distanceM: z.number(),
        movingSec: z.number(),
        elapsedSec: z.number().optional(),
        elevM: z.number().default(0),
        avgHr: opt(z.number()),
        maxHr: opt(z.number()),
        cadence: opt(z.number()),
        laps: opt(z.array(z.tuple([z.number(), z.number(), z.number().nullable()]))),
        perfAt: opt(z.string()),
        polyline: opt(z.string()),
      }),
    )
    .max(IMPORT_CAPS.activities).default([]),
  lifts: z.array(z.object({ id: zId, date: zDay, exercise: str(60).min(1), weight: z.number(), reps: z.number(), createdAt: z.string() })).max(IMPORT_CAPS.lifts).default([]),
  todos: z
    .array(
      z.object({
        id: zId,
        text: str(200).min(1),
        note: opt(str(1000)),
        priority: z.number().int().min(0).max(3).default(0),
        color: opt(z.enum(['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'])),
        groupId: opt(str(64)),
        due: opt(zDay),
        bucket: z.enum(['today', 'later', 'someday']).default('today'),
        position: z.number().int().default(0),
        createdOn: zDay,
        doneOn: opt(zDay),
        deletedOn: opt(zDay),
        createdAt: z.string(),
      }),
    )
    .max(IMPORT_CAPS.todos).default([]),
  todoGroups: z.array(z.object({ id: zId, name: str(30).min(1), color: z.enum(['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink']), position: z.number().int().default(0), createdAt: z.string() })).max(IMPORT_CAPS.todoGroups).default([]),
  goals: z
    .array(
      z.object({
        id: zId,
        level: z.enum(['year', 'month', 'week', 'day']),
        period: str(10).min(4),
        text: str(400).min(1),
        original: opt(str(400)),
        why: opt(str(300)),
        status: z.enum(['open', 'done', 'partly', 'missed']).default('open'),
        reflection: opt(str(500)),
        steps: z.array(z.object({ id: str(40).min(1), text: str(120).min(1), done: z.boolean() })).max(5).default([]),
        createdAt: z.string(),
        updatedAt: z.string(),
        closedAt: opt(z.string()),
      }),
    )
    .max(IMPORT_CAPS.goals).default([]),
  goalEvents: z
    .array(z.object({ id: zId, goalId: zId, level: z.enum(['year', 'month', 'week', 'day']), period: str(10).min(4), kind: z.enum(['set', 'sharpened', 'kept', 'edited', 'done', 'partly', 'missed', 'reopened', 'cleared', 'step', 'unstep']), text: opt(str(500)), at: z.string() }))
    .max(IMPORT_CAPS.goalEvents).default([]),
  journal: z.array(z.object({ id: zId, date: zDay, text: str(5000).min(1), createdAt: z.string(), editedAt: opt(z.string()), fav: z.boolean().default(false) })).max(IMPORT_CAPS.journal).default([]),
  quotes: z
    .object({
      own: z.array(z.object({ id: zId, text: str(400).min(1), author: str(80).default(''), createdAt: z.string() })).max(IMPORT_CAPS.quotesOwn).default([]),
      prefs: z.array(z.object({ quoteId: zId, fav: z.boolean(), hidden: z.boolean() })).max(IMPORT_CAPS.quotesPrefs).default([]),
    })
    .default({ own: [], prefs: [] }),
  links: z
    .array(
      z.object({
        id: zId,
        url: str(2000).min(1),
        title: str(400),
        siteName: str(200).default(''),
        description: opt(str(2000)),
        imageUrl: opt(str(2000)),
        note: opt(str(2000)),
        tags: z.array(z.string()).default([]),
        addedAt: z.string(),
        readAt: opt(z.string()),
        source: z.enum(['me', 'pick']).default('me'),
        pickReason: opt(str(600)),
        pickDate: opt(zDay),
        verdict: opt(z.enum(['saved', 'dismissed'])),
      }),
    )
    .max(IMPORT_CAPS.links).default([]),
  // `wake` required, the four legacy fields optional: an old file with all five imports, and so does one with `{ wake }` alone
  morningDays: z
    .record(zDay, z.object({ wake: z.number(), mode: z.enum(['run', 'gym', 'rest']).optional(), type: str(30).optional(), miles: z.number().optional(), minutes: z.number().optional() }))
    .refine((m) => Object.keys(m).length <= IMPORT_CAPS.morningDays, `At most ${IMPORT_CAPS.morningDays} mornings`)
    .default({}),
  coach: z.array(z.object({ date: zDay, key: str(120), text: str(2000), createdAt: z.string() })).max(IMPORT_CAPS.coach).default([]),
  learnings: z.array(z.object({ id: zId, date: zDay, text: str(LEARNING_MAX).min(1), createdAt: z.string(), editedAt: opt(z.string()) })).max(IMPORT_CAPS.learnings).default([]),
  dayTags: z.array(z.object({ date: zDay, tag: str(32).min(1), value: z.boolean() })).max(IMPORT_CAPS.dayTags).default([]),
  dayPlans: z.array(z.object({ date: zDay, bands: zDayPlanPut.shape.bands })).max(IMPORT_CAPS.dayPlans).default([]),
});
export type ImportV2 = z.infer<typeof zExportV2>;

const zImportTags = z.array(z.object({ id: z.string().min(1).max(32).regex(/^[a-z0-9-]+$/), label: z.string().trim().min(1).max(DAY_TAG_LABEL_MAX) })).max(DAY_TAG_MAX);
/**
 * The `user_settings` documents an import may write, each with the check that makes it safe (undefined: leave it out).
 * Everything else in a file's `settings` is ignored: `consent`, `consentLog`, `intros`, `status`, counters.
 */
export const IMPORTABLE_SETTINGS: Record<string, (v: unknown) => unknown> = {
  morning: (v) => (v && typeof v === 'object' && !Array.isArray(v) ? normalizeMorningSettings(v as Record<string, unknown>) : undefined),
  journalTags: (v) => {
    const r = zImportTags.safeParse(v);
    return r.success ? r.data : undefined;
  },
  sleepGoalMin: (v) => (typeof v === 'number' && Number.isInteger(v) && v >= 240 && v <= 720 ? v : undefined),
};

/**
 * Write a version 2 export into `userId`'s account, in one transaction. Idempotent by id: a row whose id this account
 * already has is left alone. An id that belongs to another account (importing into a fresh account on the same server)
 * is renamed the same way every time (`<id>-<hash of the account>`), and every reference to it (a session's block, a
 * check's habit, a favourite on one of your own quotes, a coach read's session) follows. Answers what it added per table.
 */
export const importV2 = (db: DB, userId: string, b: ImportV2): Record<string, number> => {
  const { steps, counts } = importSteps(db, userId, b);
  db.transaction(() => {
    for (let r = steps.next(); !r.done; r = steps.next());
  });
  return counts;
};

/**
 * The same import in chunks of `chunk` rows, each its own transaction, with a turn of the event loop between them, so a
 * large file never holds the server for long. A chunk that fails rolls back alone; the import is idempotent by id, so
 * sending the file again finishes it.
 */
export const importV2Chunked = async (db: DB, userId: string, b: ImportV2, chunk = 500): Promise<Record<string, number>> => {
  const { steps, counts } = importSteps(db, userId, b);
  let done = false;
  while (!done) {
    db.transaction(() => {
      for (let i = 0; i < chunk; i++) if (steps.next().done) return void (done = true);
    });
    if (!done) await new Promise((r) => setImmediate(r));
  }
  return counts;
};

/** The import as a sequence of steps: it pauses (yields) before each row, so the caller decides where transactions end. */
const importSteps = (db: DB, userId: string, b: ImportV2): { steps: Generator<void, void, void>; counts: Record<string, number> } => {
  const counts: Record<string, number> = {};
  const bump = (k: string, n = 1) => (counts[k] = (counts[k] ?? 0) + n);
  const salt = createHash('sha256').update(userId).digest('hex').slice(0, 8);
  const now = nowISO();

  function* run(t: DB): Generator<void, void, void> {
    /** The id this account will use for `id` in `table`, and whether the account already has it. */
    const claim = (table: SQLiteTable, idCol: SQLiteColumn, userCol: SQLiteColumn, id: string): { id: string; have: boolean } => {
      for (let i = 0; i < 4; i++) {
        const cand = i === 0 ? id : `${id}-${salt}${i > 1 ? i : ''}`;
        const row = t.select({ u: userCol }).from(table).where(eq(idCol, cand) as SQL).get() as { u: string } | undefined;
        if (!row) return { id: cand, have: false };
        if (row.u === userId) return { id: cand, have: true };
      }
      throw new Error(`no free id for ${id}`);
    };
    const maps = { habits: new Map<string, string>(), blocks: new Map<string, string>(), sessions: new Map<string, string>(), quotes: new Map<string, string>() };

    // ---------- the account ----------
    const me = t.select().from(users).where(eq(users.id, userId)).get()!;
    const name = typeof b.user?.name === 'string' ? b.user.name.trim() : '';
    if (!me.name && name) {
      t.update(users).set({ name }).where(eq(users.id, userId)).run();
      bump('name');
    }
    if (!me.trainingProfile && b.trainingProfile && typeof b.trainingProfile === 'object') {
      t.update(users).set({ trainingProfile: JSON.stringify(b.trainingProfile) }).where(eq(users.id, userId)).run();
      bump('trainingProfile');
    }
    // only the settings on the allow-list come in, each checked: a file never carries consent, the consent log, the
    // feature intros or a training status into an account (a yes to an AI switch is given in the app, never imported)
    for (const [key, check] of Object.entries(IMPORTABLE_SETTINGS)) {
      yield;
      const value = check(b.settings[key]);
      if (value === undefined) continue;
      const res = t.insert(userSettings).values({ userId, key, json: JSON.stringify(value), updatedAt: now }).onConflictDoNothing().run();
      if (res.changes) bump('settings');
    }

    // ---------- habits and checks ----------
    for (const h of b.habits) {
      yield;
      const c = claim(habits, habits.id, habits.userId, h.id);
      maps.habits.set(h.id, c.id);
      if (c.have) continue;
      t.insert(habits).values({ id: c.id, userId, name: h.name, position: h.position, createdOn: h.createdOn, archivedOn: h.archivedOn ?? null }).run();
      bump('habits');
    }
    for (const x of b.checks) {
      yield;
      const habitId = maps.habits.get(x.habitId);
      if (!habitId) continue;
      const res = t.insert(habitChecks).values({ userId, habitId, date: x.date, done: x.done, note: x.note ?? null, updatedAt: now }).onConflictDoNothing().run();
      if (res.changes) bump('checks');
    }

    // ---------- blocks and sessions ----------
    for (const bl of b.blocks) {
      yield;
      const c = claim(planBlocks, planBlocks.id, planBlocks.userId, bl.id);
      maps.blocks.set(bl.id, c.id);
      if (c.have) continue;
      t.insert(planBlocks).values({ id: c.id, userId, name: bl.name, start: bl.start, end: bl.end, source: bl.source ?? null, summary: bl.summary ?? null, createdAt: bl.createdAt }).run();
      bump('blocks');
    }
    for (const s of b.sessions) {
      yield;
      const c = claim(trainingSessions, trainingSessions.id, trainingSessions.userId, s.id);
      maps.sessions.set(s.id, c.id);
      if (c.have) continue;
      t.insert(trainingSessions)
        .values({
          id: c.id,
          userId,
          date: s.date,
          position: s.position,
          kind: s.kind,
          type: s.type ?? null,
          title: s.title ?? null,
          details: s.details ?? null,
          miles: s.kind === 'run' ? (s.miles ?? null) : null,
          minutes: s.minutes != null ? Math.round(s.minutes) : null,
          blockId: s.blockId ? (maps.blocks.get(s.blockId) ?? null) : null,
          movedFrom: s.movedFrom ?? null,
          mark: s.mark ?? null,
          effort: s.effort ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      bump('sessions');
    }

    // ---------- what happened ----------
    for (const a of b.activities) {
      yield;
      const c = claim(activities, activities.id, activities.userId, a.id);
      if (c.have) continue;
      t.insert(activities)
        .values({
          id: c.id,
          userId,
          date: a.date,
          time: a.time ?? null,
          name: a.name,
          sportType: a.sportType,
          kind: a.kind,
          distanceM: a.distanceM,
          movingSec: Math.round(a.movingSec),
          elapsedSec: Math.round(a.elapsedSec ?? a.movingSec),
          elevM: a.elevM,
          avgHr: a.avgHr != null ? Math.round(a.avgHr) : null,
          maxHr: a.maxHr != null ? Math.round(a.maxHr) : null,
          cadence: a.cadence != null ? Math.round(a.cadence) : null,
          lapsJson: a.laps ? JSON.stringify(a.laps) : null,
          perfAt: a.perfAt ?? null,
          perfFailed: 0,
          polyline: a.polyline ?? null,
          deletedAt: null,
          updatedAt: now,
        })
        .run();
      bump('activities');
    }
    for (const l of b.lifts) {
      yield;
      const c = claim(liftSets, liftSets.id, liftSets.userId, l.id);
      if (c.have) continue;
      t.insert(liftSets).values({ id: c.id, userId, date: l.date, exercise: l.exercise, weight: l.weight, reps: Math.round(l.reps), createdAt: l.createdAt, deletedAt: null }).run();
      bump('lifts');
    }

    // ---------- to-dos, journal, quotes, links ----------
    const groupIds = new Map<string, string>();
    for (const g of b.todoGroups) {
      yield;
      const c = claim(todoGroups, todoGroups.id, todoGroups.userId, g.id);
      groupIds.set(g.id, c.id);
      if (c.have) continue;
      t.insert(todoGroups).values({ id: c.id, userId, name: g.name, color: g.color, position: g.position, createdAt: g.createdAt, deletedAt: null }).run();
      bump('todoGroups');
    }
    for (const x of b.todos) {
      yield;
      const c = claim(todos, todos.id, todos.userId, x.id);
      if (c.have) continue;
      t.insert(todos)
        .values({ id: c.id, userId, text: x.text, note: x.note ?? null, priority: x.priority, color: x.color ?? null, groupId: x.groupId ? (groupIds.get(x.groupId) ?? null) : null, due: x.due ?? null, bucket: x.bucket, position: x.position, createdOn: x.createdOn, doneOn: x.doneOn ?? null, deletedOn: x.deletedOn ?? null, createdAt: x.createdAt })
        .run();
      bump('todos');
    }
    for (const e of b.journal) {
      yield;
      const c = claim(journalEntries, journalEntries.id, journalEntries.userId, e.id);
      if (c.have) continue;
      t.insert(journalEntries).values({ id: c.id, userId, date: e.date, text: e.text, fav: e.fav, createdAt: e.createdAt, editedAt: e.editedAt ?? null, deletedAt: null }).run();
      bump('journal');
    }
    for (const q of b.quotes.own) {
      yield;
      const c = claim(userQuotes, userQuotes.id, userQuotes.userId, q.id);
      maps.quotes.set(q.id, c.id);
      if (c.have) continue;
      t.insert(userQuotes).values({ id: c.id, userId, text: q.text, author: q.author, createdAt: q.createdAt, deletedAt: null }).run();
      bump('quotes');
    }
    for (const p of b.quotes.prefs) {
      yield;
      const quoteId = maps.quotes.get(p.quoteId) ?? p.quoteId;
      const res = t.insert(quotePrefs).values({ userId, quoteId, fav: p.fav, hidden: p.hidden }).onConflictDoNothing().run();
      if (res.changes) bump('quotePrefs');
    }
    for (const l of b.links) {
      yield;
      const c = claim(links, links.id, links.userId, l.id);
      if (c.have) continue;
      t.insert(links)
        .values({
          id: c.id,
          userId,
          url: l.url,
          title: l.title,
          siteName: l.siteName,
          description: l.description ?? null,
          imageUrl: l.imageUrl ?? null,
          note: l.note ?? null,
          tagsJson: JSON.stringify(l.tags.filter((x) => typeof x === 'string').slice(0, 20)),
          addedAt: l.addedAt,
          readAt: l.readAt ?? null,
          source: l.source,
          pickReason: l.pickReason ?? null,
          pickDate: l.pickDate ?? null,
          verdict: l.verdict ?? null,
          deletedAt: null,
        })
        .run();
      bump('links');
    }

    // ---------- morning days, coach reads ----------
    for (const [date, m] of Object.entries(b.morningDays)) {
      yield;
      const res = t
        .insert(morningDays)
        // a missing legacy column gets the same neutral filler as PUT /morning/days (nothing reads them)
        .values({ userId, date, mode: m.mode ?? 'run', type: m.type ?? '', miles: m.miles ?? 0, minutes: Math.round(m.minutes ?? 0), wake: Math.round(m.wake) })
        .onConflictDoNothing()
        .run();
      if (res.changes) bump('morningDays');
    }
    // ---------- goals and their log ----------
    const goalIds = new Map<string, string>();
    for (const g of b.goals) {
      yield;
      // one goal per period: an account that already has one for that period keeps its own
      const same = t.select({ id: goals.id }).from(goals).where(and(eq(goals.userId, userId), eq(goals.level, g.level), eq(goals.period, g.period))).get();
      if (same) {
        goalIds.set(g.id, same.id);
        continue;
      }
      const c = claim(goals, goals.id, goals.userId, g.id);
      goalIds.set(g.id, c.id);
      if (c.have) continue;
      t.insert(goals).values({ id: c.id, userId, level: g.level, period: g.period, text: g.text, original: g.original ?? null, why: g.why ?? null, status: g.status, reflection: g.reflection ?? null, steps: JSON.stringify(g.steps), createdAt: g.createdAt, updatedAt: g.updatedAt, closedAt: g.closedAt ?? null, deletedAt: null }).run();
      bump('goals');
    }
    for (const e of b.goalEvents) {
      yield;
      const c = claim(goalEvents, goalEvents.id, goalEvents.userId, e.id);
      if (c.have) continue;
      t.insert(goalEvents).values({ id: c.id, userId, goalId: goalIds.get(e.goalId) ?? e.goalId, level: e.level, period: e.period, kind: e.kind, text: e.text ?? null, at: e.at }).run();
      bump('goalEvents');
    }
    for (const x of b.coach) {
      yield;
      const key = maps.sessions.get(x.key) ?? x.key;
      const res = t.insert(coachReads).values({ userId, date: x.date, key, text: x.text, createdAt: x.createdAt }).onConflictDoNothing().run();
      if (res.changes) bump('coach');
    }
    // ---------- what I learned ----------
    for (const l of b.learnings) {
      yield;
      const c = claim(learnings, learnings.id, learnings.userId, l.id);
      if (c.have) continue;
      t.insert(learnings).values({ id: c.id, userId, date: l.date, text: l.text, createdAt: l.createdAt, editedAt: l.editedAt ?? null, deletedAt: null }).run();
      bump('learnings');
    }
    // ---------- day tags (a mark already there is kept) ----------
    for (const x of b.dayTags) {
      yield;
      const res = t.insert(dayTags).values({ userId, date: x.date, tag: x.tag, value: x.value, updatedAt: nowISO() }).onConflictDoNothing().run();
      if (res.changes) bump('dayTags');
    }
    // ---------- planned days (a day already planned keeps its own) ----------
    for (const d of b.dayPlans) {
      yield;
      const res = t.insert(dayPlans).values({ id: `dp_${createHash('sha256').update(`${userId}:${d.date}`).digest('hex').slice(0, 16)}`, userId, date: d.date, bands: JSON.stringify(cleanBands(d.bands)), updatedAt: now }).onConflictDoNothing().run();
      if (res.changes) bump('dayPlans');
    }
  }
  return { steps: run(db), counts };
};
