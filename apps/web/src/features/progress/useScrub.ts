import { useCallback, useEffect, useRef, useState } from 'react';
import { HOLD_SLOP_PX, SCRUB_HOLD_MS, SCRUB_PEEK_MS, SCRUB_TAP_MS } from '@/lib/gesture';
import { haptics } from '@/lib/haptics';
import { scrubIntent, stepIndex } from './scrub';

/**
 * Drag across a chart to read it. A finger that moves sideways (or rests for a moment) reads the point under it: the
 * caller's readout rewrites (`onScrub`), one `select` tick per point, and letting go returns to the headline. A finger that
 * moves up or down scrolls the page as it would anywhere else: the chart only takes a gesture it has claimed
 * (`scrubIntent`), and from then on the page holds still under the finger.
 *
 * A quick tap is a tap (`onTap`, e.g. open the week); with nothing to open it shows the point for a moment. A mouse hovers
 * to read and clicks to open. Keys: arrows move one point, Home and End jump to the ends, Enter opens, Escape lets go.
 * VoiceOver's swipe up and down on the slider arrive as those arrow keys.
 *
 * Both event families are listened to on purpose. Pointer events carry the gesture (touch, pen and mouse alike). The
 * native `touchmove` listener makes the same decision from the same numbers and cancels the move the moment the chart
 * claims it: on iPhone the page's scroll can only be held off from a `touchmove` that is not passive, and React's are.
 */
export interface ScrubOptions {
  count: number;
  /** The point under a client x, or null when there is nothing to read. */
  indexAt: (clientX: number) => number | null;
  /** The point being read, or null when let go. */
  onScrub: (i: number | null) => void;
  /** A quick tap on a point (open the week). Without it a tap shows the point for a moment. */
  onTap?: (i: number) => void;
  /** A finger or a mouse has read a point: the first-use hint has done its job. May be called more than once. */
  onRead?: () => void;
  /** Where the keys start (the bucket holding today). */
  home?: number;
  /** The first index that can be read (buckets before the log began cannot): the keys stop there. */
  min?: number;
  disabled?: boolean;
}

interface Press {
  id: number;
  mouse: boolean;
  x0: number;
  y0: number;
  /** The latest x, so a press that rests reads where the finger is now. */
  x: number;
  t0: number;
  i0: number | null;
  /** The chart has the gesture. */
  live: boolean;
  /** It has read more than one point: a drag, never a tap. */
  changed: boolean;
  last: number | null;
  timer: ReturnType<typeof setTimeout> | null;
  /** The point the keys had moved to when this press began (VoiceOver's double tap lands in the middle of the chart). */
  keyAt: number | null;
}

export const useScrub = (o: ScrubOptions) => {
  const opts = useRef(o);
  opts.current = o;
  const [active, setActive] = useState<number | null>(null);
  const activeRef = useRef<number | null>(null);
  const press = useRef<Press | null>(null);
  const live = useRef(false);
  const el = useRef<HTMLElement | null>(null);
  const touch0 = useRef<{ x: number; y: number } | null>(null);
  const byKey = useRef<number | null>(null);
  const pendingTap = useRef<number | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emit = (i: number | null) => {
    if (i === activeRef.current) return;
    activeRef.current = i;
    setActive(i);
    opts.current.onScrub(i);
  };
  const clearPeek = () => {
    if (!peekTimer.current) return;
    clearTimeout(peekTimer.current);
    peekTimer.current = null;
    emit(null);
  };
  const fireTap = () => {
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = null;
    const i = pendingTap.current;
    pendingTap.current = null;
    if (i != null) opts.current.onTap?.(i);
  };
  /** The point under the finger while the chart has the gesture: one tick per point (guide 9.5, `select`). */
  const read = (i: number | null) => {
    const p = press.current;
    if (!p || i == null || i === p.last) return;
    if (p.last != null) p.changed = true;
    p.last = i;
    haptics.select();
    emit(i);
  };
  const activate = (x: number) => {
    const p = press.current;
    if (!p || p.live) return;
    p.live = true;
    live.current = true;
    if (p.timer) clearTimeout(p.timer);
    p.timer = null;
    if (!p.mouse) opts.current.onRead?.();
    read(opts.current.indexAt(x));
  };
  const endPress = () => {
    const p = press.current;
    if (p?.timer) clearTimeout(p.timer);
    press.current = null;
    live.current = false;
  };

  // ---------- the native touch listeners: the same decision, made where the move can still be cancelled ----------
  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    touch0.current = e.touches.length === 1 && t ? { x: t.clientX, y: t.clientY } : null;
    // a second finger is not a read: let go
    if (e.touches.length > 1 && press.current) {
      endPress();
      emit(null);
    }
  };
  const onTouchMove = (e: TouchEvent) => {
    const t = e.touches[0];
    if (e.touches.length !== 1 || !t) return;
    const p = press.current;
    if (p && !p.live && touch0.current) {
      const intent = scrubIntent(t.clientX - touch0.current.x, t.clientY - touch0.current.y);
      if (intent === 'scrub') activate(t.clientX);
      else if (intent === 'scroll') endPress();
    }
    if (!live.current) return;
    // the chart has the gesture: the page holds still under the finger
    if (e.cancelable) e.preventDefault();
    read(opts.current.indexAt(t.clientX));
  };
  /** A touch that ended with no pointer event to say so (the browser took it): never leave a marker behind. */
  const onTouchEnd = (e: TouchEvent) => {
    if (e.touches.length) return;
    touch0.current = null;
    const p = press.current;
    if (!p || p.mouse) return;
    // the pointer event for this lift comes first when there is one: by now it has ended the press
    setTimeout(() => {
      if (press.current !== p) return;
      endPress();
      emit(null);
    }, 0);
  };
  const ref = useCallback((node: HTMLElement | null) => {
    const old = el.current;
    if (old) {
      old.removeEventListener('touchstart', onTouchStart);
      old.removeEventListener('touchmove', onTouchMove);
      old.removeEventListener('touchend', onTouchEnd);
      old.removeEventListener('touchcancel', onTouchEnd);
    }
    el.current = node;
    if (node) {
      node.addEventListener('touchstart', onTouchStart, { passive: true });
      node.addEventListener('touchmove', onTouchMove, { passive: false });
      node.addEventListener('touchend', onTouchEnd, { passive: true });
      node.addEventListener('touchcancel', onTouchEnd, { passive: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(
    () => () => {
      if (press.current?.timer) clearTimeout(press.current.timer);
      if (tapTimer.current) clearTimeout(tapTimer.current);
      if (peekTimer.current) clearTimeout(peekTimer.current);
    },
    [],
  );

  // ---------- pointer events: the gesture itself ----------
  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (opts.current.disabled || !e.isPrimary) return;
    const mouse = e.pointerType === 'mouse';
    if (mouse && e.button !== 0) return;
    clearPeek();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* a synthetic pointer */
    }
    const p: Press = { id: e.pointerId, mouse, x0: e.clientX, y0: e.clientY, x: e.clientX, t0: performance.now(), i0: opts.current.indexAt(e.clientX), live: false, changed: false, last: null, timer: null, keyAt: byKey.current };
    press.current = p;
    if (mouse) activate(e.clientX);
    // a finger that rests on the chart is reading it
    else p.timer = setTimeout(() => activate(p.x), SCRUB_HOLD_MS);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (opts.current.disabled) return;
    const p = press.current;
    if (!p) {
      // a mouse hovering reads the chart without a tick
      if (e.pointerType !== 'mouse') return;
      byKey.current = null;
      clearPeek();
      const i = opts.current.indexAt(e.clientX);
      if (i != null && i !== activeRef.current) opts.current.onRead?.();
      emit(i);
      return;
    }
    if (e.pointerId !== p.id) return;
    p.x = e.clientX;
    if (!p.live) {
      const intent = scrubIntent(e.clientX - p.x0, e.clientY - p.y0);
      if (intent === 'scrub') activate(e.clientX);
      else if (intent === 'scroll') endPress();
      return;
    }
    read(opts.current.indexAt(e.clientX));
  };

  const finish = (e: React.PointerEvent<HTMLElement>, cancelled: boolean) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    // a touch that became a read is a read: letting go opens nothing. A mouse reads from the press, so its click still counts
    const quick = !cancelled && (p.mouse || !p.live) && !p.changed && p.i0 != null && performance.now() - p.t0 < SCRUB_TAP_MS && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < HOLD_SLOP_PX;
    endPress();
    if (quick) {
      const i = p.keyAt ?? p.i0!;
      if (opts.current.onTap) {
        emit(p.mouse ? i : null);
        // open on the click that follows, so it lands here and not on the sheet rising under the finger
        if (tapTimer.current) clearTimeout(tapTimer.current);
        pendingTap.current = i;
        tapTimer.current = setTimeout(fireTap, 350);
        return;
      }
      if (!p.mouse) {
        // nothing to open: the tap shows the point for a moment
        haptics.select();
        opts.current.onRead?.();
        emit(i);
        peekTimer.current = setTimeout(() => {
          peekTimer.current = null;
          if (!press.current) emit(null);
        }, SCRUB_PEEK_MS);
        return;
      }
    }
    // let go: back to the headline (a mouse keeps reading where it hovers)
    emit(p.mouse && !cancelled ? opts.current.indexAt(e.clientX) : null);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (opts.current.disabled) return;
    const { count, home = count - 1, min = 0 } = opts.current;
    if (e.key === 'Enter' || e.key === ' ') {
      if (!opts.current.onTap) return;
      e.preventDefault();
      opts.current.onTap(activeRef.current ?? home);
      return;
    }
    if (e.key === 'Escape') {
      if (activeRef.current == null) return;
      e.stopPropagation();
      byKey.current = null;
      emit(null);
      return;
    }
    const next = stepIndex(e.key, activeRef.current, { count, home, min });
    if (next == null) return;
    e.preventDefault();
    clearPeek();
    byKey.current = next;
    if (next !== activeRef.current) {
      haptics.select();
      emit(next);
    }
  };

  return {
    active,
    bind: {
      ref,
      onPointerDown,
      onPointerMove,
      onPointerUp: (e: React.PointerEvent<HTMLElement>) => finish(e, false),
      onPointerCancel: (e: React.PointerEvent<HTMLElement>) => finish(e, true),
      onPointerLeave: (e: React.PointerEvent<HTMLElement>) => {
        if (e.pointerType === 'mouse' && !press.current) emit(null);
      },
      onClick: (e: React.MouseEvent<HTMLElement>) => {
        if (pendingTap.current != null) return fireTap();
        // a click no pointer made (VoiceOver's double tap, a switch): open the point the keys last moved to
        const { count, home = count - 1 } = opts.current;
        if (e.detail === 0 && !opts.current.disabled) opts.current.onTap?.(byKey.current ?? activeRef.current ?? home);
      },
      onKeyDown,
      onBlur: () => {
        byKey.current = null;
        clearPeek();
        emit(null);
      },
    },
  };
};
