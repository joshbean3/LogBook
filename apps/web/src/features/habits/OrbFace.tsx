import { motion, type MotionValue } from 'motion/react';
import type * as React from 'react';
import { initialOf } from './initial';
import './habits.css';

export interface OrbFaceProps {
  name: string;
  /** Done on the day shown: the ring fills and the check is drawn. */
  on: boolean;
  /** The day carries a note: the small dot on the ring. */
  note?: boolean;
  /** This week, Mon to Sun: 'd' done, 'o' open (not done), '-' ahead of today or before the habit began. */
  week: string;
  /** Which of the seven is the day shown (its dot follows `on`). */
  dayIdx: number;
  /** The ring's scale (the pop on a tap). Default: at rest. */
  pop?: MotionValue<number>;
  /** Reduce Motion: the check is drawn at once. */
  reduce?: boolean;
}

/**
 * What a habit tile shows, apart from what a tap does: the ring with the habit's initial (or its check once done), the
 * name, and the week's seven dots. Today's tile (OrbRow's `Orb`) wraps it in its button; first run draws the same face
 * for the habits picked there. Put it inside an element with the class `orb` (and `on` when done) in an `orbs is-grid`.
 */
export const OrbFace = ({ name, on, note = false, week, dayIdx, pop, reduce = false }: OrbFaceProps): React.JSX.Element => {
  const mark = initialOf(name);
  return (
    <>
      <motion.span className="orb-ring" style={pop ? { scale: pop } : undefined}>
        <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <motion.path d="M20 6 9 17l-5-5" initial={false} animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }} transition={reduce ? { duration: 0 } : on ? { pathLength: { duration: 0.16, ease: 'easeOut' }, opacity: { duration: 0.01 } } : { duration: 0.1 }} />
        </svg>
        {!on ? <span className={`orb-initial is-${mark.kind}`}>{mark.text}</span> : null}
        {note ? <i className="orb-note" aria-hidden="true" /> : null}
      </motion.span>
      <span className="orb-text">
        <span className="orb-name">{name}</span>
        <span className="orb-week" aria-hidden="true">
          {Array.from(week, (c, i) => {
            const v = i === dayIdx ? (on ? 'd' : 'o') : c;
            return <i key={i} className={`${v === 'd' ? 'is-d' : v === 'o' ? 'is-o' : ''} ${i === dayIdx ? 'is-day' : ''}`} />;
          })}
        </span>
      </span>
    </>
  );
};
