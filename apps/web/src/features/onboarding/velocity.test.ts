import { describe, expect, it } from 'vitest';
import { commitsBack, releaseVelocity } from './velocity';

describe('releaseVelocity (onboarding edge swipe, review 2 code N3)', () => {
  it('a flick released while moving keeps its speed', () => {
    const s: Array<[number, number]> = [[8, 0], [30, 10], [55, 20], [80, 30], [100, 40]];
    expect(releaseVelocity(s, 45)).toBeCloseTo(2300, -1);
  });
  it('a drag that stopped 1.5 s before the release has none', () => {
    const s: Array<[number, number]> = [[8, 0], [60, 50], [120, 100]];
    expect(releaseVelocity(s, 1600)).toBe(0);
  });
  it('a finger still for more than 80 ms has none, even with moves inside the last 150 ms', () => {
    const s: Array<[number, number]> = [[8, 0], [60, 20], [120, 30]];
    expect(releaseVelocity(s, 120)).toBe(0);
  });
  it('only the last 150 ms count', () => {
    const s: Array<[number, number]> = [[0, 0], [300, 50], [310, 200], [320, 210]];
    expect(releaseVelocity(s, 215)).toBeCloseTo(1000, -1);
  });
  it('a flick whose moves reached a busy page 40–90 ms apart (4×) is still a flick', () => {
    const s: Array<[number, number]> = [[8, 0], [42, 70], [76, 130], [110, 190]];
    expect(releaseVelocity(s, 230)).toBeGreaterThan(300);
  });
  it('one sample is no velocity', () => {
    expect(releaseVelocity([[10, 0]], 5)).toBe(0);
  });
});

describe('commitsBack (§9.3, review 3 code N3)', () => {
  it('past 35 % released still goes back', () => expect(commitsBack(240, 390, 0, false)).toBe(true));
  it('past 35 % but flicked back toward the edge springs home', () => expect(commitsBack(166, 390, -900, false)).toBe(false));
  it('a forward flick short of 35 % goes back', () => expect(commitsBack(100, 390, 600, false)).toBe(true));
  it('short of 35 % and slow springs home', () => expect(commitsBack(100, 390, 200, false)).toBe(false));
  it('a system cancel never goes back', () => expect(commitsBack(300, 390, 900, true)).toBe(false));
});
