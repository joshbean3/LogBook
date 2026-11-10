import type * as React from 'react';
import { useEffect, useRef } from 'react';
import { NAV_EVENT } from './nav';
import { ORB_PAD, paintOrb, type OrbVariant } from './orbPaint';

export type { OrbVariant };
import './orb.css';

/**
 * Logbook's mark: a living drop of glowing gel (orbPaint.ts paints it). The skin wobbles like a held drop, colour currents
 * flow freely inside it, a sheen slides over it and a glow breathes around it.
 *
 * One component wherever the brand appears: the splash, the logo, the assistant. `state` sets its mood:
 *   idle    at rest, slow and fluid (the default)
 *   think   quicker, wobblier, the heart pulsing: the assistant is working
 *   still   one quiet frame (tiny sizes, static places)
 * Under Reduce Motion it holds one frame whatever the state. Every orb on screen shares one animation frame loop at 24
 * frames a second, which stops when no orb is in view or the app is in the background.
 */
export type OrbState = 'idle' | 'think' | 'still';

type Painter = { draw: (t: number) => void; el: HTMLElement; inView: boolean; shown: boolean; visible: boolean };
const painters = new Set<Painter>();
let raf = 0;
let last = 0;
let checked = 0;
const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
/** Small marks need no more: 24 frames a second, about a third of the work of 60 (perf-06). */
const FRAME_MS = 1000 / 24;
/** How often the loop re-checks which orbs are actually shown (a hidden tab, a page under another). */
const CHECK_MS = 1000;
/**
 * In view is not enough: an orb in a hidden tab (visibility: hidden) still intersects the viewport. checkVisibility says
 * whether it is drawn at all.
 */
const refreshShown = () => {
  for (const p of painters) {
    const el = p.el as HTMLElement & { checkVisibility?: (o?: { visibilityProperty?: boolean; opacityProperty?: boolean }) => boolean };
    p.shown = el.isConnected && (el.checkVisibility ? el.checkVisibility({ visibilityProperty: true }) : true);
    p.visible = p.inView && p.shown;
  }
};
const anyVisible = () => {
  for (const p of painters) if (p.visible) return true;
  return false;
};
/**
 * One loop for every orb on screen. It runs only while some orb is in view, drawn, and the page is shown: an orb scrolling
 * back into view (its IntersectionObserver), a tab change (NAV_EVENT) or the app coming back (visibilitychange) starts it
 * again. An idle screen whose orbs are all still runs no frames at all.
 */
const loop = (now: number) => {
  raf = 0;
  if (now - checked >= CHECK_MS) {
    checked = now;
    refreshShown();
  }
  if (!anyVisible() || (typeof document !== 'undefined' && document.hidden)) return;
  if (now - last >= FRAME_MS - 1) {
    last = now;
    const t = (now - t0) / 1000;
    for (const p of painters) if (p.visible) p.draw(t);
  }
  raf = requestAnimationFrame(loop);
};
const start = () => {
  if (raf || typeof requestAnimationFrame === 'undefined') return;
  refreshShown();
  checked = typeof performance !== 'undefined' ? performance.now() : 0;
  if (!anyVisible() || (typeof document !== 'undefined' && document.hidden)) return;
  raf = requestAnimationFrame(loop);
};
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    } else start();
  });
  // a tab change or a push shows other orbs: the shell hides the old tab in the task after its frame, so look a beat later
  window.addEventListener(NAV_EVENT, () => setTimeout(start, 120));
}
const reduced = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/** `variant`: the brand's palette, or one of its variants (sun, sky, dusk, tide) for markers and moods. */
export const Orb = ({ size = 48, state = 'idle', variant = 'brand', className = '', label, style }: { size?: number; state?: OrbState; variant?: OrbVariant; className?: string; label?: string; style?: React.CSSProperties }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const energy = state === 'think' ? 2.6 : 1;
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const box = size * ORB_PAD;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = Math.round(box * dpr);
    cv.height = Math.round(box * dpr);
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const draw = (t: number) => paintOrb(ctx, { size: box, t, energy, variant });
    // a fixed moment for a still orb: a pleasing frame, not the first
    draw(state === 'still' || reduced() ? 1.8 : (performance.now() - t0) / 1000);
    if (state === 'still' || reduced()) return;
    const p: Painter = { draw, el: cv, inView: true, shown: true, visible: true };
    painters.add(p);
    start();
    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver((es) => {
            p.inView = es.some((e) => e.isIntersecting);
            p.visible = p.inView && p.shown;
            if (p.inView) start();
          })
        : null;
    io?.observe(cv);
    return () => {
      painters.delete(p);
      io?.disconnect();
    };
  }, [size, energy, state, variant]);
  return (
    <span className={`lb-orb is-${state} ${className}`.trim()} style={{ '--s': `${size}px`, ...style } as React.CSSProperties} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <canvas ref={ref} className="lb-orb-canvas" />
    </span>
  );
};
