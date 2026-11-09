import type * as React from 'react';
import './orb.css';

/**
 * Logbook's mark: a living orb. A warm core (gold into orange, the day's light), a body of Columbia blue, a rim that drifts
 * from periwinkle to ice, and a haze around it all. Each layer is a soft blob whose outline morphs and turns at its own
 * slow pace, so the orb never repeats exactly: fluid, never busy.
 *
 * One component for every place the brand appears: the splash, the logo, the assistant's mark. `state` sets its mood:
 *   idle    breathing, slow (the default)
 *   think   quicker, the core pulsing: the assistant is working
 *   still   one quiet frame, no motion (static exports, tiny sizes where motion is noise)
 * Under Reduce Motion it holds still whatever the state.
 */
export type OrbState = 'idle' | 'think' | 'still';

export const Orb = ({ size = 48, state = 'idle', className = '', label, style }: { size?: number; state?: OrbState; className?: string; label?: string; style?: React.CSSProperties }) => (
  <span
    className={`lb-orb is-${state} ${className}`.trim()}
    style={{ '--s': `${size}px`, ...style } as React.CSSProperties}
    role={label ? 'img' : undefined}
    aria-label={label}
    aria-hidden={label ? undefined : true}
  >
    <i className="lb-orb-haze" />
    <i className="lb-orb-rim" />
    <i className="lb-orb-body" />
    <i className="lb-orb-core" />
    <i className="lb-orb-glint" />
  </span>
);
