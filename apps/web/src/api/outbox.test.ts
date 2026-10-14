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

const qc = { invalidateQueries: vi.fn(async () => undefined) } as never;
const load = async () => {
  vi.resetModules();
  const mod = await import('./outbox');
  await mod.outbox.load();
  return mod;
};

beforeEach(() => {
  disk.clear();
  sent = [];
  offline = false;
  respond = async () => ({});
});
afterEach(() => vi.restoreAllMocks());

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
