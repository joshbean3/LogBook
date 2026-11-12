import { fmtDate, mondayOf, monthOf, shiftDays } from '@logbook/shared';
import { ChevronDown } from 'lucide-react';
import { memo, useEffect, useId, useMemo, useState } from 'react';
import { Pressable } from '@/ui/Pressable';
import { PathLine, PathStop } from '@/ui/poster';
import { Skeleton } from '@/ui/Skeleton';
import { useSheet } from '@/ui/Sheet';
import { dayRange } from '@/ui/charts/range';
import { useLog, type Log } from '../log/useLog';
import { openAddSession } from '../sessions/AddSessionSheet';
import { defaultDay } from '../sessions/addModel';
import { useOpenSession, useOpenUnplanned } from '../sessions/SessionCard';
import { weekTitle } from './context';
import { LoadFail, useMonthsFailed } from './LoadFail';
import { PlanFoot } from './PlanTop';
import { TrainingCard, WeekCard } from './TrainingCard';
import { arrivingFor } from './weekLive';
import { weekStops, type WeekStop } from './weekStops';

/**
 * One week of Fitness (guide 6.5a, "Fitness"). It is what the week pager renders for prev, cur and next, memoised by its
 * Monday, with its own log, so a page commit re-renders none of the three.
 *
 * Top to bottom:
 * 1. The card: this week, Today's training card (TrainingCard); any other week, that week's summary (WeekCard).
 * 2. The line of days, in one card: each day ahead a stop on the dotted line (its caption, the session's name, its
 *    detail, a chevron: a tap opens the session sheet, where every action lives: mark done, skip, move, edit, delete).
 *    Two sessions on a day are two stops. The last stop is "Add a session" (the Add sheet for this week). A week with
 *    nothing on it says so, and "Add a session" is then the lit stop.
 * 3. This week only: the days before today, folded into one row at the card's foot ("Earlier this week", "3 sessions").
 *    It opens them in place as stops with what happened (done, missed, skipped).
 * 4. The plan row (PlanTop): "Build a plan", or the plan's name and where it stands.
 *
 * A week behind shows all its days as stops with their states. `still`: a neighbour page not yet live draws the same
 * stops with no handlers (PlanView makes it live once the pager rests).
 */

const SkelLine = () => (
  <div className="pl-ahead card pl-skel" aria-label="Loading the week" aria-busy="true">
    {[0, 1, 2].map((i) => (
      <div key={i} className="pl-skel-row">
        <Skeleton w={16} h={16} r={8} />
        <Skeleton w="55%" h={18} r="line" />
      </div>
    ))}
  </div>
);

/** The line of days and the fold under it. */
const DaysLine = ({ mon, log, still }: { mon: string; log: Log; still: boolean }) => {
  const sheet = useSheet();
  const open1 = useOpenSession(log);
  const openUnplanned = useOpenUnplanned();
  // PathLine reads its direct PathStop children, so the stops are made here, not in a component of their own. A day's
  // second stop has no caption: it reads as the same day
  const stopsOf = (stops: WeekStop[]) =>
    stops.map((s) => (
      <PathStop
        key={s.key}
        id={s.key}
        node="dot"
        state={s.state}
        caption={s.caption || undefined}
        title={s.title}
        subtitle={s.sub || undefined}
        struck={s.struck}
        chevron
        label={s.said}
        onPress={still ? undefined : () => (s.session ? open1(s.date, s.session) : openUnplanned(s.date, s.runs, log))}
      />
    ));
  const w = useMemo(() => weekStops(log, mon), [log, mon]);
  const [open, setOpen] = useState(false);
  const foldId = useId();
  // a session just added to this week (the Add sheet): once the sheet is on its way down, its stop is brought into view
  const fresh = [...w.ahead, ...w.earlier].find((s) => arrivingFor(s.key) > 0)?.key;
  useEffect(() => {
    if (!fresh) return;
    if (w.earlier.some((s) => s.key === fresh)) setOpen(true);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const id = setTimeout(() => document.querySelector(`[data-stop="${fresh}"]`)?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }), reduce ? 0 : 320);
    return () => clearTimeout(id);
  }, [fresh]); // eslint-disable-line react-hooks/exhaustive-deps
  // the week's Add: the Add sheet on the day `defaultDay` picks (today in this week, the first open day of a later one)
  const add = () => openAddSession(sheet, mon, defaultDay(log.snap.sessionsOn, mon, log.today), log.today);
  const named = weekTitle(mon, log.today);
  const weekIn = named.startsWith('Week of') ? `the w${named.slice(1)}` : named.toLowerCase();
  const nothing = w.where === 'past' ? 'Nothing was on this week' : 'Nothing on this week yet';
  return (
    <div className="pl-ahead card">
      <PathLine label={w.where === 'now' ? 'The days ahead' : `The days of ${weekIn}`}>
        {stopsOf(w.ahead)}
        {w.empty ? (
          <PathStop id="add" state="next" caption={nothing} title="Add a session" label={`${nothing}. Add a session`} onPress={still ? undefined : add} />
        ) : (
          <PathStop id="add" state="add" title="Add a session" label={`Add a session to ${weekIn}`} onPress={still ? undefined : add} />
        )}
      </PathLine>
      {w.earlier.length ? (
        <>
          <Pressable className={`pl-fold${open ? ' is-open' : ''}`} press="surface" aria-expanded={open} aria-controls={foldId} disabled={still} onPress={() => setOpen((o) => !o)} label={`Earlier this week, ${w.earlierWord}. ${open ? 'Hide' : 'Show'}`}>
            <span className="pl-fold-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="pl-fold-title">Earlier this week</span>
            <span className="pl-fold-value">{w.earlierWord}</span>
            <ChevronDown size={18} className="pl-fold-chev" aria-hidden="true" />
          </Pressable>
          {open ? (
            <div id={foldId} className="pl-earlier">
              <PathLine label="Earlier this week" lead={false}>
                {stopsOf(w.earlier)}
              </PathLine>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
};

/**
 * One week page. Memoised by its Monday (the pager re-renders none on a commit). `still`: a neighbour not yet live draws
 * the same page with no handlers on its stops.
 */
export const WeekPage = memo(function WeekPage({ mon, onThisWeek, still }: { mon: string; onThisWeek: () => void; still?: boolean }) {
  const months = useMemo(() => [...new Set([monthOf(mon), monthOf(shiftDays(mon, 6))])], [mon]);
  const log = useLog(months);
  const ready = log.loaded(mon) && log.loaded(shiftDays(mon, 6));
  // a month that failed with nothing stored: say so with Retry, never a skeleton that stays (the still page stays a skeleton)
  const fail = useMonthsFailed(months);
  const named = weekTitle(mon, log.today);
  const here = mon === mondayOf(log.today);
  return (
    <div className="pl-wpage">
      <section className="pl-sec pl-week-sec" aria-label={`${named}, ${dayRange(mon, shiftDays(mon, 6))}`}>
        {!ready ? (
          fail.failed && !still ? (
            <LoadFail what="Couldn’t load this week." onRetry={fail.retry} />
          ) : (
            <>
              <div className="hero aura hero-skel" data-face="loading" aria-busy="true" aria-label={`Loading ${fmtDate('md', mon)}`} />
              <SkelLine />
            </>
          )
        ) : (
          <>
            {here ? <TrainingCard date={log.today} log={log} /> : <WeekCard mon={mon} log={log} live={!still} onThisWeek={onThisWeek} />}
            <DaysLine mon={mon} log={log} still={!!still} />
          </>
        )}
        {/* the plan, a quiet row under the days: its name and where it stands, or the way to build one */}
        <PlanFoot />
      </section>
    </div>
  );
});
