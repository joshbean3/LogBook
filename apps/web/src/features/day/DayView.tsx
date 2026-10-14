import { EVENING_START, fmtDate, mondayOf, monthOf, shiftDays, type ISODate } from '@logbook/shared';
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ChipButton, DatePager, dateLine, Skeleton, SkeletonGroup, TabHeader, useSheet } from '@/ui';
import { OrbRow } from '../habits/OrbRow';
import { StravaPrimer, useStravaPrimer } from '../onboarding';
import { useLog } from '../log/useLog';
import { useOpenSession } from '../sessions/SessionCard';
import { TodayTodos } from '../todos/TodayTodos';
import { CloseDay } from './CloseDay';
import { dayTitleWord } from './dayWords';
import { Hero, phaseOf } from './Hero';
import { SetupCard } from './SetupCard';
import { useNowMinutes } from './useNow';
import { useStravaPull } from './useStravaPull';
import { CalendarSheet } from './Calendar';
import './day.css';

/** The shape of Today while the months load: the header's word, the hero, the orbs, two rows. */
const TodaySkeleton = () => (
  <SkeletonGroup label="Loading today">
    <Skeleton h={232} r="card" />
    <div className="orbs-skel">
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} circle h={56} />
      ))}
    </div>
  </SkeletonGroup>
);

/**
 * Today (docs/experience.md §5.1): the screen opened twice a day. Top to bottom: the header (date line, the day's word,
 * avatar), the time-aware hero (swipe it for other days), the habit orbs, the top three to-dos, and Close the day in the
 * evening. Nothing repeats the hero; every status word comes from `dayPhase` / `sessionWord`.
 */
export default function DayView() {
  const params = useParams();
  const nav = useNavigate();
  const sheet = useSheet();
  const base = useLog([]);
  const t = base.today;
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : t;
  const months = useMemo(() => [...new Set([monthOf(shiftDays(date, -7)), monthOf(date), monthOf(shiftDays(date, 7)), monthOf(mondayOf(date)), monthOf(shiftDays(date, 14))])], [date]);
  const log = useLog(months);
  const minutes = useNowMinutes();
  const openSession = useOpenSession(log);
  useStravaPull(!!log.strava?.connected);
  const primer = useStravaPrimer();
  const go = (d: ISODate) => nav(d === t ? '/today' : `/today/${d}`);
  const loaded = log.loaded(date) && !!log.boot;
  const ph = useMemo(() => (loaded ? phaseOf(log, date, minutes) : null), [loaded, log, date, minutes]);
  const isToday = date === t;
  const runs = log.snap.runsOn(date);

  // the first day: nothing planned around today, no runs, and no habits or no plan yet
  const around = useMemo(() => Array.from({ length: 22 }, (_, i) => shiftDays(t, i - 7)), [t]);
  const hasPlan = around.some((d) => log.snap.sessionsOn(d).length > 0);
  const hasRuns = around.some((d) => log.snap.activitiesOn(d).length > 0);
  const setup = loaded && isToday && !hasRuns && (!hasPlan || !log.habits.length) && !log.snap.journalOn(t).length;

  const openCalendar = () => sheet.open({ eyebrow: 'Go to a day', title: fmtDate('long', date), body: <CalendarSheet date={date} onPick={go} /> });
  const multi = (ph?.training.length ?? 0) > 1;
  const closeAtEnd = loaded && ((isToday && minutes >= EVENING_START && ph?.phase !== 'evening') || date < t);
  const showHabits = isToday || (date < t && log.habits.some((h) => h.createdOn <= date));

  return (
    <div className="page today">
      <TabHeader
        title={loaded && !setup ? dayTitleWord(ph, runs) : 'Today'}
        date={dateLine(date)}
        onDatePress={openCalendar}
        onDateStep={(d) => go(shiftDays(date, d))}
        dateLabel={`${fmtDate('long', date)}. Pick a day`}
        accessory={
          !isToday ? (
            <ChipButton quiet className="today-chip" onClick={() => go(t)}>
              Today
            </ChipButton>
          ) : null
        }
      />
      {!loaded ? (
        <TodaySkeleton />
      ) : setup ? (
        <SetupCard log={log} hasPlan={hasPlan} />
      ) : (
        <DatePager className="hero-pager" date={date} onChange={go} disabled={multi} label="Day" prevLabel="Previous day" nextLabel="Next day" render={(d) => <Hero date={d} log={log} minutes={minutes} live={d === date} />} />
      )}
      {/* after first run (and until Later): "See your runs land here", under the hero; the setup card has its own Strava step */}
      {loaded && isToday && !setup && primer.show ? <StravaPrimer className="today-primer" onLater={primer.later} /> : null}
      {loaded && showHabits && !(setup && !log.habits.length) ? <OrbRow date={date} log={log} quiet={isToday && minutes >= EVENING_START} /> : null}
      {loaded && isToday ? <TodayTodos date={date} /> : null}
      {closeAtEnd ? (
        <div className="sec-primary">
          <CloseDay date={date} log={log} ph={ph} onOpenSession={(p) => openSession(date, p.session, { fromHero: true })} />
        </div>
      ) : null}
    </div>
  );
}
