import { shiftDays, type ISODate } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { defaultRaceDay, raceSundays, raceWarning, weeksUntil } from './model';

// a Wednesday: the block starts the day after sign-up
const start = '2026-11-11' as ISODate;
const sundays = raceSundays(start);
const at = (weeks: number) => sundays.find((d) => weeksUntil(start, d) === weeks)!;

describe('a race day too close for the distance', () => {
  it('says nothing with no race, or no date yet', () => {
    expect(raceWarning({ goal: 'base', raceDate: null }, start)).toBeNull();
    expect(raceWarning({ goal: 'marathon', raceDate: null }, start)).toBeNull();
  });
  it('warns for a marathon five weeks out, in plain words, and offers the usual date', () => {
    const w = raceWarning({ goal: 'marathon', raceDate: at(5) }, start)!;
    expect(w.text).toBe('A marathon needs about 16 weeks. This race is 5 weeks away.');
    expect(w.later).toBe(defaultRaceDay('marathon', start));
    expect(weeksUntil(start, w.later)).toBeGreaterThanOrEqual(15);
    // the way out is itself far enough: taking it clears the warning
    expect(raceWarning({ goal: 'marathon', raceDate: w.later }, start)).toBeNull();
  });
  it('each distance has its own line', () => {
    expect(raceWarning({ goal: 'half', raceDate: at(6) }, start)?.text).toBe('A half marathon needs about 12 weeks. This race is 6 weeks away.');
    expect(raceWarning({ goal: '10k', raceDate: at(5) }, start)?.text).toBe('A 10K needs about 10 weeks. This race is 5 weeks away.');
    expect(raceWarning({ goal: '5k', raceDate: at(5) }, start)?.text).toBe('A 5K needs about 8 weeks. This race is 5 weeks away.');
  });
  it('is quiet from a little under the usual length up', () => {
    expect(raceWarning({ goal: 'marathon', raceDate: at(13) }, start)).not.toBeNull();
    expect(raceWarning({ goal: 'marathon', raceDate: at(14) }, start)).toBeNull();
    expect(raceWarning({ goal: 'half', raceDate: at(10) }, start)).toBeNull();
    expect(raceWarning({ goal: '5k', raceDate: at(6) }, start)).toBeNull();
    for (const goal of ['5k', '10k', 'half', 'marathon'] as const) expect(raceWarning({ goal, raceDate: defaultRaceDay(goal, start) }, start)).toBeNull();
  });
  it('holds for any day the block can start on', () => {
    for (let i = 0; i < 7; i++) {
      const s = shiftDays(start, i);
      const first = raceSundays(s)[0]!;
      expect(raceWarning({ goal: 'marathon', raceDate: first }, s)?.text).toMatch(/^A marathon needs about 16 weeks\. This race is \d weeks away\.$/);
    }
  });
});
