import { counts, mondayOf, sessionStatus, shiftDays, weekSummary, type ISODate, type Snapshot, type WeekSummary } from '@logbook/shared';
import { ChevronRight } from 'lucide-react';
import type * as React from 'react';
import { memo, useMemo } from 'react';
import { Row } from '@/ui/primitives';
import { WeekRing } from '@/ui/WeekRing';
import type { Log } from '../log/useLog';
import { useOpenWeek } from '../progress/sheets';
import { ringDays } from './dayWords';
import { milesText } from './faces';
import { useIsLive } from './live';

const D = (s: string) => new Date(`${s}T12:00:00Z`);
/** The ISO week of a day: its number and its ISO year ('2026-W43'). */
export const isoWeek = (date: ISODate): { year: number; week: number; key: string } => {
  const d = D(date);
  const thu = new Date(d.getTime() + (3 - ((d.getUTCDay() + 6) % 7)) * 86_400_000);
  const year = thu.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4, 12));
  // week 1 is the one with January 4th in it: count Thursdays from that week's Thursday
  const thu1 = jan4.getTime() + (3 - ((jan4.getUTCDay() + 6) % 7)) * 86_400_000;
  const week = 1 + Math.round((thu.getTime() - thu1) / (7 * 86_400_000));
  return { year, week, key: `${year}-W${String(week).padStart(2, '0')}` };
};
const weekdayLong = (s: string) => new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(D(s));

/** The row's one line: the week's long run still to come, else whether the week was kept. */
export const weekNote = (snap: Snapshot, sum: WeekSummary, date: ISODate, today: ISODate): string => {
  const from = date > today ? date : today;
  for (const d of sum.days) {
    if (d.date < from) continue;
    const long = snap.sessionsOn(d.date).find((s) => s.kind === 'run' && /long/i.test(s.type ?? s.title ?? '') && s.mark !== 'skip' && s.mark !== 'sick' && s.mark !== 'done');
    if (long) return d.date === today ? 'Long run today.' : `Long run ${weekdayLong(d.date)}.`;
  }
  if (sum.runsPlanned > 0 && sum.runsDone >= sum.runsPlanned) return 'Every run done.';
  if (sum.kept) return 'Week kept.';
  if (sum.weekStart < mondayOf(today)) return `${sum.keptSessions} of ${sum.target} kept.`;
  // sessions, not days: each training session from today on that is neither marked nor already counted (a run Strava
  // matched, a lift with its sets in), so the line agrees with the runs count above it
  const left = sum.days.filter((d) => d.date >= today).reduce((n, d) => n + snap.sessionsOn(d.date).filter((s) => s.kind !== 'rest' && s.mark == null && !counts(sessionStatus(snap, d.date, s))).length, 0);
  return left ? `${left} ${left === 1 ? 'session' : 'sessions'} to go.` : 'Nothing left this week.';
};

/** The week's words: `8 of 20 mi · 3 of 4 runs`, or `Nothing planned`. */
export const weekStats = (sum: WeekSummary): string => {
  const ran = Math.round(sum.doneMiles * 10) / 10;
  const plan = Math.round(sum.plannedMiles * 10) / 10;
  const parts = [plan > 0 ? `${milesText(ran)} of ${milesText(plan)} mi` : ran > 0 ? `${milesText(ran)} mi` : null, sum.runsPlanned > 0 ? `${sum.runsDone} of ${sum.runsPlanned} runs` : null].filter((x): x is string => !!x);
  return parts.join(' · ') || 'Nothing planned';
};

/**
 * The week (docs/system.md §2): one 60 row on every day page, the shown day marked on a 40 px `WeekRing` at the left (a
 * missed day a quiet gap, never red), `Week 44` over `8 of 20 mi · 3 of 4 runs`. Tap → the week sheet. The ring fills once
 * a day on the live page; nothing else plays here.
 */
export const WeekRow = memo(function WeekRow({ date, log }: { date: ISODate; log: Log }): React.JSX.Element {
  const openWeek = useOpenWeek(log.today);
  const live = useIsLive(date);
  const mon = mondayOf(date);
  const sum = useMemo(() => weekSummary(log.snap, mon), [log.snap, mon]);
  const wk = isoWeek(date);
  const stats = weekStats(sum);
  const note = weekNote(log.snap, sum, date, log.today);
  const days = ringDays(sum, log.today);
  const marked = Math.round((D(date).getTime() - D(mon).getTime()) / 86_400_000);
  const ti = sum.days.findIndex((d) => d.date === log.today);
  const current = mon === mondayOf(log.today);
  return (
    <Row
      className="week-row"
      data-week={wk.key}
      left={
        <span className="week-ring">
          <WeekRing key={live ? 'live' : 'still'} days={days} size={40} marked={marked} today={ti >= 0 ? ti : undefined} onceADay={live && current ? 'week-row-ring' : null} />
        </span>
      }
      title={`Week ${wk.week}`}
      sub={stats}
      right={<ChevronRight size={16} className="lrow-chev" aria-hidden="true" />}
      onClick={() => openWeek(mon)}
      label={`Week ${wk.week}: ${stats}. ${note} Open the week`}
    />
  );
});

/** The week a day sits in, Monday first (for tests and the strip). */
export const weekOf = (date: ISODate) => Array.from({ length: 7 }, (_, i) => shiftDays(mondayOf(date), i));
