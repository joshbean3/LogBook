import { counts, monthsBetween, sessionStatus, shiftDays, type EndedBlockRef, type ISODate, type PlanBlock, type Snapshot, type Template } from '@logbook/shared';
import { and, eq, gte, inArray, isNotNull, isNull, lte, sql } from 'drizzle-orm';
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

const chunks = <T>(xs: T[], n = 500): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

/** Soft-delete these sessions (one timestamp for all, so a block restore can find exactly them). Returns how many. */
const softDelete = (db: DB, userId: string, ids: string[], at = nowISO()): number => {
  let n = 0;
  for (const part of chunks(ids)) n += db.update(trainingSessions).set({ deletedAt: at, updatedAt: at }).where(and(eq(trainingSessions.userId, userId), inArray(trainingSessions.id, part), isNull(trainingSessions.deletedAt))).run().changes;
  return n;
};

/**
 * The planned-but-not-kept sessions in [from, to], from `today` on: everything whose status is not Done or Floor (a tap,
 * a Strava run or logged sets all keep a session). Past days are never touched. Optionally only one block's.
 */
export const plannedIds = (db: DB, userId: string, from: ISODate, to: ISODate, today: ISODate, blockId?: string): string[] => {
  const lo = from > today ? from : today;
  if (lo > to) return [];
  const snap = snapshotFor(db, userId, lo, to, today);
  const ids: string[] = [];
  for (const s of sessionsBetween(db, userId, lo, to)) {
    if (blockId && s.blockId !== blockId) continue;
    if (!counts(sessionStatus(snap, s.date, s))) ids.push(s.id);
  }
  return ids;
};

/** Soft-delete the planned-but-not-kept sessions in [from, to] from `today` on (see `plannedIds`). Returns their ids. */
export const removePlanned = (db: DB, userId: string, from: ISODate, to: ISODate, today: ISODate, blockId?: string, at = nowISO()): string[] => {
  const ids = plannedIds(db, userId, from, to, today, blockId);
  softDelete(db, userId, ids, at);
  return ids;
};

/** The live (not deleted) blocks of a user. */
export const liveBlocks = (db: DB, userId: string) => db.select().from(planBlocks).where(and(eq(planBlocks.userId, userId), isNull(planBlocks.deletedAt))).all();

export interface AppliedPlan {
  block: PlanBlock;
  months: string[];
  /** Sessions removed first (`replace`): `replacedIds.length`. */
  removed: number;
  /** The planned, not-done sessions `replace` soft-deleted, for Undo. */
  replacedIds: string[];
  /** The first block `replace` ended or deleted (contract 1). */
  endedBlock?: EndedBlockRef;
  /** Every block `replace` ended or deleted. */
  endedBlocks: EndedBlockRef[];
}

/**
 * Write a template into the calendar as a new plan block: the block row, then one session per template session,
 * positioned after whatever already sits on that day. Not wrapped in a transaction: call it inside one.
 *
 * With `replace` (contract 1), first:
 * - soft-delete the planned, not-done sessions in the new block's window from today on (`replacedIds`);
 * - every live block that overlaps the window is ended the day before the new block starts (`{ id, prevEnd }`), or, if it
 *   had not started by then, soft-deleted (`{ id, deleted: true }`); its planned, not-done sessions after that day go too
 *   (also in `replacedIds`), so nothing of it is left floating past its end. Done, floor and skipped history stays.
 * `POST /plans/template/undo` puts all of it back (`undoTemplate`).
 */
export const writeTemplate = (db: DB, userId: string, t: Template, opts: { replace?: boolean; source: string; today: ISODate }): AppliedPlan => {
  const at = nowISO();
  const replacedIds: string[] = [];
  const endedBlocks: EndedBlockRef[] = [];
  if (opts.replace) {
    replacedIds.push(...removePlanned(db, userId, t.start, t.end, opts.today, undefined, at));
    const dayBefore = shiftDays(t.start, -1);
    for (const b of liveBlocks(db, userId)) {
      if (b.start > t.end || b.end < t.start) continue;
      // what is left of it after the new block starts goes (unless kept), wherever it falls
      const rest = plannedIds(db, userId, t.start, b.end, opts.today, b.id).filter((id) => !replacedIds.includes(id));
      softDelete(db, userId, rest, at);
      replacedIds.push(...rest);
      if (b.start <= dayBefore) {
        db.update(planBlocks).set({ end: dayBefore }).where(eq(planBlocks.id, b.id)).run();
        endedBlocks.push({ id: b.id, prevEnd: b.end });
      } else {
        db.update(planBlocks).set({ deletedAt: at }).where(eq(planBlocks.id, b.id)).run();
        endedBlocks.push({ id: b.id, deleted: true });
      }
    }
  }
  const now = nowISO();
  const blockId = uid('b');
  const pos = new Map<string, number>();
  for (const s of db
    .select({ date: trainingSessions.date, position: trainingSessions.position })
    .from(trainingSessions)
    .where(and(eq(trainingSessions.userId, userId), isNull(trainingSessions.deletedAt), gte(trainingSessions.date, t.start), lte(trainingSessions.date, t.end)))
    .all())
    pos.set(s.date, Math.max(pos.get(s.date) ?? 0, s.position + 1));
  db.insert(planBlocks).values({ id: blockId, userId, name: t.name, start: t.start, end: t.end, source: opts.source, summary: t.summary || null, createdAt: now }).run();
  for (const s of t.sessions) {
    const p = pos.get(s.date) ?? 0;
    pos.set(s.date, p + 1);
    db.insert(trainingSessions)
      .values({ id: uid('p'), userId, date: s.date, position: p, kind: s.kind, type: s.type, title: s.title, details: s.details, miles: s.miles, minutes: s.minutes, blockId, movedFrom: null, mark: null, createdAt: now, updatedAt: now })
      .run();
  }
  const block = db.select().from(planBlocks).where(eq(planBlocks.id, blockId)).get()!;
  return {
    block: toBlock(block, t.sessions.length),
    months: monthsBetween(t.start, t.end),
    removed: replacedIds.length,
    replacedIds,
    ...(endedBlocks[0] ? { endedBlock: endedBlocks[0] } : {}),
    endedBlocks,
  };
};

/** The months a set of session rows touches. */
const monthsOfRows = (rows: Array<{ date: string }>): string[] => [...new Set(rows.map((r) => r.date.slice(0, 7)))].sort();

/**
 * Undo `POST /plans/template` (contract 1): the new block and its sessions go (hard delete: they never existed), the
 * replaced sessions come back, and every block it ended gets its old end back (or is undeleted). Only this user's rows are
 * touched. Returns the months to refetch. Not wrapped in a transaction: call it inside one.
 */
export const undoTemplate = (db: DB, userId: string, input: { blockId: string; replacedIds: string[]; endedBlocks: EndedBlockRef[] }) => {
  const nb = db.select().from(planBlocks).where(and(eq(planBlocks.userId, userId), eq(planBlocks.id, input.blockId))).get();
  const own = db.select({ date: trainingSessions.date }).from(trainingSessions).where(and(eq(trainingSessions.userId, userId), eq(trainingSessions.blockId, input.blockId))).all();
  let removed = 0;
  if (nb) {
    removed = db.delete(trainingSessions).where(and(eq(trainingSessions.userId, userId), eq(trainingSessions.blockId, input.blockId))).run().changes;
    db.delete(planBlocks).where(eq(planBlocks.id, nb.id)).run();
  }
  const back: Array<{ date: string }> = [];
  for (const part of chunks(input.replacedIds)) {
    const where = and(eq(trainingSessions.userId, userId), inArray(trainingSessions.id, part), isNotNull(trainingSessions.deletedAt));
    back.push(...db.select({ date: trainingSessions.date }).from(trainingSessions).where(where).all());
    db.update(trainingSessions).set({ deletedAt: null, updatedAt: nowISO() }).where(where).run();
  }
  const blocks: string[] = [];
  for (const e of input.endedBlocks) {
    const b = db.select().from(planBlocks).where(and(eq(planBlocks.userId, userId), eq(planBlocks.id, e.id))).get();
    if (!b) continue;
    if ('prevEnd' in e) db.update(planBlocks).set({ end: e.prevEnd }).where(eq(planBlocks.id, b.id)).run();
    else db.update(planBlocks).set({ deletedAt: null }).where(eq(planBlocks.id, b.id)).run();
    blocks.push(b.id);
  }
  return { ok: true as const, removed, restored: back.length, blocks, months: monthsOfRows([...own, ...back]) };
};

/**
 * `DELETE /blocks/:id` (contract 2): the block is soft-deleted, and so are its sessions from `today` on that hold nothing
 * yet (no mark, not kept by evidence). Its history stays visible: done, floor, sick and skipped sessions and every past
 * day keep their rows (and their `blockId`). Every row it touches carries the same `deletedAt`, so `restoreBlock` brings
 * back exactly those. Returns null when there is no such live block.
 */
export const deleteBlock = (db: DB, userId: string, blockId: string, today: ISODate) => {
  const b = db.select().from(planBlocks).where(and(eq(planBlocks.userId, userId), eq(planBlocks.id, blockId), isNull(planBlocks.deletedAt))).get();
  if (!b) return null;
  const at = nowISO();
  const lo = b.start > today ? b.start : today;
  const rows = db
    .select()
    .from(trainingSessions)
    .where(and(eq(trainingSessions.userId, userId), eq(trainingSessions.blockId, blockId), isNull(trainingSessions.deletedAt), gte(trainingSessions.date, lo)))
    .all();
  const snap = rows.length ? snapshotFor(db, userId, lo, rows.reduce((m, r) => (r.date > m ? r.date : m), lo), today) : null;
  // a mark of any kind (done, floor, skip, sick) is history; so is a session that evidence already kept (a Strava run)
  const keptByEvidence = (r: (typeof rows)[number]) => {
    const s = snap?.sessionsOn(r.date).find((x) => x.id === r.id);
    return !!(snap && s && counts(sessionStatus(snap, r.date, s)));
  };
  const gone = rows.filter((r) => !r.mark && !keptByEvidence(r));
  softDelete(db, userId, gone.map((r) => r.id), at);
  db.update(planBlocks).set({ deletedAt: at }).where(eq(planBlocks.id, b.id)).run();
  const kept = db.select({ n: sql<number>`count(*)` }).from(trainingSessions).where(and(eq(trainingSessions.userId, userId), eq(trainingSessions.blockId, blockId), isNull(trainingSessions.deletedAt))).get()?.n ?? 0;
  return { ok: true as const, removed: gone.length, kept, months: monthsOfRows(gone), deletedAt: at };
};

/** `POST /blocks/:id/restore`: undo `deleteBlock`, the block and exactly the sessions it removed. Null when there is no such block. */
export const restoreBlock = (db: DB, userId: string, blockId: string) => {
  const b = db.select().from(planBlocks).where(and(eq(planBlocks.userId, userId), eq(planBlocks.id, blockId))).get();
  if (!b) return null;
  let rows: Array<{ date: string }> = [];
  if (b.deletedAt) {
    const where = and(eq(trainingSessions.userId, userId), eq(trainingSessions.blockId, blockId), eq(trainingSessions.deletedAt, b.deletedAt));
    rows = db.select({ date: trainingSessions.date }).from(trainingSessions).where(where).all();
    db.update(trainingSessions).set({ deletedAt: null, updatedAt: nowISO() }).where(where).run();
    db.update(planBlocks).set({ deletedAt: null }).where(eq(planBlocks.id, b.id)).run();
  }
  const n = db.select({ n: sql<number>`count(*)` }).from(trainingSessions).where(and(eq(trainingSessions.userId, userId), eq(trainingSessions.blockId, blockId), isNull(trainingSessions.deletedAt))).get()?.n ?? 0;
  const block = db.select().from(planBlocks).where(eq(planBlocks.id, b.id)).get()!;
  return { block: toBlock(block, n), restored: rows.length, months: monthsBetween(block.start, block.end) };
};

/**
 * Drop a plan block written earlier: its future planned (not kept) sessions go, kept or past ones stay as plain
 * sessions (block cleared), and the block row goes. For re-running onboarding without duplicating anything.
 */
export const retireBlock = (db: DB, userId: string, blockId: string, today: ISODate): number => {
  const b = db.select().from(planBlocks).where(and(eq(planBlocks.userId, userId), eq(planBlocks.id, blockId))).get();
  if (!b) return 0;
  // a re-run of onboarding has no Undo: its planned sessions go for good, as they always did
  const ids = plannedIds(db, userId, b.start, b.end, today, blockId);
  let removed = 0;
  for (const part of chunks(ids)) removed += db.delete(trainingSessions).where(and(eq(trainingSessions.userId, userId), inArray(trainingSessions.id, part))).run().changes;
  db.update(trainingSessions).set({ blockId: null }).where(and(eq(trainingSessions.userId, userId), eq(trainingSessions.blockId, blockId), isNull(trainingSessions.deletedAt))).run();
  db.delete(planBlocks).where(eq(planBlocks.id, blockId)).run();
  return removed;
};
