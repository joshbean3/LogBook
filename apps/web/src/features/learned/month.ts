import { addMonths, shiftDays, type Learning } from '@logbook/shared';

/**
 * A month's page as a grid of its days (docs/inspiration.md §6 Learned): every day from the last (or today, in the month
 * that is running) back to the 1st, each with its learnings in the order they were written, an empty day keeping its slot.
 */
export const monthGrid = (month: string, today: string, rows: readonly Learning[]): Array<{ date: string; items: Learning[] }> => {
  const first = `${month}-01`;
  if (first > today) return [];
  const last = shiftDays(addMonths(first, 1), -1);
  const end = last < today ? last : today;
  const by = new Map<string, Learning[]>();
  for (const r of rows) if (r.date.startsWith(`${month}-`)) by.set(r.date, [...(by.get(r.date) ?? []), r]);
  const out: Array<{ date: string; items: Learning[] }> = [];
  for (let d = end; d >= first; d = shiftDays(d, -1)) out.push({ date: d, items: (by.get(d) ?? []).sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0)) });
  return out;
};
