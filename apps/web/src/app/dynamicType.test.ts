import { describe, expect, it } from 'vitest';
import { clampFactor, MAX_FACTOR, MIN_FACTOR, XL_FACTOR } from './dynamicType';

/** a11y-01, a11y-18: the root scale follows the iOS text size between 100% and 200%, never outside. */
describe('the Larger Text factor', () => {
  it('is clamped between 1.0 and 2.0', () => {
    expect([MIN_FACTOR, MAX_FACTOR]).toEqual([1, 2]);
    // iOS body sizes over the 17 px default: xSmall 14, Large 17, xxxLarge 23, AX1 28, AX3 40, AX5 53
    expect([14, 17, 23, 28, 40, 53].map((px) => clampFactor(px / 17))).toEqual([1, 1, 23 / 17, 28 / 17, 2, 2]);
  });
  it('a reading that is not a number changes nothing', () => {
    expect(clampFactor(Number.NaN)).toBe(1);
    expect(clampFactor(Number.POSITIVE_INFINITY)).toBe(1);
  });
  it('the dock drops its words above 150%', () => {
    expect(XL_FACTOR).toBe(1.5);
  });
});
