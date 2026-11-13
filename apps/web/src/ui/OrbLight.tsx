import type * as React from 'react';

/**
 * PLACEHOLDER (replaced at merge by the moment builder's component). An earned Orb: an Apricot orb of light, never glossy,
 * never blue. Presentational and hidden from VoiceOver.
 */
export const OrbLight = ({ size = 12, glow = false, className = '' }: { size?: number; glow?: boolean; className?: string }): React.JSX.Element => (
  <span
    className={`orb-light ${className}`.trim()}
    aria-hidden="true"
    style={{
      position: 'relative',
      display: 'inline-block',
      flex: 'none',
      width: size,
      height: size,
      borderRadius: '50%',
      background: 'var(--apricot)',
      boxShadow: glow ? `0 0 ${Math.round(size * 0.4)}px ${Math.round(size * 0.2)}px color-mix(in srgb, var(--apricot) 55%, transparent)` : undefined,
    }}
  />
);
