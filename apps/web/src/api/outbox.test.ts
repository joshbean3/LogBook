import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * D-F2: offline writes were sent twice when the page reloaded while the queue was replaying. Every write now carries one
 * Idempotency-Key from its first try to its last replay (the queued item's id), and an item is persisted as in flight
 * before it is sent, so a reload replays it under the same key and the server (contract 4) applies it once.
 */

/** IndexedDB stand-in that outlives a "reload" (a fresh import of the module). */
const disk = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: async (k: string) => structuredClone(disk.get(k)),
  set: async (k: string, v: unknown) => void disk.set(k, structuredClone(v)),
}));

type Sent = { path: string; method?: string; json?: unknown; idempotencyKey?: string; queuedAtSend: Array<{ id: string; sentAt?: string }> };
let sent: Sent[] = [];
let offline = false;
let respond: (path: string) => Promise<unknown> = async () => ({});
class NetworkError extends Error {}
vi.mock('./client', () => ({
  NetworkError,
  isOffline: () => offline,
  api: async (path: string, init: { method?: string; json?: unknown; idempotencyKey?: string }) => {
    const queued = ((disk.get('logbook.outbox.v1') as Array<{ id: string; sentAt?: string }> | undefined) ?? []).map((x) => ({ id: x.id, sentAt: x.sentAt }));
    sent.push({ path, method: init.method, json: init.json, idempotencyKey: init.idempotencyKey, queuedAtSend: queued });
    return respond(path);
  },
}));

/** Who the cached bootstrap says is signed in (null: nobody, as after a 401). */
let me: string | null = 'u1';
const qc = { invalidateQueries: vi.fn(async () => undefined), getQueryData: () => (me ? { user: { id: me } } : undefined) } as never;
const load = async () => {
  vi.resetModules();
  const mod = await import('./outbox');
  mod.outbox.attach(qc);
  await mod.outbox.load();
  return mod;
};
/** An error the way api() throws one for an HTTP status. */
const http = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });
type Item = { id: string; path: string; method: string; userId?: string; sentAt?: string; json?: unknown };
const onDisk = () => (disk.get('logbook.outbox.v1') as Item[] | undefined) ?? [];

beforeEach(() => {
  disk.clear();
  sent = [];
  offline = false;
  me = 'u1';
  respond = async () => ({});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('outbox idempotency (contract 4, D-F2)', () => {
  it('a queued write replays with Idempotency-Key = its queued id', async () => {
    const { outbox, write } = await load();
    offline = true;
    await write('/todos', 'POST', { text: 'A', date: '2026-10-14' }, [['todos']], { tmpId: 'tmp-a' });
    await write('/todos', 'POST', { text: 'B', date: '2026-10-14' }, [['todos']], { tmpId: 'tmp-b' });
    const queued = disk.get('logbook.outbox.v1') as Array<{ id: string }>;
    expect(queued).toHaveLength(2);
    offline = false;
    respond = async () => ({ id: `real-${sent.length}` });
    await outbox.replay(qc);
    expect(sent.map((s) => s.idempotencyKey)).toEqual(queued.map((q) => q.id));
    expect(outbox.size()).toBe(0);
  });

  it('marks an item in flight on disk before it is sent, and a reload mid-request resends it under the same key', async () => {
    const first = await load();
    offline = true;
    await first.write('/todos', 'POST', { text: 'A', date: '2026-10-14' }, [['todos']], { tmpId: 'tmp-a' });
    await first.write('/todos', 'POST', { text: 'B', date: '2026-10-14' }, [['todos']], { tmpId: 'tmp-b' });
    const [a, b] = disk.get('logbook.outbox.v1') as Array<{ id: string }>;
    offline = false;
    // the server takes A, but the page dies before the answer is handled
    respond = () => new Promise(() => undefined);
    void first.outbox.replay(qc);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]!.queuedAtSend[0]).toMatchObject({ id: a!.id, sentAt: expect.any(String) });

    // the reload: a fresh module reads the queue from disk and replays A again, under A's key, then B under B's
    const second = await load();
    respond = async (path) => ({ id: `real-${path}-${sent.length}` });
    await second.outbox.replay(qc);
    expect(sent.map((s) => s.idempotencyKey)).toEqual([a!.id, a!.id, b!.id]);
    expect(second.outbox.size()).toBe(0);
  });

  it('an online write carries a key, and if the connection drops mid-request the queued copy keeps that key', async () => {
    const { outbox, write } = await load();
    respond = async () => {
      throw new NetworkError();
    };
    const r = await write('/todos', 'POST', { text: 'C', date: '2026-10-14' }, [['todos']]);
    expect(r).toBeNull();
    const key = sent[0]!.idempotencyKey;
    expect(key).toMatch(/.{16,}/);
    const queued = disk.get('logbook.outbox.v1') as Array<{ id: string; sentAt?: string }>;
    expect(queued).toEqual([expect.objectContaining({ id: key, sentAt: expect.any(String) })]);
    respond = async () => ({});
    await outbox.replay(qc);
    expect(sent.map((s) => s.idempotencyKey)).toEqual([key, key]);
  });

  it('each write gets its own key', async () => {
    const { write } = await load();
    await write('/todos', 'POST', { text: 'D' }, []);
    await write('/todos', 'POST', { text: 'D' }, []);
    expect(new Set(sent.map((s) => s.idempotencyKey)).size).toBe(2);
  });
});

/**
 * shell-01: a queued write used to be thrown away on any answer that was not a network failure, so a deploy (503), a rate
 * limit (429) or a session that ran out (401) silently destroyed work done offline. Now an item leaves the queue only when
 * the server took it or refused it for good.
 */
describe('replay keeps what the server could not take (shell-01)', () => {
  const queueOne = async () => {
    const mod = await load();
    offline = true;
    await mod.write('/todos', 'POST', { text: 'A' }, [['todos']], { tmpId: 'tmp-a' });
    await mod.write('/todos/tmp-a', 'PATCH', { text: 'A2' }, [['todos']]);
    offline = false;
    return mod;
  };

  it.each([503, 500, 502, 504, 429, 408, 425])('a %i keeps the whole queue and tries again later', async (status) => {
    vi.useFakeTimers();
    const { outbox } = await queueOne();
    respond = async () => {
      throw http(status);
    };
    await outbox.replay(qc);
    expect(sent).toHaveLength(1);
    expect(outbox.size()).toBe(2);
    expect(onDisk().map((x) => x.path)).toEqual(['/todos', '/todos/tmp-a']);
    // the server is back: the retry timer sends both, in order, the first under the same key
    respond = async (path) => (path === '/todos' ? { id: 'real-a' } : {});
    await vi.advanceTimersByTimeAsync(2000);
    expect(sent.map((x) => x.path)).toEqual(['/todos', '/todos', '/todos/real-a']);
    expect(sent[1]!.idempotencyKey).toBe(sent[0]!.idempotencyKey);
    expect(outbox.size()).toBe(0);
    expect(onDisk()).toEqual([]);
  });

  it('a 401 keeps the queue and does not retry until someone is signed in again', async () => {
    vi.useFakeTimers();
    const { outbox } = await queueOne();
    respond = async () => {
      // what api() does on a 401: the bootstrap leaves the cache (main.tsx), then it throws
      me = null;
      throw http(401);
    };
    await outbox.replay(qc);
    expect(outbox.size()).toBe(2);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(sent).toHaveLength(1);
    // signed out: nothing is sent at all
    await outbox.replay(qc);
    expect(sent).toHaveLength(1);
    // the same person signs back in: everything goes
    me = 'u1';
    respond = async (path) => (path === '/todos' ? { id: 'real-a' } : {});
    await outbox.replay(qc);
    expect(sent.map((x) => x.path)).toEqual(['/todos', '/todos', '/todos/real-a']);
    expect(outbox.size()).toBe(0);
  });

  it('a 401 that signs nobody out is not sent again in a loop: one try, then 3 s, 10 s, 30 s, then every 60 s', async () => {
    vi.useFakeTimers();
    const { outbox } = await queueOne();
    // one route answers 401 while the session is still good: the bootstrap stays, so every caller of replay still sees an account
    respond = async () => {
      throw http(401);
    };
    await outbox.replay(qc);
    expect(sent).toHaveLength(1);
    // the app asks again and again (a bootstrap refetch, the page coming back): nothing more leaves
    for (let i = 0; i < 50; i++) await outbox.replay(qc);
    expect(sent).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2999);
    expect(sent).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(sent).toHaveLength(2);
    for (let i = 0; i < 50; i++) await outbox.replay(qc);
    await vi.advanceTimersByTimeAsync(9999);
    expect(sent).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(sent).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(sent).toHaveLength(4);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sent).toHaveLength(5);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sent).toHaveLength(6);
    // nothing was lost while it waited
    expect(outbox.size()).toBe(2);
    // the server takes it again: everything goes, and the wait starts over
    respond = async (path) => (path === '/todos' ? { id: 'real-a' } : {});
    await vi.advanceTimersByTimeAsync(60_000);
    expect(outbox.size()).toBe(0);
  });

  it('signing back in after a 401 sends at once, whatever the wait had grown to', async () => {
    vi.useFakeTimers();
    const { outbox } = await queueOne();
    respond = async () => {
      throw http(401);
    };
    await outbox.replay(qc);
    await vi.advanceTimersByTimeAsync(3000 + 10_000);
    expect(sent).toHaveLength(3);
    // the session is found to be over: nobody is signed in, and nothing is sent
    me = null;
    await outbox.replay(qc);
    await vi.advanceTimersByTimeAsync(300_000);
    expect(sent).toHaveLength(3);
    // the same person signs in: no wait
    me = 'u1';
    respond = async (path) => (path === '/todos' ? { id: 'real-a' } : {});
    await outbox.replay(qc);
    expect(outbox.size()).toBe(0);
  });

  it('a network failure with the phone "online" retries by itself: 2 s, 5 s, 15 s, then every 30 s', async () => {
    vi.useFakeTimers();
    const { outbox } = await queueOne();
    respond = async () => {
      throw new NetworkError();
    };
    await outbox.replay(qc);
    const tries = [sent.length];
    for (const ms of [2000, 5000, 15_000, 30_000, 30_000]) {
      await vi.advanceTimersByTimeAsync(ms - 1);
      expect(sent.length).toBe(tries.at(-1));
      await vi.advanceTimersByTimeAsync(1);
      tries.push(sent.length);
    }
    expect(tries).toEqual([1, 2, 3, 4, 5, 6]);
    expect(outbox.size()).toBe(2);
    // once the queue is empty nothing is scheduled
    respond = async (path) => (path === '/todos' ? { id: 'real-a' } : {});
    await vi.advanceTimersByTimeAsync(30_000);
    expect(outbox.size()).toBe(0);
    const done = sent.length;
    await vi.advanceTimersByTimeAsync(120_000);
    expect(sent.length).toBe(done);
  });

  it.each([400, 404, 409, 410, 413, 422])('a %i drops that one item, says so, and sends the rest', async (status) => {
    const mod = await load();
    // the same module instance the freshly loaded outbox raises its toast through
    const { toastStore } = await import('@/ui/toastStore');
    offline = true;
    await mod.write('/journal/gone', 'PATCH', { text: 'x' }, [['journal']]);
    await mod.write('/todos', 'POST', { text: 'B' }, [['todos']]);
    offline = false;
    respond = async (path) => {
      if (path === '/journal/gone') throw http(status);
      return { id: 'real-b' };
    };
    const before = toastStore.shown();
    await mod.outbox.replay(qc);
    expect(sent.map((x) => x.path)).toEqual(['/journal/gone', '/todos']);
    expect(mod.outbox.size()).toBe(0);
    expect(toastStore.shown()).toBe(before + 1);
    expect(toastStore.get()?.text).toBe('One change could not be saved');
    toastStore.dismiss();
  });

  it('a status outside both lists (403) is kept, never dropped', async () => {
    vi.useFakeTimers();
    const { outbox } = await queueOne();
    respond = async () => {
      throw http(403);
    };
    await outbox.replay(qc);
    expect(outbox.size()).toBe(2);
  });
});

describe('each queued write belongs to the account that made it (shell-01, shell-26)', () => {
  it('carries the user id and replays only for that user', async () => {
    const { outbox, write } = await load();
    offline = true;
    await write('/todos', 'POST', { text: 'account A private to-do' }, [['todos']]);
    expect(onDisk()[0]).toMatchObject({ userId: 'u1' });
    expect(outbox.peek()[0]!.userId).toBe('u1');
    offline = false;
    // someone else is signed in on this phone: nothing of A's is sent, and it is not thrown away here either
    me = 'u2';
    await outbox.replay(qc);
    expect(sent).toHaveLength(0);
    expect(outbox.size()).toBe(1);
    // nobody signed in
    me = null;
    await outbox.replay(qc);
    expect(sent).toHaveLength(0);
    // A is back
    me = 'u1';
    await outbox.replay(qc);
    expect(sent.map((x) => x.path)).toEqual(['/todos']);
    expect(outbox.size()).toBe(0);
  });

  it('a write queued after the session ran out keeps the id of the account that made it', async () => {
    const { outbox, write } = await load();
    outbox.setUser('u1');
    respond = async () => {
      me = null;
      throw http(401);
    };
    expect(await write('/journal', 'POST', { text: 'kept' }, [['journal']])).toBeNull();
    expect(onDisk()).toEqual([expect.objectContaining({ path: '/journal', userId: 'u1', sentAt: expect.any(String) })]);
  });

  it('items from before the stamp existed take the account that is signed in', async () => {
    disk.set('logbook.outbox.v1', [{ id: 'old-1', path: '/todos', method: 'POST', json: { text: 'old' }, invalidate: [], createdAt: '2026-11-01T00:00:00.000Z' }]);
    const { outbox } = await load();
    outbox.setUser('u1');
    expect(outbox.peek()[0]!.userId).toBe('u1');
    await outbox.replay(qc);
    expect(sent.map((x) => x.idempotencyKey)).toEqual(['old-1']);
  });

  it('clear() empties the queue on disk and in memory, and forgets the account', async () => {
    vi.useFakeTimers();
    const { outbox, write } = await load();
    outbox.setUser('u1');
    offline = true;
    await write('/todos', 'POST', { text: 'A' }, [['todos']], { tmpId: 'tmp-a' });
    offline = false;
    respond = async () => {
      throw http(503);
    };
    await outbox.replay(qc);
    await outbox.clear();
    expect(outbox.size()).toBe(0);
    expect(onDisk()).toEqual([]);
    // the retry that was pending is cancelled
    const n = sent.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sent.length).toBe(n);
  });
});

describe('a write the server cannot take right now is kept (shell-03)', () => {
  it.each([500, 503, 429, 408])('online, a %i queues the write and keeps the optimistic change', async (status) => {
    vi.useFakeTimers();
    const { outbox, write } = await load();
    respond = async () => {
      throw http(status);
    };
    await expect(write('/todos', 'POST', { text: 'C' }, [['todos']])).resolves.toBeNull();
    expect(onDisk()).toEqual([expect.objectContaining({ path: '/todos', id: sent[0]!.idempotencyKey, userId: 'u1' })]);
    // and it goes again by itself, under the same key
    respond = async () => ({ id: 'real-c' });
    await vi.advanceTimersByTimeAsync(2000);
    expect(sent.map((x) => x.idempotencyKey)).toEqual([sent[0]!.idempotencyKey, sent[0]!.idempotencyKey]);
    expect(outbox.size()).toBe(0);
  });

  it.each([400, 404, 409, 422])('online, a %i is thrown, marked as a refused write, and nothing is queued', async (status) => {
    const { outbox, write, isWriteRejected } = await load();
    respond = async () => {
      throw http(status);
    };
    const err = await write('/todos', 'POST', { text: '' }, [['todos']]).catch((e: unknown) => e);
    expect(err).toMatchObject({ status });
    expect(isWriteRejected(err)).toBe(true);
    expect(isWriteRejected(new Error('other'))).toBe(false);
    expect(outbox.size()).toBe(0);
  });
});

/**
 * goals-27: a goal set offline is shown under a provisional id; the step added to it and Mark done were sent to that id
 * and answered 404, so the goal came back open with no steps. The create now carries its provisional id, as to-dos do.
 */
describe('a goal set offline keeps what was done to it (goals-27)', () => {
  it('offline set, add step, mark done, then replay keeps all three', async () => {
    const { outbox, write } = await load();
    offline = true;
    const tmp = 'tmp-goal-day-2026-11-10';
    await write('/goals/day/2026-11-10', 'PUT', { text: 'Walk 5 miles' }, [['goals']], { tmpId: tmp });
    await write(`/goals/${tmp}`, 'PATCH', { steps: [{ id: 's1', text: 'Shoes by the door', done: true }] }, [['goals']]);
    await write(`/goals/${tmp}`, 'PATCH', { status: 'done' }, [['goals']]);
    expect(outbox.size()).toBe(3);
    offline = false;
    respond = async (path) => (path === '/goals/day/2026-11-10' ? { id: 'goal-77' } : { id: 'goal-77', status: 'done' });
    await outbox.replay(qc);
    expect(sent.map((x) => [x.method, x.path])).toEqual([
      ['PUT', '/goals/day/2026-11-10'],
      ['PATCH', '/goals/goal-77'],
      ['PATCH', '/goals/goal-77'],
    ]);
    expect(sent[1]!.json).toEqual({ steps: [{ id: 's1', text: 'Shoes by the door', done: true }] });
    expect(sent[2]!.json).toEqual({ status: 'done' });
    expect(outbox.size()).toBe(0);
  });

  it('online, Mark done tapped while the set is still on the wire waits for the real id', async () => {
    const { outbox, write } = await load();
    const tmp = 'tmp-goal-day-2026-11-10';
    let answer: (v: unknown) => void = () => undefined;
    respond = (path) => (path === '/goals/day/2026-11-10' ? new Promise((r) => (answer = r)) : Promise.resolve({ id: 'goal-77' }));
    const set = write('/goals/day/2026-11-10', 'PUT', { text: 'Walk 5 miles' }, [['goals']], { tmpId: tmp });
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    await write(`/goals/${tmp}`, 'PATCH', { status: 'done' }, [['goals']]);
    // held behind the create, not sent to the provisional id
    expect(sent).toHaveLength(1);
    expect(outbox.size()).toBe(1);
    answer({ id: 'goal-77' });
    await set;
    await vi.waitFor(() => expect(outbox.size()).toBe(0));
    expect(sent.map((x) => x.path)).toEqual(['/goals/day/2026-11-10', '/goals/goal-77']);
  });
});

/**
 * Plan's Add sheet (useSessionMutations().add): the session's id is made on the phone and the create is registered under
 * it, so what names the session before the server has answered (a past day's done mark, Undo) goes out after the create,
 * in order, online or offline. A create refused for good takes what waited on it out of the queue.
 */
describe('a session added in Plan keeps what was done to it before the server answered', () => {
  const id = 'pA1b2C3d4E5f6';
  const body = { id, date: '2026-11-09', kind: 'run', type: 'Easy', title: null, details: null, miles: 4, minutes: null };

  it('online: the done mark and Undo wait behind the create and go out in order', async () => {
    const { outbox, write } = await load();
    let answer: (v: unknown) => void = () => undefined;
    respond = (path) => (path === '/sessions' ? new Promise((r) => (answer = r)) : Promise.resolve({ ok: true }));
    const created = write('/sessions', 'POST', body, [['month', '2026-11']], { tmpId: id });
    const marked = write(`/sessions/${id}/mark`, 'POST', { mark: 'done' }, [['month', '2026-11']]);
    const undone = write(`/sessions/${id}`, 'DELETE', undefined, [['month', '2026-11']]);
    expect(await marked).toBeNull();
    expect(await undone).toBeNull();
    // only the create is on the wire; the two that name its id are held
    expect(sent.map((x) => [x.method, x.path])).toEqual([['POST', '/sessions']]);
    expect(outbox.size()).toBe(2);
    answer({ ...body, position: 0 });
    await created;
    await vi.waitFor(() => expect(outbox.size()).toBe(0));
    expect(sent.map((x) => [x.method, x.path])).toEqual([
      ['POST', '/sessions'],
      ['POST', `/sessions/${id}/mark`],
      ['DELETE', `/sessions/${id}`],
    ]);
  });

  it('offline: create, mark and Undo replay in the order they were made, under the id made on the phone', async () => {
    const { outbox, write } = await load();
    offline = true;
    await write('/sessions', 'POST', body, [['month', '2026-11']], { tmpId: id });
    await write(`/sessions/${id}/mark`, 'POST', { mark: 'done' }, [['month', '2026-11']]);
    await write(`/sessions/${id}`, 'DELETE', undefined, [['month', '2026-11']]);
    expect(outbox.size()).toBe(3);
    offline = false;
    respond = async (path) => (path === '/sessions' ? { ...body, position: 0 } : { ok: true });
    await outbox.replay(qc);
    expect(sent.map((x) => [x.method, x.path])).toEqual([
      ['POST', '/sessions'],
      ['POST', `/sessions/${id}/mark`],
      ['DELETE', `/sessions/${id}`],
    ]);
    expect((sent[0]!.json as { id: string }).id).toBe(id);
    expect(outbox.size()).toBe(0);
  });

  it('a create refused for good: forget() drops what waited on its id, and nothing is sent to it later', async () => {
    const { outbox, write } = await load();
    let refuse: (e: unknown) => void = () => undefined;
    respond = (path) => (path === '/sessions' ? new Promise((_r, rej) => (refuse = rej)) : Promise.resolve({ ok: true }));
    const created = write('/sessions', 'POST', body, [['month', '2026-11']], { tmpId: id });
    await write(`/sessions/${id}/mark`, 'POST', { mark: 'done' }, [['month', '2026-11']]);
    // another write, about something else, stays
    offline = true;
    await write('/todos', 'POST', { text: 'A', date: '2026-11-09' }, [['todos']], { tmpId: 'tmp-a' });
    offline = false;
    expect(outbox.size()).toBe(2);
    refuse(http(404));
    await expect(created).rejects.toMatchObject({ status: 404 });
    await outbox.forget(id);
    expect(onDisk().map((x) => x.path)).toEqual(['/todos']);
    respond = async () => ({ id: 'real-a' });
    await outbox.replay(qc);
    expect(sent.map((x) => x.path)).toEqual(['/sessions', '/todos']);
    expect(outbox.size()).toBe(0);
  });
});
