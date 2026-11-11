import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { hasAccountHere } from '@/features/auth/flag';
import { isSplashDone, SPLASH_DONE } from '@/lib/native';
import { Wordmark } from '@/ui/Brand';
import dawnArt from '@/ui/orb/logo-mark-dawn.svg?url';
import litArt from '@/ui/orb/logo-mark-glow.svg?url';
import { useFirstToday } from '@/ui/useFirstToday';
import { useSplashHeld } from './splashHold';
import './brandSplash.css';

/**
 * The launch (guide 9.2, 12.1; plan 4.5): a dawn sky over the poster's three hills, the outlined wordmark and "One good day
 * at a time." in the sky, the 96 px Orb resting just above the near hill (its bottom 0.1 D over the crest, guide 8.3), and a
 * caption on the far hill that follows the time of day. The native launch screen is plain Cloud, so the art fades in over it
 * and nothing jumps.
 *
 * - First open of the day (or a first run): the Orb rises 24 px while its sunrise underlight comes up, 900 ms, then the
 *   wordmark and the line fade in over 200 ms. Later launches: a 300 ms fade of the final frame. Reduce Motion: the final
 *   frame, faded in over 150 ms.
 * - It dissolves on the first screen's paint (`SPLASH_DONE`), after the minimum for its moment.
 * - A hard cap (CAP_MS) keeps a slow start from holding it, except while the app is waiting on the server with nothing
 *   saved to draw (app/splashHold.ts): then it stays, and after WAIT_MS says so, with Try again (shell-14).
 * - It takes taps while it is opaque, so nothing under it is pressed by accident, and lets them through once it fades.
 */
const RISE_MS = 900 + 200;
const MIN_RETURNING_MS = 300;
const CAP_MS = 3500;
const WAIT_MS = 4000;
let shown = false;

/** The caption on the far hill: before noon, noon to 5 pm, after 5 pm (guide 12.1). */
export const greetingFor = (hour: number) => (hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening');

export const BrandSplash = () => {
  const reduce = useReducedMotion();
  const held = useSplashHeld();
  const firstToday = useFirstToday('splash');
  const [on, setOn] = useState(() => !shown);
  const [ready, setReady] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const t0 = useRef(performance.now());
  // the sunrise for the day's first open and a first run; a quiet fade for every later launch
  const [moment] = useState<'rise' | 'fade' | 'still'>(() => (reduce ? 'still' : firstToday || !hasAccountHere() ? 'rise' : 'fade'));
  const min = useRef(moment === 'rise' ? RISE_MS : MIN_RETURNING_MS);
  const [greeting] = useState(() => greetingFor(new Date().getHours()));

  // the first screen painted, or the cap ran out
  useEffect(() => {
    if (!on) return;
    shown = true;
    const go = () => setReady(true);
    if (isSplashDone()) go();
    window.addEventListener(SPLASH_DONE, go);
    const cap = setTimeout(go, CAP_MS);
    return () => {
      window.removeEventListener(SPLASH_DONE, go);
      clearTimeout(cap);
    };
  }, [on]);

  // leave once ready and nothing holds it, after the minimum
  useEffect(() => {
    if (!on || !ready || held) return;
    const t = setTimeout(() => setOn(false), Math.max(0, min.current - (performance.now() - t0.current)));
    return () => clearTimeout(t);
  }, [on, ready, held]);

  // held a while: say so, with a way to try again
  useEffect(() => {
    if (!on || !held) {
      setWaiting(false);
      return;
    }
    const t = setTimeout(() => setWaiting(true), Math.max(0, WAIT_MS - (performance.now() - t0.current)));
    return () => clearTimeout(t);
  }, [on, held]);

  return (
    <AnimatePresence>
      {on ? (
        <motion.div
          key="splash"
          className="brand-splash"
          data-moment={moment}
          initial={false}
          exit={{ opacity: 0, pointerEvents: 'none' }}
          transition={{ duration: reduce ? 0.15 : 0.3, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden={waiting ? undefined : 'true'}
        >
          <div className="bs-art">
            <div className="bs-glow" />
            <div className="bs-head">
              <Wordmark width={150} className="bs-word" />
              <p className="bs-line">One good day at a time.</p>
            </div>
            <div className="bs-orb">
              <img className="bs-orb-art" src={dawnArt} alt="" draggable={false} />
              <img className="bs-orb-art bs-orb-lit" src={litArt} alt="" draggable={false} />
            </div>
            <svg className="bs-hills" viewBox="0 0 500 200" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0 62 C 90 40, 170 44, 250 58 S 410 76, 500 52 L500 200 L0 200Z" fill="var(--hill-1)" />
              <path d="M0 98 C 120 70, 220 84, 300 96 S 440 112, 500 90 L500 200 L0 200Z" fill="var(--hill-2)" />
              <path d="M0 136 C 100 118, 200 120, 290 136 S 430 150, 500 128 L500 200 L0 200Z" fill="var(--hill-3)" />
            </svg>
            <p className="bs-cap">{greeting}</p>
          </div>
          {waiting && held ? (
            <motion.div className="brand-splash-wait" role="status" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
              <p>Still loading. Check your connection.</p>
              <button type="button" className="btn quiet" onClick={() => held.retry()}>
                Try again
              </button>
            </motion.div>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
