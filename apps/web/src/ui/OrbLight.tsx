import type * as React from 'react';
import './orbLight.css';

export interface OrbLightProps {
  /** The core's diameter in px. 20 at birth, 12 at rest, 48 on a keepsake. Default 20. */
  size?: number;
  /** The soft light around the core (1.8 times the core). Default true. Off where lights sit close together. */
  glow?: boolean;
  className?: string;
}

/**
 * An earned Orb: an orb of light. An Apricot core that is brightest at its center, a soft glow around it (1.8 times the
 * core, 26 percent at the core's edge, fading to nothing) and a 1 px Ember edge at 30 percent so it holds on Paper.
 *
 * It is not the assistant's Orb (`ui/Orb.tsx`: the glossy blue sphere, one per screen): no gloss, no highlight off
 * center, no blue, no Sunrise, no Paper keyline. It appears only as a reward and on the Orbs page. Apricot on Paper is
 * about 1.7:1, so it never carries meaning alone: a numeral or a shape beside it does. Presentational: `aria-hidden`.
 *
 * The box is the core (`size` square); the glow is drawn outside it and takes no room.
 */
export const OrbLight = ({ size = 20, glow = true, className = '' }: OrbLightProps): React.JSX.Element => (
  <span className={`orb-light ${className}`.trim()} style={{ '--ol': `${size}px` } as React.CSSProperties} aria-hidden="true">
    {glow ? <i className="ol-glow" /> : null}
    <i className="ol-core" />
  </span>
);
