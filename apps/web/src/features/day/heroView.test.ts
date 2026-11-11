import { describe, expect, it } from 'vitest';
import { heroViewOf, setHeroView } from './heroView';

describe('heroView (hero spec 6.3)', () => {
  it('keeps a pick for its page for the rest of the day, and drops every pick the next day', () => {
    setHeroView('2026-11-11', '2026-11-11', 'workouts');
    setHeroView('2026-11-11', '2026-11-12', 'runs');
    expect(heroViewOf('2026-11-11', '2026-11-11')).toBe('workouts');
    expect(heroViewOf('2026-11-11', '2026-11-12')).toBe('runs');
    expect(heroViewOf('2026-11-11', '2026-11-13')).toBeNull();
    expect(heroViewOf('2026-11-12', '2026-11-11')).toBeNull();
    setHeroView('2026-11-12', '2026-11-12', 'workouts');
    expect(heroViewOf('2026-11-12', '2026-11-11')).toBeNull();
    expect(heroViewOf('2026-11-12', '2026-11-12')).toBe('workouts');
  });
});
