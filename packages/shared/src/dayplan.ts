import { z } from 'zod';
import type { ISODate } from './dates.js';

/**
 * A day's plan (docs/today-v6.md §5): timed slots on one timeline, and the older bands (morning, afternoon, evening) in
 * order. It holds references, never copies: a to-do (`todo:<id>`), a step of a goal (`step:<goalId>:<stepId>`) or a
 * session (`session:<id>`). A ref is in `slots`, in a band, or in neither (the tray). Writing a slot removes the ref
 * from the bands. The plan is the day's alone, so a to-do carried into tomorrow starts tomorrow unplanned.
 */
export type DayRef = `todo:${string}` | `step:${string}` | `session:${string}`;
export type DayBand = 'morning' | 'afternoon' | 'evening';
export const DAY_BANDS: readonly DayBand[] = ['morning', 'afternoon', 'evening'];
export type DayBands = Record<DayBand, string[]>;

/** One block on the timeline: what, when (minutes from midnight, on a 5-minute grid) and for how long. */
export interface DaySlot {
  ref: DayRef;
  /** 0..1439, a multiple of 5. */
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

export const emptyBands = (): DayBands => ({ morning: [], afternoon: [], evening: [] });
export const emptyPlan = (date: ISODate): DayPlan => ({ date, bands: emptyBands(), slots: [], updatedAt: null });
export const todoRef = (id: string): DayRef => `todo:${id}`;
export const stepRef = (goalId: string, stepId: string): DayRef => `step:${goalId}:${stepId}`;
export const sessionRef = (id: string): DayRef => `session:${id}`;

/** Default length of a block by what it holds (spec §3): a to-do 30 min, a step 45, a session 60. */
export const defaultMinutes = (ref: string): number => (ref.startsWith('step:') ? 45 : ref.startsWith('session:') ? 60 : 30);

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

/** The slots on the 5-minute grid, each ref once (the first slot wins), sorted by start then by ref. */
export const cleanSlots = (slots: readonly DaySlot[]): DaySlot[] => {
  const seen = new Set<string>();
  const out: DaySlot[] = [];
  for (const s of slots ?? []) {
    if (seen.has(s.ref)) continue;
    seen.add(s.ref);
    const start = Math.min(1435, Math.max(0, Math.round(s.start / 5) * 5));
    const minutes = Math.min(720, Math.max(5, Math.round(s.minutes / 5) * 5));
    out.push({ ref: s.ref, start, minutes });
  }
  return out.sort((a, b) => a.start - b.start || (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0));
};

/**
 * The whole plan as it should be stored: each ref once in all of it (a ref in `slots` leaves the bands; in the bands, the
 * first band that has it), the slots on the grid and sorted by start.
 */
export const cleanPlan = <T extends { bands?: Partial<DayBands> | null; slots?: readonly DaySlot[] | null }>(plan: T): { bands: DayBands; slots: DaySlot[] } => {
  const slots = cleanSlots(plan.slots ?? []);
  const placed = new Set<string>(slots.map((s) => s.ref));
  const raw = { ...emptyBands(), ...(plan.bands ?? {}) };
  const bands = cleanBands({ morning: raw.morning.filter((r) => !placed.has(r)), afternoon: raw.afternoon.filter((r) => !placed.has(r)), evening: raw.evening.filter((r) => !placed.has(r)) });
  return { bands, slots };
};

/** Whether two slots share any minute. */
export const slotsOverlap = (a: DaySlot, b: DaySlot): boolean => a.start < b.start + b.minutes && b.start < a.start + a.minutes;

export const zDayRef = z.string().regex(/^(todo:[\w-]+|step:[\w-]+:[\w-]+|session:[\w-]+)$/, 'a ref like todo:<id>, step:<goalId>:<stepId> or session:<id>') as unknown as z.ZodType<DayRef>;
const zBand = z.array(zDayRef).max(80);
export const zDayBands = z.object({ morning: zBand, afternoon: zBand, evening: zBand });
export const zDaySlot = z.object({
  ref: zDayRef,
  start: z.number().int().min(0).max(1439).refine((n) => n % 5 === 0, 'a multiple of 5'),
  minutes: z.number().int().min(5).max(720),
});
/** `PUT /day-plans/:date`: the bands, the slots, or both. What is left out is kept as stored. */
export const zDayPlanPut = z.object({ bands: zDayBands.optional(), slots: z.array(zDaySlot).max(60).optional() }).refine((p) => p.bands !== undefined || p.slots !== undefined, { message: 'Give bands, slots or both' });
