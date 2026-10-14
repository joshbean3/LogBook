import { createHash } from 'node:crypto';
import { isISODate, type ExportActivity, type ExportV2, type MorningDayOverride } from '@logbook/shared';
import { and, eq, isNull, type SQL } from 'drizzle-orm';
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
import { toBlock, toEntry, toHabit, toLift, toSession, toTodo } from '../lib/map.js';
import { nowISO } from '../lib/util.js';
import { toLink } from '../routes/reads.js';

/**
 * Contract 3: `GET /export` is the whole account as one JSON document (version 2), and `POST /import` takes it back,
 * into the same account or a fresh one, idempotently by id. Soft-deleted rows are not exported (they are gone to the
 * athlete); to-dos keep their `deletedOn` (it is part of the to-do).
 */
export const exportAccount = (db: DB, userId: string): ExportV2 => {
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
  const morning: Record<string, MorningDayOverride> = {};
  for (const m of db.select().from(morningDays).where(eq(morningDays.userId, userId)).all()) morning[m.date] = { mode: m.mode as MorningDayOverride['mode'], type: m.type, miles: m.miles, minutes: m.minutes, wake: m.wake };
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
  };
};

// ---------- import ----------

const zDay = z.string().refine(isISODate);
const zId = z.string().min(1).max(120);
const str = (max: number) => z.string().max(max);
const opt = <T extends z.ZodType>(t: T) => t.nullable().optional();

/** A version 2 export. Lenient where it costs nothing (extra fields are ignored), strict where a bad row would break the app. */
export const zExportV2 = z.object({
  version: z.literal(2),
  user: z.object({ name: opt(str(60)) }).passthrough().optional(),
  settings: z.record(z.string(), z.unknown()).default({}),
  trainingProfile: z.unknown().optional(),
  habits: z.array(z.object({ id: zId, name: str(80).min(1), position: z.number().int().default(0), createdOn: zDay, archivedOn: opt(zDay) })).default([]),
  checks: z.array(z.object({ habitId: zId, date: zDay, done: z.boolean(), note: opt(str(280)) })).default([]),
  blocks: z.array(z.object({ id: zId, name: str(120), start: zDay, end: zDay, source: opt(str(40)), summary: opt(str(600)), createdAt: z.string() })).default([]),
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
      }),
    )
    .default([]),
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
    .default([]),
  lifts: z.array(z.object({ id: zId, date: zDay, exercise: str(60).min(1), weight: z.number(), reps: z.number(), createdAt: z.string() })).default([]),
  todos: z
    .array(
      z.object({
        id: zId,
        text: str(200).min(1),
        note: opt(str(1000)),
        priority: z.number().int().min(0).max(2).default(0),
        due: opt(zDay),
        bucket: z.enum(['today', 'later', 'someday']).default('today'),
        position: z.number().int().default(0),
        createdOn: zDay,
        doneOn: opt(zDay),
        deletedOn: opt(zDay),
        createdAt: z.string(),
      }),
    )
    .default([]),
  journal: z.array(z.object({ id: zId, date: zDay, text: str(5000).min(1), createdAt: z.string(), editedAt: opt(z.string()), fav: z.boolean().default(false) })).default([]),
  quotes: z
    .object({
      own: z.array(z.object({ id: zId, text: str(400).min(1), author: str(80).default(''), createdAt: z.string() })).default([]),
      prefs: z.array(z.object({ quoteId: zId, fav: z.boolean(), hidden: z.boolean() })).default([]),
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
    .default([]),
  morningDays: z.record(zDay, z.object({ mode: z.enum(['run', 'gym', 'rest']), type: str(30), miles: z.number(), minutes: z.number(), wake: z.number() })).default({}),
  coach: z.array(z.object({ date: zDay, key: str(120), text: str(2000), createdAt: z.string() })).default([]),
});
export type ImportV2 = z.infer<typeof zExportV2>;

/**
 * Write a version 2 export into `userId`'s account, in one transaction. Idempotent by id: a row whose id this account
 * already has is left alone. An id that belongs to another account (importing into a fresh account on the same server)
 * is renamed the same way every time (`<id>-<hash of the account>`), and every reference to it (a session's block, a
 * check's habit, a favourite on one of your own quotes, a coach read's session) follows. Answers what it added per table.
 */
export const importV2 = (db: DB, userId: string, b: ImportV2): Record<string, number> => {
  const counts: Record<string, number> = {};
  const bump = (k: string, n = 1) => (counts[k] = (counts[k] ?? 0) + n);
  const salt = createHash('sha256').update(userId).digest('hex').slice(0, 8);
  const now = nowISO();

  db.transaction((tx) => {
    const t = tx as unknown as DB;
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
    for (const [key, value] of Object.entries(b.settings)) {
      if (!/^[a-z][a-z0-9_.-]{0,40}$/i.test(key) || value === undefined) continue;
      const res = t.insert(userSettings).values({ userId, key, json: JSON.stringify(value), updatedAt: now }).onConflictDoNothing().run();
      if (res.changes) bump('settings');
    }

    // ---------- habits and checks ----------
    for (const h of b.habits) {
      const c = claim(habits, habits.id, habits.userId, h.id);
      maps.habits.set(h.id, c.id);
      if (c.have) continue;
      t.insert(habits).values({ id: c.id, userId, name: h.name, position: h.position, createdOn: h.createdOn, archivedOn: h.archivedOn ?? null }).run();
      bump('habits');
    }
    for (const x of b.checks) {
      const habitId = maps.habits.get(x.habitId);
      if (!habitId) continue;
      const res = t.insert(habitChecks).values({ userId, habitId, date: x.date, done: x.done, note: x.note ?? null, updatedAt: now }).onConflictDoNothing().run();
      if (res.changes) bump('checks');
    }

    // ---------- blocks and sessions ----------
    for (const bl of b.blocks) {
      const c = claim(planBlocks, planBlocks.id, planBlocks.userId, bl.id);
      maps.blocks.set(bl.id, c.id);
      if (c.have) continue;
      t.insert(planBlocks).values({ id: c.id, userId, name: bl.name, start: bl.start, end: bl.end, source: bl.source ?? null, summary: bl.summary ?? null, createdAt: bl.createdAt }).run();
      bump('blocks');
    }
    for (const s of b.sessions) {
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
          createdAt: now,
          updatedAt: now,
        })
        .run();
      bump('sessions');
    }

    // ---------- what happened ----------
    for (const a of b.activities) {
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
      const c = claim(liftSets, liftSets.id, liftSets.userId, l.id);
      if (c.have) continue;
      t.insert(liftSets).values({ id: c.id, userId, date: l.date, exercise: l.exercise, weight: l.weight, reps: Math.round(l.reps), createdAt: l.createdAt, deletedAt: null }).run();
      bump('lifts');
    }

    // ---------- to-dos, journal, quotes, links ----------
    for (const x of b.todos) {
      const c = claim(todos, todos.id, todos.userId, x.id);
      if (c.have) continue;
      t.insert(todos)
        .values({ id: c.id, userId, text: x.text, note: x.note ?? null, priority: x.priority, due: x.due ?? null, bucket: x.bucket, position: x.position, createdOn: x.createdOn, doneOn: x.doneOn ?? null, deletedOn: x.deletedOn ?? null, createdAt: x.createdAt })
        .run();
      bump('todos');
    }
    for (const e of b.journal) {
      const c = claim(journalEntries, journalEntries.id, journalEntries.userId, e.id);
      if (c.have) continue;
      t.insert(journalEntries).values({ id: c.id, userId, date: e.date, text: e.text, fav: e.fav, createdAt: e.createdAt, editedAt: e.editedAt ?? null, deletedAt: null }).run();
      bump('journal');
    }
    for (const q of b.quotes.own) {
      const c = claim(userQuotes, userQuotes.id, userQuotes.userId, q.id);
      maps.quotes.set(q.id, c.id);
      if (c.have) continue;
      t.insert(userQuotes).values({ id: c.id, userId, text: q.text, author: q.author, createdAt: q.createdAt, deletedAt: null }).run();
      bump('quotes');
    }
    for (const p of b.quotes.prefs) {
      const quoteId = maps.quotes.get(p.quoteId) ?? p.quoteId;
      const res = t.insert(quotePrefs).values({ userId, quoteId, fav: p.fav, hidden: p.hidden }).onConflictDoNothing().run();
      if (res.changes) bump('quotePrefs');
    }
    for (const l of b.links) {
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
      const res = t
        .insert(morningDays)
        .values({ userId, date, mode: m.mode, type: m.type, miles: m.miles, minutes: Math.round(m.minutes), wake: Math.round(m.wake) })
        .onConflictDoNothing()
        .run();
      if (res.changes) bump('morningDays');
    }
    for (const x of b.coach) {
      const key = maps.sessions.get(x.key) ?? x.key;
      const res = t.insert(coachReads).values({ userId, date: x.date, key, text: x.text, createdAt: x.createdAt }).onConflictDoNothing().run();
      if (res.changes) bump('coach');
    }
  });
  return counts;
};
