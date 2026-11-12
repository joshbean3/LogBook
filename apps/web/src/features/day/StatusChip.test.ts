import type { PlanBlock, TrainingStatus } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { blockWords, statusRow, statusWords } from './StatusChip';

const WED = '2026-11-11';
const block = (over: Partial<PlanBlock> = {}): PlanBlock => ({ id: 'b1', name: 'Half marathon · 12 weeks', start: '2026-10-26', end: '2027-01-17', source: null, summary: null, createdAt: '', ...over });
const status = (over: Partial<TrainingStatus> = {}): TrainingStatus => ({ kind: 'sick', from: WED, until: '2026-11-13', ...over });

describe('Today’s status row (guide 6.13)', () => {
  it('ordinary training has no status pill: the plan pill stands alone, with the plan’s name', () => {
    const r = statusRow(null, [block()], WED, WED, true);
    expect(r.status).toBeNull();
    expect(r.plan).toEqual({ name: 'Half marathon', phase: 'Week 3 of 12', said: 'Half marathon, Week 3 of 12. Open Fitness' });
    expect(r.make).toBe(false);
  });
  it('never says "Day by day" or "On the plan"', () => {
    expect(statusWords('training', null, WED)).toBeNull();
    for (const blocks of [[], [block()]]) expect(JSON.stringify(statusRow(null, blocks, WED, WED, true))).not.toMatch(/Day by day|On the plan/);
  });
  it('with no plan now or ahead, the one pill offers to make one', () => {
    expect(statusRow(null, [], WED, WED, true)).toEqual({ status: null, plan: null, make: true });
    // a plan that has ended is no plan
    expect(statusRow(null, [block({ end: '2026-11-08' })], WED, WED, true).make).toBe(true);
  });
  it('a status that is on shows first, with its end, and the plan pill stays', () => {
    const r = statusRow(status(), [block()], WED, WED, true);
    expect(r.status).toEqual({ kind: 'sick', head: 'Sick', end: 'until Fri', dot: 'pencil', said: 'Status: Sick, until Fri. Change' });
    expect(r.plan?.phase).toBe('Week 3 of 12');
  });
  it('says the end in the day’s own words', () => {
    expect(statusWords('rest', WED, WED)).toMatchObject({ head: 'Rest', end: 'today only' });
    expect(statusWords('travel', '2026-11-12', WED)).toMatchObject({ head: 'Travel', end: 'until tomorrow' });
    expect(statusWords('travel', '2026-11-20', WED)).toMatchObject({ end: 'until Nov 20' });
    expect(statusWords('injured', null, WED)).toMatchObject({ head: 'Injured', end: '', dot: 'pencil' });
    expect(statusWords('taper', '2026-11-15', WED)).toMatchObject({ head: 'Taper', end: 'until Sun', dot: 'sky' });
    expect(statusRow(status({ kind: 'injured', until: null }), [], WED, WED, true).status?.said).toBe('Status: Injured, until changed. Change');
  });
  it('follows the shown day: a status that ended yesterday, or starts tomorrow, shows no pill', () => {
    expect(statusRow(status({ from: '2026-11-08', until: '2026-11-10' }), [block()], WED, WED, true).status).toBeNull();
    expect(statusRow(status({ from: '2026-11-12', until: '2026-11-14' }), [block()], WED, WED, true).status).toBeNull();
    expect(statusRow(status({ from: '2026-11-12', until: '2026-11-14' }), [block()], '2026-11-13', WED, true).status?.head).toBe('Sick');
  });
  it('with nothing to show there is no row: no status, no plan, and nothing that can open the builder', () => {
    expect(statusRow(null, [], WED, WED, false)).toEqual({ status: null, plan: null, make: false });
  });
  it('names the plan that is next when none has started', () => {
    expect(blockWords([block({ start: '2026-11-16' })], WED)).toEqual({ title: 'Half marathon', sub: 'Starts Monday' });
    expect(blockWords([block({ start: '2026-11-10' })], WED)).toEqual({ title: 'Half marathon', sub: 'Warm-up week' });
  });
});
