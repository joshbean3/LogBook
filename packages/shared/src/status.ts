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

/** Skipped by choice (`skip`) or for illness (`sick`). Both read Skipped; only `sick` keeps the week. */
export const isSkipMark = (m: Session['mark']): boolean => m === 'skip' || m === 'sick';

export const sessionStatus = (snap: Snapshot, d: ISODate, s: Session): SessionStatus => {
  if (isSkipMark(s.mark)) return 'skipped';
  if (s.kind === 'rest') return 'rest';
  const acts = snap.activitiesOn(d);
  let auto: 'done' | 'floor' | null = null;
  if (s.kind === 'run') {
    const planned = snap
      .sessionsOn(d)
      .filter((x) => x.kind === 'run' && !isSkipMark(x.mark))
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

// ---------- one status vocabulary ----------

/**
 * The eight words the app shows for a status, and their stable keys (for CSS classes and chip colours).
 * Planned: a future session. Today: today's session, not yet done. Done / Floor: kept (full / minimum).
 * Missed: a past session with nothing recorded. Skipped: marked skip (or sick). Rest: a rest session or a day with
 * nothing planned. Bonus: a run or workout that happened with nothing planned for it.
 */
export type StatusKey = 'planned' | 'today' | 'done' | 'floor' | 'missed' | 'skipped' | 'rest' | 'bonus';
export type StatusWord = 'Planned' | 'Today' | 'Done' | 'Floor' | 'Missed' | 'Skipped' | 'Rest' | 'Bonus';

export const STATUS_WORDS: Record<StatusKey, StatusWord> = {
  planned: 'Planned',
  today: 'Today',
  done: 'Done',
  floor: 'Floor',
  missed: 'Missed',
  skipped: 'Skipped',
  rest: 'Rest',
  bonus: 'Bonus',
};

/** Raw status (session or day) to its display key: open is Today, upcoming is Planned, an empty day is Rest. */
export const statusKey = (st: SessionStatus | DayStatus): StatusKey => {
  switch (st) {
    case 'open':
      return 'today';
    case 'upcoming':
      return 'planned';
    case 'empty':
      return 'rest';
    default:
      return st;
  }
};

/**
 * The display key for one session on one day, or for "no session" (`null`): an unplanned run or logged sets on the
 * day read Bonus, otherwise the day is Rest. Every surface that shows a word next to a session's name (the Today
 * hero, a Training/Plan row, the session sheet, the unplanned-run sheet) calls this with the session it shows.
 */
export const sessionKey = (snap: Snapshot, d: ISODate, s: Session | null | undefined): StatusKey => {
  if (s) return statusKey(sessionStatus(snap, d, s));
  return snap.activitiesOn(d).length || snap.liftSetCountOn(d) > 0 ? 'bonus' : 'rest';
};

/** The one word for a session on a day (see `sessionKey`). The hero and every row call this, never `dayStatus`. */
export const sessionWord = (snap: Snapshot, d: ISODate, s: Session | null | undefined): StatusWord => STATUS_WORDS[sessionKey(snap, d, s)];

/**
 * The word for a whole day, for surfaces that show a day rather than a session: a week ring segment, a calendar cell.
 * Never put this under one session's name: a day with a missed run and a done lift is a Floor day, while its run is Missed.
 */
export const dayKey = (snap: Snapshot, d: ISODate): StatusKey => statusKey(dayStatus(snap, d));
export const dayWord = (snap: Snapshot, d: ISODate): StatusWord => STATUS_WORDS[dayKey(snap, d)];

/**
 * The session a day's hero leads with: the first run that is not skipped, else the first other training session
 * that is not skipped, else the first run, else the first session; null on a day with nothing planned.
 */
export const heroSession = (sessions: Session[]): Session | null =>
  sessions.find((s) => s.kind === 'run' && !isSkipMark(s.mark)) ??
  sessions.find((s) => s.kind !== 'rest' && !isSkipMark(s.mark)) ??
  sessions.find((s) => s.kind === 'run') ??
  sessions[0] ??
  null;
