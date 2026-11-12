import { getPrefs, onPrefsChange, seedPrefs, type Prefs } from '@/lib/prefs';
import { api } from './client';

/**
 * The account's copy of the preferences (lib/prefs.ts), as a progressive extra. The device copy is the one the app reads,
 * so everything works against a server that has never heard of `PUT /me/prefs`.
 *
 * - A change made on this device is sent, the whole record, newest last. Any failure is dropped without a word: a server
 *   without the route answers 404, 405 or 501, a phone can be offline, and in each case the device copy stands.
 * - A change that did not get through is remembered (`logbook.prefs.unsent`, wiped with the account on sign-out) and
 *   sent once more the next time the app opens against a server that keeps a copy (its bootstrap carries `prefs`): a
 *   choice made offline, or while the server still had no route, reaches the account in the end, so a reinstall or the
 *   next phone starts from it. An older server is never asked on launch.
 * - The bootstrap's `prefs` (absent on an older server, null before one is saved) seeds a device that has no copy of its
 *   own: a reinstall or a second phone starts from the same choices. A choice made here is never overridden, and a device
 *   that merely differs from the account sends nothing: the account holds the last change made anywhere, not the last
 *   phone opened.
 */
export const UNSENT_KEY = 'logbook.prefs.unsent';
let unsentHere = false;
const markUnsent = (on: boolean) => {
  unsentHere = on;
  try {
    if (on) localStorage.setItem(UNSENT_KEY, '1');
    else localStorage.removeItem(UNSENT_KEY);
  } catch {
    /* no storage: remembered for this launch only */
  }
};
const hasUnsent = (): boolean => {
  if (unsentHere) return true;
  try {
    return localStorage.getItem(UNSENT_KEY) === '1';
  } catch {
    return false;
  }
};

let started = false;
let latest = 0;
const send = (p: Prefs) => {
  const mine = ++latest;
  markUnsent(true);
  // a quick second change: only the newest record goes
  queueMicrotask(() => {
    if (mine !== latest) return;
    void api('/me/prefs', { method: 'PUT', json: p }).then(
      () => {
        // a newer change is on its way (or waiting): it clears the mark itself
        if (mine === latest) markUnsent(false);
      },
      () => undefined,
    );
  });
};
/** Call once the account is known (the first bootstrap): seeds from the account, then keeps it told. */
export const syncPrefs = (account: unknown) => {
  seedPrefs(account);
  if (started) return;
  started = true;
  onPrefsChange(send);
  // `undefined`: a server without the route (never asked). Anything else: it keeps a copy, and a change that did not get
  // through last time goes now
  if (account !== undefined && hasUnsent()) send(getPrefs());
};
