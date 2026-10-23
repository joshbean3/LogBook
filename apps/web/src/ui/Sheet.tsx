import { ChevronLeft, X } from 'lucide-react';
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion } from 'motion/react';
import type * as React from 'react';
import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { TabScope, useNavInternal } from '@/app/NavController';
import { LOCK_PX, lockAxis, PROJECT_S, SHEET_DISMISS_FRAC, SHEET_DISMISS_V, SHEET_SCROLL_LOCK_MS } from '@/lib/gesture';
import { deprecated, reducedFade, sheetOpen, springs } from '@/lib/motion';
import { restoreFocus } from './focus';
import { focusables, holdInert } from './inert';
import type { TabId } from './nav';
import { safeTopPx, setSheetOpen, sheetH, sheetMotion } from './sheetMotion';

/**
 * Sheet v3 (docs/feel.md §9.4, contracts §C.1). One sheet at a time, opened from anywhere, with a stack of panels inside it.
 *
 * `sheetY` (the module store `ui/sheetMotion.ts`) is the ONLY owner of the sheet's motion: px from the current detent's top,
 * 0 at rest, H off screen. The scrim (0.78 × (1 − sheetY/H)) and the recede of the tab behind (scale 0.92 + 0.08 × sheetY/H,
 * y (safeTop + 10) × (1 − sheetY/H), radius 12 × (1 − sheetY/H), origin 50% 0) are functions of it. Open and close by tap,
 * Escape or Back: `sheetOpen` (500 ms, [0.32, 0.72, 0, 1]); a drag tracks 1:1 from the header anywhere, or from the body
 * at scrollTop 0 when the first locked move is downward; a pointerdown stops whatever runs (one owner); a release dismisses
 * at ≥ 400 px/s or a quarter of the sheet, else snaps to the nearest detent of `sheetY + v × 0.35` on `springs.sheet`.
 */
export type Detent = 'medium' | 'large';
export interface SheetSpec {
  /** The serif title (28). Short: "Edit session", "Move", the session name. */
  title: ReactNode;
  body: ReactNode;
  /** A caps line above the title: a date, "TO-DO". */
  eyebrow?: ReactNode;
  /** H = the `.shell` height (innerHeight; the sheet is portalled to body over the tab bar). 'auto' (default) = content height ≤ large; 'medium' = round(0.5 × H); 'large' = H − (safeTop + 10). */
  detent?: 'auto' | Detent;
  /** Detents the grabber tap cycles and a release snaps to (default [detent]). */
  detents?: Detent[];
  /** Sticky under the grabber, fixed height: the builder's ghost preview (160). Content crossfades inside it. */
  header?: ReactNode;
  /** Wider on a desktop (760 instead of 560). */
  wide?: boolean;
  /** Scrim tap does not close (unsaved input). Escape, Close, Back and a flick still do. */
  sticky?: boolean;
  /** One header action before Close (an IconButton). It belongs to its panel: a pushed panel shows its own (or none). */
  action?: ReactNode;
  onClose?: () => void;
  /** @deprecated accepted and ignored (contracts rule 5): the title flyer is gone. */
  layoutId?: string;
}
export interface SheetApi {
  /** Replaces the whole stack; renders the body on this call (never earlier). */
  open: (spec: SheetSpec) => void;
  /** Slides a panel in inside the sheet on springs.page; adds no history entry (Back closes the whole sheet). */
  push: (spec: SheetSpec) => void;
  pop: () => void;
  close: () => void;
  update: (spec: Partial<SheetSpec>) => void;
  isOpen: () => boolean;
}
const Ctx = createContext<SheetApi | null>(null);
/** The sheet API: `const sheet = useSheet(); sheet.open({ title, body })`. */
export const useSheet = (): SheetApi => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSheet outside SheetProvider');
  return c;
};
/** @deprecated returns `{}` in Sheet v3 (contracts rule 5): the title flyer is gone. */
export const shared = (_id: string): Record<string, never> => {
  deprecated('shared()');
  return {};
};
export { useSheetMotion, type SheetMotion } from './sheetMotion';

const DepthCtx = createContext(0);
/** How deep the panel this component renders in sits (1 for the first). */
export const useSheetDepth = (): number => useContext(DepthCtx);

type Anim = ReturnType<typeof animate>;
type AnyDetent = 'auto' | Detent;
type CloseHow = { kind: 'tween' } | { kind: 'flick'; v: number };
interface PanelHandle {
  close: (how: CloseHow) => void;
}

const slide = {
  enter: (dir: number) => ({ x: dir > 0 ? '100%' : dir < 0 ? '-30%' : 0, opacity: dir < 0 ? 0 : 1 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? '-30%' : '100%', opacity: dir > 0 ? 0 : 1 }),
};
const fade = { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0 } };
const SCRIM = 0.78;
const FRAME_S = 1 / 60;

/**
 * `sheetOpen` already one frame in: the first frame that shows the sheet shows it moving (§9.4: first motion frame ≤ 1
 * frame after the tap). The curve is split exactly (De Casteljau) at the point one frame of its 500 ms has passed, so the
 * rest is the same cubic-bezier(.32,.72,0,1), renormalised. Returns the progress already made and the rest's transition.
 */
const sheetOpenFrom = (): { done: number; rest: { duration: number; ease: [number, number, number, number] } } => {
  const dur = (sheetOpen as { duration: number }).duration;
  const [x1, y1, x2, y2] = (sheetOpen as { ease: [number, number, number, number] }).ease;
  const u = FRAME_S / dur;
  const bx = (t: number) => 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t ** 2 * x2 + t ** 3;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (bx(m) < u) lo = m;
    else hi = m;
  }
  const t = (lo + hi) / 2;
  const L = (a: number[], b: number[]) => [a[0]! + (b[0]! - a[0]!) * t, a[1]! + (b[1]! - a[1]!) * t];
  const P1 = [x1, y1];
  const P2 = [x2, y2];
  const P3 = [1, 1];
  const A = L([0, 0], P1);
  const B = L(P1, P2);
  const C = L(P2, P3);
  const D = L(A, B);
  const E = L(B, C);
  const F = L(D, E);
  const nx = (x: number) => (x - F[0]!) / (1 - F[0]!);
  const ny = (y: number) => (y - F[1]!) / (1 - F[1]!);
  return { done: F[1]!, rest: { duration: dur * (1 - F[0]!), ease: [nx(E[0]!), ny(E[1]!), nx(C[0]!), ny(C[1]!)] } };
};
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

interface PanelProps {
  stack: SheetSpec[];
  dir: number;
  tab: TabId;
  opener: RefObject<HTMLElement | null>;
  register: (h: PanelHandle | null) => void;
  requestClose: (how: CloseHow) => void;
  onGone: () => void;
  pop: () => void;
}

const Panel = ({ stack, dir, tab, opener, register, requestClose, onGone, pop }: PanelProps) => {
  const reduce = !!useReducedMotion();
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const { sheetY, height } = sheetMotion();
  const depth = stack.length;
  const first = stack[0]!;
  const top = stack[depth - 1]!;
  // the detents, lowest (smallest) first
  const ds = useMemo<AnyDetent[]>(() => {
    const list: AnyDetent[] = first.detents?.length ? [...first.detents] : first.detent && first.detent !== 'auto' ? [first.detent] : ['auto'];
    return list.sort((a, b) => (a === b ? 0 : a === 'large' ? 1 : b === 'large' ? -1 : a === 'medium' ? 1 : -1));
  }, [first.detents, first.detent]);
  const boxKind: AnyDetent = ds.includes('large') ? 'large' : ds.includes('medium') ? 'medium' : 'auto';
  const [detent, setDetent] = useState<AnyDetent>(() => (first.detent && ds.includes(first.detent) ? first.detent : ds[ds.length - 1]!));
  const cur = useRef(detent);
  const base = useMotionValue(0);
  const opacity = useMotionValue(reduce ? 0 : 1);
  const scrimRef = useRef<HTMLDivElement>(null);

  /** H, the detent heights, the box, and each detent's offset inside the box. */
  const geo = () => {
    const H = sheetH();
    const st = safeTopPx();
    const large = H - (st + 10);
    const medium = Math.round(0.5 * H);
    const box = boxKind === 'large' ? large : boxKind === 'medium' ? medium : (ref.current?.offsetHeight ?? 0);
    const vis = (d: AnyDetent) => (d === 'large' ? large : d === 'medium' ? medium : box);
    const off = (d: AnyDetent) => Math.max(0, box - vis(d));
    return { H, st, vis, off };
  };
  const anim = useRef<Anim | null>(null);
  const closing = useRef(false);
  const stop = () => {
    anim.current?.stop();
    anim.current = null;
  };
  /** Focus, inert behind: on the open animation's completion (or the first rest after it was caught), never on a timer. */
  const opened = useRef(false);
  const wanted = useRef<HTMLElement | null>(null);
  const releaseInert = useRef<() => void>(() => undefined);
  const onOpened = () => {
    if (opened.current) return;
    opened.current = true;
    const panel = ref.current;
    if (!panel) return;
    releaseInert.current = holdInert();
    const want = wanted.current?.isConnected ? wanted.current : null;
    const firstField = focusables(panel).find((el) => !el.classList.contains('icon-btn')) ?? focusables(panel)[0] ?? panel;
    (want ?? firstField).focus({ preventScroll: true });
  };

  /** Re-express the sheet against detent `d` (same frame, no visual change) and spring to it. */
  const snapTo = (d: AnyDetent, v: number) => {
    const g = geo();
    const visual = base.get() + sheetY.get();
    cur.current = d;
    setDetent(d);
    base.jump(g.off(d));
    sheetY.jump(visual - g.off(d));
    height.set(g.vis(d));
    stop();
    anim.current = animate(sheetY, 0, reduce ? { duration: 0 } : { ...springs.sheet, velocity: v, onComplete: onOpened });
    if (reduce) onOpened();
  };

  // the scrim and the recede of the tab behind ride sheetY (and the reduced-motion fade)
  useLayoutEffect(() => {
    const tabEl = document.querySelector<HTMLElement>(`.tab[data-tab="${tab}"]`);
    const scroller = tabEl?.querySelector<HTMLElement>('.tab-scroll') ?? null;
    const pushed = tabEl ? [...tabEl.querySelectorAll<HTMLElement>('.pushed')] : [];
    // the page behind keeps its scrollTop but does not scroll while the sheet is up
    const scrollers = [scroller, ...pushed].filter((el): el is HTMLElement => !!el);
    for (const el of scrollers) el.style.overflowY = 'hidden';
    // the receding tab shows black around it (iOS's card stack), only while a sheet is up
    const host = reduce ? null : (tabEl?.parentElement ?? null);
    if (host) host.style.background = '#000';
    // under a pushed page, the layers it covers are hidden while the sheet is up: scaled, the top page's edge would let
    // a fraction of a pixel of them through (they are inert behind the sheet either way)
    const covered = pushed.length ? [scroller, ...pushed.slice(0, -1)].filter((el): el is HTMLElement => !!el) : [];
    for (const el of covered) el.style.visibility = 'hidden';
    /*
     * One writer, synchronous: the sheet's transform, the scrim and the recede are written from sheetY's change (in motion's
     * frame step during an animation, in the pointer handler during a drag, at once on a jump), so the three can never be a
     * frame apart and the first frame already shows the sheet where sheetY says.
     */
    const apply = () => {
      const g = geo();
      const lowest = ds[0]!;
      const yv = base.get() + sheetY.get();
      const d = Math.max(0, yv - g.off(lowest));
      const p = clamp01(1 - d / g.H);
      const el = ref.current;
      if (el) {
        el.style.transform = `translateY(${yv.toFixed(2)}px)`;
        el.style.opacity = String(opacity.get());
      }
      if (scrimRef.current) scrimRef.current.style.opacity = (SCRIM * p * opacity.get()).toFixed(4);
      if (!tabEl) return;
      if (reduce) return;
      tabEl.style.transform = `translateY(${((g.st + 10) * p).toFixed(2)}px) scale(${(0.92 + 0.08 * (1 - p)).toFixed(4)})`;
      tabEl.style.borderRadius = `${(12 * p).toFixed(2)}px`;
    };
    const offs = [sheetY.on('change', apply), base.on('change', apply), opacity.on('change', apply)];
    apply();
    return () => {
      offs.forEach((f) => f());
      if (tabEl) {
        tabEl.style.transform = '';
        tabEl.style.borderRadius = '';
      }
      for (const el of scrollers) el.style.overflowY = '';
      for (const el of covered) el.style.visibility = '';
      if (host) host.style.background = '';
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // open: the body is rendered (this commit); the motion starts on the next frame
  useLayoutEffect(() => {
    const panel = ref.current;
    if (!panel) return;
    // an autoFocus field took focus in this commit: it gets it back on completion; until then the opener keeps it
    if (panel.contains(document.activeElement) && document.activeElement !== panel) {
      wanted.current = document.activeElement as HTMLElement;
      const o = opener.current;
      if (o?.isConnected) o.focus({ preventScroll: true });
      else (document.activeElement as HTMLElement).blur();
    }
    const g = geo();
    const d = cur.current;
    base.jump(g.off(d));
    height.set(g.vis(d));
    setSheetOpen(true);
    if (reduce) {
      sheetY.jump(0);
      anim.current = animate(opacity, 1, { ...reducedFade, onComplete: onOpened });
    } else {
      const { done, rest } = sheetOpenFrom();
      sheetY.jump(g.H * (1 - done));
      anim.current = animate(sheetY, 0, { ...rest, onComplete: onOpened });
    }
    const ro = new ResizeObserver(() => {
      if (boxKind === 'auto') height.set(ref.current?.offsetHeight ?? 0);
    });
    ro.observe(panel);
    register({
      close: (how) => {
        closing.current = true;
        stop();
        g0.current.off?.();
        g0.current.id = -1;
        const H = sheetH();
        const done = () => onGone();
        if (reduce) anim.current = animate(opacity, 0, { ...reducedFade, onComplete: done });
        else if (how.kind === 'flick') anim.current = animate(sheetY, H, { ...(how.v >= SHEET_DISMISS_V ? springs.sheetFlick : springs.sheet), velocity: how.v, onComplete: done });
        else anim.current = animate(sheetY, H, { ...sheetOpen, onComplete: done });
      },
    });
    return () => {
      register(null);
      ro.disconnect();
      stop();
      releaseInert.current();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // keep focus inside the panel
  useEffect(() => {
    const panel = ref.current;
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const list = focusables(panel);
      if (!list.length) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const a = list[0]!;
      const z = list[list.length - 1]!;
      const c = document.activeElement;
      if (e.shiftKey && (c === a || c === panel || !panel.contains(c))) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && (c === z || !panel.contains(c))) {
        e.preventDefault();
        a.focus();
      }
    };
    panel.addEventListener('keydown', onKey);
    return () => panel.removeEventListener('keydown', onKey);
  }, []);
  // a push or a pop: focus moves into the new panel once it is in (a frame, not a timer)
  const firstDepth = useRef(depth);
  useEffect(() => {
    const panel = ref.current;
    if (!panel || depth === firstDepth.current) return;
    firstDepth.current = -1;
    const raf = requestAnimationFrame(() => {
      const body = panel.querySelector<HTMLElement>(`.sheet-body[data-depth="${depth}"]`);
      const f = body ? focusables(body)[0] : null;
      (f ?? panel.querySelector<HTMLElement>('.sheet-title') ?? panel).focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [depth]);

  // ---------- the drag (§9.4): pointer events on the sheet; the body's scroll held off only for a claimed drag ----------
  const g0 = useRef({ id: -1, zone: null as 'head' | 'body' | null, x0: 0, sy: 0, y0: 0, claimed: false, moved: false, grab: false, body: null as HTMLElement | null, off: null as null | (() => void) });
  const lastTop = useRef(-Infinity);
  const onBodyScroll = (e: React.UIEvent<HTMLElement>) => {
    const el = e.target as HTMLElement;
    if (!el.classList?.contains('sheet-body')) return;
    if (el.scrollTop <= 0) lastTop.current = performance.now();
  };
  /** 1:1 below the top-most detent; above it, −8 × ln(1 + over/8). */
  const follow = (raw: number) => {
    const minY = -base.get();
    if (raw >= minY) return raw;
    return minY - 8 * Math.log(1 + (minY - raw) / 8);
  };
  const settle = (v: number) => {
    const g = geo();
    const visual = base.get() + sheetY.get();
    const lowest = ds[0]!;
    const below = visual - g.off(lowest);
    if (below >= 0 && (v >= SHEET_DISMISS_V || below >= SHEET_DISMISS_FRAC * g.vis(lowest))) return requestClose({ kind: 'flick', v });
    const proj = visual + v * PROJECT_S;
    let best = cur.current;
    let bestD = Infinity;
    for (const d of ds) {
      const dd = Math.abs(proj - g.off(d));
      if (dd < bestD) {
        bestD = dd;
        best = d;
      }
    }
    snapTo(best, v);
  };
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = g0.current;
    // a second finger is ignored once a gesture began; a closing sheet takes no gesture
    if (closing.current || !e.isPrimary || st.id !== -1 || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const t = e.target as Element;
    const head = t.closest('.sheet-grab, .sheet-header');
    const body = t.closest<HTMLElement>('.sheet-body');
    // one owner: a pointerdown stops whatever runs (the rise, a snap) where it is
    const wasMoving = !!anim.current;
    stop();
    st.id = e.pointerId;
    st.x0 = e.clientX;
    st.sy = e.clientY;
    st.y0 = e.clientY - sheetY.get();
    st.claimed = false;
    st.moved = false;
    st.grab = !!t.closest('.sheet-grab-bar');
    st.body = body;
    st.zone = head ? 'head' : body && body.scrollTop <= 0 && performance.now() - lastTop.current >= SHEET_SCROLL_LOCK_MS ? 'body' : null;
    const offs: Array<() => void> = [];
    if (st.zone === 'body' && body) {
      // gesture-scoped: a downward move at scrollTop 0 is the sheet's, so the browser must not start an overscroll with it
      const tm = (ev: TouchEvent) => {
        const tt = ev.touches[0];
        if (!tt || !ev.cancelable) return;
        if (st.claimed || (st.zone === 'body' && tt.clientY - st.sy > 0)) ev.preventDefault();
      };
      body.addEventListener('touchmove', tm, { passive: false });
      offs.push(() => body.removeEventListener('touchmove', tm));
    }
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== st.id) return;
      const dx = ev.clientX - st.x0;
      const dy = ev.clientY - st.sy;
      if (!st.claimed) {
        if (st.zone === 'head') st.claimed = true;
        else if (st.zone === 'body') {
          if (Math.hypot(dx, dy) < LOCK_PX) return;
          if (lockAxis(dx, dy) === 'y' && dy > 0 && (st.body?.scrollTop ?? 0) <= 0) st.claimed = true;
          else {
            st.zone = null;
            return;
          }
        } else return;
      }
      if (Math.abs(dy) > 3) st.moved = true;
      sheetY.set(follow(ev.clientY - st.y0));
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== st.id) return;
      offs.forEach((f) => f());
      st.id = -1;
      const v = sheetY.getVelocity();
      if (st.claimed && st.moved) return settle(v);
      // a tap on the grabber row cycles the detents
      if (st.grab && !st.moved && ds.length > 1) {
        const i = ds.indexOf(cur.current);
        return snapTo(ds[(i + 1) % ds.length]!, 0);
      }
      // caught mid-move and let go without a drag: settle from where it is
      if (wasMoving || Math.abs(sheetY.get()) > 0.5) settle(ev.type === 'pointercancel' ? 0 : v);
    };
    const lo = { capture: true, passive: true } as const;
    window.addEventListener('pointermove', move, lo);
    window.addEventListener('pointerup', end, lo);
    window.addEventListener('pointercancel', end, lo);
    offs.push(() => {
      window.removeEventListener('pointermove', move, lo);
      window.removeEventListener('pointerup', end, lo);
      window.removeEventListener('pointercancel', end, lo);
    });
    st.off = () => offs.forEach((f) => f());
  };
  useEffect(() => () => g0.current.off?.(), []);

  const v = reduce ? fade : slide;
  const t = reduce ? reducedFade : springs.page;
  const titleId = `${id}-title-${depth}`;
  const boxStyle: React.CSSProperties = boxKind === 'medium' ? { height: geo().vis('medium') } : {};
  return (
    <>
      <div ref={scrimRef} className="sheet-scrim" aria-hidden="true" onClick={() => !first.sticky && requestClose({ kind: 'tween' })} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`sheet ${top.wide ? 'wide' : ''}`}
        data-detent={detent}
        data-box={boxKind}
        style={boxStyle}
        onPointerDown={onPointerDown}
        onScrollCapture={onBodyScroll}
      >
        <div className="sheet-grab">
          <div className="sheet-grab-bar" aria-hidden="true">
            <div className="sheet-grip" />
          </div>
          <div className="sheet-head">
            {depth > 1 ? (
              <button type="button" className="icon-btn sheet-back" aria-label="Back" title="Back" onClick={pop}>
                <ChevronLeft size={24} strokeWidth={2.2} aria-hidden="true" />
              </button>
            ) : null}
            <div className="sheet-titles">
              <AnimatePresence custom={dir} mode="popLayout" initial={false}>
                <motion.div key={depth} className="sheet-titles-in" custom={dir} variants={v} initial="enter" animate="center" exit="exit" transition={t}>
                  {top.eyebrow ? <span className="caps sheet-eyebrow">{top.eyebrow}</span> : null}
                  <h2 className="sheet-title" id={titleId} tabIndex={-1}>
                    {top.title}
                  </h2>
                </motion.div>
              </AnimatePresence>
            </div>
            {top.action ? (
              <span key={depth} className="sheet-action">
                {top.action}
              </span>
            ) : null}
            <button type="button" className="icon-btn" aria-label="Close" title="Close" onClick={() => requestClose({ kind: 'tween' })}>
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </div>
        {top.header ? <div className="sheet-header">{top.header}</div> : null}
        <div className="sheet-stack">
          <AnimatePresence custom={dir} mode="popLayout" initial={false}>
            <motion.div key={depth} data-depth={depth} className="sheet-body" custom={dir} variants={v} initial="enter" animate="center" exit="exit" transition={t}>
              <DepthCtx.Provider value={depth}>{top.body}</DepthCtx.Provider>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </>
  );
};

/**
 * Hosts the one sheet. Mounted once in main.tsx under the menu provider. `open` captures the active tab and the focused
 * control, writes one overlay history entry (Back closes the whole sheet; an inner push adds none) and renders the body on
 * this call; the whole panel renders inside the TabScope of that tab.
 */
export const SheetProvider = ({ children }: { children: ReactNode }): React.JSX.Element => {
  const ctl = useNavInternal();
  const [state, setState] = useState<{ stack: SheetSpec[]; dir: number; tab: TabId; key: number }>({ stack: [], dir: 0, tab: 'today', key: 0 });
  const st = useRef(state);
  st.current = state;
  const phase = useRef<'closed' | 'open' | 'closing'>('closed');
  const opener = useRef<HTMLElement | null>(null);
  /** The sheet's one overlay history entry. */
  const release = useRef<(() => void) | null>(null);
  const panel = useRef<PanelHandle | null>(null);
  const restore = useRef(false);
  const gone = useCallback((key: number) => {
    // a closing panel that a new open() replaced is not the sheet any more
    if (key !== st.current.key || phase.current === 'open') return;
    phase.current = 'closed';
    restore.current = true;
    setState((s) => ({ ...s, stack: [] }));
    setSheetOpen(false);
  }, []);
  const beginClose = useCallback(
    (how: CloseHow, viaBack = false) => {
      if (phase.current !== 'open') return;
      phase.current = 'closing';
      const r = release.current;
      release.current = null;
      if (!viaBack) r?.();
      for (const s of st.current.stack) s.onClose?.();
      if (panel.current) panel.current.close(how);
      else gone(st.current.key);
    },
    [gone],
  );
  const api = useMemo<SheetApi>(() => {
    /** Returns true when this call opens a fresh sheet (none up, or one closing). */
    const capture = () => {
      const fresh = phase.current !== 'open';
      if (fresh) {
        opener.current = (document.activeElement as HTMLElement | null) ?? null;
        release.current = ctl.openOverlay(() => beginClose({ kind: 'tween' }, true));
      }
      phase.current = 'open';
      return fresh;
    };
    return {
      open: (s) => {
        const fresh = capture();
        const tab = ctl.getState().active;
        setState((cur) => ({ stack: [s], dir: 0, tab: fresh ? tab : cur.tab, key: fresh ? cur.key + 1 : cur.key }));
      },
      push: (s) => {
        const fresh = capture();
        const tab = ctl.getState().active;
        setState((cur) => (fresh ? { stack: [s], dir: 0, tab, key: cur.key + 1 } : { ...cur, stack: [...cur.stack, s], dir: 1 }));
      },
      pop: () => {
        if (st.current.stack.length <= 1) return beginClose({ kind: 'tween' });
        setState((cur) => (cur.stack.length <= 1 ? cur : { ...cur, stack: cur.stack.slice(0, -1), dir: -1 }));
      },
      close: () => beginClose({ kind: 'tween' }),
      update: (p) => setState((cur) => (cur.stack.length ? { ...cur, stack: [...cur.stack.slice(0, -1), { ...cur.stack[cur.stack.length - 1]!, ...p }] } : cur)),
      isOpen: () => phase.current === 'open',
    };
  }, [beginClose, ctl]);
  const up = state.stack.length > 0;
  // closed: focus goes back to the control that opened the sheet (after the panel let go of the page's inert)
  useEffect(() => {
    if (up || !restore.current) return;
    restore.current = false;
    const o = opener.current;
    opener.current = null;
    if (o && o.isConnected && typeof o.focus === 'function') restoreFocus(o);
  }, [up]);
  useEffect(() => {
    if (!up) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && phase.current === 'open' && !document.querySelector('.cm-layer') && beginClose({ kind: 'tween' });
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [up, beginClose]);
  const register = useCallback((h: PanelHandle | null) => {
    panel.current = h;
  }, []);
  const key = state.key;
  return (
    <Ctx.Provider value={api}>
      {children}
      {createPortal(
        up ? (
          <div className="sheet-wrap" key={key}>
            <TabScope tab={state.tab}>
              <Panel stack={state.stack} dir={state.dir} tab={state.tab} opener={opener} register={register} requestClose={beginClose} onGone={() => gone(key)} pop={api.pop} />
            </TabScope>
          </div>
        ) : null,
        document.body,
      )}
    </Ctx.Provider>
  );
};
