import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { hasAccountHere } from '@/features/auth/flag';
import { isSplashDone, SPLASH_DONE } from '@/lib/native';
import { Wordmark } from '@/ui/Brand';
import { Orb } from '@/ui/Orb';
import { useSplashHeld } from './splashHold';
import './brandSplash.css';

/**
 * The launch: the orb, alive, over the canvas, with the wordmark rising in under it. On the phone it picks up exactly
 * where the native splash's still orb left off (same size, same place), so the first thing that moves is the orb itself.
 * It dissolves on the first screen's paint (`SPLASH_DONE`): the orb swells a touch and fades as the page comes up behind
 * it. Once per launch.
 *
 * - How long at least: the full moment (MIN_MS) for a first run; a person who has signed in here before is let through
 *   after about 300 ms, since their saved screen is ready under it (shell-16).
 * - A hard cap (CAP_MS) keeps a slow start from holding it, except while the app is waiting on the server with nothing
 *   saved to draw (app/splashHold.ts): then it stays, and after WAIT_MS says so, with Try again (shell-14).
 * - It takes taps while it is opaque, so nothing under it is pressed by accident, and lets them through once it fades.
 */
const MIN_MS = 900;
const MIN_RETURNING_MS = 300;
const CAP_MS = 3500;
const WAIT_MS = 4000;
let shown = false;

export const BrandSplash = () => {
  const reduce = useReducedMotion();
  const held = useSplashHeld();
  const [on, setOn] = useState(() => !shown);
  const [ready, setReady] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const t0 = useRef(performance.now());
  const min = useRef(hasAccountHere() ? MIN_RETURNING_MS : MIN_MS);

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
          initial={false}
          exit={{ opacity: 0, pointerEvents: 'none' }}
          transition={{ duration: reduce ? 0.15 : 0.5, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden={waiting ? undefined : 'true'}
        >
          <motion.div className="brand-splash-orb" exit={reduce ? undefined : { scale: 1.18 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
            <Orb size={150} />
          </motion.div>
          <motion.span className="brand-splash-word" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
            <Wordmark width={150} />
          </motion.span>
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
