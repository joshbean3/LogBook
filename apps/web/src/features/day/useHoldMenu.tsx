import { useRef } from 'react';
import { useContextMenu, useLongPress, type ContextMenuItem } from '@/ui';

/** Presses that start on these are not the card's long-press: the hold ring completes, fields and buttons do their own thing. */
const OWN = '.hold-ring, textarea, input, .cd-composer, .swipe-row, .aura-share, .hero-corner, .hero-corner-in, .hero-dots, .cm-sr';

/**
 * The hero's long-press menu, the same grammar as `ContextMenu` (450ms, 8px slop, right-click, Shift+F10, the lift and the
 * dimmed page), with one difference the cards need: a press that starts on something with its own gesture (the hold ring,
 * the journal composer, an entry's swipe row, the week ring) is left alone. Spread `bind` on the card, render `sr` after it
 * for VoiceOver and keyboard users.
 */
export const useHoldMenu = (items: () => ContextMenuItem[], label: string, { disabled, ignore = OWN }: { disabled?: boolean; ignore?: string } = {}) => {
  const menu = useContextMenu();
  const el = useRef<HTMLElement | null>(null);
  const list = useRef(items);
  list.current = items;
  const open = (returnFocus?: HTMLElement | null) => {
    const node = el.current;
    const its = list.current();
    if (!node || disabled || !its.length) return;
    menu.open({ items: its, anchor: node, label: `${label} actions`, returnFocus: returnFocus ?? undefined });
  };
  // the press is always handed to the long-press (so its state resets with every press); one that started on something
  // with its own gesture simply opens nothing
  const skipped = useRef(false);
  const lp = useLongPress(() => !skipped.current && open(), { disabled });
  const skip = (t: EventTarget | null) => !!(t as Element | null)?.closest?.(ignore);
  const bind = {
    ...lp.handlers,
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      el.current = e.currentTarget;
      skipped.current = skip(e.target);
      lp.handlers.onPointerDown(e);
    },
    onContextMenu: (e: React.MouseEvent<HTMLElement>) => {
      el.current = e.currentTarget;
      if (skip(e.target)) return;
      lp.handlers.onContextMenu(e);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      el.current = e.currentTarget;
      lp.handlers.onKeyDown(e);
    },
  };
  const sr = disabled ? null : (
    <button type="button" className="cm-sr" aria-haspopup="menu" onClick={(e) => open(e.currentTarget)}>
      {label} actions
    </button>
  );
  return { bind, sr, ref: el };
};
