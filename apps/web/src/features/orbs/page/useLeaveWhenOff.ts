import { useEffect, useRef } from 'react';
import { useNavState } from '@/app/NavController';
import { usePop } from '@/ui/PushedLayer';
import { useOrbsOn } from '../store';

/**
 * With Orbs switched off its pages are not places (ui/nav.ts sends their addresses to Today). One that is still on the
 * stack at that moment (the switch came from Settings on another phone, or from this page's own last group) takes itself
 * off as soon as it is the top page, and draws nothing of Orbs meanwhile. Returns whether Orbs are on.
 */
export const useLeaveWhenOff = (): boolean => {
  const on = useOrbsOn();
  const pop = usePop();
  const popRef = useRef(pop);
  popRef.current = pop;
  // the stack: a page under another one waits for its turn (its pop is refused until it is on top)
  const state = useNavState();
  // only while Today, the tab these pages belong to, is the one on screen: the pop is the shown tab's
  const shown = state.active === 'today';
  useEffect(() => {
    if (!on && shown) popRef.current();
  }, [on, shown, state]);
  return on;
};
