import { useSyncExternalStore } from 'react';

/**
 * What a person has switched on: Fitness as a whole, and which sections Today shows. This is the one place that answers
 * "is Fitness on" and "what does Today show": every screen asks here (`useFitness`, `useTodayShows`, or `fitnessOn()`
 * outside React), and nothing else reads the storage key.
 *
 * Kept on this device (localStorage, a `logbook.` key, so sign-out wipes it with the rest: lib/account.ts). That works
 * against any server, old or new. Where the server has `PUT /me/prefs`, a change is also sent there and the account's copy
 * seeds a device that has none of its own (`seedPrefs`); a server without the route answers 404, 405 or 501 and the
 * device copy simply stands (api/prefsSync.ts).
 *
 * Fitness off hides, and deletes nothing: turning it back on shows everything as it was.
 */
export type TodaySection = 'habits' | 'day' | 'learned';
/** The sections of Today a person can switch, in the order Settings lists them. Fitness is not here: it follows the main switch. */
export const TODAY_SECTIONS: readonly { id: TodaySection; title: string; sub: string }[] = [
  { id: 'habits', title: 'Habits', sub: 'The tiles you tap each day' },
  { id: 'day', title: 'Plan your day', sub: 'Today’s goal and to-dos' },
  // the Journal row: tonight's line, then the way to say more (the stored key keeps the name it had as What I learned)
  { id: 'learned', title: 'Journal', sub: 'One line is enough' },
];

export interface Prefs {
  /** The Fitness tab, the training card on Today, the Running and Strength charts, and every other mention of training. */
  fitness: boolean;
  /** Today's sections. A section missing from a stored copy is on. */
  today: Record<TodaySection, boolean>;
}
export const DEFAULT_PREFS: Prefs = { fitness: true, today: { habits: true, day: true, learned: true } };

export const PREFS_KEY = 'logbook.prefs';
/** Fired on every change, for listeners outside React (reminders). */
export const PREFS_EVENT = 'logbook:prefs';

/** Any stored or received value, made whole: unknown keys dropped, anything that is not `false` reads as on. */
export const normalizePrefs = (raw: unknown): Prefs => {
  const r = (raw && typeof raw === 'object' ? raw : {}) as { fitness?: unknown; today?: Record<string, unknown> | null };
  const t = r.today && typeof r.today === 'object' ? r.today : {};
  return { fitness: r.fitness !== false, today: { habits: t.habits !== false, day: t.day !== false, learned: t.learned !== false } };
};

/**
 * What the storage key holds, read as a device copy: a record (an object, not a list) made whole, or null. Nothing, an
 * empty string, text that is not JSON, `null`, a number, a string or a list is no copy at all: the app starts from the
 * defaults (Fitness on, every section showing), and the account's copy may still seed this device.
 */
export const parseStoredPrefs = (raw: string | null | undefined): Prefs | null => {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? normalizePrefs(v) : null;
  } catch {
    return null;
  }
};

const readStored = (): Prefs | null => {
  try {
    return parseStoredPrefs(localStorage.getItem(PREFS_KEY));
  } catch {
    return null;
  }
};

let stored = readStored();
let state: Prefs = stored ?? DEFAULT_PREFS;
const subs = new Set<() => void>();
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};
const same = (a: Prefs, b: Prefs) => a.fitness === b.fitness && a.today.habits === b.today.habits && a.today.day === b.today.day && a.today.learned === b.today.learned;

type Listener = (next: Prefs, prev: Prefs) => void;
const changed = new Set<Listener>();
/** Called after a change made on this device (never for a seed from the account): the server sync and the reminders listen. */
export const onPrefsChange = (f: Listener) => {
  changed.add(f);
  return () => changed.delete(f);
};

const commit = (next: Prefs, local: boolean) => {
  const prev = state;
  if (same(prev, next) && stored) return;
  state = next;
  stored = next;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {
    /* private mode: lasts for the session */
  }
  subs.forEach((f) => f());
  if (local) changed.forEach((f) => f(next, prev));
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(PREFS_EVENT, { detail: next }));
};

export const getPrefs = (): Prefs => state;
/** Outside React (the route table, reminders, what the assistant is sent): is Fitness on? */
export const fitnessOn = (): boolean => state.fitness;
export const setFitness = (on: boolean) => commit({ ...state, fitness: on }, true);
export const setTodaySection = (id: TodaySection, on: boolean) => commit({ ...state, today: { ...state.today, [id]: on } }, true);
/** Has this device a copy of its own? Until it has, the account's copy may seed it. */
export const hasStoredPrefs = (): boolean => stored !== null;
/**
 * The account's copy (the bootstrap's `prefs`, when the server has one): written here only while this device has none of
 * its own. A choice made on this device always wins, like `seedTrainWhen`.
 */
export const seedPrefs = (account: unknown) => {
  if (stored || !account || typeof account !== 'object' || Array.isArray(account)) return;
  commit(normalizePrefs(account), false);
};

/**
 * Another tab of the same browser changed the stored copy (the `storage` event): this one follows, so two open tabs
 * never disagree and the last change stands in both. It is not a change made here: nothing is sent to the account (the
 * tab that made it has), and a key that was removed (the other tab signed out) is left to that tab's own reload.
 */
export const adoptStoredPrefs = (raw: string | null | undefined) => {
  const next = parseStoredPrefs(raw);
  if (!next || (stored && same(state, next))) return;
  state = next;
  stored = next;
  subs.forEach((f) => f());
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(PREFS_EVENT, { detail: next }));
};
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function')
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === PREFS_KEY) adoptStoredPrefs(e.newValue);
  });

export const usePrefs = (): Prefs => useSyncExternalStore(subscribe, getPrefs, getPrefs);
export const useFitness = (): boolean => useSyncExternalStore(subscribe, fitnessOn, fitnessOn);

/** What Today draws, in order. `fitness` is the training card and everything about training around it. */
export type TodayPart = 'fitness' | TodaySection;
/**
 * Today's order (layout standard 2.1), one order in both modes: the training card (Fitness on), Plan your day (the goal
 * and the to-dos), Habits, the Journal row (its key is `learned`). With Fitness off the top card is simply not there, and Plan your day
 * leads the page.
 */
export const todayParts = (p: Prefs): TodayPart[] => {
  const order: TodayPart[] = ['fitness', 'day', 'habits', 'learned'];
  return order.filter((k) => (k === 'fitness' ? p.fitness : p.today[k]));
};
export const useTodayParts = (): TodayPart[] => {
  const p = usePrefs();
  return todayParts(p);
};

/** The routes that belong to Fitness: with it off they lead to Today (ui/nav.ts asks). */
export const isFitnessPath = (path: string): boolean => /^\/(plan|fitness)(\/|$)/.test(path) || path === '/settings/training' || path === '/settings/plans' || /^\/progress\/metric\/(mileage|pace|lifts)$/.test(path) || path === '/habits/morning';

/** Tests only: start from a known state. */
export const resetPrefsForTest = (p: Prefs | null) => {
  stored = p;
  state = p ?? DEFAULT_PREFS;
  try {
    if (p) localStorage.setItem(PREFS_KEY, JSON.stringify(p));
    else localStorage.removeItem(PREFS_KEY);
  } catch {
    /* no storage in this environment */
  }
  subs.forEach((f) => f());
};
