import { awaitingReview, type Aim } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { carryable, owedWords } from './follow';

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
