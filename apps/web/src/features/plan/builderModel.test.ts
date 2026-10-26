import { describe, expect, it } from 'vitest';
import { builderVerb, fromEndingBlock } from './builderModel';

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
  it('says what it replaces, and from when', () => {
    expect(builderVerb(44, '2026-10-19')).toBe('Replace 44 planned sessions from Oct 19');
    expect(builderVerb(1, '2026-10-26')).toBe('Replace 1 planned session from Oct 26');
  });
  it('says Use this plan when nothing is replaced', () => {
    expect(builderVerb(0, '2026-10-26')).toBe('Use this plan');
  });
});
