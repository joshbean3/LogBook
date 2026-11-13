import { describe, expect, it } from 'vitest';
import { numbersShown, statusOf } from './HealthNumbers';

describe('Your numbers (Settings, Apple Health, with Fitness off)', () => {
  it('draws only the numbers that have a reading, the night first, then the two heart numbers', () => {
    const has = { hasData: true, value: 7 };
    const none = { hasData: false, value: null };
    expect(numbersShown({ sleep: has, hrv: has, rhr: has })).toEqual(['sleep', 'hrv', 'rhr']);
    expect(numbersShown({ sleep: none, hrv: has, rhr: has })).toEqual(['hrv', 'rhr']);
    // nothing has arrived yet: no block at all, never three dashes
    expect(numbersShown({ sleep: none, hrv: none, rhr: none })).toEqual([]);
    expect(numbersShown({})).toEqual([]);
    // readings exist but none in the last stretch: nothing to show for it
    expect(numbersShown({ sleep: { hasData: true, value: null } })).toEqual([]);
  });

  it('says where a number stands against your usual, and that it is still learning before there is one', () => {
    expect(statusOf({ hasData: true, value: 52, standing: 'within' })).toBe('normal');
    expect(statusOf({ hasData: true, value: 52, standing: 'above' })).toBe('higher');
    expect(statusOf({ hasData: true, value: 52, standing: 'below' })).toBe('lower');
    expect(statusOf({ hasData: true, value: 52, standing: null })).toBe('learning');
    expect(statusOf({ hasData: false, value: null, standing: null })).toBe('none');
  });
});
