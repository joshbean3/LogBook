import { counts, mondayOf, sessionStatus, shiftDays, weekSummary, type ISODate, type Snapshot, type WeekSummary } from '@logbook/shared';
import type * as React from 'react';
import { Fragment, memo, useEffect, useMemo, useRef, useState } from 'react';
import { useIsActiveTab, useTabScroller } from '@/app/NavController';
import { LANDING_VISIBLE } from '@/lib/gesture';
import { haptics } from '@/lib/haptics';
import { Pressable } from '@/ui/Pressable';
import { WeekRing } from '@/ui/WeekRing';
import type { Log } from '../log/useLog';
import { useOpenWeek } from '../progress/sheets';
import { ringDays } from './dayWords';
import { useIsLive } from './live';
import { milesText } from './faces';

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

/** The card's one line: the week's long run still to come, else whether the week was kept. */
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
  // matched, a lift with its sets in), so the line agrees with the runs count above it (day review 1 #8)
  const left = sum.days.filter((d) => d.date >= today).reduce((n, d) => n + snap.sessionsOn(d.date).filter((s) => s.kind !== 'rest' && s.mark == null && !counts(sessionStatus(snap, d.date, s))).length, 0);
  return left ? `${left} ${left === 1 ? 'session' : 'sessions'} to go.` : 'Nothing left this week.';
};

/** `celebrate` once per ISO week (§11.4): remembered here so a reload or another page of the week stays quiet. */
const CELEBRATE = (key: string) => `logbook.celebrate.${key}`;
const celebrated = (key: string) => {
  try {
    return localStorage.getItem(CELEBRATE(key)) === '1';
  } catch {
    return false;
  }
};
const markCelebrated = (key: string) => {
  try {
    localStorage.setItem(CELEBRATE(key), '1');
  } catch {
    /* this session only */
  }
};

/**
 * The Week card (docs/feel.md §3.1 row 6, M22): on every day page, the shown day marked on a 64 px `WeekRing` (a missed day a
 * quiet `--ink-4` gap, never red), `WEEK 43` over `8 of 20 mi · 3 of 4 runs` and one line. Tap → the week sheet (Progress's).
 *
 * It owns `celebrate` (§11.4): when the current ISO week's planned runs are all done, once per ISO week, only while Today
 * is the active tab and the card is at least `LANDING_VISIBLE` on screen (it waits for both), with the ring's arcs filling
 * on `springs.number` as it fires.
 */
export const WeekCard = memo(function WeekCard({ date, log }: { date: ISODate; log: Log }): React.JSX.Element {
  const openWeek = useOpenWeek(log.today);
  const mon = mondayOf(date);
  const sum = useMemo(() => weekSummary(log.snap, mon), [log.snap, mon]);
  const wk = isoWeek(date);
  const ran = Math.round(sum.doneMiles * 10) / 10;
  const plan = Math.round(sum.plannedMiles * 10) / 10;
  const parts = [plan > 0 ? `${milesText(ran)} of ${milesText(plan)} mi` : ran > 0 ? `${milesText(ran)} mi` : null, sum.runsPlanned > 0 ? `${sum.runsDone} of ${sum.runsPlanned} runs` : null].filter((x): x is string => !!x);
  const stats = parts.join(' · ') || 'Nothing planned';
  const note = weekNote(log.snap, sum, date, log.today);
  const ref = useRef<HTMLElement | null>(null);
  return (
    <Pressable as="div" ref={ref} className="week-card card" data-week={wk.key} label={`Week ${wk.week}: ${stats}. ${note} Open the week`} onPress={() => openWeek(mon)}>
      <CardRing date={date} log={log} sum={sum} wk={wk.key} card={ref} />
      <span className="wc-text">
        <span className="caps wc-week">Week {wk.week}</span>
        {/* one line at 390; where it cannot be (320), it breaks only at the dot, never inside "4 runs" */}
        <span className="wc-stats tnum">
          {parts.length
            ? parts.map((p, i) => (
                <Fragment key={i}>
                  {i ? ' ' : null}
                  <span className="wc-part">
                    {p}
                    {i < parts.length - 1 ? ' ·' : ''}
                  </span>
                </Fragment>
              ))
            : stats}
        </span>
        <span className="wc-note">{note}</span>
      </span>
    </Pressable>
  );
});

/**
 * The card's ring, the one part that depends on which page is live: the once-a-day fill and `celebrate` belong to the live
 * page (a neighbour never spends them).
 */
const CardRing = ({ date, log, sum, wk, card }: { date: ISODate; log: Log; sum: WeekSummary; wk: string; card: React.RefObject<HTMLElement | null> }) => {
  const live = useIsLive(date);
  const mon = mondayOf(date);
  const days = ringDays(sum, log.today);
  const marked = Math.round((D(date).getTime() - D(mon).getTime()) / 86_400_000);
  const ti = sum.days.findIndex((d) => d.date === log.today);
  // celebrate: the current week, every planned run done, Today active, the card in view; once per ISO week
  const current = mon === mondayOf(log.today);
  const closed = current && sum.runsPlanned > 0 && sum.runsDone >= sum.runsPlanned;
  const active = useIsActiveTab();
  const scroller = useTabScroller();
  const [fill, setFill] = useState<string | null>(null);
  useEffect(() => {
    if (!live || !closed || !active || celebrated(wk)) return;
    const el = card.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (es) => {
        if (!es.some((e) => e.intersectionRatio >= LANDING_VISIBLE) || celebrated(wk)) return;
        markCelebrated(wk);
        io.disconnect();
        setFill(`celebrate-${wk}`);
        haptics.celebrate();
      },
      { root: scroller.current, threshold: [LANDING_VISIBLE] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [live, closed, active, wk, scroller, card]);
  return (
    <span className="week-ring" data-celebrated={fill ? '' : undefined}>
      <WeekRing key={fill ?? (live ? 'live' : 'still')} days={days} size={64} marked={marked} today={ti >= 0 ? ti : undefined} onceADay={fill ?? (live && current ? 'week-card-ring' : null)} />
    </span>
  );
};

/** The week a day sits in, Monday first (for tests and the strip). */
export const weekOf = (date: ISODate) => Array.from({ length: 7 }, (_, i) => shiftDays(mondayOf(date), i));
