import { describe, expect, it } from 'vitest';
import { blockLine, buildSteps, DEFAULT_PROFILE, minsText, morningFix, previewMorning, ROUTINE_CHIPS, routineSettings, TRACK_FROM, verdictLine } from './model';

const subsets = <T,>(xs: readonly T[]): T[][] => xs.reduce<T[][]>((acc, x) => [...acc, ...acc.map((a) => [...a, x])], [[]]);

describe('morningFix (onboarding-10)', () => {
  it('clears a tight morning in one tap for wake 10:00, leave 11:00 with every set of chips', () => {
    for (const chips of subsets(ROUTINE_CHIPS.map((c) => c.id))) {
      const st = routineSettings(chips);
      const before = previewMorning(600, 660, undefined, st);
      const fix = morningFix(600, 660, st);
      if (before.late <= 0) {
        expect(fix).toBeNull();
        continue;
      }
      expect(fix, chips.join('+')).not.toBeNull();
      expect(previewMorning(fix!.wake, fix!.leave, undefined, st).late, chips.join('+')).toBeLessThanOrEqual(0);
      expect(fix!.wake % 5).toBe(0);
      expect(fix!.wake).toBeGreaterThanOrEqual(TRACK_FROM);
    }
  });
  it('picks the latest wake time that fits', () => {
    const st = routineSettings(['shower', 'breakfast', 'bag', 'coffee']);
    const fix = morningFix(600, 660, st)!;
    expect(previewMorning(fix.wake + 5, fix.leave, undefined, st).late).toBeGreaterThan(0);
  });
  it('returns null when the morning already fits', () => {
    expect(morningFix(390, 510, routineSettings([]))).toBeNull();
  });
});

describe('copy (onboarding-15)', () => {
  it('says the verdict in plain words', () => {
    expect(verdictLine({ late: 61, back: 0, spare: 0 })).toBe('Tight. A 4 mile easy run ends 61 min after you need to start getting ready.');
    expect(verdictLine({ late: 0, back: 451, spare: 324 })).toBe('A 4 mile easy run has you back by 7:31, with 5 h 24 min to spare.');
    expect(verdictLine({ late: 0, back: 451, spare: 24 })).toBe('A 4 mile easy run has you back by 7:31, with 24 min to spare.');
  });
  it('formats long spans in hours', () => {
    expect(minsText(90)).toBe('90 min');
    expect(minsText(120)).toBe('2 h');
    expect(minsText(324)).toBe('5 h 24 min');
  });
  it('capitalizes the flat range', () => {
    expect(blockLine({ weeks: 16, peak: 80, from: 80, taperWeeks: 0, raceDate: null, bars: [] })).toBe('16 weeks. About 80 mi a week.');
  });
  it('counts habits once, as habits (onboarding-22)', () => {
    expect(buildSteps(DEFAULT_PROFILE, null, 390, 510, 2).at(-1)).toBe('Adding 2 habits to Today');
    expect(buildSteps(null, null, 390, 510, 1)).toContain('Adding 1 habit to Today');
  });
});
