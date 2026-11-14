import { addKeepsakes, daysBetween, emptyRewards, keepsakesDue, mondayOf, reconcile, RULES, shiftDays, totalOf, type Aim, type DayFacts, type Rewards } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { gemFor } from '../gems';
import { areaOf, domeBodies, domeBodiesUnder, domeSaid, FILL_AREA, OCULUS_AREA, PLANS, type DomeBody } from './bodies';
import { createWorld, pour, resting, settle } from './physics';
import { FILL, OCULUS, RADIUS } from './rules';

const U = 'u_owner';
const START = RULES.startsOn; // a Monday
const base = (date: string): DayFacts => ({ date, todosDone: 0, todosEarlier: 0, habitsLive: 4, habitsDone: 0, habitsLiveDone: 0, lines: 0, train: {}, auto: {}, trainRequired: false, trainLeft: 0, goalDay: 'none', held: false });
const goal = (level: Aim['level'], period: string, made: string, closed: string): Aim => ({ id: `g-${period}`, level, period, text: 'A goal', original: null, why: null, status: 'done', reflection: null, steps: [], createdAt: `${made}T09:00:00`, updatedAt: `${closed}T18:00:00`, closedAt: `${closed}T18:00:00` });
/** A store lived a day at a time from the rules' first day to `today`, the way the phone's reconciler builds one. */
const live = (today: string, factsOf: (date: string, i: number) => Partial<DayFacts>, goalsOn: (date: string) => Aim[] = () => []): Rewards => {
  let s = emptyRewards(U, START);
  for (let i = 0; i <= daysBetween(START, today); i++) {
    const d = shiftDays(START, i);
    const now = new Date(`${d}T12:00:00`);
    s = reconcile(s, [{ ...base(d), ...factsOf(d, i) }], now, { goals: goalsOn(d) }).store;
    s = addKeepsakes(s, keepsakesDue(s, now, { goals: goalsOn(d) }));
  }
  return s;
};
/** A light week: a few habits most days, a to-do, the day's goal some days. */
const light = (_d: string, i: number): Partial<DayFacts> => (i % 7 === 5 ? {} : { todosDone: 1, habitsDone: 3, habitsLiveDone: 3, goalDay: i % 7 < 3 ? 'done' : 'open' });
/** A usual one: to-dos, habits, a run three days a week, the day's goal on weekdays. */
const usual = (_d: string, i: number): Partial<DayFacts> => {
  const dow = i % 7;
  if (dow === 5 || (dow === 2 && i % 3 === 0)) return {};
  const run = dow === 1 || dow === 3 || dow === 6;
  return { todosDone: 2, todosEarlier: 1, habitsDone: 3, habitsLiveDone: 3, train: run ? { run: 'done' } : {}, trainRequired: run, goalDay: dow < 4 ? 'done' : 'open' };
};
/** Everything the rules pay, every day: five to-dos, eight habits, two sessions, the goal, a full day. */
const most = (): Partial<DayFacts> => ({ todosDone: 9, todosEarlier: 4, habitsLive: 8, habitsDone: 8, habitsLiveDone: 8, train: { run: 'done', lift: 'done' }, trainRequired: true, trainLeft: 0, goalDay: 'done' });
const monthGoals = (d: string): Aim[] => (d.slice(8) >= '24' && d.slice(8) <= '28' ? [goal('month', d.slice(0, 7), `${d.slice(0, 7)}-02`, `${d.slice(0, 7)}-24`)] : []);

const sum = (bodies: readonly DomeBody[]) => bodies.reduce((t, b) => t + b.worth, 0);
const of = (bodies: readonly DomeBody[], tier: DomeBody['tier']) => bodies.filter((b) => b.tier === tier);
const at = (weeks: number, days = 3) => shiftDays(START, weeks * 7 + days);

// built once: living two years a day at a time is the slow part
const stores = {
  oneDay: live(START, () => ({ todosDone: 2, habitsDone: 3, habitsLiveDone: 3, goalDay: 'done' })),
  sixWeeks: live(at(6), usual, monthGoals),
  year: live(at(52), usual, monthGoals),
  lightYear: live(at(52), light),
  twoYears: live(at(104), usual, monthGoals),
  mostYear: live(at(52, 6), most, monthGoals),
};

describe('the worth of every body adds up to the total', () => {
  it('for every store, on every day of a week, with Fitness on or off', () => {
    for (const [name, s] of Object.entries(stores)) {
      for (let k = 0; k < 9; k++) {
        const today = shiftDays(s.clock, k);
        for (const fitness of [true, false]) {
          const bodies = domeBodies(s, today, { fitness });
          expect(sum(bodies), `${name} +${k}`).toBe(totalOf(s));
          expect(bodies.every((b) => b.worth > 0 && b.r >= RADIUS.todo && b.r <= RADIUS.year)).toBe(true);
          expect(new Set(bodies.map((b) => b.id)).size).toBe(bodies.length);
        }
      }
    }
  });
  it('under every plan, even the ones no store needs: each holds the same Orbs in no more room', () => {
    for (const [name, s] of Object.entries(stores)) {
      let room = Infinity;
      for (let p = 0; p < PLANS.length; p++) {
        const bodies = domeBodiesUnder(s, s.clock, p);
        expect(sum(bodies), `${name} plan ${p}`).toBe(totalOf(s));
        expect(new Set(bodies.map((b) => b.id)).size).toBe(bodies.length);
        expect(areaOf(bodies)).toBeLessThanOrEqual(room + 1e-6);
        room = areaOf(bodies);
      }
      // the last plan is today's awards, what was paid once this week, and at most two bodies for everything before
      const last = domeBodiesUnder(s, s.clock, PLANS.length - 1);
      expect(last.filter((b) => b.tier !== 'award').length).toBeLessThanOrEqual(2);
      expect(last.filter((b) => b.tier === 'award').every((b) => b.date === s.clock || b.id.startsWith('o:'))).toBe(true);
    }
  });
  it('a day whose detail was lost, a key this build does not know and an empty record lose nothing', () => {
    const today = at(1, 2);
    const s: Rewards = {
      ...emptyRewards(U, START),
      clock: today,
      days: {
        [START]: { n: 12, a: 3, c: 1 },
        [shiftDays(today, -1)]: { n: 9, a: 2, k: { todo: 2, habit: 3 }, c: 1 },
        [today]: { n: 7, a: 3, k: { todo: 1, 'train:run': 2, 'goal:day': 3 } },
        [shiftDays(today, -2)]: { n: 0, a: 0, h: 1, c: 1 },
      },
      once: { 'future:thing': { on: today, n: 7 }, [`week:${START}`]: { on: shiftDays(today, -1), n: 5 }, 'goal:month:2026-11': { on: shiftDays(START, 2), n: 30 } },
    };
    const bodies = domeBodies(s, today);
    expect(sum(bodies)).toBe(totalOf(s));
    expect(sum(bodies)).toBe(12 + 9 + 7 + 7 + 5 + 30);
    // yesterday's 9 are 2 to-dos, 3 habits and one body for the 4 its kinds do not account for
    expect(bodies.filter((b) => b.date === shiftDays(today, -1)).map((b) => [b.key, b.worth])).toEqual([['todo', 1], ['todo', 1], ['habit', 1], ['habit', 1], ['habit', 1], ['fused:week', 4], [`week:${START}`, 5]]);
    // the first week holds its day and the month goal paid in it
    expect(of(bodies, 'week').map((b) => b.worth)).toEqual([42]);
  });
  it('an empty store is an empty window', () => {
    expect(domeBodies(emptyRewards(U, START), START)).toEqual([]);
    expect(domeBodies(emptyRewards(U, START), shiftDays(START, -4))).toEqual([]);
  });
});

describe('this week is one body per award', () => {
  const s = stores.oneDay;
  const bodies = domeBodies(s, START);
  it('a to-do and a habit are 1 each, today’s goal one worth 3, a full day one worth 5', () => {
    expect(bodies.map((b) => [b.key, b.worth, b.r])).toEqual([
      ['todo', 1, RADIUS.todo],
      ['todo', 1, RADIUS.todo],
      ['habit', 1, RADIUS.habit],
      ['habit', 1, RADIUS.habit],
      ['habit', 1, RADIUS.habit],
      ['goal:day', 3, RADIUS.goalDay],
      ['full', 5, RADIUS.full],
    ]);
    expect(bodies.every((b) => b.tier === 'award' && b.fresh)).toBe(true);
  });
  it('a session is one worth 3, or 2 and smaller at its floor', () => {
    const run = live(START, () => ({ train: { run: 'done', lift: 'floor' } }));
    expect(domeBodies(run, START).map((b) => [b.key, b.worth, b.r])).toEqual([
      ['train:run', 3, RADIUS.train],
      ['train:lift', 2, RADIUS.trainFloor],
    ]);
  });
  it('says what a tap shows: the kind and the day, never a name the store does not hold', () => {
    expect(bodies.map((b) => b.caption)).toEqual(['A to-do · today', 'A to-do · today', 'A habit · today', 'A habit · today', 'A habit · today', 'Today’s goal · today', 'A full day · today']);
    const next = domeBodies(s, shiftDays(START, 1));
    expect(next.map((b) => b.caption).slice(-2)).toEqual(['A day’s goal · Mon, Nov 16', 'A full day · Mon, Nov 16']);
    expect(next.every((b) => !b.fresh)).toBe(true);
  });
  it('a body keeps its id when another is earned, and only today’s drop in', () => {
    const before = domeBodies(stores.sixWeeks, stores.sixWeeks.clock);
    const more = reconcile(stores.sixWeeks, [{ ...base(stores.sixWeeks.clock), ...usual('', daysBetween(START, stores.sixWeeks.clock)), todosDone: 5, habitsDone: 4, habitsLiveDone: 4 }], new Date(`${stores.sixWeeks.clock}T15:00:00`)).store;
    const after = domeBodies(more, more.clock);
    expect(after.length).toBeGreaterThan(before.length);
    const ids = new Set(after.map((b) => b.id));
    expect(before.every((b) => ids.has(b.id))).toBe(true);
    const fresh = after.filter((b) => b.fresh);
    expect(fresh.length).toBeGreaterThan(0);
    expect(fresh.every((b) => b.date === more.clock)).toBe(true);
    expect(after.filter((b) => !b.fresh).every((b) => b.date < more.clock)).toBe(true);
  });
  it('each Orb’s drawing is its kind’s own, the same for the same body every time (what it looks like is the family’s business)', () => {
    const all = domeBodies(stores.sixWeeks, stores.sixWeeks.clock);
    expect(domeBodies({ ...stores.sixWeeks }, stores.sixWeeks.clock).map((b) => b.gem)).toEqual(all.map((b) => b.gem));
    for (const b of all) expect(b.gem).toEqual(gemFor(b.key, b.id, b.gem.stars === undefined ? undefined : { stars: b.gem.stars }));
  });
});

describe('the past fuses', () => {
  it('six weeks in: this week’s awards, then one body for each earlier week', () => {
    const s = stores.sixWeeks;
    const bodies = domeBodies(s, s.clock);
    const weeks = of(bodies, 'week');
    expect(weeks).toHaveLength(6);
    expect(of(bodies, 'chapter')).toHaveLength(0);
    expect(weeks.map((b) => b.date)).toEqual([0, 1, 2, 3, 4, 5].map((w) => shiftDays(START, w * 7)));
    expect(weeks[0]!.caption).toMatch(/^Week of Nov 16 · \d+ Orbs · \d days$/);
    expect(weeks.every((b) => b.key === 'fused:week' && b.r >= RADIUS.week[0] && b.r <= RADIUS.week[1])).toBe(true);
    // the oldest are poured first and lie lowest; this week's are on top, today's last
    expect(bodies.findIndex((b) => b.tier === 'award')).toBe(weeks.length);
    expect(bodies.slice(bodies.findIndex((b) => b.fresh)).every((b) => b.fresh)).toBe(true);
    // a week's body holds its days and what was paid once in it
    const first = shiftDays(START, 0);
    let held = 0;
    for (let i = 0; i < 7; i++) held += s.days[shiftDays(first, i)]?.n ?? 0;
    for (const k in s.once) if (mondayOf(s.once[k]!.on) === first) held += s.once[k]!.n;
    expect(weeks[0]!.worth).toBe(held);
  });
  it('past the last four weeks a chapter is one body, named as its keepsake is', () => {
    const today = at(9);
    const s = live(today, usual);
    const bodies = domeBodies(s, today);
    // chapter 1 (weeks 0 to 3) closed more than four weeks ago; chapter 2 (weeks 4 to 7) has weeks among the last four
    expect(of(bodies, 'chapter').map((b) => b.caption.split(' · ')[0])).toEqual(['Chapter 1']);
    expect(of(bodies, 'week').map((b) => b.date)).toEqual([4, 5, 6, 7, 8].map((w) => shiftDays(START, w * 7)));
    expect(of(bodies, 'chapter')[0]!.date).toBe(START);
    expect(bodies[0]!.tier).toBe('chapter');
  });
  it('a year in: the newest chapters apart, what is older as one, weeks for the last few, awards for this one', () => {
    const s = stores.lightYear;
    const bodies = domeBodies(s, s.clock);
    expect(of(bodies, 'chapter').length).toBeGreaterThanOrEqual(4);
    expect(of(bodies, 'year')).toHaveLength(1);
    expect(of(bodies, 'week').length).toBeGreaterThanOrEqual(FILL.weeks);
    expect(of(bodies, 'week').length).toBeLessThanOrEqual(FILL.weeks + 3);
    expect(of(bodies, 'award').length).toBeGreaterThan(15);
    // in the order they are poured: the oldest stretch, the chapters oldest first, the weeks, this week
    expect(bodies.map((b) => b.tier).filter((t, i, all) => t !== all[i - 1])).toEqual(['year', 'chapter', 'week', 'award']);
  });
  it('two years in: what is older than a year is one body a year, and each says the months it holds', () => {
    const s = stores.twoYears;
    const bodies = domeBodies(s, s.clock);
    const years = of(bodies, 'year');
    expect(years.length).toBeGreaterThanOrEqual(1);
    expect(years[0]!.caption).toMatch(/^Nov 2026 to \w{3} 202[78] · [\d,]+ Orbs$/);
    expect(years.every((b) => b.r === RADIUS.year && b.key === 'fused:year')).toBe(true);
    expect(bodies[0]!.tier).toBe('year');
    expect(sum(bodies)).toBe(totalOf(s));
  });
});

describe('the circle is never more than half covered', () => {
  it('for a year and for two, light, usual and with everything the rules pay', () => {
    for (const [name, s] of Object.entries(stores)) {
      for (let k = 0; k < 8; k++) {
        const today = shiftDays(s.clock, k);
        expect(areaOf(domeBodies(s, today)), `${name} +${k}`).toBeLessThanOrEqual(FILL_AREA);
      }
    }
    expect(FILL_AREA / OCULUS_AREA).toBeCloseTo(FILL.limit, 6);
  });
  it('at the limit the past gives way first: this week stays one body per award', () => {
    for (const s of [stores.year, stores.twoYears]) {
      const bodies = domeBodies(s, s.clock);
      const whole = domeBodiesUnder(s, s.clock, 0);
      expect(areaOf(whole)).toBeGreaterThan(FILL_AREA);
      expect(of(bodies, 'award')).toEqual(of(whole, 'award'));
      expect(of(bodies, 'day')).toHaveLength(0);
      expect(of(bodies, 'week')).toEqual(of(whole, 'week'));
      expect(of(bodies, 'chapter').length).toBeLessThan(of(whole, 'chapter').length);
    }
    // a usual year still keeps its newest chapters apart; two usual years keep the weeks and give up the chapters
    expect(of(domeBodies(stores.year, stores.year.clock), 'chapter').length).toBeGreaterThanOrEqual(2);
    // with less to hold, more of the past is kept apart
    const count = (s: Rewards) => of(domeBodies(s, s.clock), 'chapter').length;
    expect(count(stores.lightYear)).toBeGreaterThan(count(stores.twoYears));
  });
  it('a week of everything the rules pay is more than the window holds: today stays one per award, each earlier day of the week is one', () => {
    const s = stores.mostYear;
    const bodies = domeBodies(s, s.clock);
    expect(areaOf(of(domeBodiesUnder(s, s.clock, 0), 'award'))).toBeGreaterThan(FILL_AREA);
    expect(of(bodies, 'award').length).toBeGreaterThan(12);
    expect(of(bodies, 'award').every((b) => b.date === s.clock || b.id.startsWith('o:'))).toBe(true);
    expect(of(bodies, 'day')).toHaveLength(6);
    expect(of(bodies, 'day').map((b) => b.caption)).toEqual(expect.arrayContaining([expect.stringMatching(/^Mon, \w{3} \d+ · \d+ Orbs$/)]));
    expect(of(bodies, 'chapter').length + of(bodies, 'week').length).toBe(0);
    expect(of(bodies, 'year')).toHaveLength(1);
    expect(sum(bodies)).toBe(totalOf(s));
  });
  it('ten years of everything still fits, and still adds up', () => {
    // not lived a day at a time (that is 3,650 passes): a store of the same shape, written out
    const today = shiftDays(START, 3650);
    const s: Rewards = { ...emptyRewards(U, START), clock: today };
    for (let i = 0; i <= 3650; i++) s.days[shiftDays(START, i)] = { n: 27, a: 16, ...(i > 3650 - 60 ? { k: { todo: 5, habit: 8, 'train:run': 3, 'train:lift': 3, 'goal:day': 3, full: 5 } } : null), ...(i < 3650 ? { c: 1 as const } : null) };
    for (let w = 0; w < 520; w++) s.once[`week:${shiftDays(START, w * 7)}`] = { on: shiftDays(START, w * 7 + 8), n: 20 };
    const bodies = domeBodies(s, today);
    expect(sum(bodies)).toBe(totalOf(s));
    expect(areaOf(bodies)).toBeLessThanOrEqual(FILL_AREA);
    expect(bodies.length).toBeLessThan(160);
  });
  it('what fits by area also settles inside the circle, with room over it', () => {
    for (const s of [stores.mostYear, stores.twoYears]) {
      const bodies = domeBodies(s, s.clock);
      const W = createWorld(OCULUS.d);
      pour(W, bodies.map((b) => b.r));
      settle(W);
      expect(resting(W)).toBe(true);
      let top = W.d;
      for (let i = 0; i < W.n; i++) top = Math.min(top, W.y[i]! - W.r[i]!);
      // the pile's top is below the top of the circle: today's Orbs have somewhere to fall from
      expect(top).toBeGreaterThan(W.d * 0.12);
    }
  });
});

describe('which plan each store gets', () => {
  it('six weeks keep everything apart; a year keeps some chapters; two years keep the weeks; a year of everything gives up the past and the week’s own days', () => {
    const planOf = (s: Rewards) => PLANS.findIndex((_p, i) => areaOf(domeBodiesUnder(s, s.clock, i)) <= FILL_AREA);
    const chapters = (s: Rewards) => PLANS[planOf(s)]!.chapters;
    expect(planOf(stores.oneDay)).toBe(0);
    expect(planOf(stores.sixWeeks)).toBe(0);
    expect(chapters(stores.lightYear)).toBeGreaterThanOrEqual(4);
    expect(chapters(stores.year)).toBeGreaterThanOrEqual(2);
    expect(PLANS[planOf(stores.twoYears)]).toMatchObject({ merge: false, weeks: FILL.weeks, days: 'each' });
    expect(PLANS[planOf(stores.mostYear)]).toEqual({ chapters: 0, merge: true, weeks: 0, days: 'day' });
  });
});

describe('the same every time', () => {
  it('the same store and day give the same bodies, whatever order its keys were written in', () => {
    const s = stores.year;
    const shuffled: Rewards = { ...s, days: Object.fromEntries(Object.entries(s.days).reverse()), once: Object.fromEntries(Object.entries(s.once).reverse()) };
    expect(domeBodies(shuffled, s.clock)).toEqual(domeBodies(s, s.clock));
    expect(domeBodies(s, s.clock)).toBe(domeBodies(s, s.clock));
  });
});

describe('in words', () => {
  it('says the total, this week by kind, and how much of the past there is', () => {
    const s = stores.oneDay;
    expect(domeSaid(s, START)).toEqual({ summary: '13 Orbs. This week: 3 habits, 2 to-dos, today’s goal, 1 full day.', items: [] });
    const six = domeSaid(stores.sixWeeks, stores.sixWeeks.clock);
    expect(six.summary).toMatch(/^[\d,]+ Orbs\. This week: \d+ habits, \d+ to-dos, \d runs?, \d days’ goals, \d full days?(, 1 week that counts)?\. 6 earlier weeks\.$/);
    expect(six.items).toHaveLength(6);
    expect(six.items[0]).toMatch(/^Week of Dec 21 · /);
    expect(domeSaid(stores.twoYears, stores.twoYears.clock).summary).toMatch(/\d+ earlier weeks, 2 longer stretches\.$/);
  });
  it('with Fitness off nothing names training', () => {
    const s = stores.sixWeeks;
    const said = domeSaid(s, s.clock, { fitness: false });
    const captions = domeBodies(s, s.clock, { fitness: false }).map((b) => b.caption);
    for (const text of [said.summary, ...said.items, ...captions]) expect(text).not.toMatch(/\brun|lift|session|training|cross/i);
    expect(captions.some((c) => c.startsWith('Earned earlier · '))).toBe(true);
    expect(domeBodies(s, s.clock).some((b) => b.caption.startsWith('A run · '))).toBe(true);
  });
  it('never a word the words table forbids, never a zero, never an em dash', () => {
    for (const s of Object.values(stores)) {
      const said = domeSaid(s, s.clock);
      for (const text of [said.summary, ...said.items, ...domeBodies(s, s.clock).map((b) => b.caption)]) {
        expect(text).not.toMatch(/jar|marble|coin|points|\bXP\b|streak|\bAI\b|coach|\bbot\b|—/i);
        expect(text).not.toMatch(/(^|\s)0(\s|$)/);
      }
    }
  });
});
