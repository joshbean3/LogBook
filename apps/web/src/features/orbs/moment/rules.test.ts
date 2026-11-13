import { describe, expect, it } from 'vitest';
import { CLAIM_MS, counterLabel, createClaims, createPool, dayTakes, FAN, FIRST_ORB, flightMs, FULL_DAY_CHIP, gainToast, keepsakeToast, lightsOf, mayShowBig, momentWords, POOL_SIZE, POP, popPlan, popsAtControl, REST_QUIET_MS, statusLine, STILL, stillLights, SUBJECT_QUIET_MS, type PopAsk, type RestAsk } from './rules';

/**
 * The moment's rules (rules.ts): when an Orb may pop, the rise and the fan, the flight's time, the pool, what the counter
 * shows while Orbs are in the air, the words, and when a big moment may open. No DOM: the layer only draws what these say.
 */
const ask = (over: Partial<PopAsk> = {}): PopAsk => ({ n: 1, on: true, show: true, room: 5, claimed: 0, sinceSubject: null, ...over });

describe('when an Orb may pop', () => {
  it('pops one for a to-do or a habit with room left', () => {
    expect(popPlan(ask())).toEqual({ n: 1, mode: 'rise' });
  });
  it('pops nothing with Orbs switched off, or with "Show Orbs when you earn them" off', () => {
    expect(popPlan(ask({ on: false })).n).toBe(0);
    expect(popPlan(ask({ show: false })).n).toBe(0);
  });
  it('pops nothing with no room: the sixth to-do, the ninth habit, a closed day', () => {
    expect(popPlan(ask({ room: 0 })).n).toBe(0);
  });
  it('a burst of taps counts its own: the room the store reports, less what has popped and is not counted yet', () => {
    // five to-dos left by the store's count, four tapped already in this burst
    expect(popPlan(ask({ room: 5, claimed: 4 })).n).toBe(1);
    expect(popPlan(ask({ room: 5, claimed: 5 })).n).toBe(0);
    expect(popPlan(ask({ room: 5, claimed: 9 })).n).toBe(0);
  });
  it('one subject pops at most once in 10 s', () => {
    expect(popPlan(ask({ sinceSubject: 0 })).n).toBe(0);
    expect(popPlan(ask({ sinceSubject: SUBJECT_QUIET_MS - 1 })).n).toBe(0);
    expect(popPlan(ask({ sinceSubject: SUBJECT_QUIET_MS })).n).toBe(1);
    expect(SUBJECT_QUIET_MS).toBe(10_000);
  });
  it('never over a sheet that is on its way up, never on a hidden page', () => {
    expect(popPlan(ask({ sheetOpening: true })).n).toBe(0);
    expect(popPlan(ask({ hidden: true })).n).toBe(0);
  });
  it('never more than three, and only as many as there is room for', () => {
    expect(popPlan(ask({ n: 3, room: 3 })).n).toBe(3);
    expect(popPlan(ask({ n: 9, room: 30 })).n).toBe(3);
    // a session at its floor is worth two
    expect(popPlan(ask({ n: 3, room: 2 })).n).toBe(2);
    expect(popPlan(ask({ n: 3, room: 3, claimed: 3 })).n).toBe(0);
  });
  it('with the counter on screen it flies there; with none it rises and fades', () => {
    expect(popPlan(ask({ counter: true })).mode).toBe('fly');
    expect(popPlan(ask({ counter: false })).mode).toBe('rise');
  });
  it('Reduce Motion still pops, standing still, and never flies', () => {
    expect(popPlan(ask({ reduce: true }))).toEqual({ n: 1, mode: 'still' });
    expect(popPlan(ask({ reduce: true, counter: true, n: 3, room: 3 }))).toEqual({ n: 3, mode: 'still' });
  });
});

describe('which day can still take an Orb, by the clock', () => {
  const at = (iso: string) => new Date(iso);
  it('today, always', () => {
    for (const key of ['todo', 'habit', 'train:run', 'goal:day']) expect(dayTakes(key, '2026-11-18', at('2026-11-18T00:00:01'))).toBe(true);
  });
  it('yesterday by a tap until 03:00 (Today holds on it past midnight), not after', () => {
    for (const key of ['todo', 'habit', 'train:lift']) {
      expect(dayTakes(key, '2026-11-17', at('2026-11-18T02:59:59'))).toBe(true);
      expect(dayTakes(key, '2026-11-17', at('2026-11-18T03:00:00'))).toBe(false);
    }
  });
  it('yesterday’s goal, reviewed late, until today ends', () => {
    expect(dayTakes('goal:day', '2026-11-17', at('2026-11-18T23:59:00'))).toBe(true);
    expect(dayTakes('goal:day', '2026-11-16', at('2026-11-18T09:00:00'))).toBe(false);
  });
  it('never a day that has not come, or a date that is not one', () => {
    expect(dayTakes('goal:day', '2026-11-19', at('2026-11-18T09:00:00'))).toBe(false);
    expect(dayTakes('habit', '2026-11-19', at('2026-11-18T23:59:59'))).toBe(false);
    for (const bad of ['', 'not-a-date', '2026-11', 'undefined']) expect(dayTakes('todo', bad, at('2026-11-18T09:00:00'))).toBe(false);
  });
  it('the last day of a month and of a year', () => {
    expect(dayTakes('habit', '2026-11-30', at('2026-12-01T01:00:00'))).toBe(true);
    expect(dayTakes('habit', '2026-12-31', at('2027-01-01T02:30:00'))).toBe(true);
    expect(dayTakes('habit', '2026-12-31', at('2027-01-01T03:30:00'))).toBe(false);
  });
});

describe('the rise and the fan', () => {
  it('the numbers are the design critic’s', () => {
    expect(POP).toMatchObject({ size: 20, restSize: 12, from: 0.3, peak: 1.2, inMs: 120, settleMs: 260, rise: 48, drift: 10, riseMs: 420, fadeFromMs: 300, fadeEndMs: 480, fadeScale: 0.7, flyAtMs: 300, goneMs: 620 });
    expect(STILL).toMatchObject({ inMs: 150, holdMs: 400 });
    expect(FAN).toEqual({ stepMs: 60, angles: [-16, 0, 16], rises: [40, 60, 44] });
  });
  it('one Orb: 20 pt, up 48 and 10 to the trailing side', () => {
    expect(lightsOf(1)).toEqual([{ size: 20, delay: 0, dx: 10, dy: -48 }]);
    // right to left: the trailing side is the left
    expect(lightsOf(1, -1)[0]!.dx).toBe(-10);
  });
  it('three: 18 pt, 60 ms apart, at -16, 0 and +16 degrees, rising 40, 60 and 44', () => {
    const fan = lightsOf(3);
    expect(fan.map((l) => l.size)).toEqual([18, 18, 18]);
    expect(fan.map((l) => l.delay)).toEqual([0, 60, 120]);
    // each travels its rise along its angle
    expect(fan.map((l) => Math.round(Math.hypot(l.dx, l.dy)))).toEqual([40, 60, 44]);
    expect(fan.map((l) => Math.round((Math.atan2(l.dx, -l.dy) * 180) / Math.PI))).toEqual([-16, 0, 16]);
  });
  it('two (a session at its floor): the fan’s outer pair', () => {
    const two = lightsOf(2);
    expect(two).toHaveLength(2);
    expect(two[0]!.dx).toBeLessThan(0);
    expect(two[1]!.dx).toBeGreaterThan(0);
    expect(two.map((l) => l.delay)).toEqual([0, 60]);
  });
  it('Reduce Motion: the lights stand above the control, side by side, with no travel between them', () => {
    const one = stillLights(1, 22);
    expect(one).toEqual([{ size: 20, delay: 0, dx: 0, dy: -(22 + STILL.above + 10) }]);
    const three = stillLights(3, 24);
    expect(three.map((l) => l.dx)).toEqual([-24, 0, 24]);
    expect(new Set(three.map((l) => l.dy)).size).toBe(1);
    expect(three.every((l) => l.delay === 0)).toBe(true);
  });
});

describe('the flight to the counter', () => {
  it('clamp(280, 220 + 0.5 x distance, 460) ms', () => {
    expect(flightMs(0)).toBe(280);
    expect(flightMs(120)).toBe(280);
    expect(flightMs(200)).toBe(320);
    expect(flightMs(340)).toBe(390);
    expect(flightMs(480)).toBe(460);
    expect(flightMs(2000)).toBe(460);
    expect(flightMs(-5)).toBe(280);
  });
});

describe('the pool', () => {
  it('has six nodes and gives each new Orb a free one', () => {
    const pool = createPool();
    const taken = Array.from({ length: POOL_SIZE }, () => pool.take());
    expect(POOL_SIZE).toBe(6);
    expect(taken.map((t) => t.index)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(taken.every((t) => !t.recycled)).toBe(true);
    expect(pool.live()).toBe(6);
  });
  it('a seventh live Orb takes the oldest', () => {
    const pool = createPool();
    for (let i = 0; i < 6; i++) pool.take();
    expect(pool.take()).toEqual({ index: 0, recycled: true });
    // the next oldest is now node 1
    expect(pool.take()).toEqual({ index: 1, recycled: true });
    expect(pool.live()).toBe(6);
  });
  it('a node that is over is free again, and the oldest is by birth, not by place', () => {
    const pool = createPool(3);
    pool.take();
    pool.take();
    pool.take();
    pool.free(1);
    expect(pool.take()).toEqual({ index: 1, recycled: false });
    // 0 was born first, then 2, then 1 again
    expect(pool.take()).toEqual({ index: 0, recycled: true });
    expect(pool.take()).toEqual({ index: 2, recycled: true });
  });
});

describe('what the counter shows while Orbs are in the air', () => {
  const D = '2026-11-17';
  it('a to-do: the store counts it first (a frame after the tap), the Orb lands later: the numeral changes once, on landing', () => {
    const c = createClaims();
    const claim = c.add('todo', D, 'todo:1', 1, 0);
    // in the air, the store still at 4: the counter shows 4
    expect(c.offset(D)).toBe(0);
    // the store goes to 5 while it flies: 5 - 1 = 4 still
    c.confirm('todo', D, 1);
    expect(c.offset(D)).toBe(-1);
    // it lands: 5
    c.land(claim);
    expect(c.offset(D)).toBe(0);
    expect(c.size()).toBe(0);
  });
  it('a habit: the Orb lands first, the store follows most of a second later: the numeral changes once, on landing', () => {
    const c = createClaims();
    const claim = c.add('habit', D, 'habit:a', 1, 0);
    expect(c.offset(D)).toBe(0);
    c.land(claim);
    // the store still at 4: the counter shows 5
    expect(c.offset(D)).toBe(1);
    // the store catches up to 5: nothing changes
    c.confirm('habit', D, 1);
    expect(c.offset(D)).toBe(0);
    expect(c.size()).toBe(0);
  });
  it('five fast taps on five tiles: each takes one of the room, and the store’s one update of 5 settles them all', () => {
    const c = createClaims();
    const claims = ['a', 'b', 'c', 'd', 'e'].map((id, i) => c.add('habit', D, `habit:${id}`, 1, i * 100, true));
    expect(c.claimed('habit', D)).toBe(5);
    expect(c.offset(D)).toBe(5);
    c.confirm('habit', D, 5);
    expect(c.claimed('habit', D)).toBe(0);
    expect(c.offset(D)).toBe(0);
    expect(claims).toHaveLength(5);
  });
  it('a fan of three is one claim of three', () => {
    const c = createClaims();
    const claim = c.add('goal:day', D, 'goal:day', 3, 0);
    c.confirm('goal:day', D, 3);
    expect(c.offset(D)).toBe(-3);
    c.land(claim);
    expect(c.offset(D)).toBe(0);
  });
  it('a check taken back before the store saw it lets go of its Orb; one the store has counted is the store’s to take back', () => {
    const c = createClaims();
    c.add('habit', D, 'habit:a', 1, 0, true);
    expect(c.offset(D)).toBe(1);
    c.cancel('habit:a');
    expect(c.offset(D)).toBe(0);
    expect(c.claimed('habit', D)).toBe(0);
    const flying = c.add('habit', D, 'habit:b', 1, 0);
    c.confirm('habit', D, 1);
    c.cancel('habit:b');
    // still held until it lands; the store's own number then falls by itself
    expect(c.offset(D)).toBe(-1);
    c.land(flying);
    expect(c.offset(D)).toBe(0);
  });
  it('a claim the store never confirms (a refused write) is forgotten', () => {
    const c = createClaims();
    c.add('todo', D, 'todo:1', 1, 1000, true);
    c.expire(1000 + CLAIM_MS - 1);
    expect(c.offset(D)).toBe(1);
    c.expire(1000 + CLAIM_MS);
    expect(c.offset(D)).toBe(0);
    expect(c.claimed('todo', D)).toBe(0);
  });
  it('another day’s claims never touch today’s number, and another kind’s never its room', () => {
    const c = createClaims();
    c.add('habit', '2026-11-16', 'habit:a', 1, 0, true);
    expect(c.offset(D)).toBe(0);
    expect(c.claimed('todo', '2026-11-16')).toBe(0);
    expect(c.claimed('habit', '2026-11-16')).toBe(1);
  });
});

describe('the store’s number falls while Orbs are in the air', () => {
  const D = '2026-11-17';
  it('a counted Orb still flying is let go, so the counter never shows less than before it was born', () => {
    const c = createClaims();
    const claim = c.add('todo', D, 'todo:2', 1, 0);
    c.confirm('todo', D, 1);
    // store 2, shown 2 - 1 = 1. Another to-do is marked not done: store 1
    c.fell('todo', D, 1);
    expect(c.offset(D)).toBe(0);
    // it lands and changes nothing; the caller hears that it no longer counted
    expect(c.land(claim)).toBe(false);
    expect(c.offset(D)).toBe(0);
    expect(c.size()).toBe(0);
  });
  it('lets go only what fell, newest first, and only of that kind and day', () => {
    const c = createClaims();
    const a = c.add('todo', D, 'todo:a', 1, 0);
    const b = c.add('todo', D, 'todo:b', 1, 100);
    const h = c.add('habit', D, 'habit:x', 1, 100);
    const other = c.add('todo', '2026-11-16', 'todo:y', 1, 100);
    c.confirm('todo', D, 2);
    c.confirm('habit', D, 1);
    c.confirm('todo', '2026-11-16', 1);
    c.fell('todo', D, 1);
    expect(c.land(b)).toBe(false);
    expect(c.land(a)).toBe(true);
    expect(c.land(h)).toBe(true);
    expect(c.land(other)).toBe(true);
  });
  it('touches nothing that has landed or that the store has not counted yet', () => {
    const c = createClaims();
    const landed = c.add('habit', D, 'habit:a', 1, 0);
    c.land(landed);
    const waiting = c.add('habit', D, 'habit:b', 1, 0);
    c.fell('habit', D, 2);
    // one landed and not yet counted (+1), one in the air and not yet counted (0)
    expect(c.offset(D)).toBe(1);
    expect(c.waiting()).toBe(2);
    expect(c.land(waiting)).toBe(true);
  });
  it('`land` says whether the Orb still counted: not after its check was taken back', () => {
    const c = createClaims();
    const claim = c.add('habit', D, 'habit:a', 1, 0);
    c.cancel('habit:a');
    expect(c.land(claim)).toBe(false);
    expect(c.has('habit', D)).toBe(false);
  });
});

describe('words', () => {
  it('the status region and the counter’s name', () => {
    expect(statusLine(5, 12)).toBe('5 Orbs. 12 today.');
    expect(statusLine(1, 1)).toBe('1 Orb. 1 today.');
    expect(counterLabel(12, 5)).toBe('Orbs. 12 today. Level 5.');
    // never a zero
    expect(counterLabel(0, 1)).toBe('Orbs. Level 1.');
    expect(statusLine(15, 0)).toBe('15 Orbs.');
  });
  it('the chip and the first Orb', () => {
    expect(FULL_DAY_CHIP).toBe('Full day +5');
    expect(FIRST_ORB).toEqual({ text: 'Your first Orb. You earn one for each thing you finish.', action: 'Settings' });
  });
  it('what pops at its control never makes a toast, and neither does the full day (its chip)', () => {
    for (const key of ['todo', 'habit', 'goal:day', 'train:run', 'train:lift', 'train:cross']) {
      expect(popsAtControl(key)).toBe(true);
      expect(gainToast({ key, n: 3 })).toBeNull();
    }
    expect(popsAtControl('full')).toBe(false);
    expect(gainToast({ key: 'full', n: 5 })).toBeNull();
  });
  it('the weekly bonus says the weeks in a row and the number', () => {
    expect(gainToast({ key: 'week:2026-11-16', n: 15 }, { weeks: 3 })).toBe('Week 3 in a row. 15 Orbs');
    expect(gainToast({ key: 'week:2026-11-16', n: 20 }, { weeks: 9 })).toBe('Week 9 in a row. 20 Orbs');
    // one week is not "in a row"
    expect(gainToast({ key: 'week:2026-11-16', n: 5 }, { weeks: 1 })).toBe('Last week counted. 5 Orbs');
    expect(gainToast({ key: 'week:2026-11-16', n: 5 })).toBe('Last week counted. 5 Orbs');
  });
  it('a goal says its Orbs and its real multiplier', () => {
    expect(gainToast({ key: 'goal:week:2026-11-16', n: 9 })).toBe('9 Orbs · week goal × 3');
    expect(gainToast({ key: 'goal:month:2026-11', n: 30 })).toBe('30 Orbs · month goal × 10');
    expect(gainToast({ key: 'goal:year:2026', n: 90 })).toBe('90 Orbs · year goal × 30');
  });
  it('a challenge and the comeback', () => {
    expect(gainToast({ key: 'challenge:d:2026-11-17', n: 5 })).toBe('Today’s challenge, done. 5 Orbs');
    expect(gainToast({ key: 'challenge:w:2026-11-16', n: 20 })).toBe('This week’s challenge, done. 20 Orbs');
    expect(gainToast({ key: 'back', n: 3 })).toBe('Good to see you. Today counts. 3 Orbs');
  });
  it('nothing for nothing, and nothing for a key it does not know', () => {
    expect(gainToast({ key: 'week:2026-11-16', n: 0 })).toBeNull();
    expect(gainToast({ key: 'mystery', n: 4 })).toBeNull();
  });
  it('no toast says a word the table bans', () => {
    const all = [gainToast({ key: 'week:2026-11-16', n: 15 }, { weeks: 3 }), gainToast({ key: 'goal:week:2026-11-16', n: 9 }), gainToast({ key: 'challenge:d:2026-11-17', n: 5 }), gainToast({ key: 'back', n: 3 }), keepsakeToast('weeks:2'), keepsakeToast('days:10'), keepsakeToast('full'), keepsakeToast('challenge'), FIRST_ORB.text, FULL_DAY_CHIP].join(' ');
    expect(all).not.toMatch(/streak|sprint|points|coins|\bXP\b|\bAI\b|coach|bot\b|rest day|—/i);
  });
  it('a small keepsake gets one toast; a big moment and the first Orb do not get this one', () => {
    expect(keepsakeToast('weeks:2')).toBe('2 weeks in a row. A new keepsake');
    expect(keepsakeToast('days:1000')).toBe('1,000 days in all. A new keepsake');
    expect(keepsakeToast('full')).toBe('Your first full day. A new keepsake');
    expect(keepsakeToast('challenge')).toBe('Your first challenge. A new keepsake');
    expect(keepsakeToast('first')).toBeNull();
    expect(keepsakeToast('chapter:2026-11-16')).toBeNull();
    expect(keepsakeToast('goal:month:2026-11')).toBeNull();
  });
});

describe('a big moment’s words', () => {
  it('a goal: the check, its line, what it paid, and the goal’s own words', () => {
    expect(momentWords({ key: 'goal:week:2026-11-16', on: '2026-11-20', n: 9 }, { goalText: 'Run three times' })).toEqual({ disc: 'check', title: 'Goal done', line: 'A whole week, done.', paid: '9 Orbs · week goal × 3', quote: 'Run three times', label: 'Goal done' });
    // a month goal's keepsake carries its words, whatever the app still holds
    const month = momentWords({ key: 'goal:month:2026-11', on: '2026-11-30', n: 30, keepsake: { on: '2026-11-30', t: 'Read two books' } }, { goalText: 'Something newer' });
    expect(month.quote).toBe('Read two books');
    expect(month.line).toBe('A month of it, done.');
    expect(momentWords({ key: 'goal:year:2026', on: '2026-12-31', n: 90 }).paid).toBe('90 Orbs · year goal × 30');
  });
  it('weeks in a row and days in all: the numeral in the disc', () => {
    expect(momentWords({ key: 'weeks:4', on: '2026-12-14' }, { rule: 'One thing a day. Two days off a week.' })).toMatchObject({ disc: '4', title: '4 weeks in a row', line: 'One thing a day. Two days off a week.' });
    expect(momentWords({ key: 'days:1000', on: '2029-09-01' })).toMatchObject({ disc: '1,000', title: '1,000 days in all' });
  });
  it('a chapter: its number, its facts and its one line', () => {
    const w = momentWords({ key: 'chapter:2026-11-16', on: '2026-12-14', keepsake: { on: '2026-12-14', d: 18, s: 9, g: 1, t: 'Slept well, ran easy.' } }, { chapter: 2, fitness: true });
    expect(w).toMatchObject({ disc: '2', title: 'Chapter 2', facts: '18 days · 9 sessions · 1 goal', quote: 'Slept well, ran easy.' });
  });
  it('with Fitness off a chapter names no training', () => {
    const w = momentWords({ key: 'chapter:2026-11-16', on: '2026-12-14', keepsake: { on: '2026-12-14', d: 18, s: 9, g: 2 } }, { chapter: 1, fitness: false });
    expect(w.facts).toBe('18 days · 2 goals');
  });
  it('never a zero among the facts', () => {
    const w = momentWords({ key: 'chapter:2026-11-16', on: '2026-12-14', keepsake: { on: '2026-12-14', d: 3, s: 0, g: 0 } }, { chapter: 1 });
    expect(w.facts).toBe('3 days');
  });
});

describe('when a big moment may open', () => {
  const rest = (over: Partial<RestAsk> = {}): RestAsk => ({ pending: 1, showing: false, overlays: 0, typing: false, touching: false, quietMs: REST_QUIET_MS, popping: false, away: false, cause: 'open', ...over });
  it('at rest, on the next open or after the Close card’s save', () => {
    expect(mayShowBig(rest())).toBe(true);
    expect(mayShowBig(rest({ cause: 'closed-day' }))).toBe(true);
  });
  it('never from a routine tap: with no cause nothing opens, however still the hand', () => {
    expect(mayShowBig(rest({ cause: null, quietMs: 60_000 }))).toBe(false);
  });
  it('never with nothing waiting, and never a second over the first', () => {
    expect(mayShowBig(rest({ pending: 0 }))).toBe(false);
    expect(mayShowBig(rest({ showing: true }))).toBe(false);
  });
  it('never over a sheet or a menu, never while typing', () => {
    expect(mayShowBig(rest({ overlays: 1 }))).toBe(false);
    expect(mayShowBig(rest({ typing: true }))).toBe(false);
  });
  it('never mid-list: not while a finger is down, nor within 600 ms of a touch or a scroll', () => {
    expect(mayShowBig(rest({ touching: true }))).toBe(false);
    expect(mayShowBig(rest({ quietMs: REST_QUIET_MS - 1 }))).toBe(false);
  });
  it('never while Orbs are in the air, the page is hidden or the opening is playing', () => {
    expect(mayShowBig(rest({ popping: true }))).toBe(false);
    expect(mayShowBig(rest({ away: true }))).toBe(false);
  });
});
