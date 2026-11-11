import { shiftDays, zLearningInput, zLearningPatch, zLearningQuery, type Learning, type LearningMonth, type LearningPage, type LearningStats } from '@logbook/shared';
import { addMonths, daysBetween, type LearningEchoes } from '@logbook/shared';
import { and, desc, eq, isNull, lt, lte, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { AuthEnv } from '../auth.js';
import type { DB } from '../db/index.js';
import { learnings } from '../db/schema.js';
import { ApiError, nowISO, parseBody, parseQuery, uid } from '../lib/util.js';

type Row = typeof learnings.$inferSelect;
const toLearning = (r: Row): Learning => ({ id: r.id, date: r.date, text: r.text, createdAt: r.createdAt, editedAt: r.editedAt });

/** The paging cursor: the last row's day, time and id, so rows that share a day (or a millisecond) never repeat or drop. */
const cursorOf = (r: Row) => `${r.date}|${r.createdAt}|${r.id}`;
const parseCursor = (s: string) => {
  const [date, createdAt, id] = s.split('|');
  if (!date || !createdAt || !id) throw new ApiError(400, 'Bad cursor');
  return { date, createdAt, id };
};

/**
 * Consecutive days with an entry, ending today or yesterday (a day not yet written does not break the streak until it is
 * over). `days` is newest first and distinct.
 */
export const streakOf = (days: string[], today: string): number => {
  let i = 0;
  while (i < days.length && days[i]! > today) i++;
  let want = days[i] === today ? today : shiftDays(today, -1);
  let n = 0;
  for (; i < days.length && days[i] === want; i++, n++) want = shiftDays(want, -1);
  return n;
};

/** The same day of the month `n` months back, clamped to that month's last day: Mar 31 → Feb 28. */
const sameDayMonthsBack = (today: string, n: number) => {
  const first = addMonths(today, -n);
  const last = shiftDays(addMonths(first, 1), -1);
  const want = `${first.slice(0, 8)}${today.slice(8, 10)}`;
  return want > last ? last : want;
};

/** A day-stable pick: the same index all day, a different one tomorrow. */
const seedOf = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** How far a learning may sit from the day it stands for ("a year ago" can be a few days either side). */
export const ECHO_WINDOW = 3;

/**
 * "From your archive" (the Learned tab, under the stats): the learning nearest to a year ago and to a month ago (within
 * three days either side, the earlier one on a tie), and one at random from everything older than a week that is neither,
 * the same one all day. Pure over the rows (any order), so it is tested without a database.
 */
export const echoesOf = (rows: readonly Learning[], today: string): LearningEchoes => {
  const near = (target: string, skip: Set<string>) => {
    let best: Learning | null = null;
    let bestD = Infinity;
    for (const r of rows) {
      if (skip.has(r.id)) continue;
      const d = Math.abs(daysBetween(target, r.date));
      if (d > ECHO_WINDOW) continue;
      if (d < bestD || (d === bestD && best && (r.date < best.date || (r.date === best.date && r.createdAt < best.createdAt)))) {
        best = r;
        bestD = d;
      }
    }
    return best;
  };
  const used = new Set<string>();
  const yearAgo = near(shiftDays(today, -365), used);
  if (yearAgo) used.add(yearAgo.id);
  const monthAgo = near(sameDayMonthsBack(today, 1), used);
  if (monthAgo) used.add(monthAgo.id);
  const weekAgo = shiftDays(today, -7);
  const pool = rows.filter((r) => r.date <= weekAgo && !used.has(r.id)).sort((a, b) => (a.id < b.id ? -1 : 1));
  const random = pool.length ? pool[seedOf(today) % pool.length]! : null;
  return { yearAgo, monthAgo, random };
};

/**
 * What I learned: one line or a few each day. `GET /learnings` pages newest first; `GET /learnings/stats` counts the days,
 * the streak and the whole, and lists which of the last seven days have one; writes are the journal's (soft delete, restore). A new learning's day defaults to the
 * request's local day and is never later than it.
 */
export const learnedRoutes = (db: DB) => {
  const r = new Hono<AuthEnv>();
  const uidOf = (c: { get: (k: 'user') => { id: string } }) => c.get('user').id;
  const live = (userId: string) => and(eq(learnings.userId, userId), isNull(learnings.deletedAt));
  const one = (id: string) => db.select().from(learnings).where(eq(learnings.id, id)).get();

  r.get('/learnings', (c) => {
    const q = parseQuery(c.req.query(), zLearningQuery);
    const conds = [live(uidOf(c))];
    if (q.month) conds.push(sql`substr(${learnings.date}, 1, 7) = ${q.month}`);
    // instr, not LIKE: a % or _ in the words is a character, not a pattern
    if (q.q) conds.push(sql`instr(lower(${learnings.text}), lower(${q.q})) > 0`);
    if (q.before) {
      const k = parseCursor(q.before);
      conds.push(
        or(
          lt(learnings.date, k.date),
          and(eq(learnings.date, k.date), lt(learnings.createdAt, k.createdAt)),
          and(eq(learnings.date, k.date), eq(learnings.createdAt, k.createdAt), lt(learnings.id, k.id)),
        )!,
      );
    }
    const rows = db
      .select()
      .from(learnings)
      .where(and(...conds))
      .orderBy(desc(learnings.date), desc(learnings.createdAt), desc(learnings.id))
      .limit(q.limit + 1)
      .all();
    const page = rows.slice(0, q.limit);
    const out: LearningPage = { learnings: page.map(toLearning), next: rows.length > q.limit ? cursorOf(page[page.length - 1]!) : null };
    return c.json(out);
  });

  /** The archive: every month with something in it, newest first, with its counts and newest words. */
  r.get('/learnings/months', (c) => {
    const userId = uidOf(c);
    const month = sql<string>`substr(${learnings.date}, 1, 7)`;
    const groups = db
      .select({ month, count: sql<number>`count(*)`, days: sql<number>`count(distinct ${learnings.date})` })
      .from(learnings)
      .where(live(userId))
      .groupBy(month)
      .orderBy(desc(month))
      .all();
    const months: LearningMonth[] = groups.map((g) => {
      const top = db
        .select({ text: learnings.text })
        .from(learnings)
        .where(and(live(userId), sql`substr(${learnings.date}, 1, 7) = ${g.month}`))
        .orderBy(desc(learnings.date), desc(learnings.createdAt), desc(learnings.id))
        .limit(1)
        .get();
      return { month: g.month, count: g.count, days: g.days, latest: top?.text ?? '' };
    });
    return c.json({ months });
  });

  r.get('/learnings/stats', (c) => {
    const userId = uidOf(c);
    const today = c.get('today');
    const total = db.select({ n: sql<number>`count(*)` }).from(learnings).where(live(userId)).get()?.n ?? 0;
    const days = db
      .selectDistinct({ date: learnings.date })
      .from(learnings)
      .where(and(live(userId), lte(learnings.date, today)))
      .orderBy(desc(learnings.date))
      .all()
      .map((x) => x.date);
    // the last seven days (six ago to today) that have a learning, oldest first: Learned's bulbs (layout plan C-3)
    const weekAgo = shiftDays(today, -6);
    const recent = days.filter((d) => d >= weekAgo).reverse();
    const out: LearningStats = { days: days.length, streak: streakOf(days, today), total, recent };
    return c.json(out);
  });

  /** From your archive: a year ago, a month ago, and one at random (the rows are small: a line or two a day). */
  r.get('/learnings/echoes', (c) => {
    const rows = db.select().from(learnings).where(and(live(uidOf(c)), lt(learnings.date, c.get('today')))).all().map(toLearning);
    return c.json(echoesOf(rows, c.get('today')));
  });

  r.post('/learnings', async (c) => {
    const userId = uidOf(c);
    const body = await parseBody(c.req.raw, zLearningInput);
    const today = c.get('today');
    const date = body.date ?? today;
    if (date > today) throw new ApiError(422, 'That day has not come yet');
    const id = uid('l_');
    db.insert(learnings).values({ id, userId, date, text: body.text, createdAt: nowISO(), editedAt: null, deletedAt: null }).run();
    return c.json(toLearning(one(id)!), 201);
  });

  r.patch('/learnings/:id', async (c) => {
    const userId = uidOf(c);
    const body = await parseBody(c.req.raw, zLearningPatch);
    const id = c.req.param('id');
    const n = db.update(learnings).set({ text: body.text, editedAt: nowISO() }).where(and(live(userId), eq(learnings.id, id))).run().changes;
    if (!n) throw new ApiError(404, 'Not found');
    return c.json(toLearning(one(id)!));
  });

  r.delete('/learnings/:id', (c) => {
    const userId = uidOf(c);
    const n = db.update(learnings).set({ deletedAt: nowISO() }).where(and(live(userId), eq(learnings.id, c.req.param('id')))).run().changes;
    if (!n) throw new ApiError(404, 'Not found');
    return c.json({ ok: true });
  });

  r.post('/learnings/:id/restore', (c) => {
    const userId = uidOf(c);
    const id = c.req.param('id');
    const n = db.update(learnings).set({ deletedAt: null }).where(and(eq(learnings.userId, userId), eq(learnings.id, id))).run().changes;
    if (!n) throw new ApiError(404, 'Not found');
    return c.json(toLearning(one(id)!));
  });

  return r;
};
