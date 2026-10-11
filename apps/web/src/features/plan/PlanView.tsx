import { addMonths, counts, dayStatus, daysBetween, fmtDate, label, mi, mondayOf, monthOf, monthStart, monthsBetween, num, parseISO, sessionStatus, shiftDays, STATUS_WORD, tone, weekTotals, type Session } from '@logbook/shared';
import { Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { itemVariants, listVariants } from '@/lib/motion';
import { AnimatedNumber } from '@/ui/AnimatedNumber';
import { Button, Card, CardHead, DateNav, Empty, IconButton, Kpi, Note, PageHeader, Ring, Segmented } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { useLog, type Log } from '../log/useLog';
import { SessionCard } from '../sessions/SessionCard';
import { SessionEditor } from '../sessions/SessionEditor';
import { StravaLine } from '../settings/StravaLine';
import { PlanBuilder, PlansList, Upcoming } from './PlanBuilder';
import './plan.css';

const glyph: Record<string, string> = { done: '✓', floor: '½', missed: '✕', skipped: '–' };

/** A session, tapped in the week or month: the full card in a sheet. */
export const useQuickOpen = (log: Log) => {
  const sheet = useSheet();
  const nav = useNavigate();
  return (d: string, s: Session) =>
    sheet.open({
      title: fmtDate('long', d),
      body: (
        <div className="stack" style={{ gap: 12 }}>
          <SessionCard date={d} s={s} log={log} />
          <Button
            variant="ghost"
            block
            onClick={() => {
              sheet.close();
              nav(d === log.today ? '/today' : `/today/${d}`);
            }}
          >
            Open {fmtDate('short', d)}
          </Button>
        </div>
      ),
      wide: true,
    });
};

const chipLabel = (log: Log, d: string, s: Session) => {
  if (s.kind !== 'run') return label(s);
  const runs = log.snap.runsOn(d);
  return runs.length ? `${label(s)} → ${mi(runs.reduce((t, a) => t + a.miles, 0))}` : label(s);
};

const SessionChip = ({ d, s, log, onOpen }: { d: string; s: Session; log: Log; onOpen: (d: string, s: Session) => void }) => {
  const st = sessionStatus(log.snap, d, s);
  return (
    <button
      type="button"
      className={`s-chip t-${tone(s)} st-${st}`}
      title={`${label(s)}${s.details ? ` — ${s.details}` : ''} · ${STATUS_WORD[st] ?? ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(d, s);
      }}
    >
      {glyph[st] ? <span className="s-glyph">{glyph[st]}</span> : null}
      <span className="s-text">{chipLabel(log, d, s)}</span>
    </button>
  );
};

// ---------- week ----------
const Week = ({ anchor, log }: { anchor: string; log: Log }) => {
  const nav = useNavigate();
  const sheet = useSheet();
  const open = useQuickOpen(log);
  const t = log.today;
  const mon = mondayOf(anchor);
  const tot = weekTotals(log.snap, mon);
  let hab = 0;
  let habOf = 0;
  for (let i = 0; i < 7; i++) {
    const d = shiftDays(mon, i);
    if (d > t) break;
    for (const h of log.habits) {
      if (d < h.createdOn) continue;
      habOf++;
      if (log.snap.isHabitDone(d, h.id)) hab++;
    }
  }
  const pct = tot.planned > 0 ? Math.min(1, tot.ran / tot.planned) : 0;
  return (
    <>
      <div className="kpis">
        <Kpi label="Miles run vs planned" value={<AnimatedNumber value={tot.ran} format={mi} />} unit={`of ${num(tot.planned)}`} wide>
          <span className="meter">
            <motion.i initial={false} animate={{ width: `${pct * 100}%` }} transition={{ type: 'spring', stiffness: 90, damping: 20 }} />
          </span>
        </Kpi>
        <Kpi label="Sessions hit" value={`${tot.hit} / ${tot.sessions}`} />
        <Kpi label="Habits" value={habOf ? `${Math.round((hab / habOf) * 100)}%` : '—'} />
      </div>
      <motion.div className="week-grid" variants={listVariants} initial="hidden" animate="show" key={mon}>
        {Array.from({ length: 7 }, (_, i) => shiftDays(mon, i)).map((d) => {
          const st = dayStatus(log.snap, d);
          const ran = log.snap.runsOn(d).reduce((s, a) => s + a.miles, 0);
          const other = log.snap.activitiesOn(d).filter((a) => a.kind !== 'run');
          const hs = log.habits.filter((h) => d >= h.createdOn);
          const hd = hs.filter((h) => log.snap.isHabitDone(d, h.id)).length;
          const sessions = log.snap.sessionsOn(d);
          const empty = !sessions.length && !ran && !other.length && !hs.length;
          return (
            <motion.div
              key={d}
              variants={itemVariants}
              className={`week-day ds-${st} ${d === t ? 'is-today' : ''} ${d < t ? 'is-past' : ''} ${empty ? 'is-empty' : ''}`}
              role="button"
              tabIndex={0}
              aria-label={fmtDate('long', d)}
              onClick={() => nav(d === t ? '/today' : `/today/${d}`)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), nav(`/today/${d}`))}
            >
              <div className="wd-head">
                <span className="wd-dow">{fmtDate('dow', d)}</span>
                <span className="wd-num num">{parseISO(d).getDate()}</span>
                <span className="wd-status">{STATUS_WORD[st] ?? ''}</span>
              </div>
              <div className="wd-sessions">
                {sessions.map((s) => (
                  <SessionChip key={s.id} d={d} s={s} log={log} onOpen={open} />
                ))}
              </div>
              <div className="wd-foot">
                {ran > 0 ? <span className="ran">Ran {mi(ran)}</span> : null}
                {other.length ? <span className="ran">{other.map((a) => a.sportType || 'Workout').join(', ')}</span> : null}
                {hs.length ? (
                  <Ring value={hd / hs.length} size={20} stroke={3} label={`${hd} of ${hs.length} habits`}>
                    {''}
                  </Ring>
                ) : null}
                {hs.length ? <span className="muted" style={{ fontSize: 12 }}>{`${hd}/${hs.length}`}</span> : null}
                <IconButton
                  label={`Add session on ${fmtDate('short', d)}`}
                  size="sm"
                  className="add-s faint"
                  onClick={(e) => {
                    e.stopPropagation();
                    sheet.open({ title: 'Add session', body: <SessionEditor date={d} session={null} /> });
                  }}
                >
                  <Plus size={15} />
                </IconButton>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
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
      <div className="kpis">
        <Kpi label="Miles run" value={<AnimatedNumber value={ran} format={mi} />} />
        <Kpi label="Miles planned" value={num(planned)} />
        <Kpi label="Sessions hit so far" value={of ? `${hit} / ${of}` : '—'} />
      </div>
      <div className="month-grid">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((x) => (
          <div key={x} className="mg-dow">
            {x}
          </div>
        ))}
        {days.map((d) => {
          const inMonth = d >= first && d < next;
          const st = dayStatus(log.snap, d);
          const sessions = log.snap.sessionsOn(d).filter((s) => s.kind !== 'rest');
          const r = log.snap.runsOn(d).reduce((x, a) => x + a.miles, 0);
          return (
            <button
              key={d}
              type="button"
              className={`mg-day ds-${st} ${inMonth ? '' : 'out'} ${d === t ? 'is-today' : ''}`}
              aria-label={`${fmtDate('long', d)}${sessions.length ? `: ${sessions.map(label).join(', ')}` : ''}${STATUS_WORD[st] ? `, ${STATUS_WORD[st]}` : ''}`}
              onClick={() => nav(d === t ? '/today' : `/today/${d}`)}
            >
              <span className="mg-num num">{parseISO(d).getDate()}</span>
              <span className="mg-items">
                {sessions.slice(0, 3).map((s) => (
                  <span key={s.id} className={`mg-s t-${tone(s)} st-${sessionStatus(log.snap, d, s)}`}>
                    {chipLabel(log, d, s)}
                  </span>
                ))}
              </span>
              {r > 0 ? <span className="mg-ran">{mi(r)} mi</span> : null}
            </button>
          );
        })}
      </div>
      <div className="legend">
        {(
          [
            ['easy', 'Easy'],
            ['long', 'Long'],
            ['hard', 'Threshold / tempo'],
            ['fast', 'Speed'],
            ['lift', 'Lift'],
            ['cross', 'Cross'],
          ] as const
        ).map(([k, n]) => (
          <span key={k} className="lg">
            <i className={`t-${k}`} />
            {n}
          </span>
        ))}
        <span className="lg">
          <i style={{ background: 'color-mix(in srgb, var(--ok) 70%, var(--surface))' }} />
          Done
        </span>
        <span className="lg">
          <i style={{ background: 'color-mix(in srgb, var(--bad) 45%, var(--surface))' }} />
          Missed
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
  const title = view === 'week' ? (mon === mondayOf(t) ? 'This week' : `Week of ${fmtDate('md', mon)}`) : view === 'month' ? fmtDate('month', first) : 'Plan';
  const sub = view === 'week' ? `${fmtDate('md', mon)} – ${fmtDate('md', shiftDays(mon, 6))}` : view === 'month' ? undefined : 'Import a plan, describe one, or change the one you have.';
  return (
    <div className="page">
      <PageHeader
        eyebrow="Calendar"
        title={title}
        sub={sub}
        actions={
          view !== 'plans' ? (
            <>
              <DateNav
                onPrev={() => go(view, view === 'week' ? shiftDays(mon, -7) : addMonths(first, -1))}
                onNext={() => go(view, view === 'week' ? shiftDays(mon, 7) : addMonths(first, 1))}
                prevLabel={view === 'week' ? 'Previous week' : 'Previous month'}
                nextLabel={view === 'week' ? 'Next week' : 'Next month'}
              />
              {(view === 'week' && mon !== mondayOf(t)) || (view === 'month' && monthOf(first) !== monthOf(t)) ? (
                <Button size="sm" variant="ghost" onClick={() => go(view)}>
                  {view === 'week' ? 'This week' : 'This month'}
                </Button>
              ) : null}
            </>
          ) : null
        }
      >
        <Segmented className="plan-tabs" label="Calendar view" options={[['week', 'Week'], ['month', 'Month'], ['plans', 'Plans']]} value={view} onChange={(v) => go(v, anchor)} />
        <StravaLine strava={log.strava} />
      </PageHeader>
      {view === 'week' ? <Week anchor={anchor} log={log} /> : view === 'month' ? <Month anchor={anchor} log={log} /> : (
        <>
          <PlanBuilder log={log} />
          <PlansList log={log} />
          <Card>
            <CardHead title="Next two weeks">
              <Button variant="ghost" size="sm" onClick={() => nav('/today')}>
                Open today
              </Button>
            </CardHead>
            <Upcoming log={log} />
          </Card>
        </>
      )}
      {log.strava?.error && view !== 'plans' ? <Note kind="warn">{log.strava.error}</Note> : null}
      {!log.ready && view !== 'plans' ? <Empty>Loading…</Empty> : null}
    </div>
  );
}
