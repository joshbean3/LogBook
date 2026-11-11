import { type JournalEntry } from '@logbook/shared';

const MONTH = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' });
const MONTH_YEAR = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** A month's name as the entry list titles it: "October" this year, "November 2025" in any other. */
export const monthLabel = (month: string, today: string): string => {
  const d = new Date(`${month}-15T12:00:00Z`);
  return (month.slice(0, 4) === today.slice(0, 4) ? MONTH : MONTH_YEAR).format(d);
};

export interface EntryMonth<E> {
  /** `YYYY-MM` */
  month: string;
  label: string;
  entries: E[];
}

/**
 * The entry list's months, newest first (layout standard 2.8: one group per month). The entries keep the order they come
 * in (the server's: newest day first, newest entry first within a day); a month starts wherever the month changes.
 */
export const groupByMonth = <E extends Pick<JournalEntry, 'date'>>(entries: E[], today: string): EntryMonth<E>[] => {
  const out: EntryMonth<E>[] = [];
  for (const e of entries) {
    const month = e.date.slice(0, 7);
    const last = out[out.length - 1];
    if (last && last.month === month) last.entries.push(e);
    else out.push({ month, label: monthLabel(month, today), entries: [e] });
  }
  return out;
};
