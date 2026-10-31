import { animate, useMotionValue, type MotionValue } from 'motion/react';
import type * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { LOCK_PX, lockAxis, PROJECT_S, SWIPE_FULL_FRAC, SWIPE_FULL_V } from '@/lib/gesture';
import { haptics } from '@/lib/haptics';
import { springs } from '@/lib/motion';
import { useHoldDrag, type CancelReason, type DragPhase, type DragPoint } from '@/lib/useDrag';
import { swallowClickOf } from '@/ui/clickSwallow';
import { AUTO_SCROLL_EDGE, clampStart, LABEL_W, minutesAtY, snap15, type DayWindow } from './layout';

/**
 * The timeline's gestures (docs/today-v6.md §3), each built on the one hold clock (`useHold` through `useHoldDrag`) or on
 * Pressable's drag callbacks: place (a tray chip into the timeline), move and resize (a block), the swipe that unschedules.
 * The page's scroll is the tab's `.tab-scroll`; a drag near the viewport's top or bottom nudges it.
 */

export type Point = { x: number; y: number };

/** The tab's scroller (the page scrolls inside it, never the document). */
export const tabScroller = () => document.querySelector<HTMLElement>('.tab[data-active] .tab-scroll');

/**
 * While a drag is live: nudge the scroller when the finger sits within 64 px of the viewport's top or bottom (inside the
 * scroller's own box), up to 16 px a frame, and call `onScroll` after each nudge so the target under the still finger
 * follows. Returns the stop.
 */
export const startAutoScroll = (point: () => Point, onScroll: () => void): (() => void) => {
  const scroller = tabScroller();
  let raf = 0;
  const tick = () => {
    const p = point();
    const box = scroller?.getBoundingClientRect();
    const top = Math.max(box?.top ?? 0, 0);
    const bottom = Math.min(box?.bottom ?? window.innerHeight, window.innerHeight);
    let dy = 0;
    if (p.y < top + AUTO_SCROLL_EDGE) dy = -Math.ceil(((top + AUTO_SCROLL_EDGE - p.y) / AUTO_SCROLL_EDGE) * 16);
    else if (p.y > bottom - AUTO_SCROLL_EDGE) dy = Math.ceil(((p.y - (bottom - AUTO_SCROLL_EDGE)) / AUTO_SCROLL_EDGE) * 16);
    if (dy && scroller) {
      const before = scroller.scrollTop;
      scroller.scrollTop += Math.max(-16, Math.min(16, dy));
      if (scroller.scrollTop !== before) onScroll();
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
};

/** Where the finger is on the timeline, in minutes (unsnapped), or null when it is off it (the label column included). */
export const timeAtPoint = (tl: HTMLElement | null, p: Point, w: DayWindow, pad = 24): number | null => {
  if (!tl) return null;
  const r = tl.getBoundingClientRect();
  if (p.x < r.left + LABEL_W - 8 || p.x > r.right + pad || p.y < r.top - pad || p.y > r.bottom + pad) return null;
  return minutesAtY(p.y - r.top, w);
};
/** The start a dropped block gets under the finger: snapped, inside the window. */
export const startAtPoint = (tl: HTMLElement | null, p: Point, w: DayWindow, minutes: number): number | null => {
  const t = timeAtPoint(tl, p, w);
  return t == null ? null : clampStart(snap15(t), minutes, w);
};
export const inside = (r: DOMRect | undefined, p: Point, pad = 0) => !!r && p.x >= r.left - pad && p.x <= r.right + pad && p.y >= r.top - pad && p.y <= r.bottom + pad;

// ---------- the ghost: a chip in the air, following the finger ----------
export interface GhostValues {
  x: MotionValue<number>;
  y: MotionValue<number>;
  scale: MotionValue<number>;
  fade: MotionValue<number>;
}
/** The motion values a floating ghost is drawn from, and the moves on them. Reduced motion: no spring, no scale. */
export const useGhostValues = (reduce: boolean) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  const fade = useMotionValue(1);
  const values: GhostValues = { x, y, scale, fade };
  return {
    values,
    /** Lift at a rect: the ghost appears where the chip was, grown a touch. */
    lift: (r: DOMRect) => {
      x.set(r.left);
      y.set(r.top);
      fade.set(1);
      scale.set(1);
      if (!reduce) animate(scale, 1.03, springs.lift);
    },
    follow: (left: number, top: number) => {
      x.set(left);
      y.set(top);
    },
    /** Settle into a rect (a drop or a snap back), then `end`. */
    settle: (r: DOMRect | null, end: () => void) => {
      if (!r || reduce) return end();
      animate(scale, 1, springs.settle);
      void Promise.all([animate(x, r.left, springs.settle), animate(y, r.top, springs.settle)]).then(end);
    },
    /** Settle onto a rect while fading (the chip became a block), then `end`. */
    land: (r: DOMRect | null, end: () => void) => {
      if (!r || reduce) return end();
      animate(scale, 1, springs.settle);
      animate(x, r.left, springs.settle);
      animate(y, r.top, springs.settle);
      void animate(fade, 0, { duration: 0.24, ease: [0.22, 1, 0.36, 1] }).then(end);
    },
    /** Shrink and fade away (the chip became something else), then `end`. */
    vanish: (end: () => void) => {
      if (reduce) return end();
      animate(scale, 0.6, { duration: 0.22, ease: [0.22, 1, 0.36, 1] });
      void animate(fade, 0, { duration: 0.22 }).then(end);
    },
  };
};

// ---------- the block's hold: move from its body, resize from its bottom edge ----------
export type BlockMode = 'move' | 'resize';
export interface BlockHoldOpts {
  disabled?: boolean;
  /** The bottom grab zone resizes (a derived session block only moves). */
  resizable?: boolean;
  /** The grab zone's height. */
  zone?: number;
  onArm: (mode: BlockMode, el: HTMLElement) => void;
  onStart: (mode: BlockMode, p: DragPoint, el: HTMLElement) => void;
  onMove: (mode: BlockMode, p: DragPoint) => void;
  onDrop: (mode: BlockMode, p: DragPoint) => void;
  /** Armed and released without a move: the hold menu's moment. Dragging and taken away: the drag reverts. */
  onCancel: (mode: BlockMode, phase: DragPhase, reason: CancelReason, el: HTMLElement | null) => void;
}
/**
 * A hold on a block (450 ms, the one clock) lifts it; a drag then moves it, or, when the hold began in the bottom grab
 * zone of a block tall enough to have one, resizes it. Letting go armed and unmoved is the menu's cue.
 */
export const useBlockHold = <E extends HTMLElement = HTMLDivElement>(opts: BlockHoldOpts) => {
  const o = useRef(opts);
  o.current = opts;
  const mode = useRef<BlockMode>('move');
  const [held, setHeld] = useState<BlockMode | null>(null);
  const d = useHoldDrag<E>({
    disabled: opts.disabled,
    onArm: () => {
      const el = d.ref.current;
      if (!el) return;
      setHeld(mode.current);
      haptics.lift();
      o.current.onArm(mode.current, el);
    },
    onStart: (p) => {
      const el = d.ref.current;
      if (el) o.current.onStart(mode.current, p, el);
    },
    onMove: (p) => o.current.onMove(mode.current, p),
    onDrop: (p) => {
      setHeld(null);
      o.current.onDrop(mode.current, p);
    },
    onCancel: (phase, reason) => {
      setHeld(null);
      o.current.onCancel(mode.current, phase, reason, d.ref.current);
    },
  });
  const onPointerDown = (e: React.PointerEvent) => {
    const el = d.ref.current;
    if (el && o.current.resizable) {
      const r = el.getBoundingClientRect();
      const zone = o.current.zone ?? 24;
      mode.current = r.height >= zone + 16 && e.clientY >= r.bottom - zone ? 'resize' : 'move';
    } else mode.current = 'move';
    d.bind.onPointerDown(e);
  };
  return { ref: d.ref, bind: { ...d.bind, onPointerDown }, held, phase: d.phase, consumeClick: d.consumeClick, cancel: d.cancel };
};

// ---------- swipe left: back to the tray ----------
export interface SwipeLeftOpts {
  disabled?: boolean;
  onCommit: () => void;
}
/**
 * A swipe to the left on a block (docs/feel.md §11.3's rules, inside the day pager): the first 10 px inside the 40° cone
 * decide, so a vertical scroll always wins and a hold that has not fired yet is let go; the content follows 1:1 to the
 * left only; released past 0.55 W or flicked at ≥ 600 px/s it is full: the content slides out and `onCommit` runs; short
 * of that it springs home (no reveal detent: the action is one). The element carries `data-no-page`, so the pager never
 * takes a pointer that starts on it.
 */
export const useSwipeLeft = (opts: SwipeLeftOpts) => {
  const x = useMotionValue(0);
  const o = useRef(opts);
  o.current = opts;
  const g = useRef({ id: -1, x0: 0, y0: 0, lock: null as null | 'x' | 'y', w: 1, armed: false, fired: false, busy: false });
  const [armed, setArmed] = useState(false);
  const [swiping, setSwiping] = useState(false);
  useEffect(() => () => x.stop(), [x]);
  const home = (v = 0) => animate(x, 0, { ...springs.settle, velocity: v });
  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    const st = g.current;
    if (o.current.disabled || st.busy || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if ((e.target as Element).closest('.mark-hit, .cm-sr')) return;
    x.stop();
    st.id = e.pointerId;
    st.x0 = e.clientX;
    st.y0 = e.clientY;
    st.lock = null;
    st.armed = false;
    st.fired = false;
    st.w = e.currentTarget.offsetWidth || 1;
  };
  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const st = g.current;
    if (e.pointerId !== st.id) return;
    const dx = e.clientX - st.x0;
    const dy = e.clientY - st.y0;
    if (!st.lock) {
      if (Math.hypot(dx, dy) < LOCK_PX) return;
      const ax = lockAxis(dx, dy);
      if (ax !== 'x' || dx > 0) {
        st.lock = 'y';
        st.id = -1;
        return;
      }
      st.lock = 'x';
      setSwiping(true);
      swallowClickOf(e.pointerId);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* gone */
      }
    }
    const v = Math.max(-st.w, Math.min(0, dx));
    x.set(v);
    const over = -v >= st.w * SWIPE_FULL_FRAC;
    if (over !== st.armed) {
      st.armed = over;
      setArmed(over);
      if (over && !st.fired) {
        st.fired = true;
        haptics.threshold();
      }
    }
  };
  const onPointerEnd = (e: React.PointerEvent<HTMLElement>, cancelled: boolean) => {
    const st = g.current;
    if (e.pointerId !== st.id) return;
    st.id = -1;
    if (st.lock !== 'x') return;
    setSwiping(false);
    const cur = x.get();
    const v = cancelled ? 0 : x.getVelocity();
    st.armed = false;
    const full = !cancelled && (-cur >= st.w * SWIPE_FULL_FRAC || (v <= -SWIPE_FULL_V && cur + v * PROJECT_S < -st.w * 0.3));
    if (full) {
      st.busy = true;
      animate(x, -st.w, { ...springs.settle, velocity: v, onComplete: () => o.current.onCommit() });
      return;
    }
    setArmed(false);
    home(v);
  };
  return {
    x,
    armed,
    swiping,
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (e: React.PointerEvent<HTMLElement>) => onPointerEnd(e, false),
      onPointerCancel: (e: React.PointerEvent<HTMLElement>) => onPointerEnd(e, true),
    },
  };
};
