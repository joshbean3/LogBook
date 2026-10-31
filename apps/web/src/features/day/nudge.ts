import { useSyncExternalStore } from 'react';

/**
 * The one-time nudge (docs/feel.md §3.1): `Your morning lives here now ›` under the hero, until it is tapped or This
 * morning is pushed once (the arrows' and the Morning tab's successor, risk 12). Remembered in
 * `localStorage['logbook.nudge.morning']`; a storage that throws keeps it for the session only.
 */
const KEY = 'logbook.nudge.morning';
let dismissed = (() => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
})();
const subs = new Set<() => void>();

export const dismissNudge = () => {
  if (dismissed) return;
  dismissed = true;
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* private mode: this session only */
  }
  for (const f of subs) f();
};
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};
/** True while the nudge should show. */
export const useNudge = () => useSyncExternalStore(subscribe, () => !dismissed, () => !dismissed);
