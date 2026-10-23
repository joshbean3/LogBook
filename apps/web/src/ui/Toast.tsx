import { animate, AnimatePresence, motion, useMotionValue } from 'motion/react';
import type * as React from 'react';
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavInternal, useTabOrNull } from '@/app/NavController';
import { LOCK_PX, TOAST_DISMISS_V } from '@/lib/gesture';
import { fadeIn, fadeOut, springs } from '@/lib/motion';
import type { TabId } from './nav';
import { safeTopPx, useSheetMotion } from './sheetMotion';
import { createToastStore, type ToastAction } from './toastStore';

type ToastFn = (text: string, action?: ToastAction) => void;
type ScopedFn = (tab: TabId | null, text: string, action?: ToastAction) => void;
const Ctx = createContext<ScopedFn>(() => {});
/**
 * `const toast = useToast(); toast('Deleted', { label: 'Undo', fn: restore })`. Scoped to the caller's tab (a sheet body has
 * the tab that opened the sheet): switching tabs dismisses it. Only Undo and errors raise toasts (§8).
 */
export const useToast = (): ToastFn => {
  const show = useContext(Ctx);
  const tab = useTabOrNull();
  return useMemo<ToastFn>(() => (text, action) => show(tab, text, action), [show, tab]);
};

/** Room kept between a toast and the top of an open sheet, and from the top of the screen. */
const GAP = 12;
const px = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * One line of feedback at a time, with an optional action (Undo) (docs/feel.md §8, contracts §C.7). 4 s plain, 6 s with
 * an action (`TOAST_MS` / `TOAST_UNDO_MS`), the action's own `duration` when it asks. Scoped to the tab that raised it: a
 * tab change dismisses it with `fadeOut`. It sits above the tab bar, above This morning's Leave row (`--toast-lift` on the
 * pushed page), or, while a sheet is up, just above the sheet's top edge, following `sheetY` from the module store as the
 * sheet rises, is dragged or falls (pinned under the status bar when a tall sheet leaves no room); the placement is a
 * transform, no per-frame query. Fades in 120 ms, out 100 ms; a swipe away (≥ 110 px/s) dismisses it. role="status".
 */
export const ToastProvider = ({ children }: { children: ReactNode }): React.JSX.Element => {
  const store = useMemo(() => createToastStore(), []);
  const t = useSyncExternalStore(store.subscribe, store.get, store.get);
  useEffect(() => () => store.dismiss(), [store]);
  const scope = useRef(new Map<number, TabId | null>());
  const value = useMemo<ScopedFn>(() => (tab, text, action) => void scope.current.set(store.show(text, action), tab), [store]);
  // a tab change dismisses a toast raised on another tab
  const ctl = useNavInternal();
  useEffect(
    () =>
      ctl.subscribe(() => {
        const cur = store.get();
        const tab = cur ? scope.current.get(cur.id) : null;
        if (cur && tab && tab !== ctl.getState().active) store.dismiss(cur.id);
      }),
    [ctl, store],
  );

  // ---------- placement: a transform on the host, from the sheet's motion store ----------
  const host = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLDivElement>(null);
  const hostY = useMotionValue(0);
  const { sheetY, height, open: sheetUp } = useSheetMotion();
  const top = useRef(false);
  useLayoutEffect(() => {
    if (!t) return;
    const el = host.current;
    if (!el) return;
    // This morning's Leave row asks for room (--toast-lift on the top pushed page of the active tab), read once per toast
    const layers = document.querySelectorAll<HTMLElement>('.tab[data-active] .pushed');
    const lift = layers.length ? px(getComputedStyle(layers[layers.length - 1]!).getPropertyValue('--toast-lift')) : 0;
    const place = () => {
      const restBottom = el.offsetTop + el.offsetHeight;
      const h = pill.current?.offsetHeight ?? 44;
      top.current = false;
      if (!sheetUp) return hostY.set(-lift);
      const H = window.innerHeight;
      const kb = px(getComputedStyle(document.documentElement).getPropertyValue('--kb'));
      const sheetTop = H - kb - height.get() + sheetY.get();
      if (sheetTop >= restBottom + GAP) return hostY.set(-lift);
      if (sheetTop - GAP - h >= safeTopPx() + GAP) return hostY.set(sheetTop - GAP - restBottom);
      // a tall sheet: pinned under the status bar
      top.current = true;
      hostY.set(safeTopPx() + GAP + h - restBottom);
    };
    place();
    const offs = [sheetY.on('change', place), height.on('change', place)];
    return () => offs.forEach((f) => f());
  }, [t, sheetUp, sheetY, height, hostY]);

  // ---------- swipe to dismiss ----------
  const dx = useMotionValue(0);
  const dy = useMotionValue(0);
  const gone = useMotionValue(1);
  useLayoutEffect(() => {
    dx.jump(0);
    dy.jump(0);
    gone.jump(1);
  }, [t?.id, dx, dy, gone]);
  const drag = useRef({ id: -1, x0: 0, y0: 0, locked: false });
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary || (e.target as Element).closest('.toast-act')) return;
    drag.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, locked: false };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* gone */
    }
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (e.pointerId !== d.id) return;
    const mx = e.clientX - d.x0;
    const my = e.clientY - d.y0;
    if (!d.locked && Math.hypot(mx, my) < LOCK_PX / 2) return;
    d.locked = true;
    dx.set(mx);
    // toward the screen edge it sits on: 1:1; toward the middle, resisted
    const away = top.current ? my < 0 : my > 0;
    dy.set(away ? my : my * 0.2);
  };
  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (e.pointerId !== d.id || !t) return;
    d.id = -1;
    if (!d.locked) return;
    const vx = dx.getVelocity();
    const vy = dy.getVelocity();
    const awayV = top.current ? -vy : vy;
    const id = t.id;
    if (awayV > TOAST_DISMISS_V || (Math.abs(vx) > TOAST_DISMISS_V && Math.abs(dx.get()) > LOCK_PX)) {
      // away with its own velocity, fading as it goes
      if (Math.abs(vx) > awayV) void animate(dx, Math.sign(vx) * window.innerWidth, { ...springs.settle, velocity: vx });
      else void animate(dy, (top.current ? -1 : 1) * 120, { ...springs.settle, velocity: vy });
      void animate(gone, 0, { ...fadeOut, onComplete: () => store.dismiss(id) });
      return;
    }
    void animate(dx, 0, { ...springs.settle, velocity: vx });
    void animate(dy, 0, { ...springs.settle, velocity: vy });
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      {createPortal(
        <motion.div ref={host} className="toast-host" aria-live="polite" style={{ y: hostY }}>
          <AnimatePresence>
            {t ? (
              <motion.div key={t.id} className="toast-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: fadeOut }} transition={fadeIn}>
                <motion.div
                  ref={pill}
                  className="toast"
                  role="status"
                  style={{ x: dx, y: dy, opacity: gone }}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerEnd}
                  onPointerCancel={onPointerEnd}
                >
                  <span className="toast-text">{t.text}</span>
                  {t.action ? (
                    <button type="button" className="toast-act" onClick={() => store.act(t.id)}>
                      {t.action.label}
                    </button>
                  ) : null}
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>,
        document.body,
      )}
    </Ctx.Provider>
  );
};
