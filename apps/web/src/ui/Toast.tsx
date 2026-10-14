import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { fadeOut, reducedFade, springs } from '@/lib/motion';
import { createToastStore, type ToastAction } from './toastStore';

type ToastFn = (text: string, action?: ToastAction) => void;
const Ctx = createContext<ToastFn>(() => {});
/** `const toast = useToast(); toast('Deleted', { label: 'Undo', fn: restore })`. */
export const useToast = () => useContext(Ctx);

/** Room kept between a toast and the top of an open sheet, and from the top of the screen. */
const GAP = 12;

/**
 * Where the toast goes while a sheet is up (D-F3): just above the sheet's top edge, over the dimmed page, so it never
 * covers the sheet's actions; when a tall sheet leaves no room above it, pinned to the top of the screen. Null: the usual
 * place above the tab bar. Follows the sheet as it rises, is dragged or falls.
 */
type Place = { bottom: number } | { top: string; bottom: 'auto' };
/** The top safe-area inset in px (custom properties are not resolved by getComputedStyle, so measure one). */
let safeProbe: HTMLDivElement | null = null;
const safeTop = () => {
  if (!safeProbe) {
    safeProbe = document.createElement('div');
    safeProbe.setAttribute('aria-hidden', 'true');
    safeProbe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:var(--safe-t);visibility:hidden;pointer-events:none';
    document.body.appendChild(safeProbe);
  }
  return safeProbe.offsetHeight;
};
const useSheetAwarePlace = (active: boolean, toast: React.RefObject<HTMLDivElement | null>) => {
  const [place, setPlace] = useState<Place | null>(null);
  useEffect(() => {
    if (!active) {
      setPlace(null);
      return;
    }
    let raf = 0;
    let last = '';
    const tick = () => {
      const sheet = document.querySelector<HTMLElement>('.sheet-wrap .sheet');
      let next: Place | null = null;
      if (sheet) {
        const r = sheet.getBoundingClientRect();
        const vh = window.innerHeight;
        const h = toast.current?.offsetHeight ?? 44;
        if (r.top < vh - h) next = r.top - GAP - h >= safeTop() + GAP ? { bottom: Math.round(vh - r.top + GAP) } : { top: `calc(var(--safe-t) + ${GAP}px)`, bottom: 'auto' };
      }
      const key = JSON.stringify(next);
      if (key !== last) {
        last = key;
        setPlace(next);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [active, toast]);
  return place;
};

/**
 * One line of feedback at a time, with an optional action (Undo). The pill is as wide as its words (never wider than the
 * screen less 32px) and sits above the tab bar, or above an open sheet; the action is a 44px target and the only part
 * that takes a tap (the words let taps through to whatever is under them). 2.8s on screen, 6.5s with an action. Acting
 * clears only that toast, so an action that shows a follow-up toast keeps it. It springs in on `springs.settle`; reduced
 * motion: a fade. Announced politely (role="status").
 */
export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const reduce = useReducedMotion();
  const store = useMemo(() => createToastStore(), []);
  const t = useSyncExternalStore(store.subscribe, store.get, store.get);
  useEffect(() => () => store.dismiss(), [store]);
  const value = useMemo<ToastFn>(() => (text, action) => void store.show(text, action), [store]);
  const pill = useRef<HTMLDivElement>(null);
  const place = useSheetAwarePlace(!!t, pill);
  return (
    <Ctx.Provider value={value}>
      {children}
      {createPortal(
        <div className={`toast-host${place ? ' over-sheet' : ''}`} aria-live="polite" style={place ?? undefined}>
          <AnimatePresence>
            {t ? (
              <motion.div
                key={t.id}
                ref={pill}
                className="toast"
                role="status"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduce ? { opacity: 0, transition: fadeOut } : { opacity: 0, y: 8, scale: 0.98, transition: fadeOut }}
                transition={reduce ? reducedFade : springs.settle}
              >
                <span className="toast-text">{t.text}</span>
                {t.action ? (
                  <button type="button" className="toast-act" onClick={() => store.act(t.id)}>
                    {t.action.label}
                  </button>
                ) : null}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </Ctx.Provider>
  );
};
