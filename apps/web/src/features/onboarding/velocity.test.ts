import { describe, expect, it } from 'vitest';
import { releaseVelocity } from './velocity';

describe('releaseVelocity (onboarding edge swipe, review 2 code N3)', () => {
  it('a flick released while moving keeps its speed', () => {
    const s: Array<[number, number]> = [[8, 0], [30, 10], [55, 20], [80, 30], [100, 40]];
    expect(releaseVelocity(s, 45)).toBeCloseTo(2300, -1);
  });
  it('a drag that stopped 1.5 s before the release has none', () => {
    const s: Array<[number, number]> = [[8, 0], [60, 50], [120, 100]];
    expect(releaseVelocity(s, 1600)).toBe(0);
  });
  it('a finger still for more than 50 ms has none, even with moves inside the last 100 ms', () => {
    const s: Array<[number, number]> = [[8, 0], [60, 20], [120, 30]];
    expect(releaseVelocity(s, 90)).toBe(0);
  });
  it('only the last 100 ms count', () => {
    const s: Array<[number, number]> = [[0, 0], [300, 50], [310, 200], [320, 210]];
    expect(releaseVelocity(s, 215)).toBeCloseTo(1000, -1);
  });
  it('one sample is no velocity', () => {
    expect(releaseVelocity([[10, 0]], 5)).toBe(0);
  });
});
