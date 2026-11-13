import { emptyRewards, RULES, shiftDays, type Rewards } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { isEmpty, keepsakesOf, keepsakeView, levelBand, levelProgress, linesOf, longDate, newRows, nextKeepsake, notStarted, num, orbs, paidOn, shortDate, weekSaid } from './model';

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
    expect(JSON.stringify(keepsakesOf(s, true))).not.toMatch(/streak|sprint|points|coins|\bXP\b|\bbest\b|—/i);
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
