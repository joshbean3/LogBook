import type { Todo } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { groupsOn, liveOn, moveWithin, stepWithin, todayOpenOn } from './groups';
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

describe('a row dropped in a new place in its group', () => {
  it('today’s list: the order changes and nothing else', () => {
    const items = [todo('a', 0, 0), todo('b', 1, 3), todo('c', 2, 1), todo('d', 3, 0)];
    expect(moveWithin(items, 'a', 2, 'none')).toEqual({ order: ['b', 'c', 'a', 'd'], fix: null });
    expect(moveWithin(items, 'd', 0, 'none')).toEqual({ order: ['d', 'a', 'b', 'c'], fix: null });
  });
  it('a drop where it began is no move', () => {
    expect(moveWithin([todo('a', 0, 0), todo('b', 1, 0)], 'b', 1, 'none')).toBe(null);
    expect(moveWithin([todo('a', 0, 0)], 'z', 0, 'none')).toBe(null);
  });
  it('among rows of another priority it takes theirs (Someday, By list)', () => {
    const items = [todo('h1', 0, 3), todo('h2', 1, 3), todo('l1', 2, 1), todo('n', 3, 0)];
    expect(moveWithin(items, 'n', 1, 'priority')).toEqual({ order: ['h1', 'n', 'h2', 'l1'], fix: { priority: 3 } });
    expect(moveWithin(items, 'h1', 3, 'priority')).toEqual({ order: ['h2', 'l1', 'n', 'h1'], fix: { priority: 0 } });
  });
  it('among another day’s rows it takes their day (Later)', () => {
    const items = [todo('f', 0, 0, { bucket: 'later', due: '2026-11-13' }), todo('g', 1, 0, { bucket: 'later', due: '2026-11-13' }), todo('m', 2, 0, { bucket: 'later', due: '2026-11-16' })];
    expect(moveWithin(items, 'm', 1, 'due')).toEqual({ order: ['f', 'm', 'g'], fix: { due: '2026-11-13' } });
  });
  it('Move up and Move down are the same move, one place at a time', () => {
    const items = [todo('a', 0, 0), todo('b', 1, 0), todo('c', 2, 0)];
    expect(stepWithin(items, 'b', 1, 'none')).toEqual(moveWithin(items, 'b', 2, 'none'));
    expect(stepWithin(items, 'a', -1, 'none')).toBe(null);
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

describe('a to-do written on a day that has not come yet here (another time zone, a device a day ahead)', () => {
  const made = (o: Partial<Todo>): Todo => ({ id: 'x', text: 'x', note: null, priority: 0, color: null, groupId: null, due: null, bucket: 'today', position: 0, createdOn: '2026-11-12', doneOn: null, deletedOn: null, createdAt: '', ...o });
  const now = '2026-11-12';
  const ahead = made({ id: 'a', createdOn: '2026-11-13' });
  it('shows today and from today on: it is never hidden until the date catches up', () => {
    expect(liveOn([ahead], '2026-11-12', now)).toEqual([ahead]);
    expect(liveOn([ahead], '2026-11-13', now)).toEqual([ahead]);
    expect(groupsOn([ahead], '2026-11-12', now)[0]!.items).toEqual([ahead]);
    expect(todayOpenOn([ahead], '2026-11-12', now)).toEqual([ahead]);
  });
  it('still was not there on the days before today', () => {
    expect(liveOn([ahead], '2026-11-11', now)).toEqual([]);
  });
  it('a to-do written on its own day is untouched: there from that day, not before', () => {
    const t = made({ id: 'b', createdOn: '2026-11-10' });
    expect(liveOn([t], '2026-11-09', now)).toEqual([]);
    expect(liveOn([t], '2026-11-10', now)).toEqual([t]);
    // a page ahead of today shows what exists by then, and nothing written after it
    const later = made({ id: 'c', createdOn: '2026-11-20' });
    expect(liveOn([later], '2026-11-15', '2026-11-25')).toEqual([]);
  });
});
