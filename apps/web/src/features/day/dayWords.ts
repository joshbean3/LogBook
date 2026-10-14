import { clock, KIND_WORD, mi, num, shiftDays, weekStreak, type Activity, type DayPhase, type ISODate, type PhaseSession, type Snapshot, type WeekSummary } from '@logbook/shared';
import type { WeekDayStatus } from '@/ui';

/** "7:35" without the AM: the hero is a morning, the clock face is enough. */
export const shortClock = (m: number) => {
  const v = ((Math.round(m) % 1440) + 1440) % 1440;
  const h = Math.floor(v / 60);
  return `${h % 12 || 12}:${String(v % 60).padStart(2, '0')}`;
};

/** The header's serif word for a day: the lead session's name (Speed, Easy, Strength), Rest, or Run for a run off the plan. */
export const dayTitleWord = (ph: DayPhase | null, runs: Activity[]): string => {
  const p = ph?.training[0] ?? ph?.primary ?? null;
  if (p) return p.session.kind === 'rest' ? 'Rest' : p.session.type || KIND_WORD[p.session.kind];
  if (runs.length) return 'Run';
  return ph ? 'Rest' : 'Today';
};

/** The runs of a day added up: miles, moving time, pace per mile ("8:14"). */
export const runTotals = (runs: Activity[]) => {
  const miles = runs.reduce((t, a) => t + a.miles, 0);
  const sec = runs.reduce((t, a) => t + a.movingSec, 0);
  return { miles, sec, pace: miles > 0.1 && sec ? clock(sec / miles) : null };
};

/** The sentence under a finished session: "5.0 mi at 8:14. Logged." / "Floor met. 20 min is a day kept." */
export const doneVerdict = (p: PhaseSession | null, runs: Activity[]): string => {
  const t = runTotals(runs);
  const floor = p?.key === 'floor';
  if (t.miles > 0) return `${mi(t.miles)} mi${t.pace ? ` at ${t.pace}` : ''}. ${floor ? 'Floor met.' : 'Logged.'}`;
  if (floor) return 'Floor met. 20 min is a day kept.';
  if (p?.session.kind === 'lift') return 'Lifted. Logged.';
  return 'Done. Logged.';
};

/** One line that says what the plan asks: "5 mi · floor 20 min easy". */
export const planLine = (s: PhaseSession['session'], floor: string): string => {
  const bits: string[] = [];
  if (s.kind === 'run' && s.miles) bits.push(`${num(s.miles)} mi`);
  else if (s.minutes) bits.push(`${s.minutes} min`);
  if (s.details) bits.push(s.details);
  if (floor) bits.push(`floor ${floor}`);
  return bits.join(' · ');
};

/** The WeekRing's seven statuses for the week around `date`. Today's open segment reads `open`. */
export const ringDays = (sum: WeekSummary, today: ISODate): WeekDayStatus[] =>
  sum.days.map((d) => {
    if (d.status === 'skipped') return 'skipped';
    if (d.ring === 'future') return d.date === today ? 'open' : 'future';
    return d.ring;
  });

/** The week in one line, forward-looking, never a zero headline. */
export const weekHeadline = (sum: WeekSummary, today: ISODate): string => {
  const inWeek = today >= sum.weekStart && today <= shiftDays(sum.weekStart, 6);
  const planned = sum.plannedMiles;
  if (sum.doneMiles > 0) return planned ? `${mi(sum.doneMiles)} of ${num(planned)} mi.` : `${mi(sum.doneMiles)} mi run.`;
  if (!planned) return sum.runsPlanned ? `${sum.runsPlanned} runs planned.` : 'A week to fill.';
  if (inWeek) {
    const next = sum.days.find((d) => d.date >= today && d.ring === 'future');
    return next?.date === today ? `${num(planned)} mi planned. First run today.` : `${num(planned)} mi planned.`;
  }
  return sum.weekStart > today ? `${num(planned)} mi planned.` : `${num(planned)} mi were planned.`;
};

/** "7 of the last 8 weeks." / "3 weeks in a row." Null when there is nothing kind and true to say yet. */
export const streakLine = (snap: Snapshot, today: ISODate): string | null => {
  const s = weekStreak(snap, today);
  if (s.ofLast.total >= 2 && s.ofLast.kept > 0 && s.ofLast.kept < s.ofLast.total) return `${s.ofLast.kept} of the last ${s.ofLast.total} weeks.`;
  if (s.weeks >= 2) return `${s.weeks} weeks in a row.`;
  if (s.weeks === 1) return 'Last week kept.';
  return null;
};
