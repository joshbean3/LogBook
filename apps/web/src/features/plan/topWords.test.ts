import type { PlanBlock } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { planCardWords, weekCardWords, type TopBlock } from './topWords';

const block: PlanBlock = { id: 'b1', name: 'Half marathon · 12 weeks', start: '2026-11-10', end: '2027-02-07', source: null, summary: null, createdAt: '2026-11-01T00:00:00Z' };
const base: TopBlock = { t: '2026-11-09', b: block, st: 'Upcoming', weeks: 12, wk: 0, phases: {}, race: null };
const nb = (s: string) => s.replace(/ /g, ' ');

describe('the week card', () => {
  it('names the lead-in before week 1', () => {
    const w = weekCardWords(base, '2026-11-09');
    expect(w.title).toBe('Lead-in');
    expect(nb(w.sub)).toBe('Week 1 starts Nov 16');
    expect(w.inPlan).toBe(true);
  });
  it('says the week number and its phase, a down week, race week', () => {
    const phases = { '2026-11-30': { phase: 'build' as const, down: false }, '2026-12-07': { phase: 'build' as const, down: true }, '2027-02-01': { phase: 'race' as const, down: false } };
    expect(weekCardWords({ ...base, phases }, '2026-11-30')).toEqual({ title: 'Week 3 of 12', sub: 'Build', inPlan: true });
    expect(weekCardWords({ ...base, phases }, '2026-12-07').sub).toBe('Down week');
    expect(weekCardWords({ ...base, phases }, '2027-02-01')).toEqual({ title: 'Week 12 of 12', sub: 'Race week', inPlan: true });
  });
  it('outside the plan, the dates and when it starts or ended', () => {
    const before = weekCardWords(base, '2026-11-02');
    expect(before.title).toBe('Nov 2 – 8');
    expect(nb(before.sub)).toBe('Plan starts Nov 10');
    expect(nb(weekCardWords({ ...base, t: '2027-03-01' }, '2027-03-01').sub)).toBe('Plan ended Feb 7');
    expect(weekCardWords({ ...base, b: null }, '2026-11-30')).toEqual({ title: 'Nov 30 – Dec 6', sub: 'No plan running', inPlan: false });
  });
});

describe('the plan card', () => {
  it('the name without its length, the end or race day, when it starts', () => {
    const p = planCardWords(base)!;
    expect(p.title).toBe('Half marathon');
    expect(nb(p.sub)).toBe('Ends Feb 7');
    expect(p.foot).toBe('Starts Tuesday');
    expect(nb(planCardWords({ ...base, race: '2027-02-07' })!.sub)).toBe('Race Feb 7');
  });
  it('a build with no race; weeks to go; finished; none', () => {
    expect(planCardWords({ ...base, b: { ...block, name: 'Base build' } })!.sub).toBe('Steady build');
    expect(planCardWords({ ...base, t: '2026-12-01', st: 'Active', wk: 3 })!.foot).toBe('9 weeks to go');
    expect(planCardWords({ ...base, t: '2027-02-05', st: 'Active', wk: 12 })!.foot).toBe('Last week');
    expect(nb(planCardWords({ ...base, t: '2027-03-01', st: 'Finished' })!.foot)).toBe('Finished Feb 7');
    expect(planCardWords({ ...base, b: null })).toBeNull();
  });
});
