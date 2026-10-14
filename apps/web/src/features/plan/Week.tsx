import { assess, fmtDate, heroSession, label, mi, mondayOf, num, pad, parseISO, sessionKey, sessionWord, shiftDays, tone, weekSummary, type Activity, type Session, type StatusKey } from '@logbook/shared';
import { ArrowRightLeft, Check, Plus } from 'lucide-react';
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { haptics } from '@/lib/haptics';
import { rowPresence, springs } from '@/lib/motion';
import { useContextMenu, type ContextMenuItem } from '@/ui/ContextMenu';
import { shared } from '@/ui/Sheet';
import { SkeletonGroup, Skeleton } from '@/ui/Skeleton';
import { SwipeRow } from '@/ui/SwipeRow';
import { useToast } from '@/ui/Toast';
import { useFirstToday } from '@/ui/useFirstToday';
import type { Log } from '../log/useLog';
import { sessionCan, useSessionActions } from '../sessions/actions';
import { announceReshape } from '../sessions/MoveSheet';
import { useReshape, type ReshapeResult } from '../sessions/reshape';
import { shareDataFor, useOpenSession, useOpenUnplanned } from '../sessions/SessionCard';
import { PLAN_DAY, useDayDrag } from './useDayDrag';

/** "2026-W42": the shared-element id of a week (docs/foundation.md). */
export const isoWeek = (d: string) => {
  const dt = parseISO(d);
  const th = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() - ((dt.getDay() + 6) % 7) + 3);
  const jan4 = new Date(th.getFullYear(), 0, 4);
  const wk = 1 + Math.round(((th.getTime() - jan4.getTime()) / 864e5 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
  return `${th.getFullYear()}-W${pad(wk)}`;
};

const tenth = (v: number) => num(Math.round(v * 10) / 10);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const nameOf = (s: Session) => (s.kind === 'rest' ? 'Rest' : label(s));
const isTraining = (s: Session) => s.kind !== 'rest';

/** The week's line ("26 mi planned · 5 runs") and the sentence under it, said forward: what is next, never a zero. */
export const weekWords = (log: Log, mon: string) => {
  const w = weekSummary(log.snap, mon);
  const t = log.today;
  const sun = shiftDays(mon, 6);
  const days = Array.from({ length: 7 }, (_, i) => shiftDays(mon, i));
  const training = days.flatMap((d) => log.snap.sessionsOn(d).filter(isTraining).map((s) => [d, s] as const));
  const live = training.filter(([d, s]) => {
    const k = sessionKey(log.snap, d, s);
    return k === 'today' || k === 'planned';
  });
  const next = live.find(([d]) => d >= t) ?? null;
  const when = (d: string) => (d === t ? 'today' : d === shiftDays(t, 1) ? 'tomorrow' : fmtDate('dowLong', d));
  const runsWord = plural(w.runsPlanned, 'run');
  let head: string;
  if (w.plannedMiles > 0) head = `${tenth(w.plannedMiles)} mi planned · ${runsWord}`;
  else if (training.length) head = `${plural(training.length, 'session')} planned`;
  else if (w.doneMiles > 0) head = `${tenth(w.doneMiles)} mi run`;
  else head = sun < t ? 'A quiet week' : 'An open week';
  let sub: string;
  if (sun < t) {
    // a past week: what happened, against what was planned
    sub = w.plannedMiles > 0 && w.doneMiles === 0 ? `${w.keptSessions ? `${w.keptSessions} of ${plural(training.length, 'session')} kept` : 'None of it run'}.${w.kept ? ' Kept.' : ''}` : w.plannedMiles > 0 ? `${tenth(w.doneMiles)} of ${tenth(w.plannedMiles)} mi run${w.runsPlanned ? ` · ${w.runsDone} of ${runsWord}` : ''}.${w.kept ? ' Kept.' : ''}` : w.kept ? 'Kept.' : training.length ? `${w.keptSessions} of ${plural(training.length, 'session')} kept.` : 'Nothing was planned.';
  } else if (mon > t) {
    const first = live[0];
    const long = training.filter(([, s]) => tone(s) === 'long').sort((a, b) => (Number(b[1].miles) || 0) - (Number(a[1].miles) || 0))[0];
    sub = first ? `Opens with ${nameOf(first[1])}, ${fmtDate('dowLong', first[0])}.${long && long !== first ? ` Long run ${fmtDate('dowLong', long[0])}.` : ''}` : 'Tap a day to add a session, or start a block below.';
  } else if (!training.length && w.doneMiles === 0) {
    sub = 'Tap a day to add a session, or start a block below.';
  } else if (w.doneMiles === 0 && !w.keptSessions) {
    // early in the week: say what's next, never "0 of 26"
    sub = next ? (next[0] === t && next[1].kind === 'run' && !training.some(([d, s]) => d < t && s.kind === 'run') ? 'First run today.' : `Next: ${nameOf(next[1])}, ${when(next[0])}.`) : 'Nothing left this week.';
  } else {
    const done = w.plannedMiles > 0 ? `${tenth(w.doneMiles)} of ${tenth(w.plannedMiles)} mi` : w.doneMiles > 0 ? `${tenth(w.doneMiles)} mi run` : `${w.keptSessions} kept`;
    sub = next ? `${done}. Next: ${nameOf(next[1])}, ${when(next[0])}.` : w.kept ? `${done}. Week kept.` : `${done}.`;
  }
  const progress = w.plannedMiles > 0 ? Math.min(1, w.doneMiles / w.plannedMiles) : 0;
  return { head, sub, progress, hasBar: w.plannedMiles > 0, summary: w };
};

/** The status mark at a row's right edge: the one word, drawn. Colour never carries it alone (the word is its name). */
export const StatusGlyph = ({ k, word }: { k: StatusKey; word: string }) => (
  <span className={`pl-glyph g-${k}`} role="img" aria-label={word}>
    {k === 'done' || k === 'bonus' ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : null}
    {k === 'missed' || k === 'skipped' ? <span className="pl-glyph-word">{word}</span> : null}
  </span>
);

/**
 * The week's header: the line, a thin bar of miles done, the sentence. Pull it down to zoom out to the month (it follows
 * the finger; a tick when it would let go into the month). Its touches are its own: the page's pull to refresh starts
 * anywhere else.
 */
export const WeekHeader = ({ log, mon, onZoomOut, offWeek, onThisWeek }: { log: Log; mon: string; onZoomOut: () => void; offWeek: boolean; onThisWeek: () => void }) => {
  const words = weekWords(log, mon);
  const reduce = useReducedMotion();
  const fill = useFirstToday(mon === mondayOf(log.today) ? 'plan-week-bar' : null);
  const ref = useRef<HTMLDivElement>(null);
  const pull = useMotionValue(0);
  const hint = useTransform(pull, [0, 70], [0, 1]);
  const [armed, setArmed] = useState(false);
  const zoom = useRef(onZoomOut);
  zoom.current = onZoomOut;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let y0: number | null = null;
    let x0 = 0;
    let on = false;
    let arm = false;
    const start = (e: TouchEvent) => {
      // the header's own touch: the Shell's pull to refresh must not take it
      e.stopPropagation();
      if (e.touches.length !== 1 || window.scrollY > 0) return (y0 = null);
      y0 = e.touches[0]!.clientY;
      x0 = e.touches[0]!.clientX;
      on = false;
      arm = false;
    };
    const move = (e: TouchEvent) => {
      if (y0 == null) return;
      const dy = e.touches[0]!.clientY - y0;
      const dx = e.touches[0]!.clientX - x0;
      if (!on) {
        if (Math.abs(dy) < 10 && Math.abs(dx) < 10) return;
        if (dy <= 0 || Math.abs(dx) * 1.5 > dy) return (y0 = null);
        on = true;
      }
      if (e.cancelable) e.preventDefault();
      pull.set(Math.max(0, Math.min(110, dy * 0.5)));
      const over = dy * 0.5 >= 56;
      if (over !== arm) {
        arm = over;
        setArmed(over);
        haptics.threshold();
      }
    };
    const end = () => {
      if (on && arm) zoom.current();
      y0 = null;
      on = false;
      arm = false;
      setArmed(false);
      void animate(pull, 0, reduce ? { duration: 0 } : springs.settle);
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
    };
  }, [pull, reduce]);
  return (
    <div ref={ref} className="pl-wh">
      <motion.span className={`pl-pullhint caps ${armed ? 'on' : ''}`} style={{ opacity: hint }} aria-hidden="true">
        {armed ? 'Let go for the month' : 'Pull for the month'}
      </motion.span>
      <motion.div style={{ y: pull }}>
        <div className="pl-wh-top">
          <h2 className="pl-wh-head">{words.head}</h2>
          {offWeek ? (
            <button type="button" className="pl-chip pl-now" onClick={onThisWeek}>
              This week
            </button>
          ) : null}
        </div>
        {words.hasBar ? (
          <div className="pl-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(words.progress * 100)} aria-label={`${tenth(words.summary.doneMiles)} of ${tenth(words.summary.plannedMiles)} miles run`}>
            <motion.i initial={fill && !reduce ? { scaleX: 0 } : false} animate={{ scaleX: words.progress }} transition={reduce ? { duration: 0 } : springs.number} />
          </div>
        ) : null}
        <p className="pl-wh-sub">{words.sub}</p>
      </motion.div>
    </div>
  );
};

export interface Conflict {
  days: string[];
  undo: () => void;
}

/** One session on a day: tap it open, swipe right for Done and left for Move, hold it to lift and drag, or for its menu. */
const SessionLine = ({ date, s, log, lead, onReshaped }: { date: string; s: Session; log: Log; lead: boolean; onReshaped: (r: ReshapeResult, s: Session, to: string) => void }) => {
  const act = useSessionActions(log);
  const open = useOpenSession(log);
  const menu = useContextMenu();
  const { reshape } = useReshape();
  const c = sessionCan(log, date, s);
  const k = sessionKey(log.snap, date, s);
  const word = sessionWord(log.snap, date, s);
  const runs = s.kind === 'run' ? log.snap.runsOn(date) : [];
  const a = runs.length ? assess(log.zones, s, runs) : null;
  const share = runs.length ? shareDataFor(date, s, runs, log) : null;
  const name = nameOf(s);
  const items: ContextMenuItem[] = act.menuItems(date, s, { share });
  const drag = useDayDrag({
    date,
    session: s,
    title: name,
    onDrop: (to) => {
      const r = reshape(log, s, date, to);
      if (r) onReshaped(r, s, to);
    },
    onHoldRelease: (el) => menu.open({ items, anchor: el, label: `${name} actions`, haptic: false }),
  });
  const dist = a ? `${mi(a.miles)} mi` : s.kind === 'run' && s.miles ? `${num(s.miles)} mi` : s.minutes ? `${s.minutes} min` : '';
  const typeWord = s.type && !name.toLowerCase().includes(s.type.toLowerCase()) ? s.type : '';
  const sub = a && runs.length === 1 ? runs[0]!.name : typeWord;
  const swipeRight = c.mark && k !== 'done' ? { label: 'Done', icon: <Check size={22} />, tone: 'ok' as const, onCommit: () => act.done(s) } : undefined;
  const swipeLeft = { label: 'Move', icon: <ArrowRightLeft size={22} />, tone: 'neutral' as const, onCommit: () => act.move(date, s) };
  return (
    <div className="pl-slot" onPointerDown={(e) => e.stopPropagation()}>
      <SwipeRow right={swipeRight} left={swipeLeft} menu={false} label={name}>
        <button
          ref={drag.ref as React.RefObject<HTMLButtonElement>}
          type="button"
          className={`pl-line t-${tone(s)} k-${k} ${drag.lifted ? 'is-lifted' : ''} ${lead ? 'is-lead' : 'is-extra'}`}
          aria-label={`${name}${dist ? `, ${dist}` : ''}, ${word}. Open; hold to move or for actions`}
          onClick={() => (drag.consumeClick() ? undefined : open(date, s, { sharedId: `session-${s.id}` }))}
          onKeyDown={(e) => {
            if ((e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu') {
              e.preventDefault();
              menu.open({ items, anchor: e.currentTarget, label: `${name} actions` });
            }
          }}
          {...drag.bind}
        >
          <span className="pl-tone" aria-hidden="true" />
          <span className="pl-main">
            <span className="stamp pl-name" {...shared(`session-${s.id}`)}>
              {name}
            </span>
            {sub ? <span className="pl-sub">{sub}</span> : null}
          </span>
          <span className="pl-dist">{dist}</span>
          <StatusGlyph k={k} word={word} />
        </button>
      </SwipeRow>
      <button type="button" className="cm-sr" aria-haspopup="menu" onClick={(e) => menu.open({ items, anchor: e.currentTarget.previousElementSibling as HTMLElement, label: `${name} actions`, returnFocus: e.currentTarget })}>
        {name} actions
      </button>
      {drag.portal}
    </div>
  );
};

/** A run that happened with nothing planned for it: Bonus. Tap opens it. */
const BonusLine = ({ date, runs, log }: { date: string; runs: Activity[]; log: Log }) => {
  const openUnplanned = useOpenUnplanned();
  const a = assess(log.zones, null, runs);
  const word = sessionWord(log.snap, date, null);
  return (
    <button type="button" className="pl-line t-easy k-bonus is-lead" onClick={() => openUnplanned(date, runs, log, { sharedId: `run-${date}` })} aria-label={`${runs.map((r) => r.name).join(' and ')}, ${mi(a.miles)} miles, ${word}. Open`}>
      <span className="pl-tone" aria-hidden="true" />
      <span className="pl-main">
        <span className="stamp pl-name" {...shared(`run-${date}`)}>
          {runs.length === 1 ? runs[0]!.name : `${runs.length} runs`}
        </span>
        <span className="pl-sub">Off the plan</span>
      </span>
      <span className="pl-dist">{mi(a.miles)} mi</span>
      <StatusGlyph k="bonus" word={word} />
    </button>
  );
};

/** A quiet day: "Rest". Tap to add a session there; hold for the menu (add, or take the rest day off the plan). */
const RestLine = ({ date, log, rest }: { date: string; log: Log; rest: Session | null }) => {
  const act = useSessionActions(log);
  const menu = useContextMenu();
  const items: ContextMenuItem[] = [{ label: 'Add a session', icon: <Plus size={18} />, onSelect: () => act.add(date) }, ...(rest ? [{ label: 'Move rest day', icon: <ArrowRightLeft size={18} />, onSelect: () => act.move(date, rest) }, { label: 'Delete rest day', destructive: true, onSelect: () => act.del(rest) }] : [])];
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const pos = useRef({ x: 0, y: 0 });
  return (
    <button
      type="button"
      className="pl-line is-rest is-lead"
      aria-label={`${fmtDate('long', date)}, rest. Add a session`}
      onClick={() => (held.current ? (held.current = false) : act.add(date))}
      onPointerDown={(e) => {
        pos.current = { x: e.clientX, y: e.clientY };
        const el = e.currentTarget;
        timer.current = setTimeout(() => {
          held.current = true;
          menu.open({ items, anchor: el, label: 'Rest day actions' });
        }, 450);
      }}
      onPointerMove={(e) => {
        if (timer.current && Math.hypot(e.clientX - pos.current.x, e.clientY - pos.current.y) > 8) {
          clearTimeout(timer.current);
          timer.current = null;
        }
      }}
      onPointerUp={() => timer.current && clearTimeout(timer.current)}
      onPointerCancel={() => timer.current && clearTimeout(timer.current)}
      onContextMenu={(e) => {
        e.preventDefault();
        if ((e.nativeEvent as PointerEvent).pointerType === 'mouse') menu.open({ items, anchor: e.currentTarget, label: 'Rest day actions' });
      }}
    >
      <span className="pl-tone" aria-hidden="true" />
      <span className="pl-main">
        <span className="pl-rest">Rest</span>
      </span>
      {date >= log.today ? <Plus size={18} className="pl-plus" aria-hidden="true" /> : null}
    </button>
  );
};

/** One day: its weekday and date on the left, its sessions as lines on the right. Today is lit. The whole row takes a drop. */
const DayRow = ({ date, log, onReshaped, conflict, onKeep }: { date: string; log: Log; onReshaped: (r: ReshapeResult, s: Session, to: string) => void; conflict: Conflict | null; onKeep: () => void }) => {
  const t = log.today;
  const sessions = log.snap.sessionsOn(date);
  const training = sessions.filter(isTraining);
  const lead = heroSession(training);
  const ordered = lead ? [lead, ...training.filter((s) => s !== lead)] : [];
  const runs = log.snap.runsOn(date);
  const bonus = !training.some((s) => s.kind === 'run') && runs.length > 0;
  const rest = sessions.find((s) => s.kind === 'rest') ?? null;
  const dayK = lead ? sessionKey(log.snap, date, lead) : bonus ? 'bonus' : 'rest';
  const isToday = date === t;
  const showConflict = conflict && conflict.days[1] === date;
  return (
    <>
      <div className={`pl-day ${isToday ? `is-today pl-lit-${dayK}` : ''} ${date < t ? 'is-past' : ''} ${!ordered.length && !bonus ? 'is-quiet' : ''} ${conflict?.days.includes(date) ? 'is-conflict' : ''}`} {...{ [PLAN_DAY]: date }}>
        <div className="pl-date" aria-hidden="true">
          <span className="pl-dow">{isToday ? 'Today' : fmtDate('dow', date)}</span>
          <span className="pl-num">{parseISO(date).getDate()}</span>
        </div>
        <div className="pl-lines">
          {ordered.map((s, i) => (
            <SessionLine key={s.id} date={date} s={s} log={log} lead={i === 0} onReshaped={onReshaped} />
          ))}
          {bonus ? <BonusLine date={date} runs={runs} log={log} /> : null}
          {!ordered.length && !bonus ? <RestLine date={date} log={log} rest={rest} /> : null}
        </div>
      </div>
      <AnimatePresence initial={false}>
        {showConflict ? (
          <motion.div key="conflict" className="pl-conflict" role="alert" {...rowPresence}>
            <p>Two hard days in a row. Keep it?</p>
            <div className="pl-conflict-acts">
              <button type="button" className="pl-chip" onClick={onKeep}>
                Keep it
              </button>
              <button type="button" className="pl-chip on" onClick={conflict!.undo}>
                Undo
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
};

/**
 * The week as seven rows, edge to edge. Drops land here: a move, or a swap onto a day that has a session, with the drop
 * haptic and an Undo toast; two hard days back to back get the warning haptic and the question inline, under the pair.
 */
export const Agenda = ({ mon, log, conflict, setConflict }: { mon: string; log: Log; conflict: Conflict | null; setConflict: (c: Conflict | null) => void }) => {
  const toast = useToast();
  const days = Array.from({ length: 7 }, (_, i) => shiftDays(mon, i));
  if (!log.loaded(mon) || !log.loaded(shiftDays(mon, 6)))
    return (
      <SkeletonGroup label="Loading the week">
        <div className="pl-skel">
          {days.map((d) => (
            <div key={d} className="pl-skel-row">
              <Skeleton w={28} h={32} r={8} />
              <Skeleton w="55%" h={18} r="line" />
            </div>
          ))}
        </div>
      </SkeletonGroup>
    );
  const onReshaped = (r: ReshapeResult) => {
    if (r.conflict) {
      haptics.warning();
      const undo = () => {
        r.undo();
        setConflict(null);
      };
      setConflict({ days: r.conflict, undo });
    } else {
      setConflict(null);
      announceReshape(toast, r);
    }
  };
  return (
    <div className="pl-agenda list-edge" role="list" aria-label={`Week of ${fmtDate('md', mon)}`}>
      {days.map((d) => (
        <DayRow key={d} date={d} log={log} onReshaped={onReshaped} conflict={conflict} onKeep={() => (haptics.toggle(), setConflict(null))} />
      ))}
    </div>
  );
};
