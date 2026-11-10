import { zOnboarding } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { addHabit, HABIT_LIMIT, STARTER_HABITS } from './model';

const twelve = Array.from({ length: 12 }, (_, i) => `Habit ${i + 1}`);

describe('adding a habit on the habits step', () => {
  it('the limit is the one the server holds the setup answers to', () => {
    const answers = { goal: 'base', runDays: ['mon'], longRunDay: 'mon', weeklyMiles: 10, wake: 390, leave: 510 };
    expect(zOnboarding.safeParse({ ...answers, habits: twelve.slice(0, HABIT_LIMIT) }).success).toBe(true);
    expect(zOnboarding.safeParse({ ...answers, habits: [...twelve, 'One more'] }).success).toBe(false);
  });
  it('adds a new name to both lists', () => {
    expect(addHabit(['Stretch'], [], '  Cold   shower ')).toEqual({ selected: ['Stretch', 'Cold shower'], custom: ['Cold shower'], refused: false });
  });
  it('picks a starter or an earlier one by name instead of duplicating it', () => {
    expect(addHabit([], [], 'stretch')).toEqual({ selected: [STARTER_HABITS[1]], custom: [], refused: false });
    const again = addHabit(['Floss'], ['Floss'], 'FLOSS');
    expect(again.selected).toEqual(['Floss']);
    expect(again.custom).toEqual(['Floss']);
  });
  it('changes nothing for an empty name', () => {
    const selected = ['Stretch'];
    expect(addHabit(selected, [], '   ').selected).toBe(selected);
  });
  it('refuses a 13th, new or known, and keeps both lists as they were', () => {
    const fresh = addHabit(twelve, twelve, 'Thirteenth');
    expect(fresh.refused).toBe(true);
    expect(fresh.selected).toBe(twelve);
    expect(fresh.custom).toBe(twelve);
    expect(addHabit(twelve, twelve, 'Stretch').refused).toBe(true);
  });
  it('takes the 12th', () => {
    const eleven = twelve.slice(0, 11);
    const r = addHabit(eleven, eleven, 'Twelfth');
    expect(r.refused).toBe(false);
    expect(r.selected).toHaveLength(12);
  });
});
