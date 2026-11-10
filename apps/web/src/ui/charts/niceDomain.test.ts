import { describe, expect, it } from 'vitest';
import { chartDomain } from './niceDomain';
import { niceDomain, niceTicks } from './scale';

describe('chartDomain', () => {
  it('keeps a fixed domain: a share whose average is exactly 100 tops out at 100, not 150', () => {
    const line = [100, 100, 100, 100, 100, 100, 100];
    // without a fixed domain the kit pads 100 up past the round tick
    expect(niceDomain([...line, 100], { zero: true, count: 3 })[1]).toBeGreaterThan(100);
    const [lo, hi] = chartDomain([...line, 100], { zero: true, count: 3, domain: [0, 100] });
    expect([lo, hi]).toEqual([0, 100]);
    const ticks = niceTicks(lo, hi, 3);
    expect(ticks[ticks.length - 1]).toBe(100);
    expect(ticks[0]).toBe(0);
  });

  it('falls back to the data domain without one (or with an empty or inverted one)', () => {
    expect(chartDomain([2, 18, 9], { zero: true })).toEqual(niceDomain([2, 18, 9], { zero: true }));
    expect(chartDomain([2, 18, 9], { zero: true, domain: [5, 5] })).toEqual(niceDomain([2, 18, 9], { zero: true }));
    expect(chartDomain([2, 18, 9], { zero: true, domain: [10, 0] })).toEqual(niceDomain([2, 18, 9], { zero: true }));
  });
});
