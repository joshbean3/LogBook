import type { PlanBlock, Session } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { goalOf, lengthWords, planFacts, sourceWords } from './planFacts';
import { planCardWords, type TopBlock } from './topWords';

const block: PlanBlock = { id: 'b1', name: 'Half marathon · 12 weeks', start: '2026-11-10', end: '2027-02-07', source: 'onboarding', summary: null, createdAt: '2026-11-09T18:57:16.193Z' };
const base: TopBlock = { t: '2026-11-09', b: block, st: 'Upcoming', weeks: 12, wk: 0, phases: {} };
const nb = (s: string | null | undefined) => (s ?? '').replace(/ /g, ' ');

describe('the plan card', () => {
  it('names the plan without its length and says when it starts', () => {
    expect(planCardWords(base)).toEqual({ title: 'Half marathon', state: 'Starts Tuesday · 12 weeks', progress: 0 });
    expect(nb(planCardWords({ ...base, t: '2026-10-01' })!.state)).toBe('Starts Nov 10 · 12 weeks');
  });
  it('the warm-up week, then the week, its phase, and how far through', () => {
    expect(nb(planCardWords({ ...base, t: '2026-11-11', st: 'Active' })!.state)).toBe('Warm-up · Week 1 starts Mon');
    const phases = { '2026-11-30': { phase: 'build' as const, down: false }, '2026-12-07': { phase: 'build' as const, down: true }, '2027-02-01': { phase: 'race' as const, down: false } };
    const w3 = planCardWords({ ...base, t: '2026-11-30', st: 'Active', wk: 3, phases })!;
    expect(w3.state).toBe('Week 3 of 12 · Build');
    expect(w3.progress).toBeCloseTo(15 / 84);
    expect(planCardWords({ ...base, t: '2026-12-08', st: 'Active', wk: 4, phases })!.state).toBe('Week 4 of 12 · Down week');
    expect(planCardWords({ ...base, t: '2027-02-07', st: 'Active', wk: 12, phases })).toMatchObject({ state: 'Week 12 of 12 · Race week', progress: 1 });
  });
  it('a finished plan, and none', () => {
    expect(planCardWords({ ...base, t: '2027-03-01', st: 'Finished' })).toMatchObject({ progress: 1 });
    expect(nb(planCardWords({ ...base, t: '2027-03-01', st: 'Finished' })!.state)).toBe('Plan ended Feb 7. Build the next one');
    expect(planCardWords({ ...base, b: null })).toBeNull();
  });
});

describe('where a plan came from', () => {
  // noon on Nov 9 in the zone the test runs in: the words follow the phone's own day, so the instant is built locally
  const at = new Date(2026, 10, 9, 12).toISOString();
  it('says what the plan records, and nothing when it records nothing', () => {
    expect(nb(sourceWords({ source: 'onboarding', createdAt: at }))).toBe('Built from your answers on Nov 9');
    expect(nb(sourceWords({ source: 'template', createdAt: at }))).toBe('Made with the plan builder on Nov 9');
    expect(nb(sourceWords({ source: 'file', createdAt: at }))).toBe('Written by the assistant from a file you shared on Nov 9');
    expect(nb(sourceWords({ source: 'chat', createdAt: at }))).toBe('Written by the assistant in a chat on Nov 9');
    expect(sourceWords({ source: 'revise', createdAt: at })).toBe('Revised by the assistant');
    expect(sourceWords({ source: null, createdAt: at })).toBeNull();
    expect(sourceWords({ source: 'something else', createdAt: at })).toBeNull();
  });
});

describe('what a plan is and its goals', () => {
  const profile = { goal: 'marathon' as const, raceDate: '2027-02-07', runDays: ['mon' as const], longRunDay: 'sat' as const, weeklyMiles: 25 };
  it('reads the goal from the name, else from the answers that built it', () => {
    expect(goalOf(block)).toBe('Half marathon');
    expect(goalOf({ ...block, name: 'Spring 10K' })).toBe('10K');
    expect(goalOf({ ...block, name: 'Base · 8 weeks' })).toBe('Base build');
    expect(goalOf({ ...block, name: 'Banking Plan', source: 'file' }, profile)).toBeNull();
    expect(goalOf({ ...block, name: 'Banking Plan', source: 'onboarding' }, profile)).toBe('Marathon');
  });
  it('counts the biggest week, runs a week, the long run and the race from the sessions', () => {
    const s = (date: string, type: string, miles: number): [string, Session] => [date, { id: `${date}${type}`, date, position: 0, kind: 'run', type, title: null, details: type === 'Race' ? 'Goal 1:55' : null, miles, minutes: null, blockId: 'b1', movedFrom: null, mark: null } as unknown as Session];
    const list = [s('2026-11-10', 'Easy', 3), s('2026-11-16', 'Easy', 4), s('2026-11-18', 'Tempo', 5), s('2026-11-21', 'Long', 8), s('2026-11-23', 'Easy', 4), s('2026-11-25', 'Easy', 4), s('2026-11-27', 'Easy', 4), s('2026-11-28', 'Long', 10), s('2027-02-07', 'Race', 13.1)];
    const on = (d: string) => list.filter(([x]) => x === d).map(([, v]) => v);
    const f = planFacts(block, 12, on);
    expect(f.peak).toBe(22);
    expect(f.runs).toBe('3 to 4');
    expect(f.long).toEqual({ day: 'Saturday', short: 'Sat', miles: 10 });
    expect(f.quality).toBe(1);
    expect(f.race).toEqual({ date: '2027-02-07', name: 'Race 13.1', details: 'Goal 1:55' });
    expect(lengthWords(f)).toBe('12 weeks after a warm-up week');
  });
});
