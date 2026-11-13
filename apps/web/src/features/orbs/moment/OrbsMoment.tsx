import type * as React from 'react';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useNav, useNavState } from '@/app/NavController';
import { BigMoment } from './BigMoment';
import { getStatus, leftScreen, setMomentNav, setOverlays, startMoment, subscribeStatus } from './index';

/**
 * Mounted once, in the shell. It starts the moment's listening (the engine's event, the store), tells it how many
 * sheets are open and how to navigate, holds the one line VoiceOver hears ("5 Orbs. 12 today.", polite, 1,200 ms after
 * the last award, never moving focus) and the big moments. The Orbs themselves are drawn on their own layer on body.
 */
export const OrbsMoment = (): React.JSX.Element => {
  const nav = useNav();
  const st = useNavState();
  const overlays = st.overlays;
  useEffect(() => setOverlays(overlays), [overlays]);
  // another tab, or a page pushed over this one or taken away: an Orb in the air has no counter to fly to there
  const screen = `${st.active}:${st.tabs[st.active].stack.length}`;
  const was = useRef(screen);
  useEffect(() => {
    if (was.current === screen) return;
    was.current = screen;
    leftScreen();
  }, [screen]);
  useEffect(() => {
    setMomentNav((path) => nav.go(path));
    return startMoment();
  }, [nav]);
  const status = useSyncExternalStore(subscribeStatus, getStatus, () => '');
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        {status}
      </div>
      <BigMoment />
    </>
  );
};
