import type { Query } from '@tanstack/react-query';

/**
 * What is kept on the device for the next open: every query that holds data, whatever its last fetch did. A refetch that
 * failed (offline, a server error, an answer in a bad shape) leaves the last good copy in place, here as in memory, so the
 * next open still has something to draw. Never: the two sign-in probes; anything from Apple Health or about it (keys that
 * start with "health" or "apple-health": health data stays off the device's cache, and that rule holds when the server's
 * health data is shown, gap-leg-50); a journal search (perf-21).
 */
export const keepOnDevice = (q: Pick<Query, 'queryKey' | 'state'>) => {
  if (q.state.data === undefined) return false;
  const head = String(q.queryKey[0]);
  if (head === 'auth-status' || head === 'auth-session') return false;
  if (/^(apple-)?health/.test(head)) return false;
  if (head === 'journal' && typeof q.queryKey[1] === 'string' && q.queryKey[1].trim() !== '') return false;
  return true;
};
