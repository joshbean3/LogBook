import { shiftDays, zLearningInput, zLearningPatch, zLearningQuery, type Learning, type LearningMonth, type LearningPage, type LearningStats } from '@logbook/shared';
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

/**
 * What I learned: one line or a few each day. `GET /learnings` pages newest first; `GET /learnings/stats` counts the days,
 * the streak and the whole; writes are the journal's (soft delete, restore). A new learning's day defaults to the
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
    const out: LearningStats = { days: days.length, streak: streakOf(days, today), total };
    return c.json(out);
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
