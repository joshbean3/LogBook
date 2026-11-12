import { MORNING_DEFAULTS, shiftDays, type Activity, type ISODate, type Session } from '@logbook/shared';
import { describe, expect, it, vi } from 'vitest';
import { buildSnapshot } from '@/api/snapshot';
import type { MonthBundle } from '@/api/types';
import type { Log } from '../log/useLog';
import { dayWord, weekStops } from './weekStops';

// the line reads three small things from modules that also hold screens (which need a browser): stand-ins for those
vi.mock('../sessions/SessionCard', () => ({ runIntent: () => 'Z2, conversational' }));
vi.mock('./Held', () => ({ isHeld: (s: { kind: string; mark: unknown }) => s.kind !== 'rest' && !s.mark }));
vi.mock('../sessions/reshape', () => ({ useReshape: () => ({}), movesOnly: () => false }));

// Monday November 9 to Sunday November 15, 2026; today is Thursday the 12th unless a test says so
const MON = '2026-11-09';
const [M, TU, W, TH, F, SA] = [0, 1, 2, 3, 4, 5].map((i) => shiftDays(MON, i)) as [ISODate, ISODate, ISODate, ISODate, ISODate, ISODate];
let n = 0;
const sess = (date: ISODate, kind: Session['kind'], over: Partial<Session> = {}): Session => ({ id: over.id ?? `s${++n}`, date, position: 0, kind, type: kind === 'run' ? 'Easy' : kind === 'lift' ? 'Strength' : kind === 'cross' ? 'Bike' : 'Rest', title: null, details: null, miles: null, minutes: null, blockId: null, movedFrom: null, mark: null, ...over });
const run = (date: ISODate, miles: number, over: Partial<Session> = {}) => sess(date, 'run', { miles, ...over });
const act = (date: ISODate, miles: number): Activity => ({ id: `a${++n}`, date, time: '07:10', name: 'Morning Run', sportType: 'Run', kind: 'run', miles, movingSec: miles * 540, elevFt: 0, avgHr: null, maxHr: null, cadence: null, laps: null, perfAt: null, polyline: null });
const bundle = (month: string, sessions: Session[], activities: Activity[] = []): MonthBundle => ({ month, sessions, checks: [], lifts: [], activities, morningDays: {}, journal: [], coach: [] });
const logOf = (sessions: Session[], activities: Activity[] = [], today: ISODate = TH): Log => {
  const snap = buildSnapshot({ '2026-11': bundle('2026-11', sessions, activities) }, today);
  return { today, boot: { morningSettings: MORNING_DEFAULTS, habits: [], blocks: [], user: { status: null } } as unknown as Log['boot'], fitness: true, habits: [], zones: null, features: { claude: false, strava: false }, strava: null, snap, ready: true, loading: false, loaded: () => true } as Log;
};

/** The owner's kind of week: no plan, sessions put on days one by one. */
const owner = () => [
  run(M, 3, { id: 'mon', mark: 'done' }),
  sess(TU, 'lift', { id: 'tue', minutes: 30, mark: 'done' }),
  run(W, 4, { id: 'wed', mark: 'skip' }),
  sess(TH, 'cross', { id: 'thu', minutes: 40 }),
  run(F, 3, { id: 'fri' }),
  run(SA, 5, { id: 'sat', type: 'Long' }),
  sess(SA, 'lift', { id: 'sat-core', type: 'Core', minutes: 15, position: 1 }),
];

describe('the line of days on Fitness', () => {
  it('this week: the days after today are the stops, today is the card’s, earlier days fold', () => {
    const w = weekStops(logOf(owner()), MON);
    expect(w.where).toBe('now');
    expect(w.ahead.map((s) => [s.caption, s.title, s.sub])).toEqual([
      ['Tomorrow · Fri 13', 'Easy 3', 'Z2, conversational'],
      ['Sat 14', 'Long 5', 'Z2, conversational'],
      ['', 'Core', '15 min'],
    ]);
    expect(w.ahead.every((s) => s.state === 'ahead' && !s.struck)).toBe(true);
    expect(w.earlier.map((s) => s.key)).toEqual(['mon', 'tue', 'wed']);
    expect(w.earlierWord).toBe('3 sessions');
    expect(w.empty).toBe(false);
  });
  it('earlier days keep their real states: done is a filled stop, skipped and missed are struck and named', () => {
    const w = weekStops(logOf([...owner(), run(M, 2, { id: 'mon-2', position: 1 })]), MON);
    const by = Object.fromEntries(w.earlier.map((s) => [s.key, s]));
    expect([by.mon!.state, by.mon!.caption, by.mon!.struck]).toEqual(['done', 'Mon 9 · Done', false]);
    expect([by.wed!.state, by.wed!.caption, by.wed!.struck]).toEqual(['ahead', 'Wed 11 · Skipped', true]);
    // a day's second stop says only what happened
    expect([by['mon-2']!.caption, by['mon-2']!.struck]).toEqual(['Missed', true]);
    expect(by.mon!.said).toBe('Easy 3. Z2, conversational. Done. Monday. Open');
  });
  it('a week ahead shows every day with something on it; a week behind the same, with what happened', () => {
    const next = shiftDays(MON, 7);
    const ahead = weekStops(logOf([run(next, 4, { id: 'n1' }), sess(shiftDays(next, 2), 'rest', { id: 'n-rest' })]), next);
    expect(ahead.where).toBe('ahead');
    expect(ahead.ahead.map((s) => [s.caption, s.title])).toEqual([
      ['Mon 16', 'Easy 4'],
      ['Wed 18', 'Rest'],
    ]);
    expect(ahead.earlier).toEqual([]);
    const past = weekStops(logOf(owner(), [], shiftDays(MON, 9)), MON);
    expect(past.where).toBe('past');
    expect(past.ahead.map((s) => s.key)).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sat-core']);
    expect(past.ahead.find((s) => s.key === 'fri')!.caption).toBe('Fri 13 · Missed');
    expect(past.earlier).toEqual([]);
  });
  it('a run with nothing planned for it is a done stop of its own', () => {
    const w = weekStops(logOf([], [act(TU, 3.1)]), MON);
    expect(w.earlier.map((s) => [s.session, s.state, s.title, s.caption])).toEqual([[null, 'done', 'Morning Run', 'Tue 10 · Done']]);
    expect(w.earlier[0]!.sub).toMatch(/^3\.1 mi .*Off the plan$/);
    expect(w.earlierWord).toBe('1 session');
  });
  it('an empty week says so; a week with only today’s session is not empty', () => {
    expect(weekStops(logOf([]), MON).empty).toBe(true);
    expect(weekStops(logOf([]), shiftDays(MON, 7)).empty).toBe(true);
    const onlyToday = weekStops(logOf([run(TH, 3)]), MON);
    expect([onlyToday.empty, onlyToday.ahead.length, onlyToday.earlier.length]).toEqual([false, 0, 0]);
    // earlier days that are only rest days fold as "Rest"
    expect(weekStops(logOf([sess(M, 'rest')]), MON).earlierWord).toBe('Rest');
  });
  it('the day word', () => {
    expect(dayWord('2026-11-13')).toBe('Fri 13');
  });
});
