import { describe, expect, it } from 'vitest';
import { METERS_PER_MILE } from './dates.js';
import { bestMile, recordHeadline, recordsFor } from './records.js';
import type { Activity, Lap } from './types.js';

const M = METERS_PER_MILE;
let n = 0;
const run = (date: string, miles: number, movingSec: number, opts: Partial<Activity> = {}): Activity => ({
  id: `a${n++}`,
  date,
  time: '07:00',
  name: 'Run',
  sportType: 'Run',
  kind: 'run',
  miles,
  movingSec,
  elevFt: 50,
  avgHr: null,
  maxHr: null,
  cadence: null,
  laps: null,
  perfAt: null,
  polyline: null,
  ...opts,
});
const miles = (...secs: number[]): Lap[] => secs.map((s) => [M, s, null]);

describe('run records', () => {
  const history = [run('2025-11-02', 5, 2700, { laps: miles(540, 530, 545, 535, 550) }), run('2026-03-10', 6, 3180, { laps: miles(530, 525, 535, 540, 530, 520) }), run('2026-06-01', 4, 2080, { laps: miles(515, 520, 525, 520), elevFt: 300 })];

  it('finds the fastest mile split and which lap it was', () => {
    expect(bestMile(run('2026-10-31', 3, 1500, { laps: [...miles(520, 498, 510), [400, 90, null]] }))).toEqual({ sec: 498, lap: 1 });
  });

  it('calls a best-ever mile and a longest run, with what they beat', () => {
    const today = run('2026-10-31', 8, 4300, { laps: miles(540, 530, 505, 535, 540, 545, 540, 535) });
    const rs = recordsFor(today, [...history, today]);
    expect(rs.map((r) => [r.kind, r.scope])).toEqual([
      ['mile', 'best'],
      ['longest', 'best'],
    ]);
    expect(rs[0]).toMatchObject({ value: '8:25 /mi', detail: '10 sec faster than your best', lap: 2 });
    expect(rs[1]!.detail).toBe('2.0 mi longer than your longest');
    expect(recordHeadline(rs[0]!, today.date)).toBe('Your fastest mile yet!');
  });

  it('calls a year record when it beats this year but not every year', () => {
    const older = [...history, run('2025-12-20', 10, 5400)];
    const today = run('2026-10-31', 7, 3900);
    const rs = recordsFor(today, older);
    expect(rs.find((r) => r.kind === 'longest')).toMatchObject({ scope: 'year' });
    expect(recordHeadline(rs.find((r) => r.kind === 'longest')!, today.date)).toBe('Your longest run in 2026!');
  });

  it('needs a history, and never counts the run against itself or later runs', () => {
    const today = run('2026-10-31', 20, 9000);
    expect(recordsFor(today, history.slice(0, 2))).toEqual([]);
    const later = run('2026-11-05', 30, 14000);
    expect(recordsFor(today, [...history, today, later]).some((r) => r.kind === 'longest')).toBe(true);
  });
});
