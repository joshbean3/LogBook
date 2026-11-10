import type { QueryClient } from '@tanstack/react-query';
import { clear as idbClear } from 'idb-keyval';
import { outbox } from '@/api/outbox';
import { HEALTH_BUILT } from './features';
import { Health } from './health';
import { isNative } from './native';

/**
 * What an account keeps on this device, and the one place it is wiped (Contract 2).
 *
 * Everything a feature stores here (localStorage, sessionStorage, idb-keyval) uses a key that starts with `logbook.`. On
 * Sign out, on Delete account and when a different account signs in, the shell calls `clearLocalAccount`: it empties the
 * outbox, the query cache and idb-keyval, removes every `logbook.` key except the "this device has had an account" flag,
 * cancels the goal reminders, disconnects Apple Health on this phone, and reloads the page so nothing kept in memory
 * (open chats, drafts, stores) outlives the account. Features do not write their own sign-out code.
 */
const PREFIX = 'logbook.';
/** Kept across the wipe: it only says that someone has signed in on this device before (features/auth/flag.ts). */
const KEEP: ReadonlySet<string> = new Set(['logbook.hasAccount']);
/** The id of the account that last opened the app here, so a different one signing in is noticed. */
export const LAST_USER_KEY = 'logbook.user';
/** Set just before the reload; the next page finishes the wipe if it finds it (something may write while the page unloads). */
const WIPE_MARK = 'logbook-wipe';
/** Goal reminders are local notifications 7000 to 7006 (features/goals/reminders.ts). */
const REMINDER_IDS = [7000, 7001, 7002, 7003, 7004, 7005, 7006];

const store = (which: 'local' | 'session'): Storage | null => {
  try {
    return which === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
};

export const lastUserId = (): string | null => {
  try {
    return store('local')?.getItem(LAST_USER_KEY) ?? null;
  } catch {
    return null;
  }
};
/** The account that has the app open. Stamps what it queues offline, and is how the next sign-in is compared. */
export const rememberUser = (id: string) => {
  outbox.setUser(id);
  try {
    store('local')?.setItem(LAST_USER_KEY, id);
  } catch {
    /* private mode: a different account is then noticed by the server's answers only */
  }
};
/** True when the app last ran here for a different account than `id`: what is on the device is not theirs. */
export const isOtherAccount = (id: string): boolean => {
  const last = lastUserId();
  return last !== null && last !== id;
};

/** Remove every `logbook.` key from both storages, except the kept flag. */
export const sweepStorage = () => {
  for (const which of ['local', 'session'] as const) {
    const s = store(which);
    if (!s) continue;
    try {
      const doomed: string[] = [];
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i);
        if (k && k.startsWith(PREFIX) && !KEEP.has(k)) doomed.push(k);
      }
      for (const k of doomed) s.removeItem(k);
    } catch {
      /* storage refused: nothing more to do here */
    }
  }
};

/** A step that must not hold up the rest: it gets `ms`, and a failure is swallowed. */
const step = async (fn: () => Promise<unknown> | unknown, ms = 2500) => {
  try {
    await Promise.race([Promise.resolve().then(fn), new Promise((r) => setTimeout(r, ms))]);
  } catch {
    /* this part could not be cleared; the others still are */
  }
};

const cancelReminders = async () => {
  if (!isNative) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  await LocalNotifications.cancel({ notifications: REMINDER_IDS.map((id) => ({ id })) });
};
/** Stops the phone reading Apple Health for the account that left: queue, anchors and the device token go. */
const disconnectHealth = async () => {
  if (!HEALTH_BUILT || !Health) return;
  await Health.disconnect();
};

let wiping: Promise<void> | null = null;
/** True from the moment a wipe starts until the page reloads: the shell draws nothing of the old account meanwhile. */
export const isLeaving = () => wiping !== null;

/**
 * Wipe this device's copy of the account, then load `to` afresh. Safe to call twice (the second call joins the first).
 * `reload` is replaced in tests.
 */
export const clearLocalAccount = (qc: QueryClient | null, opts: { to?: string; reload?: (to: string) => void } = {}): Promise<void> => {
  if (wiping) return wiping;
  const to = opts.to ?? '/';
  const reload = opts.reload ?? ((path: string) => window.location.replace(path));
  wiping = (async () => {
    // what was waiting to be sent, first: nothing of this account may go out under the next one
    await step(() => outbox.clear());
    await Promise.all([step(cancelReminders), step(disconnectHealth)]);
    await step(() => {
      qc?.cancelQueries();
      qc?.clear();
    });
    // idb-keyval: the persisted query cache, the outbox, and anything a feature kept (drafts)
    await step(() => idbClear());
    sweepStorage();
    try {
      store('session')?.setItem(WIPE_MARK, '1');
    } catch {
      /* no session storage: the sweep above is all there is */
    }
    reload(to);
  })();
  return wiping;
};

/**
 * The second half of a wipe, on the page that loads after it: anything written while the old page was unloading (a draft's
 * debounce, a store saving on its way out) goes too. Resolves at once when there is nothing to finish. The persisted cache
 * and the outbox wait for it before they read (main.tsx).
 */
export const wipeFinished: Promise<void> = (async () => {
  let marked = false;
  try {
    marked = typeof window !== 'undefined' && store('session')?.getItem(WIPE_MARK) === '1';
  } catch {
    marked = false;
  }
  if (!marked) return;
  sweepStorage();
  await step(() => idbClear());
  try {
    store('session')?.removeItem(WIPE_MARK);
  } catch {
    /* gone with the tab */
  }
})();

/** Test hook: forget that a wipe ran (a test "reloads" by calling this). */
export const resetWipeForTest = () => {
  wiping = null;
};
