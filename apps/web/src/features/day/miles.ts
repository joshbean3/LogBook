import { dayMiles, mondayOf, shiftDays, type ISODate, type Snapshot } from '@logbook/shared';

// Contract 5 lives in @logbook/shared (`sessionMiles`, `dayMiles`): a run marked Done with no activity counts its planned
// miles, a Floor its floor minutes at the easy pace. Today reads it from there.
export { dayMiles, sessionMiles, type MilesSource } from '@logbook/shared';

/** The seven days of a week (Monday first) with their miles, logged or tracked: the done hero's week line and the share card. */
export const weekMiles = (snap: Snapshot, date: ISODate) => {
  const monday = mondayOf(date);
  return Array.from({ length: 7 }, (_, i) => {
    const d = shiftDays(monday, i);
    return { date: d, miles: dayMiles(snap, d).miles };
  });
};
