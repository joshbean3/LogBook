import { ChevronRight, Plus } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { Pressable } from '@/ui/Pressable';
import './poster.css';

export interface FarHill {
  /** The hill's name, in caps: "2026 · 50 days left", "November". */
  caption: ReactNode;
  /** The goal written on the hill, or the invitation ("Set this week’s goal"). Without it the hill shows only its name. */
  words?: ReactNode;
  /** A value at the end: "2 of 5". */
  value?: ReactNode;
  /** The hill carries the plus: the one invitation (the nearest hill with no goal). */
  plus?: boolean;
  onPress?: () => void;
  /** The hill button's VoiceOver label. Default: its words. */
  label?: string;
}

export interface FarHillsProps {
  /** The caption on the sky. Default "Further out". */
  title?: ReactNode;
  /** Three hills, far to near (top to bottom): the year, the month, the week. */
  hills: readonly [FarHill, FarHill, FarHill];
  /** The card's accessible name. Default "Further out". */
  label?: string;
  className?: string;
}

// each hill's crest, drawn over the hill above it (the far one over the sky), stretched to the card's width
const CRESTS = [
  { box: '0 42 358 20', d: 'M0 58 C 60 46 130 42 200 50 C 260 57 310 54 358 44 V62 H0Z' },
  { box: '0 99 358 18', d: 'M0 110 C 80 99 150 104 220 111 C 280 117 320 110 358 103 V117 H0Z' },
  { box: '0 153 358 14', d: 'M0 166 C 70 158 140 153 210 160 C 280 167 320 166 358 158 V167 H0Z' },
] as const;
const PLACE = ['far', 'mid', 'near'] as const;

/**
 * "Further out": three hills toward a pale sun, the far one at the top. A layout: each hill is a block that grows with
 * its words, so long goals and large text never clip. A hill with words and no plus shows a filled mark (a goal is set),
 * one with `plus` the Paper plus (the invitation), one with only a caption a dotted ring. Presentational.
 */
export const FarHills = ({ title = 'Further out', hills, label = 'Further out', className = '' }: FarHillsProps) => {
  const id = useId().replace(/:/g, '');
  return (
    <section className={`fh ${className}`.trim()} aria-label={label}>
      <div className="fh-sky">
        <span className="fh-title">{title}</span>
        <svg className="fh-sun" viewBox="0 0 160 62" aria-hidden="true">
          <defs>
            <radialGradient id={`${id}-halo`}>
              <stop offset="0" style={{ stopColor: 'var(--apricot)' }} stopOpacity=".85" />
              <stop offset=".5" style={{ stopColor: 'var(--horizon-2)' }} stopOpacity=".5" />
              <stop offset="1" style={{ stopColor: 'var(--horizon-2)' }} stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="80" cy="50" r="70" fill={`url(#${id}-halo)`} />
          <circle className="fh-sun-ring is-outer" cx="80" cy="50" r="46" />
          <circle className="fh-sun-ring" cx="80" cy="50" r="36" />
          <circle className="fh-sun-disc" cx="80" cy="50" r="26" />
        </svg>
        <svg className="fh-way" viewBox="0 0 208 62" preserveAspectRatio="none" aria-hidden="true">
          <path d="M 0 62 C 2 52 6 46 14 42 S 50 33 68 31 S 120 25 144 26 S 190 31 204 36" />
        </svg>
        <svg className="fh-crest is-far" viewBox={CRESTS[0].box} preserveAspectRatio="none" aria-hidden="true">
          <path d={CRESTS[0].d} />
        </svg>
      </div>
      {hills.map((h, i) => {
        const set = h.words != null && !h.plus;
        const inner = (
          <>
            <span className={`fh-node${h.plus ? ' is-plus' : set ? ' is-set' : ''}`} aria-hidden="true">
              {h.plus ? <Plus size={16} strokeWidth={2.5} /> : null}
            </span>
            <span className="fh-words">
              <span className="fh-cap">{h.caption}</span>
              {h.words != null ? <span className="fh-goal">{h.words}</span> : null}
            </span>
            {h.value != null ? <span className="fh-value">{h.value}</span> : null}
            {h.onPress && h.words != null ? <ChevronRight className="fh-chev" size={18} aria-hidden="true" /> : null}
          </>
        );
        return (
          <div key={i} className={`fh-hill is-${PLACE[i]}`}>
            {i > 0 ? (
              <svg className="fh-crest" viewBox={CRESTS[i]!.box} preserveAspectRatio="none" aria-hidden="true">
                <path d={CRESTS[i]!.d} />
              </svg>
            ) : null}
            {h.onPress ? (
              <Pressable className="fh-row" press="dim" label={h.label} onPress={() => h.onPress?.()}>
                {inner}
              </Pressable>
            ) : (
              <div className="fh-row" aria-label={h.label}>
                {inner}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
};
