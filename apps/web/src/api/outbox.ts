import { get, set } from 'idb-keyval';
import type { QueryClient } from '@tanstack/react-query';
import { showToast } from '@/ui/toastStore';
import { api, isOffline, NetworkError } from './client';

/**
 * Writes made while offline wait here and replay in order when the connection returns.
 * The UI already applied them optimistically, so from the athlete's side the app just worked.
 *
 * A write that creates a row the UI already shows under a provisional id (`tmpId`) is the one case with a
 * dependency: anything that names that id before the server has answered waits here too, and is rewritten
 * with the real id when it is sent. That holds whether the POST is queued (offline) or on the wire (online).
 *
 * Nothing leaves the queue unless the server took it or refused it for good (DROP below). A server that is restarting, a
 * rate limit, a timeout or a session that ran out all keep the queue: it goes again with backoff, or when the same person
 * signs back in. Every item carries the id of the account that wrote it and is only ever sent for that account.
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
  /** The account that made this write (the bootstrap's user id). It replays only while that account is signed in. */
  userId?: string;
}

const KEY = 'logbook.outbox.v1';
/** A fresh idempotency key: random and long enough never to meet another. */
export const newKey = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
const listeners = new Set<(n: number) => void>();
/** A queued change is on the wire right now (the pill says "Syncing…" only then, shell-09). */
let sending = false;
const sendingListeners = new Set<(on: boolean) => void>();
const setSending = (on: boolean) => {
  if (sending === on) return;
  sending = on;
  for (const fn of sendingListeners) fn(on);
};
let items: OutboxItem[] = [];
let loaded = false;
let replaying = false;
let client: QueryClient | null = null;
/** The account using the app (set by the shell from the bootstrap). Stamped on every write queued from here on. */
let user: string | null = null;
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
/**
 * Is a create under this provisional id still unanswered, or is something still waiting on that id? A second create that
 * reuses the id (a goal set, undone and set again: one goal per period, so one id) must then wait its turn behind them.
 */
const tmpBusy = (tmpId: string) => inflight.has(tmpId) || items.some((it) => it.tmpId === tmpId || mentions(it.path, it.json, tmpId));

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

// ---------- what a failed send means ----------
/** The server read the write and refused it for good: sending it again cannot help. */
const DROP = new Set([400, 404, 409, 410, 413, 422]);
/** The server could not take it right now: the same write will pass later. */
const isTransient = (status: number) => status === 408 || status === 425 || status === 429 || status >= 500;
const statusOf = (e: unknown): number | null => (e && typeof e === 'object' && typeof (e as { status?: unknown }).status === 'number' ? (e as { status: number }).status : null);
/**
 * - `drop`: a definitive refusal (400, 404, 409, 410, 413, 422).
 * - `signin`: the session ran out (401). The write waits for the same account to sign back in.
 * - `retry`: no answer, a timeout, 408, 425, 429, any 5xx, or anything else unexpected. It is kept and sent again.
 */
export type SendVerdict = 'drop' | 'signin' | 'retry';
export const verdictOf = (e: unknown): SendVerdict => {
  if (e instanceof NetworkError) return 'retry';
  const status = statusOf(e);
  if (status === 401) return 'signin';
  if (status !== null && DROP.has(status)) return 'drop';
  return 'retry';
};
/** What the person is told when a queued change is refused for good. */
export const DROPPED_TEXT = 'One change could not be saved';
/** A write the server refused while online carries this mark, so the app's error handler can say so (main.tsx). */
const REJECTED = Symbol.for('logbook.write-rejected');
export const isWriteRejected = (e: unknown): boolean => !!e && typeof e === 'object' && (e as { [REJECTED]?: boolean })[REJECTED] === true;

// ---------- the retry timer ----------
/** After a send that may pass later: again in 2 s, 5 s, 15 s, then every 30 s, while the app is on screen. */
export const RETRY_MS = [2000, 5000, 15_000, 30_000] as const;
let retryStep = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
const cancelRetry = () => {
  clearTimeout(retryTimer);
  retryTimer = undefined;
};
const scheduleRetry = () => {
  cancelRetry();
  const ms = RETRY_MS[Math.min(retryStep, RETRY_MS.length - 1)]!;
  retryStep++;
  retryTimer = setTimeout(() => {
    retryTimer = undefined;
    // off screen nothing is sent; coming back to the app replays at once (main.tsx)
    if (typeof document !== 'undefined' && document.hidden) return;
    if (client) void outbox.replay(client);
  }, ms);
};

// ---------- a 401 that signed nobody out ----------
/**
 * A write answered 401 while the app still holds an account (one route refusing, a session the server has not owned up to
 * yet). Every caller of replay would send it again at once, and a bootstrap refetch calls replay, so the same write went
 * out over fifty times a second. After a 401 the queue waits 3 s, 10 s, 30 s, then 60 s between tries, however often it is
 * asked. A real sign-out ends the wait: the next sign-in sends at once.
 */
export const AUTH_WAIT_MS = [3000, 10_000, 30_000, 60_000] as const;
let authStep = 0;
let authUntil = 0;
let authTimer: ReturnType<typeof setTimeout> | undefined;
const clearAuthWait = () => {
  clearTimeout(authTimer);
  authTimer = undefined;
  authUntil = 0;
  authStep = 0;
};
const waitForSignIn = () => {
  clearTimeout(authTimer);
  const ms = AUTH_WAIT_MS[Math.min(authStep, AUTH_WAIT_MS.length - 1)]!;
  authStep++;
  authUntil = Date.now() + ms;
  authTimer = setTimeout(() => {
    authTimer = undefined;
    authUntil = 0;
    if (typeof document !== 'undefined' && document.hidden) return;
    if (client) void outbox.replay(client);
  }, ms);
};

/** Who is signed in, by the cached bootstrap (a 401 removes it, so a session that ran out sends nothing). */
const signedIn = (qc: QueryClient | null): string | null => qc?.getQueryData<{ user?: { id?: string } }>(['bootstrap'])?.user?.id ?? null;

export const outbox = {
  async load() {
    if (loaded) return;
    loaded = true;
    try {
      items = ((await get<OutboxItem[]>(KEY)) ?? []).filter((x) => x && x.path);
    } catch {
      items = [];
    }
    if (user) outbox.setUser(user);
    for (const fn of listeners) fn(items.length);
  },
  size: () => items.length,
  /** The queue as it stands (a copy). */
  peek: (): OutboxItem[] => items.map((x) => ({ ...x })),
  subscribe(fn: (n: number) => void) {
    listeners.add(fn);
    fn(items.length);
    return () => listeners.delete(fn);
  },
  /** Whether a queued change is being sent right now; told at once and on every change. */
  subscribeSending(fn: (on: boolean) => void) {
    sendingListeners.add(fn);
    fn(sending);
    return () => sendingListeners.delete(fn);
  },
  /**
   * The account now using the app. Writes queued from here on carry its id. Items queued by a build from before the stamp
   * existed have none: they were written on this device by the account that was signed in, so they take this one.
   */
  setUser(id: string | null) {
    user = id;
    if (!id || !items.some((x) => !x.userId)) return;
    items = items.map((x) => (x.userId ? x : { ...x, userId: id }));
    void persist();
  },
  /** Queue a write. Pass `id` when it was already tried on the wire under that key, so its replay is recognised. */
  async enqueue(item: Omit<OutboxItem, 'id' | 'createdAt' | 'userId'> & { id?: string }) {
    const owner = user ?? signedIn(client) ?? undefined;
    const it: OutboxItem = { ...item, id: item.id ?? newKey(), createdAt: new Date().toISOString(), ...(owner ? { userId: owner } : {}) };
    // a create that fell off the wire (it was sent: `sentAt`) goes in ahead of anything already waiting on its id; one
    // that was never sent is a later write, and keeps its place at the end
    const at = it.tmpId && it.sentAt ? items.findIndex((x) => mentions(x.path, x.json, it.tmpId!)) : -1;
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
  /**
   * A create the server refused for good (its caller says so): the writes that waited on its id can never land, so they
   * leave the queue without a word of their own.
   */
  async forget(tmpId: string) {
    inflight.delete(tmpId);
    const kept = items.filter((x) => !mentions(x.path, x.json, tmpId));
    if (kept.length === items.length) return;
    items = kept;
    await persist();
  },
  /** The data layer's client, so a retry or a resolved create can replay without being handed one. */
  attach(qc: QueryClient) {
    client = qc;
  },
  /**
   * Send what the signed-in account queued, oldest first. An item leaves only when the server took it, or refused it for
   * good (the person is told). Anything else stops the run with the queue intact: a 401 waits for sign-in (AUTH_WAIT_MS); a network
   * failure, a timeout, 408, 425, 429 or a 5xx goes again on the retry timer.
   */
  async replay(qc: QueryClient) {
    client = qc;
    if (replaying || !items.length || isOffline()) return;
    const me = signedIn(qc);
    if (!me) {
      // signed out for real: whoever signs in next is not kept waiting
      clearAuthWait();
      return;
    }
    if (Date.now() < authUntil) return;
    replaying = true;
    cancelRetry();
    let stalled = false;
    const touched: Array<readonly unknown[]> = [];
    const drop = (id: string) => {
      items = items.filter((x) => x.id !== id);
    };
    try {
      for (;;) {
        const at = items.findIndex((x) => x.userId === me);
        if (at < 0) break;
        // in flight: persisted before it leaves, so a reload mid-request replays it under the same key (the server dedupes)
        items[at] = { ...items[at]!, sentAt: new Date().toISOString() };
        await persist();
        const it = rewrite(items[at]!);
        try {
          setSending(true);
          const res = await api(it.path, { method: it.method, json: it.json, idempotencyKey: it.id }).finally(() => setSending(false));
          const real = it.tmpId ? realIdOf(res) : null;
          if (it.tmpId && real) {
            aliases.set(it.tmpId, real);
            // what is still waiting is persisted under the real id now, so a reload before it goes out cannot lose it
            items = items.map(rewrite);
          }
          touched.push(...it.invalidate);
          drop(it.id);
          retryStep = 0;
          clearAuthWait();
          await persist();
        } catch (e) {
          const verdict = verdictOf(e);
          if (verdict !== 'drop') {
            // it may or may not have reached the server; the next replay sends it with the same key either way
            stalled = verdict === 'retry';
            if (verdict === 'signin') waitForSignIn();
            break;
          }
          // the server said no for good (validation, gone): it cannot be saved, and the person is told
          drop(it.id);
          touched.push(...it.invalidate);
          await persist();
          showToast(DROPPED_TEXT);
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
      if (stalled && items.some((x) => x.userId === me)) scheduleRetry();
      else if (!items.length) retryStep = 0;
    }
  },
  /** Empty the queue and forget the account (Contract 2: sign out, delete account, a different account signing in). */
  async clear() {
    items = [];
    aliases.clear();
    inflight.clear();
    user = null;
    cancelRetry();
    clearAuthWait();
    retryStep = 0;
    await persist();
  },
};

/**
 * Perform a write. Online: straight to the server. Offline, or when the server cannot take it right now (the network drops
 * mid-request, a timeout, 408, 425, 429, a 5xx, a session that ran out): queue it and resolve null so the optimistic UI
 * stands. A write that names a provisional id the server has not answered for yet waits in the queue behind that create,
 * online or not. Only a refusal for good is thrown, marked so the app can say the change did not save.
 */
export async function write<T>(rawPath: string, method: OutboxItem['method'], rawJson: unknown, invalidate: ReadonlyArray<readonly unknown[]>, opts: { tmpId?: string } = {}): Promise<T | null> {
  const { tmpId } = opts;
  // one key for this write, whether it goes now or from the queue later (contract 4)
  const key = newKey();
  // a write that still names a provisional id the server has since answered goes out under the real one
  const { path, json } = rewrite({ path: rawPath, json: rawJson });
  if (isOffline() || pendingIn(path, json) || (tmpId !== undefined && tmpBusy(tmpId))) {
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
    const status = statusOf(e);
    if (e instanceof NetworkError || status === 401 || (status !== null && isTransient(status))) {
      // the request may have landed before the connection dropped: the queued copy keeps its key, so it cannot land twice
      await outbox.enqueue({ id: key, path, method, json, invalidate, tmpId, sentAt: new Date().toISOString() });
      // a server that is busy or a weak connection: try again shortly (a 401 waits for sign-in instead)
      if (status !== 401 && !replaying) scheduleRetry();
      return null;
    }
    if (e && typeof e === 'object') (e as { [REJECTED]?: boolean })[REJECTED] = true;
    throw e;
  }
}
