import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Sign out gives a store that keeps a copy on the account one last send, while the session can still carry it (Orbs:
 * features/orbs/sync.ts). It waits `SIGN_OUT_WAIT_MS` at most, a hook that fails changes nothing, and no other request
 * waits for anything.
 */
vi.mock('@/lib/native', () => ({ isNative: false, apiOrigin: '' }));
const sent: string[] = [];
const g = globalThis as unknown as { fetch: unknown };
const had = g.fetch;

const load = async () => {
  vi.resetModules();
  return import('./client');
};
beforeEach(() => {
  vi.useFakeTimers();
  sent.length = 0;
  g.fetch = async (url: string) => {
    sent.push(String(url));
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  };
});
afterEach(() => {
  vi.useRealTimers();
  g.fetch = had;
});

describe('before Sign out is sent', () => {
  it('each hook runs first, and the request follows as soon as they are done', async () => {
    const c = await load();
    const order: string[] = [];
    c.beforeSignOut.add(async () => {
      await Promise.resolve();
      order.push('hook');
    });
    const p = c.api('/auth/logout', { method: 'POST' }).then(() => order.push('answered'));
    await vi.advanceTimersByTimeAsync(0);
    await p;
    expect(order).toEqual(['hook', 'answered']);
    expect(sent).toEqual(['/api/auth/logout']);
  });
  it('a hook that never answers holds Sign out for 2.5 s and no longer', async () => {
    const c = await load();
    expect(c.SIGN_OUT_WAIT_MS).toBe(2500);
    c.beforeSignOut.add(() => new Promise(() => undefined));
    const p = c.api('/auth/logout', { method: 'POST' });
    await vi.advanceTimersByTimeAsync(2400);
    expect(sent).toEqual([]);
    await vi.advanceTimersByTimeAsync(200);
    await p;
    expect(sent).toEqual(['/api/auth/logout']);
  });
  it('a hook that throws or rejects stops nothing', async () => {
    const c = await load();
    c.beforeSignOut.add(() => {
      throw new Error('boom');
    });
    c.beforeSignOut.add(() => Promise.reject(new Error('no')));
    const p = c.api('/auth/logout', { method: 'POST' });
    await vi.advanceTimersByTimeAsync(0);
    await expect(p).resolves.toEqual({});
  });
  it('no other request waits: not Delete account, not a read, not a write', async () => {
    const c = await load();
    const hook = vi.fn(() => new Promise(() => undefined));
    c.beforeSignOut.add(hook);
    await c.api('/me', { method: 'DELETE' });
    await c.api('/bootstrap');
    await c.api('/me/rewards', { method: 'PUT', json: {} });
    expect(hook).not.toHaveBeenCalled();
    expect(sent).toHaveLength(3);
  });
  it('with no hook, Sign out is sent at once', async () => {
    const c = await load();
    await c.api('/auth/logout', { method: 'POST' });
    expect(sent).toEqual(['/api/auth/logout']);
  });
});
