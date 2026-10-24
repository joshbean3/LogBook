import { useLayoutEffect, useRef, type RefObject } from 'react';
import { springs } from '@/lib/motion';
import { springAdvance, springParams } from '@/ui/springSim';

/**
 * The FLIP rule (docs/feel.md §10.1) for Plan's week group: when a row moves (a drop, a swap, a two-session day losing one,
 * the conflict row coming or going), the layout commits once and the motion is transform. `capture()` reads where every
 * day and every session row of the group is just before the change; the layout effect after the change puts each one that
 * moved back where it was with an inverse `translateY` and releases it to 0 on `springs.settle`, as a compositor (WAAPI)
 * animation whose `linear()` easing is the spring itself, so the reflow costs no main-thread frames. A row that changed day
 * (a remount) is matched by its session id. Only the shown week captures, so the neighbours do no work.
 */

/** `springs.settle` sampled as a WAAPI `linear()` easing (progress 0 → 1, overshoot included) and its duration to rest. */
export const settleEasing = (() => {
  const p = springParams(springs.settle);
  const pts: number[] = [];
  let x = 1;
  let v = 0;
  const STEP = 1 / 120;
  for (let i = 0; i < 240; i++) {
    pts.push(1 - x);
    if (i > 2 && Math.abs(x) < 0.001 && Math.abs(v) < 0.01) break;
    [x, v] = springAdvance(p, x, v, 0, STEP);
  }
  pts[pts.length - 1] = 1;
  return { easing: `linear(${pts.map((n) => +n.toFixed(4)).join(', ')})`, duration: Math.round((pts.length - 1) * STEP * 1000) };
})();

const keyOf = (el: HTMLElement) => (el.dataset.sessionId ? `s:${el.dataset.sessionId}` : el.dataset.planDay ? `d:${el.dataset.planDay}` : null);

export const useFlip = (root: RefObject<HTMLElement | null>) => {
  /** The rows' tops (relative to the group, so a scroll in between moves nothing) as last laid out, and until when to watch. */
  const st = useRef<{ until: number; tops: Map<string, number> } | null>(null);
  const running = useRef(new Map<HTMLElement, Animation>());
  const items = () => Array.from(root.current?.querySelectorAll<HTMLElement>('[data-plan-day], [data-session-id]') ?? []);
  const top0 = () => root.current?.getBoundingClientRect().top ?? 0;

  // every render inside the window: one change can land in several renders (the conflict row now, the moved data a task
  // later), and each one that moves rows animates them from where they are on screen
  useLayoutEffect(() => {
    const p = st.current;
    if (!p) return;
    if (performance.now() > p.until) {
      st.current = null;
      return;
    }
    const els = items();
    const base = top0();
    // on screen now (a FLIP still running included), then laid out
    const visual = new Map(els.map((el) => [el, el.getBoundingClientRect().top - base] as const));
    for (const a of running.current.values()) a.cancel();
    running.current.clear();
    const laid = new Map(els.map((el) => [el, el.getBoundingClientRect().top - base] as const));
    const dyOf = new Map<HTMLElement, number>();
    for (const el of els) {
      const k = keyOf(el);
      const was = k ? p.tops.get(k) : undefined;
      // where it was on screen: its old layout top plus the offset its running FLIP still shows
      if (was != null) dyOf.set(el, was + (visual.get(el)! - laid.get(el)!) - laid.get(el)!);
    }
    p.tops = new Map(els.map((el) => [keyOf(el) ?? '', laid.get(el)!] as const));
    // reduced motion: the rows are simply where they are now (§10.2)
    if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (const [el, dy] of dyOf) {
      // a row inside a day that moves rides its day's transform: only what moves relative to its day animates
      const day = el.dataset.sessionId ? el.closest<HTMLElement>('[data-plan-day]') : null;
      const rel = dy - (day ? (dyOf.get(day) ?? 0) : 0);
      // the dropped session lands under the pill (useDayDrag), not by sliding from where it was
      if (Math.abs(rel) <= 0.5 || el.hasAttribute('data-landing')) continue;
      const a = el.animate([{ transform: `translateY(${rel}px)` }, { transform: 'translateY(0px)' }], settleEasing);
      running.current.set(el, a);
      a.onfinish = () => running.current.delete(el);
    }
  });

  /** Read the group's rows before a change that moves them; the renders of the next 1.5 s animate what moved. */
  return () => {
    const base = top0();
    const tops = new Map<string, number>();
    for (const el of items()) {
      const k = keyOf(el);
      if (k) tops.set(k, el.getBoundingClientRect().top - base);
    }
    st.current = { until: performance.now() + 1500, tops };
  };
};
