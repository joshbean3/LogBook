import type * as React from 'react';

const R = 19;
/** The dial runs two thirds of the way round, open at the bottom. */
const SWEEP = 240;
const FROM = 150;
const at = (deg: number, r: number): string => `${(24 + r * Math.cos((deg * Math.PI) / 180)).toFixed(2)} ${(24 + r * Math.sin((deg * Math.PI) / 180)).toFixed(2)}`;
const arc = (from: number, to: number): string => `M ${at(from, R)} A ${R} ${R} 0 ${to - from > 180 ? 1 : 0} 1 ${at(to, R)}`;
const LENGTH = (SWEEP / 360) * 2 * Math.PI * R;

/**
 * The level as an instrument dial: an arc for the way to the next level, lit as far as it has been earned, and a needle
 * standing at it. A drawing only: the words beside it say the level and what is left, so it is hidden from VoiceOver.
 * `progress` is 0 at a level's start and never 1.
 */
export const Gauge = ({ progress }: { progress: number }): React.JSX.Element => {
  const p = Math.max(0, Math.min(1, progress || 0));
  return (
    <svg className="dm-gauge" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true" focusable="false">
      <path className="dm-gauge-track" d={arc(FROM, FROM + SWEEP)} />
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <path key={t} className="dm-gauge-tick" d={`M ${at(FROM + SWEEP * t, R + 3.2)} L ${at(FROM + SWEEP * t, R + 5)}`} />
      ))}
      <path className="dm-gauge-lit" d={arc(FROM, FROM + SWEEP)} strokeDasharray={`${(LENGTH * p).toFixed(2)} ${(LENGTH * 2).toFixed(2)}`} />
      <g className="dm-gauge-needle" style={{ transform: `rotate(${(FROM + SWEEP * p).toFixed(2)}deg)` }}>
        <path d="M 24 24 L 38 24" />
      </g>
      <circle className="dm-gauge-hub" cx="24" cy="24" r="2.6" />
    </svg>
  );
};
