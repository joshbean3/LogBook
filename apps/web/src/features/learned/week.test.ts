import { describe, expect, it } from 'vitest';
import { bandWords, lastSeven, learnedWeek, lightsLabel, ordinal } from './week';

const today = '2026-11-12'; // a Thursday
/** A line on each day named; name a day twice for two lines. */
const week = (...days: string[]) => {
  const lines = new Map<string, number>();
  for (const d of days) lines.set(d, (lines.get(d) ?? 0) + 1);
  return learnedWeek(today, lines);
};

describe('the week’s lights', () => {
  it('shows six days ago on the left to tonight on the right', () => {
    expect(lastSeven(today)).toEqual(['2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12']);
    // across a month: the first of December reaches back into November
    expect(lastSeven('2026-12-01')[0]).toBe('2026-11-25');
    expect(week().days.map((d) => d.letter).join('')).toBe('FSSMTW');
  });

  it('counts lines kept, a light each, and a missed day is only an unlit light', () => {
    const w = week('2026-11-09', '2026-11-11');
    expect(w.days.map((d) => d.lit)).toEqual([false, false, false, true, false, true]);
    expect(w).toMatchObject({ before: 2, tonight: false, kept: 2 });
    expect(week('2026-11-09', '2026-11-11', today)).toMatchObject({ before: 2, tonight: true, kept: 3 });
    // a day outside the seven is not in this week
    expect(week('2026-11-05').kept).toBe(0);
  });

  it('counts every line, and lights a day once however many lines it holds', () => {
    const w = week('2026-11-09', '2026-11-09', '2026-11-11');
    expect(w).toMatchObject({ before: 2, tonight: false, kept: 3 });
    // three lines kept on two days: tonight's is still the third light
    expect(bandWords(w, true)).toEqual({ label: 'This week · 3 lines kept', words: 'Tonight’s line lights the third' });
    expect(bandWords(week('2026-11-09', '2026-11-11', today, today), true)).toEqual({ label: 'This week', words: '4 lines kept' });
  });

  it('says which light tonight’s line would be', () => {
    expect(bandWords(week('2026-11-09', '2026-11-11'), true)).toEqual({ label: 'This week · 2 lines kept', words: 'Tonight’s line lights the third' });
    expect(bandWords(week('2026-11-11'), true)).toEqual({ label: 'This week · 1 line kept', words: 'Tonight’s line lights the second' });
    expect(bandWords(week('2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11'), true).words).toBe('Tonight’s line lights the seventh');
    expect(ordinal(4)).toBe('fourth');
  });

  it('invites the first line when none is kept yet', () => {
    expect(bandWords(week(), false)).toEqual({ label: 'This week', words: 'Your first line lights tonight' });
    expect(bandWords(week(), true)).toEqual({ label: 'This week', words: 'Tonight’s line lights the first' });
  });

  it('counts up once tonight’s line is kept', () => {
    expect(bandWords(week('2026-11-09', '2026-11-11', today), true)).toEqual({ label: 'This week', words: '3 lines kept' });
    expect(bandWords(week(today), false)).toEqual({ label: 'This week', words: '1 line kept' });
  });

  it('reads as one label, with no run of days in it', () => {
    expect(lightsLabel(week('2026-11-09', '2026-11-11'))).toBe('2 lines kept this week, on Monday and Wednesday. Tonight’s line is not written yet.');
    expect(lightsLabel(week('2026-11-09', '2026-11-11', today))).toBe('3 lines kept this week, on Monday and Wednesday. Tonight’s line is kept.');
    expect(lightsLabel(week(today))).toBe('1 line kept this week. Tonight’s line is kept.');
    expect(lightsLabel(week())).toBe('No lines kept this week yet. Tonight’s line is not written yet.');
    for (const w of [week(), week('2026-11-11'), week('2026-11-10', '2026-11-11', today)]) expect(`${lightsLabel(w)} ${bandWords(w, true).label} ${bandWords(w, true).words}`).not.toMatch(/in a row|streak/i);
  });
});

describe('the week at the edges of the calendar', () => {
  const on = (day: string, ...days: string[]) => {
    const lines = new Map<string, number>();
    for (const d of days) lines.set(d, (lines.get(d) ?? 0) + 1);
    return learnedWeek(day, lines);
  };

  it('crosses a month and a year without losing a day', () => {
    expect(lastSeven('2027-01-02')).toEqual(['2026-12-27', '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
    const w = on('2027-01-02', '2026-12-31', '2027-01-01', '2026-12-26');
    expect(w.days.map((d) => d.lit)).toEqual([false, false, false, false, true, true]);
    expect(w.kept).toBe(2);
    expect(lastSeven('2028-03-02')).toContain('2028-02-29');
    expect(lastSeven('2027-03-02')).not.toContain('2027-02-29');
  });

  it('has seven different days on the weeks the clocks change (March and November)', () => {
    for (const day of ['2026-03-08', '2026-03-09', '2026-03-14', '2026-11-01', '2026-11-02', '2026-11-07', '2026-03-29', '2026-10-25']) {
      const seven = lastSeven(day);
      expect(new Set(seven).size).toBe(7);
      expect(seven[6]).toBe(day);
      // each day is the one after the last
      for (let i = 1; i < 7; i++) expect(Date.parse(`${seven[i]}T12:00:00Z`) - Date.parse(`${seven[i - 1]}T12:00:00Z`)).toBe(86_400_000);
      expect(on(day).days.map((d) => d.letter)).toHaveLength(6);
    }
    expect(on('2026-03-08').days.map((d) => d.letter).join('')).toBe('MTWTFS');
    expect(on('2026-11-01').days.map((d) => d.letter).join('')).toBe('MTWTFS');
  });

  it('seven of seven: every light lit, and the band counts lines', () => {
    const all = lastSeven(today);
    const w = on(today, ...all);
    expect(w).toMatchObject({ before: 6, tonight: true, kept: 7 });
    expect(bandWords(w, true)).toEqual({ label: 'This week', words: '7 lines kept' });
    expect(lightsLabel(w)).toBe('7 lines kept this week, on Friday, Saturday, Sunday, Monday, Tuesday, and Wednesday. Tonight’s line is kept.');
  });

  it('eight or more lines in a week: the count goes on, the ordinal stays with the lights', () => {
    // two lines a day on the six days before tonight: twelve lines, six lights
    const six = lastSeven(today).slice(0, 6);
    const w = on(today, ...six, ...six);
    expect(w).toMatchObject({ before: 6, kept: 12 });
    expect(bandWords(w, true)).toEqual({ label: 'This week · 12 lines kept', words: 'Tonight’s line lights the seventh' });
    // nine lines on one day: one light, and tonight's is the second
    const nine = on(today, ...Array.from({ length: 9 }, () => '2026-11-11'));
    expect(bandWords(nine, true)).toEqual({ label: 'This week · 9 lines kept', words: 'Tonight’s line lights the second' });
    expect(bandWords(on(today, ...Array.from({ length: 9 }, () => today)), true)).toEqual({ label: 'This week', words: '9 lines kept' });
  });

  it('every count has its word, and a count out of range never prints "undefined"', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(ordinal)).toEqual(['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh']);
    for (const n of [0, -3, 8, 99, Number.NaN, Number.POSITIVE_INFINITY, 2.5]) expect(['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh']).toContain(ordinal(n));
  });

  it('lines only in past years, or dated after today (a phone that went back a time zone), light nothing', () => {
    const w = on(today, '2025-11-12', '2024-11-11', '2026-11-13', '2026-11-14');
    expect(w).toMatchObject({ before: 0, tonight: false, kept: 0 });
    expect(bandWords(w, true).words).toBe('Tonight’s line lights the first');
  });

  it('a count that is not a number lights nothing and adds nothing', () => {
    const w = learnedWeek(today, new Map<string, number>([['2026-11-11', Number.NaN], ['2026-11-10', -2], ['2026-11-09', 1]]));
    expect(w).toMatchObject({ before: 1, kept: 1 });
  });
});
