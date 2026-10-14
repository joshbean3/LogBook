import { today } from '@logbook/shared';
import { useEffect, useState } from 'react';

const PREFIX = 'logbook.seen.';
const storageKey = (key: string, date: string) => `${PREFIX}${key}.${date}`;

const seen = (k: string) => {
  try {
    return localStorage.getItem(k) === '1';
  } catch {
    return true; // no storage: stay still rather than replay every time
  }
};

/** Mark `key` as seen today (what `useFirstToday` does on mount). */
export const markSeenToday = (key: string) => {
  try {
    localStorage.setItem(storageKey(key, today()), '1');
  } catch {
    /* private mode */
  }
};
/** Forget today's "seen" marks (all of them, or one key): the gallery's "replay" button. */
export const resetSeenToday = (key?: string) => {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX) && (!key || k.startsWith(`${PREFIX}${key}.`))) localStorage.removeItem(k);
  } catch {
    /* private mode */
  }
};
/* old days' marks go, so the store holds at most one day of them */
const prune = (date: string) => {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX) && !k.endsWith(`.${date}`)) localStorage.removeItem(k);
  } catch {
    /* private mode */
  }
};

/**
 * True on the first mount of the day for `key`, false on every later mount that day (localStorage
 * `logbook.seen.<key>.<date>`). The answer is fixed for the life of the component, so the route draws and the ring fills
 * once a day and a tab return is still. Pass a key per object when each has its own moment (`route-<sessionId>`).
 * Pass `null` to opt out (always false).
 */
export const useFirstToday = (key: string | null): boolean => {
  const [first] = useState(() => (key ? !seen(storageKey(key, today())) : false));
  useEffect(() => {
    if (!key) return;
    const d = today();
    prune(d);
    markSeenToday(key);
  }, [key]);
  return first;
};
