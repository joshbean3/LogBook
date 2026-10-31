import {
  addMonths,
  DEFAULT_DAY_SETTINGS,
  morningPlanFor,
  monthStart,
  NEW_ACCOUNT_MORNING,
  normalizeMorningSettings,
  shiftDays,
  today,
  zDate,
  zDaySettings,
  zHabitCheck,
  zHabitInput,
  zHabitsReorder,
  zLiftInput,
  zMarkSession,
  zMonth,
  zMorningDay,
  zMorningSettingsPatch,
  zMoveSession,
  zSessionInput,
  zTodoInput,
  zTodoPatch,
  zTodoGroupInput,
  zTodoGroupPatch,
  zTodosReorder,
  type HabitCheck,
  type HrZone,
  type MorningDayOverride,
  type MorningSettings,
} from '@logbook/shared';
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { AuthEnv } from '../auth.js';
import type { DB } from '../db/index.js';
import { activities, coachReads, habitChecks, habits, hrZones, journalEntries, liftSets, morningDays, planBlocks, todoGroups, todos, trainingSessions, users, userSettings } from '../db/schema.js';
import { env } from '../env.js';
import { toActivity, toBlock, toEntry, toHabit, toLift, toSession, toTodo, toTodoGroup } from '../lib/map.js';
import { ApiError, nowISO, parseBody, parseQuery, uid } from '../lib/util.js';
import { connectionStatuses, syncInBackground } from '../services/providers/index.js';
import { stravaStatus } from '../services/strava.js';
import { hasPush } from '../services/push.js';
import { z } from 'zod';
import { readTrainingProfile } from '../services/training.js';
import { deleteBlock, restoreBlock } from '../services/plans.js';

export const deepMerge = (a: any, b: any): any => {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return b;
  const out = { ...(a && typeof a === 'object' ? a : {}) };
  for (const k of Object.keys(b)) out[k] = deepMerge(out[k], b[k]);
  return out;
};

export const readSetting = <T>(db: DB, userId: string, key: string): T | null => {
  const row = db.select().from(userSettings).where(and(eq(userSettings.userId, userId), eq(userSettings.key, key))).get();
  return row ? (JSON.parse(row.json) as T) : null;
};
export const writeSetting = (db: DB, userId: string, key: string, value: unknown) => {
  db.insert(userSettings)
    .values({ userId, key, json: JSON.stringify(value), updatedAt: nowISO() })
    .onConflictDoUpdate({ target: [userSettings.userId, userSettings.key], set: { json: JSON.stringify(value), updatedAt: nowISO() } })
    .run();
};

/** The stored morning, or for an account that never saved one the new-account routine (contract 7: no smoothie). */
export const morningSettingsOf = (db: DB, userId: string): MorningSettings => normalizeMorningSettings(readSetting(db, userId, 'morning') ?? NEW_ACCOUNT_MORNING);

export const sessionsBetween = (db: DB, userId: string, from: string, to: string) =>
  db
    .select()
    .from(trainingSessions)
    .where(and(eq(trainingSessions.userId, userId), isNull(trainingSessions.deletedAt), gte(trainingSessions.date, from), lte(trainingSessions.date, to)))
    .orderBy(asc(trainingSessions.date), asc(trainingSessions.position), asc(trainingSessions.createdAt))
    .all()
    .map(toSession);

export const activitiesBetween = (db: DB, userId: string, from: string, to: string) =>
  db
    .select()
    .from(activities)
    // a row another provider also recorded (`duplicate_of`) is left out: status and miles count each run once
    .where(and(eq(activities.userId, userId), isNull(activities.deletedAt), isNull(activities.duplicateOf), gte(activities.date, from), lte(activities.date, to)))
    .orderBy(asc(activities.date), asc(activities.time))
    .all()
    .map(toActivity);

export const zonesOf = (db: DB, userId: string): HrZone[] | null => {
  const row = db.select().from(hrZones).where(eq(hrZones.userId, userId)).get();
  return row ? (JSON.parse(row.zonesJson) as HrZone[]) : null;
};

export const coreRoutes = (db: DB) => {
  const r = new Hono<AuthEnv>();
  const uidOf = (c: { get: (k: 'user') => { id: string } }) => c.get('user').id;

  // ---------- everything the app needs on open ----------
  r.get('/bootstrap', (c) => {
    const userId = uidOf(c);
    // opening the app is the moment to pull in new runs: sync when the last one is older than 15 minutes
    const connections = connectionStatuses(db, userId);
    for (const cs of connections) if (cs.connected && cs.configured && cs.status !== 'needs_reauth' && cs.status !== 'revoked' && !cs.syncing && (!cs.lastSyncAt || Date.now() - new Date(cs.lastSyncAt).getTime() > 15 * 60_000)) syncInBackground(db, userId, cs.provider);
    const st = stravaStatus(db, userId);
    const acct = db.select({ timezone: users.timezone, profileNote: users.profileNote }).from(users).where(eq(users.id, userId)).get();
    const hs = db.select().from(habits).where(eq(habits.userId, userId)).orderBy(asc(habits.position), asc(habits.createdOn)).all().map(toHabit);
    const blocks = db.select().from(planBlocks).where(and(eq(planBlocks.userId, userId), isNull(planBlocks.deletedAt))).orderBy(asc(planBlocks.start)).all();
    const counts = blocks.length
      ? db
          .select({ blockId: trainingSessions.blockId, n: sql<number>`count(*)` })
          .from(trainingSessions)
          .where(and(eq(trainingSessions.userId, userId), isNull(trainingSessions.deletedAt), inArray(trainingSessions.blockId, blocks.map((b) => b.id))))
          .groupBy(trainingSessions.blockId)
          .all()
      : [];
    const countOf = new Map(counts.map((x) => [x.blockId, x.n]));
    return c.json({
      user: { ...c.get('user'), trainingProfile: readTrainingProfile(db, userId), timezone: acct?.timezone ?? null, profileNote: acct?.profileNote ?? null },
      habits: hs,
      blocks: blocks.map((b) => toBlock(b, countOf.get(b.id) ?? 0)),
      morningSettings: morningSettingsOf(db, userId),
      // the timeline's window and work hours (docs/today-v6.md §5; `GET/PATCH /me/day`), the defaults until set
      daySettings: ((d) => (d.success ? d.data : DEFAULT_DAY_SETTINGS))(zDaySettings.safeParse(readSetting(db, userId, 'day'))),
      zones: zonesOf(db, userId),
      strava: st,
      connections,
      pushEnabled: hasPush(db, userId),
      features: { claude: env.claudeConfigured, strava: env.stravaConfigured, coros: env.corosConfigured, notifications: env.vapidConfigured },
      serverTime: nowISO(),
    });
  });

  // ---------- one month of everything dated ----------
  r.get('/months/:month', (c) => {
    const userId = uidOf(c);
    const month = zMonth.parse(c.req.param('month'));
    const from = monthStart(`${month}-01`);
    const to = shiftDays(addMonths(from, 1), -1);
    const checks: HabitCheck[] = db
      .select()
      .from(habitChecks)
      .where(and(eq(habitChecks.userId, userId), gte(habitChecks.date, from), lte(habitChecks.date, to)))
      .all()
      .map((x) => ({ habitId: x.habitId, date: x.date, done: x.done, note: x.note }));
    const lifts = db
      .select()
      .from(liftSets)
      .where(and(eq(liftSets.userId, userId), isNull(liftSets.deletedAt), gte(liftSets.date, from), lte(liftSets.date, to)))
      .orderBy(asc(liftSets.createdAt))
      .all()
      .map(toLift);
    const mornings = db
      .select()
      .from(morningDays)
      .where(and(eq(morningDays.userId, userId), gte(morningDays.date, from), lte(morningDays.date, to)))
      .all();
    const entries = db
      .select()
      .from(journalEntries)
      .where(and(eq(journalEntries.userId, userId), isNull(journalEntries.deletedAt), gte(journalEntries.date, from), lte(journalEntries.date, to)))
      .orderBy(asc(journalEntries.date), asc(journalEntries.createdAt))
      .all()
      .map(toEntry);
    const coach = db
      .select()
      .from(coachReads)
      .where(and(eq(coachReads.userId, userId), gte(coachReads.date, from), lte(coachReads.date, to)))
      .all()
      .map((x) => ({ date: x.date, key: x.key, text: x.text, createdAt: x.createdAt }));
    return c.json({
      month,
      sessions: sessionsBetween(db, userId, from, to),
      checks,
      lifts,
      activities: activitiesBetween(db, userId, from, to),
      // one editor (spec §4.3): a morning's own setting is its alarm; the stored mode/type/miles/minutes are fillers nobody reads
      morningDays: Object.fromEntries(mornings.map((m) => [m.date, { wake: m.wake } satisfies MorningDayOverride])),
      journal: entries,
      coach,
    });
  });

  // ---------- sessions ----------
  const sessionOr404 = (userId: string, id: string, { deleted = false } = {}) => {
    const row = db.select().from(trainingSessions).where(and(eq(trainingSessions.userId, userId), eq(trainingSessions.id, id))).get();
    if (!row || (!deleted && row.deletedAt)) throw new ApiError(404, 'Session not found');
    return row;
  };
  const nextPosition = (userId: string, date: string) => (db.select({ m: sql<number>`coalesce(max(${trainingSessions.position}), -1)` }).from(trainingSessions).where(and(eq(trainingSessions.userId, userId), eq(trainingSessions.date, date))).get()?.m ?? -1) + 1;

  r.post('/sessions', async (c) => {
    const userId = uidOf(c);
    const body = await parseBody(c.req.raw, zSessionInput);
    const now = nowISO();
    const id = body.id ?? uid('p');
    const existing = body.id ? db.select().from(trainingSessions).where(and(eq(trainingSessions.userId, userId), eq(trainingSessions.id, id))).get() : undefined;
    const values = {
      kind: body.kind,
      type: body.type ?? null,
      title: body.title || null,
      details: body.details || null,
      miles: body.kind === 'run' && body.miles && body.miles > 0 ? Math.round(body.miles * 10) / 10 : null,
      minutes: body.minutes && body.minutes > 0 ? Math.round(body.minutes) : null,
      updatedAt: now,
    };
    if (existing) {
      const moved = existing.date !== body.date;
      db.update(trainingSessions)
        .set({ ...values, date: body.date, deletedAt: null, position: moved ? nextPosition(userId, body.date) : existing.position })
        .where(eq(trainingSessions.id, id))
        .run();
    } else {
      db.insert(trainingSessions).values({ id, userId, date: body.date, position: nextPosition(userId, body.date), ...values, blockId: null, movedFrom: null, mark: null, createdAt: now }).run();
    }
    return c.json(toSession(sessionOr404(userId, id)), existing ? 200 : 201);
  });

  r.delete('/sessions/:id', (c) => {
    const userId = uidOf(c);
    const row = sessionOr404(userId, c.req.param('id'));
    db.update(trainingSessions).set({ deletedAt: nowISO(), updatedAt: nowISO() }).where(eq(trainingSessions.id, row.id)).run();
    return c.json({ ok: true, session: toSession(row) });
  });

  /** Undo for a delete: the same row comes back with its plan membership and mark intact. */
  r.post('/sessions/:id/restore', (c) => {
    const userId = uidOf(c);
    const row = sessionOr404(userId, c.req.param('id'), { deleted: true });
    if (row.deletedAt) db.update(trainingSessions).set({ deletedAt: null, updatedAt: nowISO() }).where(eq(trainingSessions.id, row.id)).run();
    return c.json(toSession(sessionOr404(userId, row.id)));
  });

  r.post('/sessions/:id/move', async (c) => {
    const userId = uidOf(c);
    const row = sessionOr404(userId, c.req.param('id'));
    const { to } = await parseBody(c.req.raw, zMoveSession);
    if (to === row.date) return c.json(toSession(row));
    const movedFrom = row.movedFrom === to ? null : row.movedFrom ?? row.date;
    db.update(trainingSessions).set({ date: to, movedFrom, position: nextPosition(userId, to), updatedAt: nowISO() }).where(eq(trainingSessions.id, row.id)).run();
    return c.json(toSession(sessionOr404(userId, row.id)));
  });

  r.post('/sessions/:id/mark', async (c) => {
    const userId = uidOf(c);
    const row = sessionOr404(userId, c.req.param('id'));
    const { mark } = await parseBody(c.req.raw, zMarkSession);
    db.update(trainingSessions).set({ mark, updatedAt: nowISO() }).where(eq(trainingSessions.id, row.id)).run();
    return c.json(toSession(sessionOr404(userId, row.id)));
  });

  // ---------- plan blocks ----------
  /**
   * Contract 2. Soft-deletes the block and only its sessions from today on that hold nothing yet; done, floor, sick and
   * skipped sessions and every past day stay (visible, still carrying the block's id). Survives a reload: Undo is
   * `POST /blocks/:id/restore`. Answers `{ ok, removed, kept, months, deletedAt }`.
   */
  r.delete('/blocks/:id', (c) => {
    const out = db.transaction(() => deleteBlock(db, uidOf(c), c.req.param('id'), c.get('today')));
    if (!out) throw new ApiError(404, 'Plan not found');
    return c.json(out);
  });

  /** Undo `DELETE /blocks/:id`: the block and exactly the sessions that delete removed. Answers `{ block, restored, months }`. */
  r.post('/blocks/:id/restore', (c) => {
    const out = db.transaction(() => restoreBlock(db, uidOf(c), c.req.param('id')));
    if (!out) throw new ApiError(404, 'Plan not found');
    return c.json(out);
  });

  // ---------- habits ----------
  const allHabits = (userId: string) => db.select().from(habits).where(eq(habits.userId, userId)).orderBy(asc(habits.position), asc(habits.createdOn)).all().map(toHabit);

  r.get('/habits', (c) => c.json(allHabits(uidOf(c))));

  r.post('/habits', async (c) => {
    const userId = uidOf(c);
    const { name } = await parseBody(c.req.raw, zHabitInput);
    const pos = (db.select({ m: sql<number>`coalesce(max(${habits.position}), -1)` }).from(habits).where(eq(habits.userId, userId)).get()?.m ?? -1) + 1;
    const id = uid('h');
    db.insert(habits).values({ id, userId, name, position: pos, createdOn: c.get('today'), archivedOn: null }).run();
    return c.json(allHabits(userId), 201);
  });

  r.patch('/habits/:id', async (c) => {
    const userId = uidOf(c);
    const body = await parseBody(c.req.raw, z.object({ name: zHabitInput.shape.name.optional(), archived: z.boolean().optional() }));
    const set: Partial<typeof habits.$inferInsert> = {};
    if (body.name) set.name = body.name;
    if (body.archived !== undefined) set.archivedOn = body.archived ? c.get('today') : null;
    const n = db.update(habits).set(set).where(and(eq(habits.userId, userId), eq(habits.id, c.req.param('id')))).run().changes;
    if (!n) throw new ApiError(404, 'Habit not found');
    return c.json(allHabits(userId));
  });

  r.put('/habits/order', async (c) => {
    const userId = uidOf(c);
    const { order } = await parseBody(c.req.raw, zHabitsReorder);
    db.transaction((tx) => {
      order.forEach((id, i) => tx.update(habits).set({ position: i }).where(and(eq(habits.userId, userId), eq(habits.id, id))).run());
    });
    return c.json(allHabits(userId));
  });

  r.put('/habits/:id/days/:date', async (c) => {
    const userId = uidOf(c);
    const habitId = c.req.param('id');
    const date = zDate.parse(c.req.param('date'));
    const body = await parseBody(c.req.raw, zHabitCheck);
    const h = db.select().from(habits).where(and(eq(habits.userId, userId), eq(habits.id, habitId))).get();
    if (!h) throw new ApiError(404, 'Habit not found');
    const cur = db.select().from(habitChecks).where(and(eq(habitChecks.habitId, habitId), eq(habitChecks.date, date))).get();
    const done = body.done ?? cur?.done ?? false;
    const note = body.note === undefined ? cur?.note ?? null : body.note || null;
    db.insert(habitChecks)
      .values({ userId, habitId, date, done, note, updatedAt: nowISO() })
      .onConflictDoUpdate({ target: [habitChecks.habitId, habitChecks.date], set: { done, note, updatedAt: nowISO() } })
      .run();
    const out: HabitCheck = { habitId, date, done, note };
    return c.json(out);
  });

  // ---------- lifts ----------
  r.get('/lifts', (c) => {
    const userId = uidOf(c);
    const q = parseQuery(c.req.query(), z.object({ exercise: z.string().optional() }));
    const where = q.exercise ? and(eq(liftSets.userId, userId), isNull(liftSets.deletedAt), sql`lower(${liftSets.exercise}) = ${q.exercise.toLowerCase()}`) : and(eq(liftSets.userId, userId), isNull(liftSets.deletedAt));
    return c.json(db.select().from(liftSets).where(where).orderBy(asc(liftSets.createdAt)).all().map(toLift));
  });

  r.post('/lifts', async (c) => {
    const userId = uidOf(c);
    const body = await parseBody(c.req.raw, zLiftInput);
    const id = uid('s');
    db.insert(liftSets).values({ id, userId, date: body.date, exercise: body.exercise, weight: body.weight, reps: body.reps, createdAt: nowISO(), deletedAt: null }).run();
    const row = db.select().from(liftSets).where(eq(liftSets.id, id)).get()!;
    return c.json(toLift(row), 201);
  });

  r.delete('/lifts/:id', (c) => {
    const userId = uidOf(c);
    const n = db.update(liftSets).set({ deletedAt: nowISO() }).where(and(eq(liftSets.userId, userId), eq(liftSets.id, c.req.param('id')))).run().changes;
    if (!n) throw new ApiError(404, 'Set not found');
    return c.json({ ok: true });
  });

  // ---------- todos ----------
  const liveTodos = (userId: string, t: string = today()) =>
    db
      .select()
      .from(todos)
      .where(and(eq(todos.userId, userId), sql`(${todos.deletedOn} is null or ${todos.deletedOn} >= ${shiftDays(t, -120)})`))
      .orderBy(asc(todos.position), asc(todos.createdOn), asc(todos.createdAt))
      .all()
      .map(toTodo);

  r.get('/todos', (c) => c.json(liveTodos(uidOf(c), c.get('today'))));

  /** A list id the owner may file a to-do under: his own, not deleted. Anything else is a 404. */
  const groupOf = (userId: string, id: string | null | undefined): string | null => {
    if (!id) return null;
    const g = db.select({ id: todoGroups.id }).from(todoGroups).where(and(eq(todoGroups.userId, userId), eq(todoGroups.id, id), isNull(todoGroups.deletedAt))).get();
    if (!g) throw new ApiError(404, 'List not found');
    return g.id;
  };

  // ---------- to-do lists ----------
  const liveGroups = (userId: string) => db.select().from(todoGroups).where(and(eq(todoGroups.userId, userId), isNull(todoGroups.deletedAt))).orderBy(asc(todoGroups.position), asc(todoGroups.createdAt)).all().map(toTodoGroup);

  r.get('/todo-groups', (c) => c.json(liveGroups(uidOf(c))));

  r.post('/todo-groups', async (c) => {
    const userId = uidOf(c);
    const body = await parseBody(c.req.raw, zTodoGroupInput);
    const id = uid('g');
    const pos = (db.select({ m: sql<number>`coalesce(max(${todoGroups.position}), -1)` }).from(todoGroups).where(eq(todoGroups.userId, userId)).get()?.m ?? -1) + 1;
    db.insert(todoGroups).values({ id, userId, name: body.name, color: body.color, position: pos, createdAt: nowISO(), deletedAt: null }).run();
    return c.json(toTodoGroup(db.select().from(todoGroups).where(eq(todoGroups.id, id)).get()!), 201);
  });

  r.patch('/todo-groups/:id', async (c) => {
    const userId = uidOf(c);
    const body = await parseBody(c.req.raw, zTodoGroupPatch);
    const id = groupOf(userId, c.req.param('id'))!;
    const set: Partial<typeof todoGroups.$inferInsert> = {};
    if (body.name !== undefined) set.name = body.name;
    if (body.color !== undefined) set.color = body.color;
    if (body.position !== undefined) set.position = body.position;
    if (Object.keys(set).length) db.update(todoGroups).set(set).where(eq(todoGroups.id, id)).run();
    return c.json(toTodoGroup(db.select().from(todoGroups).where(eq(todoGroups.id, id)).get()!));
  });

  /** Deleting a list keeps its to-dos: they move to no list. */
  r.delete('/todo-groups/:id', (c) => {
    const userId = uidOf(c);
    const id = groupOf(userId, c.req.param('id'))!;
    db.transaction((tx) => {
      tx.update(todoGroups).set({ deletedAt: nowISO() }).where(eq(todoGroups.id, id)).run();
      tx.update(todos).set({ groupId: null }).where(and(eq(todos.userId, userId), eq(todos.groupId, id))).run();
    });
    return c.json({ ok: true });
  });

  r.post('/todos', async (c) => {
    const userId = uidOf(c);
    const body = await parseBody(c.req.raw, zTodoInput);
    const id = uid('t');
    // new items land at the bottom of their list
    const pos = (db.select({ m: sql<number>`coalesce(max(${todos.position}), -1)` }).from(todos).where(eq(todos.userId, userId)).get()?.m ?? -1) + 1;
    const bucket = body.bucket ?? (body.due && body.due > body.date ? 'later' : 'today');
    // a date only lives on a Later item, and Later always has one: tomorrow unless said otherwise
    const due = bucket === 'later' ? body.due ?? shiftDays(body.date, 1) : null;
    db.insert(todos)
      .values({ id, userId, text: body.text, note: null, priority: body.priority ?? 0, color: body.color ?? null, groupId: groupOf(userId, body.groupId), due, bucket, position: pos, createdOn: body.date, doneOn: null, deletedOn: null, createdAt: nowISO() })
      .run();
    return c.json(toTodo(db.select().from(todos).where(eq(todos.id, id)).get()!), 201);
  });

  /** Manual order after a drag: the ids in their new order take positions 0..n. Ids left out keep theirs. */
  r.put('/todos/order', async (c) => {
    const userId = uidOf(c);
    const { order } = await parseBody(c.req.raw, zTodosReorder);
    db.transaction((tx) => {
      order.forEach((id, i) => tx.update(todos).set({ position: i }).where(and(eq(todos.userId, userId), eq(todos.id, id))).run());
    });
    return c.json(liveTodos(userId, c.get('today')));
  });

  r.patch('/todos/:id', async (c) => {
    const userId = uidOf(c);
    const body = await parseBody(c.req.raw, zTodoPatch);
    const row = db.select().from(todos).where(and(eq(todos.userId, userId), eq(todos.id, c.req.param('id')))).get();
    if (!row) throw new ApiError(404, 'To-do not found');
    const set: Partial<typeof todos.$inferInsert> = {};
    if (body.text !== undefined) set.text = body.text;
    if (body.note !== undefined) set.note = body.note || null;
    if (body.priority !== undefined) set.priority = body.priority;
    if (body.color !== undefined) set.color = body.color;
    if (body.groupId !== undefined) set.groupId = groupOf(userId, body.groupId);
    if (body.bucket !== undefined) set.bucket = body.bucket;
    // a date only lives on a Later item; a row moved to Later without one gets tomorrow; otherwise the date is left alone
    const bucket = body.bucket ?? row.bucket;
    if (bucket !== 'later') set.due = null;
    else if (body.due !== undefined) set.due = body.due ?? shiftDays(c.get('today'), 1);
    else if (row.bucket !== 'later' && !row.due) set.due = shiftDays(c.get('today'), 1);
    if (body.position !== undefined) set.position = body.position;
    if (body.doneOn !== undefined) set.doneOn = body.doneOn;
    if (body.deletedOn !== undefined) set.deletedOn = body.deletedOn;
    db.update(todos).set(set).where(eq(todos.id, row.id)).run();
    return c.json(toTodo(db.select().from(todos).where(eq(todos.id, row.id)).get()!));
  });

  // ---------- morning ----------
  r.get('/morning/settings', (c) => c.json(morningSettingsOf(db, uidOf(c))));

  r.patch('/morning/settings', async (c) => {
    const userId = uidOf(c);
    const patch = await parseBody(c.req.raw, zMorningSettingsPatch);
    const next = normalizeMorningSettings(deepMerge(readSetting(db, userId, 'morning') ?? NEW_ACCOUNT_MORNING, patch));
    writeSetting(db, userId, 'morning', next);
    return c.json(next);
  });

  r.put('/morning/days/:date', async (c) => {
    const userId = uidOf(c);
    const date = zDate.parse(c.req.param('date'));
    // `{ wake }` only: legacy fields an old client sends are stripped by the schema (spec §4.3)
    const { wake } = await parseBody(c.req.raw, zMorningDay);
    // the legacy columns are NOT NULL and stay; a new row gets neutral fillers that nothing reads (the workout is the
    // session's), and a conflict changes the wake alone
    const sessions = sessionsBetween(db, userId, date, date);
    const mode = sessions.length ? morningPlanFor(sessions).mode : 'run';
    db.insert(morningDays)
      .values({ userId, date, wake, mode, type: '', miles: 0, minutes: 0 })
      .onConflictDoUpdate({ target: [morningDays.userId, morningDays.date], set: { wake } })
      .run();
    return c.json({ wake } satisfies MorningDayOverride);
  });

  r.delete('/morning/days/:date', (c) => {
    const userId = uidOf(c);
    const date = zDate.parse(c.req.param('date'));
    db.delete(morningDays).where(and(eq(morningDays.userId, userId), eq(morningDays.date, date))).run();
    return c.json({ ok: true });
  });

  // ---------- recent activities (for trends) ----------
  r.get('/activities', (c) => {
    const userId = uidOf(c);
    const q = parseQuery(c.req.query(), z.object({ from: zDate.optional(), to: zDate.optional() }));
    const to = q.to ?? shiftDays(c.get('today'), 7);
    const from = q.from ?? shiftDays(to, -120);
    return c.json(activitiesBetween(db, userId, from, to));
  });

  void desc;
  return r;
};
