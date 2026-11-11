import { describe, expect, it } from 'vitest';
import { groupByMonth, monthLabel } from './entryGroups';

describe('the entry list in months', () => {
  const today = '2026-11-11';
  it('starts a group wherever the month changes, newest first, across Sep, Oct and Nov', () => {
    const e = (date: string) => ({ date });
    const g = groupByMonth([e('2026-11-10'), e('2026-11-02'), e('2026-10-28'), e('2026-10-03'), e('2026-09-30'), e('2025-11-11')], today);
    expect(g.map((m) => [m.month, m.label, m.entries.length])).toEqual([
      ['2026-11', 'November', 2],
      ['2026-10', 'October', 2],
      ['2026-09', 'September', 1],
      ['2025-11', 'November 2025', 1],
    ]);
  });
  it('names a month of another year with its year', () => {
    expect(monthLabel('2026-01', today)).toBe('January');
    expect(monthLabel('2024-12', today)).toBe('December 2024');
  });
  it('is empty for no entries', () => {
    expect(groupByMonth([], today)).toEqual([]);
  });
});
