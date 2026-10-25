import { useSyncExternalStore } from 'react';

/**
 * The coach's read as the hero shows it the moment it answers (§6.1), per `date|key`: only the landed deck that names it
 * re-renders. The answer also joins the month's cached payload in place (`fetchCoachRead`), so the session sheet and every
 * later render read it there, without a write that rebuilds every mounted page's snapshot (day review 2 #7).
 */
const shown = new Map<string, string>();
const subs = new Set<() => void>();
export const setCoachShown = (date: string, key: string, text: string) => {
  shown.set(`${date}|${key}`, text);
  for (const f of subs) f();
};
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};
export const useCoachShown = (date: string, key: string): string | null => {
  const k = `${date}|${key}`;
  return useSyncExternalStore(subscribe, () => shown.get(k) ?? null, () => null);
};
