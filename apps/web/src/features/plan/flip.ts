import { useLayoutEffect, useRef, type RefObject } from 'react';
import type { Transition } from 'motion/react';
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

/**
 * `springs.settle` as a WAAPI `linear()` easing (progress 0 → 1, overshoot included) for a move of `travel` px, ending on
 * the contract's rest frame (contracts §D.1, `springFor`'s thresholds: within 1 px and under 30 px/s of the target, in px
 * of this travel), so a 60–300 px move completes in ≈ 230–280 ms, not on a sub-pixel tail (code review 1 #3). Sampled at
 * 120 Hz from the same spring the pager integrates (ui/springSim.ts); cached per whole px.
 */
const settleCache = new Map<number, { easing: string; duration: number }>();
export const settleFor = (travel: number) => {
  const px = Math.max(1, Math.round(Math.abs(travel)));
  const hit = settleCache.get(px);
  if (hit) return hit;
  const p = springParams(springs.settle);
  const pts: number[] = [];
  let x = 1;
  let v = 0;
  const STEP = 1 / 120;
  for (let i = 0; i < 240; i++) {
    pts.push(1 - x);
    if (i > 0 && Math.abs(x) * px <= p.rd && Math.abs(v) * px <= p.rs) break;
    [x, v] = springAdvance(p, x, v, 0, STEP);
  }
  pts[pts.length - 1] = 1;
  const out = { easing: `linear(${pts.map((n) => +n.toFixed(4)).join(', ')})`, duration: Math.max(1, Math.round((pts.length - 1) * STEP * 1000)) };
  settleCache.set(px, out);
  return out;
};

/** A tween of lib/motion (`fadeIn`, `crossfade`, `reducedFade`, …) as WAAPI timing: the numbers stay in lib/motion.ts. */
export const waapiOf = (t: Transition): { duration: number; easing: string } => {
  const tt = t as { duration?: number; ease?: string | readonly number[] };
  const e = tt.ease;
  return { duration: (tt.duration ?? 0.15) * 1000, easing: Array.isArray(e) ? `cubic-bezier(${e.join(', ')})` : typeof e === 'string' && e !== 'easeOut' ? e : 'linear' };
};

const keyOf = (el: HTMLElement) => (el.dataset.sessionId ? `s:${el.dataset.sessionId}` : el.dataset.planDay ? `d:${el.dataset.planDay}` : el.dataset.flipKey ? `x:${el.dataset.flipKey}` : null);

/**
 * `extra`: elements outside the root that move with it (the block card under the week group), keyed by their order.
 * `surf`: the group's surface, a plain layer behind the rows (`.pl-wsurf`): while rows FLIP it is scaled (`scaleY` from its
 * top) so its bottom rides the last row, and the space a row left or is about to take stays one surface, never a tear
 * (feel review 2 B).
 */
export const useFlip = (root: RefObject<HTMLElement | null>, extra?: () => HTMLElement[], surf?: () => HTMLElement | null) => {
  /**
   * The rows' tops (relative to the group, so a scroll in between moves nothing) as last laid out, the surface's laid
   * height, until when to watch, and what to run on the first render the change shows in (`after`: the toast, focus).
   */
  const st = useRef<{ until: number; tops: Map<string, number>; keys: string; surfH: number | null; after: (() => void) | null } | null>(null);
  const running = useRef(new Map<HTMLElement, Animation>());
  const surfAnim = useRef<Animation | null>(null);
  const items = () => {
    const own = Array.from(root.current?.querySelectorAll<HTMLElement>('[data-plan-day], [data-session-id]') ?? []);
    const more = extra?.() ?? [];
    more.forEach((el, i) => (el.dataset.flipKey = String(i)));
    return own.concat(more);
  };
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
    const sf = surf?.() ?? null;
    // the surface's scale on screen now (a running FLIP included)
    const sNow = sf && surfAnim.current ? new DOMMatrix(getComputedStyle(sf).transform).d || 1 : 1;
    // on screen now (a FLIP still running included), then laid out
    const visual = new Map(els.map((el) => [el, el.getBoundingClientRect().top - base] as const));
    for (const a of running.current.values()) a.cancel();
    running.current.clear();
    surfAnim.current?.cancel();
    surfAnim.current = null;
    const laid = new Map(els.map((el) => [el, el.getBoundingClientRect().top - base] as const));
    const dyOf = new Map<HTMLElement, number>();
    for (const el of els) {
      const k = keyOf(el);
      const was = k ? p.tops.get(k) : undefined;
      // where it was on screen: its old layout top plus the offset its running FLIP still shows
      if (was != null) dyOf.set(el, was + (visual.get(el)! - laid.get(el)!) - laid.get(el)!);
    }
    p.tops = new Map(els.map((el) => [keyOf(el) ?? '', laid.get(el)!] as const));
    const keys = keysOf(els, root.current);
    const surfFrom = sf && p.surfH != null ? p.surfH * sNow : null;
    const surfH = sf ? sf.offsetHeight : null;
    p.surfH = surfH;
    // the change is in this render (a row moved, came or went): what waits for it runs now, before this frame is painted
    const changed = keys !== p.keys || [...dyOf.values()].some((d) => Math.abs(d) > 0.5) || (surfFrom != null && surfH != null && Math.abs(surfFrom - surfH) > 0.5);
    p.keys = keys;
    if (changed && p.after) {
      const a = p.after;
      p.after = null;
      a();
    }
    // reduced motion: the rows are simply where they are now (§10.2)
    if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (sf && surfFrom != null && surfH && Math.abs(surfFrom - surfH) > 0.5) {
      surfAnim.current = sf.animate([{ transform: `scaleY(${surfFrom / surfH})` }, { transform: 'scaleY(1)' }], settleFor(surfFrom - surfH));
      const a = surfAnim.current;
      a.onfinish = () => surfAnim.current === a && (surfAnim.current = null);
    }
    for (const [el, dy] of dyOf) {
      // a row inside a day that moves rides its day's transform: only what moves relative to its day animates
      const day = el.dataset.sessionId ? el.closest<HTMLElement>('[data-plan-day]') : null;
      const rel = dy - (day ? (dyOf.get(day) ?? 0) : 0);
      // the dropped session lands under the pill (useDayDrag), not by sliding from where it was
      if (Math.abs(rel) <= 0.5 || el.hasAttribute('data-landing')) continue;
      const a = el.animate([{ transform: `translateY(${rel}px)` }, { transform: 'translateY(0px)' }], settleFor(rel));
      running.current.set(el, a);
      a.onfinish = () => running.current.delete(el);
    }
  });

  /**
   * Read the group's rows before a change that moves them; the renders of the next 1.5 s animate what moved. `after` runs
   * in the layout of the first render that shows the change (so a toast rises on the frame the row goes, not before it:
   * feel review 2 B), or after 1.5 s if the change never shows.
   */
  return (after?: () => void) => {
    const base = top0();
    const tops = new Map<string, number>();
    const els = items();
    for (const el of els) {
      const k = keyOf(el);
      if (k) tops.set(k, el.getBoundingClientRect().top - base);
    }
    const prev = st.current?.after;
    // a change asked for while another still waits: the earlier one's words come first
    if (prev) prev();
    const sf = surf?.() ?? null;
    const p = { until: performance.now() + 1500, tops, keys: keysOf(els, root.current), surfH: sf ? sf.offsetHeight : null, after: after ?? null };
    st.current = p;
    if (after)
      setTimeout(() => {
        if (p.after) {
          p.after = null;
          after();
        }
      }, 1500);
  };
};

/** What the group holds, to tell a render that shows a change (a row came, went, or changed its words) from one that does not. */
const keysOf = (els: HTMLElement[], root?: HTMLElement | null) =>
  els
    .map(keyOf)
    .filter((k) => k && !k.startsWith('x:'))
    .join('|') + `#${root?.textContent ?? ''}`;
