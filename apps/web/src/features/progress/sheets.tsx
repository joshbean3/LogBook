import { fmtDate, mi, mondayOf, monthsBetween, num, shiftDays, weekSummary } from '@logbook/shared';
import { CalendarDays } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { useNav } from '@/app/NavController';
import { EmptyState, Group, Row, Stat, StatStrip, useSheet, WeekRing } from '@/ui';
import { ringDays, streakLine } from '../day/dayWords';
import { useLog } from '../log/useLog';
import { weekMiles } from '../sessions/miles';
import { plural, weekTitle, Words } from './data';
import './progress.css';

const up = (s: string) => s.toUpperCase();
const md = (d: string) => fmtDate('md', d);

// ---------- the week ----------
/**
 * The week: the app's one week sheet, behind a mileage bar in the progress strip and the week ring on Today. The ring,
 * miles and runs against the plan, the streak in weeks ("7 of the last 8 weeks.") on this week, and one row that opens the
 * week in Plan (the day list lives there, so the sheet never repeats it).
 */
export const WeekSheet = ({ w, today, onGone }: { w: string; today: string; onGone?: () => void }) => {
  const gone = useRef(onGone);
  useEffect(() => () => gone.current?.(), []);
  const current = w === mondayOf(today);
  // this week's streak looks back eight weeks: load those months too
  const months = useMemo(() => monthsBetween(current ? shiftDays(w, -7 * 8) : w, shiftDays(w, 6)), [w, current]);
  const log = useLog(months);
  const nav = useNav();
  const sum = weekSummary(log.snap, w);
  // miles run count a run marked Done without Strava at its planned miles (contract 5)
  const ran = weekMiles(log.snap, w, today);
  const streak = current ? streakLine(log.snap, today) : null;
  const future = w > mondayOf(today);
  const training = sum.days.reduce((n, d) => n + log.snap.sessionsOn(d.date).filter((s) => s.kind !== 'rest').length, 0);
  // a week ahead with nothing in it is an invitation, never "0 runs planned / 0 mi"
  if ((future || current) && !training && ran.runs === 0)
    return (
      <div className="pg-sheet">
        <EmptyState
          verb={{
            label: 'Plan a week',
            primary: true,
            // a jump closes the sheet itself (nav.go closes overlays first) and cuts to Plan at that week
            onPress: () => nav.go(`/plan/week/${w}`),
          }}
        >
          Nothing planned yet. Lay out the runs and this week fills in as you do them.
        </EmptyState>
      </div>
    );
  // a week with nothing run yet leads with its plan, never with a zero
  const ahead = future || (current && ran.miles === 0 && ran.runs === 0 && sum.plannedMiles > 0);
  const ti = current ? sum.days.findIndex((d) => d.date === today) : undefined;
  const keptLine = future
    ? sum.runsPlanned
      ? `${sum.runsPlanned} ${plural(sum.runsPlanned, 'run')} planned.`
      : `${training} ${plural(training, 'session')} planned.`
    : sum.kept
      ? 'Week kept.'
      : current
        ? `${Words(Math.max(0, sum.target - sum.keptSessions))} more ${plural(sum.target - sum.keptSessions, 'session keeps', 'sessions keep')} it.`
        : `${sum.keptSessions ? Words(sum.keptSessions) : 'None'} of the ${sum.target} ${plural(sum.target, 'session', 'sessions')} that keep a week.`;
  // the seven days live in Plan (the same list, with drag): one row takes you there instead of repeating it
  const openInPlan = () => nav.go(`/plan/week/${w}`);
  return (
    <div className="pg-sheet">
      <div className="pg-week-top">
        {/* the numeral is the sentence's number: the sessions that keep the week, never the runs (the Runs stat says those) */}
        <WeekRing days={ringDays(sum, today)} size={64} today={ti != null && ti >= 0 ? ti : undefined} onceADay={null}>
          {future ? '' : sum.keptSessions || ''}
        </WeekRing>
        <div className="pg-week-words">
          <p className="pg-week-line">{keptLine}</p>
          {streak ? <p className="pg-week-streak">{streak}</p> : null}
        </div>
      </div>
      <StatStrip className="stat-row">
        {ahead ? (
          <>
            {sum.plannedMiles ? <Stat label="Planned" value={num(sum.plannedMiles)} unit="mi" delta={current ? { text: 'None run yet' } : undefined} /> : null}
            {sum.runsPlanned ? <Stat label="Runs" value={sum.runsPlanned} delta={current ? { text: 'Planned' } : undefined} /> : null}
          </>
        ) : ran.miles > 0 || ran.runs ? (
          <>
            <Stat label="Miles" value={mi(ran.miles)} unit="mi" delta={sum.plannedMiles ? { text: `of ${num(sum.plannedMiles)} planned` } : ran.logged ? { text: 'Logged by hand' } : undefined} />
            <Stat label="Runs" value={ran.runs} delta={sum.runsPlanned ? { text: `${sum.runsDone} of ${sum.runsPlanned} planned` } : undefined} />
          </>
        ) : null}
      </StatStrip>
      <Group>
        <Row left={<CalendarDays size={18} className="pg-row-icon" aria-hidden="true" />} title="Open this week in Plan" onClick={openInPlan} label="Open this week in Plan" />
      </Group>
    </div>
  );
};

/** Open the week sheet. */
export const useOpenWeek = (today: string) => {
  const sheet = useSheet();
  return (w: string, how: 'open' | 'push' = 'open', onGone?: () => void) =>
    sheet[how]({ title: weekTitle(w, today), eyebrow: `${up(md(w))} – ${up(md(shiftDays(w, 6)))}`, body: <WeekSheet w={w} today={today} onGone={onGone} />, wide: true });
};
