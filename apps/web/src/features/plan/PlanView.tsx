import { addMonths, fmtDate, mondayOf, monthOf, monthStart, monthsBetween, shiftDays } from '@logbook/shared';
import { motion, useMotionValue, useReducedMotion, type MotionValue } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { haptics } from '@/lib/haptics';
import { springs } from '@/lib/motion';
import { DatePager } from '@/ui/DatePager';
import { TabHeader } from '@/ui/headers';
import { Note } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { useLog, type Log } from '../log/useLog';
import { BlockCard, heroBlock, openPlans } from './Blocks';
import { MonthGrid } from './Month';
import { Agenda, isoWeek, PullHint, WeekHeader, type Conflict } from './Week';
import './plan.css';

type View = 'week' | 'month';
/** The first week that belongs to a month: the one whose Thursday falls in it. */
const firstWeekOf = (first: string) => (shiftDays(mondayOf(first), 3) >= first ? mondayOf(first) : shiftDays(mondayOf(first), 7));

/** One week, as the pager shows it: the header, then the seven days. The plate is the shared surface of a zoom. */
const WeekPage = ({ mon, log, focus, conflict, setConflict, onZoomOut, onThisWeek, pull }: { mon: string; log: Log; focus: boolean; conflict: Conflict | null; setConflict: (c: Conflict | null) => void; onZoomOut: () => void; onThisWeek: () => void; pull: MotionValue<number> }) => {
  const reduce = useReducedMotion();
  return (
    <div className="pl-week">
      <WeekHeader log={log} mon={mon} onZoomOut={onZoomOut} offWeek={mon !== mondayOf(log.today)} onThisWeek={onThisWeek} pull={pull} />
      <div className="pl-agenda-wrap">
        {focus ? <motion.span className="pl-plate" layoutId={`week-${isoWeek(mon)}`} initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ layout: reduce ? { duration: 0 } : springs.page, opacity: { delay: 0.32, duration: 0.24 } }} aria-hidden="true" /> : null}
        <motion.div initial={focus && !reduce ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ duration: 0.2, delay: focus ? 0.12 : 0 }}>
          <Agenda mon={mon} log={log} conflict={conflict} setConflict={setConflict} />
        </motion.div>
      </div>
    </div>
  );
};

/**
 * Plan: this week as seven rows you reshape by touching them, the block you are on under it, and the month a pinch away.
 * Routes: `/plan` (this week), `/plan/week/:date`, `/plan/month/:date`, and `/plan/plans` (this week with your plans open).
 */
export default function PlanView() {
  const params = useParams();
  const nav = useNavigate();
  const sheet = useSheet();
  const base = useLog([]);
  const t = base.today;
  const view: View = params.view === 'month' ? 'month' : 'week';
  const anchor = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : t;
  const mon = mondayOf(anchor);
  const first = monthStart(anchor);
  const block = heroBlock(base.boot?.blocks ?? [], t);
  const months = useMemo(() => {
    const around = view === 'week' ? monthsBetween(shiftDays(mon, -7), shiftDays(mon, 13)) : monthsBetween(shiftDays(first, -7), shiftDays(addMonths(first, 1), 7));
    // the block's arc reads every week of it (at most eight months)
    const arc = block ? monthsBetween(block.start, block.end).slice(0, 8) : [];
    return [...new Set([...around, ...arc])];
  }, [view, mon, first, block]);
  const log = useLog(months);
  const [focusWeek, setFocusWeek] = useState<string | null>(null);
  // the pull to the month: the week, its days and the block card travel down together, uncovering the hint's own slot
  const pull = useMotionValue(0);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  useEffect(() => setConflict(null), [mon, view]);
  useEffect(() => {
    if (!focusWeek) return;
    const id = setTimeout(() => setFocusWeek(null), 900);
    return () => clearTimeout(id);
  }, [focusWeek]);

  // /plan/plans: the plans sheet over this week (the old Plans tab's address)
  const opened = useRef(false);
  useEffect(() => {
    if (params.view !== 'plans' || opened.current || !log.boot) return;
    opened.current = true;
    nav('/plan', { replace: true });
    openPlans(sheet, log);
  }, [params.view, log, nav, sheet]);

  const weekPath = (m: string) => (m === mondayOf(t) ? '/plan' : `/plan/week/${m}`);
  const goWeek = (m: string) => nav(weekPath(m), { replace: true });
  const goMonth = (d: string) => nav(`/plan/month/${monthOf(d) === monthOf(t) ? t : monthStart(d)}`, { replace: true });
  const zoomOut = (m = mon) => {
    haptics.select();
    setFocusWeek(m);
    // the month a week belongs to is its Thursday's (ISO weeks)
    const th = shiftDays(m, 3);
    nav(`/plan/month/${monthOf(th) === monthOf(t) ? t : monthStart(th)}`);
  };
  const zoomIn = (m: string) => {
    haptics.select();
    setFocusWeek(m);
    nav(weekPath(m));
  };

  // pinch: two fingers closing zoom out to the month; opening on the month zooms into the week under them. The non-passive
  // touchmove listener exists only between a two-finger touchstart and its end (critic C10): a one-finger scroll on Plan
  // never waits on the main thread for it.
  const root = useRef<HTMLDivElement>(null);
  const live = useRef({ view, zoomOut, zoomIn });
  live.current = { view, zoomOut, zoomIn };
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let d0 = 0;
    let fired = false;
    let cx = 0;
    let cy = 0;
    const dist = (e: TouchEvent) => Math.hypot(e.touches[0]!.clientX - e.touches[1]!.clientX, e.touches[0]!.clientY - e.touches[1]!.clientY);
    const move = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !d0) return;
      if (e.cancelable) e.preventDefault();
      if (fired) return;
      const r = dist(e) / d0;
      const v = live.current;
      if (v.view === 'week' && r < 0.75) {
        fired = true;
        v.zoomOut();
      } else if (v.view === 'month' && r > 1.3) {
        fired = true;
        const wk = document.elementFromPoint(cx, cy)?.closest<HTMLElement>('[data-week]')?.dataset.week;
        v.zoomIn(wk ?? mondayOf(t));
      }
    };
    const start = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      d0 = dist(e);
      fired = false;
      cx = (e.touches[0]!.clientX + e.touches[1]!.clientX) / 2;
      cy = (e.touches[0]!.clientY + e.touches[1]!.clientY) / 2;
      el.addEventListener('touchmove', move, { passive: false });
    };
    const end = (e: TouchEvent) => {
      if (e.touches.length >= 2) return;
      d0 = 0;
      el.removeEventListener('touchmove', move);
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchend', end, { passive: true });
    el.addEventListener('touchcancel', end, { passive: true });
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
    };
  }, [t]);

  const thisMon = mondayOf(t);
  const range = `${fmtDate('md', mon)} – ${monthOf(mon) === monthOf(shiftDays(mon, 6)) ? shiftDays(mon, 6).slice(8).replace(/^0/, '') : fmtDate('md', shiftDays(mon, 6))}`;
  const rel = mon === thisMon ? 'This week' : mon === shiftDays(thisMon, 7) ? 'Next week' : mon === shiftDays(thisMon, -7) ? 'Last week' : '';
  const dateText = view === 'week' ? (rel ? `${rel} · ${range}` : range) : fmtDate('month', first);
  return (
    <div ref={root} className={`page plan plan-${view}`}>
      <TabHeader
        title="Plan"
        date={dateText}
        onDateStep={(d) => (view === 'week' ? goWeek(shiftDays(mon, 7 * d)) : goMonth(addMonths(first, d)))}
        accessory={
          <button type="button" className="pl-zoom" onClick={() => (view === 'week' ? zoomOut() : zoomIn(monthOf(t) === monthOf(first) ? thisMon : firstWeekOf(first)))} aria-label={view === 'week' ? 'Zoom out to the month' : 'Back to the week'}>
            {view === 'week' ? 'Month' : 'Week'}
          </button>
        }
      />
      {view === 'week' ? (
        <div className="pl-pullwrap">
          <PullHint pull={pull} />
          <motion.div style={{ y: pull }}>
          <DatePager
            className="pl-pager"
            date={mon}
            step="week"
            onChange={goWeek}
            label="Week"
            prevLabel="Previous week"
            nextLabel="Next week"
            render={(m) => <WeekPage mon={m} log={log} focus={focusWeek === m && m === mon} conflict={m === mon ? conflict : null} setConflict={setConflict} onZoomOut={() => zoomOut(m)} onThisWeek={() => goWeek(thisMon)} pull={pull} />}
          />
          <BlockCard log={log} />
          </motion.div>
        </div>
      ) : (
        <>
          <MonthGrid anchor={anchor} log={log} onWeek={zoomIn} onStep={(d) => goMonth(addMonths(first, d))} focusWeek={focusWeek} />
          <BlockCard log={log} />
        </>
      )}
      {log.strava?.error ? (
        <div className="sec-secondary">
          <Note kind="warn">{log.strava.error}</Note>
        </div>
      ) : null}
    </div>
  );
}
