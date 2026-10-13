import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'motion/react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
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
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 90 || info.velocity.y > 600) close();
  };
  return (
    <Ctx.Provider value={api}>
      {children}
      {createPortal(
        <AnimatePresence>
          {spec ? (
            <div className="sheet-wrap">
              <motion.div className="sheet-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={() => !spec.sticky && close()} />
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="sheet-title"
                className={`sheet ${spec.wide ? 'wide' : ''}`}
                initial={reduce ? { opacity: 0 } : { y: '100%', opacity: 1 }}
                animate={reduce ? { opacity: 1 } : { y: 0 }}
                exit={reduce ? { opacity: 0 } : { y: '100%', transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
                transition={{ type: 'spring', stiffness: 380, damping: 36 }}
                drag={reduce ? false : 'y'}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.6 }}
                onDragEnd={onDragEnd}
              >
                <div className="sheet-grip" aria-hidden="true" />
                <div className="sheet-head">
                  <h2 className="sheet-title" id="sheet-title">{spec.title}</h2>
                  <CloseButton onClick={close} />
                </div>
                <div className="sheet-body stack" style={{ gap: 14 }}>
                  {spec.body}
                </div>
              </motion.div>
            </div>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </Ctx.Provider>
  );
};
