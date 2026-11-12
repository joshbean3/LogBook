import { isISODate, shiftDays } from '@logbook/shared';

/*
 * Where focus goes after a session was moved or added from a sheet (MoveSheet.tsx's `refocusMoved`): the lookup and the
 * decision, apart from the DOM so they can be tested against what the line of days draws (ui/poster PathStop).
 */

/** A session's row on the Fitness page: the stop that carries its id (`data-stop`), and the button inside it. */
export const STOP_ROW = (id: string) => `[data-stop="${id.replace(/["\\]/g, '\\$&')}"] .pth-main`;

/** How long the row is waited for: the write's render lands within a frame or two of the sheet's close. */
export const ROW_WAIT_MS = 600;

/**
 * - `row`: the session's stop is on the shown page.
 * - `wait`: its day is in the shown week and the row may still be on its way (the write renders after the sheet closes).
 * - `fold`: it did not come and the page has the "Earlier this week" row: the session is behind it (a day before today).
 * - `pager`: its day is not on the shown page (a move past Sunday), or it is today's (the card's own): the arrow keys page.
 */
export const focusAfterMove = (o: { pageMon: string | null | undefined; to: string; hasRow: boolean; hasFold: boolean; waited: number }): 'row' | 'wait' | 'fold' | 'pager' => {
  if (o.hasRow) return 'row';
  const inWeek = isISODate(o.pageMon) && o.to >= o.pageMon && o.to <= shiftDays(o.pageMon, 6);
  if (!inWeek) return 'pager';
  if (o.waited < ROW_WAIT_MS) return 'wait';
  return o.hasFold ? 'fold' : 'pager';
};
