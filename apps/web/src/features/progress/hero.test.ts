import { shiftDays, type Activity, type LiftSet, type Session } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { buildSnapshot } from '@/api/snapshot';
import type { MonthBundle } from '@/api/types';
import { monotonePath } from './curve';
import { completion, liftLog, liftWeeks, runRange, weekRate } from './hero';

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
  it('draws 13 weeks ending this week in 3M, planned against run', () => {
    const snap = snapOf(T, [run('2026-11-02', 6), run('2026-11-09', 3)], [sess('2026-11-02', { miles: 5 }), sess('2026-11-04', { miles: 5 }), sess('2026-11-09', { miles: 4 }), sess('2026-11-14', { miles: 8 })]);
    const v = runRange(snap, T, '3M', null);
    expect(v.buckets).toHaveLength(13);
    expect(v.buckets.at(-1)).toMatchObject({ key: '2026-11-09', current: true, planned: 12, plannedPast: 4, done: 3, runs: 1, plannedRuns: 2 });
    expect(v.buckets.at(-2)).toMatchObject({ key: '2026-11-02', planned: 10, done: 6 });
    // 1W: the same week by day, Saturday's 8 miles still ahead (plan only)
    const w = runRange(snap, T, '1W', null);
    expect(w.buckets.map((b) => [b.planned, b.done])).toEqual([[4, 3], [0, 0], [0, 0], [0, 0], [0, 0], [8, 0], [0, 0]]);
    expect(w.weeks).toHaveLength(1);
    expect(w.weeks[0]).toMatchObject({ planned: 12, done: 3 });
  });

  it('counts a run marked done with no activity, and leaves skipped runs out of the plan', () => {
    const snap = snapOf(T, [], [sess('2026-11-03', { miles: 5, mark: 'done' }), sess('2026-11-05', { miles: 6, mark: 'skip' })]);
    expect(runRange(snap, T, '1M', null).buckets.at(-2)).toMatchObject({ planned: 5, done: 5, runs: 1, plannedRuns: 1 });
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
    const w = liftWeeks(snap, T);
    expect(w[w.length - 2]).toMatchObject({ planned: 1, done: 1, sets: 2, volume: 1000 });
    expect(w[w.length - 1]).toMatchObject({ current: true, planned: 1, done: 1, sets: 1 });
  });

  it('rates the plan over finished weeks, a big week never paying for a missed one', () => {
    const wk = (planned: number, done: number, current = false) => ({ w: '2026-01-05', planned, done, current, missing: false });
    expect(completion([wk(10, 20), wk(10, 0), wk(0, 5), wk(10, 5, true)])).toEqual({ rate: 0.5, weeks: 2 });
    expect(completion([wk(0, 3), wk(4, 1, true)])).toBeNull();
    expect(weekRate(wk(8, 10))).toBe(1);
    expect(weekRate(wk(0, 4))).toBeNull();
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

describe('the running curves', () => {
  it('never swing under zero or over a peak they do not have', () => {
    // y grows downward on screen: 100 is zero miles, 0 the top of the chart
    const pts = [
      [0, 100],
      [10, 20],
      [20, 100],
      [30, 100],
      [40, 0],
    ] as const;
    const nums = monotonePath(pts).replace(/[MC]/g, ' ').trim().split(/[ ,]+/).map(Number);
    const ys = nums.filter((_, i) => i % 2 === 1);
    expect(Math.max(...ys)).toBeLessThanOrEqual(100);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(monotonePath([])).toBe('');
    expect(monotonePath([[5, 5]])).toBe('M5.0,5.0');
  });
});
