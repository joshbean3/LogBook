import { shiftDays, type Activity, type LiftSet, type Session } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { buildSnapshot } from '@/api/snapshot';
import type { MonthBundle } from '@/api/types';
import { liftGroups, setWords } from './data';
import { runRange } from './hero';

const run = (date: string, miles: number): Activity => ({ id: `a-${date}-${miles}`, date, time: null, name: 'Run', sportType: 'Run', kind: 'run', miles, movingSec: miles * 480, elevFt: 0, avgHr: 150, maxHr: null, cadence: null, laps: null, perfAt: null, polyline: null });
const sess = (date: string, miles: number, extra: Partial<Session> = {}): Session => ({ id: `s-${date}`, date, position: 0, kind: 'run', type: 'Easy', title: null, details: null, miles, minutes: null, blockId: null, movedFrom: null, mark: null, ...extra });
const snapOf = (today: string, acts: Activity[], sessions: Session[] = []) => {
  const bundles: Record<string, MonthBundle> = {};
  for (const x of [...acts, ...sessions]) {
    const m = x.date.slice(0, 7);
    bundles[m] ??= { month: m, sessions: [], checks: [], lifts: [], activities: [], morningDays: {}, journal: [], coach: [] };
  }
  for (const a of acts) bundles[a.date.slice(0, 7)]!.activities.push(a);
  for (const s of sessions) bundles[s.date.slice(0, 7)]!.sessions.push(s);
  // every month in view counts as loaded
  for (let d = shiftDays(today, -120); d <= shiftDays(today, 30); d = shiftDays(d, 1)) {
    const m = d.slice(0, 7);
    bundles[m] ??= { month: m, sessions: [], checks: [], lifts: [], activities: [], morningDays: {}, journal: [], coach: [] };
  }
  return buildSnapshot(bundles, today);
};
/** Three runs a week (Tue, Thu, Sat) for the weeks starting at these Mondays, with these miles each. */
const weeks = (mondays: string[], per: number[]) => mondays.flatMap((m, i) => [1, 3, 5].map((d) => run(shiftDays(m, d), per[i]!)));

describe('progress builds from the months that are loaded (§8, critic C11)', () => {
  it('marks the weeks of a missing month as a gap', () => {
    const mons = ['2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05'];
    const snap = snapOf('2026-10-14', weeks(mons, [4, 4, 4, 4, 4, 4]));
    // September never answered: its weeks are a gap, August and October still draw
    const loaded = (m: string) => m !== '2026-09';
    const pts = runRange(snap, '2026-10-14', '3M', null, loaded).buckets;
    const gap = pts.filter((p) => p.missing).map((p) => p.key);
    expect(gap).toContain('2026-09-14');
    expect(gap).toContain('2026-08-31'); // Aug 31 to Sep 6 touches September
    expect(pts.find((p) => p.key === '2026-10-05')).toMatchObject({ missing: false, done: 12, runs: 3 });
    // without a loaded() the series is as before: nothing missing
    expect(runRange(snap, '2026-10-14', '3M', null).buckets.some((p) => p.missing)).toBe(false);
  });
});

describe('lifts with no weight on them', () => {
  const set = (date: string, weight: number, reps: number, exercise = 'Pull-up'): LiftSet => ({ id: `${exercise}-${date}-${weight}-${reps}`, date, exercise, weight, reps, createdAt: '' });
  it('reads a bodyweight lift in reps, never an estimated max or a NaN change', () => {
    const [g] = liftGroups([set('2026-10-01', 0, 6), set('2026-10-01', 0, 8), set('2026-10-08', 0, 10)], '2026-09-01', '2026-10-14');
    expect(g!.reps).toBe(true);
    expect(g!.days.map((d) => d.reps)).toEqual([8, 10]);
    expect(g!.change).toBeCloseTo(0.25);
    expect(setWords(g!.days[0]!)).toBe('Bodyweight × 8');
  });
  it('a lift done both ways reads by its weighted days, and a zero start is no change', () => {
    const [g] = liftGroups([set('2026-10-01', 0, 8, 'Dip'), set('2026-10-08', 25, 5, 'Dip'), set('2026-10-10', 35, 5, 'Dip')], '2026-09-01', '2026-10-14');
    expect(g!.reps).toBe(false);
    expect(g!.days.length).toBe(2);
    expect(Number.isFinite(g!.change!)).toBe(true);
    expect(setWords({ weight: 185, reps: 5 })).toBe('185 × 5');
  });
});
