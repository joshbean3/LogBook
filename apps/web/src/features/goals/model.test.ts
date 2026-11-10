import { shiftDays, type Aim } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { askOf, dayEnd, scoreOf, suggestRequest, timeUsed } from './model';

const goal = (level: Aim['level'], period: string, status: Aim['status'] = 'open', steps: Aim['steps'] = []): Aim => ({ id: `${level}-${period}`, level, period, text: 'x', original: null, why: null, status, reflection: null, steps, createdAt: '', updatedAt: '', closedAt: null });
// a Sunday: this week began on Monday Nov 2
const T = '2026-11-08';
const at = (d: string, h = 12) => new Date(`${d}T${String(h).padStart(2, '0')}:00:00`).getTime();

describe('the score', () => {
  it('counts the answered goals of the last four weeks against the four before', () => {
    const goals = [
      goal('week', '2026-11-02', 'open'),
      goal('week', '2026-10-26', 'done'),
      goal('week', '2026-10-19', 'done'),
      goal('week', '2026-10-12', 'missed'),
      goal('week', '2026-10-05', 'done'),
      goal('week', '2026-09-28', 'done'),
      goal('week', '2026-09-21', 'partly'),
    ];
    const s = scoreOf(goals, 'week', T);
    expect(s).toMatchObject({ caps: 'Last 4 weeks', closed: 3, kept: 2, words: 'week goals kept', prev: { closed: 3, kept: 2 }, vs: 'vs 2 of 3 the 4 weeks before', owed: 0, tone: 'on' });
  });

  it('turns orange when a lower share is kept than before, and names reviews owed', () => {
    const goals = [goal('day', T, 'done'), goal('day', shiftDays(T, -1), 'missed'), goal('day', shiftDays(T, -2), 'open'), ...[7, 8, 9].map((i) => goal('day', shiftDays(T, -i), 'done'))];
    const s = scoreOf(goals, 'day', T);
    expect(s).toMatchObject({ closed: 2, kept: 1, owed: 1, prev: { closed: 3, kept: 3 }, tone: 'behind', vs: 'vs 3 of 3 the 7 days before' });
  });

  it('has no tone and no zero headline with nothing answered', () => {
    const s = scoreOf([goal('month', '2026-11', 'open')], 'month', T);
    expect(s).toMatchObject({ closed: 0, kept: 0, tone: null, prev: null, vs: 'Nothing answered the 3 months before' });
    expect(scoreOf([], 'year', T)).toMatchObject({ caps: 'This year', vs: 'Nothing answered last year' });
  });

  it('is behind at under half with nothing to compare', () => {
    expect(scoreOf([goal('week', '2026-10-26', 'missed')], 'week', T).tone).toBe('behind');
    expect(scoreOf([goal('week', '2026-10-26', 'done')], 'week', T).tone).toBe('on');
  });
});

describe('the clock in words', () => {
  it('counts the time used', () => {
    expect(timeUsed('week', '2026-11-02', at('2026-11-05', 0)).words).toBe('3 of 7 days used');
    expect(timeUsed('day', T, at(T, 15)).words).toBe('15 of 24 hours used');
    expect(timeUsed('month', '2026-11', at('2026-11-16', 0)).words).toBe('15 of 30 days used');
  });
});

describe('the suggestion request', () => {
  it('names the period plainly', () => {
    expect(suggestRequest('day', T, T)).toMatch(/^Suggest one day goal for today \(Sun, Nov 8\), based on my recent training and goals\./);
    expect(suggestRequest('week', '2026-11-09', T)).toContain('for next week (Nov 9–15)');
    expect(suggestRequest('month', '2026-11', T)).toContain('for November 2026');
    expect(suggestRequest('day', '2026-11-12', T)).toContain('for Thu, Nov 12');
  });
});

describe('the question the sheet asks', () => {
  it('names the period it is about', () => {
    expect(askOf('day', T, T)).toBe('What is the one thing for today?');
    expect(askOf('day', '2026-11-09', T)).toBe('What is the one thing for tomorrow?');
    expect(askOf('day', '2026-11-12', T)).toBe('What is the one thing for Thu, Nov 12?');
    expect(askOf('week', '2026-11-02', T)).toBe('What will you get done this week?');
    expect(askOf('week', '2026-11-09', T)).toBe('What will you get done next week?');
    expect(askOf('week', '2026-11-16', T)).toBe('What will you get done the week of Nov 16–22?');
    expect(askOf('month', '2026-11', T)).toBe('What will you finish this month?');
    expect(askOf('month', '2026-12', T)).toBe('What will you finish in December?');
    expect(askOf('year', '2026', T)).toBe('What will this year be about?');
    expect(askOf('year', '2027', T)).toBe('What will 2027 be about?');
  });

  it('ends a starter with the right day', () => {
    expect(dayEnd(T, T)).toBe('today');
    expect(dayEnd('2026-11-09', T)).toBe('tomorrow');
    expect(dayEnd('2026-11-12', T)).toBe('on Thu');
  });

  it('never promises habits or 90 days', () => {
    expect(suggestRequest('week', '2026-11-02', T)).not.toMatch(/habit|90 days/);
  });
});
