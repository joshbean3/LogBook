import { describe, expect, it } from 'vitest';
import { monthGrid } from './month';

const L = (id: string, date: string, at = '08') => ({ id, date, text: id, createdAt: `${date}T${at}:00:00.000Z`, editedAt: null });

describe('a month as a grid', () => {
  it('keeps every day of a past month, newest first, with the empty ones in their slots', () => {
    const g = monthGrid('2026-02', '2026-11-08', [L('b', '2026-02-10', '09'), L('a', '2026-02-10', '07'), L('c', '2026-02-01'), L('other', '2026-03-01')]);
    expect(g).toHaveLength(28);
    expect(g[0]!.date).toBe('2026-02-28');
    expect(g.at(-1)).toEqual({ date: '2026-02-01', items: [L('c', '2026-02-01')] });
    expect(g.find((d) => d.date === '2026-02-10')!.items.map((x) => x.id)).toEqual(['a', 'b']);
    expect(g.filter((d) => !d.items.length)).toHaveLength(26);
  });

  it('stops at today in the running month and is empty for a month to come', () => {
    expect(monthGrid('2026-11', '2026-11-08', [])[0]!.date).toBe('2026-11-08');
    expect(monthGrid('2026-11', '2026-11-08', [])).toHaveLength(8);
    expect(monthGrid('2026-12', '2026-11-08', [])).toEqual([]);
  });
});
