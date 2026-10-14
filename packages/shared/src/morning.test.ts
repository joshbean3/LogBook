import { describe, expect, it } from 'vitest';
import { AFTER_ORDER, buildMorning, MORNING_DEFAULTS, morningDayFor, normalizeAfterOrder, normalizeMorningSettings } from './morning.js';
import { zMorningSettingsPatch, zTrainingPatch, zTrainingProfile } from './schemas.js';
import type { MorningSettings } from './types.js';

// MORNING_DEFAULTS: alarm 7:20, Easy 5 at 9:00/mi, back 8:30, the routine fixed at 8:40: shower 15, ready 15, smoothie 5,
// prep 15, so leave is 9:30 (570).
const easy5 = (st: MorningSettings) => buildMorning(morningDayFor([], { mode: 'run', type: 'Easy', miles: 5 }, st), st);
const after = (st: MorningSettings) => easy5(st).blocks.filter((b) => (AFTER_ORDER as readonly string[]).includes(b.key));

describe('the back-home order (after.order)', () => {
  it('defaults to shower, get ready, smoothie, final prep', () => {
    expect(MORNING_DEFAULTS.after.order).toEqual(['shower', 'ready', 'smoothie', 'prep']);
    expect(normalizeMorningSettings({}).after.order).toEqual(['shower', 'ready', 'smoothie', 'prep']);
    const blocks = after(MORNING_DEFAULTS);
    expect(blocks.map((b) => b.key)).toEqual(['shower', 'ready', 'smoothie', 'prep']);
    expect(blocks.map((b) => b.label)).toEqual(['Shower', 'Get ready', 'Blend smoothie', 'Final prep']);
    expect(blocks.map((b) => b.start)).toEqual([520, 535, 550, 555]);
  });

  it('buildMorning runs the blocks in the stored order; the start and the leave time do not move', () => {
    const st = normalizeMorningSettings({ after: { order: ['prep', 'smoothie', 'shower', 'ready'] } });
    const T = easy5(st);
    expect(after(st).map((b) => [b.key, b.start, b.end])).toEqual([
      ['prep', 520, 535],
      ['smoothie', 535, 540],
      ['shower', 540, 555],
      ['ready', 555, 570],
    ]);
    expect(T.leave).toBe(easy5(MORNING_DEFAULTS).leave);
    expect(T.leave).toBe(570);
  });

  it('a smoothie set to 0 is skipped wherever it sits', () => {
    const st = normalizeMorningSettings({ after: { smoothie: 0, order: ['smoothie', 'prep', 'ready', 'shower'] } });
    expect(after(st).map((b) => b.key)).toEqual(['prep', 'ready', 'shower']);
    expect(easy5(st).leave).toBe(565);
  });

  it('a stale or partial stored order is made whole: unknown keys dropped, duplicates once, missing ones appended', () => {
    expect(normalizeAfterOrder(['ready', 'ready', 'nap', 'prep'])).toEqual(['ready', 'prep', 'shower', 'smoothie']);
    expect(normalizeAfterOrder('shower')).toEqual([...AFTER_ORDER]);
    expect(normalizeMorningSettings({ after: { order: null } }).after.order).toEqual([...AFTER_ORDER]);
  });

  it('the settings patch takes all four keys once each', () => {
    expect(zMorningSettingsPatch.safeParse({ after: { order: ['prep', 'ready', 'shower', 'smoothie'] } }).success).toBe(true);
    expect(zMorningSettingsPatch.safeParse({ after: { order: ['prep', 'prep', 'shower', 'smoothie'] } }).success).toBe(false);
    expect(zMorningSettingsPatch.safeParse({ after: { order: ['prep', 'shower', 'smoothie'] } }).success).toBe(false);
    expect(zMorningSettingsPatch.safeParse({ after: { order: ['prep', 'nap', 'shower', 'smoothie'] } }).success).toBe(false);
  });
});

describe('the training profile schema', () => {
  const P = { goal: '10k', raceDate: '2026-12-27', runDays: ['tue', 'thu', 'sat', 'sun'], longRunDay: 'sun', weeklyMiles: 18 };
  it('takes the five answers', () => {
    expect(zTrainingProfile.parse(P)).toEqual(P);
    expect(zTrainingProfile.safeParse({ ...P, raceDate: null, goal: 'base' }).success).toBe(true);
    expect(zTrainingProfile.safeParse({ ...P, runDays: [] }).success).toBe(false);
    expect(zTrainingProfile.safeParse({ ...P, weeklyMiles: 1 }).success).toBe(false);
    expect(zTrainingProfile.safeParse({ ...P, goal: 'ultra' }).success).toBe(false);
  });
  it('a patch is any of them, but not none', () => {
    expect(zTrainingPatch.parse({ weeklyMiles: 22 })).toEqual({ weeklyMiles: 22 });
    expect(zTrainingPatch.safeParse({}).success).toBe(false);
    expect(zTrainingPatch.safeParse({ longRunDay: 'someday' }).success).toBe(false);
  });
});
