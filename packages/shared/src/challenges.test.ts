import { describe, expect, it } from 'vitest';
import { mondayOf, parseISO, shiftDays, type ISODate } from './dates.js';
import {
  addChallenge,
  baselineOf,
  canAdd,
  CHALLENGE_BOUNDS,
  challengeSlots,
  challengeState,
  challengeTitle,
  easierChallenge,
  mayOffer,
  menuFor,
  offerChallenge,
  offerInto,
  payFor,
  reasonAllowed,
  settleChallenges,
  skipChallenge,
  slotOf,
  withPick,
  type Baseline,
  type ChallengeFacts,
  type Slot,
} from './challenges.js';
import { emptyRewards, mergeRewards, reconcile, RULES, totalOf, type Challenge, type DayFacts, type Rewards } from './rewards.js';

const U = 'u_owner';
const MON = RULES.startsOn;
const day = (n: number): ISODate => shiftDays(MON, n);
const at = (date: ISODate, hour = 12): Date => {
  const d = parseISO(date);
  d.setHours(hour, 0, 0, 0);
  return d;
};
const dayFacts = (date: ISODate, p: Partial<DayFacts> = {}): DayFacts => ({ date, todosDone: 0, todosEarlier: 0, habitsLive: 0, habitsDone: 0, lines: 0, train: {}, trainRequired: false, goalDay: 'none', held: false, ...p });
const facts = (today: ISODate, p: Partial<Omit<ChallengeFacts, 'day' | 'week'>> & { day?: Partial<DayFacts>; week?: Partial<ChallengeFacts['week']> } = {}): ChallengeFacts => ({
  today,
  fitness: true,
  todosOpen: 0,
  planned: [],
  ...p,
  day: dayFacts(today, p.day),
  week: { monday: mondayOf(today), counted: 0, fullDays: 0, habitDays: 0, goal: 'none', sessions: { planned: 0, done: 0 }, paused: 0, ...p.week },
});
const fourWeeks = (days: number[], habitDays = [0, 0, 0, 0], fullDays = [0, 0, 0, 0]): Baseline => ({ recordDays: 40, weeks: days.map((d, i) => ({ days: d, habitDays: habitDays[i]!, fullDays: fullDays[i]! })) });
const NEW: Baseline = { recordDays: 10, weeks: [{ days: 5, habitDays: 4, fullDays: 2 }] };
const daySlot = (date: ISODate, seed = 0): Slot => ({ key: `challenge:d:${date}`, kind: 'day', date, seed });
const weekSlot = (monday: ISODate, seed = 0): Slot => ({ key: `challenge:w:${monday}`, kind: 'week', date: monday, seed });
const NUMBERED = ['days', 'habit-days', 'full-days'];
const rich = (today: ISODate) => facts(today, { todosOpen: 4, planned: ['run'], day: { habitsLive: 3, goalDay: 'open', trainRequired: true, trainLeft: 1 }, week: { goal: 'open', sessions: { planned: 4, done: 0 } } });

describe('test 11: slots', () => {
  it('are the same for an account on any device: a function of the account and the week alone', () => {
    for (let w = 0; w < 12; w++) expect(challengeSlots(U, day(w * 7))).toEqual(challengeSlots(U, day(w * 7)));
    expect(challengeSlots(U, day(3))).toEqual(challengeSlots(U, MON));
  });
  it('one day challenge a week by default, on a day that moves from week to week and from account to account', () => {
    const days = new Set<number>();
    for (let w = 0; w < 30; w++) {
      const d = challengeSlots(U, day(w * 7)).filter((s) => s.kind === 'day');
      expect(d).toHaveLength(1);
      expect(mondayOf(d[0]!.date)).toBe(day(w * 7));
      expect(d[0]!.key).toBe(`challenge:d:${d[0]!.date}`);
      days.add((parseISO(d[0]!.date).getDay() + 6) % 7);
    }
    expect(days.size).toBeGreaterThanOrEqual(5);
    const other = Array.from({ length: 30 }, (_, w) => challengeSlots('u_someone_else', day(w * 7)).find((s) => s.kind === 'day')!.date);
    const mine = Array.from({ length: 30 }, (_, w) => challengeSlots(U, day(w * 7)).find((s) => s.kind === 'day')!.date);
    expect(other).not.toEqual(mine);
  });
  it('a week challenge on three Mondays in four, every four weeks', () => {
    for (let start = 0; start < 8; start++) {
      const n = [0, 1, 2, 3].filter((w) => challengeSlots(U, day((start + w) * 7)).some((s) => s.kind === 'week')).length;
      expect(n).toBe(3);
    }
    expect(challengeSlots(U, MON).find((s) => s.kind === 'week')?.key ?? `challenge:w:${MON}`).toBe(`challenge:w:${MON}`);
  });
  it('Off gives none; Two a week gives two different days', () => {
    expect(challengeSlots(U, MON, 0)).toEqual([]);
    for (let w = 0; w < 20; w++) {
      const d = challengeSlots(U, day(w * 7), 2).filter((s) => s.kind === 'day');
      expect(d).toHaveLength(2);
      expect(d[0]!.date).not.toBe(d[1]!.date);
      // the first of the two is the day "One a week" gives
      expect(challengeSlots(U, day(w * 7), 1).filter((s) => s.kind === 'day')[0]).toEqual(d.find((s) => s.date === challengeSlots(U, day(w * 7), 1).filter((x) => x.kind === 'day')[0]!.date));
    }
  });
  it('slotOf reads a slot back from its key', () => {
    const s = challengeSlots(U, MON)[0]!;
    expect(slotOf(U, s.key)).toEqual(s);
  });
});

describe('test 11: the menu', () => {
  it('never offers anything on a paused day', () => {
    for (let seed = 0; seed < 40; seed++) {
      expect(offerChallenge(daySlot(day(2), seed), fourWeeks([5, 5, 5, 5]), facts(day(2), { ...rich(day(2)), day: { ...rich(day(2)).day, held: true } }), 'steady')).toBeNull();
      expect(offerChallenge(weekSlot(MON, seed), fourWeeks([5, 5, 5, 5]), facts(MON, { ...rich(MON), day: { held: true } }), 'steady')).toBeNull();
    }
  });
  it('the day menu, each item only when it can be asked', () => {
    const items = (f: ChallengeFacts) => menuFor(daySlot(f.today), NEW, f, 'steady').map((o) => o.item);
    expect(items(facts(day(1)))).toEqual([]);
    expect(items(facts(day(1), { day: { habitsLive: 1 } }))).toEqual([]);
    expect(items(facts(day(1), { day: { habitsLive: 2 } }))).toEqual(['habits']);
    expect(items(facts(day(1), { day: { goalDay: 'open' } }))).toEqual(['goal', 'full']);
    expect(items(facts(day(1), { planned: ['lift'], day: { trainRequired: true, trainLeft: 1 } }))).toEqual(['session:lift']);
    expect(items(facts(day(1), { todosOpen: 1 }))).toEqual([]);
    expect(items(facts(day(1), { todosOpen: 2 }))).toEqual(['list']);
    expect(items(rich(day(1)))).toEqual(['habits', 'goal', 'session:run', 'list', 'full']);
    // only on its own day
    expect(menuFor(daySlot(day(1)), NEW, rich(day(2)), 'steady')).toEqual([]);
  });
  it('an account with under 28 days of record is offered only the items that need no number', () => {
    for (let seed = 0; seed < 60; seed++) {
      const o = offerChallenge(weekSlot(MON, seed), NEW, rich(MON), 'steady');
      expect(o).not.toBeNull();
      expect(NUMBERED).not.toContain(o!.item);
    }
    expect(menuFor(weekSlot(MON), NEW, rich(MON), 'bold').map((o) => o.item)).toEqual(['sessions', 'goal-week']);
    // 28 days of record but fewer than four finished weeks is still not a baseline
    expect(menuFor(weekSlot(MON), { recordDays: 30, weeks: NEW.weeks }, rich(MON), 'bold').map((o) => o.item)).toEqual(['sessions', 'goal-week']);
    // with nothing to ask for, nothing is offered: never a default-sized one
    expect(offerChallenge(weekSlot(MON), NEW, facts(MON), 'steady')).toBeNull();
  });
  it('sizes from four weeks: Steady is met in 3 of 4, Gentle is the lowest, Bold is met in 2 of 4', () => {
    const b = fourWeeks([5, 3, 4, 5], [2, 5, 3, 4], [1, 4, 2, 3]);
    const pick = (size: 'gentle' | 'steady' | 'bold', item: string) => menuFor(weekSlot(MON), b, facts(MON, { day: { habitsLive: 3 } }), size).find((o) => o.item === item);
    expect(pick('gentle', 'days')).toMatchObject({ target: 3, floor: 2 });
    expect(pick('steady', 'days')).toMatchObject({ target: 4, floor: 3 });
    expect(pick('bold', 'days')).toMatchObject({ target: 5, floor: 4 });
    expect(pick('gentle', 'habit-days')?.target).toBe(2);
    expect(pick('steady', 'habit-days')?.target).toBe(3);
    expect(pick('bold', 'habit-days')?.target).toBe(4);
    expect(pick('gentle', 'full-days')?.target).toBe(1);
    expect(pick('steady', 'full-days')?.target).toBe(2);
    expect(pick('bold', 'full-days')?.target).toBe(3);
  });
  it('the bounds: days 3 to 5, every habit on 2 to 5 days, full days 1 to 4', () => {
    expect(CHALLENGE_BOUNDS).toEqual({ days: [3, 5], 'habit-days': [2, 5], 'full-days': [1, 4] });
    const high = menuFor(weekSlot(MON), fourWeeks([7, 7, 7, 7], [7, 7, 7, 7], [7, 7, 7, 7]), facts(MON, { day: { habitsLive: 3 } }), 'bold');
    expect(Object.fromEntries(high.map((o) => [o.item, o.target]))).toEqual({ days: 5, 'habit-days': 5, 'full-days': 4 });
    const low = menuFor(weekSlot(MON), fourWeeks([0, 1, 0, 2], [0, 0, 0, 0], [0, 0, 0, 0]), facts(MON, { day: { habitsLive: 3 } }), 'gentle');
    expect(Object.fromEntries(low.map((o) => [o.item, o.target]))).toEqual({ days: 3, 'habit-days': 2, 'full-days': 1 });
    // the training item asks for what the plan holds, less one, and nothing with Fitness off or one session
    expect(menuFor(weekSlot(MON), NEW, facts(MON, { week: { sessions: { planned: 5, done: 0 } } }), 'bold')).toEqual([{ item: 'sessions', target: 4, floor: 3, base: 0 }]);
    expect(menuFor(weekSlot(MON), NEW, facts(MON, { week: { sessions: { planned: 1, done: 0 } } }), 'bold')).toEqual([]);
    expect(menuFor(weekSlot(MON), NEW, facts(MON, { fitness: false, week: { sessions: { planned: 5, done: 0 } } }), 'bold')).toEqual([]);
  });
  it('a target never rises after a miss or a pause, and at most one step in four weeks', () => {
    const b = fourWeeks([5, 5, 5, 5]);
    const f = facts(MON);
    const days = (base: Baseline) => menuFor(weekSlot(MON), base, f, 'bold').find((o) => o.item === 'days')!.target;
    expect(days(b)).toBe(5);
    expect(days({ ...b, last: { days: { target: 3, met: false, weeksAgo: 1 } } })).toBe(3);
    expect(days({ ...b, last: { days: { target: 3, met: true, weeksAgo: 1 } } })).toBe(4);
    expect(days({ ...b, last: { days: { target: 4, met: true, weeksAgo: 1, rose: true } } })).toBe(4);
    expect(days({ ...b, last: { days: { target: 3, met: true, weeksAgo: 1 } }, paused: true })).toBe(3);
    // a challenge from more than four weeks ago no longer holds it
    expect(days({ ...b, last: { days: { target: 3, met: false, weeksAgo: 5 } } })).toBe(5);
    // it may always come down
    expect(menuFor(weekSlot(MON), { ...fourWeeks([3, 3, 3, 3]), last: { days: { target: 5, met: true, weeksAgo: 1 } } }, f, 'bold').find((o) => o.item === 'days')!.target).toBe(3);
  });
  it('after a pause challenges run at Gentle', () => {
    const b = { ...fourWeeks([5, 3, 4, 5]), gentle: true };
    expect(menuFor(weekSlot(MON), b, facts(MON), 'bold').find((o) => o.item === 'days')?.target).toBe(3);
  });
  it('the pick is the rule’s: by the slot’s seed, the same on every device', () => {
    const picks = new Set<string>();
    for (let seed = 0; seed < 50; seed++) {
      const o = offerChallenge(daySlot(day(1), seed), NEW, rich(day(1)), 'steady');
      expect(o).toEqual(offerChallenge(daySlot(day(1), seed), NEW, rich(day(1)), 'steady'));
      picks.add(o!.item);
    }
    expect([...picks].sort()).toEqual(['full', 'goal', 'habits', 'list', 'session:run']);
  });
});

describe('test 11: the never list', () => {
  const every = (): string[] => {
    const titles: string[] = [];
    const b = fourWeeks([5, 3, 4, 5], [2, 5, 3, 4], [1, 4, 2, 3]);
    for (const size of ['gentle', 'steady', 'bold'] as const) {
      for (const o of menuFor(daySlot(day(1)), b, rich(day(1)), size)) titles.push(challengeTitle(o));
      for (const o of menuFor(weekSlot(MON), b, rich(MON), size)) titles.push(challengeTitle(o));
    }
    return titles;
  };
  it('no item carries a clock deadline, a count of to-dos or journal lines, or anything about food, weight, sleep or pain', () => {
    for (const t of every()) {
      expect(t).not.toMatch(/\b(by|before|until)\s+\d|\bnoon\b|\ba\.?m\b|\bp\.?m\b|o’clock|\d:\d\d/i);
      expect(t).not.toMatch(/\d+\s+(to-?dos?|lines?|tasks?)/i);
      expect(t).not.toMatch(/food|eat|meal|calorie|weight|pounds?|sleep|pain|sore|pace|faster|miles?|distance/i);
      expect(t).not.toMatch(/—/);
      expect(reasonAllowed(t, t)).toBe(true);
    }
  });
  it('nothing about training with Fitness off, in the day menu or the week’s', () => {
    const off = { ...rich(day(1)), fitness: false };
    expect(menuFor(daySlot(day(1)), NEW, off, 'steady').map((o) => o.item)).toEqual(['habits', 'goal', 'list', 'full']);
    expect(menuFor(weekSlot(MON), NEW, { ...rich(MON), fitness: false }, 'steady').map((o) => o.item)).toEqual(['goal-week']);
  });
  it('never more sessions than the plan holds', () => {
    for (let planned = 2; planned < 9; planned++) {
      const o = menuFor(weekSlot(MON), NEW, facts(MON, { week: { sessions: { planned, done: 0 } } }), 'bold')[0]!;
      expect(o.target).toBe(planned - 1);
    }
  });
  it('the assistant’s reason: 90 characters, no number that is not in the title, nothing on the list', () => {
    const title = 'Every day this week, two days off';
    expect(reasonAllowed('You have a light week, so this one fits.', title)).toBe(true);
    expect(reasonAllowed('x'.repeat(91), title)).toBe(false);
    expect(reasonAllowed('', title)).toBe(false);
    expect(reasonAllowed('You ran 14 miles last week.', title)).toBe(false);
    expect(reasonAllowed('Do it before noon.', title)).toBe(false);
    expect(reasonAllowed('Finish by 3 and rest.', title)).toBe(false);
    expect(reasonAllowed('You slept badly, so keep it small.', title)).toBe(false);
    expect(reasonAllowed('Good for your weight.', title)).toBe(false);
    expect(reasonAllowed('Eat well and it is easy.', title)).toBe(false);
    expect(reasonAllowed('A faster pace is not the point.', title)).toBe(false);
    expect(reasonAllowed('Your knee pain is gone.', title)).toBe(false);
    expect(reasonAllowed('4 days went well last time.', '4 full days this week')).toBe(true);
    expect(reasonAllowed('5 days went well last time.', '4 full days this week')).toBe(false);
  });
});

describe('titles: every day with days off, never N of 7', () => {
  const t = (item: string, target = 1) => challengeTitle({ item, target });
  it('the day menu, in the spec’s words', () => {
    expect(t('habits', 4)).toBe('Every habit today');
    expect(t('goal')).toBe('Today’s goal, done');
    expect(t('session:run')).toBe('Today’s session, done');
    expect(t('list', 6)).toBe('Clear this morning’s list');
    expect(t('full')).toBe('A full day');
  });
  it('the week menu', () => {
    expect(t('days', 5)).toBe('Every day this week, two days off');
    expect(t('days', 4)).toBe('Every day this week, three days off');
    expect(t('days', 3)).toBe('Every day this week, four days off');
    expect(t('sessions', 3)).toBe('Every planned session but one');
    expect(t('goal-week')).toBe('This week’s goal, done');
    expect(t('habit-days', 5)).toBe('Every habit, every day this week, two days off');
    expect(t('habit-days', 2)).toBe('Every habit, every day this week, five days off');
    expect(t('full-days', 4)).toBe('A full day, every day this week, three days off');
    expect(t('full-days', 1)).toBe('One full day this week');
    for (const item of ['days', 'habit-days', 'full-days']) for (let n = 1; n <= 5; n++) expect(t(item, n)).not.toMatch(/\d|of (7|seven)/i);
  });
});

describe('test 11: adding', () => {
  const offered = (slot: Slot, c: Partial<Challenge> & Pick<Challenge, 'item' | 'target'>): Rewards => offerInto(emptyRewards(U, MON), slot, { base: 0, ...c }, at(slot.date, 7));
  it('an offer is frozen at its first generation', () => {
    const slot = daySlot(day(1));
    const one = offered(slot, { item: 'habits', target: 3 });
    expect(one.challenges[slot.key]).toEqual({ item: 'habits', target: 3, base: 0, state: 'offered', at: at(day(1), 7).toISOString() });
    expect(offerInto(one, slot, { item: 'goal', target: 1, base: 0 }, at(day(1), 9))).toBe(one);
  });
  it('a day challenge cannot be added when nothing is left to do, on another day, or on a paused day', () => {
    const slot = daySlot(day(1));
    const s = offered(slot, { item: 'goal', target: 1 });
    const done = facts(day(1), { day: { goalDay: 'done' } });
    expect(canAdd(s.challenges[slot.key]!, slot, done)).toBe(false);
    expect(addChallenge(s, slot, done, at(day(1)))).toBe(s);
    const open = facts(day(1), { day: { goalDay: 'open' } });
    expect(canAdd(s.challenges[slot.key]!, slot, open)).toBe(true);
    expect(canAdd(s.challenges[slot.key]!, slot, facts(day(2), { day: { goalDay: 'open' } }))).toBe(false);
    expect(canAdd(s.challenges[slot.key]!, slot, facts(day(1), { day: { goalDay: 'open', held: true } }))).toBe(false);
    const added = addChallenge(s, slot, open, at(day(1), 8));
    expect(added.challenges[slot.key]).toMatchObject({ state: 'added', base: 0, at: at(day(1), 8).toISOString() });
    // and only once
    expect(addChallenge(added, slot, open, at(day(1), 9))).toBe(added);
  });
  it('every habit today with all but none left still asks for one step', () => {
    const slot = daySlot(day(1));
    const s = offered(slot, { item: 'habits', target: 3 });
    expect(canAdd(s.challenges[slot.key]!, slot, facts(day(1), { day: { habitsLive: 3, habitsDone: 2, habitsLiveDone: 2 } }))).toBe(true);
    expect(canAdd(s.challenges[slot.key]!, slot, facts(day(1), { day: { habitsLive: 3, habitsDone: 3, habitsLiveDone: 3 } }))).toBe(false);
  });
  it('a week challenge needs 40 percent of its target left, and only Monday to Wednesday', () => {
    const slot = weekSlot(MON);
    const s = offered(slot, { item: 'days', target: 5, floor: 4 });
    const c = s.challenges[slot.key]!;
    expect(canAdd(c, slot, facts(day(2), { week: { counted: 2 } }))).toBe(true);
    expect(canAdd(c, slot, facts(day(2), { week: { counted: 3 } }))).toBe(true); // 2 of 5 left is 40 percent
    expect(canAdd(c, slot, facts(day(2), { week: { counted: 4 } }))).toBe(false);
    expect(canAdd(c, slot, facts(day(3), { week: { counted: 0 } }))).toBe(false); // Thursday
    expect(canAdd(c, slot, facts(day(7), { week: { counted: 0 } }))).toBe(false); // next week
    expect(addChallenge(s, slot, facts(day(1), { week: { counted: 1 } }), at(day(1))).challenges[slot.key]).toMatchObject({ state: 'added', base: 1 });
  });
  it('“Clear this morning’s list” freezes the list as it stood when it was added', () => {
    const slot = daySlot(day(1));
    const s = offered(slot, { item: 'list', target: 4 });
    // by the time it is added one was done and one more was written: three are open
    const added = addChallenge(s, slot, facts(day(1), { todosOpen: 3, day: { todosDone: 1 } }), at(day(1), 9));
    expect(added.challenges[slot.key]).toMatchObject({ state: 'added', target: 3, base: 1 });
    expect(challengeState(added.challenges[slot.key]!, slot, facts(day(1), { todosOpen: 1, day: { todosDone: 3 } }))).toMatchObject({ state: 'added', progress: 2 });
    expect(challengeState(added.challenges[slot.key]!, slot, facts(day(1), { todosOpen: 0, day: { todosDone: 4 } }))).toMatchObject({ state: 'done', progress: 3, pay: 5 });
    // with fewer than two open there is nothing to add
    expect(addChallenge(s, slot, facts(day(1), { todosOpen: 1 }), at(day(1), 9))).toBe(s);
  });
  it('Skip costs nothing and is final for the slot; Easier takes one step off', () => {
    const slot = weekSlot(MON);
    const s = offered(slot, { item: 'days', target: 5, floor: 4 });
    const skipped = skipChallenge(s, slot.key, at(MON, 9));
    expect(skipped.challenges[slot.key]?.state).toBe('skipped');
    expect(totalOf(skipped)).toBe(0);
    expect(addChallenge(skipped, slot, facts(MON), at(MON, 10))).toBe(skipped);
    const easier = easierChallenge(s, slot.key);
    expect(easier.challenges[slot.key]).toMatchObject({ target: 4, floor: 3, state: 'offered' });
    expect(easierChallenge(easierChallenge(easier, slot.key), slot.key).challenges[slot.key]).toMatchObject({ target: 3, floor: 2 });
    // an item with no size has no Easier
    const goal = offered(daySlot(day(1)), { item: 'goal', target: 1 });
    expect(easierChallenge(goal, `challenge:d:${day(1)}`)).toBe(goal);
  });
  it('“Picked by the assistant” keeps the rule’s item and takes a checked reason', () => {
    const slot = daySlot(day(1));
    const s = offered(slot, { item: 'habits', target: 3 });
    const menu = [{ item: 'habits', target: 3, base: 0 }, { item: 'goal', target: 1, base: 0 }];
    const picked = withPick(s, slot.key, menu, 'goal', 'Your goal is small today, so start there.');
    expect(picked.challenges[slot.key]).toMatchObject({ item: 'goal', target: 1, by: 'assistant', why: 'Your goal is small today, so start there.', state: 'offered' });
    // off the menu, or a reason that breaks the list: the rule's pick stands
    expect(withPick(s, slot.key, menu, 'days', 'Fine.')).toBe(s);
    expect(withPick(s, slot.key, menu, 'goal', 'Finish before noon.')).toBe(s);
    // and never once it has been added
    const added = addChallenge(s, slot, facts(day(1), { day: { habitsLive: 3 } }), at(day(1)));
    expect(withPick(added, slot.key, menu, 'goal', 'Start there.')).toBe(added);
  });
});

describe('test 11: state and pay', () => {
  const added = (slot: Slot, c: Pick<Challenge, 'item' | 'target'> & Partial<Challenge>): Rewards => ({ ...emptyRewards(U, MON), challenges: { [slot.key]: { base: 0, state: 'added', at: at(slot.date, 8).toISOString(), ...c } } });
  it('a day challenge pays 5; a week challenge 10 at its floor and 20 in full', () => {
    expect(payFor('day', { target: 3 }, 3)).toBe(5);
    expect(payFor('day', { target: 3 }, 2)).toBe(0);
    expect(payFor('week', { target: 5, floor: 4 }, 5)).toBe(20);
    expect(payFor('week', { target: 5, floor: 4 }, 4)).toBe(10);
    expect(payFor('week', { target: 5, floor: 4 }, 3)).toBe(0);
    expect(payFor('week', { target: 1 }, 1)).toBe(20);
  });
  it('one payment per slot', () => {
    const slot = daySlot(day(1));
    const s = added(slot, { item: 'habits', target: 3 });
    const f = { [slot.key]: facts(day(1), { day: { habitsLive: 3, habitsDone: 3, habitsLiveDone: 3 } }) };
    const one = settleChallenges(s, f, at(day(1), 20));
    expect(one.gained).toEqual([{ key: slot.key, n: 5, date: day(1) }]);
    expect(one.store.challenges[slot.key]?.state).toBe('done');
    expect(one.store.once[slot.key]).toEqual({ on: day(1), n: 5 });
    const two = settleChallenges(one.store, f, at(day(1), 21));
    expect(two.store).toBe(one.store);
    expect(two.gained).toEqual([]);
    // a second phone that settled the same slot: the merge holds one payment
    const other = settleChallenges(s, f, at(day(1), 22)).store;
    expect(totalOf(mergeRewards(one.store, other))).toBe(5);
    // unticking afterwards takes nothing back
    expect(settleChallenges(one.store, { [slot.key]: facts(day(1), { day: { habitsLive: 3, habitsDone: 1, habitsLiveDone: 1 } }) }, at(day(1), 23)).store).toBe(one.store);
  });
  it('a week challenge pays in full the moment it is met, or its floor once the week is over, never both', () => {
    const slot = weekSlot(MON);
    const s = added(slot, { item: 'days', target: 5, floor: 4 });
    // four days by Sunday night: not paid yet, the fifth can still come
    const sunday = settleChallenges(s, { [slot.key]: facts(day(6), { week: { counted: 4 } }) }, at(day(6), 22));
    expect(sunday.store).toBe(s);
    // Monday, the week over: the floor pays
    const monday = settleChallenges(s, { [slot.key]: facts(day(7), { week: { monday: MON, counted: 4 } }) }, at(day(7), 9));
    expect(monday.gained).toEqual([{ key: slot.key, n: 10, date: day(7) }]);
    // late evidence making it five afterwards does not pay again
    const again = settleChallenges(monday.store, { [slot.key]: facts(day(7), { week: { monday: MON, counted: 5 } }) }, at(day(7), 10));
    expect(again.store).toBe(monday.store);
    // five by Friday: the full 20 at once
    expect(settleChallenges(s, { [slot.key]: facts(day(4), { week: { counted: 5 } }) }, at(day(4), 9)).gained).toEqual([{ key: slot.key, n: 20, date: day(4) }]);
    // under the floor when the week ends: nothing, and nothing is said
    const lapsed = settleChallenges(s, { [slot.key]: facts(day(7), { week: { monday: MON, counted: 2 } }) }, at(day(7), 9));
    expect(lapsed.gained).toEqual([]);
    expect(lapsed.store.challenges[slot.key]?.state).toBe('added');
  });
  it('a day challenge not met by the time its day closes pays nothing', () => {
    const slot = daySlot(day(1));
    const s = added(slot, { item: 'goal', target: 1 });
    expect(settleChallenges(s, { [slot.key]: facts(day(3), { day: { goalDay: 'done' } }) }, at(day(3))).store).toBe(s);
  });
  it('a moved or deleted session voids a training challenge silently, as does a paused day or Fitness off', () => {
    const slot = daySlot(day(1));
    const s = added(slot, { item: 'session:run', target: 1 });
    const c = s.challenges[slot.key]!;
    const planned = facts(day(1), { planned: ['run'], day: { trainRequired: true, trainLeft: 1 } });
    expect(challengeState(c, slot, planned)).toEqual({ state: 'added', progress: 0, pay: 0 });
    expect(challengeState(c, slot, facts(day(1), { planned: ['run'], day: { train: { run: 'floor' }, trainRequired: true, trainLeft: 0 } }))).toEqual({ state: 'done', progress: 1, pay: 5 });
    // moved to another day, or deleted: the kind is no longer planned today
    expect(challengeState(c, slot, facts(day(1), { planned: [] })).state).toBe('void');
    expect(challengeState(c, slot, facts(day(1), { planned: ['lift'] })).state).toBe('void');
    expect(challengeState(c, slot, facts(day(1), { planned: ['run'], day: { held: true } })).state).toBe('void');
    expect(challengeState(c, slot, { ...planned, fitness: false }).state).toBe('void');
    const voided = settleChallenges(s, { [slot.key]: facts(day(1), { planned: [] }) }, at(day(1)));
    expect(voided.store.challenges[slot.key]?.state).toBe('void');
    expect(voided.gained).toEqual([]);
    expect(totalOf(voided.store)).toBe(0);
    // the week's training item: fewer sessions in the plan than it was made for
    const week = added(weekSlot(MON), { item: 'sessions', target: 3, floor: 2 });
    const wc = week.challenges[`challenge:w:${MON}`]!;
    expect(challengeState(wc, weekSlot(MON), facts(day(2), { week: { sessions: { planned: 4, done: 3 } } }))).toMatchObject({ state: 'done', pay: 20 });
    expect(challengeState(wc, weekSlot(MON), facts(day(2), { week: { sessions: { planned: 3, done: 3 } } })).state).toBe('void');
    // any paused day in the week releases a week challenge
    expect(challengeState(wc, weekSlot(MON), facts(day(2), { week: { sessions: { planned: 4, done: 1 }, paused: 1 } })).state).toBe('void');
  });
  it('a challenge that was only offered, or skipped, is never paid whatever happens', () => {
    const slot = daySlot(day(1));
    const offered = offerInto(emptyRewards(U, MON), slot, { item: 'goal', target: 1, base: 0 }, at(day(1), 7));
    const f = { [slot.key]: facts(day(1), { day: { goalDay: 'done' } }) };
    expect(settleChallenges(offered, f, at(day(1))).store).toBe(offered);
    const skipped = skipChallenge(offered, slot.key, at(day(1), 8));
    expect(settleChallenges(skipped, f, at(day(1))).store).toBe(skipped);
  });
  it('on a merge the further state wins, then the earlier time', () => {
    const slot = daySlot(day(1));
    const offered = offerInto(emptyRewards(U, MON), slot, { item: 'goal', target: 1, base: 0 }, at(day(1), 7));
    const other = offerInto(emptyRewards(U, MON), slot, { item: 'habits', target: 3, base: 0 }, at(day(1), 6));
    expect(mergeRewards(offered, other).challenges[slot.key]?.item).toBe('habits');
    const added = addChallenge(offered, slot, facts(day(1), { day: { goalDay: 'open' } }), at(day(1), 9));
    expect(mergeRewards(added, other).challenges[slot.key]).toMatchObject({ item: 'goal', state: 'added' });
    expect(mergeRewards(other, added).challenges[slot.key]).toMatchObject({ item: 'goal', state: 'added' });
  });
  it('"Drop it": an added challenge is let go like a skip, pays nothing, and a merge with a copy that still holds it does not bring it back', () => {
    const slot = daySlot(day(1));
    const offered = offerInto(emptyRewards(U, MON), slot, { item: 'goal', target: 1, base: 0 }, at(day(1), 7));
    const added = addChallenge(offered, slot, facts(day(1), { day: { goalDay: 'open' } }), at(day(1), 9));
    const dropped = skipChallenge(added, slot.key, at(day(1), 10));
    expect(dropped.challenges[slot.key]).toMatchObject({ item: 'goal', state: 'skipped' });
    expect(totalOf(dropped)).toBe(0);
    // the goal is done afterwards: nothing is paid, and it cannot be added again
    const f = { [slot.key]: facts(day(1), { day: { goalDay: 'done' } }) };
    expect(settleChallenges(dropped, f, at(day(1), 11)).store).toBe(dropped);
    expect(addChallenge(dropped, slot, facts(day(1), { day: { goalDay: 'open' } }), at(day(1), 11))).toBe(dropped);
    // the server's copy (or another phone's) still says added
    expect(mergeRewards(dropped, added).challenges[slot.key]?.state).toBe('skipped');
    expect(mergeRewards(added, dropped).challenges[slot.key]?.state).toBe('skipped');
    // a finished one is left alone, and a payment already made stands over a drop
    const done = settleChallenges(added, f, at(day(1), 10)).store;
    expect(skipChallenge(done, slot.key, at(day(1), 11))).toBe(done);
    expect(mergeRewards(dropped, done).challenges[slot.key]?.state).toBe('done');
    expect(totalOf(mergeRewards(dropped, done))).toBe(5);
  });
});

describe('cadence: two skips or lapses in a row stop a kind for 14 days', () => {
  const withStates = (states: Array<[number, Challenge['state']]>): Rewards => ({ ...emptyRewards(U, MON), challenges: Object.fromEntries(states.map(([n, state]) => [`challenge:d:${day(n)}`, { item: 'goal', target: 1, base: 0, state, at: at(day(n), 8).toISOString() }])) });
  it('one skip does not', () => {
    expect(mayOffer(withStates([[2, 'skipped']]), daySlot(day(9)), day(9))).toBe(true);
  });
  it('two skips do, for 14 days from the second', () => {
    const s = withStates([[2, 'skipped'], [9, 'skipped']]);
    expect(mayOffer(s, daySlot(day(16)), day(16))).toBe(false);
    expect(mayOffer(s, daySlot(day(22)), day(22))).toBe(false);
    expect(mayOffer(s, daySlot(day(23)), day(23))).toBe(true);
  });
  it('a lapse counts as a skip: offered and left, or added and not done', () => {
    expect(mayOffer(withStates([[2, 'offered'], [9, 'added']]), daySlot(day(16)), day(16))).toBe(false);
  });
  it('a done one in between resets it; a void one is no one’s choice; week challenges are counted apart', () => {
    expect(mayOffer(withStates([[2, 'skipped'], [9, 'done'], [16, 'skipped']]), daySlot(day(23)), day(23))).toBe(true);
    expect(mayOffer(withStates([[2, 'skipped'], [9, 'void'], [16, 'skipped']]), daySlot(day(23)), day(23))).toBe(false);
    expect(mayOffer(withStates([[2, 'skipped'], [9, 'skipped']]), weekSlot(day(14)), day(14))).toBe(true);
  });
  it('a slot that already holds a challenge is never offered again', () => {
    expect(mayOffer(withStates([[9, 'skipped']]), daySlot(day(9)), day(9))).toBe(false);
  });
});

describe('baselineOf: the person’s own record', () => {
  it('reads the last four finished weeks from the store, and how long the record is', () => {
    let s = emptyRewards(U, MON);
    const perWeek = [5, 3, 4, 6, 2];
    for (let i = 0; i < 35; i++) {
      const on = i % 7 < perWeek[Math.floor(i / 7)]!;
      s = reconcile(s, on ? [dayFacts(day(i), { habitsLive: 3, habitsDone: 3, habitsLiveDone: 3, goalDay: i % 7 === 0 ? 'done' : 'none' })] : [], at(day(i))).store;
    }
    const b = baselineOf(s, day(36), [1, 2, 3, 4]);
    expect(b.recordDays).toBe(36);
    // weeks 1 to 4 are the last four finished (week 0 is older)
    expect(b.weeks).toEqual([
      { days: 3, habitDays: 1, fullDays: 1 },
      { days: 4, habitDays: 2, fullDays: 1 },
      { days: 6, habitDays: 3, fullDays: 1 },
      { days: 2, habitDays: 4, fullDays: 1 },
    ]);
    // ten days in, there are not four finished weeks
    expect(baselineOf(s, day(10), []).weeks).toHaveLength(1);
    expect(baselineOf(s, day(10), []).recordDays).toBe(10);
  });
  it('remembers the last challenge of each item: its target, whether it was met, and whether it had risen', () => {
    const c = (n: number, target: number, state: Challenge['state']): [string, Challenge] => [`challenge:w:${day(n)}`, { item: 'days', target, floor: target - 1, base: 0, state, at: at(day(n), 8).toISOString() }];
    const s: Rewards = { ...emptyRewards(U, MON), challenges: Object.fromEntries([c(0, 3, 'done'), c(7, 4, 'done'), c(14, 4, 'added')]) };
    expect(baselineOf(s, day(21), []).last?.days).toEqual({ target: 4, met: false, weeksAgo: 1, rose: true });
    expect(baselineOf(s, day(14), []).last?.days).toEqual({ target: 4, met: true, weeksAgo: 1, rose: true });
    expect(baselineOf(s, day(63), []).last?.days).toEqual({ target: 4, met: false, weeksAgo: 7, rose: false });
  });
  it('after a pause: no rise, and Gentle for as many days as the pause lasted, up to 7', () => {
    let s = emptyRewards(U, MON);
    for (let i = 0; i < 12; i++) s = reconcile(s, [dayFacts(day(i), i >= 3 && i <= 5 ? { held: true } : { habitsDone: 1 })], at(day(i))).store;
    // paused days 3 to 5 (three days): gentle on days 6, 7 and 8
    expect(baselineOf(s, day(6), [])).toMatchObject({ gentle: true, paused: true });
    expect(baselineOf(s, day(8), [])).toMatchObject({ gentle: true, paused: true });
    expect(baselineOf(s, day(9), []).gentle).toBe(false);
    expect(baselineOf(s, day(9), []).paused).toBe(true);
    expect(baselineOf(s, day(40), []).paused).toBe(false);
  });
});
