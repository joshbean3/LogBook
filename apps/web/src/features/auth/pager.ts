/**
 * The welcome pager's rules (Start.tsx), apart from the screen so a test can read them: which page a scroll position is,
 * and where a key on the page dots goes.
 */

/** The page a horizontal scroll position shows most of, 0 to `count - 1`. A track with no width yet is on its first page. */
export const pageAt = (scrollLeft: number, width: number, count: number): number => {
  if (!(width > 0) || !Number.isFinite(scrollLeft) || count < 1) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(scrollLeft / width)));
};

/**
 * The page dots are one adjustable control (a slider to VoiceOver and the keyboard, the equal of a swipe): Right and Up go
 * on a page, Left and Down go back, Home and End go to the first and the last. The ends hold: nothing wraps. Null for a
 * key that is not the dots'.
 */
export const pageForKey = (key: string, page: number, count: number): number | null => {
  const last = Math.max(0, count - 1);
  const at = Math.max(0, Math.min(last, page));
  if (key === 'ArrowRight' || key === 'ArrowUp') return Math.min(last, at + 1);
  if (key === 'ArrowLeft' || key === 'ArrowDown') return Math.max(0, at - 1);
  if (key === 'Home') return 0;
  if (key === 'End') return last;
  return null;
};

/** A tap on the dots goes on a page, and from the last one back to the first. */
export const pageAfterTap = (page: number, count: number): number => (count < 1 ? 0 : (Math.max(0, page) + 1) % count);
