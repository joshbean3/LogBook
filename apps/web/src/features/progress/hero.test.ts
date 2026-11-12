import { shiftDays, type Activity, type LiftSet, type Session } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { buildSnapshot } from '@/api/snapshot';
import type { MonthBundle } from '@/api/types';
import { chartEmpty, chartKeyOf, chartMode, liftLog, liftRange, readingOn, runRange, todayView } from './hero';

const run = (date: string, miles: number): Activity => ({ id: `a-${date}`, date, time: null, name: 'Run', sportType: 'Run', kind: 'run', miles, movingSec: miles * 480, elevFt: 0, avgHr: 150, maxHr: null, cadence: null, laps: null, perfAt: null, polyline: null });
const sess = (date: string, extra: Partial<Session> = {}): Session => ({ id: `s-${date}-${extra.kind ?? 'run'}`, date, position: 0, kind: 'run', type: 'Easy', title: null, details: null, miles: 5, minutes: null, blockId: null, movedFrom: null, mark: null, ...extra });
const set = (date: string, n: number): LiftSet => ({ id: `l-${date}-${n}`, date, exercise: 'Squat', weight: 100, reps: 5 }) as LiftSet;
const snapOf = (today: string, acts: Activity[], sessions: Session[], lifts: LiftSet[] = []) => {
  const bundles: Record<string, MonthBundle> = {};
  for (let d = shiftDays(today, -120); d <= shiftDays(today, 30); d = shiftDays(d, 1)) {
    const m = d.slice(0, 7);
    bundles[m] ??= { month: m, sessions: [], checks: [], lifts: [], activities: [], morningDays: {}, journal: [], coach: [] };
  }
  for (const a of acts) bundles[a.date.slice(0, 7)]!.activities.push(a);
  for (const s of sessions) bundles[s.date.slice(0, 7)]!.sessions.push(s);
  for (const l of lifts) bundles[l.date.slice(0, 7)]!.lifts.push(l);
  return buildSnapshot(bundles, today);
};

// Wednesday Nov 11 2026: this week began Monday Nov 9
const T = '2026-11-11';

describe('the progress hero', () => {
  it('draws 13 weeks ending this week in 3M: what was run, and what the plan still asks for', () => {
    const snap = snapOf(T, [run('2026-11-02', 6), run('2026-11-09', 3)], [sess('2026-11-02', { miles: 5 }), sess('2026-11-04', { miles: 5 }), sess('2026-11-09', { miles: 4 }), sess('2026-11-14', { miles: 8 })]);
    const v = runRange(snap, T, '3M', null);
    expect(v.buckets).toHaveLength(13);
    expect(v.buckets.at(-1)).toMatchObject({ key: '2026-11-09', current: true, planned: 12, plannedPast: 4, done: 3, runs: 1, plannedRuns: 2, ahead: 8 });
    // last week is history: its miles, and no plan left to draw (the 4 it missed are not a mark on the chart)
    expect(v.buckets.at(-2)).toMatchObject({ key: '2026-11-02', planned: 10, done: 6, ahead: 0 });
    // 1W: the same week by day, Saturday's 8 miles still ahead
    const w = runRange(snap, T, '1W', null);
    expect(w.buckets.map((b) => [b.done, b.ahead])).toEqual([[3, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 8], [0, 0]]);
    // 12M: by month, this month so far and the rest of its plan
    const y = runRange(snap, T, '12M', null);
    expect(y.span.unit).toBe('month');
    expect(y.buckets.at(-1)).toMatchObject({ key: '2026-11-01', done: 9, runs: 2, ahead: 8 });
  });

  it('counts a run marked done with no activity, and leaves skipped runs out of the plan', () => {
    const snap = snapOf(T, [], [sess('2026-11-03', { miles: 5, mark: 'done' }), sess('2026-11-05', { miles: 6, mark: 'skip' })]);
    expect(runRange(snap, T, '1M', null).buckets.at(-2)).toMatchObject({ planned: 5, done: 5, runs: 1, plannedRuns: 1 });
  });

  it('counts today’s planned run as ahead until it is run', () => {
    const plan = [sess(T, { miles: 6 }), sess('2026-11-13', { miles: 4 })];
    expect(runRange(snapOf(T, [], plan), T, '3M', null).buckets.at(-1)).toMatchObject({ done: 0, ahead: 10 });
    expect(runRange(snapOf(T, [run(T, 6.2)], plan), T, '3M', null).buckets.at(-1)).toMatchObject({ done: 6.2, ahead: 4 });
  });

  it('counts lift sessions done, planned or not, with their sets and volume', () => {
    const lift = (d: string, extra: Partial<Session> = {}) => sess(d, { kind: 'lift', type: null, miles: null, ...extra });
    const snap = snapOf(
      T,
      [],
      // last week: two planned, one with sets, one marked skip (left out of the plan); this week: one planned, one bonus day
      [lift('2026-11-03'), lift('2026-11-05', { mark: 'skip' }), lift('2026-11-12')],
      [set('2026-11-03', 1), set('2026-11-03', 2), set('2026-11-10', 1)],
    );
    const w = liftRange(snap, T, '3M', null).buckets;
    expect(w).toHaveLength(13);
    expect(w[w.length - 2]).toMatchObject({ planned: 1, done: 1, sets: 2, volume: 1000, ahead: 0 });
    expect(w[w.length - 1]).toMatchObject({ current: true, planned: 1, done: 1, sets: 1, ahead: 1 });
    // by day this week: Tuesday's bonus lift done, Thursday's still ahead
    expect(liftRange(snap, T, '1W', null).buckets.map((b) => [b.done, b.ahead])).toEqual([[0, 0], [1, 0], [0, 0], [0, 1], [0, 0], [0, 0], [0, 0]]);
    // by month: November so far
    expect(liftRange(snap, T, '12M', null).buckets.at(-1)).toMatchObject({ done: 2, sets: 3, ahead: 1 });
  });

  it('counts a lift marked done with no sets, and a synced lift with nothing on the plan', () => {
    const lift = (d: string, extra: Partial<Session> = {}) => sess(d, { kind: 'lift', type: null, miles: null, ...extra });
    const synced: Activity = { ...run('2026-11-06', 0), id: 'w-1', kind: 'lift', sportType: 'WeightTraining', name: 'Evening Weights' };
    const w = liftRange(snapOf(T, [synced], [lift('2026-11-03', { mark: 'done' })]), T, '3M', null).buckets;
    expect(w[w.length - 2]).toMatchObject({ done: 2, sets: 0, volume: 0 });
  });
});

describe('the strength list', () => {
  const lift = (d: string, extra: Partial<Session> = {}) => sess(d, { kind: 'lift', type: null, miles: null, title: 'Strength A', ...extra });
  const sq = (date: string, n: number, exercise = 'Squat'): LiftSet => ({ id: `l-${date}-${exercise}-${n}`, date, exercise, weight: 100, reps: 5 }) as LiftSet;

  it('lists each workout newest first, planned ones of this week on top, each in one line', () => {
    const snap = snapOf(
      T,
      [],
      [lift('2026-11-13', { details: 'Deadlift, press\nkeep it easy' }), lift('2026-11-10'), lift('2026-11-03', { title: null }), lift('2026-11-05', { title: 'Strength B', minutes: 40 })],
      [sq('2026-11-10', 1), sq('2026-11-10', 2), sq('2026-11-10', 3, 'Bench press'), sq('2026-11-08', 1, 'Goblet squat')],
    );
    const items = liftLog(snap, T, '2026-11-02');
    expect(items.map((x) => [x.date, x.status, x.summary])).toEqual([
      ['2026-11-13', 'planned', 'Strength A · Deadlift, press'],
      ['2026-11-10', 'done', 'Strength A · 2 exercises · 3 sets · 1,500 lb'],
      ['2026-11-08', 'done', 'Lifted · Goblet squat · 1 set · 500 lb'],
      ['2026-11-05', 'missed', 'Strength B · 40 min'],
      ['2026-11-03', 'missed', 'Lift'],
    ]);
    expect(items[2]!.session).toBeNull();
    expect(items[2]!.sets).toHaveLength(1);
  });
});

describe('a reading belongs to the chart it was made on', () => {
  // The hero redraws its chart as a new one when the range, the mode or the first bar changes: a tap on a range, and also
  // months that land while a long range is still loading (the chart on screen was the last whole one). A finger reading
  // the old chart then never lets go on the new one, and the headline kept that bucket's number until the next touch.
  const m3 = chartKeyOf('run', { range: '3M', unit: 'week', from: '2026-08-17' });
  const all = chartKeyOf('run', { range: 'All', unit: 'month', from: '2021-11-01' });
  it('reads on its own chart', () => {
    expect(readingOn({ chart: m3, i: 5 }, m3)).toBe(5);
    expect(readingOn({ chart: m3, i: 0 }, m3)).toBe(0);
    expect(readingOn(null, m3)).toBeNull();
  });
  it('is dropped once the chart is another one: the range, the unit, the mode or the first bar changed', () => {
    expect(readingOn({ chart: m3, i: 5 }, all)).toBeNull();
    expect(readingOn({ chart: m3, i: 5 }, chartKeyOf('lift', { range: '3M', unit: 'week', from: '2026-08-17' }))).toBeNull();
    expect(readingOn({ chart: m3, i: 5 }, chartKeyOf('run', { range: '3M', unit: 'week', from: '2026-08-24' }))).toBeNull();
    expect(m3).not.toBe(all);
  });
});

describe('workouts are lift and cross sessions, as the training card counts them', () => {
  const lift = (d: string, extra: Partial<Session> = {}) => sess(d, { kind: 'lift', type: null, miles: null, title: 'Strength A', ...extra });
  const bike = (d: string, extra: Partial<Session> = {}) => sess(d, { kind: 'cross', type: null, miles: null, title: 'Bike 40', minutes: 40, ...extra });
  const act = (date: string, kind: 'lift' | 'cross', name: string): Activity => ({ ...run(date, 0), id: `x-${date}-${kind}`, kind, name, sportType: kind === 'cross' ? 'Ride' : 'WeightTraining', movingSec: 1800 });

  it('counts a cross session on the chart: the card says "Workouts this week, 0 of 3" and so does the chart', () => {
    // this week: a lift (missed), a bike marked done, a bike still ahead; a skipped one is left out
    const snap = snapOf(T, [], [lift('2026-11-09'), bike('2026-11-10', { mark: 'done' }), bike('2026-11-13'), bike('2026-11-14', { mark: 'skip' })]);
    const week = liftRange(snap, T, '3M', null).buckets.at(-1)!;
    expect(week).toMatchObject({ planned: 3, done: 1, ahead: 1 });
    expect(liftRange(snap, T, '1W', null).buckets.map((b) => [b.done, b.ahead])).toEqual([[0, 0], [1, 0], [0, 0], [0, 0], [0, 1], [0, 0], [0, 0]]);
  });

  it('counts a synced ride with nothing on the plan as a workout done that day', () => {
    const snap = snapOf(T, [act('2026-11-10', 'cross', 'Evening Ride')], []);
    expect(liftRange(snap, T, '3M', null).buckets.at(-1)).toMatchObject({ planned: 0, done: 1, sets: 0 });
  });

  it('lists cross sessions with the lifts, and keeps the day’s sets with its lift', () => {
    const sq = (date: string, n: number): LiftSet => ({ id: `l-${date}-${n}`, date, exercise: 'Squat', weight: 100, reps: 5 }) as LiftSet;
    const snap = snapOf(
      T,
      [act('2026-11-04', 'cross', 'Evening Ride')],
      [bike('2026-11-13'), bike('2026-11-10', { mark: 'done', position: 0 }), lift('2026-11-10', { position: 1 }), bike('2026-11-09', { mark: 'done' })],
      [sq('2026-11-10', 1), sq('2026-11-10', 2), sq('2026-11-09', 1)],
    );
    expect(liftLog(snap, T, '2026-11-02').map((x) => [x.date, x.status, x.summary])).toEqual([
      ['2026-11-13', 'planned', 'Bike 40 · 40 min'],
      ['2026-11-10', 'done', 'Bike 40 · Marked done'],
      // the sets are the lift's, though it is the day's second session
      ['2026-11-10', 'done', 'Strength A · Squat · 2 sets · 1,000 lb'],
      ['2026-11-09', 'done', 'Bike 40 · Marked done'],
      // sets on a day whose only session is a ride: a row of their own, as before
      ['2026-11-09', 'done', 'Lifted · Squat · 1 set · 500 lb'],
      // a ride synced with nothing on the plan: its own name
      ['2026-11-04', 'done', 'Evening Ride · 30 min'],
    ]);
  });
});

describe('the one switch: which chart Fitness shows (chartMode)', () => {
  const both = { run: true, lift: true };
  it('shows the pick made today, on the chart or on any training card', () => {
    expect(chartMode({ picked: 'workouts', today: 'runs', has: both })).toEqual({ mode: 'lift', switchable: true });
    expect(chartMode({ picked: 'runs', today: 'workouts', has: both })).toEqual({ mode: 'run', switchable: true });
  });
  it('with no pick, opens on what today’s card is about; on a rest day, on runs', () => {
    expect(chartMode({ picked: null, today: 'workouts', has: both }).mode).toBe('lift');
    expect(chartMode({ picked: null, today: 'runs', has: both }).mode).toBe('run');
    expect(chartMode({ picked: null, today: null, has: both }).mode).toBe('run');
  });
  it('never shows a chart of nothing: a mode with nothing in it is not offered, whatever was picked', () => {
    expect(chartMode({ picked: 'workouts', today: 'workouts', has: { run: true, lift: false } })).toEqual({ mode: 'run', switchable: false });
    expect(chartMode({ picked: 'runs', today: null, has: { run: false, lift: true } })).toEqual({ mode: 'lift', switchable: false });
    // someone who only lifts opens on Workouts on a rest day too, with no switch
    expect(chartMode({ picked: null, today: null, has: { run: false, lift: true } })).toEqual({ mode: 'lift', switchable: false });
    expect(chartMode({ picked: null, today: null, has: { run: false, lift: false } })).toEqual({ mode: 'run', switchable: false });
  });
  it('while months are still loading, keeps what was asked for instead of flipping away and back', () => {
    expect(chartMode({ picked: 'workouts', today: null, has: { run: true, lift: false }, settled: false }).mode).toBe('lift');
    expect(chartMode({ picked: null, today: 'workouts', has: { run: false, lift: false }, settled: false }).mode).toBe('lift');
    expect(chartMode({ picked: null, today: null, has: { run: true, lift: false }, settled: false }).mode).toBe('run');
  });

  it('reads today’s own view as the card does: a run first, then a lift or a cross session, else neither', () => {
    const lift = (d: string, extra: Partial<Session> = {}) => sess(d, { kind: 'lift', type: null, miles: null, ...extra });
    expect(todayView(snapOf(T, [], [sess(T), lift(T)]), T)).toBe('runs');
    expect(todayView(snapOf(T, [], [lift(T)]), T)).toBe('workouts');
    expect(todayView(snapOf(T, [], [sess(T, { kind: 'cross', miles: null })]), T)).toBe('workouts');
    // a skipped run is not what the day is about; a rest day and an empty day are neither
    expect(todayView(snapOf(T, [], [sess(T, { mark: 'skip' }), lift(T)]), T)).toBe('workouts');
    expect(todayView(snapOf(T, [], [sess(T, { kind: 'rest', miles: null })]), T)).toBeNull();
    expect(todayView(snapOf(T, [], []), T)).toBeNull();
    // a run done off the plan
    expect(todayView(snapOf(T, [run(T, 3)], []), T)).toBe('runs');
  });
});

describe('Progress with no history (chartEmpty)', () => {
  it('is one quiet row that says what will draw here, never an empty frame', () => {
    expect(chartEmpty(false)).toEqual({ title: 'Your weeks draw here', line: 'After your first run or workout.', connect: false });
  });
  it('offers the way to connect a source only where one is on offer', () => {
    expect(chartEmpty(true).connect).toBe(true);
  });
  it('is plain copy: no dash, nothing that reads as not set', () => {
    const e = chartEmpty(false);
    expect(`${e.title} ${e.line}`).not.toMatch(/[\u2014\u2013]|not set|no data|none/i);
  });
});
