import type * as React from 'react';
import { useRef } from 'react';
import { useLongPress } from './useLongPress';

/**
 * The one hold (docs/feel.md §11.2, contracts §C.3). STEP 1 OF WP1: the signature is final; the body sits on the old
 * `useLongPress` (the same 450 ms clock) until the next step builds the pre-grow, the in-place lift and the drag hand-off.
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

export const useHold = (opts: HoldOpts): { handlers: HoldHandlers; cancel: () => void; state: React.RefObject<HoldState> } => {
  const state = useRef<HoldState>('idle');
  const o = useRef(opts);
  o.current = opts;
  const lp = useLongPress(
    opts.onHold
      ? (info) => {
          state.current = 'held';
          o.current.onHold?.(info);
        }
      : undefined,
    { disabled: opts.disabled },
  );
  const ignored = (e: { target: EventTarget | null }) => !!o.current.ignore && e.target instanceof Element && !!e.target.closest(o.current.ignore);
  const handlers: HoldHandlers = {
    onPointerDown: (e) => {
      if (ignored(e)) return;
      state.current = 'pressed';
      lp.handlers.onPointerDown(e);
    },
    onPointerMove: (e) => lp.handlers.onPointerMove(e),
    onPointerUp: (e) => {
      const was = state.current;
      state.current = 'idle';
      lp.handlers.onPointerUp();
      if (was === 'pressed' && !ignored(e)) o.current.onPress?.(e.nativeEvent);
    },
    onPointerCancel: () => {
      state.current = 'idle';
      lp.handlers.onPointerCancel();
    },
    onContextMenu: (e) => lp.handlers.onContextMenu(e),
    onKeyDown: (e) => lp.handlers.onKeyDown(e),
    onClickCapture: (e) => lp.handlers.onClickCapture(e),
  };
  return { handlers, cancel: lp.cancel, state };
};
