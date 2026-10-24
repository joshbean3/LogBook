import { animate, motionValue, type MotionValue } from 'motion/react';
import { useLayoutEffect, useRef, type RefObject } from 'react';
import { hapticAtPeak } from '@/lib/haptics';
import { COMPLETE_SCALE, forScale, springs } from '@/lib/motion';

/**
 * The FLIP rule (docs/feel.md §10.1) for WP6's pages: when a box changes size, the layout commits once and what moved is
 * carried back with a transform that springs to 0 on `springs.settle`. Nothing animates height, padding or top.
 */

const SCROLLERS = '.sheet-body, .pushed, .tab-scroll';
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The running carry of an element (so a second change re-bases from where it is on screen, never jumps). */
const carries = new WeakMap<HTMLElement, { y: MotionValue<number>; off: () => void }>();

/** Translate `el` by `d` px now (on this task, before the next paint) and spring it to 0 on `settle`. */
export const carry = (el: HTMLElement, d: number) => {
  const run = carries.get(el);
  const from = (run ? run.y.get() : 0) + d;
  run?.y.stop();
  run?.off();
  if (Math.abs(from) < 0.5 || reduced()) {
    carries.delete(el);
    el.style.transform = '';
    return;
  }
  const y = motionValue(from);
  const tr = el.style.transition;
  el.style.transition = 'none';
  el.style.transform = `translateY(${from}px)`;
  const off = y.on('change', (v) => (el.style.transform = Math.abs(v) < 0.01 ? '' : `translateY(${v}px)`));
  carries.set(el, { y, off });
  // the spring's clock starts on the frame that paints the inverse (a long commit frame is not elapsed time)
  requestAnimationFrame(() =>
    animate(y, 0, {
      ...springs.settle,
      onComplete: () => {
        off();
        if (carries.get(el)?.y === y) carries.delete(el);
        el.style.transform = '';
        el.style.transition = tr;
      },
    }),
  );
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

/** Everything after `el` in its scroller: its later siblings, then what follows each ancestor up to the scroller. */
export const below = (el: Element): HTMLElement[] => {
  const out: HTMLElement[] = [];
  const scroller = el.closest(SCROLLERS);
  for (let a: Element | null = el; a && a !== scroller; a = a.parentElement) for (let n = a.nextElementSibling; n; n = n.nextElementSibling) out.push(n as HTMLElement);
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
 * A list whose rows insert, leave or reorder (Entries, Reads, your quotes): every row that stays is carried from its old
 * place on `settle`; a new row fades in over 150 ms (opacity only); what follows the list rides along. Rows are the
 * container's children, keyed by `data-key`.
 */
export const useListFlip = (ref: RefObject<HTMLElement | null>, sig: string) => {
  const prev = useRef<Map<string, number> | null>(null);
  const prevBottom = useRef<number | null>(null);
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    const rows = [...box.children] as HTMLElement[];
    const now = new Map<string, number>();
    for (const r of rows) if (r.dataset.key) now.set(r.dataset.key, r.offsetTop);
    const was = prev.current;
    if (was && !reduced()) {
      for (const r of rows) {
        const k = r.dataset.key;
        if (!k) continue;
        const old = was.get(k);
        if (old == null) {
          r.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: 'cubic-bezier(.22,1,.36,1)' });
          continue;
        }
        carry(r, old - r.offsetTop);
      }
      // what follows the list moves by the list's change in height
      const bottom = box.offsetHeight;
      if (prevBottom.current != null && bottom !== prevBottom.current) for (const n of below(box)) carry(n, prevBottom.current - bottom);
    }
    prev.current = now;
    prevBottom.current = box.offsetHeight;
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
