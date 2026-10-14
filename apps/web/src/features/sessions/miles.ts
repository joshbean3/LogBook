/**
 * Miles that count, with or without Strava (fix contract 5), as Plan, Share and Progress read them. The rules live in
 * `@logbook/shared` (`sessionMiles`, `dayMiles`): a run marked Done with no activity counts its planned miles, a Floor its
 * floor minutes at the easy pace. This module only adds the counts these pages show ("2 runs", "logged by hand").
 */
import { dayMiles as sharedDayMiles, sessionMiles, shiftDays, type ISODate, type Snapshot } from '@logbook/shared';

export { sessionMiles };

export interface DayRun {
  /** Everything run that day: tracked activities plus logged runs. */
  miles: number;
  /** From run activities. */
  tracked: number;
  /** From runs marked Done or Floor that no activity covers ("logged, not tracked"). */
  logged: number;
  /** How many runs: the run activities plus the logged run sessions. */
  runs: number;
}

/** A day's run miles (shared `dayMiles`) and how many runs they came from. */
export const dayMiles = (snap: Snapshot, d: ISODate): DayRun => {
  const m = sharedDayMiles(snap, d);
  const acts = snap.activitiesOn(d).filter((a) => a.kind === 'run').length;
  let logged = 0;
  for (const s of snap.sessionsOn(d)) {
    if (s.kind !== 'run') continue;
    const sm = sessionMiles(snap, d, s);
    if (sm.source === 'planned' || sm.source === 'floor') logged++;
  }
  return { ...m, runs: acts + logged };
};

/** A week's run miles (Monday on, up to `upTo` when given), the way `dayMiles` counts them. */
export const weekMiles = (snap: Snapshot, monday: ISODate, upTo?: ISODate) => {
  let miles = 0;
  let runs = 0;
  let logged = 0;
  for (let i = 0; i < 7; i++) {
    const d = shiftDays(monday, i);
    if (upTo && d > upTo) break;
    const m = dayMiles(snap, d);
    miles += m.miles;
    runs += m.runs;
    logged += m.logged;
  }
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return { miles: r2(miles), runs, logged: r2(logged) };
};
