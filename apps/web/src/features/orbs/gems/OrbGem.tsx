import type * as React from 'react';
import { gemBox, gemUrl } from './svg';
import type { Gem } from './table';
import './gem.css';

/**
 * An earned Orb: the logo's form in the family's other hues and styles (guide 2.1). What was finished decides which
 * (`gemFor`). It is never the assistant's Orb (`ui/Orb.tsx`, the Sky sphere, one per screen) and never Sky.
 *
 * The sphere's diameter is `size`; rings and halos may reach outside it and take no room. Hue never carries the kind
 * alone: a style, a size or words beside it do. Hidden from VoiceOver unless `label`.
 */
export const OrbGem = ({ gem, size, className = '', label }: { gem: Gem; size: number; className?: string; label?: string }): React.JSX.Element => (
  <span className={`orb-gem ${className}`.trim()} style={{ '--og': `${size}px`, '--ob': gemBox(gem) } as React.CSSProperties} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    <img src={gemUrl(gem)} alt="" draggable={false} decoding="async" />
  </span>
);
