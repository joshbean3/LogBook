import { describe, expect, it } from 'vitest';
import type { Log } from '../log/useLog';
import { isFirstDay, looksNew, nothingSetUp, setupDay } from './firstRun';

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

describe('the first day (the day setup was finished)', () => {
  // noon local time on the day, so the local date is the same in any time zone the tests run in
  const at = (day: string) => new Date(`${day}T12:00:00`).toISOString();
  const first = (o: Parameters<typeof log>[0] & { onboardedAt?: string | null } = {}) => {
    const l = log(o) as unknown as { boot: Record<string, unknown> };
    l.boot.user = { onboardedAt: o.onboardedAt === undefined ? at(T) : o.onboardedAt };
    return l as unknown as Log;
  };
  it('reads the local day out of the timestamp, and nothing out of none', () => {
    expect(setupDay(at(T))).toBe(T);
    expect(setupDay(null)).toBeNull();
    expect(setupDay(undefined)).toBeNull();
    expect(setupDay('not a date')).toBeNull();
  });
  it('is today when setup finished today and nothing is on the day: the day poster leads', () => {
    expect(isFirstDay(first({ habits: 3, blocks: 1 }), T)).toBe(true);
    // with no plan and no habits too
    expect(isFirstDay(first(), T)).toBe(true);
  });
  it('is over once a session or a run is on the day: the training card leads', () => {
    expect(isFirstDay(first({ sessions: { [T]: 1 } }), T)).toBe(false);
    expect(isFirstDay(first({ runs: { [T]: 1 } }), T)).toBe(false);
  });
  it('is never another day, and never an account set up on another day', () => {
    expect(isFirstDay(first(), '2026-11-11')).toBe(false);
    expect(isFirstDay(first({ onboardedAt: at('2026-11-09') }), T)).toBe(false);
    expect(isFirstDay(first({ onboardedAt: null }), T)).toBe(false);
    // a bootstrap from before the account carried it
    expect(isFirstDay(log(), T)).toBe(false);
  });
});
