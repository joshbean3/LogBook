import type { DayBands, ISODate } from '@logbook/shared';

/**
 * The day's plan as docs/today-v6.md §5 shapes it. These mirror `packages/shared/src/dayplan.ts` as the backend lands
 * `DaySlot`, `DayPlan.slots` and `daySettings`; once they are exported from `@logbook/shared` this file re-exports them.
 */
export type DayRef = `todo:${string}` | `step:${string}` | `session:${string}`;

export interface DaySlot {
  ref: DayRef;
  /** Minutes from midnight, 0..1439, a multiple of 5. */
  start: number;
  /** 5..720. */
  minutes: number;
}

export interface DayPlan {
  date: ISODate;
  bands: DayBands;
  slots: DaySlot[];
  updatedAt: string | null;
}

/** What a save carries: the bands without the placed refs, and every slot. */
export interface DayPlanBody {
  bands: DayBands;
  slots: DaySlot[];
}

/** `user_settings.day`, carried by the bootstrap as `daySettings`. */
export interface DaySettings {
  window: { start: number; end: number };
  workHours: { start: number; end: number };
}

export const DEFAULT_DAY_SETTINGS: DaySettings = { window: { start: 360, end: 1380 }, workHours: { start: 540, end: 1080 } };

export const sessionRef = (id: string): DayRef => `session:${id}`;
export const isDayRef = (r: string): r is DayRef => /^(todo|step|session):/.test(r);
