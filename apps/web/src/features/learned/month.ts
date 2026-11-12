import { addMonths, shiftDays, type Learning } from '@logbook/shared';

export interface MonthDay {
  date: string;
  items: Learning[];
}

/**
 * A month's page (layout plan 2.3 LM1): only the days with something kept, newest first, each with its learnings in the
 * order they were written; empty days are left out (the date gutter shows the jump). The one exception is a day in the last
 * week (`fillFrom` to today) with nothing in it: it stays, as the way to fill that day in. A month still to come has none
 * (and no day after today is ever offered to fill in).
 */
export const monthDays = (month: string, today: string, rows: readonly Learning[], fillFrom: string = today): MonthDay[] => {
  const first = `${month}-01`;
  const last = shiftDays(addMonths(first, 1), -1);
  const by = new Map<string, Learning[]>();
  for (const r of rows) if (typeof r?.date === 'string' && r.date >= first && r.date <= last) by.set(r.date, [...(by.get(r.date) ?? []), r]);
  // a line dated after today (the phone went back a time zone since it was written) is still a line of this month: the
  // days run from the newest one kept, or from today, whichever is later
  const newest = [...by.keys()].sort().pop() ?? '';
  const now = last < today ? last : today;
  const end = newest > now ? newest : now;
  const out: MonthDay[] = [];
  for (let d = end; d >= first; d = shiftDays(d, -1)) {
    const items = by.get(d);
    if (items) out.push({ date: d, items: items.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0)) });
    else if (d >= fillFrom && d <= today) out.push({ date: d, items: [] });
  }
  return out;
};

/** The months before and after `month` that have something in them (from the archive's list), or null where there is none. */
export const neighbours = (months: readonly { month: string }[], month: string) => {
  const older = months.filter((m) => m.month < month).map((m) => m.month).sort().pop() ?? null;
  const newer = months.filter((m) => m.month > month).map((m) => m.month).sort()[0] ?? null;
  return { older, newer };
};
