import { useCallback, useEffect, useRef, useState } from 'react';
import { haptics } from '@/lib/haptics';

/**
 * Press-and-slide over a chart (Robinhood's scrub, docs/research §3): the finger reads the point under it, the headline
 * rewrites, a selection tick per point and a Light tap on the peak; letting go returns to now. A quick tap is a tap
 * (`onTap`, e.g. open the week). Two fingers pinch (`onPinch`). A mouse hovers to read and clicks to open. Keyboard: arrows
 * read, Enter opens, Escape lets go.
 *
 * Vertical scrolling still wins until the scrub has begun (a 160ms hold or a sideways slide); after that the page holds
 * still under the finger.
 */
export interface ScrubOptions {
  count: number;
  /** The point under a client x, or null outside the plot. */
  indexAt: (clientX: number) => number | null;
  /** The point being read, or null when let go. */
  onScrub: (i: number | null) => void;
  onTap?: (i: number) => void;
  /** The point that earns a Light tap instead of a tick (the max). */
  peak?: number | null;
  /** Where the keyboard starts (this week). */
  home?: number;
  /** A pinch: -1 = fingers apart (zoom in), +1 = together (zoom out). Once per gesture. */
  onPinch?: (dir: -1 | 1) => void;
  /** The live pinch ratio while two fingers are down, null after. */
  onPinchMove?: (ratio: number | null) => void;
  disabled?: boolean;
}

const HOLD_MS = 160;
const TAP_MS = 450;
const SLOP = 8;

export const useScrub = (o: ScrubOptions) => {
  const opts = useRef(o);
  opts.current = o;
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const press = useRef<{ id: number; x0: number; y0: number; t0: number; i0: number | null; active: boolean; changed: boolean; last: number | null; timer: ReturnType<typeof setTimeout> | null } | null>(null);
  const pinch = useRef<{ d0: number; fired: boolean } | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const el = useRef<HTMLElement | null>(null);
  const pendingTap = useRef<number | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fireTap = () => {
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = null;
    const i = pendingTap.current;
    pendingTap.current = null;
    if (i != null) opts.current.onTap?.(i);
  };
  const live = useRef(false);

  const emit = (i: number | null) => {
    setActive(i);
    opts.current.onScrub(i);
  };
  // the scrub ticks `select` per week (§11.4: the Progress scrub); `toggle` is for a mark or a star, never a scrub
  const tick = (_i: number) => haptics.select();
  const to = (i: number | null) => {
    const p = press.current;
    if (!p || i == null || i === p.last) return;
    if (p.last != null) p.changed = true;
    p.last = i;
    tick(i);
    emit(i);
  };
  const activate = (x: number) => {
    const p = press.current;
    if (!p || p.active) return;
    p.active = true;
    live.current = true;
    if (p.timer) clearTimeout(p.timer);
    p.timer = null;
    to(opts.current.indexAt(x));
  };
  const endPress = () => {
    const p = press.current;
    if (p?.timer) clearTimeout(p.timer);
    press.current = null;
    live.current = false;
  };
  const dist = () => {
    const [a, b] = [...pointers.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };

  // while a scrub is live the page must not scroll under the finger
  const ref = useCallback((node: HTMLElement | null) => {
    if (el.current) el.current.removeEventListener('touchmove', block);
    el.current = node;
    if (node) node.addEventListener('touchmove', block, { passive: false });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  function block(e: TouchEvent) {
    if (live.current || e.touches.length > 1) e.preventDefault();
  }
  useEffect(
    () => () => {
      if (press.current?.timer) clearTimeout(press.current.timer);
      if (tapTimer.current) clearTimeout(tapTimer.current);
    },
    [],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (opts.current.disabled) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic pointer */
    }
    if (pointers.current.size === 2) {
      // a second finger: this is a pinch, not a scrub
      endPress();
      emit(null);
      pinch.current = { d0: dist() || 1, fired: false };
      return;
    }
    if (pointers.current.size > 2) return;
    const i0 = opts.current.indexAt(e.clientX);
    press.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: performance.now(), i0, active: false, changed: false, last: null, timer: null };
    if (e.pointerType === 'mouse') activate(e.clientX);
    else {
      const x = e.clientX;
      press.current.timer = setTimeout(() => activate(x), HOLD_MS);
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (opts.current.disabled) return;
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pz = pinch.current;
    if (pz) {
      const r = dist() / pz.d0;
      opts.current.onPinchMove?.(r);
      if (!pz.fired && (r > 1.25 || r < 0.8)) {
        pz.fired = true;
        haptics.select();
        opts.current.onPinch?.(r > 1 ? -1 : 1);
      }
      return;
    }
    const p = press.current;
    if (!p) {
      // a mouse hovering reads the chart without a sound
      if (e.pointerType === 'mouse') emit(opts.current.indexAt(e.clientX));
      return;
    }
    if (e.pointerId !== p.id) return;
    const dx = e.clientX - p.x0;
    const dy = e.clientY - p.y0;
    if (!p.active) {
      if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) activate(e.clientX);
      else if (Math.abs(dy) > 10) endPress(); // a scroll
      return;
    }
    to(opts.current.indexAt(e.clientX));
  };

  const finish = (e: React.PointerEvent<HTMLElement>, cancelled: boolean) => {
    pointers.current.delete(e.pointerId);
    if (pinch.current) {
      if (pointers.current.size < 2) {
        pinch.current = null;
        opts.current.onPinchMove?.(null);
      }
      endPress();
      return;
    }
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    const quick = performance.now() - p.t0 < TAP_MS && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < SLOP && !p.changed;
    endPress();
    if (!cancelled && quick && p.i0 != null && opts.current.onTap) {
      emit(e.pointerType === 'mouse' ? p.i0 : null);
      // open on the click that follows, so it lands here and not on the sheet rising under the finger
      const i = p.i0;
      if (tapTimer.current) clearTimeout(tapTimer.current);
      pendingTap.current = i;
      tapTimer.current = setTimeout(fireTap, 350);
      return;
    }
    // let go: back to now (a mouse keeps reading where it hovers)
    emit(e.pointerType === 'mouse' && !cancelled ? opts.current.indexAt(e.clientX) : null);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    const { count, home = count - 1 } = opts.current;
    const cur = active ?? home;
    let next: number | null = null;
    if (e.key === 'ArrowLeft') next = Math.max(0, (active == null ? home + 1 : cur) - 1);
    else if (e.key === 'ArrowRight') next = Math.min(count - 1, (active == null ? home - 1 : cur) + 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = count - 1;
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      opts.current.onTap?.(cur);
      return;
    } else if (e.key === 'Escape' && active != null) {
      e.stopPropagation();
      emit(null);
      return;
    } else return;
    e.preventDefault();
    if (next !== active) {
      tick(next);
      emit(next);
    }
  };

  return {
    active,
    clear: () => emit(null),
    bind: {
      ref,
      onPointerDown,
      onPointerMove,
      onPointerUp: (e: React.PointerEvent<HTMLElement>) => finish(e, false),
      onPointerCancel: (e: React.PointerEvent<HTMLElement>) => finish(e, true),
      onPointerLeave: (e: React.PointerEvent<HTMLElement>) => {
        if (e.pointerType === 'mouse' && !press.current) emit(null);
      },
      onClick: () => fireTap(),
      onKeyDown,
      onBlur: () => active != null && emit(null),
    },
  };
};
