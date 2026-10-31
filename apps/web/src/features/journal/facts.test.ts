import { describe, expect, it } from 'vitest';
import { buildSnapshot } from '@/api/snapshot';
import type { MonthBundle } from '@/api/types';
import { dayFacts, milesOn } from './facts';

const D = '2026-10-25';
const bundle = (over: Partial<MonthBundle> = {}): Record<string, MonthBundle> => ({
  '2026-10': { month: '2026-10', sessions: [], checks: [], lifts: [], activities: [], morningDays: {}, journal: [], coach: [], ...over },
});
const run = { id: 'a1', date: D, time: '07:10', name: 'Morning Run', sportType: 'Run', kind: 'run' as const, miles: 5.02, movingSec: 5.02 * 494, elevFt: 40, avgHr: null, maxHr: null, cadence: null, laps: null };
const habits = [
  { id: 'h1', name: 'Stretch', position: 0, createdOn: '2026-01-01', archivedOn: null },
  { id: 'h2', name: 'Read', position: 1, createdOn: '2026-01-01', archivedOn: null },
  { id: 'h3', name: 'Sleep', position: 2, createdOn: '2026-01-01', archivedOn: null },
  { id: 'h4', name: 'Protein', position: 3, createdOn: '2026-01-01', archivedOn: null },
];
const goal = { id: 'g', level: 'day' as const, period: D, text: 'x', original: null, why: null, status: 'done' as const, reflection: null, steps: [], createdAt: '', updatedAt: '', closedAt: null };
const todo = (id: string, doneOn: string | null) => ({ id, text: id, note: null, priority: 1 as const, color: null, groupId: null, due: null, bucket: 'today' as const, position: 0, createdOn: D, doneOn, deletedOn: null, createdAt: '' });

describe('dayFacts', () => {
  it('names the run, its miles and pace, the habits kept, the goal and the to-dos, and nothing absent', () => {
    const snap = buildSnapshot(
      bundle({
        sessions: [{ id: 's', date: D, position: 0, kind: 'run', type: 'easy', title: 'Easy 5', details: null, miles: 5, minutes: null, blockId: null, movedFrom: null, mark: null }],
        activities: [run],
        checks: [
          { habitId: 'h1', date: D, done: true, note: null },
          { habitId: 'h2', date: D, done: true, note: null },
          { habitId: 'h3', date: D, done: true, note: null },
        ],
      }),
      '2026-10-31',
    );
    expect(dayFacts({ snap, date: D, habits, goals: [goal], todos: [todo('a', D), todo('b', D), todo('c', null), todo('d', D), todo('e', D)] })).toEqual(['Easy 5', '5.02 mi at 8:14', '3 of 4 habits', 'goal done', '4 to-dos']);
  });
  it('is empty for an empty day, and carries the energy pick when there is one', () => {
    const snap = buildSnapshot(bundle(), '2026-10-31');
    expect(dayFacts({ snap, date: D, habits, goals: [], todos: [] })).toEqual([]);
    expect(dayFacts({ snap, date: D, habits, goals: [], todos: [], energy: 4 })).toEqual(['energy 4/5']);
  });
  it('sums a month’s run miles', () => {
    const snap = buildSnapshot(bundle({ activities: [run, { ...run, id: 'a2', date: '2026-10-26', miles: 3 }] }), '2026-10-31');
    expect(Math.round(milesOn(snap, [D, '2026-10-26', '2026-10-27']))).toBe(8);
  });
});
