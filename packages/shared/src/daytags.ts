import { z } from 'zod';
import { shiftDays, type ISODate } from './dates.js';

/**
 * Day tags (the Journal's day page): a few yes-or-no questions about the day (alcohol, late screens, reading, stretching,
 * and any the owner adds), stored per day. Once a tag has enough yes days and enough no days, its effect on how hard the
 * next day's run felt (the session's `effort`, 1 to 10) is shown; never before, and never a made-up number.
 */
export interface DayTagDef {
  id: string;
  label: string;
}

/** The four every account starts with. */
export const DEFAULT_DAY_TAGS: readonly DayTagDef[] = [
  { id: 'alcohol', label: 'Alcohol' },
  { id: 'late-screens', label: 'Late screens' },
  { id: 'reading', label: 'Reading' },
  { id: 'stretching', label: 'Stretching' },
];
export const DAY_TAG_MAX = 12;
export const DAY_TAG_LABEL_MAX = 24;
/** Yes days and no days a tag needs, each, before its effect is shown. */
export const DAY_TAG_MIN = 5;

/** A label as its id: `Late screens` → `late-screens`. Empty when nothing usable is left. */
export const dayTagId = (label: string) =>
  label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);

export const zDayTagLabel = z.string().trim().min(1).max(DAY_TAG_LABEL_MAX);
/** `PUT /journal/tags/:date`: mark one tag yes or no for the day, or clear it (null). */
export const zDayTagMark = z.object({ tag: z.string().min(1).max(32), value: z.boolean().nullable() });
/** `POST /journal/tags`: add a tag to the list. */
export const zDayTagAdd = z.object({ label: zDayTagLabel });

/** `GET /journal/tags/:date`: the list, and the day's marks (a tag left out is unmarked). */
export interface DayTagsDay {
  date: ISODate;
  tags: DayTagDef[];
  values: Record<string, boolean>;
}

export interface DayTagEffect {
  /** Average effort of the run the day after a yes day, and after a no day (1 to 10, one decimal). */
  yes: number;
  no: number;
}
export interface DayTagStat extends DayTagDef {
  /** Days marked yes, and no. */
  yes: number;
  no: number;
  /** Of those, the days followed by a run with an effort rating. */
  ratedYes: number;
  ratedNo: number;
  /** Set only once ratedYes and ratedNo both reach DAY_TAG_MIN. */
  effect: DayTagEffect | null;
}
/** `GET /journal/tags/stats`. `effort` is false while runs carry no effort ratings at all. */
export interface DayTagStats {
  tags: DayTagStat[];
  effort: boolean;
  min: number;
}

const avg1 = (xs: number[]) => Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;

/**
 * One tag's counts and effect, from its marks and the effort of each day's runs (a day with two rated runs counts their
 * average). A mark on day D is paired with the run on D + 1: the evening's glass or late screen shows in the next morning's
 * run. Pure, so it is tested without a database.
 */
export const dayTagStat = (def: DayTagDef, marks: ReadonlyArray<{ date: ISODate; value: boolean }>, effortByDate: ReadonlyMap<ISODate, number>): DayTagStat => {
  const yes: number[] = [];
  const no: number[] = [];
  let y = 0;
  let n = 0;
  for (const m of marks) {
    if (m.value) y++;
    else n++;
    const e = effortByDate.get(shiftDays(m.date, 1));
    if (e === undefined) continue;
    (m.value ? yes : no).push(e);
  }
  const effect = yes.length >= DAY_TAG_MIN && no.length >= DAY_TAG_MIN ? { yes: avg1(yes), no: avg1(no) } : null;
  return { ...def, yes: y, no: n, ratedYes: yes.length, ratedNo: no.length, effect };
};

/** The effect in words: `Runs after a yes day felt harder: 6.4 vs 5.1 effort.` */
export const dayTagEffectWords = (e: DayTagEffect) => {
  const d = Math.round((e.yes - e.no) * 10) / 10;
  if (Math.abs(d) < 0.3) return `No clear difference: ${e.yes} vs ${e.no} effort on the next day’s run.`;
  return `The next day’s run felt ${d > 0 ? 'harder' : 'easier'} after a yes: ${e.yes} vs ${e.no} effort.`;
};
