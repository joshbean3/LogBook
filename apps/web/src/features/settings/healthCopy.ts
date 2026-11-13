import type { HealthStatus } from '@logbook/shared';

/**
 * What Logbook says about Apple Health, in one place, so Settings can never promise more than 1.0 does: three things are
 * read (sleep, heart rate variability, resting heart rate), they are saved to the account, and they are shown in Fitness,
 * under Trends (with Fitness off, lib/prefs.ts: in Settings, under Apple Health).
 */

/** The three things read, each with the one line the connect sheet shows under it. */
export const HEALTH_READS: ReadonlyArray<readonly [title: string, sub: string]> = [
  ['Sleep', 'Time asleep each night'],
  ['Heart rate variability', 'Your HRV, day by day'],
  ['Resting heart rate', 'Your resting pulse, day by day'],
];
/** The same three in one line, for a row's second line. */
export const HEALTH_READS_LINE = 'Sleep, heart rate variability and resting heart rate';
/** The short form, for the device card beside its button. */
export const HEALTH_READS_SHORT = 'Sleep, HRV and resting heart rate';
/** Read only, never sold: under the card and in the connect sheet. */
export const HEALTH_TRUST = 'Orby only reads. It never writes to Apple Health and never sells what it reads.';
/** Where Apple keeps the switch that takes Logbook's access away. */
export const HEALTH_REVOKE_PATH = 'In the Apple Health app, tap your picture, then Apps, then Orby.';

/** Where the three numbers are shown: Fitness's Trends; with Fitness off, Settings, under Apple Health. */
export const healthPlace = (fitness: boolean): string => (fitness ? 'in Fitness, under Trends' : 'in Settings, under Apple Health');
/** The connect sheet's headline and its one line, which never name training with Fitness off. */
export const healthPitch = (fitness: boolean): { title: string; sub: string } => ({
  title: fitness ? 'Your sleep and your heart, beside your training.' : 'Your sleep and your heart, day by day.',
  sub: `Orby reads three things from Apple Health and shows them ${fitness ? 'in Fitness' : 'in Settings'}.`,
});
/** Why the readings leave the phone, in the connect sheet. */
export const HEALTH_SAVED_NOTE = 'Readings are saved to your Orby account on Orby’s server, so Orby can show them. Orby reads as much history as you share, up to a year, then keeps up each time you open it.';

/**
 * The import's last line, worded by what arrived: the span the server holds when it knows it ("Since Aug 2026: sleep,
 * heart rate variability and resting heart rate are in Fitness, under Trends."), else the plain line.
 */
export const importDoneWords = (since: string | null, fitness = true): string => `${since ? `${since}: ${HEALTH_READS_LINE.toLowerCase()}` : HEALTH_READS_LINE} are ${healthPlace(fitness)}. Orby keeps up each time you open it.`;

/** "Reading Apple Health: November 2026": the wait, named, with the month being read when the engine says which. */
export const importWords = (month: Date | null): string => (month ? `Reading Apple Health: ${month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}` : 'Reading Apple Health…');

const n = (v: number) => v.toLocaleString('en-US');
/**
 * What has been saved to the account, from the server's counts: heart readings (HRV and resting heart rate together) and
 * whether any sleep has arrived. `since` is the first month with readings, when the server knows it.
 */
export const savedWords = (s: Pick<HealthStatus, 'counts' | 'span'>): { sub: string; since: string | null } => {
  const readings = (s.counts.samples.hrv ?? 0) + (s.counts.samples.resting_hr ?? 0);
  const sleep = s.counts.sleep > 0;
  const sub = readings && sleep ? `Your sleep, and ${n(readings)} heart reading${readings === 1 ? '' : 's'}` : readings ? `${n(readings)} heart reading${readings === 1 ? '' : 's'}` : sleep ? 'Your sleep' : 'Nothing yet. It arrives a month at a time, newest first.';
  const from = s.span.from ? new Date(`${s.span.from}T12:00:00`) : null;
  const since = from && !Number.isNaN(+from) ? `Since ${from.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : null;
  return { sub, since };
};
