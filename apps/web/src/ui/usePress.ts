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
export const usePress = (opts: { disabled?: boolean } = {}): { handlers: Handlers; pressed: boolean } => {
  const [pressed, setPressed] = useState(false);
  const s = useRef<{ id: number; el: HTMLElement | null }>({ id: -1, el: null });
  const set = (el: HTMLElement | null, on: boolean) => {
    if (!el) return;
    if (on) el.setAttribute('data-pressed', '');
    else el.removeAttribute('data-pressed');
    setPressed(on);
  };
  const end = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerId !== s.current.id) return;
    set(s.current.el, false);
    s.current = { id: -1, el: null };
  };
  const handlers: Handlers = {
    onPointerDown: (e) => {
      if (opts.disabled || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      s.current = { id: e.pointerId, el: e.currentTarget };
      set(e.currentTarget, true);
    },
    onPointerMove: (e) => {
      const st = s.current;
      if (e.pointerId !== st.id || !st.el) return;
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
  return { handlers, pressed };
};
