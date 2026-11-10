import { monthOf } from '@logbook/shared';
import { Dumbbell, Layers } from 'lucide-react';
import type { ReactNode } from 'react';
import { useLog } from '../log/useLog';
import { LiftLog } from '../sessions/LiftLog';
import './progress.css';
import './activity.css';

/** A tile of the pair: the label with its icon, the stamped number with its small unit. */
const Cell = ({ k, v, u, icon }: { k: string; v: string; u?: string; icon: ReactNode }) => (
  <span className="tile pa-cell" role="listitem">
    <span className="tile-label">
      {icon}
      <span>{k}</span>
    </span>
    <span className="tile-value">
      {v}
      {u ? <small>{u}</small> : null}
    </span>
  </span>
);

/**
 * A day's lifting with nothing on the plan ("Lifted"): two tiles, then the same set rows as a lift session's sheet, where a
 * set can be removed (with Undo) or added. The numbers follow the log, so a change shows at once.
 */
export const LiftDaySheet = ({ date }: { date: string }) => {
  const log = useLog([monthOf(date)]);
  const sets = log.snap.liftsOn(date);
  const volume = sets.reduce((t, s) => t + s.weight * s.reps, 0);
  return (
    <div className="pa-sheet">
      <div className="tiles pa-grid" role="list" aria-label="The numbers">
        <Cell k="Sets" v={String(sets.length)} icon={<Layers size={16} />} />
        {/* bodyweight sets move no counted weight: the exercises stand in for a volume of 0 */}
        {volume > 0 ? <Cell k="Volume" v={Math.round(volume).toLocaleString('en-US')} u="lb" icon={<Dumbbell size={16} />} /> : <Cell k="Exercises" v={String(new Set(sets.map((s) => s.exercise.trim().toLowerCase())).size)} icon={<Dumbbell size={16} />} />}
      </div>
      <LiftLog date={date} />
    </div>
  );
};
