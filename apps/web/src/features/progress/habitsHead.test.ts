import { describe, expect, it } from 'vitest';
import { HABIT_RANGE, HABIT_SPAN, habitsAt, habitsHead, habitsHeadWords, habitsSeries } from './habitsHead';

const dates = ['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12'];

describe('the habits chart at the top of History', () => {
  it('draws nothing before any habit has been tapped: no card, never an empty frame', () => {
    expect(habitsHead({ hasData: false, value: null, line: [null, null], dates: dates.slice(0, 2), avg: null }, '1M')).toBeNull();
    // marked as having data, but with no value anywhere: still nothing
    expect(habitsHead({ hasData: true, value: null, line: [null, null], dates: dates.slice(0, 2), avg: null }, '1M')).toBeNull();
  });

  it('says the latest 7-day share, and the average over the range', () => {
    const m = { hasData: true, value: 61.6, line: [40, 50, 55, 60, 61.6], dates, avg: 53.3 };
    expect(habitsHead(m, '1M')).toEqual({ big: '62%', context: 'of habits done, last 7 days', take: '53% on average over 30 days' });
    expect(habitsHead(m, '3M')!.take).toBe('53% on average over 3 months');
    expect(habitsHead(m, '12M')!.take).toBe('53% on average over 12 months');
  });

  it('falls back to the last day with a value when today has none yet', () => {
    expect(habitsHead({ hasData: true, value: null, line: [40, 50, null, null, null], dates, avg: 45 }, '1M')!.big).toBe('50%');
  });

  it('starts where the habits do when they are younger than the range, and says so', () => {
    const m = { hasData: true, value: 5, line: [null, null, 14, 9, 5], dates, avg: 9.3 };
    expect(habitsSeries(m)).toEqual({ line: [14, 9, 5], dates: ['2026-11-10', '2026-11-11', '2026-11-12'], since: '2026-11-10' });
    expect(habitsHead(m, '1M')!.take).toBe('9% on average since Nov 10');
    // a full range is drawn whole, gaps in the middle included
    const whole = { line: [40, null, 55, 60, 62], dates };
    expect(habitsSeries(whole)).toEqual({ ...whole, since: null });
  });

  it('reads a day under the finger: that day’s share and the day; a day with nothing says so in words', () => {
    const m = { line: [40, null, 55], dates: dates.slice(0, 3) };
    expect(habitsAt(m, 0)).toEqual({ big: '40%', context: 'of habits done', take: '7 days to Sun, Nov 8' });
    expect(habitsAt(m, 1)).toEqual({ big: 'None', context: 'counted yet', take: 'Mon, Nov 9' });
  });

  it('opens on the 30 days the rows under it show, with a range in words for each key', () => {
    expect(HABIT_RANGE).toBe('1M');
    expect(Object.keys(HABIT_SPAN)).toEqual(['1M', '3M', '6M', '12M']);
  });

  it('is plain copy for VoiceOver, with no dash', () => {
    const w = habitsHeadWords(habitsHead({ hasData: true, value: 62, line: [62], dates: ['2026-11-12'], avg: 53 }, '1M')!);
    expect(w).toBe('62% of habits done, last 7 days. 53% on average over 30 days.');
    expect(w).not.toMatch(/[—–]/);
  });
});
