import type { HealthStatus } from '@logbook/shared';

/**
 * What Logbook says about Apple Health, in one place, so Settings can never promise more than 1.0 does: three things are
 * read (sleep, heart rate variability, resting heart rate), they are saved to the account, and Progress shows them.
 */

/** The three things read, each with the one line the connect sheet shows under it. */
export const HEALTH_READS: ReadonlyArray<readonly [title: string, sub: string]> = [
  ['Sleep', 'Time asleep each night'],
  ['Heart rate variability', 'Your HRV, day by day'],
  ['Resting heart rate', 'Your resting pulse, day by day'],
];
/** The same three in one line, for a row's second line. */
export const HEALTH_READS_LINE = 'Sleep, heart rate variability and resting heart rate';
/** Read only, never sold: under the card and in the connect sheet. */
export const HEALTH_TRUST = 'Logbook only reads. It never writes to Apple Health and never sells what it reads.';
/** Where Apple keeps the switch that takes Logbook's access away. */
export const HEALTH_REVOKE_PATH = 'In the Apple Health app, tap your picture, then Apps, then Logbook.';

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
