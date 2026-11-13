/** Thin fetch wrapper. Cookies carry the session; errors come back typed. */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string | null = null,
    /** Seconds the server asked us to wait (a 429 or 503 with Retry-After), or null. */
    public retryAfter: number | null = null,
  ) {
    super(message);
  }
}
export class NetworkError extends Error {
  constructor() {
    super('You’re offline. This will sync when you’re back.');
  }
}

export const onUnauthorized = new Set<() => void>();
/**
 * The account left this device by choice: Sign out or Delete account was answered with a yes by the server. The shell
 * listens and wipes what the account kept here (lib/account.ts, Contract 2). A session that merely ran out (a 401) is not
 * this: what was written offline waits for the same person to sign back in.
 */
export const onSignedOut = new Set<() => void>();
const leavesAccount = (method: string, path: string) => (method === 'POST' && path === '/auth/logout') || (method === 'DELETE' && path === '/me');
/**
 * Run just before Sign out is sent, while the session can still carry a request: a store that keeps a copy on the account
 * sends its last change here (Orbs, features/orbs/sync.ts). Each gets `SIGN_OUT_WAIT_MS` at most and a failure is
 * swallowed, so nothing here can hold Sign out up or stop it.
 */
export const beforeSignOut = new Set<() => Promise<unknown> | unknown>();
export const SIGN_OUT_WAIT_MS = 2500;
const lastWords = async () => {
  if (!beforeSignOut.size) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    Promise.allSettled([...beforeSignOut].map((f) => Promise.resolve().then(f))),
    new Promise((r) => (timer = setTimeout(r, SIGN_OUT_WAIT_MS))),
  ]);
  clearTimeout(timer);
};

import { CapacitorHttp } from '@capacitor/core';
import { today } from '@logbook/shared';
import { apiOrigin, isNative } from '@/lib/native';

const BASE = `${apiOrigin}/api`;

/**
 * Every request says what day it is here (`X-Local-Date`), so the server files "today" defaults (a habit's start, a to-do
 * moved to Later, a plan rebuild's window, the daily pick) on the athlete's day even when the server's clock is a day
 * behind (docs/platform.md §12).
 */
export const LOCAL_DATE_HEADER = 'X-Local-Date';
/** Contract 4: a write sent with this header lands once, however many times it is sent (the outbox's replays). */
export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

/** How long an ordinary request may go without an answer before it counts as a network failure (shell-14). */
export const DEFAULT_TIMEOUT_MS = 20_000;
/**
 * For a call that waits on the assistant (a plan draft runs 20 to 60 seconds; an ask that reads a long PDF can pass a
 * minute): pass `timeoutMs: LONG_TIMEOUT_MS`. It matches the server's own limit.
 */
export const LONG_TIMEOUT_MS = 150_000;

/** Retry-After in seconds (a number of seconds or an HTTP date), or null. */
export const retryAfterOf = (v: string | null | undefined, now = Date.now()): number | null => {
  if (!v) return null;
  const n = Number(v);
  if (Number.isFinite(n)) return Math.max(0, n);
  const at = Date.parse(v);
  return Number.isNaN(at) ? null : Math.max(0, Math.round((at - now) / 1000));
};

/**
 * Whether a read that failed is worth trying again (perf-23): only when no answer came (offline, a timeout) or a gateway
 * said the server is briefly away (502, 503, 504), and at most twice. Anything else the server said, a 4xx or a 500, is
 * its answer: the screen shows it at once.
 */
export const shouldRetryRead = (failures: number, e: unknown): boolean => {
  if (failures >= 2) return false;
  if (e instanceof NetworkError) return true;
  if (e instanceof ApiError) return e.status === 502 || e.status === 503 || e.status === 504;
  return false;
};

export async function api<T>(path: string, init: RequestInit & { json?: unknown; idempotencyKey?: string; /** This call's own timeout, in ms (default DEFAULT_TIMEOUT_MS). */ timeoutMs?: number } = {}): Promise<T> {
  const { json, idempotencyKey, timeoutMs, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (json !== undefined) headers.set('content-type', 'application/json');
  if (!headers.has(LOCAL_DATE_HEADER)) headers.set(LOCAL_DATE_HEADER, today());
  if (idempotencyKey) headers.set(IDEMPOTENCY_HEADER, idempotencyKey);
  if ((rest.method ?? 'GET').toUpperCase() === 'POST' && path.split('?')[0] === '/auth/logout') await lastWords();
  let res: Response;
  const limit = timeoutMs ?? DEFAULT_TIMEOUT_MS;
  // in the browser the call is aborted when its time runs out, or when the caller's own signal fires (the native path
  // has its own timeout, below)
  const abort = isNative ? null : new AbortController();
  const timer = abort ? setTimeout(() => abort.abort(), limit) : undefined;
  const outer = rest.signal;
  const forward = () => abort?.abort();
  if (outer) {
    if (outer.aborted) forward();
    else outer.addEventListener('abort', forward, { once: true });
  }
  try {
    const body = json !== undefined ? JSON.stringify(json) : rest.body;
    res = isNative ? await nativeFetch(BASE + path, rest.method ?? 'GET', headers, body, limit) : await fetch(BASE + path, { ...rest, credentials: 'same-origin', headers, body, signal: abort?.signal });
  } catch {
    throw new NetworkError();
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', forward);
  }
  if (res.status === 401) {
    for (const fn of onUnauthorized) fn();
    throw new ApiError('Sign in to continue', 401, 'unauthenticated');
  }
  if (!res.ok) {
    let msg = res.statusText || 'Request failed';
    let code: string | null = null;
    try {
      const body = (await res.json()) as { error?: string; code?: string | null };
      if (body.error) msg = body.error;
      code = body.code ?? null;
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(msg, res.status, code, retryAfterOf(res.headers.get('retry-after')));
  }
  if (leavesAccount((rest.method ?? 'GET').toUpperCase(), path.split('?')[0]!)) for (const fn of onSignedOut) fn();
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * In the iPhone app every request goes through Capacitor's native HTTP plugin, called directly: the request leaves from
 * the device with the native cookie jar (the sign-in sticks) and no CORS, whatever the generated capacitor.config.json
 * says. (The plugin's own `fetch` patch depends on that file answering "enabled" at page load; when it does not, requests
 * leave the WebView from capacitor://localhost and the server refuses them, which read as "Couldn't connect".)
 *
 * One timeout, not two: on iOS the plugin uses a single idle timeout for the whole request and takes `connectTimeout` for
 * it when both are given, so a short connect timeout used to cut every slow answer at 20 seconds. Both are set to the same
 * value here. `api()` passes the call's own `timeoutMs` or DEFAULT_TIMEOUT_MS; a direct caller (the plan draft) gets the
 * long one unless it names its own.
 *
 * A FormData body (a photo or a PDF with fields) goes as multipart: each file is read to base64 and the plugin builds the
 * parts and the boundary, so no content-type is sent from here (plan-17).
 */
export const nativeFetch = async (url: string, method: string, headers: Headers, body: RequestInit['body'], timeoutMs: number = LONG_TIMEOUT_MS): Promise<Response> => {
  const h: Record<string, string> = {};
  headers.forEach((v, k) => {
    h[k] = v;
  });
  let data: unknown;
  let dataType: 'formData' | undefined;
  if (typeof body === 'string') data = body;
  else if (typeof FormData !== 'undefined' && body instanceof FormData) {
    data = await formDataEntries(body);
    dataType = 'formData';
    for (const k of Object.keys(h)) if (k.toLowerCase() === 'content-type') delete h[k];
  }
  const r = await CapacitorHttp.request({ url, method, headers: h, data, ...(dataType ? { dataType } : {}), responseType: 'text', connectTimeout: timeoutMs, readTimeout: timeoutMs });
  const text = typeof r.data === 'string' ? r.data : r.data == null ? '' : JSON.stringify(r.data);
  return new Response(r.status === 204 ? null : text, { status: r.status, headers: r.headers as Record<string, string> });
};

/** The shape Capacitor's HTTP plugin takes for a multipart body: strings as they are, files as base64 with their name and type. */
export interface NativeFormEntry {
  key: string;
  value: string;
  type: 'string' | 'base64File';
  contentType?: string;
  fileName?: string;
}
const base64Of = async (blob: Blob): Promise<string> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
export const formDataEntries = async (fd: FormData): Promise<NativeFormEntry[]> => {
  const out: NativeFormEntry[] = [];
  for (const [key, value] of fd.entries()) {
    if (typeof value === 'string') out.push({ key, value, type: 'string' });
    else out.push({ key, value: await base64Of(value), type: 'base64File', contentType: value.type || 'application/octet-stream', fileName: (value as File).name || 'file' });
  }
  return out;
};

export const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;
