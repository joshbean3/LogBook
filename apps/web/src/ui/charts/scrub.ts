/**
 * The maths under a chart of bars and under reading any chart with a finger: where each bar sits, which one a point falls
 * on, whether a touch has become a read of the chart or a scroll of the page, and where a key moves the reading. Pure
 * functions, so the charts, the hook that listens (`useScrub`) and their tests agree. Nothing here renders or listens.
 */
import { SCRUB_CLAIM_PX, SCRUB_SCROLL_PX } from '@/lib/gesture';

// ---------- the bars ----------
/** A bar is never wider than this: five weeks on a wide phone still read as bars, not blocks. */
export const MAX_BAR = 24;
/** A bar is never thinner than this, however many there are. */
export const MIN_BAR = 2;
/** The share of its slot a bar fills; the rest is the gap between bars. */
export const BAR_SHARE = 0.68;

export interface BarLayout {
  /** Where the first slot starts. */
  left: number;
  /** The width each bucket has: its bar and the gap around it. */
  slot: number;
  barW: number;
  n: number;
}
/** `n` bars side by side across `plotW`, starting at `left`: each bucket gets an equal slot and a bar centered in it. */
export const barLayout = (plotW: number, n: number, left = 0): BarLayout => {
  const count = Math.max(0, Math.floor(n));
  const slot = count > 0 ? Math.max(0, plotW) / count : Math.max(0, plotW);
  return { left, slot, barW: Math.max(MIN_BAR, Math.min(MAX_BAR, slot * BAR_SHARE)), n: count };
};
/** The center of bar `i`. */
export const barCenter = (l: BarLayout, i: number) => l.left + l.slot * (i + 0.5);
/**
 * The bucket under `x` (in the plot's own units): the slot it falls in, held to the first one that can be read (`min`)
 * and the last, so a finger that slides past either end keeps reading the end. Null when there is nothing to read.
 */
export const bucketAt = (l: BarLayout, x: number, min = 0): number | null => {
  if (l.n <= 0 || !(l.slot > 0) || !Number.isFinite(x)) return null;
  const i = Math.floor((x - l.left) / l.slot);
  return Math.max(Math.min(min, l.n - 1), Math.min(l.n - 1, i));
};

// ---------- the gesture ----------
export type ScrubIntent = 'scrub' | 'scroll' | null;
/**
 * What a touch that has moved (`dx`, `dy`) from where it began means: a read of the chart once it is SCRUB_CLAIM_PX to
 * the side and more sideways than up or down; a scroll of the page once it is SCRUB_SCROLL_PX up or down and at least as
 * much that way as sideways; nothing yet in between. The page keeps every gesture the chart has not claimed.
 */
export const scrubIntent = (dx: number, dy: number): ScrubIntent => {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax >= SCRUB_CLAIM_PX && ax > ay) return 'scrub';
  if (ay >= SCRUB_SCROLL_PX && ay >= ax) return 'scroll';
  return null;
};

/**
 * Where a key moves the reading: Left and Down one bucket earlier, Right and Up one later (a slider's keys, and what
 * VoiceOver's swipe down and up send), Home to the first bucket that can be read, End to the last. The first press moves
 * from `home` (the bucket holding today). Null for any other key.
 */
export const stepIndex = (key: string, active: number | null, o: { count: number; home: number; min: number }): number | null => {
  if (o.count <= 0) return null;
  const last = o.count - 1;
  const min = Math.max(0, Math.min(o.min, last));
  const clamp = (i: number) => Math.max(min, Math.min(last, i));
  const cur = clamp(active ?? o.home);
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowDown':
      return clamp(cur - 1);
    case 'ArrowRight':
    case 'ArrowUp':
      return clamp(cur + 1);
    case 'Home':
      return min;
    case 'End':
      return last;
    default:
      return null;
  }
};
