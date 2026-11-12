import type { Aim } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { hillsOf, inviteWords } from './further';
import { localGoalIdea, type IdeaInput } from './goalsIdea.local';
import { eveningNow, listed, todayBand, wallMinutes } from './GoalsHero.logic';

// a Thursday: the week began on Monday Nov 9
const T = '2026-11-12';
const NOW = new Date(`${T}T10:00:00`).getTime();
const g = (level: Aim['level'], period: string, text: string, status: Aim['status'] = 'open', steps: Aim['steps'] = []): Aim => ({ id: `${level}-${period}`, level, period, text, original: null, why: null, status, reflection: null, steps, createdAt: '', updatedAt: '', closedAt: null });
const step = (id: string, done: boolean) => ({ id, text: id, done });

describe('Further out: three hills, far to near', () => {
  it('with nothing set, only this week carries the plus and no hill says "Not set"', () => {
    const [year, month, week] = hillsOf([], T, NOW);
    expect(year).toMatchObject({ level: 'year', state: 'far', caption: '2026' });
    expect(month).toMatchObject({ level: 'month', state: 'far', caption: 'November' });
    expect(week).toMatchObject({ level: 'week', state: 'invite', caption: 'This week · 4 days left', words: 'Set this week’s goal' });
    expect(year.words).toBeUndefined();
    expect(month.words).toBeUndefined();
    expect(JSON.stringify([year, month, week])).not.toMatch(/not set/i);
  });

  it('writes a set goal on its hill with the time left and its steps done', () => {
    const goals = [g('year', '2026', 'Half marathon under 2:00'), g('week', '2026-11-09', 'Four early nights', 'open', [step('a', true), step('b', true), step('c', false), step('d', false), step('e', false)])];
    const [year, month, week] = hillsOf(goals, T, NOW);
    expect(year).toMatchObject({ state: 'set', caption: '2026 · 50 days left', words: 'Half marathon under 2:00' });
    expect(year.value).toBeUndefined();
    expect(week).toMatchObject({ state: 'set', caption: 'This week · 4 days left', words: 'Four early nights', value: '2 of 5' });
    // the nearest hill with no goal is now the month: it alone invites
    expect(month).toMatchObject({ state: 'invite', caption: 'November · 19 days left', words: 'Set a goal for November' });
    expect([year, month, week].filter((h) => h.state === 'invite')).toHaveLength(1);
  });

  it('invites on the year only once the week and the month are set, and on none when all three are', () => {
    const two = [g('month', '2026-11', 'm'), g('week', '2026-11-09', 'w')];
    expect(hillsOf(two, T, NOW).map((h) => h.state)).toEqual(['invite', 'set', 'set']);
    expect(hillsOf(two, T, NOW)[0].words).toBe('Set a goal for 2026');
    expect(hillsOf([...two, g('year', '2026', 'y')], T, NOW).map((h) => h.state)).toEqual(['set', 'set', 'set']);
  });

  it('says the answer in place of the time left once a goal is reviewed', () => {
    const [, , week] = hillsOf([g('week', '2026-11-09', 'w', 'done', [step('a', true)])], T, NOW);
    expect(week.caption).toBe('This week · Done');
    expect(week.value).toBeUndefined();
  });

  it('names each invitation', () => {
    expect(inviteWords('week', '2026-11-09')).toBe('Set this week’s goal');
    expect(inviteWords('month', '2026-11')).toBe('Set a goal for November');
  });
});

describe('the suggested goal, through the shared rule', () => {
  const base: IdeaInput = {
    goals: [],
    today: T,
    todos: [{ text: 'Renew passport.' }, { text: 'Email Alex' }],
    sessions: [{ kind: 'cross', type: 'Bike', title: null, miles: null, minutes: 40, mark: null }],
    habits: Array.from({ length: 7 }, (_, i) => ({ name: `h${i}` })),
    fitness: true,
  };

  it('offers yesterday’s unfinished goal first, with the goal it carries', () => {
    const y = g('day', '2026-11-11', 'Finish the notes.', 'partly');
    expect(localGoalIdea({ ...base, goals: [y] })).toMatchObject({ source: 'yesterday', caption: 'An idea · from yesterday', text: 'Finish the notes', carry: y });
    // a goal that was hit is not carried
    expect(localGoalIdea({ ...base, goals: [g('day', '2026-11-11', 'x', 'done')] })?.source).toBe('todos');
  });

  it('then the top open to-do, then today’s session, then the habits', () => {
    expect(localGoalIdea(base)).toMatchObject({ source: 'todos', caption: 'An idea · from your to-dos', text: 'Renew passport' });
    expect(localGoalIdea({ ...base, todos: [] })).toMatchObject({ source: 'fitness', caption: 'An idea · from Fitness', text: 'Bike 40 min, before lunch' });
    expect(localGoalIdea({ ...base, todos: [], sessions: [] })).toMatchObject({ source: 'habits', caption: 'An idea · from your habits', text: 'All 7 habits, done by 9' });
    expect(localGoalIdea({ ...base, todos: [], sessions: [], habits: [] })).toBeNull();
  });

  it('never reads the session with Fitness off, or one already logged, or a rest day', () => {
    expect(localGoalIdea({ ...base, todos: [], fitness: false })?.source).toBe('habits');
    expect(localGoalIdea({ ...base, todos: [], sessions: [{ ...base.sessions[0]!, mark: 'done' }] })?.source).toBe('habits');
    expect(localGoalIdea({ ...base, todos: [], sessions: [{ ...base.sessions[0]!, kind: 'rest' }] })?.source).toBe('habits');
  });
});

describe('the suggested goal while the day is still loading', () => {
  const base: IdeaInput = {
    goals: [],
    today: T,
    todos: [{ text: 'Renew passport' }],
    sessions: [{ kind: 'cross', type: 'Bike', title: null, miles: null, minutes: 40, mark: null }],
    habits: [{ name: 'Read' }],
    fitness: true,
  };

  it('offers nothing while a source that would win is still loading: the idea never changes under the button', () => {
    // the to-dos have not arrived: the session must not be offered, then swapped for a to-do
    expect(localGoalIdea({ ...base, todos: [], loading: { todos: true } })).toBeNull();
    // the plan has not arrived: the habits must not be offered, then swapped for the session
    expect(localGoalIdea({ ...base, todos: [], sessions: [], loading: { sessions: true } })).toBeNull();
    expect(localGoalIdea({ ...base, todos: [], sessions: [], habits: [], loading: { habits: true } })).toBeNull();
  });

  it('offers at once what nothing still loading can outrank', () => {
    const y = g('day', '2026-11-11', 'Finish the notes', 'missed');
    expect(localGoalIdea({ ...base, goals: [y], todos: [], loading: { todos: true, sessions: true, habits: true } })?.source).toBe('yesterday');
    expect(localGoalIdea({ ...base, loading: { sessions: true, habits: true } })?.source).toBe('todos');
    expect(localGoalIdea({ ...base, todos: [], loading: { habits: true } })?.source).toBe('fitness');
  });

  it('does not wait for the plan with Fitness off', () => {
    expect(localGoalIdea({ ...base, todos: [], sessions: [], fitness: false, loading: { sessions: true } })?.source).toBe('habits');
  });

  it('offers what is left once a source has failed to load (it is no longer loading)', () => {
    expect(localGoalIdea({ ...base, todos: [], loading: { todos: false } })?.source).toBe('fitness');
  });
});

describe('the day’s to-dos as the poster counts them', () => {
  it('leaves out a to-do with no words, so the band never reads "Next:" and nothing', () => {
    const list = listed([{ text: '   ', done: false }, { text: 'Book dentist', done: false }, { text: '\n\t', done: true }]);
    expect(list).toEqual([{ text: 'Book dentist', done: false }]);
    expect(todayBand(list, [])).toMatchObject({ label: 'Today · 0 of 1 to-dos done', words: 'Next: Book dentist' });
    expect(todayBand(listed([{ text: ' ', done: false }]), [])).toEqual({ label: 'Today', words: 'No to-dos yet', total: 0, done: 0 });
  });
});

describe('the clock the idea reads', () => {
  it('is the minutes on the wall since the day began, clamped to the day', () => {
    const midnight = new Date(`${T}T00:00:00`).getTime();
    expect(wallMinutes(T, midnight + 10 * 3600e3)).toBe(600);
    expect(wallMinutes(T, midnight - 5 * 60e3)).toBe(0);
    expect(wallMinutes(T, midnight + 30 * 3600e3)).toBe(1439);
  });
});

describe('the poster’s band with a goal set', () => {
  it('counts the day’s to-dos and names the next one', () => {
    expect(todayBand([{ text: 'Book dentist', done: true }, { text: 'Email Alex', done: true }, { text: 'Renew passport', done: false }], [])).toEqual({ label: 'Today · 2 of 3 to-dos done', words: 'Next: Renew passport', total: 3, done: 2 });
    expect(todayBand([{ text: 'a', done: true }], [])).toMatchObject({ label: 'Today · 1 of 1 to-dos done', words: 'All to-dos done' });
  });

  it('falls back to the goal’s steps, then says there are none', () => {
    expect(todayBand([], [step('Outline', true), step('Draft', false)])).toEqual({ label: 'Today · 1 of 2 steps done', words: 'Next: Draft', total: 2, done: 1 });
    expect(todayBand([], [])).toEqual({ label: 'Today', words: 'No to-dos yet', total: 0, done: 0 });
  });
});

describe('the evening', () => {
  it('starts at 5 pm', () => {
    expect(eveningNow(16 * 60 + 59)).toBe(false);
    expect(eveningNow(17 * 60)).toBe(true);
  });
});
