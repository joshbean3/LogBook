import { getPrefs, hasStoredPrefs, normalizePrefs, onPrefsChange, seedPrefs, type Prefs } from '@/lib/prefs';
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
 * - When the device has its own copy and the account's says something else (a change made while offline, or against a
 *   server that had no route yet), the device's copy is sent once, the first time the account is known this launch: the
 *   device still rules, and the next phone starts from what this one shows. Only where the bootstrap carries `prefs` at
 *   all: an older server is never asked.
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
const sameAs = (a: Prefs, b: Prefs) => a.fitness === b.fitness && a.today.habits === b.today.habits && a.today.day === b.today.day && a.today.learned === b.today.learned;
/** Call once the account is known (the first bootstrap): seeds from the account, then keeps it told. */
export const syncPrefs = (account: unknown) => {
  const own = hasStoredPrefs();
  seedPrefs(account);
  if (started) return;
  started = true;
  onPrefsChange(send);
  // `undefined`: a server without the route. `null`: a server with it and nothing saved yet
  if (own && account !== undefined && !(account && typeof account === 'object' && sameAs(normalizePrefs(account), getPrefs()))) send(getPrefs());
};
