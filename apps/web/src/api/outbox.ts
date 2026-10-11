import { get, set } from 'idb-keyval';
import type { QueryClient } from '@tanstack/react-query';
import { api, isOffline, NetworkError } from './client';

/**
 * Writes made while offline wait here and replay in order when the connection returns.
 * The UI already applied them optimistically, so from the athlete's side the app just worked.
 */
export interface OutboxItem {
  id: string;
  path: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  json?: unknown;
  /** Query keys to refetch once this lands. */
  invalidate: ReadonlyArray<readonly unknown[]>;
  createdAt: string;
}

const KEY = 'logbook.outbox.v1';
const listeners = new Set<(n: number) => void>();
let items: OutboxItem[] = [];
let loaded = false;
let replaying = false;

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
  async enqueue(item: Omit<OutboxItem, 'id' | 'createdAt'>) {
    items.push({ ...item, id: Math.random().toString(36).slice(2), createdAt: new Date().toISOString() });
    await persist();
  },
  /** Send everything queued, oldest first. Stops at the first network failure; drops items the server rejects. */
  async replay(qc: QueryClient) {
    if (replaying || !items.length || isOffline()) return;
    replaying = true;
    const touched: Array<readonly unknown[]> = [];
    try {
      while (items.length) {
        const it = items[0]!;
        try {
          await api(it.path, { method: it.method, json: it.json });
          touched.push(...it.invalidate);
          items.shift();
          await persist();
        } catch (e) {
          if (e instanceof NetworkError) break;
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
 * queue it and resolve so the optimistic UI stands.
 */
export async function write<T>(path: string, method: OutboxItem['method'], json: unknown, invalidate: ReadonlyArray<readonly unknown[]>): Promise<T | null> {
  if (isOffline()) {
    await outbox.enqueue({ path, method, json, invalidate });
    return null;
  }
  try {
    return await api<T>(path, { method, json });
  } catch (e) {
    if (e instanceof NetworkError) {
      await outbox.enqueue({ path, method, json, invalidate });
      return null;
    }
    throw e;
  }
}
