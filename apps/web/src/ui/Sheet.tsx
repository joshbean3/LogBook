import { ChevronLeft, X } from 'lucide-react';
import { animate, AnimatePresence, motion, useDragControls, useMotionValue, usePresence, useReducedMotion, useTransform, type PanInfo } from 'motion/react';
import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { TabScope, useNavInternal } from '@/app/NavController';
import { fadeIn, fadeOut, reducedFade, springs } from '@/lib/motion';
import type { TabId } from './nav';
import { setSheetOpen } from './sheetMotion';
import { restoreFocus } from './focus';
import { focusables, holdInert } from './inert';

/**
 * One bottom sheet at a time, opened from anywhere, with a stack inside it.
 *
 * `sheet.open(spec)` shows a sheet (replacing whatever was up); `sheet.push(spec)` slides a new panel in from the right
 * inside the same sheet, with a back chevron in the header; `sheet.pop()` goes back; `sheet.close()` closes it all.
 * Every sheet has one header: an optional caps eyebrow, the serif title (28), an optional action (`action`), and Close.
 */
export type Detent = 'medium' | 'large';
export interface SheetSpec {
  /** The serif title (28). Short: "Edit session", "Move", the session name. */
  title: ReactNode;
  body: ReactNode;
  /** A caps line above the title: a date, "TO-DO". */
  eyebrow?: ReactNode;
  /** 'auto' (default) = content height ≤ large; 'medium' = half the shell; 'large' = the shell less safeTop + 10. */
  detent?: 'auto' | Detent;
  /** Detents the grabber tap cycles and a release snaps to. (Sheet v3, WP1's next step.) */
  detents?: Detent[];
  /** Sticky under the grabber, fixed height: the builder's ghost preview. (Sheet v3, WP1's next step.) */
  header?: ReactNode;
  onClose?: () => void;
  /**
   * @deprecated accepted and ignored by Sheet v3 (contracts rule 5). Shared element: the opener's title (marked with `{...shared(id)}`, i.e. `data-shared="session-12"`) travels into this
   * sheet's title on `springs.page` while the sheet rises, and back to it on close. Ids follow docs/foundation.md:
   * `session-<id>`, `habit-<id>`, `entry-<date>`, `week-<isoWeek>`.
   */
  layoutId?: string;
  /** Wider on a desktop (760 instead of 560). */
  wide?: boolean;
  /** A tap on the scrim does not close it (an editor with unsaved input). Escape and Close still do. */
  sticky?: boolean;
  /**
   * One header action, before Close: an `IconButton` (a session's ⋯, which opens a ContextMenu with `useContextMenu`). It
   * belongs to its panel: a pushed panel shows its own (or none).
   */
  action?: ReactNode;
}
export interface SheetApi {
  /** Show a sheet, replacing the whole stack. */
  open: (spec: SheetSpec) => void;
  /** Slide a panel in from the right inside the open sheet (opens one if none is up). */
  push: (spec: SheetSpec) => void;
  /** Back one panel; closes the sheet from the first. */
  pop: () => void;
  close: () => void;
  /** Change the top panel in place (its title after a save, say). */
  update: (spec: Partial<SheetSpec>) => void;
  isOpen: () => boolean;
}
const Ctx = createContext<SheetApi | null>(null);
/** The sheet API: `const sheet = useSheet(); sheet.open({ title, body })`. */
export const useSheet = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSheet outside SheetProvider');
  return c;
};
/**
 * Mark the element a sheet's title travels from: `<span {...shared(`session-${s.id}`)}>Easy 6</span>`, then open the sheet
 * with `layoutId: `session-${s.id}``. Only one element on the page should carry an id at a time.
 */
/** @deprecated returns `{}` in Sheet v3 (contracts rule 5); the title flyer goes with WP1's next step. */
export const shared = (id: string) => ({ 'data-shared': id });
export { useSheetMotion, type SheetMotion } from './sheetMotion';

const DepthCtx = createContext(0);
/** How deep the panel this component renders in sits (1 for the first). */
export const useSheetDepth = () => useContext(DepthCtx);

const slide = {
  enter: (dir: number) => ({ x: dir > 0 ? '100%' : dir < 0 ? '-30%' : 0, opacity: dir < 0 ? 0 : 1 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? '-30%' : '100%', opacity: dir > 0 ? 0 : 1 }),
};
const fade = { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0 } };

/** The sheet's chrome: one header, focus kept inside while it is up and given back to the opener on close. */
const Panel = ({ stack, dir, close, pop, opener }: { stack: SheetSpec[]; dir: number; close: () => void; pop: () => void; opener: React.RefObject<HTMLElement | null> }) => {
  const reduce = useReducedMotion();
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const drag = useDragControls();
  const depth = stack.length;
  const top = stack[depth - 1]!;

  /*
   * The shared title. The opener sits in the scrolled page and the title in a fixed, clipped sheet, so this is a hand-made
   * FLIP with a flyer (a fixed copy of the title above the sheet) rather than motion's layoutId: `fly` runs 1 → 0 with
   * the sheet's own `sheetY` (springs.sheet), once the title row is on screen, so the flyer leaves exactly from the opener
   * and lands exactly on the title on the frame the sheet settles, and the title shows again. Closing flies it home on
   * springs.page while the sheet falls.
   */
  const sheetY = useMotionValue(reduce ? 0 : window.innerHeight);
  const fly = useMotionValue(0);
  const flight = useRef({ dx: 0, dy: 0, s: 1, left: 0, top: 0, width: 0, src: null as HTMLElement | null });
  const [flying, setFlying] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const flyX = useTransform(fly, (f) => f * flight.current.dx);
  // the flyer travels straight from the opener to the title's resting place as the sheet rises (fly is the sheet's own
  // progress, see below), so it never runs ahead of the slot nor dips to meet it; past rest (a spring's last pixel above
  // it) it moves with the sheet, so it lands exactly on the title
  const flyY = useTransform([fly, sheetY], ([f, y]: number[]) => f! * flight.current.dy + Math.min(0, y!));
  const flyScale = useTransform(fly, (f) => 1 + f * (flight.current.s - 1));
  const sharedId = stack[0]?.layoutId;
  /** Where the title rests (its box less the sheet's offset), and the way from there to the opener. */
  const aim = () => {
    const el = titleRef.current;
    const src = flight.current.src;
    if (!el || !src) return false;
    const a = src.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    const f = flight.current;
    f.left = b.left;
    f.top = b.top - sheetY.get();
    f.width = b.width;
    f.dx = a.left - f.left;
    f.dy = a.top - f.top;
    f.s = Math.min(2, Math.max(0.5, a.height / (el.offsetHeight || 1)));
    return true;
  };
  useLayoutEffect(() => {
    if (reduce || !sharedId) return;
    const src = document.querySelector<HTMLElement>(`[data-shared="${CSS.escape(sharedId)}"]`);
    if (!src) return;
    flight.current.src = src;
    if (!aim()) return;
    fly.jump(1);
    src.style.visibility = 'hidden';
    setFlying(true);
    /*
     * The flight rides the sheet's own spring, so the two arrive together. Until the sheet's title row has risen onto the
     * screen the flyer sits exactly where the opener was (fly = 1), so it never floats alone over the page. From then on its
     * progress is the sheet's: fly = what is left of the rise (sheetY) over what was left when the row came on screen, so the
     * flyer reaches the title's slot on the very frame the sheet settles, never ahead of it (critic N5). A fallback ends it
     * if the sheet never moves.
     */
    let from = 0;
    let done = false;
    const offs: Array<() => void> = [];
    const land = () => {
      if (done) return;
      done = true;
      // landed: the sheet's later moves (a drag, the close) are its own, the close runs its own flight home
      offs.forEach((f) => f());
      fly.set(0);
      setFlying(false);
    };
    const headerIn = (y: number) => flight.current.top + y + (titleRef.current?.offsetHeight ?? 34) <= window.innerHeight - 8;
    const follow = (y: number) => {
      if (!from) {
        if (!headerIn(y)) return;
        from = Math.max(1, y);
      }
      fly.set(Math.min(1, Math.max(0, y / from)));
    };
    follow(sheetY.get());
    offs.push(sheetY.on('change', follow), sheetY.on('animationComplete', land));
    const fallback = setTimeout(land, 1200);
    return () => {
      offs.forEach((f) => f());
      clearTimeout(fallback);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // closing: the title flies home while the sheet falls, and the opener reappears when it lands
  const [present, safeToRemove] = usePresence();
  useEffect(() => {
    if (present) return;
    const src = flight.current.src;
    const done = () => {
      if (src) src.style.visibility = '';
      flight.current.src = null;
      safeToRemove?.();
    };
    if (!src || reduce || depth !== 1 || !src.isConnected || !aim()) return done();
    setFlying(true);
    void animate(fly, 1, springs.page).then(done);
  }, [present]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(
    () => () => {
      if (flight.current.src) flight.current.src.style.visibility = '';
    },
    [],
  );
  useEffect(() => {
    const panel = ref.current;
    if (!panel) return;
    // the rest of the app is off limits to focus and to the screen reader while the sheet is up
    const release = holdInert();
    const first = focusables(panel).find((el) => !el.classList.contains('icon-btn')) ?? focusables(panel)[0] ?? panel;
    const timer = setTimeout(() => {
      // an autoFocus field inside the body wins; otherwise the first control, never Close
      if (!panel.contains(document.activeElement)) first.focus({ preventScroll: true });
    }, 30);
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
      const cur = document.activeElement;
      if (e.shiftKey && (cur === a || cur === panel || !panel.contains(cur))) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && (cur === z || !panel.contains(cur))) {
        e.preventDefault();
        a.focus();
      }
    };
    panel.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      panel.removeEventListener('keydown', onKey);
      release();
      // back to the control that opened the sheet (captured at open(), before any autoFocus field took focus), if it is still on the page
      const o = opener.current;
      opener.current = null;
      if (o && o.isConnected && typeof o.focus === 'function') restoreFocus(o);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // a push or a pop: the new panel starts at the top, and focus moves into it
  const firstDepth = useRef(depth);
  useEffect(() => {
    const panel = ref.current;
    if (!panel || depth === firstDepth.current) return;
    firstDepth.current = -1;
    panel.scrollTop = 0;
    const t = setTimeout(() => {
      const body = panel.querySelector<HTMLElement>(`[data-depth="${depth}"]`);
      const f = body ? focusables(body)[0] : null;
      (f ?? panel.querySelector<HTMLElement>('.sheet-title') ?? panel).focus({ preventScroll: true });
    }, 60);
    return () => clearTimeout(t);
  }, [depth]);
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 90 || info.velocity.y > 600) close();
  };
  const v = reduce ? fade : slide;
  const t = reduce ? reducedFade : springs.page;
  const titleId = `${id}-title-${depth}`;
  return (
    <>
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`sheet ${top.wide ? 'wide' : ''} ${top.detent === 'large' ? 'large' : ''}`}
        data-detent={top.detent ?? 'auto'}
        style={{ y: sheetY }}
        initial={reduce ? { opacity: 0 } : { y: window.innerHeight, opacity: 1 }}
        animate={reduce ? { opacity: 1 } : { y: 0 }}
        exit={reduce ? { opacity: 0, transition: fadeOut } : { y: window.innerHeight, transition: { ...springs.sheet, restDelta: 2 } }}
        transition={reduce ? reducedFade : springs.sheet}
        drag="y"
        dragControls={drag}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={onDragEnd}
      >
        <div className="sheet-grab" onPointerDown={(e) => !(e.target as HTMLElement).closest('button') && drag.start(e)}>
          <div className="sheet-grip" aria-hidden="true" />
          <div className="sheet-head">
            {depth > 1 ? (
              <button type="button" className="icon-btn sheet-back" aria-label="Back" title="Back" onClick={pop}>
                <ChevronLeft size={24} strokeWidth={2.2} aria-hidden="true" />
              </button>
            ) : null}
            <div className="sheet-titles">
              <AnimatePresence custom={dir} mode="popLayout">
                <motion.div key={depth} className="sheet-titles-in" custom={dir} variants={v} initial="enter" animate="center" exit="exit" transition={t}>
                  {top.eyebrow ? <span className="caps sheet-eyebrow">{top.eyebrow}</span> : null}
                  <motion.h2 ref={depth === 1 ? titleRef : undefined} className="sheet-title" id={titleId} tabIndex={-1} style={depth === 1 && flying ? { visibility: 'hidden' } : undefined}>
                    {top.title}
                  </motion.h2>
                </motion.div>
              </AnimatePresence>
            </div>
            {top.action ? (
              <span key={depth} className="sheet-action">
                {top.action}
              </span>
            ) : null}
            <button type="button" className="icon-btn" aria-label="Close" title="Close" onClick={close}>
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="sheet-stack">
          <AnimatePresence custom={dir} mode="popLayout">
            <motion.div key={depth} data-depth={depth} className="sheet-body stack" style={{ gap: 14 }} custom={dir} variants={v} initial="enter" animate="center" exit="exit" transition={t}>
              <DepthCtx.Provider value={depth}>{top.body}</DepthCtx.Provider>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
      {flying && depth === 1 ? (
        <motion.div
          className="sheet-title sheet-flyer"
          aria-hidden="true"
          style={{ left: flight.current.left, top: flight.current.top, width: flight.current.width, x: flyX, y: flyY, scale: flyScale }}
        >
          {stack[0]!.title}
        </motion.div>
      ) : null}
    </>
  );
};

/**
 * Sheet v2. Opens on `springs.sheet` from the bottom over a 78% black scrim (a centred card on a desktop); drag the header
 * down (90px or a fling) to dismiss; Escape closes; focus is trapped inside and returns to the opener. `push` and `pop` move
 * through a stack inside one sheet on `springs.page`. `detent: 'large'` for editors. A `layoutId` on the spec makes the
 * title a shared element: mark the opener's title with `{...shared(id)}` and it travels into the header as the sheet rises,
 * and home again on close. Reduced motion: every move is a 150ms fade, and nothing travels.
 */
export const SheetProvider = ({ children }: { children: ReactNode }) => {
  const ctl = useNavInternal();
  const [state, setState] = useState<{ stack: SheetSpec[]; dir: number; tab: TabId }>({ stack: [], dir: 0, tab: 'today' });
  const isOpen = useRef(false);
  const opener = useRef<HTMLElement | null>(null);
  /** The sheet's one overlay history entry: Back closes the sheet first (an inner push adds none). */
  const release = useRef<(() => void) | null>(null);
  const closeNow = useCallback(() => {
    isOpen.current = false;
    setState((cur) => ({ stack: [], dir: 0, tab: cur.tab }));
  }, []);
  const close = useCallback(() => {
    const r = release.current;
    release.current = null;
    closeNow();
    r?.();
  }, [closeNow]);
  const api = useMemo<SheetApi>(() => {
    const capture = () => {
      // the control under focus now is where focus goes back to; a sheet opened from a sheet keeps the first one's
      if (!isOpen.current) {
        opener.current = (document.activeElement as HTMLElement | null) ?? null;
        release.current = ctl.openOverlay(() => {
          release.current = null;
          closeNow();
        });
      }
      isOpen.current = true;
      // the whole panel renders in the scope of the tab active now
      return ctl.getState().active;
    };
    return {
      open: (s) => {
        const tab = capture();
        setState({ stack: [s], dir: 0, tab });
      },
      push: (s) => {
        const tab = capture();
        setState((cur) => ({ stack: [...cur.stack, s], dir: cur.stack.length ? 1 : 0, tab: cur.stack.length ? cur.tab : tab }));
      },
      pop: () => {
        if (state0.current.stack.length <= 1) return close();
        setState((cur) => (cur.stack.length <= 1 ? cur : { ...cur, stack: cur.stack.slice(0, -1), dir: -1 }));
      },
      close,
      update: (p) => setState((cur) => (cur.stack.length ? { ...cur, stack: [...cur.stack.slice(0, -1), { ...cur.stack[cur.stack.length - 1]!, ...p }] } : cur)),
      isOpen: () => isOpen.current,
    };
  }, [close, closeNow, ctl]);
  const state0 = useRef(state);
  state0.current = state;
  useEffect(() => setSheetOpen(state.stack.length > 0), [state.stack.length]);
  const open = state.stack.length > 0;
  const top = state.stack[state.stack.length - 1];
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('.cm-layer') && close();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);
  return (
    <Ctx.Provider value={api}>
      {children}
      {createPortal(
        <AnimatePresence>
          {open && top ? (
            <motion.div className="sheet-wrap">
              <motion.div
                className="sheet-scrim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: fadeOut }}
                transition={fadeIn}
                onClick={() => !top.sticky && close()}
              />
              <TabScope tab={state.tab}>
                <Panel stack={state.stack} dir={state.dir} close={close} pop={api.pop} opener={opener} />
              </TabScope>
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </Ctx.Provider>
  );
};
