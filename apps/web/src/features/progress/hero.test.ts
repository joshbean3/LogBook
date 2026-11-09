import { shiftDays, type Activity, type LiftSet, type Session } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { buildSnapshot } from '@/api/snapshot';
import type { MonthBundle } from '@/api/types';
import { completion, HERO_WEEKS, liftWeeks, runWeeks, weekRate } from './hero';

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
  it('draws twelve weeks ending this week, planned against run', () => {
    const snap = snapOf(T, [run('2026-11-02', 6), run('2026-11-09', 3)], [sess('2026-11-02', { miles: 5 }), sess('2026-11-04', { miles: 5 }), sess('2026-11-09', { miles: 4 }), sess('2026-11-14', { miles: 8 })]);
    const w = runWeeks(snap, T);
    expect(w).toHaveLength(HERO_WEEKS);
    expect(w[w.length - 1]).toMatchObject({ w: '2026-11-09', current: true, planned: 12, done: 3, runs: 1, plannedRuns: 2 });
    expect(w[w.length - 2]).toMatchObject({ w: '2026-11-02', planned: 10, done: 6 });
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
