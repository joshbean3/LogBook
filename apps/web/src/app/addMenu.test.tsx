import type { Aim, ISODate } from '@logbook/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { crossfade, fadeIn, fadeOut, reducedFade, springs } from '@/lib/motion';
import { AddButton, AddCard } from './AddParts';
import { addMotion, addOrder, addPlace, ADD_ROWS, ADD_STAGGER_S, createAddMenu, goalToOpen, keyStep, runAdd, type AddFlows, type AddHaptic, type AddKind } from './addMenu';

const ALL = { fitness: true, todos: true, habits: true };
const T = '2026-11-15' as ISODate; // a Sunday; its week began Monday, November 9

describe('the add menu’s rows, by where the person is', () => {
  it('leads with the to-do on Today, and with the thing the tab is about everywhere else', () => {
    expect(addOrder('today', ALL)).toEqual(['todo', 'goal', 'session', 'habit', 'entry']);
    expect(addOrder('goals', ALL)).toEqual(['goal', 'todo', 'session', 'habit', 'entry']);
    expect(addOrder('plan', ALL)).toEqual(['session', 'todo', 'goal', 'habit', 'entry']);
    expect(addOrder('journal', ALL)).toEqual(['entry', 'todo', 'goal', 'session', 'habit']);
  });

  it('never offers a session with Fitness off, on any tab', () => {
    for (const tab of ['today', 'goals', 'plan', 'journal'] as const) expect(addOrder(tab, { ...ALL, fitness: false })).not.toContain('session');
    expect(addOrder('today', { ...ALL, fitness: false })).toEqual(['todo', 'goal', 'habit', 'entry']);
  });

  it('leaves out a to-do or a habit when Today does not show its section, and always keeps a goal and an entry', () => {
    expect(addOrder('today', { fitness: true, todos: false, habits: true })).toEqual(['goal', 'session', 'habit', 'entry']);
    expect(addOrder('today', { fitness: true, todos: true, habits: false })).toEqual(['todo', 'goal', 'session', 'entry']);
    expect(addOrder('journal', { fitness: false, todos: false, habits: false })).toEqual(['entry', 'goal']);
  });

  it('names things, in a word or two, in the app’s own words', () => {
    expect(Object.fromEntries(Object.entries(ADD_ROWS).map(([k, v]) => [k, v.label]))).toEqual({ todo: 'To-do', goal: 'Goal', session: 'Session', habit: 'Habit', entry: 'Journal entry' });
    for (const { label } of Object.values(ADD_ROWS)) {
      expect(label.split(' ').length).toBeLessThanOrEqual(2);
      expect(label).not.toMatch(/—|assistant|workout/i);
    }
  });
});

describe('the day and the week a row adds to', () => {
  const at = (active: 'today' | 'goals' | 'plan' | 'journal', todayPath = '/today', planPath = '/plan') => addPlace({ active, todayPath, planPath, today: T });

  it('is the day Today’s pager shows, while Today is the tab', () => {
    expect(at('today')).toEqual({ day: T, week: null });
    expect(at('today', '/today/2026-11-18')).toEqual({ day: '2026-11-18', week: null });
    expect(at('today', '/today/2026-11-12/morning')).toEqual({ day: '2026-11-12', week: null });
  });

  it('is today from any other tab, whatever day Today was left on', () => {
    expect(at('goals', '/today/2026-11-18').day).toBe(T);
    expect(at('journal', '/today/2026-11-18').day).toBe(T);
  });

  it('is the week Fitness shows, while Fitness is the tab', () => {
    expect(at('plan')).toEqual({ day: T, week: '2026-11-09' });
    expect(at('plan', '/today', '/plan/week/2026-11-23').week).toBe('2026-11-23');
    // the month view goes back to this week in this month, and to a later month's first week
    expect(at('plan', '/today', '/plan/month/2026-11-01').week).toBe('2026-11-09');
    expect(at('plan', '/today', '/plan/month/2026-12-01').week).toBe('2026-11-30');
  });
});

describe('the goal the Goal row opens', () => {
  const aim = (level: Aim['level'], period: string) => ({ level, period }) as Aim;

  it('is the nearest level with nothing set: the day, this week, this month, this year', () => {
    expect(goalToOpen([], T, T)).toEqual({ level: 'day', period: T });
    expect(goalToOpen([aim('day', T)], T, T)).toEqual({ level: 'week', period: '2026-11-09' });
    expect(goalToOpen([aim('day', T), aim('week', '2026-11-09')], T, T)).toEqual({ level: 'month', period: '2026-11' });
    expect(goalToOpen([aim('day', T), aim('week', '2026-11-09'), aim('month', '2026-11')], T, T)).toEqual({ level: 'year', period: '2026' });
  });

  it('is the shown day’s goal on a day ahead, and today’s on a day that is over', () => {
    expect(goalToOpen([aim('day', T)], '2026-11-18' as ISODate, T)).toEqual({ level: 'day', period: '2026-11-18' });
    expect(goalToOpen([], '2026-11-12' as ISODate, T)).toEqual({ level: 'day', period: T });
  });

  it('opens the day’s goal when all four are set, and while the goals are not read yet', () => {
    expect(goalToOpen([aim('day', T), aim('week', '2026-11-09'), aim('month', '2026-11'), aim('year', '2026')], T, T)).toEqual({ level: 'day', period: T });
    expect(goalToOpen(undefined, T, T)).toEqual({ level: 'day', period: T });
  });
});

describe('each row opens the app’s own flow, for the day the screen shows', () => {
  const flows = () => ({ todo: vi.fn(), goal: vi.fn(), session: vi.fn(), habit: vi.fn(), entry: vi.fn() }) satisfies AddFlows;
  const read = { goals: [] as Aim[], pickDay: (mon: ISODate) => `${mon}+pick` };

  it('on today: the To-dos sheet, today’s goal, a session today, a habit, the entry writer', () => {
    const f = flows();
    const place = { day: T, week: null };
    for (const k of ['todo', 'goal', 'session', 'habit', 'entry'] as AddKind[]) runAdd(k, place, T, f, read);
    expect(f.todo).toHaveBeenCalledExactlyOnceWith(null);
    expect(f.goal).toHaveBeenCalledExactlyOnceWith('day', T);
    expect(f.session).toHaveBeenCalledExactlyOnceWith('2026-11-09', T);
    expect(f.habit).toHaveBeenCalledOnce();
    expect(f.entry).toHaveBeenCalledOnce();
  });

  it('on a day ahead in Today’s pager: the to-do is for that day, the goal is that day’s, the session is on it', () => {
    const f = flows();
    const place = { day: '2026-11-18' as ISODate, week: null };
    for (const k of ['todo', 'goal', 'session'] as AddKind[]) runAdd(k, place, T, f, read);
    expect(f.todo).toHaveBeenCalledWith('2026-11-18');
    expect(f.goal).toHaveBeenCalledWith('day', '2026-11-18');
    expect(f.session).toHaveBeenCalledWith('2026-11-16', '2026-11-18');
  });

  it('on a day that is over: a session is added to that day, a to-do and a goal to today', () => {
    const f = flows();
    const place = { day: '2026-11-12' as ISODate, week: null };
    for (const k of ['todo', 'goal', 'session'] as AddKind[]) runAdd(k, place, T, f, read);
    expect(f.todo).toHaveBeenCalledWith(null);
    expect(f.goal).toHaveBeenCalledWith('day', T);
    expect(f.session).toHaveBeenCalledWith('2026-11-09', '2026-11-12');
  });

  it('on Fitness: the session goes to the week it shows, on the day that week’s own Add would pick', () => {
    const f = flows();
    runAdd('session', { day: T, week: '2026-11-23' as ISODate }, T, f, read);
    expect(f.session).toHaveBeenCalledExactlyOnceWith('2026-11-23', '2026-11-23+pick');
  });
});

describe('the menu’s behavior', () => {
  const make = () => {
    const haptics: AddHaptic[] = [];
    const chosen: number[] = [];
    const menu = createAddMenu({ haptic: (e) => haptics.push(e), choose: (i) => chosen.push(i) });
    return { menu, haptics, chosen };
  };

  it('opens on the press, with one lift', () => {
    const { menu, haptics } = make();
    menu.pressButton();
    expect(menu.get()).toEqual({ open: true, lit: -1 });
    expect(haptics).toEqual(['lift']);
  });

  it('a plain tap leaves it open, and a tap on a row chooses it with one select', () => {
    const { menu, haptics, chosen } = make();
    menu.pressButton();
    menu.release({ on: 'button' });
    expect(menu.get().open).toBe(true);
    // the second tap: down on the row, up on the row, then the row's own click
    menu.pressCard(2);
    expect(menu.get().lit).toBe(2);
    menu.release({ on: 'row', index: 2 });
    menu.clickRow(2);
    expect(chosen).toEqual([2]);
    expect(menu.get()).toEqual({ open: false, lit: -1 });
    expect(haptics).toEqual(['lift', 'select']);
  });

  it('press, slide over the rows and let go: each row crossed lights with a tick, and the one under the finger is chosen', () => {
    const { menu, haptics, chosen } = make();
    menu.pressButton();
    menu.move({ on: 'button' });
    expect(menu.get().lit).toBe(-1);
    menu.move({ on: 'row', index: 0 });
    menu.move({ on: 'row', index: 0 });
    expect(menu.get().lit).toBe(0);
    menu.move({ on: 'row', index: 1 });
    menu.move({ on: 'row', index: 2 });
    expect(menu.get().lit).toBe(2);
    menu.release({ on: 'row', index: 2 });
    expect(chosen).toEqual([2]);
    expect(menu.get().open).toBe(false);
    expect(haptics).toEqual(['lift', 'tick', 'tick', 'tick', 'select']);
  });

  it('a row lets go of its light when the finger leaves it, and lights again with a tick on the way back', () => {
    const { menu, haptics } = make();
    menu.pressButton();
    menu.move({ on: 'row', index: 1 });
    menu.move({ on: 'card' });
    expect(menu.get().lit).toBe(-1);
    menu.move({ on: 'row', index: 1 });
    expect(haptics).toEqual(['lift', 'tick', 'tick']);
  });

  it('letting go outside the card closes it, with nothing chosen and no haptic', () => {
    const { menu, haptics, chosen } = make();
    menu.pressButton();
    menu.move({ on: 'row', index: 1 });
    menu.move({ on: 'outside' });
    menu.release({ on: 'outside' });
    expect(menu.get()).toEqual({ open: false, lit: -1 });
    expect(chosen).toEqual([]);
    expect(haptics).toEqual(['lift', 'tick']);
  });

  it('a press that began on a row and ends outside only lets the row go', () => {
    const { menu, chosen } = make();
    menu.pressButton();
    menu.release({ on: 'button' });
    menu.pressCard(1);
    menu.move({ on: 'outside' });
    menu.release({ on: 'outside' });
    expect(menu.get()).toEqual({ open: true, lit: -1 });
    expect(chosen).toEqual([]);
  });

  it('a second press on the button puts it away with one drop; the veil, Escape and Back close it in silence', () => {
    const a = make();
    a.menu.pressButton();
    a.menu.release({ on: 'button' });
    a.menu.pressButton();
    expect(a.menu.get().open).toBe(false);
    expect(a.haptics).toEqual(['lift', 'drop']);
    // nothing follows the finger of the press that closed it
    a.menu.move({ on: 'row', index: 0 });
    a.menu.release({ on: 'row', index: 0 });
    expect(a.chosen).toEqual([]);

    const b = make();
    b.menu.pressButton();
    b.menu.dismiss();
    expect(b.menu.get().open).toBe(false);
    expect(b.haptics).toEqual(['lift']);
  });

  it('the keyboard’s click toggles it, and a row’s click chooses once', () => {
    const { menu, haptics, chosen } = make();
    menu.toggle();
    expect(menu.get().open).toBe(true);
    menu.clickRow(0);
    menu.clickRow(0);
    expect(chosen).toEqual([0]);
    menu.toggle();
    menu.toggle();
    expect(haptics).toEqual(['lift', 'select', 'lift', 'drop']);
  });

  it('a touch the system takes chooses nothing and closes nothing', () => {
    const { menu, chosen } = make();
    menu.pressButton();
    menu.move({ on: 'row', index: 3 });
    menu.cancel();
    expect(menu.get()).toEqual({ open: true, lit: -1 });
    menu.release({ on: 'row', index: 3 });
    expect(chosen).toEqual([]);
  });

  it('tells its listeners only when something changed', () => {
    const { menu } = make();
    const heard = vi.fn();
    menu.subscribe(heard);
    menu.pressButton();
    menu.move({ on: 'button' });
    menu.move({ on: 'row', index: 0 });
    menu.move({ on: 'row', index: 0 });
    expect(heard).toHaveBeenCalledTimes(2);
  });
});

describe('the keys, with rows counted from the button', () => {
  it('Escape and Tab close it', () => {
    expect(keyStep('Escape', 0, 5)).toEqual({ close: true });
    expect(keyStep('Tab', 2, 5)).toEqual({ close: true });
  });

  it('Up moves away from the button, Down toward it, and both wrap', () => {
    expect(keyStep('ArrowUp', 0, 5)).toEqual({ focus: 1 });
    expect(keyStep('ArrowUp', 4, 5)).toEqual({ focus: 0 });
    expect(keyStep('ArrowDown', 1, 5)).toEqual({ focus: 0 });
    expect(keyStep('ArrowDown', 0, 5)).toEqual({ focus: 4 });
    expect(keyStep('ArrowUp', -1, 5)).toEqual({ focus: 0 });
  });

  it('Home is the top row, End the row by the button, and any other key is the page’s', () => {
    expect(keyStep('Home', 2, 5)).toEqual({ focus: 4 });
    expect(keyStep('End', 2, 5)).toEqual({ focus: 0 });
    expect(keyStep('Enter', 2, 5)).toBeNull();
    expect(keyStep('a', 2, 5)).toBeNull();
  });
});

describe('its motion', () => {
  const rowOpen = (m: ReturnType<typeof addMotion>, i: number) => {
    const open = m.row.open;
    return (typeof open === 'function' ? open(i, {}, {}) : open) as { opacity: unknown; transform: unknown; transition: Record<string, { delay?: number }> };
  };

  it('opens on the settle spring: the card from the button, the plus on the same spring, each row 30 ms after the one below it', () => {
    const m = addMotion(false);
    expect(m.card.open).toMatchObject({ opacity: [0, 1], transform: ['scale(0.4)', 'scale(1)'], transition: { transform: springs.settle, opacity: fadeIn } });
    expect(m.glyph).toEqual({ turn: 45, open: springs.settle, closed: crossfade });
    expect(rowOpen(m, 0).transform).toEqual(['translateY(8px)', 'translateY(0px)']);
    expect(rowOpen(m, 0).transition.transform).toMatchObject({ ...springs.settle, delay: 0 });
    expect(rowOpen(m, 3).transition.transform!.delay).toBeCloseTo(3 * ADD_STAGGER_S);
    expect(rowOpen(m, 3).transition.opacity).toMatchObject({ ...fadeIn, delay: 3 * ADD_STAGGER_S });
    expect(ADD_STAGGER_S).toBe(0.03);
  });

  it('closes faster than it opens: one 100 ms fade', () => {
    const m = addMotion(false);
    expect(m.card.closed).toEqual({ opacity: 0, transform: 'scale(0.9)', transition: fadeOut });
    expect(m.veil.closed).toEqual({ opacity: 0, transition: fadeOut });
  });

  it('moves only transform and opacity', () => {
    const m = addMotion(false);
    const keys = (v: object) => Object.keys(v).filter((k) => k !== 'transition');
    for (const v of [m.card.open, m.card.closed, m.veil.open, m.veil.closed, rowOpen(m, 1)]) for (const k of keys(v as object)) expect(['transform', 'opacity']).toContain(k);
  });

  it('under Reduce Motion is one 150 ms fade: no scale, no rise, no stagger, no turn', () => {
    const m = addMotion(true);
    expect(JSON.stringify(m)).not.toMatch(/scale|translate|rotate|delay|stiffness/);
    expect(m.card.open).toEqual({ opacity: 1, transform: 'none', transition: { opacity: reducedFade, transform: { duration: 0 } } });
    expect(m.card.closed).toEqual({ opacity: 0, transform: 'none', transition: { opacity: reducedFade, transform: { duration: 0 } } });
    expect(m.veil).toEqual({ open: { opacity: 1, transition: reducedFade }, closed: { opacity: 0, transition: reducedFade } });
    expect(rowOpen(m, 4)).toEqual({ opacity: 1, transform: 'none', transition: { duration: 0 } });
    expect(m.glyph).toEqual({ turn: 0, open: reducedFade, closed: reducedFade });
    expect(reducedFade).toEqual({ duration: 0.15, ease: 'linear' });
  });
});

describe('what is drawn', () => {
  const m = addMotion(false);

  it('the button is a real button named Add that says whether its menu is open', () => {
    const shut = renderToStaticMarkup(<AddButton open={false} m={m.glyph} menuId="m1" />);
    expect(shut).toMatch(/^<button type="button"/);
    expect(shut).toContain('aria-label="Add"');
    expect(shut).toContain('aria-haspopup="menu"');
    expect(shut).toContain('aria-expanded="false"');
    expect(shut).not.toContain('aria-controls');
    const up = renderToStaticMarkup(<AddButton open m={m.glyph} menuId="m1" />);
    expect(up).toContain('aria-expanded="true"');
    expect(up).toContain('aria-controls="m1"');
  });

  it('the menu is a menu named Add whose items are the rows, the likeliest drawn last, by the button', () => {
    const h = renderToStaticMarkup(<AddCard id="m1" rows={addOrder('goals', ALL)} open m={m} />);
    expect(h).toMatch(/^<div id="m1" class="cm-menu add-menu" role="menu" aria-label="Add"/);
    expect([...h.matchAll(/role="menuitem"[^>]*data-i="(\d)" data-kind="(\w+)"/g)].map((x) => `${x[1]}:${x[2]}`)).toEqual(['4:entry', '3:habit', '2:session', '1:todo', '0:goal']);
    expect([...h.matchAll(/<span class="cm-label">([^<]+)<\/span>/g)].map((x) => x[1])).toEqual(['Journal entry', 'Habit', 'Session', 'To-do', 'Goal']);
    // each row: an icon from the set in the app's Haze tile, hidden from VoiceOver, then its words
    expect((h.match(/<span class="icon-tile" aria-hidden="true"><svg/g) ?? []).length).toBe(5);
  });

  it('with Fitness off the menu holds no session', () => {
    const h = renderToStaticMarkup(<AddCard rows={addOrder('today', { ...ALL, fitness: false })} open m={m} />);
    expect(h).not.toMatch(/Session|data-kind="session"/);
    expect((h.match(/role="menuitem"/g) ?? []).length).toBe(4);
  });

  it('under Reduce Motion the button holds both marks, and nothing turns', () => {
    const h = renderToStaticMarkup(<AddButton open={false} m={addMotion(true).glyph} />);
    expect((h.match(/dock-add-face/g) ?? []).length).toBe(2);
    expect(h).not.toContain('rotate');
  });
});
