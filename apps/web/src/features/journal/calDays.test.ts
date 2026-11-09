import { describe, expect, it } from 'vitest';
import { anchorFor, dayLabel, dayTitle, monthGrid, orbVariant, pageBy, pageHolds, pageTitle, switchAnchor, weekDays } from './calDays';

const TODAY = '2026-11-09'; // a Monday

describe('the journal calendar', () => {
  it('picks an orb palette from the count, a starred memory first', () => {
    expect(orbVariant(undefined)).toBeNull();
    expect(orbVariant([])).toBeNull();
    expect(orbVariant([{ fav: false }])).toBe('sky');
    expect(orbVariant([{ fav: false }, { fav: false }])).toBe('dusk');
    expect(orbVariant([{ fav: false }, { fav: false }, { fav: false }])).toBe('tide');
    expect(orbVariant(Array.from({ length: 6 }, () => ({ fav: false })))).toBe('tide');
    expect(orbVariant([{ fav: false }, { fav: true }])).toBe('sun');
  });

  it('shows a week as the seven days ending on its anchor', () => {
    expect(weekDays(TODAY)).toEqual(['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09']);
    expect(pageTitle(TODAY, 'week')).toBe('Nov 3 to 9');
    expect(pageTitle('2026-11-02', 'week')).toBe('Oct 27 to Nov 2');
    expect(pageBy(TODAY, 'week', -1)).toBe('2026-11-02');
    expect(pageHolds(TODAY, 'week', '2026-11-03')).toBe(true);
    expect(pageHolds(TODAY, 'week', '2026-11-02')).toBe(false);
  });

  it('lays a month out in Monday-first rows of seven', () => {
    const g = monthGrid('2026-11-20');
    expect(g.length % 7).toBe(0);
    // November 2026 starts on a Sunday: six blanks, then the 1st
    expect(g.slice(0, 7)).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(g.filter(Boolean)).toHaveLength(30);
    expect(pageTitle('2026-11-20', 'month')).toBe('November 2026');
    expect(pageBy('2026-11-20', 'month', -1)).toBe('2026-10-01');
  });

  it('keeps today, else the open day, on the page when the view changes', () => {
    expect(switchAnchor('2026-11-01', 'month', 'week', TODAY, null)).toBe(TODAY);
    expect(switchAnchor('2026-10-01', 'month', 'week', TODAY, '2026-10-20')).toBe('2026-10-23');
    expect(switchAnchor('2026-10-01', 'month', 'week', TODAY, null)).toBe('2026-10-31');
    expect(switchAnchor('2026-10-20', 'week', 'month', TODAY, null)).toBe('2026-10-20');
    // a day near today sits on a week that ends today
    expect(anchorFor('2026-11-07', 'week', TODAY)).toBe(TODAY);
  });

  it('names a day for VoiceOver and for the day card', () => {
    expect(dayLabel(TODAY, 2)).toBe('Monday, November 9, 2 memories');
    expect(dayLabel('2026-11-08', 1)).toBe('Sunday, November 8, 1 memory');
    expect(dayTitle(TODAY, TODAY)).toBe('Today');
    expect(dayTitle('2026-11-08', TODAY)).toBe('Yesterday');
    expect(dayTitle('2026-11-02', TODAY)).toBe('Monday, November 2');
  });
});
