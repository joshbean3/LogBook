import { periodEnd, periodOf, zGoalLevel, zGoalPatch, zGoalPut, zGoalRefine, type GoalEventKind, type GoalLevel } from '@logbook/shared';
import { and, desc, eq, isNull, lt, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../auth.js';
import type { DB } from '../db/index.js';
import { goalEvents, goals } from '../db/schema.js';
import { env } from '../env.js';
import { parseSteps, toGoal, toGoalEvent } from '../lib/map.js';
import { ApiError, nowISO, parseBody, parseQuery, uid } from '../lib/util.js';
import { refineGoal } from '../services/claude.js';

/** A period key that matches its level: `2026`, `2026-10`, a Monday, or a date. */
const validPeriod = (level: GoalLevel, period: string) => {
  const ok = level === 'year' ? /^\d{4}$/.test(period) : level === 'month' ? /^\d{4}-\d{2}$/.test(period) : /^\d{4}-\d{2}-\d{2}$/.test(period) && periodOf(level, period) === period;
  if (!ok) throw new ApiError(400, `That isn’t a ${level}.`, 'bad_period');
  return period;
};

/**
 * Goals: one per level and period, and a log of everything that happens to them (set, sharpened, kept, edited, done,
 * partly, missed, reopened, cleared), so the history can say what was meant and what came of it.
 */
export const goalRoutes = (db: DB) => {
  const r = new Hono<AuthEnv>();
  const uidOf = (c: { get: (k: 'user') => { id: string } }) => c.get('user').id;

  const log = (userId: string, g: { id: string; level: string; period: string }, kind: GoalEventKind, text: string | null, at = nowISO()) =>
    db.insert(goalEvents).values({ id: uid('ge'), userId, goalId: g.id, level: g.level, period: g.period, kind, text, at }).run();

  const rowOf = (userId: string, id: string) => {
    const row = db.select().from(goals).where(and(eq(goals.userId, userId), eq(goals.id, id), isNull(goals.deletedAt))).get();
    if (!row) throw new ApiError(404, 'Goal not found');
    return row;
  };

  /** Every live goal (they are small: four a period). */
  r.get('/goals', (c) => c.json(db.select().from(goals).where(and(eq(goals.userId, uidOf(c)), isNull(goals.deletedAt))).orderBy(desc(goals.period)).all().map(toGoal)));

  /** The log, newest first: `goal` for one goal's story, `before` to page back. */
  r.get('/goals/events', (c) => {
    const userId = uidOf(c);
    const q = parseQuery(c.req.query(), z.object({ goal: z.string().max(64).optional(), before: z.string().max(40).optional(), limit: z.coerce.number().int().min(1).max(500).default(200) }));
    const conds = [eq(goalEvents.userId, userId)];
    if (q.goal) conds.push(eq(goalEvents.goalId, q.goal));
    if (q.before) conds.push(lt(goalEvents.at, q.before));
    const rows = db.select().from(goalEvents).where(and(...conds)).orderBy(desc(goalEvents.at), desc(sql`rowid`)).limit(q.limit + 1).all();
    return c.json({ events: rows.slice(0, q.limit).map(toGoalEvent), more: rows.length > q.limit });
  });

  /** The review: Claude rewrites the goal to the goal-setting rules for its level and deadline. Without a key, the words come back as they are. */
  r.post('/goals/refine', async (c) => {
    const body = await parseBody(c.req.raw, zGoalRefine);
    const period = validPeriod(body.level, body.period);
    if (!env.claudeConfigured) return c.json({ text: body.text, why: null, changed: false, steps: [], available: false });
    const out = await refineGoal(body.level, period, periodEnd(body.level, period), body.text, c.get('today'));
    return c.json({ ...out, available: true });
  });

  /** Set the goal of a period, or replace it. A replaced goal keeps its id, its status resets to open, and the log says how. */
  r.put('/goals/:level/:period', async (c) => {
    const userId = uidOf(c);
    const lv = zGoalLevel.safeParse(c.req.param('level'));
    if (!lv.success) throw new ApiError(400, 'A goal is for a year, a month, a week or a day.', 'bad_level');
    const level = lv.data;
    const period = validPeriod(level, c.req.param('period'));
    const body = await parseBody(c.req.raw, zGoalPut);
    const now = nowISO();
    const original = body.original && body.original !== body.text ? body.original : null;
    const existing = db.select().from(goals).where(and(eq(goals.userId, userId), eq(goals.level, level), eq(goals.period, period))).get();
    let id: string;
    db.transaction(() => {
      if (existing) {
        id = existing.id;
        const revived = !!existing.deletedAt;
        db.update(goals)
          .set({ text: body.text, original, why: body.why ?? null, status: revived ? 'open' : existing.status, reflection: revived ? null : existing.reflection, closedAt: revived ? null : existing.closedAt, updatedAt: now, deletedAt: null, ...(body.steps ? { steps: JSON.stringify(body.steps) } : revived ? { steps: '[]' } : {}) })
          .where(eq(goals.id, id))
          .run();
        if (revived) log(userId, { id, level, period }, 'set', body.text, now);
        else if (existing.text !== body.text) log(userId, { id, level, period }, 'edited', body.text, now);
      } else {
        id = uid('goal');
        db.insert(goals).values({ id, userId, level, period, text: body.text, original, why: body.why ?? null, status: 'open', reflection: null, steps: JSON.stringify(body.steps ?? []), createdAt: now, updatedAt: now, closedAt: null, deletedAt: null }).run();
        log(userId, { id, level, period }, 'set', body.chose === 'kept' && body.original ? body.original : original ?? body.text, now);
      }
      // what the review did, and what the owner chose: the sharpened words, or his own
      if (body.chose === 'sharpened' && original) log(userId, { id: id!, level, period }, 'sharpened', body.text, now);
      if (body.chose === 'kept') log(userId, { id: id!, level, period }, 'kept', body.text, now);
    });
    return c.json(toGoal(db.select().from(goals).where(eq(goals.id, id!)).get()!), existing && !existing.deletedAt ? 200 : 201);
  });

  /** The review: done, partly, missed, or open again; with a line on how it went. */
  r.patch('/goals/:id', async (c) => {
    const userId = uidOf(c);
    const body = await parseBody(c.req.raw, zGoalPatch);
    const row = rowOf(userId, c.req.param('id'));
    const now = nowISO();
    const set: Partial<typeof goals.$inferInsert> = { updatedAt: now };
    if (body.reflection !== undefined) set.reflection = body.reflection || null;
    // a step checked or unchecked is logged by its words; adds, removes and edits just change the list
    const was = new Map(parseSteps(row.steps).map((x) => [x.id, x]));
    const stepLog: Array<[GoalEventKind, string]> = [];
    if (body.steps !== undefined) {
      set.steps = JSON.stringify(body.steps);
      for (const x of body.steps) {
        const before = was.get(x.id);
        if (x.done && !before?.done) stepLog.push(['step', x.text]);
        if (!x.done && before?.done) stepLog.push(['unstep', x.text]);
      }
    }
    if (body.status !== undefined && body.status !== row.status) {
      set.status = body.status;
      set.closedAt = body.status === 'open' ? null : now;
    }
    db.transaction(() => {
      db.update(goals).set(set).where(eq(goals.id, row.id)).run();
      for (const [kind, text] of stepLog) log(userId, row, kind, text, now);
      if (set.status) log(userId, row, set.status === 'open' ? 'reopened' : (set.status as GoalEventKind), set.reflection ?? row.reflection ?? null, now);
    });
    return c.json(toGoal(db.select().from(goals).where(eq(goals.id, row.id)).get()!));
  });

  /** Clear a goal: it leaves the page, and the log keeps that it was set and cleared. */
  r.delete('/goals/:id', (c) => {
    const userId = uidOf(c);
    const row = rowOf(userId, c.req.param('id'));
    db.transaction(() => {
      db.update(goals).set({ deletedAt: nowISO() }).where(eq(goals.id, row.id)).run();
      log(userId, row, 'cleared', row.text);
    });
    return c.json({ ok: true });
  });

  return r;
};

