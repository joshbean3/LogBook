import { describe, expect, it } from 'vitest';
import { builderNote, builderVerb, clampTyped, fromEndingBlock, raceRowWords, startWords } from './builderModel';

const block = { id: 'b1', name: '2026.10 Banking Plan', start: '2026-10-05', end: '2026-12-20', source: null, summary: null, createdAt: '2026-10-01T00:00:00Z' };

describe('fromEndingBlock', () => {
  it('prefills from the training answers and starts the day after the block ends', () => {
    expect(fromEndingBlock(block, { goal: 'half', raceDate: '2027-03-21', runDays: ['tue', 'thu', 'sat', 'sun'], longRunDay: 'sun', weeklyMiles: 24 })).toEqual({ goal: 'half', runDays: [1, 3, 5, 6], longRunDay: 6, weeklyMiles: 24, startDate: '2026-12-21' });
  });
  it('crosses a month and a year end', () => {
    expect(fromEndingBlock({ ...block, end: '2026-12-31' }, { goal: 'base', raceDate: null, runDays: ['mon'], longRunDay: 'mon', weeklyMiles: 10 }).startDate).toBe('2027-01-01');
  });
});

describe('builderVerb', () => {
  it('says what it replaces on one line; the note above says from when', () => {
    expect(builderVerb(44)).toBe('Replace 44 sessions');
    expect(builderVerb(1)).toBe('Replace 1 session');
    expect(builderNote(44, '2026-10-19', '2026-10-19')).toBe('Clears planned sessions from Oct 19. What you’ve done stays, and Undo puts it all back.');
  });
  it('says Use this plan when nothing is replaced', () => {
    expect(builderVerb(0)).toBe('Use this plan');
    expect(builderNote(0, '2026-10-26', '2026-10-26')).toMatch(/^Starts .*Oct 26\. Nothing is saved until you use it\.$/);
  });
});

describe('startWords', () => {
  it('a Monday start is week 1', () => {
    expect(startWords(true, '2026-11-16', '2026-11-16').replace(/\u00a0/g, ' ')).toBe('Week 1 starts Nov 16');
  });
  it('a mid-week start says the day it starts and when week 1 is', () => {
    expect(startWords(true, '2026-11-11', '2026-11-16').replace(/\u00a0/g, ' ')).toBe('Starts Wednesday. Week 1 is Nov 16');
  });
  it('off, it says the default', () => {
    expect(startWords(false, '2026-11-16', '2026-11-16')).toBe('Else it starts next Monday');
  });
  it('off with a set first day (after an ending plan, or one the assistant was given), it says that day', () => {
    expect(startWords(false, '2026-12-21', '2026-12-21', true).replace(/\u00a0/g, ' ')).toBe('Else it starts Dec 21');
    expect(startWords(true, '2026-11-12', '2026-11-16', true).replace(/\u00a0/g, ' ')).toBe('Starts Thursday. Week 1 is Nov 16');
  });
});

describe('raceRowWords', () => {
  it('names the weekday of race day: Sunday unless the assistant was given another day', () => {
    expect(raceRowWords('sun')).toBe('Race on the last Sunday');
    expect(raceRowWords('sat')).toBe('Race on the last Saturday');
  });
});

describe('clampTyped', () => {
  it('holds a typed number to its range instead of dropping it', () => {
    expect(clampTyped('99', 2, 30)).toBe(30);
    expect(clampTyped('1', 2, 30)).toBe(2);
    expect(clampTyped('12', 2, 30)).toBe(12);
    expect(clampTyped('999', 3, 150)).toBe(150);
    expect(clampTyped('', 3, 150)).toBeNull();
    expect(clampTyped('abc', 3, 150)).toBeNull();
  });
});
