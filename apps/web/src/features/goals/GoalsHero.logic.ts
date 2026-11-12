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

/** The evening, when the page offers tomorrow's goal under the poster: from 5 pm. `minutes` after local midnight. */
export const eveningNow = (minutes: number): boolean => minutes >= 17 * 60;
