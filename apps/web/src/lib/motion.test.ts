import { spring } from 'motion/react';
import { describe, expect, it } from 'vitest';
import { COMPLETE_SCALE, forScale, LIFT_SCALE, springs } from './motion';

type Gen = (o: object) => { next: (ms: number) => { value: unknown; done: boolean } };
/** Frames of the transition's own generator (motion's spring, or the transition's `type` when it is one) at 60 Hz, until done. */
const run = (t: object, from: number, to: number) => {
  const type = (t as { type?: unknown }).type;
  const gen = (typeof type === 'function' ? type : spring) as unknown as Gen;
  const g = gen({ ...(t as Record<string, number>), keyframes: [from, to] });
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

describe('the px springs on a unitless value, exactly as contracts §D.1 lists the uses (consumer review 3 #3)', () => {
  const frames = (t: object, from: number, to: number) => run(t, from, to).filter((v) => Math.abs(v - from) > 1e-4 && Math.abs(v - to) > 1e-4).length;
  it('springs.lift: 1 → LIFT_SCALE plays over many frames and ends on 1.03', () => {
    const v = run(springs.lift, 1, LIFT_SCALE);
    expect(frames(springs.lift, 1, LIFT_SCALE)).toBeGreaterThan(5);
    expect(Math.abs(v.at(-1)! - LIFT_SCALE)).toBeLessThan(0.001);
  });
  it('springs.settle: a check scale 0 → 1, and the orb 1.12 → 1', () => {
    expect(frames(springs.settle, 0, 1)).toBeGreaterThan(5);
    expect(frames(springs.settle, COMPLETE_SCALE, 1)).toBeGreaterThan(5);
  });
  it('springs.number: a 0 → 1 fill', () => {
    expect(frames(springs.number, 0, 1)).toBeGreaterThan(5);
  });
  it('a px move keeps the px rest (|Δ| ≤ 1, |v| ≤ 30): every frame of a 390 px push and a 72 px settle as motion\'s own spring runs them', () => {
    const plain = (t: object, from: number, to: number) => run({ ...t, type: undefined }, from, to);
    expect(run(springs.page, 390, 0)).toEqual(plain(springs.page, 390, 0));
    expect(run(springs.page, 390, 0).length).toBeLessThanOrEqual(33);
    expect(run(springs.settle, -72, 0)).toEqual(plain(springs.settle, -72, 0));
  });
  it('an explicit threshold is honoured (forScale, forRange, a caller\'s own restDelta)', () => {
    expect(run(forScale(springs.settle), 0, 1)).toEqual(run({ ...springs.settle, restDelta: 0.0005, restSpeed: 0.01 }, 0, 1));
    expect(run({ ...springs.settle, restDelta: 2 }, 0, 300).length).toBeLessThan(run(springs.settle, 0, 300).length + 1);
  });
});

describe('the deprecated springs.press keeps its behaviour (contracts rule 5)', () => {
  it('is the settle spring as motion ran it before the unit-aware generator: the same frames as a plain px spring', () => {
    const { stiffness, damping } = springs.settle as { stiffness: number; damping: number };
    expect(springs.press).toMatchObject({ type: 'spring', stiffness, damping, restDelta: 1, restSpeed: 30 });
    expect(run(springs.press, 1, 0.985)).toEqual(run({ ...springs.settle, type: undefined }, 1, 0.985));
  });
});
