import type * as React from 'react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useNav } from '@/app/NavController';
import { useToday } from '@/lib/useToday';
import { useLevel, useOrbsOn, useOrbsToday } from '../store';
import { counterOffset, setCounter, subscribeOffset } from './index';
import { counterLabel } from './rules';
import './counter.css';

/**
 * Today's Orbs, beside the title-line sun (Today's own day only: the day view hands this to the bar's horizon). The
 * sun and the numeral are one 44 pt target that opens the Orbs page. No numeral before the day's first Orb: never "0".
 *
 * The number is the store's for the day, held to what has landed: an Orb in the air is counted when it arrives, and
 * the store's own later update for the same Orb changes nothing (rules.ts `createClaims`). On landing the sun pulses
 * once and the numeral cross-fades. With Orbs switched off this draws nothing and the bar keeps its own sun.
 */
export const OrbCounter = (): React.JSX.Element | null => {
  const on = useOrbsOn();
  const day = useToday();
  const stored = useOrbsToday();
  const level = useLevel();
  const nav = useNav();
  const offset = useSyncExternalStore(subscribeOffset, () => counterOffset(day), () => 0);
  const n = Math.max(0, stored + offset);
  // the numeral cross-fades: the one before leaves as the new one comes (never on the first paint)
  const [shown, setShown] = useState<{ cur: number; prev: number | null; k: number }>({ cur: n, prev: null, k: 0 });
  if (shown.cur !== n) setShown({ cur: n, prev: shown.cur, k: shown.k + 1 });
  const [pulse, setPulse] = useState(0);
  const el = useRef<HTMLButtonElement>(null);
  const sun = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!on || !el.current || !sun.current) return;
    const me = { el: el.current, sun: sun.current, land: () => setPulse((p) => p + 1) };
    setCounter(me);
    return () => setCounter(null, me);
  }, [on]);
  if (!on) return null;
  return (
    <button ref={el} type="button" className="nb-orbs" aria-label={counterLabel(shown.cur, level)} onClick={() => nav.go('/orbs')}>
      <i ref={sun} key={`s${pulse}`} className={`nb-orbs-sun${pulse ? ' is-landing' : ''}`} aria-hidden="true" />
      <span key={`n${shown.k}`} className={`nb-orbs-n${shown.k ? ' is-changed' : ''}`} aria-hidden="true">
        {shown.k && shown.prev ? <span className="nb-orbs-out">{shown.prev}</span> : null}
        {shown.cur ? <span className="nb-orbs-in">{shown.cur}</span> : null}
      </span>
    </button>
  );
};
