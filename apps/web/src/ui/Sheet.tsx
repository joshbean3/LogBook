import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'motion/react';
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CloseButton } from './primitives';

/** One bottom sheet at a time, opened from anywhere. Drag down to dismiss on a phone. */
interface SheetSpec {
  title: ReactNode;
  body: ReactNode;
  wide?: boolean;
  sticky?: boolean;
}
interface SheetApi {
  open: (spec: SheetSpec) => void;
  close: () => void;
  update: (spec: Partial<SheetSpec>) => void;
}
const Ctx = createContext<SheetApi | null>(null);
export const useSheet = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSheet outside SheetProvider');
  return c;
};

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
/* how many panels hold the app inert; the attribute comes off when the last one goes */
let inertHolders = 0;
const focusables = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.closest('[aria-hidden="true"]') && el.offsetParent !== null);

/** The dialog's chrome: the title is what the dialog is called, focus stays inside while it is up and goes back where it came from on close. */
const Panel = ({ spec, close, children }: { spec: SheetSpec; close: () => void; children: ReactNode }) => {
  const reduce = useReducedMotion();
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const panel = ref.current;
    if (!panel) return;
    const opener = document.activeElement as HTMLElement | null;
    // the rest of the app is off limits to focus and to the screen reader while the sheet is up
    const root = document.getElementById('root');
    inertHolders++;
    root?.setAttribute('inert', '');
    const first = focusables(panel).find((el) => !el.classList.contains('icon-btn')) ?? focusables(panel)[0] ?? panel;
    const timer = setTimeout(() => {
      // an autoFocus field inside the body wins; otherwise the first control, never the Close
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
      inertHolders = Math.max(0, inertHolders - 1);
      if (!inertHolders) root?.removeAttribute('inert');
      // back to the control that opened the sheet, if it is still on the page
      if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus({ preventScroll: true });
    };
  }, []);
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 90 || info.velocity.y > 600) close();
  };
  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      tabIndex={-1}
      className={`sheet ${spec.wide ? 'wide' : ''}`}
      initial={reduce ? { opacity: 0 } : { y: '100%', opacity: 1 }}
      animate={reduce ? { opacity: 1 } : { y: 0 }}
      exit={reduce ? { opacity: 0, transition: { duration: 0.08 } } : { y: '100%', transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
      transition={reduce ? { duration: 0.08 } : { type: 'spring', stiffness: 380, damping: 36 }}
      drag={reduce ? false : 'y'}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.6 }}
      onDragEnd={onDragEnd}
    >
      <div className="sheet-grip" aria-hidden="true" />
      <div className="sheet-head">
        <h2 className="sheet-title" id={`${id}-title`}>
          {spec.title}
        </h2>
        <CloseButton onClick={close} />
      </div>
      {children}
    </motion.div>
  );
};

export const SheetProvider = ({ children }: { children: ReactNode }) => {
  const [spec, setSpec] = useState<SheetSpec | null>(null);
  const reduce = useReducedMotion();
  const close = useCallback(() => setSpec(null), []);
  const api = useMemo<SheetApi>(() => ({ open: (s) => setSpec(s), close, update: (p) => setSpec((s) => (s ? { ...s, ...p } : s)) }), [close]);
  useEffect(() => {
    if (!spec) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [spec, close]);
  return (
    <Ctx.Provider value={api}>
      {children}
      {createPortal(
        <AnimatePresence>
          {spec ? (
            <div className="sheet-wrap">
              <motion.div className="sheet-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0.08 : 0.2 }} onClick={() => !spec.sticky && close()} />
              <Panel spec={spec} close={close}>
                <div className="sheet-body stack" style={{ gap: 14 }}>
                  {spec.body}
                </div>
              </Panel>
            </div>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </Ctx.Provider>
  );
};
