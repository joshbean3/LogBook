import { shiftDays, type ISODate } from './dates.js';
import type { Activity, DayStatus, Session, SessionStatus } from './types.js';

/**
 * Everything the status rules need to know about the world. The client and the server
 * both provide one of these from their own caches, so the two agree on every grade.
 */
export interface Snapshot {
  today: ISODate;
  sessionsOn(date: ISODate): Session[];
  activitiesOn(date: ISODate): Activity[];
  liftSetCountOn(date: ISODate): number;
}

export const counts = (st: SessionStatus | DayStatus): boolean => st === 'done' || st === 'floor';

/** Ran at least 80% of the day's planned run miles: full. Less than that but something: floor. */
export const RUN_FLOOR_RATIO = 0.8;

export const sessionStatus = (snap: Snapshot, d: ISODate, s: Session): SessionStatus => {
  if (s.mark === 'skip') return 'skipped';
  if (s.kind === 'rest') return 'rest';
  const acts = snap.activitiesOn(d);
  let auto: 'done' | 'floor' | null = null;
  if (s.kind === 'run') {
    const planned = snap
      .sessionsOn(d)
      .filter((x) => x.kind === 'run' && x.mark !== 'skip')
      .reduce((t, x) => t + (Number(x.miles) || 0), 0);
    const ran = acts.filter((a) => a.kind === 'run').reduce((t, a) => t + a.miles, 0);
    if (ran > 0) auto = planned > 0 && ran < planned * RUN_FLOOR_RATIO ? 'floor' : 'done';
  } else if (s.kind === 'lift') {
    if (snap.liftSetCountOn(d) > 0 || acts.some((a) => a.kind === 'lift')) auto = 'done';
  } else if (s.kind === 'cross') {
    if (acts.some((a) => a.kind === 'cross' || a.kind === 'lift')) auto = 'done';
  }
  if (auto === 'done' || s.mark === 'done') return 'done';
  if (auto === 'floor' || s.mark === 'floor') return 'floor';
  if (d < snap.today) return 'missed';
  return d === snap.today ? 'open' : 'upcoming';
};

/** Was the status produced by evidence (Strava, logged sets) rather than a tap? */
export const isAutoStatus = (snap: Snapshot, d: ISODate, s: Session): boolean => {
  const st = sessionStatus(snap, d, s);
  return (st === 'done' || st === 'floor') && s.mark !== st;
};

/** The day in one word. */
export const dayStatus = (snap: Snapshot, d: ISODate): DayStatus => {
  const all = snap.sessionsOn(d);
  const list = all.map((s) => sessionStatus(snap, d, s)).filter((st) => st !== 'rest' && st !== 'skipped');
  if (!list.length) {
    if (snap.activitiesOn(d).length || snap.liftSetCountOn(d) > 0) return 'bonus';
    if (!all.length) return 'empty';
    return all.some((s) => s.kind === 'rest') ? 'rest' : 'skipped';
  }
  if (list.every((st) => st === 'done')) return 'done';
  if (list.every(counts)) return 'floor';
  if (list.some((st) => st === 'missed')) return list.some(counts) ? 'floor' : 'missed';
  if (list.some((st) => st === 'open')) return 'open';
  return 'upcoming';
};

/** Consecutive training days hit, skipping rest/empty days. Today counts once it is done. */
export const trainingStreak = (snap: Snapshot, limit = 180): number => {
  let d = snap.today;
  if (!['done', 'floor', 'bonus'].includes(dayStatus(snap, d))) d = shiftDays(d, -1);
  let n = 0;
  for (let i = 0; i < limit; i++, d = shiftDays(d, -1)) {
    const st = dayStatus(snap, d);
    if (st === 'rest' || st === 'skipped' || st === 'empty' || st === 'bonus') continue;
    if (st === 'done' || st === 'floor') n++;
    else break;
  }
  return n;
};

export interface WeekTotals {
  planned: number;
  ran: number;
  sessions: number;
  hit: number;
}

export const weekTotals = (snap: Snapshot, monday: ISODate): WeekTotals => {
  const t: WeekTotals = { planned: 0, ran: 0, sessions: 0, hit: 0 };
  for (let i = 0; i < 7; i++) {
    const d = shiftDays(monday, i);
    for (const s of snap.sessionsOn(d)) {
      const st = sessionStatus(snap, d, s);
      if (s.kind === 'run' && st !== 'skipped') t.planned += Number(s.miles) || 0;
      if (st === 'rest' || st === 'skipped') continue;
      t.sessions++;
      if (counts(st)) t.hit++;
    }
    t.ran += snap.activitiesOn(d).filter((a) => a.kind === 'run').reduce((x, a) => x + a.miles, 0);
  }
  return t;
};

export const habitStreak = (isDone: (date: ISODate) => boolean, todayDate: ISODate, limit = 400): number => {
  let d = todayDate;
  if (!isDone(d)) d = shiftDays(d, -1);
  let n = 0;
  while (isDone(d) && n < limit) {
    n++;
    d = shiftDays(d, -1);
  }
  return n;
};
