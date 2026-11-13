import { Check } from 'lucide-react';
import type * as React from 'react';
import { DAY_LETTERS, weekSaid } from './model';

/**
 * This week, Monday first: seven 12 pt marks over their letters. A day that counts is a Deep Sky disc with a check; any
 * other day is an open ring (a day off, a miss and a paused day look the same, on purpose). Today's ring and letter are
 * Night Ink until today counts. One picture for VoiceOver, which names the days that count and says nothing of the rest.
 */
export const WeekMarks = ({ marks, today }: { marks: readonly boolean[]; today: number }): React.JSX.Element => (
  <div className="orp-week" role="img" aria-label={weekSaid({ marks: [...marks] })}>
    {DAY_LETTERS.map((letter, i) => (
      <span key={i} className={`orp-day${marks[i] ? ' is-on' : ''}${i === today ? ' is-today' : ''}`} aria-hidden="true">
        <span className="orp-mark">{marks[i] ? <Check size={9} strokeWidth={3} /> : null}</span>
        <span className="orp-letter">{letter}</span>
      </span>
    ))}
  </div>
);
