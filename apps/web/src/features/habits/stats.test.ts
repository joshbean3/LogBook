import { shiftDays } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { habitWindow, streakLine, WINDOW_DAYS } from './stats';

const T = '2026-10-31';
const doneOn = (days: string[]) => {
  const set = new Set(days);
  return (d: string) => set.has(d);
};

describe('habitWindow', () => {
  it('reads the last 30 days ending on today, oldest first', () => {
    const w = habitWindow(() => false, T, '2026-01-01');
    expect(w.days).toHaveLength(WINDOW_DAYS);
    expect(w.days[0]).toBe('2026-10-02');
    expect(w.days[WINDOW_DAYS - 1]).toBe(T);
    expect(w.cells.filter((c) => c.today).map((c) => c.date)).toEqual([T]);
    expect(w.since).toHaveLength(WINDOW_DAYS);
    expect(w).toMatchObject({ lit: 0, streak: 0, best: 0 });
  });

  it('counts "N of M" only over the days the habit existed, and marks the days before it', () => {
    const created = shiftDays(T, -4);
    const w = habitWindow(doneOn([shiftDays(T, -10), created, T]), T, created);
    expect(w.since).toHaveLength(5);
    // the lit day before the habit existed is not counted
    expect(w.lit).toBe(2);
    expect(w.cells.filter((c) => c.before)).toHaveLength(WINDOW_DAYS - 5);
    expect(w.cells.find((c) => c.date === created)).toMatchObject({ on: true, before: false });
  });

  it('streak and best: today unlit keeps yesterday’s run; best is the longest run in the window', () => {
    const lit = [1, 2, 3, 5, 6, 7, 8, 12].map((n) => shiftDays(T, -n));
    const w = habitWindow(doneOn(lit), T, '2026-01-01');
    expect(w.streak).toBe(3);
    expect(w.best).toBe(4);
    expect(w.lit).toBe(8);
    expect(habitWindow(doneOn([...lit, T]), T, '2026-01-01').streak).toBe(4);
  });
});

describe('streakLine', () => {
  const line = (lit: string[], created = '2026-01-01') => streakLine(habitWindow(doneOn(lit), T, created));
  it('says the streak and the count', () => {
    expect(line([T, shiftDays(T, -1), shiftDays(T, -2)])).toBe('3-day streak · 3 of 30');
  });
  it('falls back to the best run, then to nothing yet', () => {
    expect(line([shiftDays(T, -5), shiftDays(T, -6), shiftDays(T, -9)])).toBe('Best 2 days · 3 of 30');
    expect(line([shiftDays(T, -5)])).toBe('No streak yet · 1 of 30');
    expect(line([])).toBe('No streak yet');
  });
  it('counts a young habit over its own days', () => {
    expect(line([T], shiftDays(T, -2))).toBe('1-day streak · 1 of 3');
  });
});
