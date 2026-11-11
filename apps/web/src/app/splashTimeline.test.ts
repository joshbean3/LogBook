import { describe, expect, it } from 'vitest';
import { bezier, CLEAR_GAP, REST_GAP, RINGS, RISE, RISE_EASE, SPLASH_MS, sunrisePlan, timeFor } from './splashTimeline';

/** The opening sunrise (guide 9.2): one length, and a schedule in which what you feel is what you see. */
describe('the opening sunrise', () => {
  const plan = sunrisePlan();

  it('is 2.8 seconds from the first frame to the app, set by one constant', () => {
    expect(SPLASH_MS).toBe(2800);
    expect(plan.total).toBe(SPLASH_MS);
    expect(plan.exit.at + plan.exit.for).toBe(SPLASH_MS);
  });

  it('the fuller beat is on the frame the Orb clears the near hill', () => {
    // how far the Orb's lowest point is above the crest at time t, in Orb diameters (negative: still behind the hill)
    const gapAt = (t: number) => REST_GAP - RISE * (1 - bezier(RISE_EASE)((t - plan.rise.at) / plan.rise.for));
    expect(gapAt(plan.beat)).toBeCloseTo(CLEAR_GAP, 2);
    // one frame earlier it has not cleared; at a 110 px Orb the beat is within a third of a pixel of the line
    expect(gapAt(plan.beat - 17)).toBeLessThan(CLEAR_GAP);
    expect(Math.abs(gapAt(plan.beat) - CLEAR_GAP) * 110).toBeLessThan(0.34);
    const dawn = plan.haptics.filter((h) => h.kind === 'dawn');
    expect(dawn).toEqual([{ at: plan.beat, kind: 'dawn', late: 400 }]);
  });

  it('starts hidden behind the hill and rests 0.1 D above it (guide 8.3)', () => {
    expect(RISE).toBeCloseTo(1.35, 5);
    // at the first frame its top is 0.25 D under the crest; at the end its bottom is REST_GAP over it
    expect(REST_GAP - RISE + 1).toBeCloseTo(-0.25, 5);
    expect(REST_GAP).toBe(0.1);
  });

  it('a light tap as each ring leaves the Orb, and the taps quicken into the beat', () => {
    const taps = plan.haptics.filter((h) => h.kind === 'rise').map((h) => h.at);
    expect(taps).toEqual(plan.rings.map((r) => r.at));
    expect(taps).toHaveLength(RINGS.length);
    const times = [...taps, plan.beat];
    const gaps = times.slice(1).map((t, i) => t - times[i]!);
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]!).toBeLessThan(gaps[i - 1]!);
    // never closer than the Taptic Engine can speak clearly
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(100);
    // the first tap is the first light: the Orb's top is at the hill line, give or take a tenth of a second
    const emerges = plan.rise.at + plan.rise.for * timeFor(RISE_EASE, 0.25 / RISE);
    expect(Math.abs(taps[0]! - emerges)).toBeLessThan(100);
  });

  it('the rings are the poster\'s five, born from the outside in, each from the Orb\'s own edge', () => {
    expect(plan.rings.map((r) => r.size / 2)).toEqual([1.4, 1.24, 1.06, 0.86, 0.66]);
    expect(plan.rings.map((r) => r.opacity)).toEqual([0.3, 0.4, 0.5, 0.6, 0.7]);
    for (const r of plan.rings) expect(r.from * r.size).toBeCloseTo(1, 5);
    // a wider ring travels longer, and all are at rest before the exit
    for (let i = 1; i < plan.rings.length; i++) expect(plan.rings[i]!.for).toBeLessThan(plan.rings[i - 1]!.for);
    for (const r of plan.rings) expect(r.at + r.for).toBeLessThan(plan.exit.at);
  });

  it('everything has arrived and rested before the app appears', () => {
    const ends = [plan.veil, plan.rise, plan.warm, plan.glow, plan.first, plan.light, plan.bloom, plan.word, plan.line].map((s) => s.at + s.for);
    for (const end of ends) expect(end).toBeLessThanOrEqual(plan.exit.at);
    // the words come on the beat and are read for a moment
    expect(plan.word.at).toBe(plan.beat);
    expect(plan.line.at).toBeGreaterThan(plan.word.at);
    expect(plan.exit.at - (plan.line.at + plan.line.for)).toBeGreaterThanOrEqual(300);
    // the Orb's pale underlight is in before its sunrise light is
    expect(plan.first.at).toBeLessThan(plan.light.at);
    expect(plan.light.at + plan.light.for).toBeGreaterThanOrEqual(plan.beat);
  });

  it('scales as a whole when the one constant changes', () => {
    const long = sunrisePlan(5600);
    expect(long.exit.at + long.exit.for).toBe(5600);
    expect(long.beat / plan.beat).toBeCloseTo(2, 1);
    long.rings.forEach((r, i) => expect(Math.abs(r.at / 2 - plan.rings[i]!.at)).toBeLessThanOrEqual(2));
    expect(long.haptics).toHaveLength(plan.haptics.length);
  });

  it('the easing is the curve CSS draws for the same numbers', () => {
    const ease = bezier([0.25, 0.1, 0.25, 1]); // the keyword `ease`
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeCloseTo(0.8024, 3);
    const linear = bezier([0, 0, 1, 1]);
    expect(linear(0.3)).toBeCloseTo(0.3, 5);
    expect(timeFor([0, 0, 1, 1], 0.42)).toBeCloseTo(0.42, 5);
    // the climb only rises
    const rise = bezier(RISE_EASE);
    let last = 0;
    for (let x = 0; x <= 1.0001; x += 0.01) {
      const y = rise(Math.min(1, x));
      expect(y).toBeGreaterThanOrEqual(last - 1e-9);
      last = y;
    }
  });
});
