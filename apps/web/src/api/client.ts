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
/** Contract 4: a write sent with this header lands once, however many times it is sent (the outbox's replays). */
export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

export async function api<T>(path: string, init: RequestInit & { json?: unknown; idempotencyKey?: string } = {}): Promise<T> {
  const { json, idempotencyKey, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (json !== undefined) headers.set('content-type', 'application/json');
  if (!headers.has(LOCAL_DATE_HEADER)) headers.set(LOCAL_DATE_HEADER, today());
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
