import { addMonths, counts, dayStatus, daysBetween, fmtDate, label, mi, mondayOf, monthOf, monthStart, monthsBetween, num, parseISO, sessionStatus, shiftDays, STATUS_WORD, tone, weekTotals, type PlanBlock, type Session } from '@logbook/shared';
import { motion } from 'motion/react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AnimatedNumber } from '@/ui/AnimatedNumber';
import { useDropDays } from '@/lib/useDrag';
import { ChevronRight } from 'lucide-react';
import { Button, Chip, DateNav, DayStrip, EmptyState, Group, Loading, Note, PageHeader, Row, SectionHead, Segmented, Stat, StatStrip } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { useLog, type Log } from '../log/useLog';
import { AddSessionButton, sessionMeta, SessionRow, UnplannedRow } from '../sessions/SessionCard';
import { SessionEditor } from '../sessions/SessionEditor';
import { StravaLine } from '../settings/StravaLine';
// the aura card grammar lives with Today; Plan borrows it rather than redrawing it
import { PlanBuilder, PlanSheet, PlansList, Upcoming } from './PlanBuilder';
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

/** The section head's Add is the second action on the screen, so it is ink, not the accent. */
const AddQuiet = ({ date }: { date: string }) => {
  const sheet = useSheet();
  return (
    <Button variant="quiet" size="sm" className="pl-add" onClick={() => sheet.open({ title: 'Add session', body: <SessionEditor date={date} session={null} /> })}>
      Add
    </Button>
  );
};

// ---------- the selected day: one aura card, the week's numbers under a hairline ----------
const dayOf = (log: Log, sel: string) => {
  const sessions = log.snap.sessionsOn(sel);
  const acts = log.snap.activitiesOn(sel);
  const hasRun = sessions.some((s) => s.kind === 'run');
  const hasOther = sessions.some((s) => s.kind === 'lift' || s.kind === 'cross');
  const unplannedRuns = hasRun ? [] : acts.filter((a) => a.kind === 'run');
  const unmatched = hasOther ? [] : acts.filter((a) => a.kind !== 'run');
  const showList = (s: Session) => s.kind !== 'rest' || sessions.length === 1;
  const listed = sessions.filter(showList);
  return { sessions, listed, unplannedRuns, unmatched };
};

const DayAura = ({ sel, log }: { sel: string; log: Log }) => {
  const t = log.today;
  const mon = mondayOf(sel);
  const days = Array.from({ length: 7 }, (_, i) => shiftDays(mon, i));
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
  const loaded = log.loaded(sel);
  const st = dayStatus(log.snap, sel);
  const { sessions, listed, unplannedRuns } = dayOf(log, sel);
  const main = listed.find((s) => s.kind !== 'rest') ?? null;
  const others = listed.filter((s) => s !== main && s.kind !== 'rest');
  const restDay = !main && sessions.some((s) => s.kind === 'rest');
  const mainSt = main ? sessionStatus(log.snap, sel, main) : st;
  const verdict = !loaded
    ? '…'
    : main
      ? `${mainSt === 'floor' ? 'Floor held' : mainSt === 'done' || mainSt === 'bonus' ? 'Done' : mainSt === 'missed' ? 'Missed' : sessionMeta(main, mainSt) || STATUS_WORD[mainSt] || 'Planned'}.${others.length ? ` Then ${others.map(label).join(' and ')}.` : ''}`
      : unplannedRuns.length
        ? 'A run, unplanned.'
        : restDay
          ? 'Rest day.'
          : 'Nothing planned.';
  const stats: Array<[string, ReactNode, string?]> = [
    ['Miles', <AnimatedNumber key="mi" value={tot.ran} format={mi} />, tot.planned ? `of ${tenth(tot.planned)}` : 'run'],
    ['Hit', tot.sessions ? <AnimatedNumber key="hit" value={tot.hit} /> : '—', tot.sessions ? `of ${tot.sessions}` : undefined],
    ['Habits', habOf ? <AnimatedNumber key="hab" value={Math.round((hab / habOf) * 100)} /> : '—', habOf ? '%' : undefined],
  ];
  return (
    <div className={`aura wk-aura ${main ? `t-${tone(main)}` : ''}`}>
      <span className="aura-glow" aria-hidden="true" />
      <div className="aura-top">
        <span className="caps">{sel === t ? `${fmtDate('md', sel)} · Today` : fmtDate('md', sel)}</span>
        {loaded && STATUS_WORD[st] ? <Chip kind={st === 'bonus' ? 'done' : st}>{STATUS_WORD[st]}</Chip> : null}
      </div>
      <h2 className="aura-title display">{fmtDate('dowLong', sel)}</h2>
      {main ? (
        <div className="wk-sess">
          <span className="stamp wk-stamp">{label(main)}</span>
          {others.map((s) => (
            <Chip key={s.id} kind="tone" className={`t-${tone(s)}`}>
              {label(s)}
            </Chip>
          ))}
        </div>
      ) : null}
      <p className="aura-verdict">{verdict}</p>
      <div className="aura-stats">
        {stats.map(([k, v, u]) => (
          <span key={k} className="aura-stat">
            <span className="caps">{k}</span>
            <span className="stamp aura-num">
              {v}
              {u ? <small>{u}</small> : null}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
};

/** The selected day's sessions as rows, and the way into the day as the last row. */
const DaySessions = ({ sel, log }: { sel: string; log: Log }) => {
  const nav = useNavigate();
  const t = log.today;
  const loaded = log.loaded(sel);
  const { listed, unplannedRuns, unmatched } = dayOf(log, sel);
  const openDay = () => nav(sel === t ? '/today' : `/today/${sel}`);
  return (
    <>
      {/* one accent action for the day at most: the empty state's Add; the head's Add is ink */}
      <SectionHead title="Sessions" action={!loaded || listed.length || unplannedRuns.length ? <AddQuiet date={sel} /> : undefined} />
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
          <EmptyState action={<AddSessionButton date={sel} variant="soft" />}>{sel < t ? 'Nothing was planned this day.' : log.features.claude ? 'Nothing planned. Add a session, or build a plan.' : 'Nothing planned. Add a session.'}</EmptyState>
        ) : null}
        {unmatched.map((a) => (
          <div key={a.id} className="lrow">
            <div className="lrow-main">
              <div className="lrow-title">{a.name}</div>
              <div className="lrow-sub">Recorded · {Math.round(a.movingSec / 60)} min</div>
            </div>
          </div>
        ))}
        {loaded ? <Row className="wk-open" title="Open" onClick={openDay} right={<ChevronRight size={18} />} /> : null}
      </Group>
    </>
  );
};

// ---------- week ----------
const Week = ({ anchor, log }: { anchor: string; log: Log }) => {
  const t = log.today;
  const mon = mondayOf(anchor);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => shiftDays(mon, i)), [mon]);
  const fallback = mon === mondayOf(t) ? t : anchor;
  const [pick, setPick] = useState<{ mon: string; d: string } | null>(null);
  const sel = pick && pick.mon === mon ? pick.d : fallback;
  // the strip's cells take a dragged session row
  const stripRef = useRef<HTMLDivElement>(null);
  useDropDays(stripRef, days);
  return (
    <>
      <div className="section" style={{ marginTop: 16 }}>
        <DayAura sel={sel} log={log} />
        <StravaLine strava={log.strava} />
      </div>
      <div ref={stripRef}>
        <DayStrip className="strip-lit" days={days} selected={sel} today={t} onPick={(d) => setPick({ mon, d })} labelOf={(d) => describe(log, d)} statusOf={(d) => dayStatus(log.snap, d)} extra={(d) => <Dots d={d} log={log} />} ariaLabel="Days of the week" />
      </div>
      <DaySessions sel={sel} log={log} />
    </>
  );
};

// ---------- month: the grid selects in place; the selected day lights up under it ----------
const Month = ({ anchor, log, select }: { anchor: string; log: Log; select: (d: string) => void }) => {
  const t = log.today;
  const sel = anchor;
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
        <Stat label="Miles" value={<AnimatedNumber value={ran} format={mi} />} unit="run" />
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
          // the same pill as the week strip, so a selected day looks the same in both views
          return (
            <button key={d} type="button" className={`dcell mcell ds-${ds} ${inMonth ? '' : 'out'} ${d === t ? 'is-today' : ''} ${d === sel ? 'is-sel' : ''}`} data-drop-day={d} aria-pressed={d === sel} aria-current={d === t ? 'date' : undefined} aria-label={describe(log, d)} onClick={() => select(d)}>
              <span className="dcell-pill">
                <span className="dcell-num">{parseISO(d).getDate()}</span>
                <Dots d={d} log={log} max={3} />
              </span>
            </button>
          );
        })}
      </div>
      <div className="legend plan-legend caps">
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
          To do
        </span>
      </div>
      <div className="section">
        <DayAura sel={sel} log={log} />
      </div>
      <DaySessions sel={sel} log={log} />
    </>
  );
};

// ---------- plans: the plan you are on, as the hero ----------
const planWeeks = (b: PlanBlock) => Math.ceil((daysBetween(b.start, b.end) + 1) / 7);
/** The plan to light up: the one running today, else the next one to start. */
const heroPlan = (blocks: PlanBlock[], t: string): PlanBlock | null => blocks.find((b) => b.start <= t && t <= b.end) ?? [...blocks].filter((b) => b.start > t).sort((a, b) => (a.start < b.start ? -1 : 1))[0] ?? null;

const PlanAura = ({ b, log }: { b: PlanBlock; log: Log }) => {
  const sheet = useSheet();
  const t = log.today;
  const weeks = planWeeks(b);
  const active = b.start <= t && t <= b.end;
  const week = active ? Math.min(weeks, Math.floor(daysBetween(b.start, t) / 7) + 1) : 0;
  let due = 0;
  let done = 0;
  let next: [string, Session] | null = null;
  const through = t < b.end ? t : b.end;
  for (let d = b.start; d <= through; d = shiftDays(d, 1)) {
    for (const s of log.snap.sessionsOn(d)) {
      const st = sessionStatus(log.snap, d, s);
      if (st === 'rest' || st === 'skipped' || st === 'open' || st === 'upcoming') continue;
      due++;
      if (counts(st)) done++;
    }
  }
  for (let d = t > b.start ? t : b.start; d <= b.end && !next; d = shiftDays(d, 1)) {
    for (const s of log.snap.sessionsOn(d)) {
      const st = sessionStatus(log.snap, d, s);
      if (s.kind !== 'rest' && (st === 'open' || st === 'upcoming')) {
        next = [d, s];
        break;
      }
    }
  }
  const when = (d: string) => (d === t ? 'today' : d === shiftDays(t, 1) ? 'tomorrow' : fmtDate('dowLong', d));
  const verdict = active ? (next ? `Next: ${label(next[1])}, ${when(next[0])}.` : t === b.end ? 'The last day.' : 'Nothing more planned.') : `Starts ${fmtDate('md', b.start)}, ${daysBetween(t, b.start)} days from now.`;
  const stats: Array<[string, ReactNode, string?]> = [
    ['Weeks', weeks],
    ['Sessions', b.sessionCount ?? 0],
    ['Done', due ? <AnimatedNumber key="done" value={done} /> : '—', due ? `of ${due}` : undefined],
  ];
  const open = () => sheet.open({ title: b.name, body: <PlanSheet b={b} t={t} /> });
  return (
    <motion.div className="aura pl-aura" role="button" tabIndex={0} aria-label={`${b.name}. Open plan`} onClick={open} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ' ? (e.preventDefault(), open()) : undefined)} whileTap={{ scale: 0.985 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}>
      <span className="aura-glow" aria-hidden="true" />
      <div className="aura-top">
        <span className="caps">{active ? `Active · Week ${week} of ${weeks}` : 'Upcoming'}</span>
        <span className="caps pl-range">
          {fmtDate('md', b.start)} – {fmtDate('md', b.end)}
        </span>
      </div>
      <h2 className="aura-title display">{b.name}</h2>
      <p className="aura-verdict">{verdict}</p>
      <div className="aura-stats">
        {stats.map(([k, v, u]) => (
          <span key={k} className="aura-stat">
            <span className="caps">{k}</span>
            <span className="stamp aura-num">
              {v}
              {u ? <small>{u}</small> : null}
            </span>
          </span>
        ))}
      </div>
    </motion.div>
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
  const hero = view === 'plans' ? heroPlan(base.boot?.blocks ?? [], t) : null;
  const months = useMemo(() => {
    if (view === 'week') {
      const mon = mondayOf(anchor);
      return monthsBetween(mon, shiftDays(mon, 6));
    }
    if (view === 'month') return monthsBetween(shiftDays(monthStart(anchor), -7), shiftDays(addMonths(anchor, 1), 7));
    // the plans tab counts the active plan's sessions from its first day
    return monthsBetween(hero && hero.start < t ? hero.start : t, shiftDays(t, 13));
  }, [view, anchor, t, hero]);
  const log = useLog(months);
  const path = (v: View, d?: string) => `/plan/${v}${d && d !== t ? `/${d}` : ''}`;
  const go = (v: View, d?: string) => nav(path(v, d));
  const mon = mondayOf(anchor);
  const first = monthStart(anchor);
  // a month opens on today when it is this month, else on the 1st
  const landOn = (m: string) => (monthOf(m) === monthOf(t) ? t : monthStart(m));
  const title = view === 'week' ? (mon === mondayOf(t) ? 'This week' : `Week of ${fmtDate('md', mon)}`) : view === 'month' ? fmtDate('month', first) : 'Plans';
  const range = view === 'week' ? `${fmtDate('md', mon)} – ${fmtDate('md', shiftDays(mon, 6))}` : `${fmtDate('md', first)} – ${fmtDate('md', shiftDays(addMonths(first, 1), -1))}`;
  const offNow = (view === 'week' && mon !== mondayOf(t)) || (view === 'month' && monthOf(first) !== monthOf(t));
  // the way back to now sits on the date line, so the arrows never move
  const sub =
    view === 'plans' ? (
      log.features.claude ? 'Import a plan, describe one, or change the one you have.' : 'Your plans and the next two weeks.'
    ) : offNow ? (
      <span className="ph-sub-row">
        {range}
        <button type="button" className="link sm" onClick={() => go(view)}>
          Today
        </button>
      </span>
    ) : (
      range
    );
  return (
    <div className="page">
      <PageHeader
        title={title}
        sub={sub}
        actions={
          view !== 'plans' ? (
            <DateNav
              onPrev={() => go(view, view === 'week' ? shiftDays(mon, -7) : landOn(addMonths(first, -1)))}
              onNext={() => go(view, view === 'week' ? shiftDays(mon, 7) : landOn(addMonths(first, 1)))}
              prevLabel={view === 'week' ? 'Previous week' : 'Previous month'}
              nextLabel={view === 'week' ? 'Next week' : 'Next month'}
            />
          ) : null
        }
      >
        <Segmented className="plan-tabs" label="Calendar view" options={[['week', 'Week'], ['month', 'Month'], ['plans', 'Plans']]} value={view} onChange={(v) => go(v, anchor)} />
      </PageHeader>
      {view === 'week' ? (
        <Week anchor={anchor} log={log} />
      ) : view === 'month' ? (
        <Month anchor={anchor} log={log} select={(d) => nav(path('month', d), { replace: true })} />
      ) : (
        <>
          {hero ? (
            <div className="section" style={{ marginTop: 16 }}>
              <PlanAura b={hero} log={log} />
            </div>
          ) : null}
          <PlanBuilder log={log} />
          <PlansList log={log} exclude={hero?.id} />
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
