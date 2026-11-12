import { mondayOf } from '@logbook/shared';

/**
 * What a change made outside the week's own rows needs from the week on screen (the Add sheet and its Undo, which live in
 * the sheet and the toast). Two small things, with no imports from Plan, so the sheet can use them:
 *
 * - `beforeWeekChange(date)`: called right before a session is written to or taken from `date`. A week on screen that
 *   registered a capture (`onWeekChange`) hears it. The line of days registers none today (its stops do not slide), so
 *   this is a no-op kept for the sheet's callers.
 * - `markArriving(id)` / `arrivingFor(id)`: the session that was just added. Its stop is brought into view once the
 *   sheet is on its way down (Week.tsx), so the eye finds what was added.
 */
const captures = new Map<string, () => void>();

/** The live week group of `mon` registers its capture; the return takes it back. */
export const onWeekChange = (mon: string, capture: () => void) => {
  captures.set(mon, capture);
  return () => {
    if (captures.get(mon) === capture) captures.delete(mon);
  };
};
export const beforeWeekChange = (date: string) => captures.get(mondayOf(date))?.();

/** How long a row counts as just added: the sheet's close (500 ms) and a beat to see it. */
export const ARRIVE_MS = 1400;
let arriving: { id: string; until: number } | null = null;
export const markArriving = (id: string) => {
  arriving = { id, until: performance.now() + ARRIVE_MS };
};
/** Milliseconds left of the row's moment, or 0. */
export const arrivingFor = (id: string): number => (arriving && arriving.id === id ? Math.max(0, arriving.until - performance.now()) : 0);
