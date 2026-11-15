import { compact, DAY_KEYS, DAY_RUNG, emptyRewards, mergeRewards, parseRewards, RULES, shiftDays, tidy, type Rewards } from '@logbook/shared';
import { rungOf } from '../gems';
import { describe, expect, it } from 'vitest';
import { heldByRung, heldCells, heldSaid, isEmpty, keepsakesOf, keepsakeView, levelBand, levelProgress, linesOf, longDate, newRows, nextKeepsake, notStarted, num, orbs, paidOn, shortDate, weekSaid } from './model';

/** What the Orbs page says, from a stored object. Dates stand on the rules' own start, a Monday. */
const U = 'u_owner';
const MON = RULES.startsOn;
const day = (n: number) => shiftDays(MON, n);
const store = (over: Partial<Rewards> = {}): Rewards => ({ ...emptyRewards(U, MON), clock: day(3), ...over });

describe('the words for a number', () => {
  it('says Orbs with a number, and one Orb', () => {
    expect(orbs(9)).toBe('9 Orbs');
    expect(orbs(1)).toBe('1 Orb');
    expect(orbs(4262)).toBe('4,262 Orbs');
    expect(num(1000)).toBe('1,000');
  });
});

describe('the day’s lines', () => {
  const s = store({ days: { [day(3)]: { n: 21, a: 9, k: { todo: 3, habit: 4, 'train:run': 3, 'goal:day': 3, full: 5, back: 3 } } } });
  it('lists what the day paid in the order of the rules table', () => {
    expect(linesOf(s, day(3), true).map((l) => `${l.label} ${l.n}`)).toEqual(['To-dos 3', 'Habits 4', 'Run 3', 'Today’s goal 3', 'Full day 5', 'Good to see you 3']);
  });
  it('names no training with Fitness off: what a session earned before the switch is one line', () => {
    const two = store({ days: { [day(3)]: { n: 8, a: 3, k: { habit: 3, 'train:run': 3, 'train:lift': 2 } } } });
    const lines = linesOf(two, day(3), false);
    expect(lines.map((l) => `${l.label} ${l.n}`)).toEqual(['Habits 3', 'Earlier today 5']);
    expect(JSON.stringify(lines)).not.toMatch(/run|lift|session|train:/i);
  });
  it('is empty for a day with nothing, and for a day whose detail was dropped', () => {
    expect(linesOf(s, day(2), true)).toEqual([]);
    expect(linesOf(store({ days: { [day(1)]: { n: 6, a: 4, c: 1 } } }), day(1), true)).toEqual([]);
  });
  it('lists what was paid once that day, and nothing paid another day', () => {
    const paid = store({ once: { [`week:${MON}`]: { on: day(8), n: 5 }, [`goal:week:${MON}`]: { on: day(8), n: 9 }, [`challenge:d:${day(8)}`]: { on: day(8), n: 5 }, 'goal:month:2026-11': { on: day(9), n: 30 } } });
    expect(paidOn(paid, day(8)).map((l) => `${l.label} ${l.n}`)).toEqual(['Weeks in a row 5', 'Week goal 9', 'Today’s challenge 5']);
    expect(paidOn(paid, day(9)).map((l) => `${l.label} ${l.n}`)).toEqual(['Month goal 30']);
    expect(paidOn(paid, day(7))).toEqual([]);
    // each line names its Orb by the key it was paid under
    expect(paidOn(paid, day(8)).map((l) => l.gem)).toEqual(paidOn(paid, day(8)).map((l) => l.key));
  });
});

describe('your Orbs: how many of each rung', () => {
  const s = store({
    days: {
      [day(0)]: { n: 21, a: 9, k: { todo: 3, habit: 4, 'train:run': 3, 'goal:day': 3, full: 5, back: 3 }, c: 1 },
      [day(1)]: { n: 7, a: 5, k: { todo: 2, habit: 3, 'train:lift': 2 }, c: 1 },
      [day(2)]: { n: 0, a: 0, h: 1, c: 1 },
      [day(3)]: { n: 4, a: 4, k: { habit: 4 } },
    },
    once: { [`week:${MON}`]: { on: day(8), n: 5 }, [`goal:week:${MON}`]: { on: day(8), n: 9 }, [`challenge:d:${day(3)}`]: { on: day(3), n: 5 }, 'goal:month:2026-11': { on: day(9), n: 30 } },
  });
  it('counts awards, not worth: a run is one Dawn Orb whatever it paid', () => {
    // Sky: 3 + 4 + 2 + 3 + 4 to-dos and habits. Dawn: a run, the day's goal, a full day, a return, a lift at its floor.
    expect(heldByRung(s)).toEqual({ 1: 16, 2: 5, 3: 3, 4: 1, 5: 0 });
    const worth = Object.values(s.days).reduce((t, d) => t + d.n, 0) + Object.values(s.once).reduce((t, o) => t + o.n, 0);
    expect(Object.values(heldByRung(s)).reduce((t, n) => t + n, 0)).toBeLessThan(worth);
  });
  it('the rung of a day’s award is the rules’ own, and the picture agrees with it', () => {
    for (const key of DAY_KEYS) expect(rungOf(key), key).toBe(DAY_RUNG[key]);
  });
  it('stays the same when the store drops a day’s kinds: a year in, before and after compaction', () => {
    const k = (i: number) => ({ todo: i % 4, habit: 1 + (i % 3), ...(i % 7 === 1 ? { 'train:run': 3 } : i % 7 === 3 ? { 'train:lift': 2 } : null), ...(i % 3 === 0 ? { 'goal:day': 3 } : null), ...(i % 9 === 0 ? { full: 5 } : null) });
    const days: Rewards['days'] = {};
    for (let i = 0; i < 380; i++) {
      const kinds = Object.fromEntries(Object.entries(k(i)).filter(([, v]) => v > 0));
      days[day(i)] = { n: Object.values(kinds).reduce((t, v) => t + v, 0), a: 3, k: kinds, c: 1 };
    }
    const year = store({ clock: day(380), days, once: { 'goal:month:2026-12': { on: day(40), n: 30 }, [`week:${MON}`]: { on: day(8), n: 5 } } });
    const before = heldByRung(year);
    expect(before[1]).toBeGreaterThan(900);
    expect(before[2]).toBeGreaterThan(200);
    const after = compact(year, day(380));
    expect(Object.values(after.days).filter((r) => !r.k && r.w).length).toBeGreaterThan(300);
    expect(heldByRung(after)).toEqual(before);
    // through storage and back, through a merge with the phone that has not compacted, and years on
    expect(heldByRung(parseRewards(JSON.stringify(after), U)!)).toEqual(before);
    expect(heldByRung(tidy(mergeRewards(after, year)))).toEqual(before);
    expect(heldByRung(tidy(mergeRewards(year, after)))).toEqual(before);
    expect(heldByRung(compact(year, day(2000)))).toEqual(before);
  });
  it('a day compacted before the counts were kept counts nothing: nothing is estimated', () => {
    expect(heldByRung(store({ days: { [day(0)]: { n: 12, a: 6, c: 1 } } }))).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    expect(heldByRung(store({ days: { [day(0)]: { n: 12, a: 6, w: [7, 2], c: 1 } } }))).toEqual({ 1: 7, 2: 2, 3: 0, 4: 0, 5: 0 });
    // what a day holds beyond its kinds is not guessed at either
    expect(heldByRung(store({ days: { [day(0)]: { n: 9, a: 2, k: { todo: 2, 'goal:day': 3 }, c: 1 } } }))).toEqual({ 1: 2, 2: 1, 3: 0, 4: 0, 5: 0 });
    expect(heldByRung(store({ days: { [day(0)]: { n: 0, a: 0, c: 1 } }, once: { 'goal:year:2026': { on: day(1), n: 0 } } }))).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    expect(heldByRung(store())).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  });
  it('a key this build does not know is a Sky Orb, and a year goal a Sun', () => {
    expect(heldByRung(store({ once: { 'future:thing': { on: day(1), n: 7 }, 'goal:year:2026': { on: day(1), n: 90 } } }))).toEqual({ 1: 1, 2: 0, 3: 0, 4: 0, 5: 1 });
  });
  it('is five places in the ladder’s order: a number where a rung is held, none (never a zero) where it never was', () => {
    expect(heldCells(s)).toEqual([
      { rung: 1, name: 'Sky', count: '16' },
      { rung: 2, name: 'Dawn', count: '5' },
      { rung: 3, name: 'Glow', count: '3' },
      { rung: 4, name: 'Sunrise', count: '1' },
      { rung: 5, name: 'Sun' },
    ]);
    expect(heldCells(store()).every((c) => c.count === undefined)).toBe(true);
    const many = store({ days: Object.fromEntries(Array.from({ length: 300 }, (_, i) => [day(i), { n: 8, a: 8, k: { habit: 8 }, c: 1 as const }])) });
    expect(heldCells(many)[0]!.count).toBe('2,400');
  });
  it('is said in one breath', () => {
    expect(heldSaid(heldCells(s))).toBe('Your Orbs. Sky 16, Dawn 5, Glow 3, Sunrise 1. Sun not yet. How Orbs work.');
    expect(heldSaid(heldCells(store({ days: { [day(0)]: { n: 1, a: 1, k: { todo: 1 } } } })))).toBe('Your Orbs. Sky 1. Dawn, Glow, Sunrise and Sun not yet. How Orbs work.');
  });
});

describe('the poster', () => {
  it('the band is the level over what is left to the next one', () => {
    expect(levelBand({ level: 5, left: 216 })).toEqual({ label: 'Level 5', words: '216 to level 6' });
    expect(levelBand({ level: 7, left: 1738 })).toEqual({ label: 'Level 7', words: '1,738 to level 8' });
  });
  it('the sun stands at the share of the level already earned', () => {
    expect(levelProgress({ into: 0, span: 25 })).toBe(0);
    expect(levelProgress({ into: 100, span: 300 })).toBeCloseTo(1 / 3);
    expect(levelProgress({ into: 5, span: 0 })).toBe(0);
  });
  it('the week is said by its counted days, and nothing is said of the others', () => {
    expect(weekSaid({ marks: [true, true, false, true, false, false, false] })).toBe('This week: Monday, Tuesday and Thursday count.');
    expect(weekSaid({ marks: [false, false, false, false, true, false, false] })).toBe('This week: Friday counts.');
    expect(weekSaid({ marks: [true, true, false, false, false, false, false] })).toBe('This week: Monday and Tuesday count.');
    expect(weekSaid({ marks: [false, false, false, false, false, false, false] })).toBe('This week');
  });
});

describe('keepsakes', () => {
  const s = store({
    days: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [day(i), { n: 5, a: 2, c: 1 as const }])),
    once: { 'goal:month:2026-11': { on: day(10), n: 30 }, 'goal:year:2026': { on: day(11), n: 90 } },
    keepsakes: {
      first: { on: day(0) },
      full: { on: day(2) },
      challenge: { on: day(4) },
      'weeks:2': { on: day(14) },
      'days:10': { on: day(9) },
      'days:1000': { on: day(9) },
      'goal:month:2026-11': { on: day(10), t: 'Run 60 miles this month' },
      'goal:year:2026': { on: day(11) },
      [`chapter:${MON}`]: { on: day(28), d: 19, s: 9, g: 12, t: 'Easy miles are the ones that build.' },
      'something:else': { on: day(1) },
    },
  });
  it('each has its words, what its disc holds, and its facts', () => {
    expect(keepsakeView(s, 'first', true)).toMatchObject({ glyph: 'first', title: 'First light' });
    expect(keepsakeView(s, 'full', true)).toMatchObject({ glyph: 'full', title: 'First full day' });
    expect(keepsakeView(s, 'challenge', true)).toMatchObject({ glyph: 'challenge', title: 'First challenge' });
    expect(keepsakeView(s, 'weeks:2', true)).toMatchObject({ numeral: '2', title: '2 weeks in a row' });
    expect(keepsakeView(s, 'days:10', true)).toMatchObject({ numeral: '10', title: '10 days in all' });
    expect(keepsakeView(s, 'days:1000', true)).toMatchObject({ numeral: '1,000', title: '1,000 days in all' });
    expect(keepsakeView(s, 'goal:month:2026-11', true)).toMatchObject({ glyph: 'goal', title: 'Month goal', line: 'Your goal for November 2026, done.', words: 'Run 60 miles this month', facts: [{ label: 'Orbs', value: '30' }] });
    expect(keepsakeView(s, 'goal:year:2026', true)).toMatchObject({ glyph: 'goal', title: 'Year goal', line: 'Your goal for 2026, done.', facts: [{ label: 'Orbs', value: '90' }] });
    expect(keepsakeView(s, 'goal:year:2026', true)!.words).toBeUndefined();
  });
  it('a chapter carries its number, its four weeks, its facts and its one line', () => {
    const c = keepsakeView(s, `chapter:${MON}`, true)!;
    expect(c).toMatchObject({ glyph: 'chapter', numeral: '1', title: 'Chapter 1', words: 'Easy miles are the ones that build.', line: 'Four weeks, Nov 16 to Dec 13.' });
    expect(c.facts).toEqual([
      { label: 'Days', value: '19' },
      { label: 'Sessions', value: '9' },
      { label: 'Goals met', value: '12' },
    ]);
  });
  it('with Fitness off nothing names training: no sessions, no training in the full day’s line', () => {
    expect(keepsakeView(s, `chapter:${MON}`, false)!.facts.map((f) => f.label)).toEqual(['Days', 'Goals met']);
    expect(keepsakeView(s, 'full', false)!.line).not.toMatch(/training|session/i);
    // the person's own words (a goal's, a journal line) are theirs: everything the page itself says is checked
    expect(JSON.stringify(keepsakesOf(s, false).map(({ words: _w, ...said }) => said))).not.toMatch(/training|session|\brun\b|\blift\b/i);
  });
  it('a key this build does not know, and one that is not held, is nothing', () => {
    expect(keepsakeView(s, 'something:else', true)).toBeNull();
    expect(keepsakeView(s, 'weeks:4', true)).toBeNull();
  });
  it('are listed newest first, the same way on every device', () => {
    expect(keepsakesOf(s, true).map((k) => k.key)).toEqual([`chapter:${MON}`, 'weeks:2', 'goal:year:2026', 'goal:month:2026-11', 'days:10', 'days:1000', 'challenge', 'full', 'first']);
  });
  it('never use a word the words table forbids', () => {
    expect(JSON.stringify(keepsakesOf(s, true))).not.toMatch(/streak|sprint|points|coins|\bXP\b|\bbest\b|\u2014/i);
  });
});

describe('what comes next', () => {
  const counted = (n: number, from = 0): Rewards['days'] => Object.fromEntries(Array.from({ length: n }, (_, i) => [day(from + i), { n: 3, a: 2, c: 1 as const }]));
  it('is nothing before the first Orb', () => {
    expect(nextKeepsake(store(), day(0))).toBeNull();
  });
  it('is the nearest of days in all, weeks in a row and the chapter that closes next', () => {
    // four counted days in the first week: 10 days in all is six days off, the chapter 24
    const early = store({ days: counted(4), keepsakes: { first: { on: day(0) } } });
    expect(nextKeepsake(early, day(4))).toEqual({ numeral: '10', words: 'Next: 10 days in all' });
    // two full weeks and ten days held: weeks in a row 4 is nearest of what is left... but the chapter closes first
    const later = store({ days: counted(26), keepsakes: { first: { on: day(0) }, 'days:10': { on: day(9) }, 'weeks:2': { on: day(14) } }, clock: day(26) });
    expect(nextKeepsake(later, day(26))).toEqual({ numeral: '1', glyph: 'chapter', words: 'Next: chapter 1, on Dec 14' });
  });
  it('says what is next and never how near it is', () => {
    const s = store({ days: counted(9), keepsakes: { first: { on: day(0) } }, clock: day(9) });
    const next = nextKeepsake(s, day(9))!;
    expect(next.words).toBe('Next: 10 days in all');
    expect(next.words).not.toMatch(/left|away|more|only|almost|\bof\b/i);
  });
});

describe('what is new and is not a keepsake', () => {
  it('is a week goal that was paid: a row, with what it paid', () => {
    const s = store({ once: { [`goal:week:${MON}`]: { on: day(6), n: 9 }, 'goal:month:2026-11': { on: day(10), n: 30 } }, keepsakes: { 'goal:month:2026-11': { on: day(10) } } });
    expect(newRows(s, [`goal:week:${MON}`, 'goal:month:2026-11', 'first'])).toEqual([{ key: `goal:week:${MON}`, title: 'Week goal, done', n: 9, on: day(6) }]);
    expect(newRows(s, [])).toEqual([]);
  });
});

describe('the page’s two quiet states', () => {
  it('is empty before the first Orb', () => {
    expect(isEmpty(0)).toBe(true);
    expect(isEmpty(1)).toBe(false);
  });
  it('has not started before the store’s first day', () => {
    expect(notStarted(store(), shiftDays(MON, -3))).toBe(true);
    expect(notStarted(store(), MON)).toBe(false);
    expect(notStarted(null, MON)).toBe(false);
  });
});

describe('dates', () => {
  it('are short under a disc, with the year once it is another one', () => {
    expect(shortDate('2026-11-16', '2026-12-01')).toBe('Nov 16');
    expect(shortDate('2026-11-16', '2027-02-01')).toBe('Nov 2026');
    expect(longDate('2026-11-16', '2026-12-01')).toBe('Monday, November 16');
    expect(longDate('2026-11-16', '2027-02-01')).toBe('Monday, November 16, 2026');
  });
});
