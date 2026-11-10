import type { Todo } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { cardsFor, focusGrid, focusOf, splitFocus, type Card } from './model';

const card = (id: string, done = false): Card => ({ ref: `todo:${id}`, kind: 'todo', todo: { id } as Todo, done });

describe('the day’s to-dos as one list', () => {
  it('keeps the open ones in order, then what got done; the goal’s steps stay out', () => {
    const step = { ref: 'step:g:s', kind: 'step', done: false } as Card;
    expect(focusOf([step, card('a', true), card('b'), card('c')]).map((c) => c.ref)).toEqual(['todo:b', 'todo:c', 'todo:a']);
  });
  it('the first three open ones are the priorities; checking one moves the next up into them', () => {
    const list = ['a', 'b', 'c', 'd', 'e'].map((x) => card(x));
    expect(splitFocus(list).top.map((c) => c.ref)).toEqual(['todo:a', 'todo:b', 'todo:c']);
    const after = focusOf([card('a', true), ...list.slice(1)]);
    const s = splitFocus(after);
    expect(s.top.map((c) => c.ref)).toEqual(['todo:b', 'todo:c', 'todo:d']);
    expect(s.rest.map((c) => c.ref)).toEqual(['todo:e']);
    expect(s.done.map((c) => c.ref)).toEqual(['todo:a']);
  });
});

describe('the focus list as grid rows', () => {
  /** every grid row in use: the head, the empty line, each card, the fold and the fold-away row */
  const rowsOf = (g: ReturnType<typeof focusGrid>) => [1, g.emptyRow, ...[...g.top, ...g.rest, ...g.done].map((s) => s.row), g.foldRow, g.hideRow].filter(Boolean);
  const noShared = (g: ReturnType<typeof focusGrid>) => expect(new Set(rowsOf(g)).size).toBe(rowsOf(g).length);
  it('with every to-do done, the empty line and the fold row sit on rows of their own', () => {
    const g = focusGrid([card('a', true), card('b', true)], false, false);
    expect(g.emptyRow).toBe(2);
    expect(g.foldRow).toBe(3);
    expect(g.boxEnd).toBe(3);
    noShared(g);
    const open = focusGrid([card('a', true), card('b', true)], true, false);
    expect(open.done.map((s) => s.row)).toEqual([4, 5]);
    expect(open.hideRow).toBe(6);
    noShared(open);
  });
  it('numbers the open rows in order and gives no part a shared row, folded or open', () => {
    const list = focusOf([...['a', 'b', 'c', 'd', 'e'].map((x) => card(x)), card('z', true)]);
    const folded = focusGrid(list, false, false);
    expect(folded.top.map((s) => [s.row, s.rank])).toEqual([[2, 1], [3, 2], [4, 3]]);
    expect(folded.emptyRow).toBe(0);
    expect(folded.boxEnd).toBe(5);
    expect(folded.foldRow).toBe(5);
    expect(folded.rest).toEqual([]);
    noShared(folded);
    const open = focusGrid(list, true, false);
    expect(open.rest.map((s) => [s.row, s.rank])).toEqual([[6, 4], [7, 5]]);
    expect(open.done.map((s) => [s.row, s.rank])).toEqual([[8, undefined]]);
    expect(open.hideRow).toBe(9);
    noShared(open);
    // a row in the air: everything shows, and nothing offers to fold it away
    expect(focusGrid(list, true, true).hideRow).toBe(0);
  });
  it('an empty day has the empty line and nothing to fold', () => {
    const g = focusGrid([], false, false);
    expect([g.emptyRow, g.foldRow, g.hideRow]).toEqual([2, 0, 0]);
  });
});

describe('what was done does not carry over', () => {
  const t = (id: string, over: Partial<Todo>): Todo => ({ id, text: id, note: null, priority: 0, color: null, groupId: null, due: null, bucket: 'today', position: 0, createdOn: '2026-11-01', doneOn: null, deletedOn: null, createdAt: '2026-11-01T08:00:00Z', ...over }) as Todo;
  const todos = [t('open', {}), t('doneYesterday', { doneOn: '2026-11-08' }), t('doneToday', { doneOn: '2026-11-09' })];
  it('shows today only what is open and what was done today', () => {
    const refs = cardsFor(todos, null, '2026-11-09', '2026-11-09').map((c) => (c.kind === 'todo' ? c.todo.id : ''));
    expect(refs).toEqual(['open', 'doneToday']);
  });
  it('leaves yesterday’s done items on yesterday', () => {
    const refs = cardsFor(todos, null, '2026-11-08', '2026-11-09').map((c) => (c.kind === 'todo' ? c.todo.id : ''));
    expect(refs).toContain('doneYesterday');
    expect(refs).not.toContain('doneToday');
  });
});
