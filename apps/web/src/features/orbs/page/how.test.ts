import { PAUSE_KINDS, RULES, ruleLine } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { gemName } from '../gems';
import { dayCeiling, goalRows, howSections, levelsLine, weekSteps, type HowSection, type Rules } from './how';

/**
 * "How Orbs work" is written from the engine's `RULES`: every number on the page is checked against them here, and a
 * changed rule changes the page (the last test), so the two cannot drift apart.
 */
const on = howSections({ fitness: true, target: 5 });
const off = howSections({ fitness: false, target: 5 });
const sec = (all: HowSection[], key: string) => all.find((s) => s.key === key)!;
const row = (all: HowSection[], s: string, key: string) => sec(all, s).rows.find((r) => r.key === key)!;
const text = (all: HowSection[]) => all.flatMap((s) => [s.title, s.lead ?? '', s.foot ?? '', ...s.rows.flatMap((r) => [r.title, r.sub ?? '', r.note ?? '', r.value ?? ''])]).join('\n');

describe('what earns Orbs, against RULES', () => {
  it('a to-do, a habit, a session, today’s goal and a full day pay what the rules say', () => {
    expect(row(on, 'earn', 'todo')).toMatchObject({ value: String(RULES.todo.each), sub: `The first ${RULES.todo.cap} a day` });
    expect(row(on, 'earn', 'habit')).toMatchObject({ value: String(RULES.habit.each), sub: `Up to ${RULES.habit.cap} a day` });
    expect(row(on, 'earn', 'train').value).toBe(String(RULES.train.done));
    expect(row(on, 'earn', 'train').sub).toContain(`${RULES.train.floor} for its floor`);
    expect(row(on, 'earn', 'goal:day').value).toBe(String(RULES.goalDay));
    expect(row(on, 'earn', 'full').value).toBe(`+${RULES.full.bonus}`);
  });
  it('the numbers are the published ones: 1, 1, 3 (its floor 2), 3 and +5', () => {
    expect(sec(on, 'earn').rows.map((r) => r.value)).toEqual(['1', '1', '3', '3', '+5', undefined]);
    expect(row(on, 'earn', 'train').sub).toBe('2 for its floor. Two kinds a day at most.');
  });
  it('tonight’s line makes the day count and shows no number', () => {
    const line = row(on, 'earn', 'line');
    expect(line.value).toBeUndefined();
    expect(line.sub).toMatch(/^Makes the day count/);
  });
  it('the day’s ceiling is the sum of the rows, and the engine’s own number', () => {
    expect(dayCeiling(RULES, true)).toBe(RULES.dailyCeiling);
    expect(sec(on, 'earn').foot).toBe(`A day pays ${RULES.dailyCeiling} at most.`);
    expect(dayCeiling(RULES, false)).toBe(RULES.dailyCeiling - RULES.train.done * RULES.train.kinds);
  });
});

describe('the legend: each row that earns an Orb names which', () => {
  const gems = (all: HowSection[], s: string) => Object.fromEntries(sec(all, s).rows.map((r) => [r.key, r.gems]));
  it('a to-do, a habit, a session (one per kind), today’s goal and a full day; tonight’s line has none', () => {
    expect(gems(on, 'earn')).toEqual({ todo: ['todo'], habit: ['habit'], train: ['train:run', 'train:lift', 'train:cross'], 'goal:day': ['goal:day'], full: ['full'], line: undefined });
  });
  it('the four goals, a week that counts and the two challenges', () => {
    expect(gems(on, 'goals')).toEqual({ 'goal:day': ['goal:day'], 'goal:week': ['goal:week'], 'goal:month': ['goal:month'], 'goal:year': ['goal:year'] });
    expect(gems(on, 'weeks')).toEqual({ week: ['week'] });
    expect(gems(on, 'challenges')).toMatchObject({ day: ['challenge:d'], week: ['challenge:w'], offer: undefined, size: undefined });
  });
  it('every key is one the family knows, and the sections about the count and the rules show none', () => {
    for (const all of [on, off]) for (const s of all) for (const r of s.rows) for (const k of r.gems ?? []) expect(gemName(k), k).not.toBe('An Orb');
    for (const key of ['count', 'for', 'never']) expect(sec(on, key).rows.every((r) => !r.gems)).toBe(true);
  });
  it('with Fitness off no row shows a session’s Orb', () => {
    expect(off.flatMap((s) => s.rows.flatMap((r) => r.gems ?? [])).some((k) => k.startsWith('train:'))).toBe(false);
  });
});

describe('goals multiply by reach, against RULES', () => {
  it('four rows: x1, x3, x10, x30 as 3, 9, 30, 90', () => {
    expect(goalRows(RULES).map((r) => [r.note, r.value])).toEqual([
      ['× 1', '3'],
      ['× 3', '9'],
      ['× 10', '30'],
      ['× 30', '90'],
    ]);
    for (const level of ['day', 'week', 'month', 'year'] as const) expect(row(on, 'goals', `goal:${level}`).value).toBe(String(RULES.goal.base * RULES.goal.reach[level]));
    expect(sec(on, 'goals').lead).toContain(`${RULES.goal.base} Orbs`);
  });
});

describe('weeks in a row, against RULES', () => {
  it('5 Orbs times the weeks, up to x4: 5, 10, 15, 20', () => {
    expect(weekSteps(RULES)).toEqual([5, 10, 15, 20]);
    const r = row(on, 'weeks', 'week');
    expect(r.sub).toBe(`${RULES.week.bonus} Orbs times the weeks in a row, up to × ${RULES.week.top}: 5, 10, 15, then 20.`);
    expect(r.value).toBe(`${RULES.week.bonus} to ${RULES.week.bonus * RULES.week.top}`);
    expect(sec(on, 'weeks').foot).toMatch(/steps it down one, never to nothing/);
  });
});

describe('the count', () => {
  it('says what makes a day count and what a week needs, by the person’s own week', () => {
    expect(row(on, 'count', 'day').sub).toBe('With one thing done: a to-do, a habit, a session or its floor, today’s goal or tonight’s line.');
    expect(row(on, 'count', 'week').sub).toMatch(/^With five days that count, Monday to Sunday\./);
    expect(row(howSections({ fitness: true, target: 3 }), 'count', 'week').sub).toMatch(/^With three days that count/);
  });
  it('Pause names the statuses the engine pauses on', () => {
    expect(PAUSE_KINDS).toEqual(['sick', 'injured', 'travel', 'rest']);
    expect(row(on, 'count', 'pause').sub).toBe('A day under Sick, Injured, Travel or Rest with nothing done is neither counted nor missed.');
  });
});

describe('challenges, levels and what Orbs never do, against RULES', () => {
  it('a day challenge pays 5; a week challenge 10 at its floor and 20 in full', () => {
    expect(row(on, 'challenges', 'day').value).toBe(String(RULES.challenge.day));
    expect(row(on, 'challenges', 'week')).toMatchObject({ value: `${RULES.challenge.weekFloor} to ${RULES.challenge.weekFull}`, sub: `${RULES.challenge.weekFloor} at its floor, ${RULES.challenge.weekFull} in full` });
    expect(row(on, 'challenges', 'offer').title).toBe('Offered, never assigned');
    expect(row(on, 'challenges', 'size').title).toBe('Never more than your plan holds');
  });
  it('levels are the engine’s thresholds, with no top', () => {
    expect(levelsLine(RULES)).toBe('25, 75, 200, 500, 1,200, 2,500, 5,000, then every 5,000');
    expect(row(on, 'for', 'levels').sub).toContain(levelsLine(RULES));
    expect(row(on, 'for', 'chapters').sub).toMatch(/^Every four weeks, on a Monday/);
  });
  it('nothing is bought, random or taken away, and a day closes at 3 in the morning', () => {
    expect(sec(on, 'never').rows.map((r) => r.title)).toEqual(['Nothing is bought', 'Nothing is random', 'Nothing is taken away', `A day closes at ${RULES.close.tapHour} in the morning`]);
    expect(row(on, 'never', 'closes').sub).toMatch(/earns nothing/);
  });
});

describe('the sections', () => {
  it('are these, in this order', () => {
    expect(on.map((s) => s.title)).toEqual(['What earns Orbs', 'Goals multiply by reach', 'Weeks in a row', 'The count', 'Challenges', 'What Orbs are for', 'What Orbs never do']);
  });
  it('with Fitness off nothing names training', () => {
    expect(text(off)).not.toMatch(/session|training|\bplan\b|\brun\b|\blift\b|Sick|Injured|Rest\b|distance|pace/i);
    expect(sec(off, 'earn').rows.map((r) => r.key)).toEqual(['todo', 'habit', 'goal:day', 'full', 'line']);
    expect(sec(off, 'count').rows.map((r) => r.key)).toEqual(['day', 'week']);
    expect(sec(off, 'earn').foot).toBe('A day pays 21 at most.');
  });
  it('use the words table and no others', () => {
    for (const all of [on, off]) {
      expect(text(all)).not.toMatch(/streak|sprint|quest|points|coins|\bXP\b|\bAI\b|coach|\bbot\b|rest days|\bbest\b|freeze|\u2014/i);
      // "kept" is never a noun here, and a count is never a "run"
      expect(text(all)).not.toMatch(/\bkept\b|\bin a run\b/i);
    }
    expect(ruleLine(5)).toBe('One thing a day. Two days off a week.');
  });
  it('a changed rule changes the page: nothing is written twice', () => {
    const rules = { ...RULES, todo: { each: 2, cap: 7 }, habit: { each: 3, cap: 9 }, train: { done: 6, floor: 4, kinds: 3 }, goalDay: 4, full: { bonus: 8, min: 3 }, goal: { ...RULES.goal, base: 4 }, week: { ...RULES.week, bonus: 6, top: 3 }, challenge: { day: 7, weekFloor: 11, weekFull: 22 }, close: { tapHour: 4 }, levels: [10, 20], levelStep: 100, chapterDays: 14 } as unknown as Rules;
    const p = howSections({ fitness: true, target: 5, rules });
    expect(sec(p, 'earn').rows.map((r) => r.value)).toEqual(['2', '3', '6', '4', '+8', undefined]);
    expect(row(p, 'earn', 'todo').sub).toBe('The first 7 a day');
    expect(row(p, 'earn', 'train').sub).toBe('4 for its floor. Three kinds a day at most.');
    expect(sec(p, 'earn').foot).toBe(`A day pays ${7 * 2 + 9 * 3 + 6 * 3 + 4 + 8} at most.`);
    expect(sec(p, 'goals').rows.map((r) => r.value)).toEqual(['4', '12', '40', '120']);
    expect(row(p, 'weeks', 'week')).toMatchObject({ value: '6 to 18', sub: '6 Orbs times the weeks in a row, up to × 3: 6, 12, then 18.' });
    expect(row(p, 'challenges', 'day').value).toBe('7');
    expect(row(p, 'challenges', 'week').value).toBe('11 to 22');
    expect(row(p, 'for', 'levels').sub).toContain('10, 20, then every 100');
    expect(row(p, 'for', 'chapters').sub).toMatch(/^Every two weeks/);
    expect(row(p, 'never', 'closes').title).toBe('A day closes at 4 in the morning');
  });
});
