import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { impliesRoot, isOrbsPath, matchRoute, resolveRoute } from '@/ui/nav';
import { resetOrbsForTest, setSwitches } from '../store';

/**
 * The two addresses of Orbs (`/orbs`, `/orbs/how`): pushed over Today while Orbs are on, and no place at all while they
 * are off, when both lead to Today (nothing of Orbs shows anywhere but the switch in Settings).
 */
vi.mock('idb-keyval', () => ({ get: async () => undefined, set: async () => undefined, del: async () => undefined, clear: async () => undefined }));
const g = globalThis as unknown as Record<string, unknown>;
beforeEach(() => {
  const m = new Map<string, string>();
  g.localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
  resetOrbsForTest();
});
afterEach(() => {
  delete g.localStorage;
  resetOrbsForTest();
});

describe('with Orbs on', () => {
  it('the Orbs page is pushed over Today, whatever day Today shows', () => {
    const m = matchRoute('/orbs');
    expect(m).toMatchObject({ kind: 'pushed', tab: 'today', root: '/today' });
    expect(m.stack.map((e) => [e.path, e.depth, e.title, e.idx])).toEqual([['/orbs', 1, 'Orbs', -1]]);
    expect(impliesRoot(m)).toBe(false);
    expect(matchRoute('/orbs/').kind).toBe('pushed');
  });
  it('How Orbs work is pushed over the Orbs page: Back returns to it', () => {
    const m = matchRoute('/orbs/how');
    expect(m).toMatchObject({ kind: 'pushed', tab: 'today', root: '/today' });
    expect(m.stack.map((e) => [e.path, e.depth, e.title])).toEqual([
      ['/orbs', 1, 'Orbs'],
      ['/orbs/how', 2, 'How Orbs work'],
    ]);
  });
  it('an address under /orbs that is no page leads to Today', () => {
    expect(resolveRoute('/orbs/anything').path).toBe('/today');
    expect(resolveRoute('/orbs/how/more').path).toBe('/today');
  });
});

describe('with Orbs off', () => {
  it('both addresses lead to Today', () => {
    setSwitches({ on: false });
    for (const path of ['/orbs', '/orbs/how', '/orbs/', '/orbs/anything']) expect(resolveRoute(path)).toMatchObject({ kind: 'root', tab: 'today', path: '/today' });
  });
  it('and they are places again when the switch comes back', () => {
    setSwitches({ on: false });
    setSwitches({ on: true });
    expect(resolveRoute('/orbs')).toMatchObject({ kind: 'pushed', path: '/orbs' });
    expect(resolveRoute('/orbs/how')).toMatchObject({ kind: 'pushed', path: '/orbs/how' });
  });
  it('“Show Orbs when you earn them” off changes no address', () => {
    setSwitches({ show: false });
    expect(resolveRoute('/orbs')).toMatchObject({ kind: 'pushed', path: '/orbs' });
  });
  it('no other address is touched', () => {
    setSwitches({ on: false });
    expect(isOrbsPath('/orbsx')).toBe(false);
    expect(isOrbsPath('/settings')).toBe(false);
    expect(resolveRoute('/settings')).toMatchObject({ kind: 'pushed', path: '/settings' });
    expect(resolveRoute('/goals/history')).toMatchObject({ kind: 'pushed', path: '/goals/history' });
  });
});
