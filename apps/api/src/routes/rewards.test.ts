import { emptyRewards, mergeRewards, parseISO, reconcile, RULES, shiftDays, tidy, totalOf, type DayFacts, type DayRec, type Rewards } from '@logbook/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeApp, signUp, type Account, type App } from '../test/helpers.js';
import { admitRewards, REWARDS_MAX_BYTES } from './me.js';

/**
 * `PUT /me/rewards` and `rewards` in the bootstrap: the account's copy of the Orbs store. The server merges with the same
 * shared `mergeRewards` the phones use, so these tests state the route's own duties: whose store it is, what it refuses,
 * and that what comes back is the merge.
 */
const D0 = RULES.startsOn;
const day = (n: number) => shiftDays(D0, n);
/** The server's clock for these tests: four weeks after the rules begin, at noon. */
const NOW = (() => {
  const d = parseISO(day(28));
  d.setHours(12, 0, 0, 0);
  return d;
})();
const TODAY = day(28);
const closed = (n: number, k: DayRec['k'] = { habit: n }): DayRec => ({ n, a: n, k, c: 1 });
const store = (userId: string, days: Record<string, DayRec>, extra: Partial<Rewards> = {}): Rewards => ({ ...emptyRewards(userId, D0), clock: TODAY, days, ...extra });

let app: App;
let me: Account;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  ({ app } = makeApp());
  me = await signUp(app, 'orbs@example.com');
});
afterEach(() => vi.useRealTimers());

const put = (who: Account, body: unknown) => who.call('PUT', '/api/me/rewards', body);
const boot = async (who: Account) => (await who.call('GET', '/api/bootstrap')).body as { rewards?: unknown };

describe('rewards in the bootstrap', () => {
  it('is there, and null, before anything is saved: its presence is the capability', async () => {
    const b = await boot(me);
    expect('rewards' in b).toBe(true);
    expect(b.rewards).toBeNull();
  });
  it('carries what was saved', async () => {
    const s = store(me.id, { [day(1)]: closed(3) });
    expect((await put(me, s)).status).toBe(200);
    expect((await boot(me)).rewards).toEqual(s);
  });
});

describe('PUT /me/rewards', () => {
  it('needs a session', async () => {
    const r = await app.request('/api/me/rewards', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(store(me.id, {})) });
    expect(r.status).toBe(401);
  });
  it('answers with the merged store, and the merge is the shared one', async () => {
    const a = store(me.id, { [day(1)]: closed(3, { todo: 3 }), [day(2)]: closed(2) }, { once: { [`week:${D0}`]: { on: day(8), n: 5 } } });
    const b = store(me.id, { [day(1)]: closed(2, { habit: 2 }), [day(3)]: closed(4) }, { once: { [`week:${D0}`]: { on: day(9), n: 5 }, 'goal:year:2026': { on: day(5), n: 90 } } });
    expect((await put(me, a)).body.rewards).toEqual(a);
    const r = await put(me, b);
    expect(r.status).toBe(200);
    expect(r.body.rewards).toEqual(tidy(mergeRewards(a, b)));
    // closed against closed is a maximum per kind, and the number is their sum
    expect(r.body.rewards.days[day(1)]).toEqual({ n: 5, a: 3, k: { todo: 3, habit: 2 }, c: 1 });
    expect(totalOf(r.body.rewards)).toBe(5 + 2 + 4 + 5 + 90);
    // the same store sent again changes nothing: sending is safe to repeat
    expect((await put(me, b)).body.rewards).toEqual(r.body.rewards);
    expect((await put(me, a)).body.rewards).toEqual(r.body.rewards);
    expect((await boot(me)).rewards).toEqual(r.body.rewards);
  });
  it('never lowers a day a phone sends again with less', async () => {
    await put(me, store(me.id, { [day(1)]: closed(6) }));
    const r = await put(me, store(me.id, { [day(1)]: closed(2) }));
    expect(r.body.rewards.days[day(1)].n).toBe(6);
  });
  it('takes closed days only: an open day is each phone’s own to recompute', async () => {
    const r = await put(me, store(me.id, { [day(27)]: { n: 4, a: 4, k: { habit: 4 } }, [day(20)]: closed(1) }));
    expect(Object.keys(r.body.rewards.days)).toEqual([day(20)]);
  });
  it('refuses days later than its own date plus one, and a clock beyond it', async () => {
    const ahead = store(me.id, { [day(29)]: closed(1), [day(30)]: closed(9), [day(60)]: closed(9) }, { clock: day(60), once: { [`week:${day(49)}`]: { on: day(57), n: 20 } }, keepsakes: { 'days:10': { on: day(55) }, first: { on: day(1) } }, seen: { first: day(58) }, wt: { [day(49)]: 5, [D0]: 5 } });
    const r = await put(me, ahead);
    expect(r.status).toBe(200);
    expect(Object.keys(r.body.rewards.days)).toEqual([day(29)]);
    expect(r.body.rewards.clock).toBe(day(29));
    expect(r.body.rewards.once).toEqual({});
    expect(r.body.rewards.keepsakes).toEqual({ first: { on: day(1) } });
    expect(r.body.rewards.seen).toEqual({});
    expect(r.body.rewards.wt).toEqual({ [D0]: 5 });
  });
  it('takes nothing from before the rules began', async () => {
    const early = { ...store(me.id, { [shiftDays(D0, -3)]: closed(5), [D0]: closed(1) }), startedOn: shiftDays(D0, -30) };
    const r = await put(me, early);
    expect(Object.keys(r.body.rewards.days)).toEqual([D0]);
    expect(r.body.rewards.startedOn).toBe(D0);
  });
  it('refuses another account’s store, and keeps accounts apart', async () => {
    const other = await signUp(app, 'someone@example.com');
    expect((await put(me, store(other.id, { [day(1)]: closed(9) }))).status).toBe(403);
    await put(me, store(me.id, { [day(1)]: closed(3) }));
    await put(other, store(other.id, { [day(2)]: closed(7) }));
    expect(Object.keys(((await boot(me)).rewards as Rewards).days)).toEqual([day(1)]);
    expect(Object.keys(((await boot(other)).rewards as Rewards).days)).toEqual([day(2)]);
  });
  it('refuses what is not a store, and leaves the saved one standing', async () => {
    const good = store(me.id, { [day(1)]: closed(3) });
    await put(me, good);
    for (const bad of [{}, [], 'x', { ...good, v: 2 }, { ...good, days: { nope: closed(1) } }, { ...good, days: { [day(2)]: { n: -4, a: 1 } } }, { ...good, days: { [day(2)]: { n: 5000, a: 1, c: 1 } } }, { ...good, set: { ...good.set, weekTarget: 9 } }, { ...good, once: { x: { on: 'soon', n: 1 } } }]) {
      expect((await put(me, bad)).status, JSON.stringify(bad).slice(0, 60)).toBe(422);
    }
    expect((await boot(me)).rewards).toEqual(good);
  });
  it('caps the size: too many days are refused by the schema, too many bytes by the route', async () => {
    const many = store(me.id, Object.fromEntries(Array.from({ length: 4100 }, (_, i) => [shiftDays(D0, -i), closed(1)])));
    expect((await put(me, many)).status).toBe(422);
    // inside every per-map cap and still too heavy as a whole
    const heavy = store(me.id, {}, { keepsakes: Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`chapter:${shiftDays('2020-01-06', i * 28).padEnd(31, 'x')}`, { on: day(1), t: 'y'.repeat(200) }])), seen: Object.fromEntries(Array.from({ length: 4000 }, (_, i) => [`k${i}`.padEnd(40, 'z'), day(1)])) });
    expect(JSON.stringify(heavy).length).toBeGreaterThan(REWARDS_MAX_BYTES);
    expect((await put(me, heavy)).status).toBe(413);
    expect((await boot(me)).rewards).toBeNull();
  });
  it('two phones that send in either order end with the same account copy', async () => {
    const facts = (date: string, p: Partial<DayFacts>): DayFacts => ({ date, todosDone: 0, todosEarlier: 0, habitsLive: 0, habitsDone: 0, lines: 0, train: {}, trainRequired: false, goalDay: 'none', held: false, ...p });
    const at = (date: string) => {
      const d = parseISO(date);
      d.setHours(12);
      return d;
    };
    let a = emptyRewards(me.id, D0);
    let b = emptyRewards(me.id, D0);
    for (let i = 0; i < 20; i++) {
      a = reconcile(a, i % 2 ? [facts(day(i), { habitsDone: 2 })] : [], at(day(i))).store;
      b = reconcile(b, i % 3 ? [facts(day(i), { todosDone: 1, habitsDone: i % 2 ? 2 : 0 })] : [], at(day(i))).store;
    }
    const one = (await put(me, b)).body.rewards;
    const first = (await put(me, a)).body.rewards as Rewards;
    const other = await signUp(app, 'second@example.com');
    const rename = (s: Rewards): Rewards => ({ ...s, userId: other.id });
    await put(other, rename(a));
    const second = (await put(other, rename(b))).body.rewards as Rewards;
    expect(one).toBeTruthy();
    expect({ ...second, userId: me.id }).toEqual(first);
  });
});

describe('admitRewards', () => {
  it('leaves an honest store as it is, closed days and all', () => {
    const s = store('u', { [day(1)]: closed(3), [day(27)]: closed(1) }, { off: [{ from: day(3), to: day(4) }] });
    expect(admitRewards(s, TODAY)).toEqual(s);
  });
  it('ends an off range at the limit when it runs past it', () => {
    const s = store('u', {}, { off: [{ from: day(3), to: day(90) }, { from: day(80), to: null }] });
    expect(admitRewards(s, TODAY).off).toEqual([{ from: day(3), to: day(29) }]);
  });
});
