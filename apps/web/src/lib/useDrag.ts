import type { TargetAndTransition, Transition } from 'motion/react';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { HOLD_MS as ONE_HOLD } from './gesture';
import { deprecated, LIFT_SCALE, springs } from './motion';

/**
 * Press-and-hold drags for the things that move: a habit orb, a session row, a block on the morning timeline.
 *
 * The grammar is the same everywhere (brand §9.5; it keeps rules 1 and 4: nothing moves on load, nothing runs long or
 * ambient): the pointer rests for `holdMs`, the thing lifts (scale 1.03, surface-2, a line-strong hairline, no shadow,
 * one haptic), it follows the finger, and on release it springs back (stiffness 400, damping 30). Under reduced motion
 * nothing scales: the lift is the surface and the hairline alone, and every move is instant.
 * Until the hold is up the page scrolls as usual; once it is up, touch scrolling is held off so the drag owns the finger.
 */

/** @deprecated the one hold clock lives in lib/gesture.ts (450 ms); re-exported here (contracts rule 5). */
export const HOLD_MS = ONE_HOLD;
/** How far the pointer may wander during the hold before it counts as a scroll, and how far it must travel after it to count as a drag. */
export const SLOP = 6;

/** @deprecated use `springs.settle` (contracts rule 5). */
export const DROP_SPRING: Transition = springs.settle;
export const INSTANT: Transition = { duration: 0 };
/** @deprecated the lift is `LIFT_SCALE` on `springs.lift`. */
export const LIFT: TargetAndTransition = { scale: LIFT_SCALE };
/** @deprecated the rest is scale 1 on `springs.settle`. */
export const REST: TargetAndTransition = { scale: 1 };
/** @deprecated what to animate to for a lifted or a resting thing: the lift on `springs.lift`, the drop on `springs.settle`; reduced motion instant. */
export const liftFx = (lifted: boolean, reduce: boolean | null): TargetAndTransition => {
  deprecated('liftFx');
  return reduce ? { scale: 1, transition: INSTANT } : lifted ? { scale: LIFT_SCALE, transition: springs.lift } : { scale: 1, transition: springs.settle };
};

export type DragPhase = 'idle' | 'pending' | 'armed' | 'dragging';
export type CancelReason = 'up' | 'cancel';
export interface DragPoint {
  x: number;
  y: number;
  dx: number;
  dy: number;
}

interface HoldDragOpts {
  /** 0 arms on the first touch (a dedicated handle); the default waits for the pointer to rest. */
  holdMs?: number;
  disabled?: boolean;
  /** the hold is up: the pointer rested for `holdMs` without wandering */
  onArm?: (e: PointerEvent) => void;
  /** the first movement past the slop after the arm: the drag proper */
  onStart?: (p: DragPoint, e: PointerEvent) => void;
  onMove?: (p: DragPoint, e: PointerEvent) => void;
  /** the pointer lifted after a drag */
  onDrop?: (p: DragPoint, e: PointerEvent) => void;
  /**
   * armed, or dragging, and it came to nothing. `reason` says how: 'up' is the finger lifting without a drag (a deliberate
   * release); 'cancel' is the browser taking the pointer away (a palm, a call) or an explicit cancel().
   */
  onCancel?: (phase: DragPhase, reason: CancelReason) => void;
  /** scroll the page when a drag nears the top or bottom edge */
  autoScroll?: boolean;
}

const EDGE = 72;
const MAX_STEP = 16;
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

export const useHoldDrag = <E extends HTMLElement = HTMLElement>(opts: HoldDragOpts) => {
  const ref = useRef<E | null>(null);
  const [phase, setPhase] = useState<DragPhase>('idle');
  const o = useRef(opts);
  o.current = opts;
  const s = useRef({
    phase: 'idle' as DragPhase,
    id: -1,
    x0: 0,
    y0: 0,
    x: 0,
    y: 0,
    timer: null as ReturnType<typeof setTimeout> | null,
    raf: 0,
    dragged: false,
    off: null as null | (() => void),
  });

  const go = (p: DragPhase) => {
    s.current.phase = p;
    setPhase(p);
  };
  const point = (e: PointerEvent): DragPoint => ({ x: e.clientX, y: e.clientY, dx: e.clientX - s.current.x0, dy: e.clientY - s.current.y0 });

  const reset = useCallback(() => {
    const st = s.current;
    if (st.timer) clearTimeout(st.timer);
    st.timer = null;
    if (st.raf) cancelAnimationFrame(st.raf);
    st.raf = 0;
    st.off?.();
    st.off = null;
    st.id = -1;
    if (st.phase !== 'idle') go('idle');
  }, []);

  /** Drop whatever is in flight: used when something else claims the press, like a long-press sheet. */
  const cancel = useCallback(() => {
    const was = s.current.phase;
    reset();
    if (was === 'armed' || was === 'dragging') o.current.onCancel?.(was, 'cancel');
  }, [reset]);

  const arm = (e: PointerEvent) => {
    const st = s.current;
    st.timer = null;
    go('armed');
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== st.id) return;
      st.x = ev.clientX;
      st.y = ev.clientY;
      const p = point(ev);
      if (st.phase === 'armed') {
        if (dist(ev.clientX, ev.clientY, st.x0, st.y0) < SLOP) return;
        st.dragged = true;
        go('dragging');
        o.current.onStart?.(p, ev);
        if (o.current.autoScroll) scrollLoop(ev);
      }
      o.current.onMove?.(p, ev);
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== st.id) return;
      const was = st.phase;
      const p = point(ev);
      reset();
      if (was === 'dragging') o.current.onDrop?.(p, ev);
      else o.current.onCancel?.(was, 'up');
    };
    const onCancel = (ev: PointerEvent) => {
      if (ev.pointerId !== st.id) return;
      const was = st.phase;
      reset();
      o.current.onCancel?.(was, 'cancel');
    };
    const opt = { capture: true, passive: true } as const;
    window.addEventListener('pointermove', onMove, opt);
    window.addEventListener('pointerup', onUp, opt);
    window.addEventListener('pointercancel', onCancel, opt);
    st.off = () => {
      window.removeEventListener('pointermove', onMove, opt);
      window.removeEventListener('pointerup', onUp, opt);
      window.removeEventListener('pointercancel', onCancel, opt);
    };
    o.current.onArm?.(e);
  };

  /** Nudge the page while the finger sits near an edge, and keep the drop target honest while it moves. */
  const scrollLoop = (last: PointerEvent) => {
    const st = s.current;
    // the page scrolls inside its own scroller (a tab, a pushed page, a sheet), never the document
    const scroller = ref.current?.closest<HTMLElement>('.sheet-body, .pushed, .tab-scroll') ?? null;
    const tick = () => {
      if (st.phase !== 'dragging') return;
      const box = scroller?.getBoundingClientRect();
      const top = box?.top ?? 0;
      const bottom = box?.bottom ?? window.innerHeight;
      let dy = 0;
      if (st.y < top + EDGE) dy = -Math.ceil(((top + EDGE - st.y) / EDGE) * MAX_STEP);
      else if (st.y > bottom - EDGE) dy = Math.ceil(((st.y - (bottom - EDGE)) / EDGE) * MAX_STEP);
      if (dy && scroller) {
        const before = scroller.scrollTop;
        scroller.scrollTop += dy;
        if (scroller.scrollTop !== before) o.current.onMove?.({ x: st.x, y: st.y, dx: st.x - st.x0, dy: st.y - st.y0 }, last);
      }
      st.raf = requestAnimationFrame(tick);
    };
    st.raf = requestAnimationFrame(tick);
  };

  // once the hold is up, the first touch move would start a scroll: hold it off so the drag keeps the finger
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      const p = s.current.phase;
      if ((p === 'armed' || p === 'dragging') && e.cancelable) e.preventDefault();
    };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
  });
  useEffect(() => reset, [reset]);

  const bind = {
    onPointerDown: (e: React.PointerEvent) => {
      if (o.current.disabled || e.button !== 0 || !e.isPrimary) return;
      const st = s.current;
      reset();
      st.id = e.pointerId;
      st.x0 = st.x = e.clientX;
      st.y0 = st.y = e.clientY;
      st.dragged = false;
      const hold = o.current.holdMs ?? HOLD_MS;
      const native = e.nativeEvent;
      if (hold <= 0) arm(native);
      else {
        go('pending');
        st.timer = setTimeout(() => arm(native), hold);
      }
    },
    onPointerMove: (e: React.PointerEvent) => {
      const st = s.current;
      if (st.phase !== 'pending' || e.pointerId !== st.id) return;
      if (dist(e.clientX, e.clientY, st.x0, st.y0) >= SLOP) reset();
    },
    onPointerUp: () => {
      if (s.current.phase === 'pending') reset();
    },
    onPointerLeave: () => {
      if (s.current.phase === 'pending') reset();
    },
    onPointerCancel: () => {
      if (s.current.phase === 'pending') reset();
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };

  /** True once after a drag, for the click that follows a release. */
  const consumeClick = () => {
    const d = s.current.dragged;
    s.current.dragged = false;
    return d;
  };

  return { ref, phase, bind, cancel, consumeClick };
};

// ---------- drop targets: a day cell that takes a session ----------
export const DROP_ATTR = 'data-drop-day';
export const DROP_CLASS = 'is-drop';

/** Label the `.dcell` buttons under `ref`, in order, with the days they stand for, so a dragged session can land on them. */
export const useDropDays = (ref: RefObject<HTMLElement | null>, days: string[]) => {
  const key = days.join(',');
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const cells = Array.from(root.querySelectorAll<HTMLElement>('.dcell'));
    cells.forEach((el, i) => {
      const d = days[i];
      if (d) el.setAttribute(DROP_ATTR, d);
      else el.removeAttribute(DROP_ATTR);
    });
    return () => cells.forEach((el) => el.removeAttribute(DROP_ATTR));
  }, [ref, key]); // eslint-disable-line react-hooks/exhaustive-deps
};

/** The day cell under a point, if any. */
export const hitDropDay = (x: number, y: number): { day: string; el: HTMLElement } | null => {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>(`[${DROP_ATTR}]`) ?? null;
  const day = el?.getAttribute(DROP_ATTR);
  return el && day ? { day, el } : null;
};

/** The ring over a lit cell lives on the body, above the thing in the air, so the copy under the finger never hides it. */
const RING_ID = 'drop-ring';
const ring = () => {
  let el = document.getElementById(RING_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = RING_ID;
    el.className = 'drop-ring';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
  }
  return el;
};
const placeRing = (cell: HTMLElement | null) => {
  const el = ring();
  if (!cell) {
    el.style.display = 'none';
    return;
  }
  const r = (cell.querySelector<HTMLElement>('.dcell-pill') ?? cell).getBoundingClientRect();
  el.style.cssText = `display:block;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
};

/** Tracks which cell is lit under a drag; returns the day it changed to, or undefined when it did not change. */
export const useDropOver = () => {
  const over = useRef<{ day: string; el: HTMLElement } | null>(null);
  const set = useCallback((hit: { day: string; el: HTMLElement } | null): string | null | undefined => {
    const cur = over.current;
    // the page may have scrolled under the finger: keep the ring on the cell
    placeRing(hit?.el ?? null);
    if (cur?.el === hit?.el) return undefined;
    cur?.el.classList.remove(DROP_CLASS);
    hit?.el.classList.add(DROP_CLASS);
    over.current = hit;
    return hit ? hit.day : null;
  }, []);
  const clear = useCallback(() => {
    over.current?.el.classList.remove(DROP_CLASS);
    over.current = null;
    placeRing(null);
  }, []);
  useEffect(() => clear, [clear]);
  return { set, clear, current: () => over.current };
};

// ---------- what is being dragged right now, for the parts of a page that answer a drag ----------
export type DragInfo = { kind: 'session'; date: string; id: string } | null;
let current: DragInfo = null;
const subs = new Set<(d: DragInfo) => void>();
export const setDragInfo = (d: DragInfo) => {
  current = d;
  for (const f of subs) f(d);
};
export const getDragInfo = () => current;
export const useDragInfo = () => {
  const [d, setD] = useState<DragInfo>(current);
  useEffect(() => {
    subs.add(setD);
    setD(current);
    return () => {
      subs.delete(setD);
    };
  }, []);
  return d;
};
