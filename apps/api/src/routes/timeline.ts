import { METERS_PER_MILE, type DayTimeline, type TimelineItem } from '@logbook/shared';
import { and, eq, isNull } from 'drizzle-orm';
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
/** A valid IANA zone, or null. */
const zoneOk = (tz: string | undefined): string | null => {
  if (!tz || tz.length > 64) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
};
/**
 * The moment a row was written, only when it was written on the day it belongs to (finding today-body-23): a habit
 * checked on Tuesday for Monday, or a journal entry written later for an earlier day, gets no time. With the person's
 * zone (`?tz=`) the day is exact; without it a time is kept only when that day is possible somewhere on Earth.
 */
export const sameDayAt = (at: string | null, date: string, tz: string | null): string | null => {
  if (!at) return null;
  const ms = Date.parse(at);
  if (!Number.isFinite(ms)) return null;
  if (tz) return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms)) === date ? at : null;
  const earliest = new Date(ms - 12 * 3600_000).toISOString().slice(0, 10);
  const latest = new Date(ms + 14 * 3600_000).toISOString().slice(0, 10);
  return date >= earliest && date <= latest ? at : null;
};
const MARK_WORD: Record<string, string> = { done: 'Done', floor: 'Floor done', skip: 'Skipped', sick: 'Sick day' };

/**
 * GET /day/:date/timeline: what was done on a day, from every source that records a time (habit taps, sessions marked,
 * synced activities, the day's learnings and journal entries). The phone sorts by local time. `?tz=<IANA zone>` lets the
 * server tell exactly whether a row was written on its own day; a row written on another day carries no time.
 */
export const timelineRoutes = (db: DB) => {
  const r = new Hono<AuthEnv>();
  r.get('/day/:date/timeline', (c) => {
    const userId = c.get('user').id;
    const date = c.req.param('date');
    if (!ISO.test(date)) throw new ApiError(400, 'Bad date');
    const tz = zoneOk(c.req.query('tz'));
    const when = (at: string | null) => sameDayAt(at, date, tz);
    const items: TimelineItem[] = [];
    for (const h of db
      .select({ id: habitChecks.habitId, name: habits.name, at: habitChecks.updatedAt })
      .from(habitChecks)
      .innerJoin(habits, eq(habits.id, habitChecks.habitId))
      .where(and(eq(habitChecks.userId, userId), eq(habitChecks.date, date), eq(habitChecks.done, true)))
      .all())
      items.push({ id: `h:${h.id}`, kind: 'habit', title: h.name, sub: 'Habit', at: when(h.at), time: null });
    const effortWord = (e: number | null) => (e ? `Effort ${e}` : null);
    const daySessions = db
      .select()
      .from(trainingSessions)
      .where(and(eq(trainingSessions.userId, userId), eq(trainingSessions.date, date), isNull(trainingSessions.deletedAt)))
      .all();
    for (const s of daySessions.filter((x) => x.mark))
      items.push({ id: `s:${s.id}`, kind: s.kind === 'lift' ? 'lift' : 'run', title: s.title || s.type || (s.kind === 'lift' ? 'Lift' : 'Run'), sub: [MARK_WORD[s.mark!] ?? s.mark, s.miles ? `${s.miles} mi` : null, effortWord(s.effort)].filter(Boolean).join(' · '), at: when(s.updatedAt), time: null });
    // a run that a synced activity completed has no mark (so no line of its own): its effort goes on the activity's line
    let runEffort = daySessions.find((x) => !x.mark && x.kind === 'run' && x.effort)?.effort ?? null;
    for (const a of db.select().from(activities).where(and(eq(activities.userId, userId), eq(activities.date, date), isNull(activities.deletedAt))).all()) {
      const effort = a.kind === 'run' ? runEffort : null;
      if (effort) runEffort = null;
      items.push({ id: `a:${a.id}`, kind: 'activity', title: a.name, sub: [a.distanceM ? `${(a.distanceM / METERS_PER_MILE).toFixed(1)} mi` : null, a.movingSec ? clock(a.movingSec) : null, effortWord(effort)].filter(Boolean).join(' · ') || null, at: a.time ? null : when(a.updatedAt), time: a.time });
    }
    for (const l of db.select().from(learnings).where(and(eq(learnings.userId, userId), eq(learnings.date, date), isNull(learnings.deletedAt))).all())
      items.push({ id: `l:${l.id}`, kind: 'learned', title: clip(l.text), sub: 'Line', at: when(l.createdAt), time: null });
    for (const j of db.select().from(journalEntries).where(and(eq(journalEntries.userId, userId), eq(journalEntries.date, date), isNull(journalEntries.deletedAt))).all())
      items.push({ id: `j:${j.id}`, kind: 'journal', title: clip(j.text), sub: 'Entry', at: when(j.createdAt), time: null });
    const out: DayTimeline = { date, items };
    return c.json(out);
  });
  return r;
};
