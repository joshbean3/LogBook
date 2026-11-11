import { shareableSettings, shiftDays, type Activity, type Session } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { buildSnapshot } from '@/api/snapshot';
import type { MonthBundle } from '@/api/types';
import type { Log } from '../log/useLog';
import { seedOf } from './builderSeed';

/*
 * Where the builder's first answers come from, and which of them may be sent to the assistant. Nothing from Strava goes
 * to Claude, and that includes a number worked out from it: run days and weekly miles read from tracked runs
 * (activities) are flagged, and `shareableSettings` leaves a flagged answer out.
 */
const T = '2026-11-25'; // a Wednesday; the four weeks before it are Oct 26 to Nov 22
const MON = '2026-11-23';
const bundle = (month: string, activities: Activity[], sessions: Session[]): MonthBundle => ({ month, sessions: sessions.filter((s) => s.date.startsWith(month)), activities: activities.filter((a) => a.date.startsWith(month)), checks: [], lifts: [], morningDays: {}, journal: [], coach: [] });
const act = (date: string, miles: number): Activity => ({ id: `a-${date}`, date, time: '07:00', name: 'Morning Run', sportType: 'Run', kind: 'run', miles, movingSec: miles * 540, elevFt: 0, avgHr: null, maxHr: null, cadence: null, laps: null, perfAt: null, polyline: null });
const done = (date: string, miles: number): Session => ({ id: `s-${date}`, date, position: 0, kind: 'run', type: 'Easy', title: null, details: null, miles, minutes: null, blockId: null, movedFrom: null, mark: 'done', effort: null }) as Session;
const logOf = (activities: Activity[], sessions: Session[], profile: unknown = null): Log =>
  ({
    today: T,
    boot: { user: { trainingProfile: profile }, blocks: [] },
    snap: buildSnapshot({ '2026-10': bundle('2026-10', activities, sessions), '2026-11': bundle('2026-11', activities, sessions) }, T),
    features: { claude: true, strava: true },
  }) as unknown as Log;
/** Tracked runs on Mon, Wed, Fri, Sat for the four weeks before this one: 26 miles a week. */
const tracked = [1, 2, 3, 4].flatMap((w) => [[0, 5], [2, 6], [4, 5], [5, 10]].map(([off, miles]) => act(shiftDays(MON, -7 * w + off!), miles!)));

describe('the builder’s first answers', () => {
  it('an empty calendar and no training answers: the app’s own stand-ins, which are nobody’s data', () => {
    const seed = seedOf(logOf([], []));
    expect(seed.a).toMatchObject({ goal: 'base', weeks: 8, runDays: ['tue', 'thu', 'sat', 'sun'], longRunDay: 'sun', weeklyMiles: 15, peakMiles: null, soon: false, startDate: null, race: true, raceDay: 'sun' });
    expect(seed.fromRuns).toEqual({ runDays: false, weeklyMiles: false });
    expect(shareableSettings(seed.a, T, seed.fromRuns)).toMatchObject({ runDays: ['tue', 'thu', 'sat', 'sun'], longRunDay: 'sun', weeklyMiles: 15 });
  });

  it('tracked runs (the owner’s phone): the days and miles come from them, are flagged, and are not sent', () => {
    const seed = seedOf(logOf(tracked, []));
    expect(seed.a).toMatchObject({ runDays: ['mon', 'wed', 'fri', 'sat'], longRunDay: 'sat', weeklyMiles: 26 });
    expect(seed.fromRuns).toEqual({ runDays: true, weeklyMiles: true });
    const sent = shareableSettings(seed.a, T, seed.fromRuns);
    expect(sent).toMatchObject({ runDays: null, longRunDay: null, weeklyMiles: null, goal: 'base', weeks: 8 });
    expect(JSON.stringify(sent)).not.toMatch(/:26\b|"mon"|"wed"|"fri"|"sat"/);
  });

  it('runs the person marked done, with nothing tracked: the miles are their own and may go', () => {
    const marked = [1, 2, 3, 4].flatMap((w) => [[1, 4], [3, 4], [6, 8]].map(([off, miles]) => done(shiftDays(MON, -7 * w + off!), miles!)));
    const seed = seedOf(logOf([], marked));
    expect(seed.a.weeklyMiles).toBe(16);
    expect(seed.fromRuns).toEqual({ runDays: false, weeklyMiles: false });
  });

  it('the training answers win over the calendar, and are the person’s own', () => {
    const seed = seedOf(logOf(tracked, []), undefined);
    expect(seed.fromRuns.runDays).toBe(true);
    const own = seedOf(logOf(tracked, [], { goal: 'half', raceDate: null, runDays: ['tue', 'thu', 'sun'], longRunDay: 'sun', weeklyMiles: 22 }));
    expect(own.a).toMatchObject({ goal: 'half', weeks: 12, runDays: ['tue', 'thu', 'sun'], longRunDay: 'sun', weeklyMiles: 22 });
    expect(own.fromRuns).toEqual({ runDays: false, weeklyMiles: false });
  });

  it('a prefill (the next plan after one ends) is the person’s own, and its start holds', () => {
    const seed = seedOf(logOf(tracked, []), { goal: '10k', runDays: [1, 3, 5], longRunDay: 5, weeklyMiles: 18, startDate: '2026-12-21' });
    expect(seed.a).toMatchObject({ goal: '10k', weeks: 10, runDays: ['tue', 'thu', 'sat'], longRunDay: 'sat', weeklyMiles: 18, startDate: '2026-12-21' });
    expect(seed.fromRuns).toEqual({ runDays: false, weeklyMiles: false });
    // a start that is today or earlier is not kept
    expect(seedOf(logOf([], []), { startDate: T }).a.startDate).toBeNull();
  });

  it('builds the plan the header first shows from the same answers', () => {
    const seed = seedOf(logOf([], []));
    expect(seed.built.error).toBeNull();
    expect(seed.built.tpl?.name).toBe('Base · 8 weeks');
    expect(seed.built.tpl?.start).toBe('2026-11-30');
  });
});
