import type * as React from 'react';
import './orbLight.css';

export interface OrbLightProps {
  /** The core's diameter in px. 48 behind a keepsake. Default 20. */
  size?: number;
  /** The soft light around the core (1.8 times the core). Default true. Off where lights sit close together. */
  glow?: boolean;
  className?: string;
}

/**
 * The keepsake's light (guide 2.1): the Apricot light behind the newest keepsake on the Orbs page. An Apricot core that is
 * brightest at its center, a soft glow around it (1.8 times the core, 26 percent at the core's edge, fading to nothing)
 * and a 1 px Ember edge at 30 percent so it holds on Paper.
 *
 * It is light behind a disc, never a mark of its own. It was how the first earned Orbs were drawn; an earned Orb is now
 * one of the family (`features/orbs/gems`, `OrbGem`), and neither is the assistant's Orb (`ui/Orb.tsx`: the Sky sphere,
 * one per screen). Apricot on Paper is about 1.7:1, so it never carries meaning alone: the keepsake's own numeral or
 * glyph does. Presentational: `aria-hidden`.
 *
 * The box is the core (`size` square); the glow is drawn outside it and takes no room.
 */
export const OrbLight = ({ size = 20, glow = true, className = '' }: OrbLightProps): React.JSX.Element => (
  <span className={`orb-light ${className}`.trim()} style={{ '--ol': `${size}px` } as React.CSSProperties} aria-hidden="true">
    {glow ? <i className="ol-glow" /> : null}
    <i className="ol-core" />
  </span>
);
