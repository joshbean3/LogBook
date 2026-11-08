import { ArrowRight, CircleArrowDown, CircleArrowUp, CircleCheck, Hourglass } from 'lucide-react';
import type { ReactNode } from 'react';
import { Pressable } from '../Pressable';
import type { Series } from './scale';
import { Spark } from './Spark';
import { useChartWidth } from './useWidth';
import './charts.css';

/** How the status word reads: on your usual (navy, a check), off it either way (orange words, an arrow), or not yet. */
export type TrendTone = 'ok' | 'up' | 'down' | 'none';
const TONE_ICON = { ok: CircleCheck, up: CircleArrowUp, down: CircleArrowDown, none: Hourglass } as const;

export interface TrendCardProps {
  label: string;
  icon?: ReactNode;
  /** The number, already formatted; null draws "–" in the same place. */
  value: string | null;
  unit?: string;
  /** The word under the number ("Usual", "Above usual", "Comes with Apple Health"). */
  status: string;
  /** How the status reads; default 'none' (grey, no judgement). */
  tone?: TrendTone;
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
 * A trend tile (docs/shape-system.md §3, a tile in a 2-column grid): the label with its icon and an arrow when it opens a
 * page, the big stamped number with its small grey unit, the status word with its icon, and a sparkline with a soft fill that
 * ends in a glowing dot. With no data it keeps the very same shell: "–", the word saying why, a dashed line.
 */
export const TrendCard = ({ label, icon, value, unit, status, tone = 'none', spark, invert, zero, onPress, aria, waiting }: TrendCardProps) => {
  const [ref, width] = useChartWidth<HTMLSpanElement>();
  const Icon = TONE_ICON[tone];
  const body = (
    <>
      <span className="tile-label ck-tcard-head">
        {icon}
        <span className="ck-tcard-label">{label}</span>
        {onPress ? <ArrowRight size={16} className="ck-tcard-go" aria-hidden="true" /> : null}
      </span>
      <span className={`tile-value ck-tcard-num ${value == null ? 'is-empty' : ''}`}>
        {value ?? '–'}
        {value != null && unit ? <small>{unit}</small> : null}
      </span>
      <span className={`tile-status ck-tcard-status ${tone === 'up' || tone === 'down' ? 'is-hi' : tone === 'none' ? 'is-none' : ''}`}>
        <Icon size={15} strokeWidth={2.2} aria-hidden="true" />
        <span>{status}</span>
      </span>
      <span ref={ref} className="ck-tcard-spark">
        <Spark values={spark} w={Math.max(60, width || 120)} h={30} invert={invert} zero={zero} area />
      </span>
    </>
  );
  const words = aria ?? `${label}: ${value != null ? `${value}${unit ? ` ${unit}` : ''}, ` : ''}${status}`;
  return onPress ? (
    <Pressable className={`tile ck-tcard ${waiting ? 'is-waiting' : ''}`} press="scale" onPress={onPress} label={`${words}. Open`}>
      {body}
    </Pressable>
  ) : (
    <div className={`tile ck-tcard ${waiting ? 'is-waiting' : ''}`} role="group" aria-label={words}>
      {body}
    </div>
  );
};

/**
 * The slim vertical range pill at a vital tile's right (the references' Health Monitor): a pale track, your usual stretch
 * shaded on it, and a ringed dot where today sits. `pos` and `band` are 0..1 up the track; with no reading it is the track
 * alone, so an empty tile keeps its shape.
 */
export const RangePill = ({ pos, band }: { pos: number | null; band?: [number, number] | null }) => {
  const at = (v: number) => `${(1 - Math.max(0, Math.min(1, v))) * 100}%`;
  return (
    <span className={`ck-rpill ${pos == null ? 'is-empty' : ''}`} aria-hidden="true">
      {band ? <i className="ck-rpill-band" style={{ top: at(band[1]), bottom: `${Math.max(0, Math.min(1, band[0])) * 100}%` }} /> : null}
      {pos != null ? <b className="ck-rpill-dot" style={{ top: at(pos) }} /> : null}
    </span>
  );
};
