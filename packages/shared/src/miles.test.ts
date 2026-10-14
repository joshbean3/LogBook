import { describe, expect, it } from 'vitest';
import { shiftDays } from './dates.js';
import { act, sess, snapOf } from './fixtures.js';
import { dayMiles, DEFAULT_EASY_PACE, ranMiles, sessionMiles } from './miles.js';
import { buildMorning, morningDayFor, NEW_ACCOUNT_MORNING, normalizeMorningSettings, afterLabel, MORNING_DEFAULTS } from './morning.js';
import { weekTotals } from './status.js';
import { weekCheck, weekSummary } from './week.js';

const MON = '2026-10-12';
const TODAY = '2026-10-14';
const easy4 = sess({ id: 'e4', date: MON, kind: 'run', type: 'Easy', miles: 4 });

describe('sessionMiles (contract 5: miles without Strava)', () => {
  it('a run marked Done with no activity counts its planned miles', () => {
    const s = { ...easy4, mark: 'done' as const };
    expect(sessionMiles(snapOf([s], [], TODAY), MON, s)).toEqual({ miles: 4, source: 'planned' });
  });

  it('a run marked Floor counts the floor minutes at the easy pace, capped at the plan', () => {
    const s = { ...easy4, mark: 'floor' as const };
    // 20 min easy at the default 9:00/mi = 2.22 mi
    expect(sessionMiles(snapOf([s], [], TODAY), MON, s)).toEqual({ miles: 2.22, source: 'floor' });
    // the athlete's pace from the snapshot (8:00/mi = 2.5 mi), or passed in
    expect(sessionMiles({ ...snapOf([s], [], TODAY), easyPace: 480 }, MON, s)).toEqual({ miles: 2.5, source: 'floor' });
    expect(sessionMiles(snapOf([s], [], TODAY), MON, s, { pace: 600 })).toEqual({ miles: 2, source: 'floor' });
    // a long run's floor is 30 min; a 2-mile plan caps it
    const long = sess({ id: 'l', date: MON, kind: 'run', type: 'Long', miles: 10, mark: 'floor' });
    expect(sessionMiles(snapOf([long], [], TODAY), MON, long).miles).toBeCloseTo((30 * 60) / DEFAULT_EASY_PACE, 2);
    const short = sess({ id: 'sh', date: MON, kind: 'run', type: 'Easy', miles: 2, mark: 'floor' });
    expect(sessionMiles(snapOf([short], [], TODAY), MON, short, { pace: 480 })).toEqual({ miles: 2, source: 'floor' });
  });

  it('a matched activity wins over the mark', () => {
    const s = { ...easy4, mark: 'done' as const };
    expect(sessionMiles(snapOf([s], [act(MON, 4.3)], TODAY), MON, s)).toEqual({ miles: 4.3, source: 'activity' });
  });

  it('activities match runs in order; the last run takes any extras; an unmatched run falls back to its mark', () => {
    const a = sess({ id: 'a', date: MON, kind: 'run', type: 'Easy', miles: 3, position: 0 });
    const b = sess({ id: 'b', date: MON, kind: 'run', type: 'Easy', miles: 5, position: 1, mark: 'done' });
    const one = snapOf([a, b], [act(MON, 3.1, { time: '06:00' })], TODAY);
    expect(sessionMiles(one, MON, a)).toEqual({ miles: 3.1, source: 'activity' });
    expect(sessionMiles(one, MON, b)).toEqual({ miles: 5, source: 'planned' });
    expect(dayMiles(one, MON)).toEqual({ miles: 8.1, tracked: 3.1, logged: 5 });
    const three = snapOf([a, b], [act(MON, 3, { time: '06:00', id: 'x1' }), act(MON, 2, { time: '17:00', id: 'x2' }), act(MON, 2.5, { time: '18:00', id: 'x3' })], TODAY);
    expect(sessionMiles(three, MON, b)).toEqual({ miles: 4.5, source: 'activity' });
  });

  it('nothing for rest, lifts, skipped runs, unmarked runs and no session', () => {
    const snap = snapOf([easy4], [], TODAY);
    expect(sessionMiles(snap, MON, easy4)).toEqual({ miles: 0, source: 'none' });
    expect(sessionMiles(snap, MON, { ...easy4, mark: 'skip' })).toEqual({ miles: 0, source: 'none' });
    expect(sessionMiles(snap, MON, { ...easy4, mark: 'sick' })).toEqual({ miles: 0, source: 'none' });
    expect(sessionMiles(snap, MON, sess({ date: MON, kind: 'lift', mark: 'done' }))).toEqual({ miles: 0, source: 'none' });
    expect(sessionMiles(snap, MON, null)).toEqual({ miles: 0, source: 'none' });
  });

  it('a run planned by minutes marked Done counts the minutes at the easy pace', () => {
    const s = sess({ id: 'm', date: MON, kind: 'run', type: 'Easy', minutes: 45, mark: 'done' });
    expect(sessionMiles(snapOf([s], [], TODAY), MON, s)).toEqual({ miles: 5, source: 'planned' });
  });

  it('the week math counts logged runs: weekCheck, weekSummary, weekTotals, ranMiles', () => {
    const sessions = [
      { ...easy4, mark: 'done' as const },
      sess({ id: 'w', date: shiftDays(MON, 2), kind: 'run', type: 'Easy', miles: 5 }),
      sess({ id: 'f', date: shiftDays(MON, 4), kind: 'run', type: 'Tempo', miles: 6, mark: 'floor' }),
    ];
    const snap = snapOf(sessions, [act(shiftDays(MON, 2), 5.2)], '2026-10-19');
    const check = weekCheck(snap, MON);
    expect(check.ranMiles).toBeCloseTo(4 + 5.2 + 2.22, 2);
    expect(check.loggedMiles).toBeCloseTo(6.22, 2);
    expect(check).toMatchObject({ kept: true, keptSessions: 3, plannedMiles: 15 });
    expect(weekSummary(snap, MON).doneMiles).toBeCloseTo(11.42, 2);
    expect(weekTotals(snap, MON).ran).toBeCloseTo(11.42, 2);
    expect(ranMiles(snap, MON, shiftDays(MON, 6))).toBeCloseTo(11.42, 2);
    expect(ranMiles(snap, MON)).toBe(4);
  });

  it('a fresh account that taps Done on Easy 4 has 4 miles for the day and the week (critic B3)', () => {
    const s = sess({ id: 'x', date: TODAY, kind: 'run', type: 'Easy', miles: 4, mark: 'done' });
    const snap = snapOf([s], [], TODAY);
    expect(dayMiles(snap, TODAY).miles).toBe(4);
    expect(weekSummary(snap, TODAY)).toMatchObject({ ranMiles: 4, doneMiles: 4, loggedMiles: 4, runsDone: 1 });
  });
});

describe('new-account morning (contract 7)', () => {
  it('is "Get ready 30 · Out the door 10", no smoothie, no shower, leaving 9:30', () => {
    const st = normalizeMorningSettings(NEW_ACCOUNT_MORNING);
    expect(st.after).toMatchObject({ shower: 0, ready: 30, smoothie: 0, prep: 10, names: { prep: 'Out the door' } });
    const t = buildMorning(morningDayFor([], null, st), st);
    const after = t.blocks.filter((b) => ['shower', 'ready', 'smoothie', 'prep'].includes(b.key));
    expect(after.map((b) => [b.label, b.mins])).toEqual([
      ['Get ready', 30],
      ['Out the door', 10],
    ]);
    expect(t.leave).toBe(570);
    expect(t.blocks.some((b) => /smoothie/i.test(b.label))).toBe(false);
  });

  it('the old defaults and stored routines keep their names', () => {
    expect(afterLabel(MORNING_DEFAULTS, 'prep')).toBe('Final prep');
    expect(afterLabel(MORNING_DEFAULTS, 'smoothie')).toBe('Blend smoothie');
    const st = normalizeMorningSettings({ after: { names: { ready: '  Dress  ', prep: '', bogus: 'x' } } });
    expect(st.after.names).toEqual({ ready: 'Dress' });
    expect(normalizeMorningSettings({}).after.names).toBeUndefined();
  });
});
