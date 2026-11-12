import { addMonths, isISODate, mondayOf, monthOf, monthStart, shiftDays } from '@logbook/shared';

/*
 * Where Fitness stands: the week or the month a URL asks for, and the week the month view goes back to. Pure, so the
 * page's two anchors (the Monday, the first of the month) can be tested without the page.
 */

/** The month a week belongs to: its Thursday's (ISO weeks). */
export const monthOfWeek = (mon: string) => monthStart(shiftDays(mon, 3));
/** The first week that belongs to a month: the one whose Thursday falls in it. */
export const firstWeekOf = (first: string) => (shiftDays(mondayOf(first), 3) >= first ? mondayOf(first) : shiftDays(mondayOf(first), 7));

/**
 * The dates the pages can draw. A date string holds four-digit years only, and a year under 100 is read as 19xx: outside
 * this span a neighbour page's date (the month after December 9999) is not a date at all, and its caption throws. No
 * plan reaches either end; a URL that names one is a typo or a test.
 */
const FIRST_DAY = '1970-01-05';
const LAST_DAY = '2199-12-01';
const inReach = (d: string | undefined): d is string => !!d && isISODate(d) && d >= FIRST_DAY && d <= LAST_DAY;

export interface PlanPlace {
  view: 'week' | 'month';
  mon: string;
  first: string;
}
/** A Fitness URL's params as the page's state. Anything that is not a date the pages can draw opens this week. */
export const fromParams = (p: Readonly<Record<string, string>>, today: string): PlanPlace => {
  if (inReach(p.month)) return { view: 'month', first: p.month, mon: monthOf(p.month) === monthOf(today) ? mondayOf(today) : firstWeekOf(p.month) };
  const mon = inReach(p.mon) ? p.mon : mondayOf(today);
  return { view: 'week', mon, first: monthOfWeek(mon) };
};

/**
 * The week to show when the month view goes back to the week: the week that was left, while the month in view still holds
 * one of its days (in and straight back out is the same week, whichever it was). Once the month has been paged away from
 * it: this week in this month, any other month's first week.
 */
export const weekForMonth = (first: string, left: string, today: string): string => {
  const touches = shiftDays(left, 6) >= first && left < addMonths(first, 1);
  if (touches) return left;
  return monthOf(first) === monthOf(today) ? mondayOf(today) : firstWeekOf(first);
};

/**
 * Midnight passed while Fitness was open (the phone keeps the app alive overnight): a page that was on this week is on
 * the new this week, and one on this month on the new this month. A page on any other week or month stays where it is.
 * `was` and `now` are this week's Monday and this month's first before and after. The same object when nothing moves.
 */
export const followToday = <P extends { mon: string; first: string }>(place: P, was: { mon: string; first: string }, now: { mon: string; first: string }): P => {
  const mon = place.mon === was.mon ? now.mon : place.mon;
  const first = place.first === was.first ? now.first : place.first;
  return mon === place.mon && first === place.first ? place : { ...place, mon, first };
};
