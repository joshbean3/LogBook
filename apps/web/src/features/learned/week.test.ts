import { describe, expect, it } from 'vitest';
import { bandWords, lastSeven, learnedWeek, lightsLabel, ordinal } from './week';

const today = '2026-11-12'; // a Thursday
const week = (...lit: string[]) => learnedWeek(today, new Set(lit));

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
