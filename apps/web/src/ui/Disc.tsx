import type * as React from 'react';
import { useEffect, useRef } from 'react';
import { registerRunner } from './orbPaint';

/*
 * A flat circle in a token color, with an optional centered numeral (guide 3.3, 8.5): journal entry marks, a lit coin in a
 * demo, a working dot in a chip. Never the Orb (guide 2.1: the Orb is never a bullet or a decoration), so it carries no
 * gloss, no glow and not the Orb's class.
 *
 *   sky      Sky, the lit fill (the default)
 *   haze     Haze with a Deep Sky ring (a journal day with one entry)
 *   two      the journal's two-entry tone (--entry-2)
 *   deep     Deep Sky (a Favorite)
 *
 * `pulse`: an opacity pulse, 1 to 0.6 over 1.2 s, for a working state too small for the Orb (plan D18). It runs only while
 * the disc is on screen and the page is shown, and never under Reduce Motion.
 */
export type DiscTone = 'sky' | 'haze' | 'two' | 'deep';

export const Disc = ({ size = 16, tone = 'sky', n, pulse = false, className = '', label, style }: { size?: number; tone?: DiscTone; n?: number | string; pulse?: boolean; className?: string; label?: string; style?: React.CSSProperties }) => {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => (pulse && ref.current ? registerRunner(ref.current) : undefined), [pulse]);
  return (
    <span
      ref={ref}
      className={`lb-disc is-${tone}${pulse ? ' is-pulse' : ''} ${className}`.trim()}
      style={{ '--s': `${size}px`, ...style } as React.CSSProperties}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {n != null ? <span className="lb-disc-n">{n}</span> : null}
    </span>
  );
};
