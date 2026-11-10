import type * as React from 'react';
import { useEffect, useRef } from 'react';
import { Disc, type DiscTone } from './Disc';
import { registerRunner } from './orbPaint';
import glossArt from './orb/logo-mark.svg?url';
import fullArt from './orb/logo-mark-glow.svg?url';
import warmFullArt from './orb/logo-mark-thinking-body.svg?url';
import warmGlossArt from './orb/logo-mark-thinking-gloss.svg?url';
import './orb.css';

/**
 * The Orb: Orby's mark and the assistant's face (guide 2.1). A glossy Sky sphere lit by a sunrise from below, rendered from
 * the brand's SVG art (gradients, masks and blurs that WebKit draws once per size and caches), never repainted on a canvas.
 *
 * `state`:
 *   idle    the full Orb breathes, scale 1 to 1.015 over 4 s (48 px and up only; smaller Orbs hold still)
 *   think   the underlight warms (an overlay fades in over 200 ms) and an Apricot arc orbits a faint Sky ring once per
 *           1.2 s; the sphere itself never turns. The status line beside it is the accessible signal, and it is required
 *   still   one frame
 * Size tiers (guide 2.1): 48 px and up the full Orb with its Apricot glow; 28 to 47 the gloss, no glow, still; under 28 a
 * flat Sky disc, which is not the Orb at all (plan D18), so it renders as a Disc and a thinking one pulses its opacity.
 * Breath and orbit run on the compositor and only while the Orb is seen (orbPaint.ts); under Reduce Motion it holds still
 * and a thinking Orb only swaps to the warm art.
 *
 * `variant` is the old canvas palette, kept so its callers (journal entry marks, a tour demo) compile until they move to
 * ui/Disc.tsx: a variant other than the brand's renders as a flat Disc in the guide's journal tones, never as an Orb.
 * `label`: "Assistant" where it opens the assistant, "Orby" as the logo; without one it is hidden from VoiceOver.
 */
export type OrbState = 'idle' | 'think' | 'still';
export type OrbVariant = 'brand' | 'sun' | 'sky' | 'dusk' | 'tide';

/** The art box: the sphere is 96 of the file's 100 units (gloss) or 96 of 150 (full, glow included). */
const GLOSS_BOX = 100 / 96;
const FULL_BOX = 150 / 96;
/** The journal's old palette, mapped to the guide's entry marks (12.1: one, two, three or more, a Favorite). */
const VARIANT_TONE: Record<Exclude<OrbVariant, 'brand'>, DiscTone> = { sky: 'haze', dusk: 'two', tide: 'sky', sun: 'deep' };

export const Orb = ({ size = 48, state = 'idle', variant = 'brand', className = '', label, style }: { size?: number; state?: OrbState; variant?: OrbVariant; className?: string; label?: string; style?: React.CSSProperties }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const tier = size >= 48 ? 'full' : size >= 28 ? 'gloss' : 'flat';
  // only a full idle Orb breathes and only a thinking one orbits: a gloss idle Orb (the dock's) never registers
  const moves = tier !== 'flat' && variant === 'brand' && (state === 'think' || (state === 'idle' && tier === 'full'));
  useEffect(() => (moves && ref.current ? registerRunner(ref.current) : undefined), [moves]);
  if (tier === 'flat' || variant !== 'brand') {
    return <Disc size={size} tone={variant === 'brand' ? 'sky' : VARIANT_TONE[variant]} pulse={state === 'think'} className={className} label={label} style={style} />;
  }
  const box = tier === 'full' ? FULL_BOX : GLOSS_BOX;
  return (
    <span
      ref={ref}
      className={`lb-orb is-${tier} is-${state} ${className}`.trim()}
      style={{ '--s': `${size}px`, '--box': box, ...style } as React.CSSProperties}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <img className="lb-orb-art" src={tier === 'full' ? fullArt : glossArt} alt="" draggable={false} decoding="async" />
      {state === 'think' ? (
        <>
          <img className="lb-orb-art lb-orb-warm" src={tier === 'full' ? warmFullArt : warmGlossArt} alt="" draggable={false} decoding="async" />
          <OrbArc size={size} tier={tier} />
        </>
      ) : null}
    </span>
  );
};

/**
 * The thinking arc, the published thinking file's three circles (a faint Sky ring, a Paper keyline, the --orb-arc arc,
 * about 14 percent of the circle) without the sphere, so it can turn while the sphere holds still. Full tier: the file's own
 * geometry (r 58 on the 150-unit box). Gloss tier: 6 px out from the sphere with a 1.5 px Paper keyline either side.
 */
const OrbArc = ({ size, tier }: { size: number; tier: 'full' | 'gloss' }) => {
  if (tier === 'full') {
    return (
      <svg className="lb-orb-arc" viewBox="-25 -25 150 150" aria-hidden="true">
        <circle cx="50" cy="50" r="58" fill="none" stroke="var(--sky)" strokeOpacity="0.3" strokeWidth="1" />
        <circle cx="50" cy="50" r="58" fill="none" stroke="var(--now-keyline)" strokeWidth="4" strokeDasharray="51 400" strokeLinecap="round" transform="rotate(118 50 50)" />
        <circle cx="50" cy="50" r="58" fill="none" stroke="var(--orb-arc)" strokeWidth="1.8" strokeDasharray="50 400" strokeLinecap="round" transform="rotate(118.5 50 50)" />
      </svg>
    );
  }
  const b = size + 16;
  const c = b / 2;
  const r = size / 2 + 6;
  const dash = 2 * Math.PI * r * 0.137;
  const big = 2 * Math.PI * r;
  return (
    <svg className="lb-orb-arc" viewBox={`0 0 ${b} ${b}`} style={{ width: b, height: b }} aria-hidden="true">
      <circle cx={c} cy={c} r={r} fill="none" stroke="var(--sky)" strokeOpacity="0.3" strokeWidth="1" />
      <circle cx={c} cy={c} r={r} fill="none" stroke="var(--now-keyline)" strokeWidth="4.5" strokeDasharray={`${dash + 1} ${big}`} strokeLinecap="round" transform={`rotate(118 ${c} ${c})`} />
      <circle cx={c} cy={c} r={r} fill="none" stroke="var(--orb-arc)" strokeWidth="1.5" strokeDasharray={`${dash} ${big}`} strokeLinecap="round" transform={`rotate(118.5 ${c} ${c})`} />
    </svg>
  );
};
