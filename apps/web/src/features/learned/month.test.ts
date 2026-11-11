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
