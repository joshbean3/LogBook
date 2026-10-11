import { AnimatePresence, motion } from 'motion/react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ToastSpec {
  id: number;
  text: string;
  action?: { label: string; fn: () => void };
}
type ToastFn = (text: string, action?: ToastSpec['action']) => void;
const Ctx = createContext<ToastFn>(() => {});
export const useToast = () => useContext(Ctx);

/** One line of feedback at a time, with an optional undo. */
export const ToastProvider = ({ children }: { children: ReactNode }) => {
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
        <AnimatePresence>
          {t ? (
            <motion.div key={t.id} className="toast" role="status" initial={{ opacity: 0, y: 12, x: '-50%', scale: 0.96 }} animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }} exit={{ opacity: 0, y: 8, x: '-50%', scale: 0.98 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}>
              <span>{t.text}</span>
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
        </AnimatePresence>,
        document.body,
      )}
    </Ctx.Provider>
  );
};
