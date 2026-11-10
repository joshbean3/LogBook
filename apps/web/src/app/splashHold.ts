import { useLayoutEffect, useRef, useSyncExternalStore } from 'react';

/**
 * While the app has nothing to draw (a cold open with no saved copy, waiting on the server), the brand splash stays up
 * instead of giving way to an empty frame (shell-14). Whoever is waiting holds it and says how to try again; the splash
 * shows "Still loading" with that retry after a few seconds, and leaves as soon as the hold is let go.
 */
interface Hold {
  retry: () => void;
}
let hold: Hold | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
export const splashHold = {
  get: () => hold,
  subscribe: (f: () => void) => {
    subs.add(f);
    return () => void subs.delete(f);
  },
};
export const useSplashHeld = () => useSyncExternalStore(splashHold.subscribe, splashHold.get, splashHold.get);

/** Hold the splash while `on`; `retry` is what its Try again does. Set before the first paint (a layout effect). */
export const useHoldSplash = (on: boolean, retry: () => void) => {
  const r = useRef(retry);
  r.current = retry;
  useLayoutEffect(() => {
    if (!on) return;
    const mine: Hold = { retry: () => r.current() };
    hold = mine;
    emit();
    return () => {
      if (hold !== mine) return;
      hold = null;
      emit();
    };
  }, [on]);
};
