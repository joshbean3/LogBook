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

const BASE = '/api';

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (json !== undefined) headers.set('content-type', 'application/json');
  let res: Response;
  try {
    res = await fetch(BASE + path, { ...rest, credentials: 'same-origin', headers, body: json !== undefined ? JSON.stringify(json) : rest.body });
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
