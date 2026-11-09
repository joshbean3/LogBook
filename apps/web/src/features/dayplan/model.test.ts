import type { Todo } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { cardsFor, focusOf, splitFocus, type Card } from './model';

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
