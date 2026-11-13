import { describe, expect, it, vi } from 'vitest';
import { nudgeNext, questionsFor, resumeStep, tourOpens } from './steps';

describe('questionsFor', () => {
  it('asks about Fitness right after the name, and No skips every training question', () => {
    expect(questionsFor({ native: false, replaying: false, noPlan: false })).toEqual(['name', 'fitness', 'goal', 'days', 'morning', 'habits']);
    expect(questionsFor({ native: false, replaying: false, noPlan: false, fitness: false })).toEqual(['name', 'fitness', 'habits']);
    expect(questionsFor({ native: true, replaying: false, noPlan: true, fitness: false })).toEqual(['name', 'fitness', 'habits', 'nudge']);
  });
  it('asks the nudge on the phone only', () => {
    expect(questionsFor({ native: true, replaying: false, noPlan: false })).toContain('nudge');
    expect(questionsFor({ native: false, replaying: false, noPlan: false })).not.toContain('nudge');
  });
  it('never asks the nudge in a replay (settings-39)', () => {
    expect(questionsFor({ native: true, replaying: true, noPlan: false })).not.toContain('nudge');
  });
  it('skips the run questions with no running plan', () => {
    expect(questionsFor({ native: false, replaying: false, noPlan: true })).toEqual(['name', 'fitness', 'goal', 'habits']);
  });
});

describe('the tour, out of the path', () => {
  const paths = [
    questionsFor({ native: false, replaying: false, noPlan: false }),
    questionsFor({ native: true, replaying: false, noPlan: false }),
    questionsFor({ native: true, replaying: true, noPlan: false }),
    questionsFor({ native: false, replaying: false, noPlan: true }),
    questionsFor({ native: true, replaying: false, noPlan: true, fitness: false }),
  ];
  it('is not a question on any path: the last question leads to the reveal', () => {
    for (const p of paths) expect(p).not.toContain('tour');
    // the last question is the habits, or on the phone the nudge
    expect(paths.map((p) => p[p.length - 1])).toEqual(['habits', 'nudge', 'habits', 'habits', 'nudge']);
  });
  it('opens only once setup is saved, or in a replay; before that its address goes on to the reveal', () => {
    expect(tourOpens({ replaying: false, saved: false })).toBe(false);
    expect(tourOpens({ replaying: false, saved: true })).toBe(true);
    expect(tourOpens({ replaying: true, saved: false })).toBe(true);
  });
  it('a draft an earlier build saved on the tour opens on the reveal, never on a step that is gone', () => {
    const order = ['', ...paths[0]!, 'ready'] as const;
    expect(resumeStep('tour', order)).toBe('ready');
    expect(resumeStep('days', order)).toBe('days');
    expect(resumeStep('ready', order)).toBe('ready');
    expect(resumeStep(undefined, order)).toBe('name');
    // a step this path does not ask (the nudge, off the phone) starts over at the name, as before
    expect(resumeStep('nudge', order)).toBe('name');
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
