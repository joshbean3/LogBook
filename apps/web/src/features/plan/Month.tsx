import { addMonths, fmtDate, heroSession, label, mondayOf, monthStart, num, parseISO, sessionKey, sessionStatus, shiftDays, tone, weekSummary, type Session } from '@logbook/shared';
import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { useLayoutEffect, useRef } from 'react';
import { haptics } from '@/lib/haptics';
import { getDragInfo } from '@/lib/useDrag';
import { springs } from '@/lib/motion';
import { useContextMenu } from '@/ui/ContextMenu';
import { useToast } from '@/ui/Toast';
import type { Log } from '../log/useLog';
import { useSessionActions } from '../sessions/actions';
import { announceReshape } from '../sessions/MoveSheet';
import { useReshape } from '../sessions/reshape';
import { PLAN_DAY, useDayDrag } from './useDayDrag';
import { isoWeek } from './Week';

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const tenth = (v: number) => num(Math.round(v * 10) / 10);

/** The Mondays of every week that touches the month. */
export const monthWeeks = (anchor: string) => {
  const first = monthStart(anchor);
  const next = addMonths(first, 1);
  const out: string[] = [];
  for (let m = mondayOf(first); m < next; m = shiftDays(m, 7)) out.push(m);
  return out;
};

/** One day in the grid: its date, its miles (run when it happened, planned in ink-3 when it is ahead), a heat for done vs plan. */
const Cell = ({ d, log, inMonth, maxMi }: { d: string; log: Log; inMonth: boolean; maxMi: number }) => {
  const t = log.today;
  const sessions = log.snap.sessionsOn(d).filter((s) => s.kind !== 'rest');
  const lead = heroSession(sessions);
  const ran = log.snap.runsOn(d).reduce((x, a) => x + a.miles, 0);
  const planned = sessions.reduce((x, s) => x + (s.kind === 'run' && sessionStatus(log.snap, d, s) !== 'skipped' ? Number(s.miles) || 0 : 0), 0);
  const k = lead ? sessionKey(log.snap, d, lead) : ran ? 'bonus' : 'rest';
  // heat: a done day glows by its share of the month's biggest day; a floor day is amber; a missed one is outlined
  // a day kept by a mark or logged sets, with no run miles, still glows a little
  const heat = ran > 0 ? 0.18 + 0.62 * Math.min(1, ran / Math.max(1, maxMi)) : k === 'done' || k === 'floor' || k === 'bonus' ? 0.34 : 0;
  const cls = ['mg-cell', inMonth ? '' : 'out', d === t ? 'is-today' : '', `k-${k}`, lead ? `t-${tone(lead)}` : ''].join(' ');
  const miles = ran > 0 ? tenth(ran) : planned > 0 ? tenth(planned) : '';
  const body = (
    <>
      <span className="mg-num">{parseISO(d).getDate()}</span>
      {miles ? <span className={`mg-mi ${ran > 0 ? 'ran' : 'plan'}`}>{miles}</span> : lead ? <i className="mg-dot" /> : null}
      {lead && d >= t && ran === 0 ? <i className="mg-bar" /> : null}
    </>
  );
  if (!inMonth) return <span className={cls}>{body}</span>;
  return lead && k !== 'done' && k !== 'floor' ? (
    <DraggableCell d={d} log={log} lead={lead} cls={cls} heat={heat}>
      {body}
    </DraggableCell>
  ) : (
    <span className={cls} style={heat ? ({ '--heat': heat } as React.CSSProperties) : undefined} {...{ [PLAN_DAY]: d }}>
      {body}
    </span>
  );
};

/** A day with a session still to do: hold it and drag it to another day of the month (a move, or a swap). */
const DraggableCell = ({ d, log, lead, cls, heat, children }: { d: string; log: Log; lead: Session; cls: string; heat: number; children: React.ReactNode }) => {
  const toast = useToast();
  const menu = useContextMenu();
  const act = useSessionActions(log);
  const { reshape } = useReshape();
  const drag = useDayDrag({
    date: d,
    session: lead,
    title: label(lead),
    onDrop: (to) => {
      const r = reshape(log, lead, d, to);
      if (r) announceReshape(toast, r);
    },
    onHoldRelease: (el) => menu.open({ items: act.menuItems(d, lead), anchor: el, label: `${label(lead)} actions`, haptic: false }),
  });
  return (
    <span ref={drag.ref as React.RefObject<HTMLSpanElement>} className={`${cls} ${drag.lifted ? 'is-lifted' : ''}`} style={heat ? ({ '--heat': heat } as React.CSSProperties) : undefined} {...{ [PLAN_DAY]: d }} {...drag.bind} onClickCapture={(e) => (drag.consumeClick() ? (e.stopPropagation(), e.preventDefault()) : undefined)}>
      {children}
      {drag.portal}
    </span>
  );
};

/**
 * Zoomed out: the month as weeks, seven days and the week's total. Each week is one button (tap: back into that week);
 * a day still to do can be held and dragged to another day of this month (days outside the month take nothing). Swipe
 * the grid sideways for another month.
 */
export const MonthGrid = ({ anchor, log, onWeek, onStep, focusWeek }: { anchor: string; log: Log; onWeek: (mon: string) => void; onStep: (dir: -1 | 1) => void; focusWeek: string | null }) => {
  const reduce = useReducedMotion();
  const first = monthStart(anchor);
  const next = addMonths(first, 1);
  const weeks = monthWeeks(anchor);
  const t = log.today;
  let maxMi = 0;
  for (const m of weeks) for (let i = 0; i < 7; i++) maxMi = Math.max(maxMi, log.snap.runsOn(shiftDays(m, i)).reduce((x, a) => x + a.miles, 0));
  // the sideways swipe: the grid follows the finger, and the new month slides in from the side it lies on
  const x = useMotionValue(0);
  const g = useRef({ id: -1, x0: 0, y0: 0, lock: null as null | 'x' | 'y' });
  const shown = useRef(first);
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const was = shown.current;
    shown.current = first;
    if (was === first || reduce) return;
    const dir = first > was ? 1 : -1;
    x.jump(dir * (ref.current?.offsetWidth ?? 360) * 0.6);
    const c = animate(x, 0, springs.page);
    return () => c.stop();
  }, [first, reduce, x]);
  const onPointerDown = (e: React.PointerEvent) => {
    if (!e.isPrimary) return;
    g.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, lock: null };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const st = g.current;
    if (e.pointerId !== st.id) return;
    // a day in the air owns the finger
    if (getDragInfo()) {
      st.id = -1;
      void animate(x, 0, springs.settle);
      return;
    }
    const dx = e.clientX - st.x0;
    const dy = e.clientY - st.y0;
    if (!st.lock) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      st.lock = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (st.lock === 'x') x.set(dx * 0.6);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const st = g.current;
    if (e.pointerId !== st.id) return;
    st.id = -1;
    if (st.lock !== 'x') return;
    const dx = e.clientX - st.x0;
    if (Math.abs(dx) > 70) {
      haptics.select();
      onStep(dx < 0 ? 1 : -1);
    } else void animate(x, 0, reduce ? { duration: 0 } : springs.settle);
  };
  return (
    <div ref={ref} className="mg" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => (g.current.id = -1, void animate(x, 0, springs.settle))}>
      <div className="mg-head" aria-hidden="true">
        {DOW.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
        <span className="mg-tot-h">Wk</span>
      </div>
      <motion.div className="mg-weeks" style={{ x }} initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} transition={reduce ? { duration: 0.15 } : springs.page}>
        {weeks.map((mon) => {
          const w = weekSummary(log.snap, mon);
          const thisWeek = mon === mondayOf(t);
          const ratio = w.plannedMiles > 0 ? Math.min(1, w.doneMiles / w.plannedMiles) : w.doneMiles > 0 ? 1 : 0;
          const past = shiftDays(mon, 6) < t;
          // never a zero as the week's number: a week with nothing run yet shows what it planned, muted
          const ranAny = w.doneMiles > 0;
          const total = ranAny ? tenth(w.doneMiles) : w.plannedMiles ? tenth(w.plannedMiles) : '';
          const of = ranAny ? (w.plannedMiles ? `of ${tenth(w.plannedMiles)}` : '') : w.plannedMiles ? (past ? 'none run' : 'planned') : '';
          return (
            <button key={mon} type="button" data-week={mon} className={`mg-week ${thisWeek ? 'is-now' : ''}`} aria-label={`Week of ${fmtDate('md', mon)}: ${w.plannedMiles ? `${tenth(w.doneMiles)} of ${tenth(w.plannedMiles)} miles` : `${tenth(w.doneMiles)} miles`}${w.kept && past ? ', kept' : ''}. Open the week`} onClick={() => onWeek(mon)}>
              {focusWeek === mon ? <motion.span className="mg-plate" layoutId={`week-${isoWeek(mon)}`} transition={springs.page} /> : null}
              {Array.from({ length: 7 }, (_, i) => {
                const d = shiftDays(mon, i);
                return <Cell key={d} d={d} log={log} inMonth={d >= first && d < next} maxMi={maxMi} />;
              })}
              <span className={`mg-tot ${past && w.kept ? 'kept' : ''} ${ranAny ? '' : 'is-plan'}`} style={{ '--ratio': ratio } as React.CSSProperties}>
                <b>{total}</b>
                {of ? <small>{of}</small> : null}
              </span>
            </button>
          );
        })}
      </motion.div>
      <p className="mg-key fine">
        <i className="mg-key-ran" /> run · <i className="mg-key-plan" /> planned · tap a week to open it
      </p>
    </div>
  );
};
