import type { Todo } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { cardsFor, countWords, ECHO_MS, ECHO_PX, focusOf, isEcho, leftWords, pathOf, splitFocus, type Card } from './model';

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

describe('the path through the day', () => {
  it('shows the first three open to-dos and counts the rest behind All to-dos', () => {
    const p = pathOf(focusOf([...['a', 'b', 'c', 'd', 'e'].map((x) => card(x)), card('z', true)]));
    expect(p.open.map((c) => c.ref)).toEqual(['todo:a', 'todo:b', 'todo:c']);
    expect(p.rest).toBe(2);
    expect(p.done.map((c) => c.ref)).toEqual(['todo:z']);
    expect([p.doneFolded, p.total, p.doneCount]).toEqual([0, 6, 1]);
  });
  it('folds more than two done to-dos into one stop', () => {
    const p = pathOf(focusOf([card('a', true), card('b', true), card('c', true), card('d')]));
    expect(p.done).toEqual([]);
    expect(p.doneFolded).toBe(3);
    expect(p.open.map((c) => c.ref)).toEqual(['todo:d']);
    expect(pathOf([card('a', true), card('b', true)]).done).toHaveLength(2);
  });
  it('leaves the goal’s steps out, and an empty day is empty', () => {
    const step = { ref: 'step:g:s', kind: 'step', done: false } as Card;
    expect(pathOf([step]).total).toBe(0);
    expect(pathOf([])).toEqual({ done: [], doneFolded: 0, open: [], rest: 0, total: 0, doneCount: 0 });
  });
  it('says the count the way the band reads it', () => {
    expect(countWords(1, 3)).toBe('1 of 3 done');
    expect(countWords(3, 3)).toBe('All 3 done');
    expect(countWords(1, 1)).toBe('1 of 1 done');
    expect(countWords(0, 0)).toBeNull();
  });
  it('says the time left in the day', () => {
    expect(leftWords(10 * 60)).toBe('14 h left');
    expect(leftWords(15 * 60)).toBe('9 h left');
    expect(leftWords(23 * 60 + 20)).toBe('40 min left');
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

describe('the day’s order', () => {
  const todo = (id: string, position: number, priority: 0 | 1 | 2 | 3, extra: Partial<Todo> = {}): Todo => ({ id, text: id, note: null, priority, color: null, groupId: null, due: null, bucket: 'today', position, createdOn: '2026-11-01', doneOn: null, deletedOn: null, createdAt: `2026-11-01T00:00:0${position}Z`, ...extra });
  it('is the order set by hand: a flag is a label on a row, never its place', () => {
    const list = [todo('plain', 0, 0), todo('p1', 2, 3), todo('p3', 1, 1)];
    expect(cardsFor(list, null, '2026-11-10', '2026-11-10').map((c) => c.ref)).toEqual(['todo:plain', 'todo:p3', 'todo:p1']);
  });
  it('holds on a day ahead too', () => {
    const list = [todo('b', 1, 3, { bucket: 'later', due: '2026-11-12' }), todo('a', 0, 0, { bucket: 'later', due: '2026-11-12' })];
    expect(cardsFor(list, null, '2026-11-12', '2026-11-10').map((c) => c.ref)).toEqual(['todo:a', 'todo:b']);
  });
});

describe('a second tap that lands on what the first one changed', () => {
  const at = { x: 330, y: 400 };
  it('is dropped on the stop that changed, in the same place, for half a second', () => {
    const last = { id: 't:a', at: 1000, ...at };
    expect(isEcho(last, 't:a', 1080, 330, 400)).toBe(true);
    expect(isEcho(last, 't:a', 1000 + ECHO_MS - 1, 330 + ECHO_PX, 400)).toBe(true);
    expect(isEcho(last, 't:a', 1000 + ECHO_MS, 330, 400)).toBe(false);
  });
  it('a tap somewhere else on the same stop is a new tap: what was just ticked can be un-ticked from its words at once', () => {
    const last = { id: 't:a', at: 1000, ...at };
    expect(isEcho(last, 't:a', 1080, 120, 400)).toBe(false);
    expect(isEcho(last, 't:a', 1080, 330, 400 + ECHO_PX + 1)).toBe(false);
  });
  it('leaves every other stop alone, so the next to-do can be ticked right after', () => {
    const last = { id: 't:a', at: 1000, ...at };
    expect(isEcho(last, 't:b', 1080, 330, 400)).toBe(false);
    expect(isEcho(last, 'add', 1080, 330, 400)).toBe(false);
    expect(isEcho(last, undefined, 1080, 330, 400)).toBe(false);
  });
  it('covers the whole line when the whole line changed (the goal was set, a done to-do reopened)', () => {
    const last = { id: '*', at: 1000, ...at };
    expect(isEcho(last, 't:b', 1080, 330, 400)).toBe(true);
    expect(isEcho(last, 'add', 1300, 340, 410)).toBe(true);
    expect(isEcho(last, undefined, 1300, 330, 400)).toBe(true);
    expect(isEcho(last, 't:b', 1300, 100, 400)).toBe(false);
    expect(isEcho(last, 't:b', 1000 + ECHO_MS, 330, 400)).toBe(false);
  });
  it('is never an echo with nothing changed, or on a clock that went back', () => {
    expect(isEcho(null, 't:a', 5, 0, 0)).toBe(false);
    expect(isEcho({ id: '*', at: 1000, ...at }, 't:a', 900, 330, 400)).toBe(false);
  });
});
