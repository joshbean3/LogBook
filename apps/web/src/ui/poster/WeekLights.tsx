import { useId, useState } from 'react';
import { closed, FAR, MIDDLE, NEAR } from './horizon';
import { LIGHTS_H, LIGHTS_W, lightPoints, lightsWay } from './logic';
import './poster.css';

export interface WeekLight {
  /** The day's letter under its light: "M". */
  letter: string;
  /** A line was kept that day. */
  lit: boolean;
  /** The day in words, for its button when the lights can be tapped (`onPick`): "Monday, Nov 9, written". */
  name?: string;
}

export interface WeekLightsProps {
  /** The days before tonight, oldest first (six for a week ending tonight). */
  days: readonly WeekLight[];
  /** waiting: tonight's dotted ring. lit: tonight's light, the largest, with two rings. */
  tonight: 'waiting' | 'lit';
  /** The word under tonight's light. Default "Tonight". */
  tonightLabel?: string;
  /** Read by VoiceOver in place of the picture: "2 lines kept this week. Tonight is waiting." Without it the picture is hidden. */
  label?: string;
  /**
   * A tap on a day before tonight (its place in `days`). With it each of those days is a button over its light and its
   * letter, as wide as the lights are apart, and the picture is a group with `label` as its name.
   */
  onPick?: (index: number) => void;
}

const STARS: readonly (readonly [number, number, number, number])[] = [
  [196, 8, 0.9, 0.5],
  [128, 30, 0.8, 0.4],
  [236, 44, 0.8, 0.45],
  [60, 52, 0.7, 0.35],
];
const OFF = LIGHTS_H - 88;
/** A day's button: the lights sit 47 apart (logic.ts `lightPoints`), and 64 tall is 44 pt and more down to a 250 pt card. */
const HIT_W = 47;
const HIT_H = 64;
const HIT_UP = 28;
const WAITING = Array.from({ length: 22 }, (_, k) => (k / 22) * Math.PI * 2);

/**
 * The dusk sky of What I learned: the week's lights on a rising line that ends at tonight. A kept day is an Apricot light,
 * a missed one a small open ring (never a break in the line), tonight a dotted ring that waits. When `tonight` turns to
 * 'lit' while the scene is up, the light scales to 1.12 and back once and its rings bloom (a fade under Reduce Motion).
 * Presentational: put it in a dusk poster's `scene`.
 */
export const WeekLights = ({ days: list, tonight, tonightLabel = 'Tonight', label, onPick }: WeekLightsProps) => {
  const days = list ?? [];
  const id = useId().replace(/:/g, '');
  // the save: tonight turned from waiting to lit while this scene was up
  const [prev, setPrev] = useState(tonight);
  const [fresh, setFresh] = useState(false);
  if (prev !== tonight) {
    setPrev(tonight);
    setFresh(prev === 'waiting' && tonight === 'lit');
  }
  const saved = tonight === 'lit';
  const pts = lightPoints(days.length + 1);
  const way = lightsWay(days.map((d) => d.lit), saved);
  const [tx, ty] = pts[days.length]!;
  return (
    <svg className="wl" viewBox={`0 0 ${LIGHTS_W} ${LIGHTS_H}`} role={onPick ? 'group' : label ? 'img' : undefined} aria-label={label} aria-hidden={label || onPick ? undefined : true}>
      <defs>
        <linearGradient id={`${id}-glow`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" style={{ stopColor: 'var(--horizon-2)' }} stopOpacity=".98" />
          <stop offset=".14" style={{ stopColor: 'var(--apricot)' }} stopOpacity=".9" />
          <stop offset=".32" style={{ stopColor: 'var(--apricot)' }} stopOpacity=".5" />
          <stop offset=".56" style={{ stopColor: 'var(--apricot)' }} stopOpacity=".2" />
          <stop offset="1" style={{ stopColor: 'var(--horizon-2)' }} stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-halo`}>
          <stop offset="0" style={{ stopColor: 'var(--apricot)' }} stopOpacity=".7" />
          <stop offset=".45" style={{ stopColor: 'var(--apricot)' }} stopOpacity=".26" />
          <stop offset="1" style={{ stopColor: 'var(--apricot)' }} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y={OFF - 6} width={LIGHTS_W} height="80" fill={`url(#${id}-glow)`} />
      {STARS.map(([x, y, r, o], i) => (
        <circle key={i} className="wl-star" cx={x} cy={y} r={r} opacity={o} />
      ))}
      {way.map(([x, y], i) => (
        <circle key={i} className="wl-way" cx={x} cy={y} r="1" />
      ))}
      {days.map((d, i) => {
        const [x, y] = pts[i]!;
        return (
          <g key={i}>
            {d.lit ? (
              <>
                <circle cx={x} cy={y} r="30" fill={`url(#${id}-halo)`} />
                <circle className="wl-lamp" cx={x} cy={y} r="10" />
              </>
            ) : (
              <circle className="wl-dim" cx={x} cy={y} r="3.5" />
            )}
            <text className="wl-letter" x={x} y={y + (d.lit ? 28 : 21)} textAnchor="middle">
              {d.letter}
            </text>
          </g>
        );
      })}
      {saved ? (
        <g className={`wl-tonight${fresh ? ' is-fresh' : ''}`}>
          <circle cx={tx} cy={ty} r="50" fill={`url(#${id}-halo)`} />
          <circle className="wl-ring is-outer" cx={tx} cy={ty} r="29" />
          <circle className="wl-ring" cx={tx} cy={ty} r="21.5" />
          <circle className="wl-lamp is-tonight" cx={tx} cy={ty} r="14" />
        </g>
      ) : (
        WAITING.map((a, k) => <circle key={k} className="wl-wait" cx={tx + 16 * Math.cos(a)} cy={ty + 16 * Math.sin(a)} r="1.15" />)
      )}
      <text className="wl-letter is-tonight" x={tx + 3} y={ty + (saved ? 48 : 36)} textAnchor="middle">
        {tonightLabel}
      </text>
      <g transform={`translate(0 ${OFF})`}>
        <path className="wl-hill-1" d={closed(NEAR)} />
        <path className="wl-hill-2" d={closed(MIDDLE)} />
        <path className="wl-hill-3" d={closed(FAR)} />
        <path className="wl-rim" d={NEAR} />
      </g>
      {/* the days as buttons, over everything drawn: each as wide as the lights are apart, tall enough for a thumb */}
      {onPick
        ? days.map((d, i) => {
            const [x, y] = pts[i]!;
            return (
              <rect
                key={i}
                className="wl-hit"
                x={x - HIT_W / 2}
                y={y - HIT_UP}
                width={HIT_W}
                height={HIT_H}
                rx="12"
                role="button"
                tabIndex={0}
                aria-label={d.name ?? d.letter}
                onClick={() => onPick(i)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' && e.key !== ' ') return;
                  e.preventDefault();
                  onPick(i);
                }}
              />
            );
          })
        : null}
    </svg>
  );
};
