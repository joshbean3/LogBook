import type * as React from 'react';
import { gemBox, gemUrl } from './svg';
import type { Gem } from './table';
import './gem.css';

/**
 * An earned Orb: the logo's Orb at its rung (guide 2.1). What was finished decides the rung (`gemFor`). It is the same
 * picture as the assistant's Orb (`ui/Orb.tsx`) and never stands in for it: it does not think, speak or open anything.
 *
 * The sphere is `size` across. From rung 3 the picture is larger than the sphere (its glow, its rings: `gemBox`): it
 * is centered on the box and drawn over what is beside it, and it takes no room in the layout. Always upright: a
 * sphere is lit from above. Hidden from VoiceOver unless `label`.
 */
export const OrbGem = ({ gem, size, className = '', label }: { gem: Gem; size: number; className?: string; label?: string }): React.JSX.Element => (
  <span className={`orb-gem ${className}`.trim()} style={{ '--og': `${size}px`, '--og-box': gemBox(gem) } as React.CSSProperties} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    <img src={gemUrl(gem, size)} alt="" draggable={false} decoding="async" />
  </span>
);
