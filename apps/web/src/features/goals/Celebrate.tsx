import type { Aim, GoalLevel } from '@logbook/shared';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useReduced } from '@/lib/motion';
import './goals.css';

const EVENT = 'logbook:celebrate';
const LINE: Record<GoalLevel, string> = { day: 'You did what you said you would today.', week: 'A whole week, kept.', month: 'A month of it, done.', year: 'The year’s goal. Done.' };
const SHAPE: Record<GoalLevel, string> = { day: 'sun', week: 'mint', month: 'coral', year: 'sky' };

// one moment per finish, however many places show the goal
let shown = '';

/** Ask for the moment: a goal has just been finished here (open → done). */
export const useCelebrate = () => (goal: Aim) => {
  const key = `${goal.id}:${goal.updatedAt}`;
  if (shown === key) return;
  shown = key;
  window.dispatchEvent(new CustomEvent<Aim>(EVENT, { detail: goal }));
};

/**
 * The moment a goal is hit: the page goes dark, the level's shape (the day's sun, the week's mint, the month's coral, the
 * year's sky) springs up out of nothing and settles, then the words in the serif and the one white pill to carry on. A tap
 * anywhere closes it; it closes by itself after a while. Reduced motion: it simply appears.
 */
export const CelebrateLayer = () => {
  const [goal, setGoal] = useState<Aim | null>(null);
  const reduce = useReduced();
  useEffect(() => {
    const on = (e: Event) => setGoal((e as CustomEvent<Aim>).detail);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  useEffect(() => {
    if (!goal) return;
    const t = setTimeout(() => setGoal(null), 6000);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setGoal(null);
    window.addEventListener('keydown', key);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', key);
    };
  }, [goal]);
  return createPortal(
    <AnimatePresence>
      {goal ? (
        <motion.div key={goal.id} className="cel" role="dialog" aria-modal="true" aria-label="Goal done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.25 }} onClick={() => setGoal(null)}>
          <div className="cel-stage">
            <motion.span className={`cel-shape is-${SHAPE[goal.level]}`} initial={reduce ? false : { scale: 0.05, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', duration: 0.9, bounce: 0.45, delay: 0.05 }} />
            {reduce
              ? null
              : [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
                  const a = (i / 8) * Math.PI * 2;
                  return <motion.i key={i} className={`cel-dot is-${['sun', 'mint', 'coral', 'sky'][i % 4]}`} initial={{ x: 0, y: 0, scale: 0, opacity: 0 }} animate={{ x: Math.cos(a) * 150, y: Math.sin(a) * 150, scale: [0, 1.2, 0.8], opacity: [0, 1, 0] }} transition={{ duration: 1.1, delay: 0.25, ease: [0.22, 1, 0.36, 1] }} />;
                })}
          </div>
          <motion.div className="cel-words" initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduce ? 0 : 0.45, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
            <h2 className="cel-title">
              Goal <em className={`is-${SHAPE[goal.level]}`}>done</em>
            </h2>
            <p className="cel-line">{LINE[goal.level]}</p>
            <p className="cel-goal">{goal.text}</p>
            <button type="button" className="btn primary cel-btn" onClick={() => setGoal(null)}>
              Keep going
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
};
