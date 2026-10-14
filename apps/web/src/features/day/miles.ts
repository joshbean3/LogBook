import { floorMinutes, mondayOf, shiftDays, type ISODate, type Session, type Snapshot } from '@logbook/shared';

/*
 * Contract 5 (fix round, built by Fix A in packages/shared): `sessionMiles(snapshot, date, session)` counts a run marked
 * Done with no matched activity as its planned miles, and a Floor as the floor minutes at an easy pace, capped at the plan.
 * Until it lands in @logbook/shared this is a local adapter with the documented signature and the same rules. When it
 * lands, replace this block with `export { sessionMiles, type MilesSource } from '@logbook/shared';` and nothing else
 * in features/day changes.
 */
export type MilesSource = 'activity' | 'planned' | 'floor' | 'none';
/** Easy pace for a floor's minutes, seconds a mile (the adapter has no profile to read; the shared helper uses the user's). */
const EASY_PACE = 600;

export const sessionMiles = (snap: Snapshot, date: ISODate, s: Session): { miles: number; source: MilesSource } => {
  if (s.kind !== 'run' || s.mark === 'skip' || s.mark === 'sick') return { miles: 0, source: 'none' };
  const ran = snap
    .activitiesOn(date)
    .filter((a) => a.kind === 'run')
    .reduce((t, a) => t + a.miles, 0);
  if (ran > 0) {
    // two run sessions on a day share the day's runs in proportion to their plans
    const runs = snap.sessionsOn(date).filter((x) => x.kind === 'run' && x.mark !== 'skip' && x.mark !== 'sick');
    const plan = runs.reduce((t, x) => t + (Number(x.miles) || 0), 0);
    const share = runs.length > 1 && plan > 0 ? (Number(s.miles) || 0) / plan : 1;
    return { miles: Math.round(ran * share * 100) / 100, source: 'activity' };
  }
  const planned = Number(s.miles) || 0;
  if (s.mark === 'done') return planned > 0 ? { miles: planned, source: 'planned' } : { miles: 0, source: 'none' };
  if (s.mark === 'floor') {
    const min = floorMinutes(s) ?? 20;
    const m = Math.round(((min * 60) / EASY_PACE) * 10) / 10;
    return { miles: planned > 0 ? Math.min(planned, m) : m, source: 'floor' };
  }
  return { miles: 0, source: 'none' };
};

/** A day's miles: every run session's miles (logged or tracked), plus runs nothing was planned for. */
export const dayMiles = (snap: Snapshot, date: ISODate): number => {
  const runs = snap.sessionsOn(date).filter((s) => s.kind === 'run');
  const fromSessions = runs.reduce((t, s) => t + sessionMiles(snap, date, s).miles, 0);
  if (runs.length) {
    // a run on a day whose run sessions were all skipped still counts
    return fromSessions > 0 ? fromSessions : snap.activitiesOn(date).filter((a) => a.kind === 'run').reduce((t, a) => t + a.miles, 0);
  }
  return snap.activitiesOn(date).filter((a) => a.kind === 'run').reduce((t, a) => t + a.miles, 0);
};

/** The seven days of a week (Monday first) with their miles, for the share card's week strip. */
export const weekMiles = (snap: Snapshot, date: ISODate) => {
  const monday = mondayOf(date);
  return Array.from({ length: 7 }, (_, i) => {
    const d = shiftDays(monday, i);
    return { date: d, miles: dayMiles(snap, d) };
  });
};
