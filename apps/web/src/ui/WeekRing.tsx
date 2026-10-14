import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { springs } from '@/lib/motion';
import { useFirstToday } from './useFirstToday';

export type WeekDayStatus = 'done' | 'floor' | 'missed' | 'skipped' | 'rest' | 'open' | 'future';
export interface WeekRingProps {
  /** Seven statuses, Monday first. `open` is today not yet done; it draws like `future`. */
  days: WeekDayStatus[];
  /** 40 (in a hero) or 64 (in a sheet). */
  size?: 40 | 64;
  /** Index (0–6) of today: its segment gets a small tick outside the ring. */
  today?: number;
  /** The accessible name. Default: "Week: 3 done, 1 floor, 1 rest, 2 to go". */
  label?: string;
  /** A `useFirstToday` key for the once-a-day fill. Default 'week-ring'; null to never animate. */
  onceADay?: string | null;
  /** Shared-element id (`week-<isoWeek>`) for a ring that travels into the week sheet. */
  layoutId?: string;
  /** Makes the ring a button (tap → week sheet). */
  onPress?: () => void;
  /** Inside the ring: a count, a check. */
  children?: ReactNode;
}

const GAP_DEG = 4;
const SEG = 360 / 7;
const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
};
const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};
const COLOR: Record<WeekDayStatus, string> = {
  done: 'var(--ok)',
  floor: 'var(--warn)',
  missed: 'var(--ink-4)',
  skipped: 'var(--ink-4)',
  rest: 'var(--ink-4)',
  open: 'var(--surface-3)',
  future: 'var(--surface-3)',
};
const WORD: Partial<Record<WeekDayStatus, string>> = { done: 'done', floor: 'floor', missed: 'missed', skipped: 'skipped', rest: 'rest' };
export const weekRingLabel = (days: WeekDayStatus[]) => {
  const n = (s: WeekDayStatus) => days.filter((d) => d === s).length;
  const parts = (['done', 'floor', 'rest', 'missed', 'skipped'] as const).filter((s) => n(s)).map((s) => `${n(s)} ${WORD[s]}`);
  const left = n('open') + n('future');
  if (left) parts.push(`${left} to go`);
  return `Week: ${parts.join(', ') || 'nothing yet'}`;
};

/**
 * The week as a ring of seven arcs (Monday at the top, clockwise, 4° gaps), each coloured by its day: done blue, floor
 * amber, missed and rest ink-4 (rest dashed), today and future surface-3. It fills on `springs.number` (under 900ms) on the
 * first view of the day and is still on every other view; reduced motion shows it complete. Colour is never the only
 * signal: the accessible name spells the week out, and the week sheet it opens says it in words.
 */
export const WeekRing = ({ days, size = 40, today, label, onceADay = 'week-ring', layoutId, onPress, children }: WeekRingProps) => {
  const reduce = useReducedMotion();
  const first = useFirstToday(onceADay);
  const animateFill = first && !reduce;
  const stroke = size === 64 ? 6 : 4;
  const c = size / 2;
  const r = c - stroke / 2 - (today != null ? 2 : 0);
  const name = label ?? weekRingLabel(days);
  const svg = (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {Array.from({ length: 7 }, (_, i) => {
        const st = days[i] ?? 'future';
        const a0 = i * SEG + GAP_DEG / 2;
        const a1 = (i + 1) * SEG - GAP_DEG / 2;
        const d = arc(c, c, r, a0, a1);
        const fills = animateFill && st !== 'open' && st !== 'future' && st !== 'rest';
        // under a filling arc sits its track, so the ring's shape is there from the first frame
        if (fills)
          return (
            <g key={i}>
              <path d={d} fill="none" stroke={COLOR.future} strokeWidth={stroke} />
              <motion.path d={d} fill="none" stroke={COLOR[st]} strokeWidth={stroke} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={springs.number} />
            </g>
          );
        return <path key={i} d={d} fill="none" stroke={COLOR[st]} strokeWidth={stroke} strokeDasharray={st === 'rest' ? '2 2.5' : undefined} />;
      })}
      {today != null ? <circle cx={polar(c, c, c - 1.25, today * SEG + SEG / 2)[0]} cy={polar(c, c, c - 1.25, today * SEG + SEG / 2)[1]} r={1.25} fill="var(--ink)" /> : null}
    </svg>
  );
  const inner = (
    <>
      {svg}
      {children ? (
        <span className="wring-in" aria-hidden="true">
          {children}
        </span>
      ) : null}
    </>
  );
  if (onPress)
    return (
      <motion.button
        type="button"
        layoutId={layoutId}
        className={`wring wring-${size} is-btn`}
        aria-label={name}
        onClick={onPress}
        whileTap={reduce ? undefined : { scale: 0.97 }}
        transition={springs.press}
      >
        {inner}
      </motion.button>
    );
  return (
    <motion.span layoutId={layoutId} className={`wring wring-${size}`} role="img" aria-label={name}>
      {inner}
    </motion.span>
  );
};
