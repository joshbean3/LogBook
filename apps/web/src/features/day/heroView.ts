import type { ISODate } from '@logbook/shared';
import { useSyncExternalStore } from 'react';
import type { HeroView } from './heroWeek';

/**
 * The view picked on Today's hero (the hero spec, 6.3): a tap on the view pill holds for that day page for the rest of the
 * calendar day. Kept on this device as `logbook.heroView`: `{ on, picks: { [pageDate]: view } }`. When today is not `on`,
 * the whole value is dropped, so the next day every page opens on its own default again. `heroScene` ignores a pick for a
 * view that no longer exists.
 */
const KEY = 'logbook.heroView';
interface Stored {
  on: ISODate;
  picks: Record<string, HeroView>;
}
const isView = (v: unknown): v is HeroView => v === 'runs' || v === 'workouts';
const read = (): Stored | null => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Stored | null;
    if (!raw || typeof raw.on !== 'string' || typeof raw.picks !== 'object' || !raw.picks) return null;
    return { on: raw.on, picks: Object.fromEntries(Object.entries(raw.picks).filter(([, v]) => isView(v))) };
  } catch {
    return null;
  }
};
let state: Stored | null = read();
const subs = new Set<() => void>();
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};

/** The pick for a page today, or null. A value from another day counts as none. */
export const heroViewOf = (today: ISODate, date: ISODate, s: Stored | null = state): HeroView | null => (s && s.on === today ? (s.picks[date] ?? null) : null);

/** Keep a pick for one page today. A value from another day is dropped first. */
export const setHeroView = (today: ISODate, date: ISODate, view: HeroView) => {
  state = { on: today, picks: { ...(state?.on === today ? state.picks : {}), [date]: view } };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode: lasts for the session */
  }
  subs.forEach((f) => f());
};

/** The pick for a page today (null for none), live. */
export const useHeroView = (today: ISODate, date: ISODate): HeroView | null => {
  const get = () => heroViewOf(today, date);
  return useSyncExternalStore(subscribe, get, get);
};
