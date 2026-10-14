import { shiftDays, type Activity, type Session } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { buildSnapshot } from '@/api/snapshot';
import type { MonthBundle } from '@/api/types';
import { adherence, isoWeek, rangeSummary, verdict, weekSeries } from './data';

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

describe('progress verdict', () => {
  it('never leads with a zero, and compares early weeks with the same weekday last week', () => {
    // Wednesday Oct 14 2026; last week ran Tue (3 mi) by Wednesday, this week nothing yet, a plan for Friday
    const mons = ['2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05'];
    const snap = snapOf('2026-10-14', weeks(mons, [3, 4, 5, 6]), [sess('2026-10-16', 5)]);
    const pts = weekSeries(snap, '2026-10-14', '3M');
    const v = verdict(snap, '2026-10-14', pts, 0);
    expect(v.line).toBe('Four weeks building. This one is light so far.');
    expect(v.sub).toBe('5 mi planned. Next: Easy 5, Friday.');
    expect(v.line).not.toMatch(/\b0\b/);
  });

  it('says a week started today in the copy of the spec', () => {
    const snap = snapOf('2026-10-12', weeks(['2026-09-28', '2026-10-05'], [5, 5]), [sess('2026-10-12', 4), sess('2026-10-14', 6, { id: 'x' })]);
    const v = verdict(snap, '2026-10-12', weekSeries(snap, '2026-10-12', '3M'), 0);
    expect(v.line).toMatch(/This one starts today\.$/);
    expect(v.sub).toBe('10 mi planned. First run today: Easy 4.');
  });

  it('names quiet weeks in words and an ahead week against last week', () => {
    const mons = ['2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28'];
    const snap = snapOf('2026-10-08', [...weeks(mons, [6, 6, 6, 0.5, 0.5]), run('2026-10-06', 9)]);
    const v = verdict(snap, '2026-10-08', weekSeries(snap, '2026-10-08', '3M'), 0);
    expect(v.line).toBe('Two quiet weeks. This one is ahead of last week.');
    expect(v.sub).toBe('9.0 mi so far. One run in.');
  });

  it('sums the range for the resting headline', () => {
    const snap = snapOf('2026-10-14', weeks(['2026-09-28', '2026-10-05'], [4, 6]));
    const s = rangeSummary(weekSeries(snap, '2026-10-14', '3M'));
    expect(s.avg).toBeCloseTo(15);
    expect(s.best?.ran).toBeCloseTo(18);
    expect(s.total).toBeCloseTo(30);
  });
});

describe('plan adherence', () => {
  it('grades only days before today; today and later are ahead', () => {
    const snap = snapOf('2026-10-14', [run('2026-10-12', 5)], [sess('2026-10-12', 5, { blockId: 'b' }), sess('2026-10-13', 5, { id: 's2', blockId: 'b' }), sess('2026-10-16', 4, { id: 's3', blockId: 'b' })]);
    const ad = adherence(snap, '2026-10-14', '2026-07-20', [{ id: 'b', name: 'Block', start: '2026-10-12', end: '2026-12-20', source: null, summary: null, createdAt: '' }]);
    expect(ad.kept).toBe(1);
    expect(ad.planned).toBe(2);
    expect(ad.weeks[0]!.ahead).toBe(1);
  });
});

describe('isoWeek', () => {
  it('matches ISO-8601', () => {
    expect(isoWeek('2026-10-12')).toBe('2026-W42');
    expect(isoWeek('2026-01-01')).toBe('2026-W01');
    expect(isoWeek('2027-01-01')).toBe('2026-W53');
  });
});
