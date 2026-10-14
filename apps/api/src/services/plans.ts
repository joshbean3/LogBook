import { counts, monthsBetween, sessionStatus, type ISODate, type PlanBlock, type Snapshot, type Template } from '@logbook/shared';
import { and, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import type { DB } from '../db/index.js';
import { liftSets, planBlocks, trainingSessions } from '../db/schema.js';
import { toBlock } from '../lib/map.js';
import { nowISO, uid } from '../lib/util.js';
import { activitiesBetween, sessionsBetween } from '../routes/core.js';

/** A status snapshot for one user over a date range, read from the database (the server's twin of the web's log cache). */
export const snapshotFor = (db: DB, userId: string, from: ISODate, to: ISODate, today: ISODate): Snapshot => {
  const sessions = sessionsBetween(db, userId, from, to);
  const acts = activitiesBetween(db, userId, from, to);
  const sets = db
    .select({ date: liftSets.date, n: sql<number>`count(*)` })
    .from(liftSets)
    .where(and(eq(liftSets.userId, userId), isNull(liftSets.deletedAt), gte(liftSets.date, from), lte(liftSets.date, to)))
    .groupBy(liftSets.date)
    .all();
  const setsOn = new Map(sets.map((x) => [x.date, x.n]));
  return {
    today,
    sessionsOn: (d) => sessions.filter((s) => s.date === d),
    activitiesOn: (d) => acts.filter((a) => a.date === d),
    liftSetCountOn: (d) => setsOn.get(d) ?? 0,
  };
};

/**
 * Remove the planned-but-not-kept sessions in [from, to], from `today` on: everything whose status is not Done or
 * Floor (a tap, a Strava run or logged sets all keep a session). Past days are never touched. Optionally only one block's.
 * Hard delete, like `POST /plans/apply` with `replace`. Returns how many went.
 */
export const removePlanned = (db: DB, userId: string, from: ISODate, to: ISODate, today: ISODate, blockId?: string): number => {
  const lo = from > today ? from : today;
  if (lo > to) return 0;
  const snap = snapshotFor(db, userId, lo, to, today);
  const ids: string[] = [];
  for (const s of sessionsBetween(db, userId, lo, to)) {
    if (blockId && s.blockId !== blockId) continue;
    if (!counts(sessionStatus(snap, s.date, s))) ids.push(s.id);
  }
  if (!ids.length) return 0;
  let n = 0;
  for (let i = 0; i < ids.length; i += 500) n += db.delete(trainingSessions).where(and(eq(trainingSessions.userId, userId), inArray(trainingSessions.id, ids.slice(i, i + 500)))).run().changes;
  return n;
};

export interface AppliedPlan {
  block: PlanBlock;
  months: string[];
  /** Sessions removed first (`replace`). */
  removed: number;
}

/**
 * Write a template into the calendar as a new plan block: the block row, then one session per template session,
 * positioned after whatever already sits on that day. With `replace`, clears future planned (not done) sessions in the
 * block's window first. Not wrapped in a transaction: call it inside one.
 */
export const writeTemplate = (db: DB, userId: string, t: Template, opts: { replace?: boolean; source: string; today: ISODate }): AppliedPlan => {
  const removed = opts.replace ? removePlanned(db, userId, t.start, t.end, opts.today) : 0;
  const now = nowISO();
  const blockId = uid('b');
  const pos = new Map<string, number>();
  for (const s of db
    .select({ date: trainingSessions.date, position: trainingSessions.position })
    .from(trainingSessions)
    .where(and(eq(trainingSessions.userId, userId), gte(trainingSessions.date, t.start), lte(trainingSessions.date, t.end)))
    .all())
    pos.set(s.date, Math.max(pos.get(s.date) ?? 0, s.position + 1));
  db.insert(planBlocks).values({ id: blockId, userId, name: t.name, start: t.start, end: t.end, source: opts.source, summary: t.summary, createdAt: now }).run();
  for (const s of t.sessions) {
    const p = pos.get(s.date) ?? 0;
    pos.set(s.date, p + 1);
    db.insert(trainingSessions)
      .values({ id: uid('p'), userId, date: s.date, position: p, kind: s.kind, type: s.type, title: s.title, details: s.details, miles: s.miles, minutes: s.minutes, blockId, movedFrom: null, mark: null, createdAt: now, updatedAt: now })
      .run();
  }
  const block = db.select().from(planBlocks).where(eq(planBlocks.id, blockId)).get()!;
  return { block: toBlock(block, t.sessions.length), months: monthsBetween(t.start, t.end), removed };
};

/**
 * Drop a plan block written earlier: its future planned (not kept) sessions go, kept or past ones stay as plain
 * sessions (block cleared), and the block row goes. For re-running onboarding without duplicating anything.
 */
export const retireBlock = (db: DB, userId: string, blockId: string, today: ISODate): number => {
  const b = db.select().from(planBlocks).where(and(eq(planBlocks.userId, userId), eq(planBlocks.id, blockId))).get();
  if (!b) return 0;
  const removed = removePlanned(db, userId, b.start, b.end, today, blockId);
  db.update(trainingSessions).set({ blockId: null }).where(and(eq(trainingSessions.userId, userId), eq(trainingSessions.blockId, blockId))).run();
  db.delete(planBlocks).where(eq(planBlocks.id, blockId)).run();
  return removed;
};
