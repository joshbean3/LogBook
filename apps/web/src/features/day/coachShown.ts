import { useSyncExternalStore } from 'react';

/**
 * The coach's read as it answered (§6.1), per `date|key`. The answer also joins the month's cached payload in place
 * (`fetchCoachRead`) without telling any observer, so no mounted page rebuilds its snapshot for one sentence (day review 2
 * #7). That write reaches neither an open session sheet nor the persisted cache, so this store is what both read besides the
 * month:
 * - the landed deck and the session sheet (`SessionActual`) subscribe to it: an answer that lands while the sheet is open
 *   shows there, and its `Coach's read` chip never asks Claude a second time (code review 3 #1);
 * - it is kept in `localStorage` (the last `KEEP` reads), so after a cold open the restored month, which has no read, still
 *   shows the sentence on the first frame, not 3 s later when the month is fetched again (day review 3 #1).
 * A storage that throws keeps it for the session only.
 */
const STORE_KEY = 'logbook.coach.shown';
const KEEP = 30;
const load = (): Map<string, string> => {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : null;
    if (Array.isArray(list)) return new Map(list.filter((e): e is [string, string] => Array.isArray(e) && typeof e[0] === 'string' && typeof e[1] === 'string'));
  } catch {
    /* private mode, cleared or blocked storage: the session's own reads only */
  }
  return new Map();
};
let shown: Map<string, string> | null = null;
const store = () => (shown ??= load());
const subs = new Set<() => void>();
export const setCoachShown = (date: string, key: string, text: string) => {
  const m = store();
  const k = `${date}|${key}`;
  if (m.get(k) === text) return;
  m.delete(k);
  m.set(k, text);
  while (m.size > KEEP) m.delete(m.keys().next().value as string);
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify([...m]));
  } catch {
    /* kept in memory */
  }
  for (const f of subs) f();
};
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};
export const coachShown = (date: string, key: string): string | null => store().get(`${date}|${key}`) ?? null;
export const useCoachShown = (date: string, key: string): string | null => useSyncExternalStore(subscribe, () => coachShown(date, key), () => null);
