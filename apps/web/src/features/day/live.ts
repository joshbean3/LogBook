import { useSyncExternalStore } from 'react';

/**
 * Which day page is live (the pager's cur page), as a tiny store instead of a prop (risk 1): the pager makes neighbours
 * `inert`, so a section needs to know it is live only for the day's once-a-day moments (the route draw, the stamps' count-up,
 * the week ring's fill, `celebrate`), the nudge and the splash. Those leaves subscribe here; a commit (a role change) then
 * re-renders them and nothing else. DayView writes it in the commit's own layout phase, so it lands on the same frame.
 */
let live: string | null = null;
const subs = new Set<() => void>();
export const setLiveDate = (d: string | null) => {
  if (d === live) return;
  live = d;
  for (const f of subs) f();
};
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};
export const getLiveDate = () => live;
/** True while `date` is the pager's cur page. */
export const useIsLive = (date: string) => useSyncExternalStore(subscribe, () => live === date, () => live === date);
