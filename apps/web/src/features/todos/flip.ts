import { animate, motionValue, type MotionValue } from 'motion/react';
import { useLayoutEffect, useRef, type RefObject } from 'react';
import { springs } from '@/lib/motion';

/**
 * The FLIP rule for a list that gains or loses a row (docs/feel.md §10.1): the layout commits once, and on the same frame
 * every row after the change (and, with `below`, everything after the list's section on the page: the week card, the plan
 * end, the day's card) gets the inverse of how far it moved, then springs to 0 on `settle`. Only `translate` changes, so a
 * press's `transform: scale` and its CSS transition are untouched, and a FLIP that starts while another runs starts from
 * where the row is on screen. Positions are layout positions (offsetTop sums), so scrolling and a running FLIP never skew them.
 */
interface Track {
  mv: MotionValue<number>;
  off: () => void;
}
const tracks = new WeakMap<HTMLElement, Track>();
const shiftOf = (el: HTMLElement) => {
  let t = tracks.get(el);
  if (!t) {
    const mv = motionValue(0);
    const off = mv.on('change', (v) => {
      el.style.translate = Math.abs(v) < 0.01 ? '' : `0 ${v}px`;
    });
    t = { mv, off };
    tracks.set(el, t);
  }
  return t.mv;
};

/** The element's layout top in the document (transforms and translate ignored). */
const layoutTop = (el: HTMLElement) => {
  let y = 0;
  for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) y += n.offsetTop;
  return y;
};

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface FlipOpts {
  /** Also move what follows the list's `.todos` section on the page. */
  below?: boolean;
  /** A row that was not there at `first()` fades in (the row promoted into the top three after a fold); else it is there on frame 1. */
  fadeNew?: boolean;
}

/**
 * `root`'s direct children marked `data-flip` are the rows. Call `first()` at the user's action, before the change is
 * committed (a fold, an add, a menu item): it records where everything is. The next commit that changes `sig` (the list's
 * content) plays the FLIP from there; a change nobody asked for (data arriving) only moves.
 */
export const useFlip = (root: RefObject<HTMLElement | null>, sig: string, opts: FlipOpts = {}) => {
  const snap = useRef<{ at: number; pos: Map<HTMLElement, number>; fade: boolean } | null>(null);
  const lastSig = useRef(sig);
  const o = useRef(opts);
  o.current = opts;
  const tracked = () => {
    const r = root.current;
    if (!r) return null;
    const els = [...r.querySelectorAll<HTMLElement>(':scope > [data-flip]')];
    if (o.current.below) {
      const sec = r.closest<HTMLElement>('.todos') ?? r;
      for (let n = sec.nextElementSibling; n; n = n.nextElementSibling) if (n instanceof HTMLElement) els.push(n);
    }
    return { base: layoutTop(r), els };
  };
  useLayoutEffect(() => {
    const changed = sig !== lastSig.current;
    lastSig.current = sig;
    const s = snap.current;
    if (!changed || !s) return;
    snap.current = null;
    const t = tracked();
    if (!t || reduced() || performance.now() - s.at > 3000) return;
    for (const el of t.els) {
      const top = layoutTop(el) - t.base;
      const before = s.pos.get(el);
      if (before === undefined) {
        if (s.fade && el.hasAttribute('data-flip')) animate(el, { opacity: [0, 1] }, { duration: 0.15, delay: 0.1 });
        continue;
      }
      const mv = shiftOf(el);
      const d = before - top;
      if (Math.abs(d) < 0.5) continue;
      mv.stop();
      // the inverse lands in this commit's frame; the spring's clock starts on the frame that paints it
      mv.jump(d);
      requestAnimationFrame(() => animate(mv, 0, springs.settle));
    }
  });
  return {
    first: (fade = o.current.fadeNew ?? false) => {
      const t = tracked();
      if (!t) return;
      snap.current = { at: performance.now(), fade, pos: new Map(t.els.map((e) => [e, layoutTop(e) - t.base + (tracks.get(e)?.mv.get() ?? 0)] as const)) };
    },
  };
};
