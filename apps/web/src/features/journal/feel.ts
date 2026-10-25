import { animate, motionValue, type MotionValue } from 'motion/react';
import { startTransition, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
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
 * What a pushed page holds below its first screen (review 2 feel N1). The push's own commit draws the bar and everything on
 * the first screen, so the page is whole on the slide's first frame (iOS pushes are opaque from frame 1; never an empty
 * page sliding in, no body fade). What is below the fold follows once the slide has come to rest (the layer's inline
 * transform is back at none: read from its style attribute, never a layout or style read), as a transition render, so its
 * commit never lands inside the slide; with no layer, or after 1.2 s at most, it follows anyway. Off screen, no fade.
 */
export const useBelowFold = (page: RefObject<HTMLElement | null>): boolean => {
  const [rest, setRest] = useState(false);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = () => {
      const layer = page.current?.closest<HTMLElement>('.pushed');
      const tf = layer?.style.transform ?? '';
      if (!layer || !tf || tf === 'none' || /^translateX\(0(px)?\)$/.test(tf) || performance.now() - t0 > 1200) return startTransition(() => setRest(true));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [page]);
  return rest;
};

/**
 * The screen's height, read once and on `resize` (never inside a push's commit: `innerHeight` can force a layout), for the
 * first-screen cuts below (review 3 code N2: a cut is the screen, never a fixed count).
 */
let viewportH = typeof window !== 'undefined' ? window.innerHeight || 844 : 844;
if (typeof window !== 'undefined') window.addEventListener('resize', () => (viewportH = window.innerHeight || viewportH), { passive: true });
/** How many rows of `rowH` px reach the screen when the list starts no higher than `top` px, plus one under the edge. */
export const rowsOnScreen = (top: number, rowH: number): number => Math.max(1, Math.ceil((viewportH - top) / rowH) + 1);

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

/**
 * A box's chrome (a card's background layer) carried from `from` × its height back to 1 on `settle`, top-anchored. `from`
 * is the at-rest ratio (old height / new height). A growth while the last one is still running (review 2 code N4) starts
 * from where the chrome is on screen (the running scale × `from`), stops the running animation, and only the current one
 * clears the transform when it ends, so the edge never shows full height for a frame and never jumps.
 */
const scales = new WeakMap<HTMLElement, { s: MotionValue<number>; off: () => void }>();
export const carryScaleY = (el: HTMLElement, from: number) => {
  if (!Number.isFinite(from) || reduced()) return;
  const run = scales.get(el);
  const start = (run ? run.s.get() : 1) * from;
  run?.s.stop();
  run?.off();
  if (Math.abs(start - 1) < 0.002) {
    scales.delete(el);
    el.style.transform = '';
    return;
  }
  const s = motionValue(start);
  el.style.transformOrigin = '50% 0';
  el.style.transform = `scaleY(${start})`;
  const off = s.on('change', (v) => (el.style.transform = `scaleY(${v})`));
  scales.set(el, { s, off });
  requestAnimationFrame(() => {
    if (scales.get(el)?.s !== s) return;
    animate(s, 1, {
      ...forScale(springs.settle),
      onComplete: () => {
        off();
        if (scales.get(el)?.s !== s) return;
        scales.delete(el);
        el.style.transform = '';
      },
    });
  });
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
    // An ancestor still riding a carry (the composer shrank or the pick landed a frame or two before this commit) is held
    // where it is now and restarted with the rows, so the rows' carries and its own share one clock from the next frame.
    // Measured against an ancestor that kept moving while the rows' springs had not started, a row dipped 17–34 px the
    // wrong way first (review 3: Journal Save, Reads delete just after the pick landed).
    for (let a = box.parentElement; a && !a.matches(SCROLLERS); a = a.parentElement) if (carries.has(a)) carry(a, 0);
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
