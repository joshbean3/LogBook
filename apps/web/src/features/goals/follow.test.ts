import { awaitingReview, type Aim } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { carryable, owedWords, ANSWER_HOLD_MS, answerHeld } from './follow';

const today = '2026-11-11';
const g = (level: Aim['level'], period: string, status: Aim['status'] = 'open'): Aim => ({ id: `${level}-${period}`, level, period, text: `${level} ${period}`, original: null, why: null, status, reflection: null, steps: [], createdAt: '', updatedAt: '', closedAt: null });

describe('the review row and the carry-over never name the same goal', () => {
  it('leaves yesterday’s open goal to the review row', () => {
    const goals = [g('day', '2026-11-10')];
    expect(awaitingReview(goals, today).map((x) => x.id)).toEqual(['day-2026-11-10']);
    expect(carryable(goals, today)).toBeNull();
  });

  it('offers the carry once yesterday’s goal is answered Partly or Missed, and only while today has none', () => {
    for (const status of ['partly', 'missed'] as const) {
      const goals = [g('day', '2026-11-10', status)];
      expect(awaitingReview(goals, today)).toEqual([]);
      expect(carryable(goals, today)?.id).toBe('day-2026-11-10');
      expect(carryable([...goals, g('day', today)], today)).toBeNull();
    }
    expect(carryable([g('day', '2026-11-10', 'done')], today)).toBeNull();
    expect(carryable([g('day', '2026-11-09', 'missed')], today)).toBeNull();
  });

  it('says where an owed goal came from', () => {
    expect(owedWords(g('day', '2026-11-10'), today)).toBe('Yesterday’s goal');
    expect(owedWords(g('week', '2026-11-02'), today)).toBe('Last week’s goal');
    expect(owedWords(g('day', '2026-11-09'), today)).toBe('Still open from Mon, Nov 9');
  });
});

describe('answering goals one after another', () => {
  // the three answers stay where they are while the next goal comes in under them
  it('holds an answer that lands just after a goal appeared: a double tap never answers a goal nobody has read', () => {
    const shown = 10_000;
    expect(answerHeld(shown, shown)).toBe(true);
    expect(answerHeld(shown, shown + 120)).toBe(true);
    expect(answerHeld(shown, shown + ANSWER_HOLD_MS - 1)).toBe(true);
  });
  it('takes the answer once the goal has been on screen for a moment', () => {
    const shown = 10_000;
    expect(answerHeld(shown, shown + ANSWER_HOLD_MS)).toBe(false);
    expect(answerHeld(shown, shown + 5000)).toBe(false);
    expect(ANSWER_HOLD_MS).toBeLessThanOrEqual(600);
  });
});
