import type { LiftSet } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { canAdd, groupsOf, hintFor, lastSession, pressKey, setText, stepValue } from './liftModel';

const set = (id: string, date: string, exercise: string, weight: number, reps: number): LiftSet => ({ id, date, exercise, weight, reps, createdAt: `${date}T07:00:00Z` });

describe('the day’s sets', () => {
  it('groups by exercise in the order first logged, whatever the case', () => {
    const g = groupsOf([set('a', 'd', 'Squat', 135, 8), set('b', 'd', 'Bench', 95, 10), set('c', 'd', 'squat', 145, 6)]);
    expect(g.map((x) => [x.exercise, x.sets.length])).toEqual([
      ['Squat', 2],
      ['Bench', 1],
    ]);
  });
});

describe('last time', () => {
  const all = [set('1', '2026-10-25', 'Squat', 125, 8), set('2', '2026-11-01', 'Squat', 135, 8), set('3', '2026-11-01', 'Squat', 145, 6), set('4', '2026-11-08', 'Squat', 150, 5)];
  it('is the last day before this one, all of its sets', () => {
    expect(lastSession(all, 'squat', '2026-11-08').map((s) => s.id)).toEqual(['2', '3']);
    expect(lastSession(all, 'Deadlift', '2026-11-08')).toEqual([]);
    expect(lastSession(all, '', '2026-11-08')).toEqual([]);
  });
  it('hints the set at the same place, else the last one', () => {
    const prev = lastSession(all, 'Squat', '2026-11-08');
    expect(setText(hintFor(prev, 0)!)).toBe('135 × 8');
    expect(setText(hintFor(prev, 1)!)).toBe('145 × 6');
    expect(setText(hintFor(prev, 4)!)).toBe('145 × 6');
    expect(hintFor([], 0)).toBeNull();
  });
});

describe('the number pad', () => {
  const w = { fresh: false, decimals: true };
  it('types digits, one point and one decimal on weight', () => {
    expect(pressKey('13', '5', w)).toBe('135');
    expect(pressKey('135', '.', w)).toBe('135.');
    expect(pressKey('135.', '5', w)).toBe('135.5');
    expect(pressKey('135.5', '5', w)).toBe('135.5');
    expect(pressKey('', '.', w)).toBe('0.');
    expect(pressKey('0', '7', w)).toBe('7');
    expect(pressKey('1000', '1', w)).toBe('1000');
  });
  it('replaces a freshly picked field, and backspaces', () => {
    expect(pressKey('135', '9', { fresh: true, decimals: true })).toBe('9');
    expect(pressKey('135', 'back', w)).toBe('13');
    expect(pressKey('135', 'back', { fresh: true, decimals: true })).toBe('');
  });
  it('keeps reps whole', () => {
    expect(pressKey('8', '.', { fresh: false, decimals: false })).toBe('8');
  });
  it('steps weight on the 5 lb grid and reps by one', () => {
    expect(stepValue('135', 'w', 1)).toBe('140');
    expect(stepValue('137.5', 'w', 1)).toBe('140');
    expect(stepValue('137.5', 'w', -1)).toBe('135');
    expect(stepValue('0', 'w', -1)).toBe('0');
    expect(stepValue('8', 'r', 1)).toBe('9');
    expect(stepValue('1', 'r', -1)).toBe('1');
    expect(stepValue('', 'r', 1)).toBe('1');
  });
  it('adds once there is a name, a weight and reps', () => {
    expect(canAdd('Squat', '135', '8')).toBe(true);
    expect(canAdd('Push-up', '0', '20')).toBe(true);
    expect(canAdd('', '135', '8')).toBe(false);
    expect(canAdd('Squat', '', '8')).toBe(false);
    expect(canAdd('Squat', '135', '0')).toBe(false);
  });
});
