import type { Activity, Session } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { wholeMonth } from './monthShape';
import { buildSnapshot } from './snapshot';
import type { MonthBundle } from './types';

/**
 * A month is read in many places as if it were whole: `bundle.sessions.filter`, `session.title.toLowerCase()`. One that is
 * not (an older server that does not send a list this app reads, a copy kept on the phone by an earlier build, a row with a
 * field of the wrong kind) took the whole screen down: Fitness, Today and Progress all read the same month. `wholeMonth`
 * is the one place a month is made safe to read, at the two doors it comes in by: the request, and the snapshot built from
 * what the phone holds.
 */
const session = (over: Partial<Session> = {}): Session => ({ id: 's1', date: '2026-11-12', position: 0, kind: 'run', type: 'Easy', title: null, details: null, miles: 4, minutes: null, blockId: null, movedFrom: null, mark: null, ...over });
const run = (over: Partial<Activity> = {}): Activity => ({ id: 'a1', date: '2026-11-12', time: '07:00', name: 'Morning run', sportType: 'Run', kind: 'run', miles: 4, movingSec: 2000, elevFt: 0, avgHr: null, maxHr: null, cadence: null, laps: null, perfAt: null, polyline: null, ...over });
const month = (over: Record<string, unknown> = {}) => ({ month: '2026-11', sessions: [session()], checks: [], lifts: [], activities: [run()], morningDays: {}, journal: [], coach: [], ...over });

describe('wholeMonth', () => {
  it('gives a whole month back as it is (the same object: nothing re-renders for it)', () => {
    const m = month() as MonthBundle;
    expect(wholeMonth(m)).toBe(m);
    // and the same answer for the same month, however often it is asked
    const broken = month({ coach: undefined });
    expect(wholeMonth(broken)).toBe(wholeMonth(broken));
  });
  it('a list the server did not send is an empty list, never undefined', () => {
    const m = wholeMonth({ month: '2026-11' });
    expect(m).toMatchObject({ month: '2026-11', sessions: [], checks: [], lifts: [], activities: [], journal: [], coach: [], morningDays: {} });
    const partial = wholeMonth(month({ sessions: null, lifts: 'x', coach: undefined, morningDays: null }));
    expect(partial.sessions).toEqual([]);
    expect(partial.lifts).toEqual([]);
    expect(partial.coach).toEqual([]);
    expect(partial.morningDays).toEqual({});
    expect(partial.activities).toHaveLength(1);
  });
  it('a session keeps its place with fields of the wrong kind made empty', () => {
    const [s] = wholeMonth(month({ sessions: [{ ...session(), title: { a: 1 }, type: ['x'], details: 42, miles: 'abc', minutes: Number.NaN, mark: 'maybe', position: null }] })).sessions;
    expect(s).toEqual(session({ title: null, type: null, details: null, miles: null, minutes: null, mark: null, position: 0 }));
    const [neg] = wholeMonth(month({ sessions: [session({ miles: -5, minutes: -1 })] })).sessions;
    expect(neg).toMatchObject({ miles: null, minutes: null });
  });
  it('a row that is not a session at all is left out: no id, no day, a kind the app does not draw', () => {
    const rows = [session({ id: 'ok' }), null, 'x', { ...session(), id: null }, { ...session(), id: 'd', date: 'not-a-date' }, { ...session(), id: 'k', kind: 'yoga' }, { id: 'n', date: '2026-11-12' }];
    expect(wholeMonth(month({ sessions: rows })).sessions.map((s) => s.id)).toEqual(['ok']);
  });
  it('two rows with one id are one session (a list keyed by id would draw one of them twice)', () => {
    const m = wholeMonth(month({ sessions: [session({ id: 'same', miles: 3 }), session({ id: 'same', miles: 9 }), session({ id: 'other' })] }));
    expect(m.sessions.map((s) => [s.id, s.miles])).toEqual([['same', 3], ['other', 4]]);
  });
  it('an activity with no day or no id is left out, and its numbers are numbers', () => {
    const m = wholeMonth(month({ activities: [run(), { ...run(), id: 'b', miles: '6.2', movingSec: null, name: null }, { ...run(), id: null }, { ...run(), id: 'c', date: 5 }] }));
    expect(m.activities.map((a) => [a.id, a.miles, a.movingSec, a.name])).toEqual([
      ['a1', 4, 2000, 'Morning run'],
      ['b', 0, 0, ''],
    ]);
  });
  it('anything that is not a month is an empty one', () => {
    for (const raw of [null, undefined, 'x', 7, []]) expect(wholeMonth(raw).sessions).toEqual([]);
  });
});

describe('a snapshot reads a month that is not whole without throwing', () => {
  it('every reader answers, with nothing where the month had nothing to read', () => {
    const broken = { month: '2026-11', sessions: [{ ...session(), title: { a: 1 } }] } as unknown as MonthBundle;
    const snap = buildSnapshot({ '2026-11': broken }, '2026-11-12');
    expect(snap.sessionsOn('2026-11-12').map((s) => s.title)).toEqual([null]);
    expect(snap.runsOn('2026-11-12')).toEqual([]);
    expect(snap.liftsOn('2026-11-12')).toEqual([]);
    expect(snap.checksOn('2026-11-12')).toEqual([]);
    expect(snap.journalOn('2026-11-12')).toEqual([]);
    expect(snap.coachOn('2026-11-12', 'k')).toBeNull();
    expect(snap.morningOverride('2026-11-12')).toBeNull();
    expect(snap.loaded('2026-11')).toBe(true);
  });
});
