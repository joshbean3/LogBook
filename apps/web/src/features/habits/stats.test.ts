import { shiftDays } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { habitTiles, habitWindow, longestStreak, streakLine, WINDOW_DAYS } from './stats';

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

describe('habitTiles', () => {
  const since = Array.from({ length: 30 }, (_, i) => shiftDays(T, -i));
  it('stamps the streak and the count, with the best run under a shorter streak', () => {
    const [streak, count] = habitTiles({ since, lit: 12, streak: 3, best: 6 }, 'Last 30 days');
    expect(streak).toMatchObject({ value: '3', unit: 'days', status: 'Best 6 days', none: false });
    expect(count).toMatchObject({ label: 'Last 30 days', value: '12', unit: 'of 30', status: '40% of days', none: false });
  });
  it('keeps both tiles with dashes before anything is lit', () => {
    const [streak, count] = habitTiles({ since: since.slice(0, 1), lit: 0, streak: 0, best: 0 }, 'Since Oct 31');
    expect(streak).toMatchObject({ value: '–', status: 'Light it today', none: true });
    expect(count).toMatchObject({ value: '0', unit: 'of 1', status: 'No days yet', none: true });
  });
  it('says one day, not one days', () => {
    expect(habitTiles({ since, lit: 1, streak: 1, best: 1 }, 'x')[0]).toMatchObject({ unit: 'day', status: 'Your best yet' });
  });
});

describe('longestStreak', () => {
  it('picks the longest running streak, or none', () => {
    expect(longestStreak([{ name: 'Read', streak: 2 }, { name: 'Stretch', streak: 5 }, { name: 'Meditate', streak: 0 }])).toEqual({ name: 'Stretch', streak: 5 });
    expect(longestStreak([{ name: 'Read', streak: 0 }])).toBeNull();
  });
});
