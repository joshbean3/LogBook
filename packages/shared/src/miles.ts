import { eachDay, type ISODate } from './dates.js';
import { floorFor } from './sessions.js';
import type { Snapshot } from './status.js';
import type { Activity, Session } from './types.js';

/**
 * Miles without Strava. A run marked Done with no activity to show for it counts its planned miles; a run marked Floor
 * counts the floor's minutes at the athlete's easy pace (never more than was planned). Every "miles run" number in the
 * app (week ring and sheet, close the day, Progress, Share) goes through `sessionMiles` / `dayMiles`, so a consumer who
 * taps Done is never graded with a zero.
 */

/** The easy pace (seconds per mile) when the snapshot does not carry one: 9:00/mi, the Morning default. */
export const DEFAULT_EASY_PACE = 540;
/** A floor with no minutes in its words (the race's "Show up and run it easy") counts as this many minutes. */
export const FLOOR_FALLBACK_MIN = 20;

/** Where a session's miles came from: a tracked activity, the plan (marked Done), the floor (marked Floor), or nothing. */
export type MilesSource = 'activity' | 'planned' | 'floor' | 'none';
export interface SessionMiles {
  miles: number;
  source: MilesSource;
}
export interface DayMiles {
  /** Everything run that day: tracked activities plus logged (marked) runs that have no activity. */
  miles: number;
  /** From run activities (Strava or an import). */
  tracked: number;
  /** From runs marked Done or Floor that no activity covers ("logged, not tracked"). */
  logged: number;
}

/** Skipped by choice or for illness (status.ts has the same rule; kept here so the two modules don't import each other). */
const isSkipMark = (m: Session['mark']) => m === 'skip' || m === 'sick';
const r2 = (v: number) => Math.round(v * 100) / 100;
const paceOf = (snap: Snapshot, pace?: number | null) => {
  const p = pace ?? snap.easyPace;
  return typeof p === 'number' && p >= 240 && p <= 1200 ? p : DEFAULT_EASY_PACE;
};
const floorMin = (s: Session): number => {
  const m = /(\d+)\s*min/.exec(floorFor(s));
  return m ? Number(m[1]) : FLOOR_FALLBACK_MIN;
};

/** The day's run sessions that can carry miles (not skipped), in plan order, and its run activities by start time. */
const runsOn = (snap: Snapshot, date: ISODate) => {
  const sessions = snap
    .sessionsOn(date)
    .filter((s) => s.kind === 'run' && !isSkipMark(s.mark))
    .sort((a, b) => a.position - b.position);
  const acts = snap
    .activitiesOn(date)
    .filter((a) => a.kind === 'run')
    .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
  return { sessions, acts };
};

/** The activities matched to the i-th live run session: one each in order; the last session also takes any extras. */
const matched = (i: number, n: number, acts: Activity[]): Activity[] => (i >= acts.length ? [] : i === n - 1 ? acts.slice(i) : [acts[i]!]);

/**
 * How many miles one session counts for, and why:
 * - `activity`: the run activities matched to it (in order: the first live run of the day takes the first activity, and
 *   the last takes any extras).
 * - `planned`: no activity, marked Done: its planned miles (or its planned minutes at the easy pace).
 * - `floor`: no activity, marked Floor: the floor's minutes (20 easy/quality, 30 long) at the easy pace, capped at the
 *   planned miles.
 * - `none`: anything else (not a run, skipped, nothing recorded yet), 0.
 * The easy pace is `opts.pace`, else `snapshot.easyPace`, else 9:00/mi.
 */
export const sessionMiles = (snap: Snapshot, date: ISODate, session: Session | null | undefined, opts: { pace?: number | null } = {}): SessionMiles => {
  if (!session || session.kind !== 'run' || isSkipMark(session.mark)) return { miles: 0, source: 'none' };
  const { sessions, acts } = runsOn(snap, date);
  const i = sessions.findIndex((s) => s.id === session.id);
  const mine = i >= 0 ? matched(i, sessions.length, acts) : [];
  if (mine.length) return { miles: r2(mine.reduce((t, a) => t + a.miles, 0)), source: 'activity' };
  const pace = paceOf(snap, opts.pace);
  const planned = Number(session.miles) > 0 ? Number(session.miles) : Number(session.minutes) > 0 ? (Number(session.minutes) * 60) / pace : 0;
  if (session.mark === 'done' && planned > 0) return { miles: r2(planned), source: 'planned' };
  if (session.mark === 'floor') {
    const byFloor = (floorMin(session) * 60) / pace;
    const miles = planned > 0 ? Math.min(planned, byFloor) : byFloor;
    if (miles > 0) return { miles: r2(miles), source: 'floor' };
  }
  return { miles: 0, source: 'none' };
};

/** Miles run on a day: every run activity, plus the runs marked Done or Floor that no activity covers. */
export const dayMiles = (snap: Snapshot, date: ISODate, opts: { pace?: number | null } = {}): DayMiles => {
  const { sessions, acts } = runsOn(snap, date);
  const tracked = acts.reduce((t, a) => t + a.miles, 0);
  let logged = 0;
  for (const s of sessions) {
    const m = sessionMiles(snap, date, s, opts);
    if (m.source === 'planned' || m.source === 'floor') logged += m.miles;
  }
  return { miles: r2(tracked + logged), tracked: r2(tracked), logged: r2(logged) };
};

/** Miles run from `from` to `to` (inclusive; one day when `to` is left out), logged runs included. */
export const ranMiles = (snap: Snapshot, from: ISODate, to: ISODate = from, opts: { pace?: number | null } = {}): number =>
  r2(eachDay(from, to).reduce((t, d) => t + dayMiles(snap, d, opts).miles, 0));
