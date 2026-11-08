import { ChevronLeft, ChevronRight } from 'lucide-react';
import { RANGE_KEYS, RANGE_NAMES, type RangeKey } from './range';
import './charts.css';

/**
 * `< 1M 3M 6M 1Y >`: the span in the middle, the arrows step one span back or forward. Forward stops at today; back stops
 * where the data does. The period it shows is said under it by the caller (it knows the dates).
 */
export const RangeControl = ({ value, onChange, onPrev, onNext, canPrev = true, canNext = false, keys = RANGE_KEYS }: { value: RangeKey; onChange: (k: RangeKey) => void; onPrev?: () => void; onNext?: () => void; canPrev?: boolean; canNext?: boolean; keys?: readonly RangeKey[] }) => (
  <div className="ck-range" role="group" aria-label="Range">
    <button type="button" className="ck-range-step" aria-label={`Earlier ${RANGE_NAMES[value]}`} disabled={!onPrev || !canPrev} onClick={onPrev}>
      <ChevronLeft size={18} aria-hidden="true" />
    </button>
    <div className="ck-range-keys" role="radiogroup" aria-label="Span">
      {keys.map((k) => (
        <button key={k} type="button" role="radio" aria-checked={k === value} aria-label={RANGE_NAMES[k]} className={`ck-range-key ${k === value ? 'on' : ''}`} onClick={() => k !== value && onChange(k)}>
          {k}
        </button>
      ))}
    </div>
    <button type="button" className="ck-range-step" aria-label={`Later ${RANGE_NAMES[value]}`} disabled={!onNext || !canNext} onClick={onNext}>
      <ChevronRight size={18} aria-hidden="true" />
    </button>
  </div>
);
