import { addMonths, fmtDate, monthStart, parseISO, shiftDays, type ISODate, type JournalEntry } from '@logbook/shared';

/**
 * The Journal's calendar: pure helpers for the Week and Month views, the orb a day wears, and the words a day is read with.
 *
 * A page has an anchor date. Week is seven days ending on its anchor (so on a Monday it still shows the week just lived,
 * with today at its right end); Month is the calendar month holding its anchor, in rows starting on Monday.
 */

export type CalView = 'week' | 'month';

/**
 * The brand's orb (`@/ui/Orb`) in its palettes, one per kind of day:
 *   sky    one memory (Columbia and ice)
 *   dusk   two (rose and periwinkle)
 *   tide   three or more (navy and blue)
 *   sun    a starred memory that day, whatever the count (gold and orange, the warm heart of the mark)
 *   brand  today, the full mix (the calendar's live orb)
 */
export type OrbVariant = 'brand' | 'sun' | 'sky' | 'dusk' | 'tide';
export const ORB_KEY: ReadonlyArray<{ v: OrbVariant; label: string }> = [
  { v: 'sky', label: '1' },
  { v: 'dusk', label: '2' },
  { v: 'tide', label: '3+' },
  { v: 'sun', label: 'Starred' },
];

/** The palette for a day's memories; null for a day with none. */
export const orbVariant = (entries: readonly Pick<JournalEntry, 'fav'>[] | undefined): OrbVariant | null => {
  const n = entries?.length ?? 0;
  if (!n) return null;
  if (entries!.some((e) => e.fav)) return 'sun';
  return n === 1 ? 'sky' : n === 2 ? 'dusk' : 'tide';
};

/** The seven days ending on `d`, oldest first. */
export const weekDays = (d: ISODate): ISODate[] => Array.from({ length: 7 }, (_, i) => shiftDays(d, i - 6));

/** The month holding `d` as rows of seven, Monday first; days of the months either side are null. */
export const monthGrid = (d: ISODate): (ISODate | null)[] => {
  const first = monthStart(d);
  const lead = (parseISO(first).getDay() + 6) % 7;
  const out: (ISODate | null)[] = Array.from({ length: lead }, () => null);
  for (let x = first; x.slice(0, 7) === first.slice(0, 7); x = shiftDays(x, 1)) out.push(x);
  while (out.length % 7) out.push(null);
  return out;
};

const lastOfMonth = (d: ISODate): ISODate => shiftDays(addMonths(d, 1), -1);

/** One page back or on: seven days, or a month (its first day). */
export const pageBy = (anchor: ISODate, view: CalView, dir: -1 | 1): ISODate => (view === 'week' ? shiftDays(anchor, 7 * dir) : addMonths(anchor, dir));

/** Whether the page anchored at `anchor` holds `d`. */
export const pageHolds = (anchor: ISODate, view: CalView, d: ISODate): boolean => (view === 'week' ? d <= anchor && d >= shiftDays(anchor, -6) : anchor.slice(0, 7) === d.slice(0, 7));

/** The anchor of a page that shows `d`: for a week, `d` sits near the middle (today stays the right end). */
export const anchorFor = (d: ISODate, view: CalView, today: ISODate): ISODate => {
  if (view === 'month') return d;
  const mid = shiftDays(d, 3);
  return d <= today && mid > today ? today : mid;
};

/**
 * The anchor when the view changes: the new page holds today if the old one did, else the open day if the old one held
 * it, else the same stretch of time (a month's last day for a week, a week's last day for a month).
 */
export const switchAnchor = (anchor: ISODate, from: CalView, to: CalView, today: ISODate, open: ISODate | null): ISODate => {
  if (pageHolds(anchor, from, today)) return today;
  if (open && pageHolds(anchor, from, open)) return anchorFor(open, to, today);
  if (to === 'week') {
    const end = lastOfMonth(anchor);
    return end > today && anchor <= today ? today : end;
  }
  return anchor;
};

/** The page's name: `November 2026`, or `Nov 3 to 9` (`Oct 30 to Nov 5` across months). */
export const pageTitle = (anchor: ISODate, view: CalView): string => {
  if (view === 'month') return fmtDate('month', anchor);
  const start = shiftDays(anchor, -6);
  const end = start.slice(0, 7) === anchor.slice(0, 7) ? String(parseISO(anchor).getDate()) : fmtDate('md', anchor);
  return `${fmtDate('md', start)} to ${end}`;
};

/** A day cell's name for VoiceOver: `Monday, November 9, 2 memories`. */
export const dayLabel = (d: ISODate, n: number): string => `${fmtDate('long', d)}, ${n === 0 ? 'no memories' : n === 1 ? '1 memory' : `${n} memories`}`;

/** The day card's title: Today, Yesterday, else `Monday, November 2`. */
export const dayTitle = (d: ISODate, today: ISODate): string => (d === today ? 'Today' : d === shiftDays(today, -1) ? 'Yesterday' : fmtDate('long', d));

// ---------- the view, remembered on this device ----------
const VIEW_KEY = 'logbook.journal.calView';
export const readView = (): CalView => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'month' ? 'month' : 'week';
  } catch {
    return 'week';
  }
};
export const saveView = (v: CalView) => {
  try {
    localStorage.setItem(VIEW_KEY, v);
  } catch {
    /* private mode: the choice lasts for this session */
  }
};
