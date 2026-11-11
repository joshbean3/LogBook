import { describe, expect, it } from 'vitest';
import { lastSeven, streakWords } from './Streak';

const today = '2026-11-11'; // a Wednesday

describe('the streak tracker', () => {
  it('shows six days ago on the left to today on the right', () => {
    expect(lastSeven(today)).toEqual(['2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11']);
    // across a month: the first of December reaches back into November
    expect(lastSeven('2026-12-01')[0]).toBe('2026-11-25');
  });

  it('reads as one label: the count, the days lit by name, and today', () => {
    expect(streakWords(4, new Set(['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11']), today)).toBe('4 days in a row. Learned on Sunday, Monday, Tuesday, and today.');
    expect(streakWords(1, new Set(['2026-11-11']), today)).toBe('1 day in a row. Learned today.');
  });

  it('says "Not yet today" while today is unlit, and keeps a lit day inside a broken run', () => {
    expect(streakWords(3, new Set(['2026-11-06', '2026-11-08', '2026-11-09', '2026-11-10']), today)).toBe('3 days in a row. Not yet today. Learned on Friday, Sunday, Monday, and Tuesday.');
  });

  it('is calm at zero', () => {
    expect(streakWords(0, new Set(), today)).toBe('Start a streak today. Nothing learned in the last 7 days.');
    expect(streakWords(0, new Set(['2026-11-08']), today)).toBe('Start a streak today. Learned on Sunday.');
  });
});
