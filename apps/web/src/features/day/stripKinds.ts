import type { ISODate, Snapshot } from '@logbook/shared';
import type { StripKind } from '@/ui/NavBar';
const ORDER: readonly StripKind[] = ['run', 'lift', 'cross'];

/**
 * The kinds a day calls for, for the strip's glyph: the planned sessions that still stand (rest and skipped or sick ones
 * left out), or, on a day with no plan, what was actually done (a bonus run, a lift logged set by set). At most two, run
 * first, so a cell never holds more than it can show at 52 px wide.
 */
export const stripKinds = (snap: Snapshot, d: ISODate): StripKind[] => {
  const planned = snap
    .sessionsOn(d)
    .filter((s) => s.kind !== 'rest' && s.mark !== 'skip' && s.mark !== 'sick')
    .map((s) => s.kind as StripKind);
  const done = planned.length ? [] : [...snap.activitiesOn(d).map((a) => a.kind as StripKind), ...(snap.liftSetCountOn(d) > 0 ? (['lift'] as const) : [])];
  const have = new Set([...planned, ...done]);
  return ORDER.filter((k) => have.has(k)).slice(0, 2);
};
