/** Thin fetch wrapper. Cookies carry the session; errors come back typed. */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string | null = null,
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

/** How long a request may go without an answer before it counts as a network failure. Long enough for the slowest route (a plan draft runs 20 to 60 seconds). */
export const DEFAULT_TIMEOUT_MS = 150_000;

export async function api<T>(path: string, init: RequestInit & { json?: unknown; idempotencyKey?: string; /** This call's own timeout, in ms (default DEFAULT_TIMEOUT_MS). */ timeoutMs?: number } = {}): Promise<T> {
  const { json, idempotencyKey, timeoutMs, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (json !== undefined) headers.set('content-type', 'application/json');
  if (!headers.has(LOCAL_DATE_HEADER)) headers.set(LOCAL_DATE_HEADER, today());
  if (idempotencyKey) headers.set(IDEMPOTENCY_HEADER, idempotencyKey);
  let res: Response;
  // in the browser a call that names its own timeout is aborted when it runs out (the native path has its own, below)
  const abort = !isNative && timeoutMs ? new AbortController() : null;
  const timer = abort ? setTimeout(() => abort.abort(), timeoutMs) : undefined;
  try {
    const body = json !== undefined ? JSON.stringify(json) : rest.body;
    res = isNative ? await nativeFetch(BASE + path, rest.method ?? 'GET', headers, body, timeoutMs) : await fetch(BASE + path, { ...rest, credentials: 'same-origin', headers, body, signal: abort?.signal ?? rest.signal });
  } catch {
    throw new NetworkError();
  } finally {
    clearTimeout(timer);
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
    throw new ApiError(msg, res.status, code);
  }
  if (leavesAccount((rest.method ?? 'GET').toUpperCase(), path.split('?')[0]!)) for (const fn of onSignedOut) fn();
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * (The default timeout matches the server's: an ask that reads a long PDF and proposes changes can run past a minute.)
 *
 * In the iPhone app every request goes through Capacitor's native HTTP plugin, called directly: the request leaves from
 * the device with the native cookie jar (the sign-in sticks) and no CORS, whatever the generated capacitor.config.json
 * says. (The plugin's own `fetch` patch depends on that file answering "enabled" at page load; when it does not, requests
 * leave the WebView from capacitor://localhost and the server refuses them, which read as "Couldn't connect".)
 *
 * One timeout, not two: on iOS the plugin uses a single idle timeout for the whole request and takes `connectTimeout` for
 * it when both are given, so a short connect timeout used to cut every slow answer at 20 seconds. Both are set to the same
 * value here, the call's own `timeoutMs` or the default.
 */
export const nativeFetch = async (url: string, method: string, headers: Headers, body: RequestInit['body'], timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<Response> => {
  const h: Record<string, string> = {};
  headers.forEach((v, k) => {
    h[k] = v;
  });
  const r = await CapacitorHttp.request({ url, method, headers: h, data: typeof body === 'string' ? body : undefined, responseType: 'text', connectTimeout: timeoutMs, readTimeout: timeoutMs });
  const text = typeof r.data === 'string' ? r.data : r.data == null ? '' : JSON.stringify(r.data);
  return new Response(r.status === 204 ? null : text, { status: r.status, headers: r.headers as Record<string, string> });
};

export const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;
