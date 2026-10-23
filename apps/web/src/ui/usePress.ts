import type { HTMLAttributes } from 'react';
import { useEffect, useRef, useState } from 'react';

/** How far the pointer may leave the element's rect before the press lets go (re-armed on return). */
const LEAVE_SLOP = 12;

type Handlers = Pick<HTMLAttributes<HTMLElement>, 'onPointerDown' | 'onPointerUp' | 'onPointerCancel' | 'onPointerMove' | 'onPointerLeave'>;

/**
 * Press state without the component (docs/feel.md §11.1, contracts §C.2): `data-pressed` is set synchronously on
 * `pointerdown` (CSS runs the scale to 0.97 over 120 ms, back over 160) and cleared on up, cancel, or the pointer leaving the
 * element's rect by 12 px (re-armed on return). Spread `handlers` on an element that already has its own semantics; the
 * attribute is written straight to the DOM, so the first changed frame never waits on a React render.
 */
export const usePress = (opts: { disabled?: boolean; /** WP1-internal: Pressable's `ignore`. */ ignore?: string } = {}): { handlers: Handlers; pressed: boolean } => {
  const [pressed, setPressed] = useState(false);
  // a caller that never reads `pressed` (the attribute is the press) never re-renders for it
  const read = useRef(false);
  const s = useRef<{ id: number; el: HTMLElement | null; off: (() => void) | null }>({ id: -1, el: null, off: null });
  const set = (el: HTMLElement | null, on: boolean) => {
    if (!el) return;
    if (on) el.setAttribute('data-pressed', '');
    else el.removeAttribute('data-pressed');
    if (read.current) setPressed(on);
  };
  const release = () => {
    const st = s.current;
    st.off?.();
    set(st.el, false);
    s.current = { id: -1, el: null, off: null };
  };
  useEffect(() => () => s.current.off?.(), []);
  const end = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerId === s.current.id) release();
  };
  const handlers: Handlers = {
    onPointerDown: (e) => {
      if (opts.disabled || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      if (opts.ignore && e.target instanceof Element && e.target.closest(opts.ignore)) return;
      release();
      const el = e.currentTarget;
      const id = e.pointerId;
      set(el, true);
      /*
       * The pointer is followed from window listeners, not the element's own: a pager, the edge pop or a swipe row that
       * captures the pointer mid-press takes its up and its moves away from this element (code review 1 #3). Taken by
       * another element's capture, the press ends at once (the page is moving now, not this control).
       */
      const move = (ev: PointerEvent) => {
        if (ev.pointerId !== id) return;
        // the hold took over at 450 ms (data-pressed went as data-lifting came): the press does not come back
        if (el.hasAttribute('data-lifting')) return;
        const r = el.getBoundingClientRect();
        const inside = ev.clientX >= r.left - LEAVE_SLOP && ev.clientX <= r.right + LEAVE_SLOP && ev.clientY >= r.top - LEAVE_SLOP && ev.clientY <= r.bottom + LEAVE_SLOP;
        if (inside !== el.hasAttribute('data-pressed')) set(el, inside);
      };
      const up = (ev: PointerEvent) => {
        if (ev.pointerId === id) release();
      };
      const got = (ev: PointerEvent) => {
        if (ev.pointerId !== id) return;
        const t = ev.target as Node | null;
        if (t && t !== el && !el.contains(t)) release();
      };
      const cap = { capture: true, passive: true } as const;
      // up and cancel in the bubble phase: after the element's own handlers (a tab item reads data-pressed in its pointerup)
      const bub = { capture: false } as const;
      window.addEventListener('pointermove', move, cap);
      window.addEventListener('gotpointercapture', got, cap);
      window.addEventListener('pointerup', up, bub);
      window.addEventListener('pointercancel', up, bub);
      s.current = {
        id,
        el,
        off: () => {
          window.removeEventListener('pointermove', move, cap);
          window.removeEventListener('gotpointercapture', got, cap);
          window.removeEventListener('pointerup', up, bub);
          window.removeEventListener('pointercancel', up, bub);
        },
      };
    },
    // the window listeners own the pointer once it is down; the element's own events end the press first when they come
    onPointerMove: () => undefined,
    onPointerUp: end,
    onPointerCancel: end,
    onPointerLeave: (e) => {
      // a touch pointer "leaves" on lift; the slop rule above owns the drag-off for a held pointer
      if (e.pointerType === 'mouse') end(e);
    },
  };
  return {
    handlers,
    get pressed() {
      read.current = true;
      return pressed;
    },
  };
};

/**
 * The plain controls that are not Pressables yet (`.btn`, `.icon-btn`, `.chip-btn`, strip cells, rows, links, the avatar):
 * one capture-phase `pointerdown` on window (passive; called once from main.tsx) gives them the same `data-pressed`, with
 * the same rules (cleared on up / cancel / 12 px outside, re-armed on return), so every `:active` scale rule could go
 * (§11.1). The move/up listeners exist only while a pointer is pressing.
 */
const DELEGATED = '.btn, .icon-btn, .chip-btn, .seg-btn, .dcell, .avatar, .daystep-arrow, .daystep-today, .link, .lrow.tappable, label.lrow, .aura[role="button"], .aura-share, .cm-item, .gal-edge-row';
let delegating = false;
export const startPressDelegate = () => {
  if (delegating || typeof window === 'undefined') return;
  delegating = true;
  const opt = { capture: true, passive: true } as const;
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0) || !(e.target instanceof Element)) return;
      const el = e.target.closest<HTMLElement>(DELEGATED);
      // a Pressable (or a usePress element) owns its own press
      if (!el || el.matches('.pressable') || (el as HTMLButtonElement).disabled) return;
      el.setAttribute('data-pressed', '');
      const id = e.pointerId;
      const move = (ev: PointerEvent) => {
        if (ev.pointerId !== id) return;
        const r = el.getBoundingClientRect();
        const inside = ev.clientX >= r.left - LEAVE_SLOP && ev.clientX <= r.right + LEAVE_SLOP && ev.clientY >= r.top - LEAVE_SLOP && ev.clientY <= r.bottom + LEAVE_SLOP;
        if (inside) el.setAttribute('data-pressed', '');
        else el.removeAttribute('data-pressed');
      };
      const end = (ev: PointerEvent) => {
        if (ev.pointerId !== id) return;
        el.removeAttribute('data-pressed');
        window.removeEventListener('pointermove', move, opt);
        window.removeEventListener('pointerup', end, opt);
        window.removeEventListener('pointercancel', end, opt);
        window.removeEventListener('gotpointercapture', got, opt);
      };
      // another element captured the pointer (the pager, a swipe row): the press ends
      const got = (ev: PointerEvent) => {
        const t = ev.target as Node | null;
        if (ev.pointerId === id && t && t !== el && !el.contains(t)) end(ev);
      };
      window.addEventListener('pointermove', move, opt);
      window.addEventListener('pointerup', end, opt);
      window.addEventListener('pointercancel', end, opt);
      window.addEventListener('gotpointercapture', got, opt);
    },
    opt,
  );
};
