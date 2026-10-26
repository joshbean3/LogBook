import type * as React from 'react';
import { useEffect, useRef } from 'react';
import { DRAG_START_PX, HOLD_MS, HOLD_SLOP_PX, PREHOLD_MS } from '@/lib/gesture';
import { haptics } from '@/lib/haptics';
import { drop, lift } from './lift';

/**
 * The one hold (docs/feel.md §11.2, contracts §C.3). One clock, `HOLD_MS` (450):
 *
 * | t | what |
 * |---|---|
 * | 0 | the press (Pressable's `data-pressed`; this hook only tracks the pointer) |
 * | 300 ms, no move > 8 px | `data-preholding` (CSS: scale 1.02 over 150 ms). Visual only |
 * | 450 ms, still unmoved | `haptics.lift()` (with the lift; adapters without visuals fire their own); `data-pressed` cleared as `data-lifting` is set; the real element lifts to 1.03 in place on `springs.lift` (`ui/lift.ts`); `onHold` (Pressable opens its menu here) |
 * | release before 450 | the tap: `onPress` (direct callers; Pressable fires its own from the click) |
 * | move > 8 px before 450 | cancel: the scroll or the pager has the pointer (nothing is prevented, nothing captured) |
 * | move > 8 px after 450 | `onDragStart` (`data-dragging`), then `onDragMove`…, `onDragEnd`; a non-passive `touchmove` on the element holds the scroll off for the drag only. With no drag callbacks the move just ends the hold (the menu closes; a pager under it pages) |
 * | right-click, Shift+F10, ContextMenu key | `onHold` at 0 ms |
 *
 * Once a pointer is down, its moves and release are read from capture-phase listeners on `window` (passive), so a pager that
 * captures the pointer after the hold cannot leave the hold stuck; they are removed on release.
 */
export interface HoldInfo {
  x: number;
  y: number;
  target: HTMLElement;
  source: 'touch' | 'mouse' | 'pen' | 'keyboard';
}
export interface DragPoint {
  x: number;
  y: number;
  dx: number;
  dy: number;
}
export type HoldState = 'idle' | 'pressed' | 'preholding' | 'held' | 'dragging';
export interface HoldOpts {
  /** Release before HOLD_MS with no move > HOLD_SLOP_PX: always the tap (direct useHold callers only). */
  onPress?: (e: PointerEvent | KeyboardEvent) => void;
  /** At HOLD_MS, unmoved. */
  onHold?: (info: HoldInfo) => void;
  /** A move > DRAG_START_PX after onHold. */
  onDragStart?: (p: DragPoint, e: PointerEvent) => void;
  onDragMove?: (p: DragPoint, e: PointerEvent) => void;
  onDragEnd?: (p: DragPoint, e: PointerEvent, cancelled: boolean) => void;
  /** Pointers that start inside this selector are ignored (an inner button). */
  ignore?: string;
  disabled?: boolean;
  /**
   * WP1-internal: false = no pre-grow and no in-place lift (`useHoldDrag` callers draw their own). Default true.
   */
  visual?: boolean;
  /** WP1-internal: the element that pre-grows and lifts (default: the element the handlers are on). */
  target?: () => HTMLElement | null;
  /** WP1-internal: the pointer let go after the hold without a drag (`cancelled`: the browser took it). */
  onHoldEnd?: (cancelled: boolean) => void;
  /** WP1-internal: the pointer moved > DRAG_START_PX after the hold and there is no drag (the menu closes; the pager pages). */
  onHoldMoved?: () => void;
}
export interface HoldHandlers {
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLElement>) => void;
  onContextMenu: (e: React.MouseEvent<HTMLElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  /** Swallows the click after a hold. */
  onClickCapture: (e: React.MouseEvent<HTMLElement>) => void;
}

/**
 * Pointers a hold has claimed: a hold whose element can be dragged (`onDragStart`) owns its pointer from the 450 ms lift
 * until it is released, so the pager, the edge pop, the sheet's drag and pull to refresh let it go (consumer review 1 #1,
 * #5). A hold with nothing to drag (the hero) claims nothing: a move after it pages, as §11.2 says. WP1-internal.
 */
const claims = new Set<number>();
/** True when `id` (or, with no id, any pointer) is held for a drag. */
export const pointerClaimed = (id?: number) => (id === undefined ? claims.size > 0 : claims.has(id));

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const sourceOf = (t: string): HoldInfo['source'] => (t === 'pen' ? 'pen' : t === 'mouse' ? 'mouse' : 'touch');

export const useHold = (opts: HoldOpts): { handlers: HoldHandlers; cancel: () => void; state: React.RefObject<HoldState> } => {
  const state = useRef<HoldState>('idle');
  const o = useRef(opts);
  o.current = opts;
  const s = useRef({
    id: -1,
    x0: 0,
    y0: 0,
    el: null as HTMLElement | null,
    lifted: null as HTMLElement | null,
    pre: 0 as ReturnType<typeof setTimeout> | 0,
    hold: 0 as ReturnType<typeof setTimeout> | 0,
    off: null as (() => void) | null,
    swallow: false,
    firedAt: 0,
    kbAt: 0,
  });

  const clearTimers = () => {
    const st = s.current;
    if (st.pre) clearTimeout(st.pre);
    if (st.hold) clearTimeout(st.hold);
    st.pre = st.hold = 0;
  };
  /** End the pointer's hold: timers, listeners, the pre-grow and the lift. */
  const finish = () => {
    const st = s.current;
    clearTimers();
    st.off?.();
    st.off = null;
    claims.delete(st.id);
    st.id = -1;
    st.el?.removeAttribute('data-preholding');
    if (st.lifted) {
      drop(st.lifted);
      st.lifted = null;
    }
    st.el = null;
    state.current = 'idle';
  };
  const cancel = () => {
    const was = state.current;
    finish();
    if (was === 'held') o.current.onHoldEnd?.(true);
  };
  useEffect(() => () => finish(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const point = (e: PointerEvent): DragPoint => ({ x: e.clientX, y: e.clientY, dx: e.clientX - s.current.x0, dy: e.clientY - s.current.y0 });
  const visual = () => o.current.visual !== false;
  const targetEl = (fallback: HTMLElement) => o.current.target?.() ?? fallback;

  const fireHold = (info: HoldInfo, pointer: boolean) => {
    const st = s.current;
    st.firedAt = performance.now();
    if (pointer) {
      st.swallow = true;
      state.current = 'held';
      if (o.current.onDragStart) claims.add(st.id);
    }
    const el = targetEl(info.target);
    // a keyboard or right-click hold has no pointer to end a lift: the menu it opens lifts the element itself
    if (visual() && el && pointer) {
      // data-pressed goes on the frame data-lifting comes (lift() does both); lift() reads the pre-grown scale before it
      // clears data-preholding, so the lift starts at 1.02 and never dips to 1.00 first (WP4 / WP6 requests)
      st.lifted = el;
      lift(el, { reduce: reduced() });
      if (st.el !== el) st.el?.removeAttribute('data-preholding');
      haptics.lift();
    }
    o.current.onHold?.(info);
  };

  const handlers: HoldHandlers = {
    onPointerDown: (e) => {
      const opt = o.current;
      if (opt.disabled || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      if (opt.ignore && e.target instanceof Element && e.target.closest(opt.ignore)) return;
      // a hold with nothing to do (no hold, no drag, no tap) arms nothing
      if (!opt.onHold && !opt.onDragStart && !opt.onPress) return;
      finish();
      const st = s.current;
      st.swallow = false;
      st.id = e.pointerId;
      st.x0 = e.clientX;
      st.y0 = e.clientY;
      st.el = targetEl(e.currentTarget);
      state.current = 'pressed';
      const holdable = !!(opt.onHold || opt.onDragStart);
      const source = sourceOf(e.pointerType);
      const target = e.currentTarget;
      if (holdable) {
        if (visual())
          st.pre = setTimeout(() => {
            st.pre = 0;
            if (state.current !== 'pressed') return;
            state.current = 'preholding';
            st.el?.setAttribute('data-preholding', '');
          }, PREHOLD_MS);
        st.hold = setTimeout(() => {
          st.hold = 0;
          if (state.current !== 'pressed' && state.current !== 'preholding') return;
          fireHold({ x: st.x0, y: st.y0, target, source }, true);
          // the drag needs the touch scroll held off from its first move: the browser decides on the first touchmove
          if (o.current.onDragStart) {
            const el = st.lifted ?? target;
            const tm = (ev: TouchEvent) => {
              if ((state.current === 'held' || state.current === 'dragging') && ev.cancelable) ev.preventDefault();
            };
            el.addEventListener('touchmove', tm, { passive: false });
            const prev = st.off;
            st.off = () => {
              prev?.();
              el.removeEventListener('touchmove', tm);
            };
          }
        }, HOLD_MS);
      }
      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== st.id) return;
        const d = Math.hypot(ev.clientX - st.x0, ev.clientY - st.y0);
        const cur = state.current;
        if (cur === 'pressed' || cur === 'preholding') {
          // the scroll or the pager has it: nothing was prevented, nothing captured
          if (d > HOLD_SLOP_PX) finish();
          return;
        }
        if (cur === 'held') {
          if (d <= DRAG_START_PX) return;
          if (o.current.onDragStart) {
            state.current = 'dragging';
            st.lifted?.setAttribute('data-dragging', '');
            o.current.onDragStart(point(ev), ev);
            o.current.onDragMove?.(point(ev), ev);
          } else {
            // nothing to drag (the hero): the hold ends here; the menu closes and whatever is under the finger has it
            finish();
            o.current.onHoldMoved?.();
          }
          return;
        }
        if (cur === 'dragging') o.current.onDragMove?.(point(ev), ev);
      };
      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== st.id) return;
        const cur = state.current;
        const p = point(ev);
        finish();
        if (cur === 'dragging') o.current.onDragEnd?.(p, ev, false);
        else if (cur === 'held') o.current.onHoldEnd?.(false);
        else if (cur === 'pressed' || cur === 'preholding') o.current.onPress?.(ev);
      };
      const onCancel = (ev: PointerEvent) => {
        if (ev.pointerId !== st.id) return;
        const cur = state.current;
        const p = point(ev);
        finish();
        if (cur === 'dragging') o.current.onDragEnd?.(p, ev, true);
        else if (cur === 'held') o.current.onHoldEnd?.(true);
      };
      const lo = { capture: true, passive: true } as const;
      window.addEventListener('pointermove', onMove, lo);
      window.addEventListener('pointerup', onUp, lo);
      window.addEventListener('pointercancel', onCancel, lo);
      st.off = () => {
        window.removeEventListener('pointermove', onMove, lo);
        window.removeEventListener('pointerup', onUp, lo);
        window.removeEventListener('pointercancel', onCancel, lo);
      };
    },
    // the window listeners above own the pointer once it is down; these stay for the contract's shape
    onPointerMove: () => undefined,
    onPointerUp: () => undefined,
    onPointerCancel: () => undefined,
    onContextMenu: (e) => {
      const opt = o.current;
      if (opt.disabled || !opt.onHold) return;
      if (opt.ignore && e.target instanceof Element && e.target.closest(opt.ignore)) return;
      e.preventDefault();
      const st = s.current;
      const now = performance.now();
      // a touch hold just fired (Android sends contextmenu too), or the keyboard just opened it
      if (now - st.firedAt < 800 || now - st.kbAt < 500) return;
      const target = e.currentTarget;
      const kb = e.clientX === 0 && e.clientY === 0;
      const r = target.getBoundingClientRect();
      finish();
      fireHold({ x: kb ? r.left + r.width / 2 : e.clientX, y: kb ? r.top + r.height / 2 : e.clientY, target, source: kb ? 'keyboard' : 'mouse' }, false);
    },
    onKeyDown: (e) => {
      const opt = o.current;
      if (opt.disabled || !opt.onHold) return;
      if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
        e.preventDefault();
        s.current.kbAt = performance.now();
        const target = e.currentTarget;
        const focused = (document.activeElement as HTMLElement | null) ?? target;
        const r = (target.contains(focused) ? focused : target).getBoundingClientRect();
        fireHold({ x: r.left + r.width / 2, y: r.top + r.height / 2, target, source: 'keyboard' }, false);
      }
    },
    onClickCapture: (e) => {
      if (s.current.swallow) {
        s.current.swallow = false;
        e.preventDefault();
        e.stopPropagation();
      }
    },
  };
  return { handlers, cancel, state };
};
