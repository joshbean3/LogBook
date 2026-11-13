import type { Aim, GoalLevel } from '@logbook/shared';
import { Check } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { getOrbs, getSwitches } from '@/features/orbs/store';
import { useReduced } from '@/lib/motion';
import { restoreFocus } from '@/ui/focus';
import { holdInert } from '@/ui/inert';
import './goals.css';

const EVENT = 'logbook:celebrate';
const LINE: Record<Exclude<GoalLevel, 'day'>, string> = { week: 'A whole week, done.', month: 'A month of it, done.', year: 'The year’s goal. Done.' };

// one moment per finish, however many places show the goal
let shown = '';

/** How long the Orbs' reconciler is given to count a goal before this page decides the goal earned nothing. */
export const CELEBRATE_WAIT_MS = 700;

/**
 * Ask for the full-screen moment: a week, month or year goal has just been finished here (open → done).
 *
 * Today's goal never opens it: it gets three Orbs at its control and the small burst (features/orbs/moment). And when
 * Orbs are shown and the goal earned its Orbs, the moment is the Orbs' to show (a big moment, at rest: after the Close
 * card's save or on the next open, never from the tap), so nothing opens here either. What is left is a goal that earned
 * nothing (set too late, reviewed out of its period, before Orbs began) or an account with Orbs switched off or not
 * shown: its page opens as before.
 */
export const useCelebrate = () => (goal: Aim) => {
  if (goal.level === 'day') return;
  const key = `${goal.id}:${goal.updatedAt}`;
  if (shown === key) return;
  shown = key;
  const open = () => window.dispatchEvent(new CustomEvent<Aim>(EVENT, { detail: goal }));
  const sw = getSwitches();
  if (!sw.on || !sw.show) return open();
  // the reconciler pays a goal on the frame after it turns done: paid, the moment is the Orbs'
  setTimeout(() => {
    if (!getOrbs()?.once[`goal:${goal.level}:${goal.period}`]) open();
  }, CELEBRATE_WAIT_MS);
};

export interface MomentPageProps {
  /** What the dialog is called: "Goal done", "4 weeks in a row". */
  label: string;
  /** In the lit disc: a numeral, or nothing for the check. */
  disc?: string;
  title: ReactNode;
  line: string;
  /** Between the line and the card: what it paid, a chapter's facts. */
  children?: ReactNode;
  /** The person's own words, in the Paper card. */
  quote?: string;
  onClose: () => void;
}

/**
 * A full-screen moment: an opaque page over the app (nothing shows through), focus on "Keep going" while it is up (the
 * app behind is inert) and back where it was after. The lit disc (a flat Sky disc in its rings, with a Night Ink check or
 * numeral) springs up out of nothing and settles, then the words and the one Sky primary. It stays until "Keep going"
 * (or Escape): it never closes by itself. Reduced motion: it simply appears.
 */
export const MomentPage = ({ label, disc, title, line, children, quote, onClose }: MomentPageProps) => {
  const reduce = useReduced();
  const btn = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    // what had focus when the moment came, to hand it back
    const back = document.activeElement;
    const release = holdInert();
    btn.current?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
    };
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('keydown', key);
      release();
      if (back instanceof HTMLElement && back.isConnected) restoreFocus(back);
    };
  }, []);
  return (
    <motion.div className="cel" role="dialog" aria-modal="true" aria-label={label} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.25 }}>
      <div className="cel-stage">
        <motion.span className="cel-shape" initial={reduce ? false : { scale: 0.05, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', duration: 0.9, bounce: 0.45, delay: 0.05 }}>
          {disc ? <span className={`cel-num${disc.length > 3 ? ' is-long' : ''}`}>{disc}</span> : <Check className="cel-check" aria-hidden="true" />}
        </motion.span>
      </div>
      <motion.div className="cel-words" initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduce ? 0 : 0.45, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
        <h2 className="cel-title">{title}</h2>
        <p className="cel-line">{line}</p>
        {children}
        {quote ? <p className="cel-goal">{quote}</p> : <span className="cel-gap" aria-hidden="true" />}
        <button ref={btn} type="button" className="btn primary cel-btn" onClick={onClose}>
          Keep going
        </button>
      </motion.div>
    </motion.div>
  );
};

/** "Goal done", with "done" in Deep Sky. */
export const GoalDoneTitle = () => (
  <>
    Goal <em>done</em>
  </>
);

/** The page for a week, month or year goal finished where Orbs do not show it (see `useCelebrate`). Mounted once, in the shell. */
export const CelebrateLayer = () => {
  const [goal, setGoal] = useState<Aim | null>(null);
  useEffect(() => {
    const on = (e: Event) => setGoal((e as CustomEvent<Aim>).detail);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return createPortal(
    <AnimatePresence>{goal && goal.level !== 'day' ? <MomentPage key={goal.id} label="Goal done" title={<GoalDoneTitle />} line={LINE[goal.level]} quote={goal.text} onClose={() => setGoal(null)} /> : null}</AnimatePresence>,
    document.body,
  );
};
