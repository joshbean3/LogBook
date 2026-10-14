import { useCallback, useEffect, useRef } from 'react';

/** The hold that counts as a long-press, and how far the finger may wander before it counts as a scroll instead. */
export const LONG_PRESS_MS = 450;
export const LONG_PRESS_SLOP = 8;

export interface LongPressInfo {
  /** Where it happened, in viewport pixels (the element's centre for the keyboard). */
  x: number;
  y: number;
  /** The element the handlers are bound to. */
  target: HTMLElement;
  source: 'touch' | 'mouse' | 'pen' | 'keyboard';
}
interface Opts {
  ms?: number;
  slop?: number;
  disabled?: boolean;
}

/**
 * Long-press, the same everywhere: 450ms with less than 8px of travel, or a right-click, or Shift+F10 / the ContextMenu key.
 * Spread `handlers` on the element. The click that follows a long-press is swallowed, so a tap handler on the same element (or
 * its children) never fires for a hold. While the hold is pending nothing is prevented: the page scrolls as usual, and a
 * scroll (pointercancel) or 8px of travel cancels it.
 */
export const useLongPress = (onLongPress: ((info: LongPressInfo) => void) | undefined, { ms = LONG_PRESS_MS, slop = LONG_PRESS_SLOP, disabled }: Opts = {}) => {
  const cb = useRef(onLongPress);
  cb.current = onLongPress;
  const st = useRef({ timer: 0 as ReturnType<typeof setTimeout> | 0, id: -1, x: 0, y: 0, fired: false, firedAt: 0, kbAt: 0 });
  const clear = useCallback(() => {
    const s = st.current;
    if (s.timer) clearTimeout(s.timer);
    s.timer = 0;
    s.id = -1;
  }, []);
  useEffect(() => clear, [clear]);
  const active = !!onLongPress && !disabled;

  const fire = (info: LongPressInfo) => {
    st.current.fired = true;
    st.current.firedAt = performance.now();
    clear();
    cb.current?.(info);
  };

  const handlers = {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      const s = st.current;
      // a new press: whatever the last one fired, its click has come and gone
      s.fired = false;
      if (!active || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      clear();
      s.id = e.pointerId;
      s.x = e.clientX;
      s.y = e.clientY;
      const target = e.currentTarget;
      const source = (e.pointerType === 'pen' ? 'pen' : e.pointerType === 'mouse' ? 'mouse' : 'touch') as LongPressInfo['source'];
      s.timer = setTimeout(() => fire({ x: s.x, y: s.y, target, source }), ms);
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const s = st.current;
      if (!s.timer || e.pointerId !== s.id) return;
      if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > slop) clear();
    },
    onPointerUp: () => clear(),
    onPointerCancel: () => clear(),
    onContextMenu: (e: React.MouseEvent<HTMLElement>) => {
      if (!active) return;
      e.preventDefault();
      const s = st.current;
      // a touch hold just fired (Android sends contextmenu too), or the keyboard just opened it
      const now = performance.now();
      if (now - s.firedAt < 800 || now - s.kbAt < 500) return;
      const target = e.currentTarget;
      const kb = e.clientX === 0 && e.clientY === 0;
      const r = target.getBoundingClientRect();
      fire({ x: kb ? r.left + r.width / 2 : e.clientX, y: kb ? r.top + r.height / 2 : e.clientY, target, source: kb ? 'keyboard' : 'mouse' });
      // a right-click is not followed by a click; nothing to swallow
      s.fired = false;
      s.firedAt = 0;
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if (!active) return;
      if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
        e.preventDefault();
        st.current.kbAt = performance.now();
        const target = e.currentTarget;
        const focused = (document.activeElement as HTMLElement | null) ?? target;
        const r = (target.contains(focused) ? focused : target).getBoundingClientRect();
        cb.current?.({ x: r.left + r.width / 2, y: r.top + r.height / 2, target, source: 'keyboard' });
      }
    },
    onClickCapture: (e: React.MouseEvent<HTMLElement>) => {
      if (st.current.fired) {
        st.current.fired = false;
        e.preventDefault();
        e.stopPropagation();
      }
    },
  };
  return { handlers, cancel: clear };
};
