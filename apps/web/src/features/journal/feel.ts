import { animate, motionValue, type MotionValue } from 'motion/react';
import { useDeferredValue, useLayoutEffect, useRef, type RefObject } from 'react';
import { hapticAtPeak } from '@/lib/haptics';
import { COMPLETE_SCALE, forScale, springs } from '@/lib/motion';

/**
 * The FLIP rule (docs/feel.md §10.1) for WP6's pages: when a box changes size, the layout commits once and what moved is
 * carried back with a transform that springs to 0 on `springs.settle`. Nothing animates height, padding or top.
 */

const SCROLLERS = '.sheet-body, .pushed, .tab-scroll';
// what `below` never walks past: a scroller, or one of Journal's two panes (the hidden pane is not "below" the other)
const BOUNDS = `${SCROLLERS}, .j-pane`;
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A pushed page's body, one render after the push (review feel F4): the push's own commit draws the bar and the layer, so
 * the slide starts on the next frame; the body renders right after as React's deferred (interruptible, time-sliced) render,
 * which never holds a frame of the slide, and fades in over 120 ms. On a fast phone it lands in the first frame or two of
 * the slide, while the page is still at the screen's right edge.
 */
export const useBodyReady = (): boolean => useDeferredValue(true, false);
/** The body's arrival: everything in the page but its bar (the first child) fades in, opacity only. */
export const useBodyFade = (page: RefObject<HTMLElement | null>, ready: boolean) => {
  useLayoutEffect(() => {
    const el = page.current;
    if (!ready || !el || reduced()) return;
    for (const c of [...el.children].slice(1)) c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: 'cubic-bezier(.22,1,.36,1)' });
  }, [ready, page]);
};

/**
 * The running carry of an element (so a second change re-bases from where it is on screen, never jumps), and the inline
 * `transition` the element had before the first carry took it over: a carry stopped by another restores that one, never
 * the `none` the first carry wrote (review code F6).
 */
const carries = new WeakMap<HTMLElement, { y: MotionValue<number>; off: () => void; tr: string }>();

/** Translate `el` by `d` px now (on this task, before the next paint) and spring it to 0 on `settle`. */
export const carry = (el: HTMLElement, d: number) => {
  const run = carries.get(el);
  const from = (run ? run.y.get() : 0) + d;
  const tr = run ? run.tr : el.style.transition;
  run?.y.stop();
  run?.off();
  if (Math.abs(from) < 0.5 || reduced()) {
    carries.delete(el);
    el.style.transform = '';
    el.style.transition = tr;
    return;
  }
  const y = motionValue(from);
  el.style.transition = 'none';
  el.style.transform = `translateY(${from}px)`;
  const off = y.on('change', (v) => (el.style.transform = Math.abs(v) < 0.01 ? '' : `translateY(${v}px)`));
  carries.set(el, { y, off, tr });
  // the spring's clock starts on the frame that paints the inverse (a long commit frame is not elapsed time)
  requestAnimationFrame(() => {
    if (carries.get(el)?.y !== y) return;
    animate(y, 0, {
      ...springs.settle,
      onComplete: () => {
        off();
        if (carries.get(el)?.y !== y) return;
        carries.delete(el);
        el.style.transform = '';
        el.style.transition = tr;
      },
    });
  });
};

/** A box's chrome (a card's background layer) carried from `from` × its height back to 1 on `settle`, top-anchored. */
export const carryScaleY = (el: HTMLElement, from: number) => {
  if (!Number.isFinite(from) || Math.abs(from - 1) < 0.002 || reduced()) return;
  const s = motionValue(from);
  el.style.transformOrigin = '50% 0';
  el.style.transform = `scaleY(${from})`;
  const off = s.on('change', (v) => (el.style.transform = `scaleY(${v})`));
  requestAnimationFrame(() =>
    animate(s, 1, {
      ...forScale(springs.settle),
      onComplete: () => {
        off();
        el.style.transform = '';
      },
    }),
  );
};

/** Everything after `el` in its scroller: its later siblings, then what follows each ancestor up to the scroller (or pane). */
export const below = (el: Element): HTMLElement[] => {
  const out: HTMLElement[] = [];
  const bound = el.closest(BOUNDS);
  for (let a: Element | null = el; a && a !== bound; a = a.parentElement) for (let n = a.nextElementSibling; n; n = n.nextElementSibling) out.push(n as HTMLElement);
  return out;
};

/**
 * Measure what sits below `el` now; call the returned function after the change has committed (a layout effect) and each
 * of those elements is carried from where it was to where it is on `settle`.
 */
export const measureBelow = (el: Element | null) => {
  if (!el) return () => undefined;
  const list = below(el);
  const tops = list.map((n) => n.getBoundingClientRect().top);
  return () => list.forEach((n, i) => n.isConnected && carry(n, tops[i]! - n.getBoundingClientRect().top));
};

/**
 * A list whose rows insert, leave or reorder (Entries, Reads, your quotes): every row that stays is carried from where it
 * was on screen on `settle`; a new row fades in over 150 ms (opacity only); what follows the list rides along. Rows are the
 * container's children, keyed by `data-key`.
 *
 * "Where it was" is measured on the render that changes the list, before React touches the DOM (the DOM still shows the
 * old list then), and "where it is" in the layout effect of the same commit: both are screen rects, so nothing that moved
 * above the list since its last change (the composer growing, today's pick landing, the Unread · Read control appearing in
 * the same commit) can leave a stale origin (review feel F1).
 */
interface FlipSnap {
  sig: string;
  rows: Map<string, number>;
  after: Array<[HTMLElement, number]>;
}
const snapOf = (box: HTMLElement, sig: string): FlipSnap => {
  const rows = new Map<string, number>();
  for (const r of box.children as HTMLCollectionOf<HTMLElement>) if (r.dataset.key) rows.set(r.dataset.key, r.getBoundingClientRect().top);
  return { sig, rows, after: below(box).map((n) => [n, n.getBoundingClientRect().top]) };
};
export const useListFlip = (ref: RefObject<HTMLElement | null>, sig: string) => {
  const shown = useRef<string | null>(null);
  const snap = useRef<FlipSnap | null>(null);
  // render phase, the list about to change: the DOM is still the old one, so this is where every row is on screen now
  if (shown.current != null && sig !== shown.current && snap.current?.sig !== sig && ref.current && !reduced()) snap.current = snapOf(ref.current, sig);
  useLayoutEffect(() => {
    const was = snap.current;
    snap.current = null;
    shown.current = sig;
    const box = ref.current;
    if (!box || !was || was.sig !== sig) return;
    for (const r of box.children as HTMLCollectionOf<HTMLElement>) {
      const k = r.dataset.key;
      if (!k) continue;
      const old = was.rows.get(k);
      if (old == null) {
        r.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: 'cubic-bezier(.22,1,.36,1)' });
        continue;
      }
      carry(r, old - r.getBoundingClientRect().top);
    }
    // what follows the list rides from where it was, too
    for (const [n, top] of was.after) if (n.isConnected) carry(n, top - n.getBoundingClientRect().top);
  }, [sig, ref]);
};

/**
 * A favourite's star pops on `springs.complete` to 1.12 and back on `settle`, and `toggle` fires on the pop's apex frame
 * (§11.4, M34: `hapticAtPeak`). Pass the star's own scale; with no star on screen (a menu item) a free value runs the same
 * curve so the haptic lands when a star would have peaked. Reduced motion: no pop; the haptic still fires (its fallback).
 */
let lastFav = 0;
export const popFav = (scale: MotionValue<number> = motionValue(1)) => {
  // one favourite, one haptic: the same entry may show its star twice at once (a row under its own sheet)
  const now = performance.now();
  const haptic = now - lastFav > 120;
  lastFav = now;
  if (!haptic) {
    if (!reduced()) animate(scale, COMPLETE_SCALE, { ...forScale(springs.complete), onComplete: () => void animate(scale, 1, forScale(springs.settle)) });
    return;
  }
  if (reduced()) {
    const p = motionValue(0);
    hapticAtPeak(p, 'toggle');
    p.set(1);
    return;
  }
  scale.set(1);
  hapticAtPeak(scale, 'toggle');
  animate(scale, COMPLETE_SCALE, { ...forScale(springs.complete), onComplete: () => void animate(scale, 1, forScale(springs.settle)) });
};
