import type { Todo } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { todoOf, todosOf } from './shapes';

const todo = (o: Record<string, unknown> = {}) => ({ id: 't1', text: 'Call the bank', note: null, priority: 0, color: null, groupId: null, due: null, bucket: 'today', position: 3, createdOn: '2026-11-12', doneOn: null, deletedOn: null, createdAt: '2026-11-12T08:00:00Z', ...o });

describe('to-dos as the app reads them', () => {
  it('a good list comes back as it is: the same list, the same rows', () => {
    const list = [todo(), todo({ id: 't2', bucket: 'later', due: '2026-11-13', doneOn: '2026-11-12', note: 'n', priority: 3 })];
    expect(todosOf(list)).toBe(list);
  });
  it('anything that is not a list reads as no to-dos', () => {
    for (const raw of [undefined, null, 7, 'x', { error: 'nope' }, { 0: todo(), length: 1 }]) expect(todosOf(raw)).toEqual([]);
  });
  it('rows that cannot be a to-do are left out; the good ones keep their identity', () => {
    const good = todo();
    const out = todosOf([null, 7, 'x', [], {}, todo({ id: '' }), todo({ id: 5 }), todo({ text: null }), todo({ text: '   ' }), good]);
    expect(out).toHaveLength(1);
    expect(out[0]).toBe(good);
  });
  it('a field in a shape the app never wrote takes its plain default', () => {
    const t = todoOf(todo({ note: 5, priority: 9, color: 1, groupId: {}, due: 'friday', position: 'x', createdOn: null, doneOn: 'yes', deletedOn: 0, createdAt: null }))!;
    expect(t).toMatchObject({ id: 't1', text: 'Call the bank', note: null, priority: 0, color: null, groupId: null, due: null, position: 0, createdOn: '1970-01-01', doneOn: null, deletedOn: null, createdAt: '' } satisfies Partial<Todo>);
    // with no day of its own it takes the day it was written, when that is known
    expect(todoOf(todo({ createdOn: undefined }))!.createdOn).toBe('2026-11-12');
    expect(todoOf(todo({ position: Number.NaN }))!.position).toBe(0);
  });
});

describe('a month as the app reads it', () => {
  const session = (o: Record<string, unknown> = {}) => ({ id: 's1', date: '2026-11-12', position: 0, kind: 'run', type: 'Easy', title: null, details: null, miles: 4, minutes: null, blockId: null, movedFrom: null, mark: null, ...o });
  const month = (o: Record<string, unknown> = {}) => ({ month: '2026-11', sessions: [session()], checks: [{ habitId: 'h1', date: '2026-11-12', done: true, note: null }], lifts: [], activities: [], morningDays: {}, journal: [], coach: [], ...o });

  it('a good month reads as it came', async () => {
    const { monthBundleOf } = await import('./shapes');
    const m = month();
    expect(monthBundleOf(m, '2026-11')).toEqual(m);
  });
  it('an answer that is not a month is refused (a failed request: the last good copy stays)', async () => {
    const { monthBundleOf } = await import('./shapes');
    // not an object, or an object with no list of sessions: showing it as an empty month would hide the plan
    for (const raw of [null, undefined, 'nope', 7, [], [month()], {}, { error: 'x' }, month({ sessions: null }), month({ sessions: 'x' })]) expect(() => monthBundleOf(raw, '2026-11')).toThrow(/Unexpected answer/);
  });
  it('a list that is missing or not a list reads as empty, and the month keeps its name', async () => {
    const { monthBundleOf } = await import('./shapes');
    expect(monthBundleOf({ sessions: [] }, '2026-11')).toEqual({ month: '2026-11', sessions: [], checks: [], lifts: [], activities: [], morningDays: {}, journal: [], coach: [] });
    expect(monthBundleOf(month({ sessions: [], activities: 'x', checks: null, journal: {}, lifts: 5, coach: undefined, morningDays: [] }), '2026-11')).toMatchObject({ sessions: [], activities: [], checks: [], journal: [], lifts: [], coach: [], morningDays: {} });
  });
  it('rows that cannot be read are left out; odd fields of a session take their defaults', async () => {
    const { monthBundleOf } = await import('./shapes');
    const out = monthBundleOf(month({ sessions: [null, 7, { id: 'zz' }, session({ id: 's2', date: 'friday' }), session({ id: 's3', kind: 7 }), session({ id: 's4', title: { a: 1 }, type: ['x'], details: 5, miles: 'x', minutes: {}, position: 'first', mark: 'maybe' })], activities: [null, { id: 'a1', date: '2026-11-12', kind: 'run', miles: null, movingSec: 'x', name: null, time: 7, polyline: {} }], checks: [null, { habitId: 'h1' }, { habitId: 'h1', date: '2026-11-12', done: 1, note: {} }], journal: [{ id: 'j1', date: '2026-11-12', text: null }, { id: 'j2', date: '2026-11-12', text: 'Fine', createdAt: 'x', editedAt: null, fav: false }] }), '2026-11');
    expect(out.sessions).toEqual([session({ id: 's4', title: null, type: null, details: null, miles: null, minutes: null, position: 0, mark: null })]);
    expect(out.activities).toMatchObject([{ id: 'a1', miles: 0, movingSec: 0, name: '', time: null, polyline: null }]);
    expect(out.checks).toEqual([{ habitId: 'h1', date: '2026-11-12', done: true, note: null }]);
    expect(out.journal.map((j) => j.id)).toEqual(['j2']);
  });
});
