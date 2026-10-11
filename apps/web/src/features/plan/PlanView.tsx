import { addMonths, counts, dayStatus, daysBetween, fmtDate, label, mi, mondayOf, monthOf, monthStart, monthsBetween, num, parseISO, sessionStatus, shiftDays, STATUS_WORD, tone, weekTotals, type Session } from '@logbook/shared';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AnimatedNumber } from '@/ui/AnimatedNumber';
import { ChevronRight } from 'lucide-react';
import { Button, DateNav, DayStrip, EmptyState, Group, Loading, Note, PageHeader, Row, SectionHead, Segmented, Stat, StatStrip } from '@/ui/primitives';
import { useLog, type Log } from '../log/useLog';
import { AddSessionButton, SessionRow, UnplannedRow } from '../sessions/SessionCard';
import { StravaLine } from '../settings/StravaLine';
import { PlanBuilder, PlansList, Upcoming } from './PlanBuilder';
import './plan.css';

const DOW1 = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
/** Planned totals are sums of half-miles and quarter-miles; one decimal is all anyone reads. */
const tenth = (v: number) => num(Math.round(v * 10) / 10);

/** One 6px dot per non-rest session, in its tone; filled once it counts, a ring until then. */
export const Dots = ({ d, log, max = 6 }: { d: string; log: Log; max?: number }) => {
  const list = log.snap.sessionsOn(d).filter((s) => s.kind !== 'rest');
  const bonus = !list.length && log.snap.runsOn(d).length > 0;
  return (
    <span className="sdots" aria-hidden="true">
      {bonus ? <i className="sdot on t-easy" /> : null}
      {list.slice(0, max).map((s) => {
        const st = sessionStatus(log.snap, d, s);
        return <i key={s.id} className={`sdot t-${tone(s)} ${counts(st) ? 'on' : ''} ${st === 'skipped' ? 'skip' : ''}`} />;
      })}
    </span>
  );
};

const describe = (log: Log, d: string): string => {
  const list = log.snap.sessionsOn(d).filter((s) => s.kind !== 'rest');
  const st = dayStatus(log.snap, d);
  return `${fmtDate('long', d)}${list.length ? `: ${list.map(label).join(', ')}` : ''}${STATUS_WORD[st] ? `, ${STATUS_WORD[st]}` : ''}`;
};

// ---------- week ----------
const Week = ({ anchor, log }: { anchor: string; log: Log }) => {
  const nav = useNavigate();
  const t = log.today;
  const mon = mondayOf(anchor);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => shiftDays(mon, i)), [mon]);
  const fallback = mon === mondayOf(t) ? t : anchor;
  const [pick, setPick] = useState<{ mon: string; d: string } | null>(null);
  const sel = pick && pick.mon === mon ? pick.d : fallback;

  const tot = weekTotals(log.snap, mon);
  let hab = 0;
  let habOf = 0;
  for (const d of days) {
    if (d > t) break;
    for (const h of log.habits) {
      if (d < h.createdOn) continue;
      habOf++;
      if (log.snap.isHabitDone(d, h.id)) hab++;
    }
  }
  const pct = tot.planned > 0 ? Math.min(1, tot.ran / tot.planned) : 0;

  const loaded = log.loaded(sel);
  const st = dayStatus(log.snap, sel);
  const sessions = log.snap.sessionsOn(sel);
  const acts = log.snap.activitiesOn(sel);
  const hasRun = sessions.some((s) => s.kind === 'run');
  const hasOther = sessions.some((s) => s.kind === 'lift' || s.kind === 'cross');
  const unplannedRuns = hasRun ? [] : acts.filter((a) => a.kind === 'run');
  const unmatched = hasOther ? [] : acts.filter((a) => a.kind !== 'run');
  const showList = (s: Session) => s.kind !== 'rest' || sessions.length === 1;
  const listed = sessions.filter(showList);
  const word = STATUS_WORD[st] || 'Nothing planned';
  const openDay = () => nav(sel === t ? '/today' : `/today/${sel}`);

  return (
    <>
      <StatStrip className="wk-strip">
        <Stat label="Miles" value={<AnimatedNumber value={tot.ran} format={mi} />} unit={tot.planned ? `of ${tenth(tot.planned)}` : 'run'}>
          <span className="meter">
            <motion.i initial={false} animate={{ width: `${pct * 100}%` }} transition={{ type: 'spring', stiffness: 90, damping: 20 }} />
          </span>
        </Stat>
        <Stat label="Hit" value={tot.sessions ? <AnimatedNumber value={tot.hit} /> : '—'} unit={tot.sessions ? `of ${tot.sessions}` : undefined} />
        <Stat label="Habits" value={habOf ? <AnimatedNumber value={Math.round((hab / habOf) * 100)} format={(v) => `${Math.round(v)}%`} /> : '—'} />
      </StatStrip>
      <StravaLine strava={log.strava} />

      <DayStrip days={days} selected={sel} today={t} onPick={(d) => setPick({ mon, d })} labelOf={(d) => describe(log, d)} statusOf={(d) => dayStatus(log.snap, d)} extra={(d) => <Dots d={d} log={log} />} ariaLabel="Days of the week" />

      {/* one accent action for the day: the head's Add, or the empty state's Add, never both */}
      <SectionHead title={`${fmtDate('dow', sel)} ${parseISO(sel).getDate()} · ${word}`} action={!loaded || listed.length || unplannedRuns.length ? <AddSessionButton date={sel}>Add</AddSessionButton> : undefined} />
      <Group>
        {!loaded ? <Loading text={`Loading ${fmtDate('month', sel)}…`} /> : null}
        {loaded && (listed.length || unplannedRuns.length) ? (
          <ul>
            {listed.map((s) => (
              <SessionRow key={s.id} date={sel} s={s} log={log} />
            ))}
            {unplannedRuns.length ? <UnplannedRow date={sel} runs={unplannedRuns} log={log} /> : null}
          </ul>
        ) : loaded ? (
          <EmptyState action={<AddSessionButton date={sel} variant="soft" />}>{sel < t ? 'Nothing was planned this day.' : 'Nothing planned. Add a session, or build a plan.'}</EmptyState>
        ) : null}
        {unmatched.map((a) => (
          <div key={a.id} className="lrow">
            <div className="lrow-main">
              <div className="lrow-title">{a.name}</div>
              <div className="lrow-sub">From Strava · {Math.round(a.movingSec / 60)} min</div>
            </div>
          </div>
        ))}
        {loaded ? <Row className="wk-open" title={sel === t ? 'Open today' : 'Open day'} onClick={openDay} right={<ChevronRight size={18} />} /> : null}
      </Group>
    </>
  );
};

// ---------- month ----------
const Month = ({ anchor, log }: { anchor: string; log: Log }) => {
  const nav = useNavigate();
  const t = log.today;
  const first = monthStart(anchor);
  const next = addMonths(first, 1);
  const last = shiftDays(next, -1);
  const gridStart = mondayOf(first);
  let planned = 0;
  let ran = 0;
  let hit = 0;
  let of = 0;
  for (let d = first; d <= last; d = shiftDays(d, 1)) {
    for (const s of log.snap.sessionsOn(d)) {
      const st = sessionStatus(log.snap, d, s);
      if (s.kind === 'run' && st !== 'skipped') planned += Number(s.miles) || 0;
      if (st === 'rest' || st === 'skipped' || d > t) continue;
      of++;
      if (counts(st)) hit++;
    }
    ran += log.snap.runsOn(d).reduce((x, a) => x + a.miles, 0);
  }
  const days: string[] = [];
  for (let d = gridStart; d < next || parseISO(d).getDay() !== 1; d = shiftDays(d, 1)) {
    days.push(d);
    if (daysBetween(gridStart, d) > 45) break;
  }
  return (
    <>
      <StatStrip>
        <Stat label="Miles" value={<AnimatedNumber value={ran} format={mi} />} />
        <Stat label="Planned" value={tenth(planned)} unit="mi" />
        <Stat label="Hit" value={of ? <AnimatedNumber value={hit} /> : '—'} unit={of ? `of ${of}` : undefined} />
      </StatStrip>
      <StravaLine strava={log.strava} />
      <div className="mgrid" role="grid" aria-label={fmtDate('month', first)}>
        {DOW1.map((x, i) => (
          <span key={i} className="mdow" aria-hidden="true">
            {x}
          </span>
        ))}
        {days.map((d) => {
          const inMonth = d >= first && d < next;
          const ds = dayStatus(log.snap, d);
          return (
            <button key={d} type="button" className={`mcell ds-${ds} ${inMonth ? '' : 'out'} ${d === t ? 'is-today' : ''}`} aria-label={describe(log, d)} onClick={() => nav(d === t ? '/today' : `/today/${d}`)}>
              <span className="mcell-num">{parseISO(d).getDate()}</span>
              <Dots d={d} log={log} max={3} />
            </button>
          );
        })}
      </div>
      <div className="legend plan-legend">
        {(
          [
            ['easy', 'Easy'],
            ['long', 'Long'],
            ['hard', 'Threshold'],
            ['fast', 'Speed'],
            ['lift', 'Lift'],
            ['cross', 'Cross'],
          ] as const
        ).map(([k, n]) => (
          <span key={k} className="lg">
            <i className={`sdot on t-${k}`} />
            {n}
          </span>
        ))}
        <span className="lg">
          <i className="sdot t-rest" style={{ borderColor: 'var(--ink-3)' }} />
          Planned
        </span>
      </div>
    </>
  );
};

type View = 'week' | 'month' | 'plans';

export default function PlanView() {
  const params = useParams();
  const nav = useNavigate();
  const base = useLog([]);
  const t = base.today;
  const view: View = params.view === 'month' || params.view === 'plans' ? params.view : 'week';
  const anchor = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : t;
  const months = useMemo(() => {
    if (view === 'week') {
      const mon = mondayOf(anchor);
      return monthsBetween(mon, shiftDays(mon, 6));
    }
    if (view === 'month') return monthsBetween(shiftDays(monthStart(anchor), -7), shiftDays(addMonths(anchor, 1), 7));
    return monthsBetween(t, shiftDays(t, 13));
  }, [view, anchor, t]);
  const log = useLog(months);
  const go = (v: View, d?: string) => nav(`/plan/${v}${d && d !== t ? `/${d}` : ''}`);
  const mon = mondayOf(anchor);
  const first = monthStart(anchor);
  const title = view === 'week' ? (mon === mondayOf(t) ? 'This week' : `Week of ${fmtDate('md', mon)}`) : view === 'month' ? fmtDate('month', first) : 'Plans';
  const sub = view === 'week' ? `${fmtDate('md', mon)} – ${fmtDate('md', shiftDays(mon, 6))}` : view === 'month' ? `${fmtDate('md', first)} – ${fmtDate('md', shiftDays(addMonths(first, 1), -1))}` : 'Import a plan, describe one, or change the one you have.';
  const offNow = (view === 'week' && mon !== mondayOf(t)) || (view === 'month' && monthOf(first) !== monthOf(t));
  return (
    <div className="page">
      <PageHeader
        title={title}
        sub={sub}
        actions={
          view !== 'plans' ? (
            <>
              {offNow ? (
                <Button size="sm" variant="ghost" onClick={() => go(view)}>
                  Today
                </Button>
              ) : null}
              <DateNav
                onPrev={() => go(view, view === 'week' ? shiftDays(mon, -7) : addMonths(first, -1))}
                onNext={() => go(view, view === 'week' ? shiftDays(mon, 7) : addMonths(first, 1))}
                prevLabel={view === 'week' ? 'Previous week' : 'Previous month'}
                nextLabel={view === 'week' ? 'Next week' : 'Next month'}
              />
            </>
          ) : null
        }
      >
        <Segmented className="plan-tabs" label="Calendar view" options={[['week', 'Week'], ['month', 'Month'], ['plans', 'Plans']]} value={view} onChange={(v) => go(v, anchor)} />
      </PageHeader>
      {view === 'week' ? <Week anchor={anchor} log={log} /> : view === 'month' ? <Month anchor={anchor} log={log} /> : (
        <>
          <PlanBuilder log={log} />
          <PlansList log={log} />
          <Upcoming log={log} />
        </>
      )}
      {log.strava?.error && view !== 'plans' ? (
        <div className="section">
          <Note kind="warn">{log.strava.error}</Note>
        </div>
      ) : null}
    </div>
  );
}
