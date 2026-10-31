import type { DayBands, DaySlot } from '@logbook/shared';

/**
 * The day's plan as docs/today-v6.md §5 shapes it: the types live in `@logbook/shared` (`packages/shared/src/dayplan.ts`
 * and `schemas.ts`), re-exported here for the feature's files.
 */
export { DEFAULT_DAY_SETTINGS, sessionRef, type DayPlan, type DayRef, type DaySettings, type DaySlot } from '@logbook/shared';

/** What a save carries: the bands without the placed refs, and every slot. */
export interface DayPlanBody {
  bands: DayBands;
  slots: DaySlot[];
}
