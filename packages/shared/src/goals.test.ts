import { describe, expect, it } from 'vitest';
import { awaitingReview, bestDayStreak, currentGoals, dayStreak, goalPoints, goalsDue, levelOf, periodEnd, periodName, periodOf, periodPast, periodSpan, shiftPeriod, streakIfHit, weekMarks, type Aim } from './goals.js';

const goal = (level: Aim['level'], period: string, status: Aim['status'] = 'open'): Aim => ({ id: `${level}-${period}`, level, period, text: 'x', original: null, why: null, status, reflection: null, steps: [], createdAt: '', updatedAt: '', closedAt: null });

describe('goal periods', () => {
  it('names the period a date is in', () => {
    expect(periodOf('year', '2026-10-28')).toBe('2026');
    expect(periodOf('month', '2026-10-28')).toBe('2026-10');
    expect(periodOf('week', '2026-10-28')).toBe('2026-10-26');
    expect(periodOf('week', '2026-11-01')).toBe('2026-10-26');
    expect(periodOf('day', '2026-10-28')).toBe('2026-10-28');
  });

  it('ends each period on its last day', () => {
    expect(periodEnd('year', '2026')).toBe('2026-12-31');
    expect(periodEnd('month', '2026-02')).toBe('2026-02-28');
    expect(periodEnd('month', '2026-10')).toBe('2026-10-31');
    expect(periodEnd('week', '2026-10-26')).toBe('2026-11-01');
    expect(periodEnd('day', '2026-10-26')).toBe('2026-10-26');
  });

  it('steps back and forth', () => {
    expect(shiftPeriod('year', '2026', -1)).toBe('2025');
    expect(shiftPeriod('month', '2026-01', -1)).toBe('2025-12');
    expect(shiftPeriod('week', '2026-10-26', 1)).toBe('2026-11-02');
    expect(shiftPeriod('day', '2026-10-31', 1)).toBe('2026-11-01');
  });

  it('is past only after its last day', () => {
    expect(periodPast('week', '2026-10-26', '2026-11-01')).toBe(false);
    expect(periodPast('week', '2026-10-26', '2026-11-02')).toBe(true);
    expect(periodPast('day', '2026-10-25', '2026-10-26')).toBe(true);
  });

  it('says it the way a person would', () => {
    const t = '2026-10-26';
    expect(periodName('day', '2026-10-26', t)).toBe('Today');
    expect(periodName('day', '2026-10-25', t)).toBe('Yesterday');
    expect(periodName('week', '2026-10-26', t)).toBe('This week');
    expect(periodName('week', '2026-10-19', t)).toBe('Last week');
    expect(periodName('week', '2026-10-12', t)).toBe('Oct 12–18');
    expect(periodName('month', '2026-09', t)).toBe('Last month');
    expect(periodName('year', '2026', t)).toBe('This year');
    expect(periodSpan('week', '2026-10-26')).toBe('Oct 26–Nov 1');
    expect(periodSpan('month', '2026-10')).toBe('October 2026');
  });
});

describe('what a day asks of the owner', () => {
  const t = '2026-10-27';
  it('finds the current goal of each level', () => {
    const cur = currentGoals([goal('week', '2026-10-26'), goal('day', '2026-10-26'), goal('day', '2026-10-27')], t);
    expect(cur.week?.period).toBe('2026-10-26');
    expect(cur.day?.period).toBe('2026-10-27');
    expect(cur.month).toBeNull();
  });

  it('owes a review for every past goal still open, newest first', () => {
    const r = awaitingReview([goal('day', '2026-10-25'), goal('day', '2026-10-26'), goal('day', '2026-10-24', 'done'), goal('week', '2026-10-19'), goal('week', '2026-10-26')], t);
    expect(r.map((g) => g.id)).toEqual(['day-2026-10-26', 'day-2026-10-25', 'week-2026-10-19']);
  });

  it('flags the day and the week when they are unset', () => {
    expect(goalsDue([goal('week', '2026-10-26')], t)).toMatchObject({ day: true, week: false, review: 0 });
  });
});

describe('the game', () => {
  const day = (period: string, status: Aim['status'] = 'done', steps: Aim['steps'] = []): Aim => ({ ...goal('day', period, status), steps });
  it('counts the streak to today, or to yesterday while today is open', () => {
    const gs = [day('2026-10-24'), day('2026-10-25'), day('2026-10-26')];
    expect(dayStreak(gs, '2026-10-26')).toBe(3);
    expect(dayStreak([...gs, day('2026-10-27', 'open')], '2026-10-27')).toBe(3);
    expect(dayStreak(gs, '2026-10-28')).toBe(0);
    expect(dayStreak([day('2026-10-24'), day('2026-10-25', 'partly'), day('2026-10-26')], '2026-10-26')).toBe(1);
  });
  it('finds the best streak and the one a hit would make', () => {
    const gs = [day('2026-10-01'), day('2026-10-02'), day('2026-10-03'), day('2026-10-10'), day('2026-10-11')];
    expect(bestDayStreak(gs)).toBe(3);
    expect(streakIfHit(gs, '2026-10-12')).toBe(3);
  });
  it('scores steps, goals, partial credit and the streak bonus', () => {
    const g = day('2026-10-26', 'done', [{ id: 'a', text: 'x', done: true }, { id: 'b', text: 'y', done: true }]);
    expect(goalPoints(g, 4)).toBe(20 + 50 + 20);
    expect(goalPoints({ ...goal('week', '2026-10-26', 'partly'), steps: [] })).toBe(80);
    expect(goalPoints(day('2026-10-26', 'open', [{ id: 'a', text: 'x', done: true }]))).toBe(10);
  });
  it('levels at 0, 250, 750, 1500', () => {
    expect(levelOf(0)).toMatchObject({ level: 1, floor: 0, next: 250 });
    expect(levelOf(249).level).toBe(1);
    expect(levelOf(250)).toMatchObject({ level: 2, floor: 250, next: 750 });
    expect(levelOf(1600)).toMatchObject({ level: 4, into: 100, span: 1000 });
  });
  it('marks the week by its day goals', () => {
    const marks = weekMarks([day('2026-10-26'), day('2026-10-27', 'open'), day('2026-10-28', 'open')], '2026-10-28', '2026-10-28').map((m) => m.mark);
    expect(marks).toEqual(['done', 'missed', 'open', 'ahead', 'ahead', 'ahead', 'ahead']);
  });
});
