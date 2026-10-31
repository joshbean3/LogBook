import { describe, expect, it } from 'vitest';
import type { Activity } from '@logbook/shared';
import { recordRows } from './records';

const run = (p: Partial<Activity> & { id: string; date: string; miles: number; movingSec: number }): Activity => ({
  time: null,
  name: 'Run',
  sportType: 'Run',
  kind: 'run',
  elevFt: 0,
  avgHr: null,
  maxHr: null,
  cadence: null,
  laps: null,
  perfAt: null,
  polyline: null,
  ...p,
});

describe('recordRows', () => {
  it('lists only the records that exist', () => {
    expect(recordRows([], [])).toEqual([]);
    const rows = recordRows([run({ id: 'a', date: '2026-10-01', miles: 2, movingSec: 1200 })], [{ w: '2026-09-28', ran: 2 }]);
    expect(rows.map((r) => r.id)).toEqual(['longest', 'week']);
  });
  it('finds the best mile from laps and the fastest 5K and 10K by pace', () => {
    const a = run({ id: 'a', date: '2026-10-01', miles: 4, movingSec: 4 * 8 * 60, laps: [[1609.3, 420, null], [1609.3, 480, null]] });
    const b = run({ id: 'b', date: '2026-10-08', miles: 7, movingSec: 7 * 9 * 60 });
    const rows = recordRows([a, b], []);
    const by = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(by.mile?.value).toBe('7:00');
    expect(by['5k']?.run?.id).toBe('a');
    expect(by['10k']?.run?.id).toBe('b');
    expect(by.longest?.value).toBe('7.0');
  });
  it('ignores lifts and names the biggest week', () => {
    const rows = recordRows([run({ id: 'l', date: '2026-10-01', miles: 0, movingSec: 600, kind: 'lift' })], [
      { w: '2026-09-21', ran: 12 },
      { w: '2026-09-28', ran: 20.5 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 'week', value: '20.5', sub: 'Week of Sep 28' });
  });
});
