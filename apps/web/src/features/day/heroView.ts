import type { ISODate } from '@logbook/shared';
import { useSyncExternalStore } from 'react';
import type { HeroView } from './heroWeek';

/**
 * Runs or Workouts: one choice for the whole app, for the rest of the calendar day (the hero spec, 6.3). The pill on the
 * training card (Today's and Fitness's, on any day or week page) and the switch on Fitness's Progress chart read and write
 * this one value, so changing either changes both. Kept on this device as `logbook.heroView`: `{ on, view }`. When today
 * is not `on`, the value is dropped, so the next day every card and the chart open on the day's own default again.
 * `heroScene` and `chartMode` ignore a pick for a view that has nothing to show.
 *
 * Before the one switch the value was `{ on, picks: { [pageDate]: view } }`, a pick per page: the pick made on that day's
 * own page is read as the day's choice, so nothing a person chose today is lost by the update.
 */
const KEY = 'logbook.heroView';
export interface StoredHeroView {
  on: ISODate;
  view: HeroView;
}
const isView = (v: unknown): v is HeroView => v === 'runs' || v === 'workouts';
/** The stored value as the one choice, or null for anything that is not one (pure: the tests read it). */
export const parseHeroView = (raw: unknown): StoredHeroView | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { on?: unknown; view?: unknown; picks?: unknown };
  if (typeof r.on !== 'string') return null;
  if (isView(r.view)) return { on: r.on, view: r.view };
  const old = r.picks && typeof r.picks === 'object' ? (r.picks as Record<string, unknown>)[r.on] : null;
  return isView(old) ? { on: r.on, view: old } : null;
};
const read = (): StoredHeroView | null => {
  try {
    return parseHeroView(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return null;
  }
};
let state: StoredHeroView | null = read();
const subs = new Set<() => void>();
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};

/**
 * Today's choice, or null. A value from another day counts as none. `date` names the page that asks (a day page, a week
 * card, the chart): every page reads the same choice, so it changes nothing; callers keep passing it.
 */
export const heroViewOf = (today: ISODate, _date?: ISODate, s: StoredHeroView | null = state): HeroView | null => (s && s.on === today ? s.view : null);

/** Keep the choice for today, whichever card or chart it was made on. */
export const setHeroView = (today: ISODate, _date: ISODate, view: HeroView) => {
  state = { on: today, view };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode: lasts for the session */
  }
  subs.forEach((f) => f());
};

/** Today's choice (null for none), live: every card and the chart follow a change at once. */
export const useHeroView = (today: ISODate, _date?: ISODate): HeroView | null => {
  const get = () => heroViewOf(today);
  return useSyncExternalStore(subscribe, get, get);
};
