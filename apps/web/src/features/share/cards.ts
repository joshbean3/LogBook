import { clock, fmtDate, mi, type ISODate } from '@logbook/shared';

/**
 * What a day shares. The cards carousel is gone (docs/system.md): one Share action hands the system share sheet a text
 * summary built from this.
 */
export type ShareDayType = 'run' | 'lift' | 'rest' | 'journal';
/** Accepted from old callers (`initial`); nothing is drawn from it any more. */
export type Template = 'stamp' | 'route' | 'marker' | 'day' | 'bubble' | 'week';

export interface ShareDay {
  date: ISODate;
  miles: number;
}
export interface ShareData {
  /** The run's name ("Morning Run"), or the plan's label when there is no single activity. */
  name: string;
  /** The plan's label ("Easy 6"); null when the run was unplanned. */
  label: string | null;
  /** The day's verdict in the brand voice: "Floor held." / "Easy 6, done." / "6.0 mi, off the plan." */
  verdict: string;
  date: ISODate;
  /** `HH:MM` start, when the run carries one. */
  time: string | null;
  miles: number;
  movingSec: number;
  elevFt: number;
  avgHr: number | null;
  polyline: string | null;
  week: { monday: ISODate; days: ShareDay[]; total: number; planned: number } | null;
  /** The kind of day (default: a run when it has miles, else rest). */
  dayType?: ShareDayType;
  /** Habits lit that day, when there are habits. */
  habits?: { lit: number; of: number } | null;
  /** The day's own words: its latest journal entry, cut to fit. */
  journal?: string | null;
  /** A lift day: how many sets, and the best one ("Squat 225 × 5"). */
  lift?: { sets: number; top: string | null } | null;
}

/** The day type, read from the data (old callers set none). */
export const dayTypeOf = (d: ShareData): ShareDayType => d.dayType ?? (d.miles > 0 ? 'run' : 'rest');

/** The pace as a stamp: `8'14''`. */
export const paceStamp = (movingSec: number, miles: number): string => (miles > 0.1 && movingSec ? `${clock(movingSec / miles).replace(':', "'")}''` : "—'—''");

/** The share, in words: the name, the numbers that exist, the verdict, the week so far. */
export const shareText = (d: ShareData): string => {
  const type = dayTypeOf(d);
  const lines: string[] = [`${d.name} · ${fmtDate('long', d.date)}`];
  if (type === 'run' && d.miles > 0) {
    const bits = [`${mi(d.miles)} mi`];
    if (d.movingSec) bits.push(clock(d.movingSec), `${paceStamp(d.movingSec, d.miles)} /mi`);
    if (d.elevFt) bits.push(`${Math.round(d.elevFt)} ft up`);
    if (d.avgHr != null) bits.push(`${d.avgHr} bpm`);
    lines.push(bits.join(' · '));
  } else if (type === 'lift' && d.lift) lines.push(`${d.lift.sets} ${d.lift.sets === 1 ? 'set' : 'sets'}${d.lift.top ? ` · ${d.lift.top}` : ''}`);
  if (d.verdict.trim()) lines.push(d.verdict.trim());
  if (d.habits?.of) lines.push(`${d.habits.lit} of ${d.habits.of} habits`);
  if (d.week && d.week.total > 0) lines.push(`This week: ${mi(d.week.total)} mi${d.week.planned ? ` of ${mi(d.week.planned)} planned` : ''}`);
  if (d.journal) lines.push(`“${d.journal}”`);
  return lines.join('\n');
};
