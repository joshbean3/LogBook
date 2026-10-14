import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { fadeOut, reducedFade, springs } from '@/lib/motion';

interface ToastSpec {
  id: number;
  text: string;
  action?: { label: string; fn: () => void };
}
type ToastFn = (text: string, action?: ToastSpec['action']) => void;
const Ctx = createContext<ToastFn>(() => {});
/** `const toast = useToast(); toast('Deleted', { label: 'Undo', fn: restore })`. */
export const useToast = () => useContext(Ctx);

/**
 * One line of feedback at a time, with an optional action (Undo). The pill is as wide as its words (never wider than the
 * screen less 32px) and sits above the tab bar; the action is a 44px target. 2.8s on screen, 6.5s with an action. It
 * springs in on `springs.settle`; reduced motion: a fade. Announced politely (role="status").
 */
export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const reduce = useReducedMotion();
  const [t, setT] = useState<ToastSpec | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback<ToastFn>((text, action) => {
    clearTimeout(timer.current);
    setT({ id: Date.now(), text, action });
    timer.current = setTimeout(() => setT(null), action ? 6500 : 2800);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const value = useMemo(() => show, [show]);
  return (
    <Ctx.Provider value={value}>
      {children}
      {createPortal(
        <div className="toast-host" aria-live="polite">
          <AnimatePresence>
            {t ? (
              <motion.div
                key={t.id}
                className="toast"
                role="status"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduce ? { opacity: 0, transition: fadeOut } : { opacity: 0, y: 8, scale: 0.98, transition: fadeOut }}
                transition={reduce ? reducedFade : springs.settle}
              >
                <span className="toast-text">{t.text}</span>
                {t.action ? (
                  <button
                    type="button"
                    className="toast-act"
                    onClick={() => {
                      t.action?.fn();
                      setT(null);
                    }}
                  >
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
