import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'motion/react';
import type * as React from 'react';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { TabScope, useNavInternal } from '@/app/NavController';
import { MAX_MENU_ITEMS } from '@/lib/gesture';
import { haptics } from '@/lib/haptics';
import { crossfade, deprecated, fadeOut, menuIn } from '@/lib/motion';
import { restoreFocus } from './focus';
import { drop, lift, type LiftHandle } from './lift';
import type { TabId } from './nav';
import { useHold } from './useHold';

export interface ContextMenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  /** Red, and always listed last (HIG: destructive items go at the end). */
  destructive?: boolean;
  disabled?: boolean;
}
export interface OpenContextMenu {
  /** ≤ 4; destructive last (dev-asserted). */
  items: ContextMenuItem[];
  /** What the menu points at: an element (its rect), a rect, or a point. */
  anchor: HTMLElement | DOMRect | { x: number; y: number };
  /** Lifted IN PLACE (data-lifting on the real element; no clone); the scrim's hole is cut at its rect. Default: anchor when it is an element. */
  lift?: HTMLElement | null;
  /** The menu's accessible name, e.g. "Easy 6 actions". */
  label?: string;
  /** Where focus goes when the menu closes. Default: whatever had focus when it opened, else the lifted element. */
  returnFocus?: HTMLElement | null;
  /** `haptics.lift()` on open. Default true. */
  haptic?: boolean;
  /** @deprecated accepted and ignored (contracts §C.4: the element itself lifts in place; no preview). */
  preview?: ReactNode;
}
export interface ContextMenuApi {
  open: (o: OpenContextMenu) => void;
  close: () => void;
  isOpen: () => boolean;
}

const Ctx = createContext<ContextMenuApi | null>(null);
/** Imperative access to the one context menu: `const menu = useContextMenu(); menu.open({ items, anchor: el })`. */
export const useContextMenu = (): ContextMenuApi => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useContextMenu outside ContextMenuProvider (it is mounted in main.tsx, above the SheetProvider)');
  return c;
};

const GAP = 8;
const EDGE = 12;
const MENU_W = 250;
const safe = (side: 'top' | 'bottom') => {
  const n = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(side === 'top' ? '--safe-t' : '--safe-b'));
  return Number.isFinite(n) ? n : 0;
};
const toRect = (a: OpenContextMenu['anchor']): DOMRect => {
  if (a instanceof HTMLElement) return a.getBoundingClientRect();
  if ('width' in a) return a;
  return new DOMRect(a.x, a.y, 0, 0);
};

interface Spec extends OpenContextMenu {
  key: number;
  tab: TabId;
  /** The anchor's rect (the lifted element's rest rect at scale 1). */
  rect: DOMRect;
  held: LiftHandle | null;
}

const Layer = ({ spec, onClose }: { spec: Spec; onClose: () => void }) => {
  const reduce = useReducedMotion();
  const present = useIsPresent();
  const menuRef = useRef<HTMLDivElement>(null);
  const r = spec.rect;
  const items = useMemo(() => [...spec.items.filter((i) => !i.destructive), ...spec.items.filter((i) => i.destructive)], [spec.items]);
  const hasObject = r.width > 0 && r.height > 0;

  // placed before the first paint, written straight to the element (no second render in the hold's task): below the object
  // if it fits, else above it, else pinned to the bottom edge (the object stays where it is)
  useLayoutEffect(() => {
    const m = menuRef.current;
    if (!m) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const st = safe('top') + EDGE;
    const sb = safe('bottom') + EDGE;
    const mh = m.offsetHeight;
    const mw = Math.min(MENU_W, vw - EDGE * 2);
    const grow = spec.held ? 0.03 * r.height * 0.5 : 0;
    const top = r.top - grow;
    const bottom = r.bottom + grow;
    const left = Math.max(EDGE, Math.min(vw - mw - EDGE, hasObject ? r.left : r.left - mw / 2));
    let y: number;
    let origin: 'top' | 'bottom' = 'top';
    if (vh - bottom - sb >= mh + GAP) y = bottom + GAP;
    else if (top - st >= mh + GAP) {
      y = top - GAP - mh;
      origin = 'bottom';
    } else {
      y = vh - sb - mh;
      origin = 'bottom';
    }
    m.style.top = `${y}px`;
    m.style.left = `${left}px`;
    m.style.transformOrigin = origin === 'bottom' ? '50% 100%' : '50% 0%';
  }, [r, hasObject, spec.held]);

  // focus the first item on the next frame (for the keyboard and VoiceOver; the menu does not wait on it)
  useEffect(() => {
    const raf = requestAnimationFrame(() => menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(raf);
  }, []);

  // closing: focus goes back where it came from
  useEffect(() => {
    if (present) return;
    const f = spec.returnFocus;
    if (f?.isConnected) restoreFocus(f);
  }, [present]); // eslint-disable-line react-hooks/exhaustive-deps

  // keys are heard on the document: after a touch hold the focus may not be in the menu yet
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => undefined);
  keyRef.current = (e: KeyboardEvent) => {
    if (!present) return;
    const list = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])];
    const i = list.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => {
      e.preventDefault();
      list[(n + list.length) % list.length]?.focus();
    };
    if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowUp') go(i < 0 ? list.length - 1 : i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(list.length - 1);
  };
  /*
   * Tap outside (§11.2): the hole catches nothing, so a capture-phase pointerdown on window closes the menu for any pointer
   * that starts outside .cm-menu, and swallows that pointer's events and its click: a tap on the lifted element closes the
   * menu and opens nothing.
   */
  useEffect(() => {
    if (!present) return;
    const onKey = (e: KeyboardEvent) => keyRef.current(e);
    let swallowUntil = 0;
    const swallow = (e: Event) => {
      if (performance.now() > swallowUntil) return;
      e.stopPropagation();
      if (e.type === 'click') {
        e.preventDefault();
        swallowUntil = 0;
      }
    };
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Element && e.target.closest('.cm-menu')) return;
      e.stopPropagation();
      swallowUntil = performance.now() + 800;
      onClose();
    };
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointerup', swallow, true);
    window.addEventListener('click', swallow, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onDown, true);
      // the click of the closing tap comes after this layer has gone: keep swallowing it for its pointer's lifetime
      const left = swallowUntil - performance.now();
      const off = () => {
        window.removeEventListener('pointerup', swallow, true);
        window.removeEventListener('click', swallow, true);
      };
      if (left > 0) setTimeout(off, left);
      else off();
    };
  }, [present]); // eslint-disable-line react-hooks/exhaustive-deps

  const hole = spec.held;
  const fadeT = reduce ? crossfade : menuIn;
  return (
    <div className="cm-layer" role="presentation">
      <motion.div
        className="cm-hole"
        aria-hidden="true"
        style={{
          left: r.left,
          top: r.top,
          width: hasObject ? r.width : 0,
          height: hasObject ? r.height : 0,
          borderRadius: hole?.radius ?? 0,
          scale: hole ? hole.scale : 1,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: fadeOut }}
        transition={fadeT}
      />
      <motion.div
        ref={menuRef}
        className="cm-menu"
        role="menu"
        aria-modal="true"
        aria-label={spec.label ?? 'Actions'}
        style={{ top: -9999, left: 0, width: Math.min(MENU_W, window.innerWidth - EDGE * 2) }}
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, transition: fadeOut }}
        transition={fadeT}
      >
        {items.map((it, i) => (
          <button
            key={`${it.label}-${i}`}
            type="button"
            role="menuitem"
            className={`cm-item ${it.destructive ? 'destructive' : ''} ${it.destructive && i > 0 && !items[i - 1]!.destructive ? 'sep' : ''}`}
            disabled={it.disabled}
            onClick={() => {
              onClose();
              // after the menu has let go of focus, so a sheet opened here captures the right opener
              requestAnimationFrame(() => it.onSelect());
            }}
          >
            <span className="cm-label">{it.label}</span>
            {it.icon ? (
              <span className="cm-icon" aria-hidden="true">
                {it.icon}
              </span>
            ) : null}
          </button>
        ))}
      </motion.div>
    </div>
  );
};

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Hosts the one context menu (docs/feel.md §11.2, contracts §C.4). Mounted once in main.tsx, above the SheetProvider (so
 * sheets can open it). The object lifts IN PLACE (`ui/lift.ts`: the real element to 1.03 on `springs.lift`); the dim is a
 * cut-out, `.cm-hole`, a fixed box at the object's rest rect whose scale is the lift's own motion value and whose 200vmax
 * shadow darkens everything else, the bar and the tab bar included, with no z-index on the object. The menu card arrives in
 * 140 ms (scale .94 → 1 + opacity) and leaves in 100 ms. Tap outside, Escape, an item or Back closes it.
 */
export const ContextMenuProvider = ({ children }: { children: ReactNode }) => {
  const ctl = useNavInternal();
  const [spec, setSpec] = useState<Spec | null>(null);
  const cur = useRef<Spec | null>(null);
  /** The menu's one overlay history entry: Back closes the menu first. */
  const release = useRef<(() => void) | null>(null);
  /**
   * The menu opens from the hold's timer and closes from window listeners (a move after the hold, a tap outside): outside
   * React's events, where a state change would render a task later. They render now, so the menu is in the DOM in the
   * same task as the 450 ms lift and its 100 ms exit starts on the next frame.
   */
  const commit = (fn: () => void) => {
    try {
      flushSync(fn);
    } catch {
      fn();
    }
  };
  const dismiss = useCallback(() => {
    const s = cur.current;
    cur.current = null;
    if (s?.held) drop(s.held.el);
    commit(() => setSpec(null));
  }, []);
  const close = useCallback(() => {
    const r = release.current;
    release.current = null;
    dismiss();
    r?.();
  }, [dismiss]);
  const api = useMemo<ContextMenuApi>(
    () => ({
      open: (o) => {
        if (!o.items.length) return;
        if (import.meta.env.DEV && o.items.length > MAX_MENU_ITEMS) console.warn(`ContextMenu: ${o.items.length} items (≤ ${MAX_MENU_ITEMS})`);
        if (o.preview !== undefined) deprecated('ContextMenu preview');
        const liftEl = o.lift !== undefined ? o.lift : o.anchor instanceof HTMLElement ? o.anchor : null;
        // a menu opened over another: the old one's object settles first
        const prev = cur.current;
        if (prev?.held) drop(prev.held.el);
        // the menu's own reference to the lift (the hold that opened it keeps its own until the finger lifts)
        const held = liftEl && liftEl.isConnected ? lift(liftEl, { reduce: reduced() }) : null;
        const rect = held ? held.rest : toRect(o.anchor);
        const active = document.activeElement as HTMLElement | null;
        const returnFocus = o.returnFocus ?? (active && active !== document.body ? active : (liftEl?.matches('button, [tabindex], a[href]') ? liftEl : (liftEl?.querySelector<HTMLElement>('button, [tabindex], a[href]') ?? liftEl)));
        // the menu layer renders in the scope of the tab active now (an item's useToast / useNav belong to it)
        const next: Spec = { ...o, returnFocus, rect, held, key: Date.now(), tab: ctl.getState().active };
        cur.current = next;
        commit(() => setSpec(next));
        // after the menu's own commit: the overlay's history entry and the nav notify are not on the menu's path
        if (!release.current)
          release.current = ctl.openOverlay(() => {
            release.current = null;
            dismiss();
          });
        if (o.haptic !== false) haptics.lift();
      },
      close,
      isOpen: () => !!cur.current,
    }),
    [close, dismiss, ctl],
  );
  return (
    <Ctx.Provider value={api}>
      {children}
      {createPortal(
        <AnimatePresence>
          {spec ? (
            <TabScope key={spec.key} tab={spec.tab}>
              <Layer spec={spec} onClose={close} />
            </TabScope>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </Ctx.Provider>
  );
};

export interface ContextMenuProps {
  /** The actions (≤ 4). Destructive ones are listed last, in red. Every action a gesture on this object performs belongs here too. */
  items: ContextMenuItem[];
  /** One element: the object. Its own taps keep working; a hold opens the menu. */
  children: ReactNode;
  /** @deprecated accepted and ignored: the object itself lifts in place. */
  preview?: ReactNode;
  /** The menu's accessible name, and the hidden "Actions" button's: "Easy 6" → "Easy 6 actions". */
  label?: string;
  disabled?: boolean;
  /** The wrapper element; it is `display: contents`, so it never changes layout. Use "li" inside a list. */
  as?: 'div' | 'li' | 'span';
  /** Render a visually hidden "Actions" button after the child for VoiceOver and keyboard users (shown on focus). Default true. */
  a11yButton?: boolean;
}

/**
 * A hold (the one 450 ms clock, `useHold`) on the child pre-grows it at 300 ms, lifts it in place at 450 with
 * `haptics.lift()`, and opens the menu under the cut-out scrim. Shift+F10 or the ContextMenu key opens it at once, and a
 * visually hidden "Actions" button (shown on focus) does the same for VoiceOver. The wrapper is `display: contents`.
 */
export const ContextMenu = ({ items, children, preview, label, disabled, as = 'div', a11yButton = true }: ContextMenuProps) => {
  const menu = useContextMenu();
  const wrap = useRef<HTMLElement>(null);
  if (preview !== undefined) deprecated('ContextMenu preview');
  const target = () => (wrap.current?.firstElementChild as HTMLElement | null) ?? null;
  const open = (focus?: HTMLElement | null, haptic = false) => {
    const el = target();
    if (!el || disabled) return;
    menu.open({ items, anchor: el, lift: el, label: label ? `${label} actions` : undefined, returnFocus: focus ?? undefined, haptic });
  };
  const h = useHold({ disabled: disabled || !items.length, target, onHold: () => open() });
  const Tag = as as 'div';
  return (
    <Tag
      ref={wrap as React.RefObject<HTMLDivElement>}
      className="cm-target"
      onPointerDown={h.handlers.onPointerDown}
      onContextMenu={h.handlers.onContextMenu}
      onKeyDown={h.handlers.onKeyDown}
      onClickCapture={h.handlers.onClickCapture}
    >
      {children}
      {a11yButton && items.length && !disabled ? (
        <button type="button" className="cm-sr" aria-haspopup="menu" onClick={(e) => open(e.currentTarget)}>
          {label ? `${label} actions` : 'Actions'}
        </button>
      ) : null}
    </Tag>
  );
};
