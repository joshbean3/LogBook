import type { Aim, Todo } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { aimOf, aimsOf, todoOf, todosOf } from './shapes';

const todo = (o: Record<string, unknown> = {}) => ({ id: 't1', text: 'Call the bank', note: null, priority: 0, color: null, groupId: null, due: null, bucket: 'today', position: 3, createdOn: '2026-11-12', doneOn: null, deletedOn: null, createdAt: '2026-11-12T08:00:00Z', ...o });
const aim = (o: Record<string, unknown> = {}) => ({ id: 'g1', level: 'day', period: '2026-11-12', text: 'Ship it', original: null, why: null, status: 'open', reflection: null, steps: [{ id: 's1', text: 'Outline', done: false }], createdAt: '', updatedAt: '', closedAt: null, ...o });

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

describe('goals as the app reads them', () => {
  it('a good list comes back as it is', () => {
    const list = [aim(), aim({ id: 'g2', level: 'week', period: '2026-W46', status: 'partly', why: 'w' })];
    expect(aimsOf(list)).toBe(list);
  });
  it('anything that is not a list reads as no goals', () => {
    for (const raw of [undefined, null, 7, { error: 'nope' }]) expect(aimsOf(raw)).toEqual([]);
  });
  it('rows that cannot be a goal are left out', () => {
    const good = aim();
    const out = aimsOf([null, {}, aim({ id: null }), aim({ text: null }), aim({ text: 42 }), aim({ level: 'decade' }), aim({ period: null }), good]);
    expect(out).toEqual([good]);
    expect(out[0]).toBe(good);
  });
  it('a goal from before steps existed has none, and odd fields take their defaults', () => {
    expect(aimOf(aim({ steps: undefined }))!.steps).toEqual([]);
    const g = aimOf(aim({ steps: [null, { id: 's1' }, { id: 's2', text: 'Keep', done: 1 }, { id: 's3', text: 'Fine', done: false }], status: 'paused', why: 5, reflection: {}, original: 0 }))!;
    expect(g).toMatchObject({ status: 'open', why: null, reflection: null, original: null, steps: [{ id: 's2', text: 'Keep', done: true }, { id: 's3', text: 'Fine', done: false }] } satisfies Partial<Aim>);
  });
});
