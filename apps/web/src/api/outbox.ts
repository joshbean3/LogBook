import { get, set } from 'idb-keyval';
import type { QueryClient } from '@tanstack/react-query';
import { api, isOffline, NetworkError } from './client';

/**
 * Writes made while offline wait here and replay in order when the connection returns.
 * The UI already applied them optimistically, so from the athlete's side the app just worked.
 *
 * A write that creates a row the UI already shows under a provisional id (`tmpId`) is the one case with a
 * dependency: anything that names that id before the server has answered waits here too, and is rewritten
 * with the real id when it is sent. That holds whether the POST is queued (offline) or on the wire (online).
 */
export interface OutboxItem {
  /** Also the item's `Idempotency-Key` (contract 4): every send of this write, first try or replay, carries it, so the server applies it once. */
  id: string;
  path: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  json?: unknown;
  /** Query keys to refetch once this lands. */
  invalidate: ReadonlyArray<readonly unknown[]>;
  createdAt: string;
  /** The provisional id of the row this POST creates; the reply's `id` is its real name. */
  tmpId?: string;
  /**
   * Set (and persisted) just before the item goes on the wire. If the page dies before the answer is handled, the next
   * load still sends it, with the same key, and the server answers with what it did the first time instead of doing it
   * again: no duplicate to-do after "offline, add, back online, reload".
   */
  sentAt?: string;
}

const KEY = 'logbook.outbox.v1';
/** A fresh idempotency key: random and long enough never to meet another. */
export const newKey = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
const listeners = new Set<(n: number) => void>();
let items: OutboxItem[] = [];
let loaded = false;
let replaying = false;
let client: QueryClient | null = null;
/**
 * Provisional id → real id, learnt as creates are answered. Memory only, but the moment one is learnt the whole
 * queue is rewritten and persisted with it, so a reload between a create and its dependents loses nothing.
 */
const aliases = new Map<string, string>();
/** Provisional ids whose create is on the wire right now. */
const inflight = new Set<string>();

const mentions = (path: string, json: unknown, id: string) => path.includes(id) || (json !== undefined && JSON.stringify(json).includes(id));
/** Is this provisional id still unanswered: queued here, or on the wire? */
const pendingIn = (path: string, json: unknown) => {
  for (const id of inflight) if (mentions(path, json, id)) return true;
  for (const it of items) if (it.tmpId && mentions(path, json, it.tmpId)) return true;
  return false;
};
/** The same request with every known provisional id replaced by its real one. */
const rewrite = <T extends { path: string; json?: unknown }>(it: T): T => {
  let path = it.path;
  let text = it.json === undefined ? undefined : JSON.stringify(it.json);
  for (const [tmp, real] of aliases) {
    if (path.includes(tmp)) path = path.split(tmp).join(real);
    if (text !== undefined && text.includes(tmp)) text = text.split(tmp).join(real);
  }
  return { ...it, path, json: text === undefined ? undefined : (JSON.parse(text) as unknown) };
};
const realIdOf = (res: unknown) => (res && typeof res === 'object' && typeof (res as { id?: unknown }).id === 'string' ? (res as { id: string }).id : null);

const persist = async () => {
  try {
    await set(KEY, items);
  } catch {
    /* storage unavailable */
  }
  for (const fn of listeners) fn(items.length);
};

export const outbox = {
  async load() {
    if (loaded) return;
    loaded = true;
    try {
      items = ((await get<OutboxItem[]>(KEY)) ?? []).filter((x) => x && x.path);
    } catch {
      items = [];
    }
    for (const fn of listeners) fn(items.length);
  },
  size: () => items.length,
  subscribe(fn: (n: number) => void) {
    listeners.add(fn);
    fn(items.length);
    return () => listeners.delete(fn);
  },
  /** Queue a write. Pass `id` when it was already tried on the wire under that key, so its replay is recognised. */
  async enqueue(item: Omit<OutboxItem, 'id' | 'createdAt'> & { id?: string }) {
    const it: OutboxItem = { ...item, id: item.id ?? newKey(), createdAt: new Date().toISOString() };
    // a create that fell off the wire goes in ahead of anything already waiting on its id
    const at = it.tmpId ? items.findIndex((x) => mentions(x.path, x.json, it.tmpId!)) : -1;
    if (at >= 0) items.splice(at, 0, it);
    else items.push(it);
    await persist();
  },
  /** A create answered on the wire: anything waiting on its provisional id can go now. */
  resolve(tmpId: string, realId: string) {
    aliases.set(tmpId, realId);
    inflight.delete(tmpId);
    if (client) void outbox.replay(client);
  },
  /** Send everything queued, oldest first. Stops at the first network failure; drops items the server rejects. */
  async replay(qc: QueryClient) {
    client = qc;
    if (replaying || !items.length || isOffline()) return;
    replaying = true;
    const touched: Array<readonly unknown[]> = [];
    try {
      while (items.length) {
        // in flight: persisted before it leaves, so a reload mid-request replays it under the same key (the server dedupes)
        items[0] = { ...items[0]!, sentAt: new Date().toISOString() };
        await persist();
        const it = rewrite(items[0]!);
        try {
          const res = await api(it.path, { method: it.method, json: it.json, idempotencyKey: it.id });
          const real = it.tmpId ? realIdOf(res) : null;
          if (it.tmpId && real) {
            aliases.set(it.tmpId, real);
            // what is still waiting is persisted under the real id now, so a reload before it goes out cannot lose it
            items = items.map(rewrite);
          }
          touched.push(...it.invalidate);
          items.shift();
          await persist();
        } catch (e) {
          if (e instanceof NetworkError) {
            // it may or may not have reached the server; the next replay sends it with the same key either way
            break;
          }
          // the server said no (validation, gone): nothing more we can do with it
          items.shift();
          touched.push(...it.invalidate);
          await persist();
        }
      }
    } finally {
      replaying = false;
      const seen = new Set<string>();
      for (const key of touched) {
        const k = JSON.stringify(key);
        if (seen.has(k)) continue;
        seen.add(k);
        void qc.invalidateQueries({ queryKey: key });
      }
    }
  },
};

/**
 * Perform a write. Online: straight to the server. Offline (or the network drops mid-request):
 * queue it and resolve so the optimistic UI stands. A write that names a provisional id the server
 * has not answered for yet waits in the queue behind that create, online or not.
 */
export async function write<T>(rawPath: string, method: OutboxItem['method'], rawJson: unknown, invalidate: ReadonlyArray<readonly unknown[]>, opts: { tmpId?: string } = {}): Promise<T | null> {
  const { tmpId } = opts;
  // one key for this write, whether it goes now or from the queue later (contract 4)
  const key = newKey();
  // a write that still names a provisional id the server has since answered goes out under the real one
  const { path, json } = rewrite({ path: rawPath, json: rawJson });
  if (isOffline() || pendingIn(path, json)) {
    await outbox.enqueue({ id: key, path, method, json, invalidate, tmpId });
    return null;
  }
  if (tmpId) inflight.add(tmpId);
  try {
    const res = await api<T>(path, { method, json, idempotencyKey: key });
    if (tmpId) {
      const real = realIdOf(res);
      if (real) outbox.resolve(tmpId, real);
      else inflight.delete(tmpId);
    }
    return res;
  } catch (e) {
    if (tmpId) inflight.delete(tmpId);
    if (e instanceof NetworkError) {
      // the request may have landed before the connection dropped: the queued copy keeps its key, so it cannot land twice
      await outbox.enqueue({ id: key, path, method, json, invalidate, tmpId, sentAt: new Date().toISOString() });
      return null;
    }
    throw e;
  }
}
