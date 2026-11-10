import { describe, expect, it } from 'vitest';
import type { Log } from '../log/useLog';
import { looksNew, nothingSetUp } from './firstRun';

const T = '2026-11-10';
const log = (o: { habits?: number; blocks?: number; sessions?: Record<string, number>; runs?: Record<string, number>; journal?: number } = {}) =>
  ({
    today: T,
    habits: Array.from({ length: o.habits ?? 0 }, (_, i) => ({ id: `h${i}` })),
    boot: { blocks: Array.from({ length: o.blocks ?? 0 }, (_, i) => ({ id: `b${i}` })) },
    snap: {
      sessionsOn: (d: string) => Array.from({ length: o.sessions?.[d] ?? 0 }, () => ({})),
      activitiesOn: (d: string) => Array.from({ length: o.runs?.[d] ?? 0 }, () => ({})),
      journalOn: (d: string) => (d === T ? Array.from({ length: o.journal ?? 0 }, () => ({})) : []),
    },
  }) as unknown as Log;

describe('the first-run face', () => {
  it('shows only when nothing at all is set up', () => {
    expect(looksNew(log(), T)).toBe(true);
    expect(nothingSetUp([], [])).toBe(true);
  });
  it('never shows to someone with habits, even with no plan', () => {
    expect(looksNew(log({ habits: 2 }), T)).toBe(false);
  });
  it('never shows to someone with a plan, even with no habits', () => {
    expect(looksNew(log({ blocks: 1 }), T)).toBe(false);
    expect(looksNew(log({ sessions: { '2026-11-12': 1 } }), T)).toBe(false);
  });
  it('never shows once there is a to-do or a goal', () => {
    expect(nothingSetUp([{ id: 't' }], [])).toBe(false);
    expect(nothingSetUp([], [{ id: 'g' }])).toBe(false);
  });
  it('never shows after a run or a journal entry, or on another day', () => {
    expect(looksNew(log({ runs: { '2026-11-08': 1 } }), T)).toBe(false);
    expect(looksNew(log({ journal: 1 }), T)).toBe(false);
    expect(looksNew(log(), '2026-11-11')).toBe(false);
  });
});
