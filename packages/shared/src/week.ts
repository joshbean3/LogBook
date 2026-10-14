import { mondayOf, shiftDays, type ISODate } from './dates.js';
import { counts, dayStatus, isSkipMark, RUN_FLOOR_RATIO, sessionStatus, STATUS_WORDS, statusKey, weekTotals, type Snapshot, type StatusKey, type StatusWord } from './status.js';
import { dayMiles } from './miles.js';
import type { DayStatus } from './types.js';

/** A week is kept with this many sessions kept (fewer when fewer were planned). */
export const WEEK_KEPT_SESSIONS = 3;
/** ...or with this share of its planned run miles run. */
export const WEEK_KEPT_MILES_RATIO = RUN_FLOOR_RATIO;
/** The window behind "7 of the last 8 weeks". */
export const STREAK_WINDOW_WEEKS = 8;

/** How a day's week-ring segment is drawn. */
export type RingSegment = 'done' | 'floor' | 'missed' | 'rest' | 'future';

export interface WeekDay {
  date: ISODate;
  /** The raw day status from `dayStatus`. */
  status: DayStatus;
  /** Its display key and word (`dayKey` / `dayWord`). */
  key: StatusKey;
  word: StatusWord;
  /** The ring segment: done (incl. bonus) blue, floor amber, missed grey, rest (incl. empty and skipped) dashed, today/future empty. */
  ring: RingSegment;
}

export interface WeekCheck {
  /** Did the week meet the floor rule? */
  kept: boolean;
  /** Sessions that count as kept: done, floor, skipped for illness, plus days with only unplanned training (bonus). */
  keptSessions: number;
  /** How many kept sessions the week needs: min(3, training sessions planned); 3 when nothing was planned. 0 for a week planned as all rest. */
  target: number;
  /** Planned run miles that the miles rule measures against (sick-skipped runs are excused). */
  plannedMiles: number;
  /** Miles run: run activities plus runs marked Done or Floor that no activity covers (`dayMiles`). */
  ranMiles: number;
  /** The part of `ranMiles` that was logged by a mark rather than tracked by an activity ("logged, not tracked"). */
  loggedMiles: number;
}

export interface WeekSummary extends WeekCheck {
  weekStart: ISODate;
  days: WeekDay[];
  /** Planned run miles, skipped runs left out (same as `weekTotals.planned`). */
  plannedMiles: number;
  /** Miles actually run this week, planned or not, logged runs included (same as `ranMiles`). */
  doneMiles: number;
  /** Run sessions planned and not skipped. */
  runsPlanned: number;
  /** Planned runs that are done or at the floor, plus days with an unplanned run. */
  runsDone: number;
}

export interface WeekStreak {
  /** Consecutive kept weeks, ending with this week if it is already kept, else with last week. */
  weeks: number;
  /** For "7 of the last 8 weeks": kept weeks in the window, and the window size (shorter for a new account). */
  ofLast: { kept: number; total: number };
}

const ringOf = (st: DayStatus): RingSegment => {
  switch (st) {
    case 'done':
    case 'bonus':
      return 'done';
    case 'floor':
      return 'floor';
    case 'missed':
      return 'missed';
    case 'open':
    case 'upcoming':
      return 'future';
    default:
      return 'rest';
  }
};

const days7 = (weekStart: ISODate): ISODate[] => Array.from({ length: 7 }, (_, i) => shiftDays(weekStart, i));

/**
 * The floor rule for one week (Monday to Sunday). A week is kept when either
 * - kept sessions >= target, where kept = done + floor + skipped-for-illness training sessions, plus one for each day
 *   that had training but nothing planned (bonus), and target = min(3, training sessions planned) (rest sessions are
 *   kept by definition, so they lower the bar rather than fill it; a week planned as all rest is kept); or
 * - planned run miles > 0 and miles run >= 80% of them (runs skipped for illness are excused from the plan).
 */
export const weekCheck = (snap: Snapshot, weekStart: ISODate): WeekCheck => {
  const start = mondayOf(weekStart);
  let training = 0;
  let hasRest = false;
  let kept = 0;
  let planned = 0;
  let ran = 0;
  let logged = 0;
  for (const d of days7(start)) {
    const all = snap.sessionsOn(d);
    if (all.some((s) => s.kind === 'rest')) hasRest = true;
    let keptToday = 0;
    let trainingToday = 0;
    for (const s of all) {
      if (s.kind === 'rest') continue;
      training++;
      if (!isSkipMark(s.mark)) trainingToday++;
      const st = sessionStatus(snap, d, s);
      if (counts(st) || s.mark === 'sick') keptToday++;
      if (s.kind === 'run' && s.mark !== 'sick') planned += Number(s.miles) || 0;
    }
    if (!trainingToday && (snap.activitiesOn(d).length || snap.liftSetCountOn(d) > 0)) keptToday = Math.max(keptToday, 1);
    kept += keptToday;
    const dm = dayMiles(snap, d);
    ran += dm.miles;
    logged += dm.logged;
  }
  const target = training ? Math.min(WEEK_KEPT_SESSIONS, training) : hasRest ? 0 : WEEK_KEPT_SESSIONS;
  const byMiles = planned > 0 && ran >= planned * WEEK_KEPT_MILES_RATIO - 1e-9;
  return { kept: kept >= target || byMiles, keptSessions: kept, target, plannedMiles: Math.round(planned * 100) / 100, ranMiles: Math.round(ran * 100) / 100, loggedMiles: Math.round(logged * 100) / 100 };
};

/** Everything the 7-segment week ring and the week sheet show for the week starting `weekStart` (any day of it works). */
export const weekSummary = (snap: Snapshot, weekStart: ISODate): WeekSummary => {
  const start = mondayOf(weekStart);
  const check = weekCheck(snap, start);
  const tot = weekTotals(snap, start);
  let runsPlanned = 0;
  let runsDone = 0;
  const days = days7(start).map((d): WeekDay => {
    const runs = snap.sessionsOn(d).filter((s) => s.kind === 'run');
    const live = runs.filter((s) => !isSkipMark(s.mark));
    runsPlanned += live.length;
    runsDone += live.filter((s) => counts(sessionStatus(snap, d, s))).length;
    if (!live.length && snap.activitiesOn(d).some((a) => a.kind === 'run')) runsDone++;
    const status = dayStatus(snap, d);
    const key = statusKey(status);
    return { date: d, status, key, word: STATUS_WORDS[key], ring: ringOf(status) };
  });
  return {
    ...check,
    weekStart: start,
    days,
    plannedMiles: Math.round(tot.planned * 100) / 100,
    doneMiles: Math.round(tot.ran * 100) / 100,
    runsPlanned,
    runsDone,
  };
};

/**
 * Streak in weeks. Counts back from the current week (only once it has met the rule; an unfinished week never breaks
 * the streak) through consecutive kept weeks. `ofLast` looks at the 8 weeks ending at the same week, trimmed to start
 * at the first week with anything in it (a session or an activity), so a new account reads "2 of the last 2 weeks".
 */
export const weekStreak = (snap: Snapshot, today: ISODate = snap.today, limit = 260): WeekStreak => {
  const thisWeek = mondayOf(today);
  const end = weekCheck(snap, thisWeek).kept ? thisWeek : shiftDays(thisWeek, -7);
  let weeks = 0;
  for (let w = end, i = 0; i < limit && weekCheck(snap, w).kept; w = shiftDays(w, -7), i++) weeks++;
  const window = Array.from({ length: STREAK_WINDOW_WEEKS }, (_, i) => shiftDays(end, -7 * (STREAK_WINDOW_WEEKS - 1 - i)));
  const hasData = (w: ISODate) => days7(w).some((d) => snap.sessionsOn(d).length > 0 || snap.activitiesOn(d).length > 0 || snap.liftSetCountOn(d) > 0);
  const first = window.findIndex(hasData);
  const live = first < 0 ? [] : window.slice(first);
  return { weeks, ofLast: { kept: live.filter((w) => weekCheck(snap, w).kept).length, total: live.length } };
};
