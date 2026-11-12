import { onPrefsChange, seedPrefs, type Prefs } from '@/lib/prefs';
import { api } from './client';

/**
 * The account's copy of the preferences (lib/prefs.ts), as a progressive extra. The device copy is the one the app reads,
 * so everything works against a server that has never heard of `PUT /me/prefs`.
 *
 * - A change made on this device is sent, the whole record, newest last. Any failure is dropped without a word: a server
 *   without the route answers 404, 405 or 501, a phone can be offline, and in each case the device copy stands. Nothing is
 *   queued: the next change sends the whole record again.
 * - The bootstrap's `prefs` (absent on an older server, null before one is saved) seeds a device that has no copy of its
 *   own: a reinstall or a second phone starts from the same choices. A choice made here is never overridden.
 */
let started = false;
let latest = 0;
const send = (p: Prefs) => {
  const mine = ++latest;
  // a quick second change: only the newest record goes
  queueMicrotask(() => {
    if (mine !== latest) return;
    void api('/me/prefs', { method: 'PUT', json: p }).catch(() => undefined);
  });
};
/** Call once the account is known (the first bootstrap): seeds from the account, then keeps it told. */
export const syncPrefs = (account: unknown) => {
  seedPrefs(account);
  if (started) return;
  started = true;
  onPrefsChange(send);
};
