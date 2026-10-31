import { describe, expect, it } from 'vitest';
import { cleanBands, cleanPlan, cleanSlots, defaultMinutes, slotsOverlap, zDayPlanPut, zDaySlot } from './dayplan.js';
import { zDaySettings } from './schemas.js';

describe('cleanPlan', () => {
  it('a ref in a slot leaves the bands, each ref is kept once, and the slots come back sorted by start', () => {
    const out = cleanPlan({
      bands: { morning: ['todo:a', 'todo:b', 'step:g:s1'], afternoon: ['todo:b', 'todo:c'], evening: ['todo:a'] },
      slots: [
        { ref: 'todo:b', start: 600, minutes: 30 },
        { ref: 'todo:a', start: 540, minutes: 30 },
        { ref: 'todo:a', start: 900, minutes: 60 },
      ],
    });
    expect(out.slots).toEqual([
      { ref: 'todo:a', start: 540, minutes: 30 },
      { ref: 'todo:b', start: 600, minutes: 30 },
    ]);
    expect(out.bands).toEqual({ morning: ['step:g:s1'], afternoon: ['todo:c'], evening: [] });
  });

  it('fills in what is missing and snaps a slot to the grid', () => {
    expect(cleanPlan({})).toEqual({ bands: { morning: [], afternoon: [], evening: [] }, slots: [] });
    expect(cleanPlan({ bands: { morning: ['todo:x'] } }).bands.morning).toEqual(['todo:x']);
    expect(cleanSlots([{ ref: 'todo:x', start: 542, minutes: 2 }])).toEqual([{ ref: 'todo:x', start: 540, minutes: 5 }]);
    expect(cleanBands({ morning: ['todo:x', 'todo:x'], afternoon: ['todo:x'], evening: [] })).toEqual({ morning: ['todo:x'], afternoon: [], evening: [] });
  });

  it('knows a block’s default length and whether two overlap', () => {
    expect(defaultMinutes('todo:x')).toBe(30);
    expect(defaultMinutes('step:g:s')).toBe(45);
    expect(slotsOverlap({ ref: 'todo:a', start: 540, minutes: 30 }, { ref: 'todo:b', start: 560, minutes: 30 })).toBe(true);
    expect(slotsOverlap({ ref: 'todo:a', start: 540, minutes: 30 }, { ref: 'todo:b', start: 570, minutes: 30 })).toBe(false);
  });
});

describe('zod', () => {
  it('zDaySlot wants a start on the 5-minute grid inside the day and 5 to 720 minutes', () => {
    expect(zDaySlot.safeParse({ ref: 'session:p_1', start: 410, minutes: 50 }).success).toBe(true);
    expect(zDaySlot.safeParse({ ref: 'todo:a', start: 542, minutes: 30 }).success).toBe(false);
    expect(zDaySlot.safeParse({ ref: 'todo:a', start: 1440, minutes: 30 }).success).toBe(false);
    expect(zDaySlot.safeParse({ ref: 'todo:a', start: 540, minutes: 0 }).success).toBe(false);
    expect(zDaySlot.safeParse({ ref: 'todo:a', start: 540, minutes: 725 }).success).toBe(false);
    expect(zDaySlot.safeParse({ ref: 'habit:a', start: 540, minutes: 30 }).success).toBe(false);
  });

  it('zDayPlanPut takes bands, slots or both, never neither', () => {
    expect(zDayPlanPut.safeParse({ slots: [] }).success).toBe(true);
    expect(zDayPlanPut.safeParse({ bands: { morning: [], afternoon: [], evening: [] } }).success).toBe(true);
    expect(zDayPlanPut.safeParse({ bands: { morning: [], afternoon: [], evening: [] }, slots: [{ ref: 'todo:a', start: 0, minutes: 5 }] }).success).toBe(true);
    expect(zDayPlanPut.safeParse({}).success).toBe(false);
    expect(zDayPlanPut.safeParse({ bands: { morning: ['<script>'], afternoon: [], evening: [] } }).success).toBe(false);
  });

  it('zDaySettings keeps each range inside the day with its start before its end', () => {
    expect(zDaySettings.parse({ window: { start: 360, end: 1380 }, workHours: { start: 540, end: 1080 } })).toEqual({ window: { start: 360, end: 1380 }, workHours: { start: 540, end: 1080 } });
    expect(zDaySettings.safeParse({ window: { start: 600, end: 600 }, workHours: { start: 540, end: 1080 } }).success).toBe(false);
    expect(zDaySettings.safeParse({ window: { start: 360, end: 1440 }, workHours: { start: 540, end: 1080 } }).success).toBe(false);
    expect(zDaySettings.safeParse({ window: { start: 360, end: 1380 } }).success).toBe(false);
  });
});
