import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'motion/react';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { TabScope, useNavInternal } from '@/app/NavController';
import { haptics } from '@/lib/haptics';
import { fadeIn, fadeOut, LIFT_SCALE, reducedFade, springs } from '@/lib/motion';
import { restoreFocus } from './focus';
import { holdInert } from './inert';
import type { TabId } from './nav';
import { useLongPress } from './useLongPress';

export interface ContextMenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  /** Red, and always listed last (HIG: destructive items go at the end). */
  destructive?: boolean;
  disabled?: boolean;
}
export interface OpenContextMenu {
  items: ContextMenuItem[];
  /** What the menu points at: an element (its rect), a rect, or a point. */
  anchor: HTMLElement | DOMRect | { x: number; y: number };
  /** The element to lift. Default: `anchor` when it is an element. A styled copy is lifted; the original hides underneath. */
  lift?: HTMLElement | null;
  /** Show this instead of a copy of the element (a bigger preview of the object). */
  preview?: ReactNode;
  /** The menu's accessible name, e.g. "Easy 6 actions". */
  label?: string;
  /** Where focus goes when the menu closes. Default: whatever had focus when it opened, else the lifted element. */
  returnFocus?: HTMLElement | null;
  /** `haptics.lift()` on open. Default true. */
  haptic?: boolean;
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
  const v = getComputedStyle(document.documentElement).getPropertyValue(side === 'top' ? '--safe-t' : '--safe-b');
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/** A copy of an element that keeps its look outside its own context: every element's computed style is inlined. */
const styledCopy = (el: HTMLElement) => {
  const copy = el.cloneNode(true) as HTMLElement;
  const src = [el, ...el.querySelectorAll<HTMLElement>('*')];
  const dst = [copy, ...copy.querySelectorAll<HTMLElement>('*')];
  const deep = src.length <= 400;
  for (let i = 0; i < (deep ? src.length : 1); i++) {
    const cs = getComputedStyle(src[i]!);
    let text = '';
    for (let j = 0; j < cs.length; j++) {
      const p = cs[j]!;
      text += `${p}:${cs.getPropertyValue(p)};`;
    }
    dst[i]!.style.cssText = `${text}animation:none;transition:none;`;
  }
  for (const d of dst) {
    d.removeAttribute('id');
    d.removeAttribute('tabindex');
  }
  copy.style.margin = '0';
  copy.style.position = 'relative';
  copy.style.inset = 'auto';
  copy.style.transform = 'none';
  copy.style.visibility = 'visible';
  copy.style.opacity = '1';
  copy.style.width = '100%';
  copy.style.height = '100%';
  copy.style.boxSizing = 'border-box';
  copy.setAttribute('aria-hidden', 'true');
  copy.setAttribute('inert', '');
  return copy;
};

/**
 * Set an element's visibility at once. Under reduced motion base.css gives every property a 0.01ms transition, visibility
 * included, so a plain change reads as the old value until the next frames, and a still-hidden element cannot take focus.
 */
const setVisibility = (el: HTMLElement, v: string) => {
  const t = el.style.getPropertyValue('transition');
  const tp = el.style.getPropertyPriority('transition');
  el.style.setProperty('transition', 'none', 'important');
  el.style.visibility = v;
  void el.offsetWidth;
  if (t) el.style.setProperty('transition', t, tp);
  else el.style.removeProperty('transition');
};

interface Placed {
  menuTop: number;
  menuLeft: number;
  origin: 'top' | 'bottom';
  /** how far the lifted copy moves up to make room for the menu */
  shift: number;
}
const toRect = (a: OpenContextMenu['anchor']): DOMRect => {
  if (a instanceof HTMLElement) return a.getBoundingClientRect();
  if ('width' in a) return a;
  return new DOMRect(a.x, a.y, 0, 0);
};

const Layer = ({ spec, onClose }: { spec: OpenContextMenu & { rect: DOMRect }; onClose: () => void }) => {
  const reduce = useReducedMotion();
  const menuRef = useRef<HTMLDivElement>(null);
  const liftRef = useRef<HTMLDivElement>(null);
  const showOriginal = useRef<() => void>(() => undefined);
  const [placed, setPlaced] = useState<Placed | null>(null);
  const r = spec.rect;
  const items = useMemo(() => [...spec.items.filter((i) => !i.destructive), ...spec.items.filter((i) => i.destructive)], [spec.items]);
  const liftEl = spec.lift !== undefined ? spec.lift : spec.anchor instanceof HTMLElement ? spec.anchor : null;
  const showLift = !!(liftEl || spec.preview) && r.width > 0;

  // the copy of the element, made once while the original is still visible
  useLayoutEffect(() => {
    const host = liftRef.current;
    if (!host || spec.preview || !liftEl) return;
    const copy = styledCopy(liftEl);
    host.appendChild(copy);
    // the original hides under its lifted copy, and comes back when the copy has settled (this layer unmounts after its exit)
    const prev = liftEl.style.visibility;
    setVisibility(liftEl, 'hidden');
    showOriginal.current = () => setVisibility(liftEl, prev);
    return () => {
      copy.remove();
      setVisibility(liftEl, prev);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // place the menu: below the object if it fits, else above, else pinned to the bottom with the object nudged up
  useLayoutEffect(() => {
    const m = menuRef.current;
    if (!m) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const st = safe('top') + EDGE;
    const sb = safe('bottom') + EDGE;
    const mh = m.offsetHeight;
    const mw = Math.min(MENU_W, vw - EDGE * 2);
    const liftH = showLift ? r.height : 0;
    const top = r.top;
    const bottom = showLift ? r.bottom : r.top;
    let left = showLift ? r.left : r.left - mw / 2;
    // a wide object: the menu sits under its leading edge; a point: centred on it
    left = Math.max(EDGE, Math.min(vw - mw - EDGE, left));
    let res: Placed;
    if (vh - bottom - sb >= mh + GAP) res = { menuTop: bottom + GAP, menuLeft: left, origin: 'top', shift: 0 };
    else if (top - st >= mh + GAP) res = { menuTop: top - GAP - mh, menuLeft: left, origin: 'bottom', shift: 0 };
    else {
      const menuTop = vh - sb - mh;
      const wantBottom = menuTop - GAP;
      const shift = Math.max(st - top, Math.min(0, wantBottom - (top + liftH)));
      res = { menuTop, menuLeft: left, origin: 'top', shift };
    }
    setPlaced(res);
  }, [r, showLift]);

  // focus the first item, keep focus in the menu, close on Escape or Tab; the app behind is inert
  const present = useIsPresent();
  const release = useRef<() => void>(() => undefined);
  useEffect(() => {
    release.current = holdInert();
    const focusFirst = () => menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus({ preventScroll: true });
    let t2: ReturnType<typeof setTimeout> | undefined;
    const t = setTimeout(() => {
      focusFirst();
      // the menu becomes visible as it is placed; if this frame was too early, the next try lands
      if (!menuRef.current?.contains(document.activeElement)) t2 = setTimeout(focusFirst, 60);
    }, 20);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
      release.current();
      document.body.style.overflow = prevOverflow;
    };
  }, []);
  // closing: the app is usable again at once (not after the exit animation), and focus goes back where it came from
  useEffect(() => {
    if (present) return;
    release.current();
    // the original comes back under its copy as it settles: it has to be visible to take focus
    showOriginal.current();
    const f = spec.returnFocus;
    if (!f?.isConnected) return;
    restoreFocus(f);
    if (document.activeElement !== f) setTimeout(() => f.isConnected && restoreFocus(f), 50);
  }, [present]); // eslint-disable-line react-hooks/exhaustive-deps
  // keys are heard on the document: after a touch hold the focus may not be in the menu yet
  const onKey = (e: KeyboardEvent) => {
    if (!present) return;
    const list = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])];
    const i = list.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => {
      e.preventDefault();
      list[(n + list.length) % list.length]?.focus();
    };
    if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowUp') go(i < 0 ? list.length - 1 : i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(list.length - 1);
  };
  const keyRef = useRef(onKey);
  keyRef.current = onKey;
  useEffect(() => {
    const f = (e: KeyboardEvent) => keyRef.current(e);
    document.addEventListener('keydown', f, true);
    return () => document.removeEventListener('keydown', f, true);
  }, []);

  // swipe down anywhere on the layer dismisses
  const swipe = useRef<{ y: number; id: number } | null>(null);
  // the finger that held the object lifts over the layer: that release (and its click) is not a tap outside
  const downInside = useRef(false);
  const onPointerDown = (e: React.PointerEvent) => {
    downInside.current = true;
    swipe.current = { y: e.clientY, id: e.pointerId };
  };
  const outside = () => {
    if (downInside.current) onClose();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = swipe.current;
    if (s && e.pointerId === s.id && e.clientY - s.y > 48) {
      swipe.current = null;
      onClose();
    }
  };

  const t = reduce ? reducedFade : springs.lift;
  return (
    <motion.div
      className="cm-layer"
      role="presentation"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => (swipe.current = null)}
      initial={{ opacity: 1 }}
      exit={{ opacity: 1 }}
      transition={{ duration: 0.16 }}
    >
      <motion.div className="cm-scrim" onClick={outside} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: fadeOut }} transition={fadeIn} />
      {showLift ? (
        <motion.div
          ref={liftRef}
          className={`cm-lift ${spec.preview ? 'has-preview' : ''}`}
          style={{ left: r.left, top: r.top, width: spec.preview ? Math.min(Math.max(r.width, 200), window.innerWidth - EDGE * 2) : r.width, height: spec.preview ? undefined : r.height }}
          initial={{ scale: 1, y: 0 }}
          animate={reduce ? { scale: 1, y: placed?.shift ?? 0 } : { scale: LIFT_SCALE, y: placed?.shift ?? 0 }}
          exit={{ scale: 1, y: 0, opacity: reduce ? 0 : 1 }}
          transition={t}
          onClick={outside}
          aria-hidden="true"
        >
          {spec.preview}
        </motion.div>
      ) : null}
      <motion.div
        ref={menuRef}
        className="cm-menu"
        role="menu"
        aria-label={spec.label ?? 'Actions'}
        style={{
          top: placed?.menuTop ?? -9999,
          left: placed?.menuLeft ?? 0,
          width: Math.min(MENU_W, window.innerWidth - EDGE * 2),
          transformOrigin: placed?.origin === 'bottom' ? '50% 100%' : '50% 0%',
          visibility: placed ? 'visible' : 'hidden',
        }}
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
        animate={placed ? { opacity: 1, scale: 1 } : undefined}
        exit={reduce ? { opacity: 0, transition: fadeOut } : { opacity: 0, scale: 0.96, transition: fadeOut }}
        transition={reduce ? reducedFade : springs.lift}
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
    </motion.div>
  );
};

/** Hosts the one context menu. Mounted once in main.tsx, above the SheetProvider (so sheets can open it); `ContextMenu` and `useContextMenu` talk to it. */
export const ContextMenuProvider = ({ children }: { children: ReactNode }) => {
  const ctl = useNavInternal();
  const [spec, setSpec] = useState<(OpenContextMenu & { rect: DOMRect; key: number; tab: TabId }) | null>(null);
  const openRef = useRef(false);
  openRef.current = !!spec;
  /** The menu's one overlay history entry: Back closes the menu first. */
  const release = useRef<(() => void) | null>(null);
  const close = useCallback(() => {
    const r = release.current;
    release.current = null;
    setSpec(null);
    r?.();
  }, []);
  const api = useMemo<ContextMenuApi>(
    () => ({
      open: (o) => {
        if (!o.items.length) return;
        const rect = toRect(o.anchor);
        const liftEl = o.lift !== undefined ? o.lift : o.anchor instanceof HTMLElement ? o.anchor : null;
        const active = document.activeElement as HTMLElement | null;
        const returnFocus = o.returnFocus ?? (active && active !== document.body ? active : (liftEl?.querySelector<HTMLElement>('button, [tabindex], a[href]') ?? liftEl));
        if (o.haptic !== false) haptics.lift();
        if (!release.current)
          release.current = ctl.openOverlay(() => {
            release.current = null;
            setSpec(null);
          });
        // the menu layer renders in the scope of the tab active now (an item's useToast / useNav belong to it)
        setSpec({ ...o, returnFocus, rect, key: Date.now(), tab: ctl.getState().active });
      },
      close,
      isOpen: () => openRef.current,
    }),
    [close, ctl],
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
  /** The actions. Destructive ones are listed last, in red. Every action a gesture on this object performs belongs here too. */
  items: ContextMenuItem[];
  /** One element: the object. Its own taps keep working; a hold opens the menu. */
  children: ReactNode;
  /** A bigger preview to lift instead of the object itself. */
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
 * Long-press (450ms) on the child lifts it (a styled copy at scale 1.03 on `springs.lift`, `haptics.lift()`), dims the page
 * to 70% black with a blur, and shows a menu card anchored below the object, or above it when there is no room (or pinned to
 * the bottom with the object nudged up). Tap outside, Escape or a swipe down closes it; arrow keys move between items.
 * Keyboard: Shift+F10 or the ContextMenu key opens it, and a visually hidden "Actions" button (shown on focus) does the same
 * for VoiceOver. Rendered through a portal; the wrapper is `display: contents`.
 */
export const ContextMenu = ({ items, children, preview, label, disabled, as = 'div', a11yButton = true }: ContextMenuProps) => {
  const menu = useContextMenu();
  const wrap = useRef<HTMLElement>(null);
  const target = () => (wrap.current?.firstElementChild as HTMLElement | null) ?? null;
  const open = (focus?: HTMLElement | null) => {
    const el = target();
    if (!el || disabled) return;
    menu.open({ items, anchor: el, preview, label: label ? `${label} actions` : undefined, returnFocus: focus ?? undefined });
  };
  const lp = useLongPress(() => open(), { disabled: disabled || !items.length });
  const Tag = as as 'div';
  return (
    <Tag ref={wrap as React.RefObject<HTMLDivElement>} className="cm-target" {...lp.handlers}>
      {children}
      {a11yButton && items.length && !disabled ? (
        <button type="button" className="cm-sr" aria-haspopup="menu" onClick={(e) => open(e.currentTarget)}>
          {label ? `${label} actions` : 'Actions'}
        </button>
      ) : null}
    </Tag>
  );
};
