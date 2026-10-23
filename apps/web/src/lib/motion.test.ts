import { spring } from 'motion/react';
import { describe, expect, it } from 'vitest';
import { COMPLETE_SCALE, forScale, springs } from './motion';

/** Frames of motion's own spring generator from `from` to `to` at 60 Hz, until it says done. */
const run = (t: object, from: number, to: number) => {
  const g = spring({ keyframes: [from, to], ...(t as Record<string, number>) });
  const values: number[] = [];
  for (let ms = 0; ms <= 3000; ms += 1000 / 60) {
    const s = g.next(ms);
    values.push(s.value as number);
    if (s.done) break;
  }
  return values;
};

describe('springs.complete is a scale spring (consumer review 2 #5)', () => {
  it('animated as contracts §D.3 writes it, 1 → 1.12 overshoots and runs for many frames', () => {
    const v = run(springs.complete, 1, COMPLETE_SCALE);
    expect(v.length).toBeGreaterThan(10);
    expect(Math.max(...v)).toBeGreaterThan(COMPLETE_SCALE + 0.005);
    expect(Math.abs(v.at(-1)! - COMPLETE_SCALE)).toBeLessThan(0.001);
  });
  it('is the same as forScale(springs.complete)', () => {
    expect(run(springs.complete, 1, COMPLETE_SCALE)).toEqual(run(forScale(springs.complete), 1, COMPLETE_SCALE));
  });
  it('a px spring still rests at 1 px / 30 px/s', () => {
    expect(springs.page).toMatchObject({ restDelta: 1, restSpeed: 30 });
  });
});
