import type { Aim } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { goalIdea, habitsIdea, sessionWhen } from './goalIdea';

const aim = (text: string, status: Aim['status']): Aim => ({ id: 'g1', level: 'day', period: '2026-11-11', text, original: null, why: 'Because', status, reflection: null, steps: [{ id: 's1', text: 'Outline', done: true }], createdAt: '', updatedAt: '', closedAt: null });
const all = { todos: [{ text: 'Renew passport' }, { text: 'Email Alex' }], fitness: true, session: 'Bike 40 min', habits: 7, minutes: 10 * 60 };

describe('goalIdea', () => {
  it('starts with yesterday’s goal when it was not finished, and carries the goal itself', () => {
    for (const status of ['open', 'partly', 'missed'] as const) {
      const y = aim('Finish the long run notes', status);
      expect(goalIdea({ ...all, yesterday: y })).toEqual({ source: 'yesterday', text: 'Finish the long run notes', label: 'An idea · from yesterday', from: y });
    }
  });

  it('skips a goal that was done yesterday', () => {
    expect(goalIdea({ ...all, yesterday: aim('Finish the notes', 'done') })?.source).toBe('todos');
  });

  it('then the top open to-do', () => {
    expect(goalIdea(all)).toEqual({ source: 'todos', text: 'Renew passport', label: 'An idea · from your to-dos' });
  });

  it('then today’s session, with when it still fits', () => {
    expect(goalIdea({ ...all, todos: [] })).toEqual({ source: 'fitness', text: 'Bike 40 min, before lunch', label: 'An idea · from Fitness' });
    expect(goalIdea({ ...all, todos: [], minutes: 14 * 60 })?.text).toBe('Bike 40 min, this afternoon');
    expect(goalIdea({ ...all, todos: [], minutes: 18 * 60 })?.text).toBe('Bike 40 min, this evening');
  });

  it('never from training with Fitness off', () => {
    expect(goalIdea({ ...all, todos: [], fitness: false })).toEqual({ source: 'habits', text: 'All 7 habits, done by 9', label: 'An idea · from your habits' });
  });

  it('then the habits', () => {
    expect(goalIdea({ habits: 7, session: null })?.text).toBe('All 7 habits, done by 9');
    expect(goalIdea({ habits: 1 })?.text).toBe('Your one habit, done by 9');
    expect(goalIdea({ habits: 2 })?.text).toBe('Both habits, done by 9');
    expect(habitsIdea(7, 21 * 60)).toBe('All 7 habits, done before bed');
  });

  it('has nothing to say with nothing to go on', () => {
    expect(goalIdea({})).toBeNull();
    expect(goalIdea({ todos: [{ text: '  ' }], session: ' ', habits: 0 })).toBeNull();
  });

  it('says when a session fits', () => {
    expect(sessionWhen(8 * 60)).toBe('before lunch');
    expect(sessionWhen(11 * 60 + 30)).toBe('this afternoon');
    expect(sessionWhen(17 * 60)).toBe('this evening');
  });
});
