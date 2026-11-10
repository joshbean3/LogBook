import type { Todo } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { groupsOn, stepWithin } from './groups';
import { goneOn } from './TodoList';

const todo = (id: string, position: number, priority: 0 | 1 | 2 | 3, extra: Partial<Todo> = {}): Todo => ({ id, text: id, note: null, priority, color: null, groupId: null, due: null, bucket: 'today', position, createdOn: '2026-11-01', doneOn: null, deletedOn: null, createdAt: `2026-11-01T00:00:0${position}Z`, ...extra });

describe('today’s list', () => {
  const list = [todo('a', 0, 0), todo('b', 1, 3), todo('c', 2, 1)];
  it('is in the order set by hand, whatever the flags', () => {
    expect(groupsOn(list, '2026-11-10')[0]!.items.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });
  it('moving a row changes the order and nothing else: its priority is left alone', () => {
    const today = groupsOn(list, '2026-11-10')[0]!;
    const r = stepWithin(today.items, 'c', -1, today.tier);
    expect(r).toEqual({ order: ['a', 'c', 'b'], fix: null });
  });
});

describe('the day a to-do leaves on', () => {
  it('is the page’s day, or today from a page ahead of it', () => {
    expect(goneOn('2026-11-12', '2026-11-10')).toBe('2026-11-10');
    expect(goneOn('2026-11-10', '2026-11-10')).toBe('2026-11-10');
    expect(goneOn('2026-11-08', '2026-11-10')).toBe('2026-11-08');
  });
  it('so a to-do deleted from a future page is gone from today’s lists at once', () => {
    const x = todo('dry', 0, 0, { bucket: 'later', due: '2026-11-12', createdOn: '2026-11-10', deletedOn: goneOn('2026-11-12', '2026-11-10') });
    expect(groupsOn([x], '2026-11-10')[1]!.items).toEqual([]);
  });
});
