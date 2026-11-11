import { describe, expect, it } from 'vitest';
import { gaugeTicks } from './gauge';

describe('the gauge ticks by the mile (guide 6.5)', () => {
  it('a minor every 0.5 mi and a major every 5 up to a 30 mi plan', () => {
    const t = gaugeTicks(23);
    expect(t).toHaveLength(47);
    expect(t.filter((k) => k.major).map((k) => Math.round(k.t * 23))).toEqual([0, 5, 10, 15, 20]);
    expect(t[1]!.t).toBeCloseTo(0.5 / 23);
  });
  it('a minor every mile above 30, never more than 60 ticks', () => {
    expect(gaugeTicks(40)).toHaveLength(41);
    expect(gaugeTicks(100).length).toBeLessThanOrEqual(60);
    expect(gaugeTicks(100).filter((k) => k.major)).toHaveLength(11);
  });
  it('no plan and no miles: no ticks', () => {
    expect(gaugeTicks(0)).toEqual([]);
  });
});
