import { today } from '@logbook/shared';
import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react';

/** Today's date as the clock has it, which rolls over while the app stays open (polled every 30 s and on visibility). */
export const useLiveToday = () => {
  const [t, setT] = useState(today);
  useEffect(() => {
    const check = () => {
      const n = today();
      setT((cur) => (cur === n ? cur : n));
    };
    const iv = setInterval(check, 30_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  return t;
};

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
