/**
 * Miles that count, with or without Strava (fix contract 5). A run marked Done with no activity behind it counts its
 * planned miles; a Floor counts the floor's minutes at an easy pace (capped at the plan); a run with an activity counts
 * the activity. `sessionMiles` is the shared helper's signature: when `@logbook/shared` exports it (Fix A), that one is
 * used, so Today, Plan, Share and Progress all read the same number; until then this module's twin stands in.
 */
import * as Shared from '@logbook/shared';
import { floorMinutes, MORNING_DEFAULTS, sessionStatus, type ISODate, type Session, type Snapshot } from '@logbook/shared';

export type MilesSource = 'activity' | 'planned' | 'floor' | 'none';
export interface SessionMilesResult {
  miles: number;
  source: MilesSource;
}
type SessionMilesFn = (snap: Snapshot, date: ISODate, s: Session) => SessionMilesResult;

const NONE: SessionMilesResult = { miles: 0, source: 'none' };
const r2 = (v: number) => Math.round(v * 100) / 100;
const actMiles = (snap: Snapshot, d: ISODate) =>
  snap
    .activitiesOn(d)
    .filter((a) => a.kind === 'run')
    .reduce((t, a) => t + a.miles, 0);

/** The stand-in, with the contract's rules. Easy pace defaults to the morning default (9:00/mi). */
export const localSessionMiles = (snap: Snapshot, date: ISODate, s: Session, paceSec = MORNING_DEFAULTS.run.pace): SessionMilesResult => {
  if (s.kind !== 'run') return NONE;
  const ran = actMiles(snap, date);
  if (ran > 0) return { miles: r2(ran), source: 'activity' };
  const st = sessionStatus(snap, date, s);
  const planned = Number(s.miles) || 0;
  if (st === 'done') return planned > 0 ? { miles: planned, source: 'planned' } : NONE;
  if (st === 'floor') {
    const min = floorMinutes(s) ?? 20;
    const m = r2((min * 60) / Math.max(240, paceSec));
    return { miles: planned > 0 ? Math.min(planned, m) : m, source: 'floor' };
  }
  return NONE;
};

// the shared export, once Fix A's contract 5 lands (read by name so this builds before and after it does)
const KEY = ['session', 'Miles'].join('');
const fromShared = (Shared as unknown as Record<string, unknown>)[KEY] as SessionMilesFn | undefined;

/** `sessionMiles(snapshot, date, session) → { miles, source }` (contract 5). */
export const sessionMiles: SessionMilesFn = typeof fromShared === 'function' ? fromShared : (snap, date, s) => localSessionMiles(snap, date, s);

export interface DayMiles {
  miles: number;
  /** How many runs the miles came from: activities, or sessions logged by hand. */
  runs: number;
  /** True when no activity backs them (logged, not tracked). */
  logged: boolean;
}

/**
 * A day's run miles: its activities when there are any (never double-counted across two sessions), else every run
 * session marked Done or Floor, at its `sessionMiles`.
 */
export const dayMiles = (snap: Snapshot, d: ISODate): DayMiles => {
  const acts = snap.activitiesOn(d).filter((a) => a.kind === 'run');
  if (acts.length) return { miles: acts.reduce((t, a) => t + a.miles, 0), runs: acts.length, logged: false };
  let miles = 0;
  let runs = 0;
  for (const s of snap.sessionsOn(d)) {
    if (s.kind !== 'run') continue;
    const m = sessionMiles(snap, d, s);
    if (m.miles > 0 && m.source !== 'none') {
      miles += m.miles;
      runs++;
    }
  }
  return { miles, runs, logged: runs > 0 };
};

/** A week's run miles (Monday on), the way `dayMiles` counts them. */
export const weekMiles = (snap: Snapshot, monday: ISODate, upTo?: ISODate) => {
  let miles = 0;
  let runs = 0;
  let logged = 0;
  for (let i = 0; i < 7; i++) {
    const d = Shared.shiftDays(monday, i);
    if (upTo && d > upTo) break;
    const m = dayMiles(snap, d);
    miles += m.miles;
    runs += m.runs;
    if (m.logged) logged += m.miles;
  }
  return { miles: r2(miles), runs, logged: r2(logged) };
};
