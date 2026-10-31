import { bestMile, clock, fmtDate, mi, type Activity, type ISODate } from '@logbook/shared';

/**
 * The records the progress strip lists (docs/system.md: rows, no medals): best mile, 5K and 10K, the longest run and the
 * biggest week. Pure over the run history and the weekly series; a record that does not exist is left out.
 */
export interface RecordRow {
  id: 'mile' | '5k' | '10k' | 'longest' | 'week';
  title: string;
  /** `6:42`, `13.1 mi` */
  value: string;
  unit?: string;
  /** `Morning Run · Oct 12` */
  sub: string;
  date: ISODate;
  run: Activity | null;
}

const md = (d: string) => fmtDate('md', d);
const paceOf = (a: Activity) => (a.miles > 0.2 && a.movingSec > 0 ? a.movingSec / a.miles : null);
/** The fastest run of at least `min` miles, by average pace. */
const fastestOver = (runs: Activity[], min: number) => {
  let best: { a: Activity; pace: number } | null = null;
  for (const a of runs) {
    const p = paceOf(a);
    if (a.miles >= min && p != null && (!best || p < best.pace)) best = { a, pace: p };
  }
  return best;
};

export const recordRows = (history: readonly Activity[], weeks: ReadonlyArray<{ w: ISODate; ran: number }>): RecordRow[] => {
  const runs = history.filter((a) => a.kind === 'run');
  const out: RecordRow[] = [];
  let mile: { a: Activity; sec: number } | null = null;
  for (const a of runs) {
    const m = bestMile(a);
    if (m && (!mile || m.sec < mile.sec)) mile = { a, sec: m.sec };
  }
  if (mile) out.push({ id: 'mile', title: 'Best mile', value: clock(mile.sec), sub: `${mile.a.name} · ${md(mile.a.date)}`, date: mile.a.date, run: mile.a });
  const k5 = fastestOver(runs, 3.1);
  if (k5) out.push({ id: '5k', title: 'Best 5K', value: clock(k5.pace * 3.1), sub: `${clock(k5.pace)} /mi over ${mi(k5.a.miles)} mi · ${md(k5.a.date)}`, date: k5.a.date, run: k5.a });
  const k10 = fastestOver(runs, 6.2);
  if (k10) out.push({ id: '10k', title: 'Best 10K', value: clock(k10.pace * 6.2), sub: `${clock(k10.pace)} /mi over ${mi(k10.a.miles)} mi · ${md(k10.a.date)}`, date: k10.a.date, run: k10.a });
  const longest = runs.reduce<Activity | null>((b, a) => (a.miles > 0 && (!b || a.miles > b.miles) ? a : b), null);
  if (longest) out.push({ id: 'longest', title: 'Longest run', value: mi(longest.miles), unit: 'mi', sub: `${longest.name} · ${md(longest.date)}`, date: longest.date, run: longest });
  const week = weeks.reduce<{ w: ISODate; ran: number } | null>((b, p) => (p.ran > 0 && (!b || p.ran > b.ran) ? p : b), null);
  if (week) out.push({ id: 'week', title: 'Biggest week', value: mi(week.ran), unit: 'mi', sub: `Week of ${md(week.w)}`, date: week.w, run: null });
  return out;
};
