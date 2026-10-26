import type * as React from 'react';
import { useRef } from 'react';
import { HOLD_MS, HOLD_SLOP_PX } from '@/lib/gesture';
import { isPagerMoving } from './live';

/**
 * The click a touch makes after its release, when the release already acted: it would land on what the release opened (the
 * sheet's scrim, which closes the sheet, or the pushed page). Swallowed at the window in the capture phase; a click with no
 * pointer behind it (`detail === 0`: Enter, Space, VoiceOver) is never swallowed, and the arm goes at the next touch or after
 * 600 ms. (A local stand-in for WP1's internal click swallow, until Pressable has a release option: docs/reviews/wp2.md,
 * Requests.)
 */
export const swallowNextClick = () => {
  const on = (e: MouseEvent) => {
    if (e.detail === 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    done();
  };
  const done = () => {
    clearTimeout(t);
    window.removeEventListener('click', on, true);
    window.removeEventListener('pointerdown', done, true);
  };
  const t = setTimeout(done, 600);
  window.addEventListener('click', on, true);
  window.addEventListener('pointerdown', done, true);
};

export interface ReleaseHandlers {
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel: () => void;
  /** The click path (a mouse, Enter, Space, VoiceOver, or a touch whose release did not act): `fn`, unless the release did. */
  onClick: () => void;
}

/**
 * A tap that acts on its touch's release (spec M7, §0.2 6:30 step 3: "first frame moves ≤ 16 ms after touch-up"), not on the
 * click that comes a task later (1×: 4–7 ms, 4×: 20–40 ms; the click's own task then also renders what it opened). A touch
 * that comes up before the hold clock, within the hold's slop, and that did not land on a moving page (that touch is the
 * pager's: it catches the slide) acts on `pointerup`, and its click is swallowed. Everything else acts on the click.
 * `ignore`: pointers that start inside it are not this tap's (a control inside the row owns its press).
 */
export const useReleaseTap = (fn: () => void, { ignore }: { ignore?: string } = {}): ReleaseHandlers => {
  const tap = useRef<{ x: number; y: number; t: number; moved: boolean; opened: number } | null>(null);
  const latest = useRef(fn);
  latest.current = fn;
  return {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      const ok = e.isPrimary && e.pointerType !== 'mouse' && !(ignore && e.target instanceof Element && e.target.closest(ignore)) && !isPagerMoving();
      tap.current = ok ? { x: e.clientX, y: e.clientY, t: performance.now(), moved: false, opened: 0 } : null;
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const p = tap.current;
      if (p && !p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) > HOLD_SLOP_PX) p.moved = true;
    },
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
      const p = tap.current;
      if (!p || p.moved || p.opened || e.pointerType === 'mouse' || isPagerMoving() || performance.now() - p.t >= HOLD_MS) return;
      p.opened = performance.now();
      latest.current();
      swallowNextClick();
    },
    onPointerCancel: () => {
      tap.current = null;
    },
    onClick: () => {
      const p = tap.current;
      tap.current = null;
      if (p?.opened && performance.now() - p.opened < 1000) return;
      latest.current();
    },
  };
};

/**
 * Runs `fn` once the current frame is painted (a frame callback, then a task): a write that re-renders every page that reads
 * the month (a synchronous store update) must not hold back the frame that shows the answer to the touch (code review 2 #3,
 * feel review 2 #4). Resolves or rejects with `fn`'s result.
 */
export const afterPaint = <T>(fn: () => T | Promise<T>, delayMs = 0): Promise<T> =>
  new Promise<T>((res, rej) =>
    requestAnimationFrame(() =>
      setTimeout(() => {
        try {
          res(fn());
        } catch (e) {
          rej(e);
        }
      }, delayMs),
    ),
  );
