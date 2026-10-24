import { HOLD_MS, HOLD_SLOP_PX } from '@/lib/gesture';
import { deprecated } from '@/lib/motion';
import { useHold } from './useHold';

/**
 * @deprecated use `useHold` / `HOLD_MS` (contracts rule 5). An adapter over the one hold clock: same name, same handlers,
 * same callback; no pre-grow and no lift of its own (its callers open the menu, which lifts the element in place). Deleted
 * after WP6 lands.
 */
export const LONG_PRESS_MS = HOLD_MS;
/** @deprecated `HOLD_SLOP_PX`. */
export const LONG_PRESS_SLOP = HOLD_SLOP_PX;

/** @deprecated `HoldInfo`. */
export interface LongPressInfo {
  x: number;
  y: number;
  target: HTMLElement;
  source: 'touch' | 'mouse' | 'pen' | 'keyboard';
}
interface Opts {
  /** Ignored: there is one clock. */
  ms?: number;
  /** Ignored: there is one slop. */
  slop?: number;
  disabled?: boolean;
}

/** @deprecated `useHold({ onHold })`. */
export const useLongPress = (onLongPress: ((info: LongPressInfo) => void) | undefined, { disabled }: Opts = {}) => {
  deprecated('useLongPress');
  const h = useHold({ onHold: onLongPress, disabled, visual: false });
  return {
    handlers: {
      onPointerDown: h.handlers.onPointerDown,
      onPointerMove: () => undefined,
      onPointerUp: () => undefined,
      onPointerCancel: () => undefined,
      onContextMenu: h.handlers.onContextMenu,
      onKeyDown: h.handlers.onKeyDown,
      onClickCapture: h.handlers.onClickCapture,
    },
    cancel: h.cancel,
  };
};
