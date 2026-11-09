import type * as React from 'react';
import { useEffect, useRef } from 'react';
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
 * Under Reduce Motion it holds one frame whatever the state. Every orb on screen shares one animation frame loop, and an
 * orb out of view or in a hidden page does not paint.
 */
export type OrbState = 'idle' | 'think' | 'still';

type Painter = { draw: (t: number) => void; visible: boolean };
const painters = new Set<Painter>();
let raf = 0;
const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
const loop = () => {
  raf = 0;
  const t = (performance.now() - t0) / 1000;
  let any = false;
  for (const p of painters) {
    if (!p.visible) continue;
    any = true;
    p.draw(t);
  }
  // keep the loop while any orb is mounted (one out of view may come back); nothing is painted for those out of view
  void any;
  if (painters.size) raf = requestAnimationFrame(loop);
};
const start = () => {
  if (!raf && typeof requestAnimationFrame !== 'undefined') raf = requestAnimationFrame(loop);
};
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
    const p: Painter = { draw, visible: true };
    painters.add(p);
    start();
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((es) => (p.visible = es.some((e) => e.isIntersecting))) : null;
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
