import { addKeepsakes, daysBetween, emptyRewards, keepsakesDue, mondayOf, reconcile, RULES, shiftDays, totalOf, type Aim, type DayFacts, type Rewards } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { rungOf } from '../gems';
import { areaOf, domeBodies, domeBodiesUnder, domeSaid, FILL_AREA, isKept, OCULUS_AREA, PLANS, type DomeBody } from './bodies';
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
          expect(bodies.every((b) => b.worth > 0 && b.r >= RADIUS.rung[0] && b.r <= RADIUS.year)).toBe(true);
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
      // the last plan is today's awards, what was paid once this week, the Orbs that never fuse, and at most two bodies for everything before
      const last = domeBodiesUnder(s, s.clock, PLANS.length - 1);
      expect(last.filter((b) => b.tier !== 'award' && b.tier !== 'kept').length).toBeLessThanOrEqual(2);
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
    // the first week holds its day; the month goal paid in it is not in its total: it stays in the window as itself
    expect(of(bodies, 'week').map((b) => b.worth)).toEqual([12]);
    expect(of(bodies, 'kept').map((b) => [b.id, b.key, b.worth, b.r, b.caption])).toEqual([['o:goal:month:2026-11', 'goal:month:2026-11', 30, RADIUS.rung[3], 'A month goal · Sunrise · November']]);
  });
  it('an empty store is an empty window', () => {
    expect(domeBodies(emptyRewards(U, START), START)).toEqual([]);
    expect(domeBodies(emptyRewards(U, START), shiftDays(START, -4))).toEqual([]);
  });
});

describe('this week is one body per award', () => {
  const s = stores.oneDay;
  const bodies = domeBodies(s, START);
  it('a to-do and a habit are 1 each, today’s goal one worth 3, a full day one worth 5; each is as large as its rung', () => {
    expect(bodies.map((b) => [b.key, b.worth, b.r])).toEqual([
      ['todo', 1, RADIUS.rung[0]],
      ['todo', 1, RADIUS.rung[0]],
      ['habit', 1, RADIUS.rung[0]],
      ['habit', 1, RADIUS.rung[0]],
      ['habit', 1, RADIUS.rung[0]],
      ['goal:day', 3, RADIUS.rung[1]],
      ['full', 5, RADIUS.rung[1]],
    ]);
    expect(bodies.every((b) => b.tier === 'award' && b.fresh)).toBe(true);
  });
  it('a session is one worth 3, or 2 at its floor: the same Dawn Orb, for its size is its rung’s and never what it paid', () => {
    const run = live(START, () => ({ train: { run: 'done', lift: 'floor' } }));
    expect(domeBodies(run, START).map((b) => [b.key, b.worth, b.r])).toEqual([
      ['train:run', 3, RADIUS.rung[1]],
      ['train:lift', 2, RADIUS.rung[1]],
    ]);
  });
  it('says what a tap shows: the kind and the day, never a name the store does not hold', () => {
    expect(bodies.map((b) => b.caption)).toEqual(['A to-do · Sky · today', 'A to-do · Sky · today', 'A habit · Sky · today', 'A habit · Sky · today', 'A habit · Sky · today', 'Today’s goal · Dawn · today', 'A full day · Dawn · today']);
    const next = domeBodies(s, shiftDays(START, 1));
    expect(next.map((b) => b.caption).slice(-2)).toEqual(['A day’s goal · Dawn · Mon, Nov 16', 'A full day · Dawn · Mon, Nov 16']);
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
  it('each Orb’s drawing is its rung’s, the same for the same body every time; a fused one is a Sky Orb, or a Dawn Orb', () => {
    const all = domeBodies(stores.sixWeeks, stores.sixWeeks.clock);
    expect(domeBodies({ ...stores.sixWeeks }, stores.sixWeeks.clock).map((b) => b.gem)).toEqual(all.map((b) => b.gem));
    for (const b of all) {
      if (b.key.startsWith('fused:')) expect([1, 2]).toContain(b.gem.rung);
      else expect(b.gem).toEqual({ rung: rungOf(b.key) });
    }
    expect(new Set(all.map((b) => b.gem.rung))).toEqual(new Set([1, 2, 3, 4]));
  });
  it('an award is as large as its rung: 12, 14, 16, 19, 23', () => {
    expect(RADIUS.rung).toEqual([12, 14, 16, 19, 23]);
    const today = at(0, 3);
    const s: Rewards = { ...emptyRewards(U, START), clock: today, days: { [today]: { n: 4, a: 2, k: { todo: 1, 'goal:day': 3 } } }, once: { [`challenge:d:${today}`]: { on: today, n: 5 }, 'goal:week:2026-11-16': { on: today, n: 9 }, 'goal:month:2026-11': { on: today, n: 30 }, 'goal:year:2026': { on: today, n: 90 } } };
    const bodies = domeBodies(s, today);
    expect(bodies.map((b) => [b.key.split(':').slice(0, 2).join(':'), b.gem.rung, b.r])).toEqual([
      ['todo', 1, 12],
      ['goal:day', 2, 14],
      ['challenge:d', 3, 16],
      ['goal:month', 4, 19],
      ['goal:week', 3, 16],
      ['goal:year', 5, 23],
    ]);
    expect(bodies.every((b) => b.tier === 'award')).toBe(true);
    expect(bodies.map((b) => b.caption).slice(-3)).toEqual(['A month goal · Sunrise · November', 'A week goal · Glow · today', 'A year goal · Sun · 2026']);
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
    // the oldest are poured first and lie lowest; then the two month goals that stay as themselves; this week's are on top, today's last
    expect(of(bodies, 'kept').map((b) => b.key)).toEqual(['goal:month:2026-11', 'goal:month:2026-12']);
    expect(bodies.findIndex((b) => b.tier === 'kept')).toBe(weeks.length);
    expect(bodies.findIndex((b) => b.tier === 'award')).toBe(weeks.length + 2);
    expect(bodies.slice(bodies.findIndex((b) => b.fresh)).every((b) => b.fresh)).toBe(true);
    // a week's body holds its days and what was paid once in it
    const first = shiftDays(START, 0);
    let held = 0;
    for (let i = 0; i < 7; i++) held += s.days[shiftDays(first, i)]?.n ?? 0;
    for (const k in s.once) if (mondayOf(s.once[k]!.on) === first && !isKept(k)) held += s.once[k]!.n;
    expect(weeks[0]!.worth).toBe(held);
    // a week that counted is a Dawn Orb, one that did not a Sky Orb
    for (const w of weeks) expect(w.gem.rung, w.caption).toBe(s.once[`week:${w.date}`] ? 2 : 1);
    expect(new Set(weeks.map((w) => w.gem.rung)).has(2)).toBe(true);
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
    // a year where most weeks counted is a Dawn Orb
    expect(years[0]!.gem.rung).toBe(2);
    expect(years.every((b) => b.r === RADIUS.year && b.key === 'fused:year')).toBe(true);
    expect(bodies[0]!.tier).toBe('year');
    expect(sum(bodies)).toBe(totalOf(s));
  });
});

describe('a Sunrise and a Sun Orb never fuse', () => {
  /** A store written out: `weeks` usual weeks, a month goal met in each of `months` months and a year goal in each of `years` years, all before this week. */
  const long = (weeks: number, months: number, years: number): Rewards => {
    const today = at(weeks);
    const s: Rewards = { ...emptyRewards(U, START), clock: today };
    for (let i = 0; i <= weeks * 7 + 3; i++) s.days[shiftDays(START, i)] = { n: 9, a: 4, ...(i > weeks * 7 - 30 ? { k: { todo: 2, habit: 4, 'goal:day': 3 } } : null), c: 1 };
    for (let w = 0; w < weeks; w++) s.once[`week:${shiftDays(START, w * 7)}`] = { on: shiftDays(START, w * 7 + 8), n: 20 };
    for (let m = 0; m < months; m++) {
      const on = shiftDays(START, 10 + m * 30);
      s.once[`goal:month:${on.slice(0, 7)}`] = { on, n: 30 };
    }
    for (let y = 0; y < years; y++) s.once[`goal:year:${2026 + y}`] = { on: shiftDays(START, 40 + y * 364), n: 90 };
    return s;
  };
  it('each stays in the window as itself, whatever week it came from, and its worth is not in its week’s Orb', () => {
    const s = long(30, 6, 1);
    const bodies = domeBodies(s, s.clock);
    const kept = of(bodies, 'kept');
    // oldest first, by the day each was paid
    expect(kept.map((b) => b.key)).toEqual(['goal:month:2026-11', 'goal:month:2026-12', 'goal:year:2026', 'goal:month:2027-01', 'goal:month:2027-02', 'goal:month:2027-03', 'goal:month:2027-04']);
    expect(kept.map((b) => b.worth)).toEqual([30, 30, 90, 30, 30, 30, 30]);
    expect(kept.map((b) => b.gem.rung)).toEqual([4, 4, 5, 4, 4, 4, 4]);
    expect(kept.map((b) => b.r)).toEqual([19, 19, 23, 19, 19, 19, 19]);
    expect(kept.every((b) => !b.fresh && b.id === `o:${b.key}`)).toBe(true);
    // what a tap says: its kind, its rung, and the month or year it was for
    expect(kept.slice(0, 3).map((b) => b.caption)).toEqual(['A month goal · Sunrise · November 2026', 'A month goal · Sunrise · December 2026', 'A year goal · Sun · 2026']);
    expect(kept.at(-1)!.caption).toBe('A month goal · Sunrise · April');
    // the sum still stands, and nothing fused holds a kept Orb's worth
    expect(sum(bodies)).toBe(totalOf(s));
    const fused = bodies.filter((b) => b.tier !== 'award' && b.tier !== 'kept');
    let past = 0;
    for (const d in s.days) if (d < mondayOf(s.clock)) past += s.days[d]!.n;
    for (const k in s.once) if (s.once[k]!.on < mondayOf(s.clock) && !isKept(k)) past += s.once[k]!.n;
    expect(sum(fused)).toBe(past);
  });
  it('under every plan: the same kept Orbs, however far the rest is fused', () => {
    const s = long(30, 6, 1);
    const ids = (p: number) => of(domeBodiesUnder(s, s.clock, p), 'kept').map((b) => b.id);
    for (let p = 0; p < PLANS.length; p++) {
      expect(ids(p), `plan ${p}`).toEqual(ids(0));
      expect(sum(domeBodiesUnder(s, s.clock, p))).toBe(totalOf(s));
    }
    expect(ids(0)).toHaveLength(7);
  });
  it('one earned this week is an award like any other, and keeps its id when the week turns', () => {
    const today = at(2, 2);
    const s: Rewards = { ...emptyRewards(U, START), clock: today, days: { [today]: { n: 1, a: 1, k: { todo: 1 } } }, once: { 'goal:month:2026-11': { on: today, n: 30 } } };
    const now = domeBodies(s, today);
    expect(now.map((b) => [b.id, b.tier, b.fresh])).toEqual([['d:' + today + ':todo:0', 'award', true], ['o:goal:month:2026-11', 'award', true]]);
    const later = domeBodies(s, shiftDays(today, 7));
    expect(later.map((b) => [b.id, b.tier, b.worth])).toEqual([['w:' + mondayOf(today), 'week', 1], ['o:goal:month:2026-11', 'kept', 30]]);
    expect(later[1]!.gem).toEqual(now[1]!.gem);
    expect(later[1]!.r).toBe(now[1]!.r);
  });
  it('when they are many they are drawn smaller, together, before any is put away', () => {
    const s = long(60, 14, 1);
    const kept = of(domeBodies(s, s.clock), 'kept');
    expect(kept).toHaveLength(15);
    const scale = kept[0]!.r / RADIUS.rung[3];
    expect(scale).toBeLessThan(1);
    expect(scale).toBeGreaterThanOrEqual(FILL.keptScale - 0.01);
    for (const b of kept) expect(b.r / RADIUS.rung[b.gem.rung - 1]!).toBeCloseTo(scale, 1);
    // a Sun Orb is still the largest, and a Sunrise Orb still larger than a Sky Orb
    expect(Math.min(...kept.map((b) => b.r))).toBeGreaterThan(RADIUS.rung[0]);
    expect(areaOf(kept)).toBeLessThanOrEqual(FILL.kept * FILL_AREA + 1);
  });
  it('ten years of a month goal every month and a year goal every year still fits and adds up: the oldest month goals join their stretch, a year goal never before them', () => {
    const s = long(520, 120, 10);
    const bodies = domeBodies(s, s.clock);
    expect(sum(bodies)).toBe(totalOf(s));
    expect(areaOf(bodies)).toBeLessThanOrEqual(FILL_AREA);
    const kept = of(bodies, 'kept');
    expect(kept.length).toBeGreaterThan(10);
    expect(kept.length).toBeLessThan(130);
    // every year goal is still there, and the month goals that stay are the newest
    expect(kept.filter((b) => b.gem.rung === 5)).toHaveLength(10);
    const months = kept.filter((b) => b.gem.rung === 4).map((b) => b.date);
    const all = Object.keys(s.once).filter((k) => k.startsWith('goal:month:')).map((k) => s.once[k]!.on).sort();
    expect(months).toEqual(all.slice(all.length - months.length));
    expect(kept.every((b) => b.r >= RADIUS.rung[b.gem.rung - 1]! * FILL.keptScale - 0.06)).toBe(true);
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
    for (const s of [stores.year, stores.twoYears, stores.lightYear]) {
      const bodies = domeBodies(s, s.clock);
      const whole = domeBodiesUnder(s, s.clock, 0);
      expect(areaOf(whole)).toBeGreaterThan(FILL_AREA);
      expect(of(bodies, 'award')).toEqual(of(whole, 'award'));
      expect(of(bodies, 'day')).toHaveLength(0);
      expect(of(bodies, 'chapter').length).toBeLessThan(of(whole, 'chapter').length);
    }
    // a light year keeps its last weeks and its newest chapters apart
    const light = domeBodies(stores.lightYear, stores.lightYear.clock);
    expect(of(light, 'week')).toEqual(of(domeBodiesUnder(stores.lightYear, stores.lightYear.clock, 0), 'week'));
    expect(of(light, 'chapter').length).toBeGreaterThanOrEqual(2);
    // a year with a month goal met every month keeps its twelve Sunrise Orbs, and the rest of the past is one Orb
    const year = domeBodies(stores.year, stores.year.clock);
    expect(of(year, 'kept')).toHaveLength(12);
    expect(of(year, 'year')).toHaveLength(1);
    expect(of(year, 'chapter').length + of(year, 'week').length).toBe(0);
  });
  it('a week of everything the rules pay is more than the window holds: today stays one per award, each earlier day of the week is one', () => {
    const s = stores.mostYear;
    const bodies = domeBodies(s, s.clock);
    expect(areaOf(of(domeBodiesUnder(s, s.clock, 0), 'award'))).toBeGreaterThan(FILL_AREA);
    expect(of(bodies, 'award').length).toBeGreaterThan(12);
    expect(of(bodies, 'award').every((b) => b.date === s.clock || b.id.startsWith('o:'))).toBe(true);
    // the month goals keep the least room they are promised, at their smallest size
    expect(of(bodies, 'kept').length).toBeGreaterThanOrEqual(8);
    expect(areaOf(of(bodies, 'kept'))).toBeLessThanOrEqual(FILL.keptLeast * FILL_AREA + 1);
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
    // a month goal met every month: the Sunrise Orbs stay, and what is older than this week is one Orb beside them
    expect(PLANS[planOf(stores.year)]).toEqual({ chapters: 0, merge: true, weeks: 0, days: 'each' });
    expect(PLANS[planOf(stores.twoYears)]).toEqual({ chapters: 0, merge: true, weeks: 0, days: 'each' });
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
    expect(six.summary).toMatch(/^[\d,]+ Orbs\. This week: \d+ habits, \d+ to-dos, \d runs?, \d days’ goals, \d full days?(, 1 week that counts)?\. From earlier weeks: 2 month goals\. 6 earlier weeks\.$/);
    expect(six.items).toHaveLength(6);
    expect(six.items[0]).toMatch(/^Week of Dec 21 · /);
    expect(domeSaid(stores.twoYears, stores.twoYears.clock).summary).toMatch(/ From earlier weeks: \d+ month goals\. 1 longer stretch\.$/);
    expect(domeSaid(stores.lightYear, stores.lightYear.clock).summary).toMatch(/\d+ earlier weeks, \d+ chapters, 1 longer stretch\.$/);
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
