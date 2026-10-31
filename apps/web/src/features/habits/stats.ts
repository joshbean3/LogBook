import { habitStreak, shiftDays, type ISODate } from '@logbook/shared';

/** The window every habit is read over: the habit sheet's grid and the Habits tab's mini grids and streak lines. */
export const WINDOW_DAYS = 30;

export interface HabitWindow {
  /** The window's days, oldest first, ending on today. */
  days: ISODate[];
  /** The days of the window the habit existed on (`createdOn` or later). */
  since: ISODate[];
  /** Lit days among `since`. */
  lit: number;
  /** Today's streak (yesterday's when today is not lit yet), not bounded by the window. */
  streak: number;
  /** The longest run of lit days inside the window. */
  best: number;
  /** One cell per day of the window: lit, and whether the day is before the habit existed. */
  cells: Array<{ date: ISODate; on: boolean; before: boolean; today: boolean }>;
}

/**
 * A habit's last `n` days (ending on `today`) as the sheet and the Streaks list read them: the cells of the grid, "N of M"
 * counting only the days the habit existed, the streak (`habitStreak`: a day not yet lit today keeps yesterday's run) and
 * the best run of the window.
 */
export const habitWindow = (isDone: (date: ISODate) => boolean, today: ISODate, createdOn: ISODate, n = WINDOW_DAYS): HabitWindow => {
  const from = shiftDays(today, -(n - 1));
  const days = Array.from({ length: n }, (_, i) => shiftDays(from, i));
  const since = days.filter((d) => d >= createdOn);
  let best = 0;
  let run = 0;
  let lit = 0;
  for (const d of since) {
    const on = isDone(d);
    if (on) lit++;
    run = on ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return {
    days,
    since,
    lit,
    streak: habitStreak(isDone, today),
    best,
    cells: days.map((d) => ({ date: d, on: isDone(d), before: d < createdOn, today: d === today })),
  };
};

/**
 * The Streaks list's sub line in two parts: the streak (`12-day streak`; a habit with no run yet says so, or its best run
 * when it had one) and the count (`24 of 30`, empty until a day is lit). Joined with ` · `; the count drops where it cannot fit.
 */
export const streakParts = (w: HabitWindow): { streak: string; count: string } => ({
  streak: w.streak > 0 ? `${w.streak}-day streak` : w.best >= 2 ? `Best ${w.best} days` : 'No streak yet',
  count: w.lit > 0 ? `${w.lit} of ${w.since.length}` : '',
});
export const streakLine = (w: HabitWindow): string => {
  const p = streakParts(w);
  return p.count ? `${p.streak} · ${p.count}` : p.streak;
};
