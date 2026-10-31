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

import { today } from '@logbook/shared';
import { apiOrigin, isNative } from '@/lib/native';

const BASE = `${apiOrigin}/api`;

/**
 * Every request says what day it is here (`X-Local-Date`), so the server files "today" defaults (a habit's start, a to-do
 * moved to Later, a plan rebuild's window, the daily pick) on the athlete's day even when the server's clock is a day
 * behind (docs/platform.md §12).
 */
export const LOCAL_DATE_HEADER = 'X-Local-Date';
/** Beside the date, the device's IANA time zone: the server keeps it on the account for reminders and the assistant. */
export const TIMEZONE_HEADER = 'X-Timezone';
export const localTimeZone = (): string | null => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
};
/** Contract 4: a write sent with this header lands once, however many times it is sent (the outbox's replays). */
export const IDEMPOTENCY_HEADER = 'Idempotency-Key';
/**
 * On every request: the server's second lock against cross-site requests (a form on another site cannot add a custom
 * header). It also covers the native app, whose Origin is `capacitor://localhost`.
 */
export const REQUESTED_WITH_HEADER = 'X-Requested-With';
export const REQUESTED_WITH_VALUE = 'logbook';

export async function api<T>(path: string, init: RequestInit & { json?: unknown; idempotencyKey?: string } = {}): Promise<T> {
  const { json, idempotencyKey, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set(REQUESTED_WITH_HEADER, REQUESTED_WITH_VALUE);
  if (json !== undefined) headers.set('content-type', 'application/json');
  if (!headers.has(LOCAL_DATE_HEADER)) headers.set(LOCAL_DATE_HEADER, today());
  const tz = localTimeZone();
  if (tz && !headers.has(TIMEZONE_HEADER)) headers.set(TIMEZONE_HEADER, tz);
  if (idempotencyKey) headers.set(IDEMPOTENCY_HEADER, idempotencyKey);
  let res: Response;
  try {
    res = await fetch(BASE + path, { ...rest, credentials: isNative ? 'include' : 'same-origin', headers, body: json !== undefined ? JSON.stringify(json) : rest.body });
  } catch {
    throw new NetworkError();
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
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/**
 * A streamed POST (server-sent events): `onEvent` gets each `event` with its parsed `data` as it arrives. Resolves when
 * the stream ends. The same cookies, date and time zone headers as `api`.
 */
export async function apiStream(path: string, json: unknown, onEvent: (event: string, data: unknown) => void): Promise<void> {
  const headers = new Headers({ 'content-type': 'application/json', accept: 'text/event-stream', [LOCAL_DATE_HEADER]: today(), [REQUESTED_WITH_HEADER]: REQUESTED_WITH_VALUE });
  const tz = localTimeZone();
  if (tz) headers.set(TIMEZONE_HEADER, tz);
  let res: Response;
  try {
    res = await fetch(BASE + path, { method: 'POST', credentials: isNative ? 'include' : 'same-origin', headers, body: JSON.stringify(json) });
  } catch {
    throw new NetworkError();
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
  // a server that answered plain JSON (no stream): one `done`
  if (!/text\/event-stream/.test(res.headers.get('content-type') ?? '') || !res.body) {
    onEvent('done', await res.json());
    return;
  }
  const { parseSSE } = await import('./sse');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const { events, rest } = parseSSE(buffer, done);
    buffer = rest;
    for (const e of events) onEvent(e.event, e.data);
    if (done) break;
  }
}
