import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { forRange, springs } from '@/lib/motion';
import { useFirstToday } from './useFirstToday';
import { usePress } from './usePress';

export type WeekDayStatus = 'done' | 'floor' | 'missed' | 'skipped' | 'rest' | 'open' | 'future';
export interface WeekRingProps {
  /** Seven statuses, Monday first. `rest` is a day with nothing to do (no arc); `open` is today not yet done (drawn like `future`). */
  days: WeekDayStatus[];
  /** 40 (in a hero) or 64 (in a sheet). */
  size?: 40 | 64;
  /** Index (0–6) of today: a small dot just outside its arc. */
  today?: number;
  /** 0–6: the shown day; its segment is ringed 1.5 px --ink (spec §3.1 row 6, M22). */
  marked?: number;
  /** The accessible name. Default: "Week: 3 done, 1 floor, 1 rest, 2 to go". */
  label?: string;
  /** A `useFirstToday` key for the once-a-day fill. Default 'week-ring'; null to never animate. */
  onceADay?: string | null;
  /** Makes the ring a button (tap → week sheet). */
  onPress?: () => void;
  /**
   * The middle. Left out: the days kept this week (done or floor) in the stamp face, nothing while that is 0. Pass a node to
   * put something else there (a check), or `null` / `''` for nothing.
   */
  children?: ReactNode;
}

/** The gap between two days' arcs, in px along the ring (so it reads the same at 40 and 64). */
const GAP_PX = { 40: 3, 64: 4 } as const;
/** Track and arc width. */
const STROKE = { 40: 3, 64: 5 } as const;
const SEG = 360 / 7;
/** The once-a-day fill: pathLength 0 → 1 on springs.number, rest thresholds in pathLength units (px ones end it on frame one). */
const RING_FILL = forRange(springs.number, 1);
const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
};
const f2 = (n: number) => n.toFixed(2);
const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  return `M ${f2(x0)} ${f2(y0)} A ${r} ${r} 0 0 1 ${f2(x1)} ${f2(y1)}`;
};
/** The outline of a ring segment (an annular sector) from `a0` to `a1`, `w` wide: how the shown day is marked. */
const sector = (cx: number, cy: number, r: number, w: number, a0: number, a1: number) => {
  const ro = r + w / 2;
  const ri = r - w / 2;
  const [ox0, oy0] = polar(cx, cy, ro, a0);
  const [ox1, oy1] = polar(cx, cy, ro, a1);
  const [ix1, iy1] = polar(cx, cy, ri, a1);
  const [ix0, iy0] = polar(cx, cy, ri, a0);
  return `M ${f2(ox0)} ${f2(oy0)} A ${ro} ${ro} 0 0 1 ${f2(ox1)} ${f2(oy1)} L ${f2(ix1)} ${f2(iy1)} A ${ri} ${ri} 0 0 0 ${f2(ix0)} ${f2(iy0)} Z`;
};
/** The solid arcs. Missed and rest have none (a missed day's stretch of track is --ink-4, a quiet gap; never red). */
const COLOR: Partial<Record<WeekDayStatus, string>> = {
  done: 'var(--accent)',
  floor: 'var(--warn)',
  skipped: 'var(--ink-3)',
  // still to come: a faint arc, clearly on the track but quieter than anything that happened
  open: 'var(--ink-4)',
  future: 'var(--ink-4)',
};
const WORD: Partial<Record<WeekDayStatus, string>> = { done: 'done', floor: 'floor', missed: 'missed', skipped: 'skipped', rest: 'rest' };
export const weekRingLabel = (days: WeekDayStatus[]) => {
  const n = (s: WeekDayStatus) => days.filter((d) => d === s).length;
  const parts = (['done', 'floor', 'rest', 'missed', 'skipped'] as const).filter((s) => n(s)).map((s) => `${n(s)} ${WORD[s]}`);
  const left = n('open') + n('future');
  if (left) parts.push(`${left} to go`);
  return `Week: ${parts.join(', ') || 'nothing yet'}`;
};
/** Days kept this week (done or floor): the number in the middle of the ring. */
export const weekRingKept = (days: WeekDayStatus[]) => days.filter((d) => d === 'done' || d === 'floor').length;

/**
 * The week as a calendar you read at a glance (critic B2). A continuous low-contrast track (`--surface-3`) and on it one
 * arc per day that has a session, Monday at the top, clockwise: done solid blue, floor solid amber, a skipped (or sick) day
 * grey, a day still to come a faint solid arc. A missed day draws no arc: its stretch of track turns `--ink-4`, a quiet gap
 * (never red). A rest day has no arc, only the track. `marked` rings the shown day's segment 1.5 px `--ink`. No dashes,
 * nothing that spins, no haptic (the week closing is the Week card's `celebrate`). The days kept sit in the middle in the stamp face. The arcs fill on `springs.number` on the
 * first view of the day and are still on every other view; reduced motion shows them complete. Colour is never the only
 * signal: the accessible name spells the week out, and the week sheet it opens says it in words.
 */
export const WeekRing = ({ days, size = 40, today, marked, label, onceADay = 'week-ring', onPress, children }: WeekRingProps) => {
  const reduce = useReducedMotion();
  const press = usePress();
  const first = useFirstToday(onceADay);
  const animateFill = first && !reduce;
  const stroke = STROKE[size];
  const c = size / 2;
  const r = c - stroke / 2 - (today != null ? 2.5 : 0.75);
  const gapDeg = (GAP_PX[size] / (2 * Math.PI * r)) * 360;
  const name = label ?? weekRingLabel(days);
  const kept = weekRingKept(days);
  const middle = children === undefined ? (kept > 0 ? kept : null) : children;
  const dot = today != null ? polar(c, c, c - 1.1, today * SEG + SEG / 2) : null;
  const svg = (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle className="wring-track" cx={c} cy={c} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
      {Array.from({ length: 7 }, (_, i) => {
        const st = days[i] ?? 'future';
        if (st === 'rest') return null;
        const a0 = i * SEG + gapDeg / 2;
        const a1 = (i + 1) * SEG - gapDeg / 2;
        const d = arc(c, c, r, a0, a1);
        if (st === 'missed') return <path key={i} className="wring-gap" data-day={i} d={d} fill="none" stroke="var(--ink-4)" strokeWidth={stroke} />;
        if (animateFill && (st === 'done' || st === 'floor'))
          return <motion.path key={i} className={`wring-day wring-${st}`} d={d} fill="none" stroke={COLOR[st]} strokeWidth={stroke} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={RING_FILL} />;
        return <path key={i} className={`wring-day wring-${st}`} d={d} fill="none" stroke={COLOR[st]} strokeWidth={stroke} />;
      })}
      {marked != null && marked >= 0 && marked < 7 ? (
        <path className="wring-mark" data-day={marked} d={sector(c, c, r, stroke, marked * SEG + gapDeg / 2, (marked + 1) * SEG - gapDeg / 2)} fill="none" stroke="var(--ink)" strokeWidth={1.5} strokeLinejoin="round" />
      ) : null}
      {dot ? <circle className="wring-today" cx={dot[0]} cy={dot[1]} r={1.1} fill="var(--ink-2)" /> : null}
    </svg>
  );
  const inner = (
    <>
      {svg}
      {middle !== null && middle !== '' && middle !== false ? (
        <span className="wring-in" aria-hidden="true">
          {middle}
        </span>
      ) : null}
    </>
  );
  if (onPress)
    return (
      <button
        type="button"
        className={`wring wring-${size} is-btn`}
        aria-label={name}
        onClick={onPress}
        data-press="scale"
        {...press.handlers}
      >
        {inner}
      </button>
    );
  return (
    <span className={`wring wring-${size}`} role="img" aria-label={name}>
      {inner}
    </span>
  );
};
