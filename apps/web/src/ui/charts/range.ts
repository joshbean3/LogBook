import { daysBetween, fmtDate, shiftDays, type ISODate } from '@logbook/shared';

/** The range control's spans: `< 1M 3M 6M 1Y >`. */
export type RangeKey = '1M' | '3M' | '6M' | '1Y';
export const RANGE_KEYS: readonly RangeKey[] = ['1M', '3M', '6M', '1Y'];
export const RANGE_DAYS: Record<RangeKey, number> = { '1M': 30, '3M': 91, '6M': 182, '1Y': 365 };
export const RANGE_NAMES: Record<RangeKey, string> = { '1M': '1 month', '3M': '3 months', '6M': '6 months', '1Y': '1 year' };

export interface RangeWindow {
  from: ISODate;
  to: ISODate;
  days: number;
  /** Every day from `from` to `to`, oldest first. */
  dates: ISODate[];
}

/**
 * The days a range shows. `offset` steps back whole spans: 0 ends today, 1 is the span before it. A window never ends
 * after today.
 */
export const rangeWindow = (today: ISODate, key: RangeKey, offset = 0): RangeWindow => {
  const days = RANGE_DAYS[key];
  const to = shiftDays(today, -Math.max(0, offset) * days);
  const from = shiftDays(to, -(days - 1));
  return { from, to, days, dates: Array.from({ length: days }, (_, i) => shiftDays(from, i)) };
};

/** "Oct 10 – Nov 8", with the year on both ends when the window is not in this year. */
export const windowLabel = (w: Pick<RangeWindow, 'from' | 'to'>, today: ISODate) => {
  const sameYear = w.from.slice(0, 4) === today.slice(0, 4) && w.to.slice(0, 4) === today.slice(0, 4);
  const d = (x: ISODate) => (sameYear ? fmtDate('md', x) : `${fmtDate('md', x)}, ${x.slice(0, 4)}`);
  return `${d(w.from)} – ${d(w.to)}`;
};

/** How many spans back the oldest data allows (so `<` stops where the log starts). */
export const maxOffset = (today: ISODate, key: RangeKey, earliest: ISODate | null) => {
  if (!earliest || earliest >= today) return 0;
  return Math.max(0, Math.floor(daysBetween(earliest, today) / RANGE_DAYS[key]));
};
