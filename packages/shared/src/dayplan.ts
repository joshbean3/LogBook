import { z } from 'zod';
import type { ISODate } from './dates.js';

/**
 * A day's plan: what goes in the morning, the afternoon and the evening, in order. It holds references, never copies: a
 * to-do (`todo:<id>`) or a step of a goal (`step:<goalId>:<stepId>`). Anything of the day not in a band is unplanned. The
 * plan is the day's alone, so a to-do carried into tomorrow starts tomorrow unplanned.
 */
export type DayBand = 'morning' | 'afternoon' | 'evening';
export const DAY_BANDS: readonly DayBand[] = ['morning', 'afternoon', 'evening'];
export type DayBands = Record<DayBand, string[]>;

export interface DayPlan {
  date: ISODate;
  bands: DayBands;
  updatedAt: string | null;
}

export const emptyBands = (): DayBands => ({ morning: [], afternoon: [], evening: [] });
export const todoRef = (id: string) => `todo:${id}`;
export const stepRef = (goalId: string, stepId: string) => `step:${goalId}:${stepId}`;

/** The band a clock hour falls in: before noon, before five, then the evening. */
export const bandOfHour = (h: number): DayBand => (h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening');

/** Each reference once, in the first band that has it (a drag never leaves a copy behind). */
export const cleanBands = (b: DayBands): DayBands => {
  const seen = new Set<string>();
  const out = emptyBands();
  for (const k of DAY_BANDS)
    for (const r of b[k] ?? [])
      if (!seen.has(r)) {
        seen.add(r);
        out[k].push(r);
      }
  return out;
};

const zRef = z.string().regex(/^(todo:[\w-]+|step:[\w-]+:[\w-]+)$/);
const zBand = z.array(zRef).max(80);
export const zDayPlanPut = z.object({ bands: z.object({ morning: zBand, afternoon: zBand, evening: zBand }) });
