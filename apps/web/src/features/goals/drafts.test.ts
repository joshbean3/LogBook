import { beforeEach, describe, expect, it } from 'vitest';
import { clearDrafts, draftOf, dropDraft, keepDraft } from './drafts';

describe('a goal being written is kept until it is saved', () => {
  beforeEach(() => clearDrafts());
  const day = { user: 'u1', level: 'day' as const, period: '2026-11-12' };

  it('gives back the words typed when the editor is opened again for the same goal', () => {
    expect(draftOf(day)).toBe('');
    keepDraft(day, 'Send the model to Ana');
    expect(draftOf(day)).toBe('Send the model to Ana');
    // another period, another level and another account have their own
    expect(draftOf({ ...day, period: '2026-11-13' })).toBe('');
    expect(draftOf({ ...day, level: 'week', period: '2026-11-09' })).toBe('');
    expect(draftOf({ ...day, user: 'u2' })).toBe('');
  });

  it('starts an edit from the goal as it stands, and keeps the change being made to it', () => {
    expect(draftOf(day, 'Ship it')).toBe('Ship it');
    keepDraft(day, 'Ship it today', 'Ship it');
    expect(draftOf(day, 'Ship it')).toBe('Ship it today');
  });

  it('keeps nothing once the field is empty, or back to the words the goal already has', () => {
    keepDraft(day, 'x');
    keepDraft(day, '   ');
    expect(draftOf(day)).toBe('');
    keepDraft(day, 'Ship it today', 'Ship it');
    keepDraft(day, 'Ship it', 'Ship it');
    expect(draftOf(day, 'Ship it now')).toBe('Ship it now');
  });

  it('never puts old words over a goal that was set or changed another way since', () => {
    // typed for a goal not set yet, then the goal was set from the poster's idea: Edit starts from the goal
    keepDraft(day, 'Pack the bag');
    expect(draftOf(day, 'Book dentist appointment')).toBe('Book dentist appointment');
    // an edit left unsaved, then the goal's words changed
    keepDraft(day, 'Ship it today', 'Ship it');
    expect(draftOf(day, 'Ship it by noon')).toBe('Ship it by noon');
    expect(draftOf(day, 'Ship it')).toBe('Ship it today');
  });

  it('lets go of the words once they are saved', () => {
    keepDraft(day, 'Send the model to Ana');
    dropDraft(day);
    expect(draftOf(day)).toBe('');
  });

  it('holds a draft for a signed-out reader under no account, never under the next one', () => {
    keepDraft({ ...day, user: undefined }, 'Mine');
    expect(draftOf({ ...day, user: 'u9' })).toBe('');
  });
});
