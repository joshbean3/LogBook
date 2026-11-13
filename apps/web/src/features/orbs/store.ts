import { adoptSet, applySet, compact, countOf, DEFAULT_SET, levelOf, markSeen as markSeenIn, mergeRewards, newKeys as newKeysOf, orbsOn, parseRewards, pendingMoments as pendingMomentsOf, tidy, today as clockToday, totalOf, type Challenge, type Count, type ISODate, type Level, type Moment, type RewardSet, type Rewards } from '@logbook/shared';
import { useSyncExternalStore } from 'react';
import { isLeaving, lastUserId } from '@/lib/account';
import { useToday } from '@/lib/useToday';

/**
 * Orbs on this phone: the stored object (`Rewards`, packages/shared/src/rewards.ts) held in memory, read by React through
 * selectors that return primitives (or one remembered object), and kept under one `logbook.` key.
 *
 * - **Whose it is.** The store carries the account's id. It is read from storage only for the account the bootstrap names
 *   (`openOrbs`), and anything else found under the key is nothing (`parseRewards`). Sign-out and a different account
 *   signing in wipe every `logbook.` key (lib/account.ts), this one included.
 * - **When it is written.** Never in a tap: a change marks the store as unsaved and it is written when the browser is
 *   idle, and at once when the page is hidden or left.
 * - **The switches** (Orbs on, show Orbs, the week target, the challenges' cadence and size) have their own device key,
 *   never `prefs`, so they stand whatever the store does. They also travel inside the store (`set`), and the newest
 *   change wins when the account's copy comes back from the server.
 *
 * Nothing here draws anything. The reconciler (engine.ts) is what changes the store as the day's facts change.
 */
export const ORBS_KEY = 'logbook.orbs';
export const ORBS_SET_KEY = 'logbook.orbs.set';
/** Fired on `window` when Orbs were gained: `detail` is `OrbsGained`. The reward animation and the counter listen. */
export const ORBS_EVENT = 'logbook:orbs-gained';
export interface OrbsGained {
  /** What was gained: a day's kind (`todo`, `habit`, `train:run`, `goal:day`, `full`, `back`) with the day it belongs to, or a once-key (`goal:week:<monday>`, `week:<monday>`, `challenge:d:<date>`) with the day it was paid. */
  gained: Array<{ key: string; n: number; date: string }>;
  /** Every Orb ever earned, after this gain. */
  total: number;
  /** Today's Orbs, after this gain. */
  today: number;
}

// ---------- the switches: their own device key ----------
const zSetOf = (raw: string | null): RewardSet | null => {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<RewardSet> | null;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    return {
      on: v.on !== false,
      show: v.show !== false,
      weekTarget: v.weekTarget === 3 || v.weekTarget === 4 ? v.weekTarget : 5,
      cadence: v.cadence === 0 || v.cadence === 2 ? v.cadence : 1,
      size: v.size === 'gentle' || v.size === 'bold' ? v.size : 'steady',
      at: typeof v.at === 'string' ? v.at.slice(0, 32) : '',
    };
  } catch {
    return null;
  }
};
const readSet = (): RewardSet | null => {
  try {
    return zSetOf(localStorage.getItem(ORBS_SET_KEY));
  } catch {
    return null;
  }
};
const writeSet = (s: RewardSet) => {
  try {
    localStorage.setItem(ORBS_SET_KEY, JSON.stringify(s));
  } catch {
    /* private mode: lasts for the session */
  }
};

let store: Rewards | null = null;
let owner: string | null = null;
let storedSet = readSet();
let switches: RewardSet = storedSet ?? DEFAULT_SET;
let unsaved = false;
const subs = new Set<() => void>();
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};
const emit = () => {
  for (const f of subs) f();
};
/** Outside React: called after every change to the store or the switches (the sync and the engine listen). */
export const onOrbsChange = subscribe;

// ---------- saving: on idle, and when the page is hidden ----------
let idle: number | ReturnType<typeof setTimeout> | 0 = 0;
/** Write the store now, if it has changed since it was last written. Compacted on the way (old days lose their detail). */
export const persistOrbs = () => {
  if (!unsaved || !store || isLeaving()) return;
  // what this device kept was swept (the error screen's Reset) and the page is on its way out: nothing is put back
  if (lastUserId() !== owner) return;
  unsaved = false;
  store = compact(store, store.clock);
  try {
    localStorage.setItem(ORBS_KEY, JSON.stringify(store));
  } catch {
    /* storage refused: the store lives in memory, and is rebuilt from the account's facts if it is lost */
  }
};
const saveSoon = () => {
  unsaved = true;
  if (idle || typeof window === 'undefined') return;
  const run = () => {
    idle = 0;
    persistOrbs();
  };
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  idle = ric ? ric(run, { timeout: 2000 }) : setTimeout(run, 600);
};
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) persistOrbs();
  });
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('pagehide', persistOrbs);
    // another tab of the same browser saved its copy: this one takes it in by the same merge the server uses
    window.addEventListener('storage', (e: StorageEvent) => {
      if (e.key !== ORBS_KEY || !owner || !store) return;
      const theirs = parseRewards(e.newValue, owner);
      if (!theirs) return;
      const next = tidy(mergeRewards(store, theirs));
      if (JSON.stringify(next) === JSON.stringify(store)) return;
      store = next;
      emit();
    });
  }
}

// ---------- the store ----------
export const getOrbs = (): Rewards | null => store;
export const getSwitches = (): RewardSet => switches;
/** Has this device switches of its own (its key holds some)? Until it has, the account's copy may set them. */
export const hasOwnSwitches = (): boolean => storedSet !== null;
/** The account the store in memory belongs to. */
export const orbsOwner = (): string | null => owner;

/**
 * Start (or restart) for an account: what storage holds is read as untrusted, and only when it is this account's. Returns
 * the store, or null when this device has none for the account (the engine then takes the server's copy or rebuilds).
 */
export const openOrbs = (userId: string): Rewards | null => {
  if (owner === userId) return store;
  owner = userId;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(ORBS_KEY);
  } catch {
    raw = null;
  }
  store = parseRewards(raw, userId);
  unsaved = false;
  if (store) {
    // the newer of the two stands (they differ only when one was written and the other was not); a device with no
    // switches of its own takes the store's
    if (storedSet && storedSet.at >= store.set.at) store = adoptSet(store, switches, new Date());
    else switches = store.set;
  }
  emit();
  return store;
};

/** Replace the store (the engine: after a reconcile, a merge or a rebuild). A store for another account is refused. */
export const setOrbs = (next: Rewards) => {
  if (next === store || !owner || next.userId !== owner) return;
  store = next;
  // the newest switches win: a change made on another phone arrives inside the merged store
  if (next.set.at > switches.at) {
    switches = next.set;
    storedSet = switches;
    writeSet(switches);
  }
  saveSoon();
  emit();
};
/** Apply a pure change from the shared rules (`addChallenge`, `skipChallenge`, `offerInto`, …). Nothing happens without a store. */
export const updateOrbs = (fn: (s: Rewards) => Rewards) => {
  if (store) setOrbs(fn(store));
};

/** Change the switches. They are written to their own key at once (a switch is a tap on a settings row, not a completion). */
export const setSwitches = (patch: Partial<Omit<RewardSet, 'at'>>) => {
  const now = new Date();
  const next: RewardSet = { ...switches, ...patch, at: now.toISOString() };
  if (next.on === switches.on && next.show === switches.show && next.weekTarget === switches.weekTarget && next.cadence === switches.cadence && next.size === switches.size) return;
  switches = next;
  storedSet = next;
  writeSet(next);
  if (store) {
    store = adoptSet(applySet(store, patch, now), next, now);
    saveSoon();
  }
  emit();
};

/** Mark a keepsake or a goal's moment seen: it stops being a "New" row and leaves the queue of big moments. */
export const markSeen = (key: string) => updateOrbs((s) => markSeenIn(s, key, clockToday()));
/** The big moments waiting to be shown full screen, oldest first: at most two in any seven days (the rest stay "New" rows). */
export const pendingMoments = (): Moment[] => (store && switches.on ? pendingMomentsOf(store, clockToday()) : []);
/** Everything earned and not yet seen, newest first: the "New" rows of the Orbs page. */
export const newKeys = (): string[] => (store && switches.on ? newKeysOf(store) : []);

// ---------- selectors: each returns a primitive, or one object remembered per store ----------
const useSelect = <T>(get: () => T): T => useSyncExternalStore(subscribe, get, get);
const live = (): Rewards | null => (switches.on ? store : null);

/** The "Orbs" switch. Off: everything about Orbs is hidden and the count is paused. */
export const useOrbsOn = (): boolean => useSelect(() => switches.on);
/** "Show Orbs when you earn them": false also while Orbs are off. With it off nothing pops and the count still grows. */
export const useShowOrbs = (): boolean => useSelect(() => switches.on && switches.show);
/** The person's week: 5, 4 or 3 days. */
export const useWeekTarget = (): 3 | 4 | 5 => useSelect(() => switches.weekTarget);
/** Challenges: 0 Off, 1 One a week, 2 Two a week. */
export const useChallengeCadence = (): 0 | 1 | 2 => useSelect(() => switches.cadence);
export const useChallengeSize = (): RewardSet['size'] => useSelect(() => switches.size);
/** Orbs earned on `date` (0 when none, or while Orbs are off). */
export const useOrbsOnDay = (date: ISODate): number => useSelect(() => (live() ? orbsOn(live()!, date) : 0));
/** Today's Orbs, for the numeral by Today's sun. Inside Today's held day (past midnight) it is that day's. Never show a 0. */
export const useOrbsToday = (): number => useOrbsOnDay(useToday());
/** Every Orb ever earned. */
export const useOrbsTotal = (): number => useSelect(() => (live() ? totalOf(live()!) : 0));
/** The level, a number from 1. */
export const useLevel = (): number => useSelect(() => levelOf(live() ? totalOf(live()!) : 0).level);
const levels = new Map<number, Level>();
/** The level with its thresholds (`left` is "216 to level 6"). The same object comes back while the total stands. */
export const useLevelInfo = (): Level =>
  useSelect(() => {
    const total = live() ? totalOf(live()!) : 0;
    let l = levels.get(total);
    if (!l) {
      levels.clear();
      levels.set(total, (l = levelOf(total)));
    }
    return l;
  });
const NO_MARKS = '0000000';
/**
 * This week's seven marks, Monday first, as seven characters: `1` a day that counts, `0` any other (a day off, a miss and a
 * paused day look the same). A string, so a render that changes nothing is skipped.
 */
export const useWeekMarks = (): string => {
  const t = useToday();
  return useSelect(() => (live() ? countOf(live()!, t).marks.map((m) => (m ? '1' : '0')).join('') : NO_MARKS));
};
const EMPTY: Count = { days: 0, marks: [false, false, false, false, false, false, false], today: 0, thisWeek: 0, weeks: 0, target: 5, need: 5, daysOff: 2, offLeft: 2, kept: false };
/**
 * The count: days in all, this week, weeks in a row, the target and the days off in hand (`Count`). One object per store
 * and day, so its identity changes only when the store does.
 */
export const useCount = (): Count => {
  const t = useToday();
  return useSelect(() => (live() ? countOf(live()!, t) : EMPTY));
};
/** Days in all. */
export const useDaysInAll = (): number => {
  const t = useToday();
  return useSelect(() => (live() ? countOf(live()!, t).days : 0));
};
/** Weeks in a row. Said only when it is 2 or more. */
export const useWeeksInRow = (): number => {
  const t = useToday();
  return useSelect(() => (live() ? countOf(live()!, t).weeks : 0));
};
/** The whole stored object, for the Orbs page (keepsakes, the day's lines, chapters): null while Orbs are off or not ready. */
export const useOrbsStore = (): Rewards | null => useSelect(live);
/** One challenge by its slot key (`challenge:d:<date>`, `challenge:w:<monday>`), or undefined. The same object while it stands. */
export const useChallenge = (key: string): Challenge | undefined => useSelect(() => live()?.challenges[key]);
/** How many rows are "New". */
export const useNewCount = (): number => useSelect(() => (live() ? newKeysOf(live()!).length : 0));

/** Tests only: forget everything in memory (storage is left as it is, as a reload would). */
export const resetOrbsForTest = () => {
  store = null;
  owner = null;
  storedSet = readSet();
  switches = storedSet ?? DEFAULT_SET;
  unsaved = false;
  if (idle) clearTimeout(idle as ReturnType<typeof setTimeout>);
  idle = 0;
  subs.clear();
};
