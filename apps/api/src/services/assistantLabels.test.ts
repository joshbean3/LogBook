import { describe, expect, it } from 'vitest';
import { goals } from '../db/schema.js';
import { makeApp, signUp } from '../test/helpers.js';
import { goalPeriodWords, labelOp } from './assistant.js';

/** Proposal labels are read on the card: words, never an ISO date (finding assistant-26). Today is Tue, Nov 10 2026. */
const T = '2026-11-10';

describe('proposal labels', () => {
  it('name the period in words', () => {
    expect(goalPeriodWords('week', '2026-11-09', T)).toBe('this week’s goal');
    expect(goalPeriodWords('week', '2026-11-16', T)).toBe('the goal for the week of Nov 16');
    expect(goalPeriodWords('month', '2026-11', T)).toBe('this month’s goal');
    expect(goalPeriodWords('month', '2026-12', T)).toBe('the goal for December');
    expect(goalPeriodWords('month', '2027-01', T)).toBe('the goal for January 2027');
    expect(goalPeriodWords('year', '2026', T)).toBe('this year’s goal');
    expect(goalPeriodWords('year', '2027', T)).toBe('the 2027 goal');
    expect(goalPeriodWords('day', T, T)).toBe('today’s goal');
    expect(goalPeriodWords('day', '2026-11-11', T)).toBe('tomorrow’s goal');
    expect(goalPeriodWords('day', '2026-11-13', T)).toBe('the goal for Fri, Nov 13');
  });

  it('say marks and statuses in words, with no ISO date', async () => {
    const { app, db } = makeApp();
    const a = await signUp(app, 'labels@example.com');
    const s = (await a.call('POST', '/api/sessions', { date: '2026-11-11', kind: 'run', type: 'Tempo', title: 'Tempo 6', miles: 6 })).body;
    db.insert(goals).values({ id: 'g_week', userId: a.id, level: 'week', period: '2026-11-09', text: 'Run three times', original: null, why: null, status: 'open', reflection: null, steps: '[]', createdAt: T, updatedAt: T, closedAt: null, deletedAt: null }).run();
    const labels = [
      labelOp(db, a.id, { op: 'mark_session', id: s.id, mark: 'floor' }, T),
      labelOp(db, a.id, { op: 'mark_session', id: s.id, mark: 'skip' }, T),
      labelOp(db, a.id, { op: 'mark_session', id: s.id, mark: 'sick' }, T),
      labelOp(db, a.id, { op: 'review_goal', id: 'g_week', status: 'partly' }, T),
      labelOp(db, a.id, { op: 'set_goal', level: 'week', period: '2026-11-16', text: 'Two long runs', steps: ['Pick the days'] }, T),
      labelOp(db, a.id, { op: 'set_goal', level: 'month', period: '2026-12', text: 'Run 80 miles' }, T),
    ];
    expect(labels).toEqual([
      'Mark Tempo 6 on Wed, Nov 11 as a floor day',
      'Mark Tempo 6 on Wed, Nov 11 as skipped',
      'Mark Tempo 6 on Wed, Nov 11 as a sick day',
      'Mark this week’s goal as partly done: “Run three times”',
      'Set the goal for the week of Nov 16: “Two long runs” with 1 step',
      'Set the goal for December: “Run 80 miles”',
    ]);
    for (const l of labels) expect(l).not.toMatch(/\d{4}-\d{2}/);
  });
});
