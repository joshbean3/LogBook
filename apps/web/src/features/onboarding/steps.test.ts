import { describe, expect, it, vi } from 'vitest';
import { nudgeNext, questionsFor } from './steps';

describe('questionsFor', () => {
  it('asks the nudge on the phone only', () => {
    expect(questionsFor({ native: true, replaying: false, noPlan: false })).toContain('nudge');
    expect(questionsFor({ native: false, replaying: false, noPlan: false })).not.toContain('nudge');
  });
  it('never asks the nudge in a replay (settings-39)', () => {
    expect(questionsFor({ native: true, replaying: true, noPlan: false })).not.toContain('nudge');
  });
  it('skips the run questions with no running plan', () => {
    expect(questionsFor({ native: false, replaying: false, noPlan: true })).toEqual(['name', 'goal', 'habits', 'tour']);
  });
});

describe('nudgeNext', () => {
  it('makes no call into reminders in a replay (settings-39)', async () => {
    const enable = vi.fn(async () => true);
    expect(await nudgeNext({ on: true, replaying: true, enable })).toBe(false);
    expect(enable).not.toHaveBeenCalled();
  });
  it('asks nothing when the nudge is off', async () => {
    const enable = vi.fn(async () => true);
    await nudgeNext({ on: false, replaying: false, enable });
    expect(enable).not.toHaveBeenCalled();
  });
  it('waits for the answer, and a decline or a failure is off', async () => {
    expect(await nudgeNext({ on: true, replaying: false, enable: async () => true })).toBe(true);
    expect(await nudgeNext({ on: true, replaying: false, enable: async () => false })).toBe(false);
    expect(await nudgeNext({ on: true, replaying: false, enable: async () => Promise.reject(new Error('x')) })).toBe(false);
  });
});
