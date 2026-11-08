import { METERS_PER_MILE, type DayTimeline, type TimelineItem } from '@logbook/shared';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import type { AuthEnv } from '../auth.js';
import type { DB } from '../db/index.js';
import { activities, habitChecks, habits, journalEntries, learnings, trainingSessions } from '../db/schema.js';
import { ApiError } from '../lib/util.js';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const clip = (s: string, n = 90) => {
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length > n ? `${one.slice(0, n - 1).trimEnd()}…` : one;
};
const clock = (sec: number) => {
  const m = Math.floor(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
};
const MARK_WORD: Record<string, string> = { done: 'Done', floor: 'Floor done', skip: 'Skipped', sick: 'Sick day' };

/**
 * GET /day/:date/timeline: what was done on a day, from every source that records a time (habit taps, sessions marked,
 * synced activities, the day's learnings and journal entries). The phone sorts by local time.
 */
export const timelineRoutes = (db: DB) => {
  const r = new Hono<AuthEnv>();
  r.get('/day/:date/timeline', (c) => {
    const userId = c.get('user').id;
    const date = c.req.param('date');
    if (!ISO.test(date)) throw new ApiError(400, 'Bad date');
    const items: TimelineItem[] = [];
    for (const h of db
      .select({ id: habitChecks.habitId, name: habits.name, at: habitChecks.updatedAt })
      .from(habitChecks)
      .innerJoin(habits, eq(habits.id, habitChecks.habitId))
      .where(and(eq(habitChecks.userId, userId), eq(habitChecks.date, date), eq(habitChecks.done, true)))
      .all())
      items.push({ id: `h:${h.id}`, kind: 'habit', title: h.name, sub: 'Habit', at: h.at, time: null });
    for (const s of db
      .select()
      .from(trainingSessions)
      .where(and(eq(trainingSessions.userId, userId), eq(trainingSessions.date, date), isNull(trainingSessions.deletedAt), isNotNull(trainingSessions.mark)))
      .all())
      items.push({ id: `s:${s.id}`, kind: s.kind === 'lift' ? 'lift' : 'run', title: s.title || s.type || (s.kind === 'lift' ? 'Lift' : 'Run'), sub: [MARK_WORD[s.mark!] ?? s.mark, s.miles ? `${s.miles} mi` : null].filter(Boolean).join(' · '), at: s.updatedAt, time: null });
    for (const a of db.select().from(activities).where(and(eq(activities.userId, userId), eq(activities.date, date), isNull(activities.deletedAt))).all())
      items.push({ id: `a:${a.id}`, kind: 'activity', title: a.name, sub: [a.distanceM ? `${(a.distanceM / METERS_PER_MILE).toFixed(1)} mi` : null, a.movingSec ? clock(a.movingSec) : null].filter(Boolean).join(' · ') || null, at: a.time ? null : a.updatedAt, time: a.time });
    for (const l of db.select().from(learnings).where(and(eq(learnings.userId, userId), eq(learnings.date, date), isNull(learnings.deletedAt))).all())
      items.push({ id: `l:${l.id}`, kind: 'learned', title: clip(l.text), sub: 'Learned', at: l.createdAt, time: null });
    for (const j of db.select().from(journalEntries).where(and(eq(journalEntries.userId, userId), eq(journalEntries.date, date), isNull(journalEntries.deletedAt))).all())
      items.push({ id: `j:${j.id}`, kind: 'journal', title: clip(j.text), sub: 'Journal', at: j.createdAt, time: null });
    const out: DayTimeline = { date, items };
    return c.json(out);
  });
  return r;
};
