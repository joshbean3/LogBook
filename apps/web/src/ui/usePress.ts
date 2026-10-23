import type { HTMLAttributes } from 'react';
import { useRef, useState } from 'react';

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
  const s = useRef<{ id: number; el: HTMLElement | null }>({ id: -1, el: null });
  const set = (el: HTMLElement | null, on: boolean) => {
    if (!el) return;
    if (on) el.setAttribute('data-pressed', '');
    else el.removeAttribute('data-pressed');
    if (read.current) setPressed(on);
  };
  const end = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerId !== s.current.id) return;
    set(s.current.el, false);
    s.current = { id: -1, el: null };
  };
  const handlers: Handlers = {
    onPointerDown: (e) => {
      if (opts.disabled || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      if (opts.ignore && e.target instanceof Element && e.target.closest(opts.ignore)) return;
      s.current = { id: e.pointerId, el: e.currentTarget };
      set(e.currentTarget, true);
    },
    onPointerMove: (e) => {
      const st = s.current;
      if (e.pointerId !== st.id || !st.el) return;
      // the hold took over at 450 ms (data-pressed went as data-lifting came): the press does not come back
      if (st.el.hasAttribute('data-lifting')) return;
      const r = st.el.getBoundingClientRect();
      const inside = e.clientX >= r.left - LEAVE_SLOP && e.clientX <= r.right + LEAVE_SLOP && e.clientY >= r.top - LEAVE_SLOP && e.clientY <= r.bottom + LEAVE_SLOP;
      if (inside !== st.el.hasAttribute('data-pressed')) set(st.el, inside);
    },
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
const DELEGATED = '.btn, .icon-btn, .chip-btn, .dcell, .avatar, .daystep-arrow, .daystep-today, .link, .lrow.tappable, label.lrow, .aura[role="button"], .aura-share, .cm-item, .gal-edge-row';
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
      };
      window.addEventListener('pointermove', move, opt);
      window.addEventListener('pointerup', end, opt);
      window.addEventListener('pointercancel', end, opt);
    },
    opt,
  );
};
