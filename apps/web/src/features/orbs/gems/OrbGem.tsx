import type * as React from 'react';
import { gemUrl } from './svg';
import type { Gem } from './table';
import './gem.css';

/**
 * An earned Orb: a flat form built on a circle, one color and one silhouette (guide 2.1). What was finished decides
 * which (`gemFor`). It is never the assistant's Orb (`ui/Orb.tsx`, the one glossy sphere, one per screen).
 *
 * The form's circle is `size` across and nothing is drawn outside it. The silhouette says the kind; the color never
 * carries it alone. Upright wherever it is drawn here. Hidden from VoiceOver unless `label`.
 */
export const OrbGem = ({ gem, size, className = '', label }: { gem: Gem; size: number; className?: string; label?: string }): React.JSX.Element => (
  <span className={`orb-gem ${className}`.trim()} style={{ '--og': `${size}px` } as React.CSSProperties} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    <img src={gemUrl(gem)} alt="" draggable={false} decoding="async" />
  </span>
);
