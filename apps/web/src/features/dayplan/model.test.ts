import type { Todo } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { pathSegments, stopStates } from '@/ui/poster/logic';
import { cardsFor, countWords, ECHO_MS, ECHO_PX, focusOf, isEcho, leftWords, openOnLine, pathOf, pickCaption, picksFor, splitFocus, waitingOn, type Card } from './model';

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

describe('the line while a to-do is dragged', () => {
  const p = pathOf(focusOf([card('z', true), ...['a', 'b', 'c', 'd'].map((x) => card(x))]));
  const ids = (cs: Card[]) => cs.map((c) => (c.kind === 'todo' ? c.todo.id : c.ref));
  it('draws the open stops in the drag’s order; with none, the data’s', () => {
    expect(ids(openOnLine(p, ['c', 'a', 'b']))).toEqual(['c', 'a', 'b']);
    expect(ids(openOnLine(p, null))).toEqual(['a', 'b', 'c']);
  });
  it('lights whichever open to-do is first now; the done ones stay behind it, the line solid up to it', () => {
    const open = openOnLine(p, ['c', 'a', 'b']);
    const states = stopStates([...p.done.map(() => true), ...open.map(() => false)]);
    expect(states).toEqual(['done', 'next', 'ahead', 'ahead']);
    expect(ids([...p.done, ...open])[1]).toBe('c');
    expect(pathSegments(states).map((s) => `${s.in}/${s.out}`)).toEqual(['solid/solid', 'solid/dots', 'dots/dots', 'dots/none']);
  });
  it('never takes in a to-do past the three on the surface (they wait behind All to-dos)', () => {
    expect(ids(openOnLine(p, ['d', 'c', 'b', 'a']))).toEqual(['c', 'b', 'a']);
  });
});

describe('an empty line proposes the next move', () => {
  // 2026-11-16 is a Monday
  const T = '2026-11-16';
  const t = (id: string, over: Partial<Todo> = {}): Todo => ({ id, text: id, note: null, priority: 0, color: null, groupId: null, due: null, bucket: 'today', position: 0, createdOn: '2026-11-10', doneOn: null, deletedOn: null, createdAt: '2026-11-10T08:00:00Z', ...over }) as Todo;
  const ids = (xs: { todo: Todo }[]) => xs.map((p) => p.todo.id);
  const onDay = (todos: Todo[], date: string) => cardsFor(todos, null, date, T).flatMap((c) => (c.kind === 'todo' ? [c.todo.id] : []));
  const soon = (id: string, due: string, position = 0) => t(id, { bucket: 'later', due, position });
  const someday = (id: string, priority: 0 | 1 | 2 | 3 = 0) => t(id, { bucket: 'someday', priority });

  it('today: what is dated in the next three days, by date, then Someday; at most three', () => {
    const todos = [someday('bread'), soon('offsite', '2026-11-19'), soon('passport', '2026-11-18'), soon('far', '2026-11-20'), someday('dune', 3)];
    expect(ids(picksFor(todos, T, T, onDay(todos, T)))).toEqual(['passport', 'offsite', 'dune']);
    expect(ids(picksFor([someday('bread'), someday('dune', 3)], T, T, []))).toEqual(['dune', 'bread']);
  });
  it('today: a to-do carried from an earlier day is already on the line, so it is never a pick', () => {
    const todos = [t('carried', { createdOn: '2026-11-14' }), soon('passport', '2026-11-18')];
    expect(ids(picksFor(todos, T, T, onDay(todos, T)))).toEqual(['passport']);
  });
  it('a day ahead: today’s open to-dos (carried) first, then dated soon after that day, then Someday', () => {
    const D = '2026-11-17';
    const todos = [someday('bread'), soon('wed', '2026-11-18'), t('landlord', { createdOn: '2026-11-14' }), t('gas', { createdOn: '2026-11-15', position: 1 }), soon('mine', D)];
    const picks = picksFor(todos, D, T, onDay(todos, D));
    expect(ids(picks)).toEqual(['landlord', 'gas', 'wed']);
    expect(picks.map((p) => p.from)).toEqual(['carried', 'carried', 'soon']);
  });
  it('never offers one twice, nor one already on the day, nor one done or deleted', () => {
    const D = '2026-11-17';
    const todos = [soon('mine', D), t('done', { doneOn: T }), t('gone', { deletedOn: T }), someday('bread'), someday('bread2')];
    const picks = picksFor(todos, D, T, onDay(todos, D));
    expect(ids(picks)).toEqual(['bread', 'bread2']);
    expect(new Set(ids(picks)).size).toBe(picks.length);
  });
  it('a past day offers nothing: it shows what it had', () => {
    expect(picksFor([someday('bread'), soon('passport', '2026-11-18')], '2026-11-15', T, [])).toEqual([]);
  });
  it('nothing to pick is no picks', () => {
    expect(picksFor([], T, T, [])).toEqual([]);
    expect(picksFor(undefined, T, T, [])).toEqual([]);
  });
  it('says where each came from in a short caption', () => {
    expect(pickCaption({ todo: someday('bread'), from: 'someday' }, T)).toBe('Someday');
    expect(pickCaption({ todo: soon('x', '2026-11-17'), from: 'soon' }, T)).toBe('Tomorrow');
    expect(pickCaption({ todo: soon('x', '2026-11-19'), from: 'soon' }, T)).toBe('Thursday');
    expect(pickCaption({ todo: soon('x', '2026-11-25'), from: 'soon' }, T)).toBe('Nov 25');
    expect(pickCaption({ todo: t('x', { createdOn: '2026-11-15' }), from: 'carried' }, T)).toBe('From yesterday');
    expect(pickCaption({ todo: t('x', { createdOn: T }), from: 'carried' }, T)).toBe('From today');
    expect(pickCaption({ todo: t('x', { createdOn: '2026-11-12' }), from: 'carried' }, T)).toBe('From Thursday');
    expect(pickCaption({ todo: t('x', { createdOn: '2026-11-02' }), from: 'carried' }, T)).toBe('From Nov 2');
    // a dated to-do whose day has passed came from its day, not the day it was written
    expect(pickCaption({ todo: t('x', { bucket: 'later', due: '2026-11-15', createdOn: '2026-11-01' }), from: 'carried' }, T)).toBe('From yesterday');
  });
  it('says something waits whenever anything open is on another day, on today and on a day ahead', () => {
    const D = '2026-11-17';
    const wait = (todos: Todo[], date: string) => waitingOn(todos, date, T, cardsFor(todos, null, date, T));
    // nothing anywhere, or only what is on the day: nothing waits
    expect(wait([], T)).toBe(false);
    expect(wait([], D)).toBe(false);
    expect(wait([soon('mine', D)], D)).toBe(false);
    expect(wait([t('here', { createdOn: T })], T)).toBe(false);
    // further out than the picks look, on today and on a day ahead
    expect(wait([soon('far', '2026-11-30')], T)).toBe(true);
    expect(wait([soon('far', '2026-11-30')], D)).toBe(true);
    // a day ahead: today's list and a day between today and it are other days too
    expect(wait([t('today', { createdOn: T })], D)).toBe(true);
    expect(wait([soon('between', D)], '2026-11-19')).toBe(true);
    expect(wait([someday('bread')], D)).toBe(true);
    // done or deleted waits for nothing
    expect(wait([t('done', { createdOn: T, doneOn: T }), t('gone', { createdOn: T, deletedOn: T })], D)).toBe(false);
  });
});

