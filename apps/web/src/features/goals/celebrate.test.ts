import { emptyRewards, RULES, type Aim } from '@logbook/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Which goal still opens the full-screen page (Celebrate.tsx `useCelebrate`). Today's goal never does: it gets three
 * Orbs at its control. A week, month or year goal that earned its Orbs is the Orbs' own big moment, shown at rest. The
 * page opens only where Orbs do not show it.
 */
vi.mock('idb-keyval', () => ({ get: async () => undefined, set: async () => undefined, del: async () => undefined, clear: async () => undefined }));
const U = 'u_owner';
const g = globalThis as unknown as Record<string, unknown>;
const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), key: (i: number) => [...m.keys()][i] ?? null, get length() { return m.size; } };
};
const goal = (level: Aim['level'], period: string): Aim => ({ id: `g-${level}`, level, period, text: 'Run three times', original: null, why: null, status: 'done', reflection: null, steps: [], createdAt: '2026-11-01T08:00:00.000Z', updatedAt: `2026-11-20T08:00:00.000Z#${level}`, closedAt: '2026-11-20T08:00:00.000Z' });
let sent: string[] = [];
const launch = async (opts: { on?: boolean; show?: boolean; paid?: string } = {}) => {
  vi.resetModules();
  const local = mem();
  local.setItem('logbook.orbs.set', JSON.stringify({ on: opts.on ?? true, show: opts.show ?? true, weekTarget: 5, cadence: 1, size: 'steady', at: '2026-11-17T08:00:00.000Z' }));
  const base = emptyRewards(U, RULES.startsOn);
  local.setItem('logbook.orbs', JSON.stringify({ ...base, set: { ...base.set, on: opts.on ?? true, show: opts.show ?? true, at: '2026-11-17T08:00:00.000Z' }, once: opts.paid ? { [opts.paid]: { on: '2026-11-20', n: 9 } } : {} }));
  sent = [];
  Object.assign(g, { localStorage: local, sessionStorage: mem(), window: { dispatchEvent: (e: { type: string; detail: Aim }) => void sent.push(`${e.type}:${e.detail.level}`), addEventListener: () => undefined, removeEventListener: () => undefined }, CustomEvent: class { type: string; detail: unknown; constructor(type: string, init: { detail: unknown }) { this.type = type; this.detail = init.detail; } } });
  const store = await import('@/features/orbs/store');
  store.openOrbs(U);
  const { useCelebrate, CELEBRATE_WAIT_MS } = await import('./Celebrate');
  return { celebrate: useCelebrate(), wait: CELEBRATE_WAIT_MS };
};

describe('the full-screen goal page', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    for (const k of ['window', 'CustomEvent', 'localStorage', 'sessionStorage']) delete g[k];
  });
  it('today’s goal never opens it, with Orbs on or off', async () => {
    for (const on of [true, false]) {
      const { celebrate, wait } = await launch({ on });
      celebrate(goal('day', '2026-11-20'));
      vi.advanceTimersByTime(wait * 2);
      expect(sent).toEqual([]);
    }
  });
  it('a week goal that earned its Orbs is the Orbs’ moment: nothing opens from the tap', async () => {
    const { celebrate, wait } = await launch({ paid: 'goal:week:2026-11-16' });
    celebrate(goal('week', '2026-11-16'));
    vi.advanceTimersByTime(wait * 2);
    expect(sent).toEqual([]);
  });
  it('a goal that earned nothing still has its page, a beat after the tap', async () => {
    const { celebrate, wait } = await launch();
    celebrate(goal('month', '2026-11'));
    expect(sent).toEqual([]);
    vi.advanceTimersByTime(wait);
    expect(sent).toEqual(['logbook:celebrate:month']);
  });
  it('with Orbs off, or not shown, the page opens at once as it always did', async () => {
    for (const opts of [{ on: false }, { show: false, paid: 'goal:year:2026' }]) {
      const { celebrate } = await launch(opts);
      celebrate(goal('year', '2026'));
      expect(sent).toEqual(['logbook:celebrate:year']);
    }
  });
  it('one finish, one page, however many places show the goal', async () => {
    const { celebrate } = await launch({ on: false });
    celebrate(goal('week', '2026-11-16'));
    celebrate(goal('week', '2026-11-16'));
    expect(sent).toHaveLength(1);
  });
});
