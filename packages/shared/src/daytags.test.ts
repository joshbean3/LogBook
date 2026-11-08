import { describe, expect, it } from 'vitest';
import { dayTagEffectWords, dayTagId, dayTagStat, DAY_TAG_MIN } from './daytags.js';
import { shiftDays } from './dates.js';

const def = { id: 'alcohol', label: 'Alcohol' };
const D = '2026-10-01';

describe('day tags', () => {
  it('makes an id from a label', () => {
    expect(dayTagId('Late screens')).toBe('late-screens');
    expect(dayTagId('  Coffee after 2pm! ')).toBe('coffee-after-2pm');
    expect(dayTagId('!!!')).toBe('');
  });

  it('counts yes and no days and holds the effect until there are enough rated runs', () => {
    const marks = Array.from({ length: 8 }, (_, i) => ({ date: shiftDays(D, i * 2), value: i % 2 === 0 }));
    const s = dayTagStat(def, marks, new Map());
    expect(s).toMatchObject({ yes: 4, no: 4, ratedYes: 0, ratedNo: 0, effect: null });
  });

  it('pairs a mark with the next day’s run and averages once both sides reach the minimum', () => {
    const marks = Array.from({ length: 2 * DAY_TAG_MIN }, (_, i) => ({ date: shiftDays(D, i * 2), value: i < DAY_TAG_MIN }));
    const effort = new Map<string, number>(marks.map((m) => [shiftDays(m.date, 1), m.value ? 7 : 5]));
    // a run on the day itself is not the one that counts
    effort.set(D, 1);
    const s = dayTagStat(def, marks, effort);
    expect(s).toMatchObject({ yes: 5, no: 5, ratedYes: 5, ratedNo: 5, effect: { yes: 7, no: 5 } });
    expect(dayTagEffectWords(s.effect!)).toContain('harder');
  });

  it('says so when there is no clear difference', () => {
    expect(dayTagEffectWords({ yes: 5.1, no: 5 })).toMatch(/^No clear difference/);
    expect(dayTagEffectWords({ yes: 4, no: 5.5 })).toContain('easier');
  });

  it('stays empty with four on one side', () => {
    const marks = [...Array.from({ length: 6 }, (_, i) => ({ date: shiftDays(D, i * 2), value: true })), ...Array.from({ length: 4 }, (_, i) => ({ date: shiftDays(D, 40 + i * 2), value: false }))];
    const effort = new Map(marks.map((m) => [shiftDays(m.date, 1), 6] as const));
    expect(dayTagStat(def, marks, effort).effect).toBeNull();
  });
});
