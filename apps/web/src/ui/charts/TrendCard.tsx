import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Pressable } from '../Pressable';
import type { Series } from './scale';
import { Spark } from './Spark';
import { useChartWidth } from './useWidth';
import './charts.css';

export interface TrendCardProps {
  label: string;
  icon?: ReactNode;
  /** The number, already formatted; null draws "–" in the same place. */
  value: string | null;
  unit?: string;
  /** The word under the number ("Usual", "Above usual", "Comes with Apple Health"). */
  status: string;
  spark: Series;
  invert?: boolean;
  /** The sparkline's floor is zero (miles, a share): a small wobble stays small. */
  zero?: boolean;
  onPress?: () => void;
  /** Words for VoiceOver; defaults to label, value and status. */
  aria?: string;
  /** Quiet styling for a card waiting on data it does not have yet. */
  waiting?: boolean;
}

/**
 * A trend card: the label (and its icon), a big stamped number with its unit, a status word, and a sparkline that ends in
 * a glowing dot. With no data it keeps the very same shell: "–", the word saying why, a dashed line.
 */
export const TrendCard = ({ label, icon, value, unit, status, spark, invert, zero, onPress, aria, waiting }: TrendCardProps) => {
  const [ref, width] = useChartWidth<HTMLSpanElement>();
  const body = (
    <>
      <span className="ck-tcard-head">
        {icon ? <span className="ck-tcard-icon">{icon}</span> : null}
        <span className="ck-tcard-label">{label}</span>
        {onPress ? <ChevronRight size={15} className="ck-tcard-chev" aria-hidden="true" /> : null}
      </span>
      <span className={`ck-tcard-num stamp ${value == null ? 'is-empty' : ''}`}>
        {value ?? '–'}
        {value != null && unit ? <small>{unit}</small> : null}
      </span>
      <span className="ck-tcard-status">{status}</span>
      <span ref={ref} className="ck-tcard-spark">
        <Spark values={spark} w={Math.max(60, width || 120)} h={28} invert={invert} zero={zero} />
      </span>
    </>
  );
  const words = aria ?? `${label}: ${value != null ? `${value}${unit ? ` ${unit}` : ''}, ` : ''}${status}`;
  return onPress ? (
    <Pressable className={`ck-tcard ${waiting ? 'is-waiting' : ''}`} press="scale" onPress={onPress} label={`${words}. Open`}>
      {body}
    </Pressable>
  ) : (
    <div className={`ck-tcard ${waiting ? 'is-waiting' : ''}`} role="group" aria-label={words}>
      {body}
    </div>
  );
};
