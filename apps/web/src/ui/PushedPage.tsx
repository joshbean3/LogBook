import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useNavigate, useNavigationType } from 'react-router';
import { springs } from '@/lib/motion';
import { canPopHistory, useRouteInfo } from './nav';

interface Frame {
  /** Slide the page out and go back: pop the history if there is an in-app page to pop, else the owning tab's root. */
  back: () => void;
}
const Ctx = createContext<Frame | null>(null);
/** The pushed page this component sits in, if any (PushedHeader and the legacy PageHeader read it for their chevron). */
export const usePushedFrame = () => useContext(Ctx);

/** The edge strip a back swipe starts in, the share of the width that commits it, and the fling speed that also does. */
export const EDGE_SWIPE_PX = 20;
export const EDGE_SWIPE_COMMIT = 0.35;
export const EDGE_SWIPE_VELOCITY = 500;

/**
 * The frame every pushed route renders in (App.tsx wraps Morning, Reads, Settings and /dev/ui in it). It slides in from the
 * right on a push (`springs.page`), owns the edge swipe back (a touch that starts in the left 20px follows the finger and
 * commits at 35% of the width or a 500px/s fling, else springs home), and gives `back()` to the chevrons in PushedHeader and
 * PageHeader. Reduced motion: no slide on push or back; the swipe still follows the finger.
 */
export const PushedPage = ({ children, backTo }: { children: ReactNode; backTo?: string }) => {
  const reduce = useReducedMotion();
  const nav = useNavigate();
  const navType = useNavigationType();
  const info = useRouteInfo();
  // a push slides in from the right; a cold start or a back into this page just appears
  const slideIn = useRef(navType === 'PUSH' && !reduce && canPopHistory()).current;
  const x = useMotionValue(slideIn ? window.innerWidth : 0);
  const ref = useRef<HTMLDivElement>(null);
  const leaving = useRef(false);
  const target = backTo ?? info.backTo;

  const go = useCallback(() => {
    if (canPopHistory()) nav(-1);
    else nav(target, { replace: true });
  }, [nav, target]);
  const back = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    if (reduce) return go();
    void animate(x, window.innerWidth, { ...springs.page, restDelta: 4 }).then(go);
  }, [go, reduce, x]);

  useEffect(() => {
    if (!slideIn) return;
    const c = animate(x, 0, springs.page);
    return () => c.stop();
  }, [slideIn, x]);

  // the edge swipe
  useEffect(() => {
    let s: null | { x0: number; y0: number; lock: null | 'x' | 'y'; samples: Array<[number, number]> } = null;
    const blocked = () => !!document.querySelector('.sheet-wrap, .cm-layer');
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (e.touches.length !== 1 || !t || t.clientX > EDGE_SWIPE_PX || leaving.current || blocked()) {
        s = null;
        return;
      }
      x.stop();
      s = { x0: t.clientX, y0: t.clientY, lock: null, samples: [[t.clientX, performance.now()]] };
    };
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!s || !t) return;
      const dx = t.clientX - s.x0;
      const dy = t.clientY - s.y0;
      if (!s.lock) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        s.lock = dx > Math.abs(dy) ? 'x' : 'y';
      }
      if (s.lock !== 'x') return;
      if (e.cancelable) e.preventDefault();
      x.set(Math.max(0, dx));
      s.samples.push([t.clientX, performance.now()]);
      if (s.samples.length > 6) s.samples.shift();
    };
    const onEnd = () => {
      const st = s;
      s = null;
      if (!st || st.lock !== 'x') return;
      const w = window.innerWidth;
      const [ax, at] = st.samples[0]!;
      const [bx, bt] = st.samples[st.samples.length - 1]!;
      const v = bt > at ? ((bx - ax) / (bt - at)) * 1000 : 0;
      if (x.get() > w * EDGE_SWIPE_COMMIT || v > EDGE_SWIPE_VELOCITY) {
        leaving.current = true;
        void animate(x, w, { ...springs.page, velocity: v, restDelta: 4 }).then(go);
      } else void animate(x, 0, { ...springs.page, velocity: v });
    };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
  }, [go, x]);

  const frame = useMemo(() => ({ back }), [back]);
  return (
    <Ctx.Provider value={frame}>
      <motion.div ref={ref} className="pushed-page" style={{ x }}>
        {children}
      </motion.div>
    </Ctx.Provider>
  );
};
