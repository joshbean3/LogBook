import { today } from '@logbook/shared';
import { createContext, createElement, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';

/**
 * Today's date as the clock has it, which rolls over while the app stays open. One store for the whole app (perf-10): a
 * single 30 s interval and a single visibilitychange listener, started with the first subscriber and stopped with the
 * last, instead of one pair per component that asks.
 */
let current = today();
const subscribers = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
const check = () => {
  const n = today();
  if (n === current) return;
  current = n;
  for (const f of subscribers) f();
};
export const subscribeToday = (f: () => void) => {
  subscribers.add(f);
  if (subscribers.size === 1) {
    timer = setInterval(check, 30_000);
    document.addEventListener('visibilitychange', check);
  }
  // a store that slept (no one listening) may be a day behind
  check();
  return () => {
    subscribers.delete(f);
    if (subscribers.size) return;
    clearInterval(timer);
    timer = undefined;
    document.removeEventListener('visibilitychange', check);
  };
};
const snapshot = () => current;
export const useLiveToday = () => useSyncExternalStore(subscribeToday, snapshot, snapshot);
/** Tests only: how many components listen, and whether the one timer runs. */
export const liveTodayStats = () => ({ subscribers: subscribers.size, timer: timer !== undefined });

/**
 * The day a subtree treats as today. The Today tab holds its day past midnight until the rollover is applied (docs/feel.md
 * §5.4, `features/day/useDeferred.ts`): inside `TodayHold` every `useToday()` (and so every `useLog`) reads the held day, so
 * the page, its title, its caps line, the strip and the composer stay on it. Everywhere else it is the live date.
 */
const Held = createContext<string | null>(null);
export const TodayHold = ({ value, children }: { value: string; children?: ReactNode }) => createElement(Held.Provider, { value }, children);

/** Today's date: the held day inside `TodayHold`, else the live one (polled; `useToday` keeps polling under a hold too). */
export const useToday = () => {
  const held = useContext(Held);
  const live = useLiveToday();
  return held ?? live;
};

export const useMedia = (q: string) => {
  const [m, setM] = useState(() => (typeof matchMedia !== 'undefined' ? matchMedia(q).matches : false));
  useEffect(() => {
    const mq = matchMedia(q);
    const fn = () => setM(mq.matches);
    mq.addEventListener('change', fn);
    fn();
    return () => mq.removeEventListener('change', fn);
  }, [q]);
  return m;
};
