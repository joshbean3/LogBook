import { ApiError } from '@/api/client';

/**
 * What a failed write says, in one line. The server's own words only where it wrote them for the person: a refusal (4xx)
 * that carries a code ("That plan is longer than a year"). Anything else is the caller's plain line: a route the server
 * does not have (404, 405: the app can be newer than the server), a server error, a proxy's own page ("Bad Gateway"), a
 * timeout, no connection, or a bug. A sign-in that ran out keeps the app's own line for it.
 */
export const errorWords = (e: unknown, plain: string): string => {
  if (!(e instanceof ApiError)) return plain;
  const refusal = e.status >= 400 && e.status < 500 && e.status !== 404 && e.status !== 405 && !!e.code;
  return refusal && e.message.trim() ? e.message : plain;
};
