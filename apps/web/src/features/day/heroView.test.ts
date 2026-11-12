import { describe, expect, it } from 'vitest';
import { heroViewOf, parseHeroView, setHeroView } from './heroView';

describe('heroView: Runs or Workouts, one choice for the day (hero spec 6.3)', () => {
  it('is one choice: a pick on any page is the pick on every page, the chart included', () => {
    setHeroView('2026-11-11', '2026-11-11', 'workouts');
    expect(heroViewOf('2026-11-11', '2026-11-11')).toBe('workouts');
    // tomorrow's page, next week's card and the chart (which asks with today's date) read the same value
    expect(heroViewOf('2026-11-11', '2026-11-12')).toBe('workouts');
    expect(heroViewOf('2026-11-11', '2026-11-16')).toBe('workouts');
    expect(heroViewOf('2026-11-11')).toBe('workouts');
    // changed from another page (or the chart): every page follows
    setHeroView('2026-11-11', '2026-11-16', 'runs');
    expect(heroViewOf('2026-11-11', '2026-11-11')).toBe('runs');
    expect(heroViewOf('2026-11-11')).toBe('runs');
  });

  it('holds for the calendar day only: the next day every page opens on its own default', () => {
    setHeroView('2026-11-11', '2026-11-11', 'workouts');
    expect(heroViewOf('2026-11-12', '2026-11-11')).toBeNull();
    expect(heroViewOf('2026-11-12')).toBeNull();
    setHeroView('2026-11-12', '2026-11-12', 'workouts');
    expect(heroViewOf('2026-11-12', '2026-11-11')).toBe('workouts');
    expect(heroViewOf('2026-11-11')).toBeNull();
  });

  it('reads what is stored, and nothing that is not a choice', () => {
    expect(parseHeroView({ on: '2026-11-11', view: 'runs' })).toEqual({ on: '2026-11-11', view: 'runs' });
    expect(parseHeroView({ on: '2026-11-11', view: 'lifts' })).toBeNull();
    expect(parseHeroView({ view: 'runs' })).toBeNull();
    expect(parseHeroView(null)).toBeNull();
    expect(parseHeroView('runs')).toBeNull();
    expect(parseHeroView([])).toBeNull();
  });

  it('reads the value from before the one switch: the pick made on that day’s own page', () => {
    expect(parseHeroView({ on: '2026-11-11', picks: { '2026-11-11': 'workouts', '2026-11-12': 'runs' } })).toEqual({ on: '2026-11-11', view: 'workouts' });
    // a pick on another page only: no choice for the day
    expect(parseHeroView({ on: '2026-11-11', picks: { '2026-11-12': 'runs' } })).toBeNull();
    expect(parseHeroView({ on: '2026-11-11', picks: { '2026-11-11': 'swims' } })).toBeNull();
  });
});
