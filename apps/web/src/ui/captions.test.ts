import { describe, expect, it } from 'vitest';
import { capsWord, dayCaption, dayTitle, monthCaption, shorten, weekCaption } from './captions';

/** docs/feel.md §2.2–2.3 (contracts §B.2): the bar's words, from the date alone. Every date is relative to Fri 2026-10-23. */
const T = '2026-10-23';

describe('the caps line', () => {
  it('dayCaption: full, short, day', () => {
    expect(dayCaption(T, T)).toBe('FRI, OCT 23');
    expect(dayCaption('2026-10-29', T, 'full')).toBe('THU, OCT 29');
    expect(dayCaption('2026-10-29', T, 'short')).toBe('OCT 29');
    expect(dayCaption('2026-10-29', T, 'day')).toBe('29');
    expect(dayCaption('2026-11-02', T)).toBe('MON, NOV 2');
  });
  it('capsWord: upper-cased, at most 12 characters, a longer legacy word clipped with …, null when empty', () => {
    expect(capsWord('Steady')).toBe('STEADY');
    expect(capsWord('relentlessly')).toBe('RELENTLESSLY');
    const clipped = capsWord('unconditionally-calm');
    expect(clipped).toBe('UNCONDITION…');
    expect(clipped).toHaveLength(12);
    expect(capsWord('  ')).toBeNull();
    expect(capsWord(null)).toBeNull();
  });
  it('weekCaption: this, next, last, or the range', () => {
    expect(weekCaption('2026-10-19', T)).toBe('THIS WEEK · OCT 19–25');
    expect(weekCaption('2026-10-26', T)).toBe('NEXT WEEK · OCT 26–NOV 1');
    expect(weekCaption('2026-10-12', T)).toBe('LAST WEEK · OCT 12–18');
    expect(weekCaption('2026-10-05', T)).toBe('OCT 5–11');
  });
  it('monthCaption', () => {
    expect(monthCaption('2026-10-01')).toBe('OCTOBER 2026');
  });
  it('shorten: the date part steps down, the word is never part of it', () => {
    expect(shorten('THU, OCT 29', 'short')).toBe('OCT 29');
    expect(shorten('THU, OCT 29', 'day')).toBe('29');
    expect(shorten('NEXT WEEK · OCT 26–NOV 1', 'short')).toBe('OCT 26–NOV 1');
    expect(shorten('FRI, OCT 23', 'full')).toBe('FRI, OCT 23');
  });
});

describe('the title, fixed from the route', () => {
  it.each([
    [T, 'Today'],
    ['2026-10-24', 'Tomorrow'],
    ['2026-10-22', 'Yesterday'],
    ['2026-10-24', 'Tomorrow'],
    ['2026-10-29', 'Thu 29'],
    ['2026-10-17', 'Sat 17'],
    ['2026-10-11', 'Sun, Oct 11'],
    ['2026-11-02', 'Mon, Nov 2'],
    ['2025-10-11', 'Sat, Oct 11, 2025'],
  ])('%s → %s', (d, want) => expect(dayTitle(d, T)).toBe(want));
});
