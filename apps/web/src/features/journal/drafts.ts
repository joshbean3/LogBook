/**
 * The unsaved journal drafts, one per day (contracts §F, docs/feel.md §5.4). A tiny module store: the `Composer` reads and
 * writes it, `addToDraft` puts a quote on top of a day's draft, and Today's midnight rule asks `hasDraft(shownDate)` (and
 * re-asks on `subscribeDrafts`) so the page never rolls past words that are still being written. In memory only, like the
 * module-private `drafts` of `JournalDaySection.tsx` it replaces: a reload starts with no drafts.
 */
const drafts = new Map<string, string>();
const listeners = new Set<() => void>();

/** The day's unsaved words ('' when none). */
export const getDraft = (date: string): string => drafts.get(date) ?? '';

/** True when the day's draft has something in it after trimming. */
export const hasDraft = (date: string): boolean => getDraft(date).trim().length > 0;

/** Replaces the day's draft and tells every subscriber (an empty text removes it). */
export const setDraft = (date: string, text: string): void => {
  if (getDraft(date) === text) return;
  if (text) drafts.set(date, text);
  else drafts.delete(date);
  for (const cb of [...listeners]) cb();
};

/** Called after any draft changes; returns the unsubscribe. */
export const subscribeDrafts = (cb: () => void): (() => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
