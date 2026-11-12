import { describe, expect, it } from 'vitest';
import { monthDays, neighbours } from './month';

const L = (id: string, date: string, at = '08') => ({ id, date, text: id, createdAt: `${date}T${at}:00:00.000Z`, editedAt: null });

describe('a month as its days', () => {
  it('lists only the days with something kept, newest first, each in the order written', () => {
    const g = monthDays('2026-02', '2026-11-08', [L('b', '2026-02-10', '09'), L('a', '2026-02-10', '07'), L('c', '2026-02-01'), L('other', '2026-03-01')], '2026-11-02');
    expect(g.map((d) => d.date)).toEqual(['2026-02-10', '2026-02-01']);
    expect(g[0]!.items.map((x) => x.id)).toEqual(['a', 'b']);
    expect(g.every((d) => d.items.length)).toBe(true);
  });

  it('keeps the empty days of the last week, as the way to fill them in, and stops at today', () => {
    const g = monthDays('2026-11', '2026-11-08', [L('x', '2026-11-03')], '2026-11-02');
    expect(g.map((d) => [d.date, d.items.length])).toEqual([
      ['2026-11-08', 0],
      ['2026-11-07', 0],
      ['2026-11-06', 0],
      ['2026-11-05', 0],
      ['2026-11-04', 0],
      ['2026-11-03', 1],
      ['2026-11-02', 0],
    ]);
  });

  it('is empty for a month to come, and for a past month with nothing in it', () => {
    expect(monthDays('2026-12', '2026-11-08', [])).toEqual([]);
    expect(monthDays('2026-09', '2026-11-08', [], '2026-11-02')).toEqual([]);
  });
});

describe('the months either side', () => {
  it('steps to the nearest month with something in it', () => {
    const ms = [{ month: '2026-11' }, { month: '2026-09' }, { month: '2026-07' }];
    expect(neighbours(ms, '2026-09')).toEqual({ older: '2026-07', newer: '2026-11' });
    expect(neighbours(ms, '2026-11')).toEqual({ older: '2026-09', newer: null });
    expect(neighbours(ms, '2026-07')).toEqual({ older: null, newer: '2026-09' });
  });
});

describe('a month at the edges', () => {
  it('shows a line dated after today (the phone went back a time zone since it was written): the count must match the rows', () => {
    const g = monthDays('2026-11', '2026-11-11', [L('tokyo', '2026-11-12'), L('x', '2026-11-10')], '2026-11-05');
    expect(g.map((d) => [d.date, d.items.length]).slice(0, 3)).toEqual([
      ['2026-11-12', 1],
      ['2026-11-11', 0],
      ['2026-11-10', 1],
    ]);
    // a month still to come shows a line the server has for it, and no empty days to fill
    expect(monthDays('2026-12', '2026-11-30', [L('early', '2026-12-01')], '2026-11-24').map((d) => [d.date, d.items.length])).toEqual([['2026-12-01', 1]]);
  });

  it('has the 29th in a leap February and none in another', () => {
    expect(monthDays('2024-02', '2026-11-12', [L('leap', '2024-02-29'), L('b', '2024-02-28')]).map((d) => d.date)).toEqual(['2024-02-29', '2024-02-28']);
    // the fill-in days of a February that ends on the 28th stop there
    expect(monthDays('2027-02', '2027-03-02', [], '2027-02-24').map((d) => d.date)).toEqual(['2027-02-28', '2027-02-27', '2027-02-26', '2027-02-25', '2027-02-24']);
    expect(monthDays('2028-02', '2028-03-02', [], '2028-02-25').map((d) => d.date)[0]).toBe('2028-02-29');
  });

  it('holds 300 lines on 31 days, and across a year end', () => {
    const rows = Array.from({ length: 300 }, (_, i) => L(`l${i}`, `2025-03-${String((i % 31) + 1).padStart(2, '0')}`, String(i % 24).padStart(2, '0')));
    const g = monthDays('2025-03', '2026-11-12', rows);
    expect(g).toHaveLength(31);
    expect(g.reduce((n, d) => n + d.items.length, 0)).toBe(300);
    expect(monthDays('2026-12', '2027-01-02', [L('nye', '2026-12-31')], '2026-12-27').map((d) => d.date)).toEqual(['2026-12-31', '2026-12-30', '2026-12-29', '2026-12-28', '2026-12-27']);
    expect(neighbours([{ month: '2027-01' }, { month: '2026-12' }, { month: '2025-12' }], '2026-12')).toEqual({ older: '2025-12', newer: '2027-01' });
  });

  it('ignores a row in a shape it cannot place', () => {
    const odd = [{ id: 'n', date: null, text: 'x', createdAt: 'x', editedAt: null }, { id: 'u', text: 'x' }] as never[];
    expect(monthDays('2026-11', '2026-11-12', [...odd, L('ok', '2026-11-01')], '2026-11-12').map((d) => [d.date, d.items.length])).toEqual([
      ['2026-11-12', 0],
      ['2026-11-01', 1],
    ]);
  });
});
