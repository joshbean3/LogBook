import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { isSplashDone, SPLASH_DONE } from '@/lib/native';
import { Orb } from '@/ui/Orb';
import './brandSplash.css';

/**
 * The launch: the orb, alive, over the canvas, with the wordmark rising in under it. On the phone it picks up exactly
 * where the native splash's still orb left off (same size, same place), so the first thing that moves is the orb itself.
 * It stays at least MIN_MS so the moment reads, then dissolves on the first screen's paint (`SPLASH_DONE`): the orb swells
 * a touch and fades as the page comes up behind it. A hard cap keeps a slow start from holding it. Once per launch.
 */
const MIN_MS = 900;
const CAP_MS = 3500;
let shown = false;

export const BrandSplash = () => {
  const reduce = useReducedMotion();
  const [on, setOn] = useState(() => !shown);
  useEffect(() => {
    if (!on) return;
    shown = true;
    const t0 = performance.now();
    let gone = false;
    const go = () => {
      if (gone) return;
      gone = true;
      setTimeout(() => setOn(false), Math.max(0, MIN_MS - (performance.now() - t0)));
    };
    if (isSplashDone()) go();
    window.addEventListener(SPLASH_DONE, go);
    const cap = setTimeout(go, CAP_MS);
    return () => {
      window.removeEventListener(SPLASH_DONE, go);
      clearTimeout(cap);
    };
  }, [on]);
  return (
    <AnimatePresence>
      {on ? (
        <motion.div key="splash" className="brand-splash" initial={false} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0.15 : 0.5, ease: [0.22, 1, 0.36, 1] }} aria-hidden="true">
          <motion.div className="brand-splash-orb" exit={reduce ? undefined : { scale: 1.18 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
            <Orb size={150} />
          </motion.div>
          <motion.span className="brand-splash-word" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
            Logbook
          </motion.span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
