/* The Goals poster's words, apart from the drawing so a test can read them. Pure. */

export interface TodayBand {
  /** The caps caption: "Today · 2 of 3 to-dos done". */
  label: string;
  /** The bold line: "Next: Renew passport". */
  words: string;
  /** What the sun and the marks on the horizon count. */
  total: number;
  done: number;
}

/**
 * The band under a set goal: the day's to-dos counted and the next one named. With no to-dos it counts the goal's own
 * steps; with neither it says so.
 */
export const todayBand = (todos: readonly { text: string; done: boolean }[], steps: readonly { text: string; done: boolean }[]): TodayBand => {
  const [list, noun] = todos.length ? [todos, 'to-dos'] : [steps, 'steps'];
  const total = list.length;
  if (!total) return { label: 'Today', words: 'No to-dos yet', total: 0, done: 0 };
  const done = list.filter((x) => x.done).length;
  const next = list.find((x) => !x.done);
  return { label: `Today · ${done} of ${total} ${noun} done`, words: next ? `Next: ${next.text}` : `All ${noun} done`, total, done };
};

/** The day's to-dos as the poster counts them: one with no words (a saved copy from another build may hold one) is left out. */
export const listed = <T extends { text: string }>(todos: readonly T[]): T[] => todos.filter((t) => typeof t.text === 'string' && t.text.trim() !== '');

/**
 * Minutes on the wall clock since `today` began, for the words that say when ("before lunch"). `now` is the page's own
 * clock (the day's midnight plus the minutes read from the wall), so this is right on the two days a year the clocks change.
 */
export const wallMinutes = (today: string, now: number): number => Math.max(0, Math.min(1439, Math.round((now - new Date(`${today}T00:00:00`).getTime()) / 60e3)));

/** The evening, when the page offers tomorrow's goal under the poster: from 5 pm. `minutes` after local midnight. */
export const eveningNow = (minutes: number): boolean => minutes >= 17 * 60;
