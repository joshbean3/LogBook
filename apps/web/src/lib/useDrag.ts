import type { Transition } from 'motion/react';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useHold } from '@/ui/useHold';
import { HOLD_MS } from './gesture';

/**
 * Press-and-hold drags for the things that move: a habit orb, a session row, a block on the morning timeline.
 *
 * The grammar is the same everywhere (brand §9.5; it keeps rules 1 and 4: nothing moves on load, nothing runs long or
 * ambient): the pointer rests for the one hold clock (`useHold`, HOLD_MS 450; `holdMs: 0` arms a dedicated handle on the
 * first touch), the thing lifts (scale 1.03, surface-2, a line-strong hairline, no shadow,
 * one haptic), it follows the finger, and on release it springs back (stiffness 400, damping 30). Under reduced motion
 * nothing scales: the lift is the surface and the hairline alone, and every move is instant.
 * Until the hold is up the page scrolls as usual; once it is up, touch scrolling is held off so the drag owns the finger.
 */

/** How far a dedicated handle (`holdMs: 0`) must travel to count as a drag (a held drag uses the hold's DRAG_START_PX). */
export const SLOP = 6;

export const INSTANT: Transition = { duration: 0 };

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
    raf: 0,
    dragged: false,
    down: null as PointerEvent | null,
    off: null as null | (() => void),
  });

  const go = (p: DragPhase) => {
    s.current.phase = p;
    setPhase(p);
  };

  const reset = useCallback(() => {
    const st = s.current;
    if (st.raf) cancelAnimationFrame(st.raf);
    st.raf = 0;
    st.off?.();
    st.off = null;
    st.id = -1;
    if (st.phase !== 'idle') go('idle');
  }, []);

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

  // the hold half is the one clock (ui/useHold: HOLD_MS, the slop, the drag start, the touchmove held off for the drag only)
  const hold = useHold({
    visual: false,
    disabled: opts.disabled,
    onHold: () => {
      const st = s.current;
      go('armed');
      if (st.down) o.current.onArm?.(st.down);
    },
    onDragStart: (p, e) => {
      const st = s.current;
      st.dragged = true;
      st.x = e.clientX;
      st.y = e.clientY;
      go('dragging');
      o.current.onStart?.(p, e);
      if (o.current.autoScroll) scrollLoop(e);
    },
    onDragMove: (p, e) => {
      const st = s.current;
      st.x = e.clientX;
      st.y = e.clientY;
      o.current.onMove?.(p, e);
    },
    onDragEnd: (p, e, cancelled) => {
      const was = s.current.phase;
      reset();
      if (cancelled) o.current.onCancel?.(was, 'cancel');
      else o.current.onDrop?.(p, e);
    },
    onHoldEnd: (cancelled) => {
      const was = s.current.phase;
      reset();
      o.current.onCancel?.(was === 'idle' ? 'armed' : was, cancelled ? 'cancel' : 'up');
    },
  });

  /** Drop whatever is in flight: used when something else claims the press, like a long-press sheet. */
  const cancel = useCallback(() => {
    const was = s.current.phase;
    hold.cancel();
    reset();
    if (was === 'armed' || was === 'dragging') o.current.onCancel?.(was, 'cancel');
  }, [reset, hold]);

  /** holdMs 0 (a dedicated handle, the alarm's): armed on the first touch, no clock. */
  const armNow = (e: PointerEvent) => {
    const st = s.current;
    go('armed');
    const point = (ev: PointerEvent): DragPoint => ({ x: ev.clientX, y: ev.clientY, dx: ev.clientX - st.x0, dy: ev.clientY - st.y0 });
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
    // the handle owns the finger from the first touch: the scroll is held off on the handle itself, for this drag only
    const el = ref.current;
    const tm = (ev: TouchEvent) => {
      if (ev.cancelable) ev.preventDefault();
    };
    el?.addEventListener('touchmove', tm, { passive: false });
    const opt = { capture: true, passive: true } as const;
    window.addEventListener('pointermove', onMove, opt);
    window.addEventListener('pointerup', onUp, opt);
    window.addEventListener('pointercancel', onCancel, opt);
    st.off = () => {
      el?.removeEventListener('touchmove', tm);
      window.removeEventListener('pointermove', onMove, opt);
      window.removeEventListener('pointerup', onUp, opt);
      window.removeEventListener('pointercancel', onCancel, opt);
    };
    o.current.onArm?.(e);
  };
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
      st.down = e.nativeEvent;
      if ((o.current.holdMs ?? HOLD_MS) <= 0) return armNow(e.nativeEvent);
      go('pending');
      hold.handlers.onPointerDown(e as React.PointerEvent<HTMLElement>);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const st = s.current;
      if (st.phase !== 'pending' || e.pointerId !== st.id) return;
      // the hold let go of it (moved past the slop): the scroll has it
      if (hold.state.current === 'idle') go('idle');
    },
    onPointerUp: () => {
      if (s.current.phase === 'pending') go('idle');
    },
    onPointerLeave: () => undefined,
    onPointerCancel: () => {
      if (s.current.phase === 'pending') go('idle');
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
