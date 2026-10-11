import { parseISO, buildMorning, clockOfDay, dayStatus, decodePolyline, floorFor, fmtDate, habitStreak, label, mi, mondayOf, MORNING_DEFAULTS, morningDayFor, monthOf, num, pad, relativeDay, routePath, sessionStatus, shiftDays, STATUS_WORD, tone, trainingStreak, weekTotals, type Activity, type Habit, type Session } from '@logbook/shared';
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, Pencil, Settings, X } from 'lucide-react';
import { AnimatePresence, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useHabitMutations, useTodoMutations, useTodos } from '@/api/queries';
import { haptic } from '@/lib/haptics';
import { AnimatedNumber } from '@/ui/AnimatedNumber';
import { Button, Chip, DateNav, EmptyState, Group, IconButton, Loading, Mark, PageHeader, Ring, SectionHead, Stat, StatStrip } from '@/ui/primitives';
import { JournalDaySection } from '../journal/JournalDaySection';
import { useLog } from '../log/useLog';
import { AddSessionButton, sessionMeta, SessionRow, UnplannedRow, useOpenSession } from '../sessions/SessionCard';
import { StravaLine } from '../settings/StravaLine';
import './day.css';

type L = ReturnType<typeof useLog>;
const MONTH_DAY = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' });

// ---------- hero: the day as one card, lit from below ----------
const fmtClock = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const x = sec % 60;
  return h ? `${h}:${pad(m)}:${pad(x)}` : `${m}:${pad(x)}`;
};
const paceOf = (a: Activity) => (a.miles > 0 ? fmtClock(Math.round(a.movingSec / a.miles)) : '—');

const Hero = ({ date, log }: { date: string; log: L }) => {
  const sessions = log.snap.sessionsOn(date);
  const st = dayStatus(log.snap, date);
  const open = useOpenSession(log);
  const main = sessions.find((s) => s.kind === 'run') ?? sessions.find((s) => s.kind !== 'rest') ?? sessions[0] ?? null;
  const runs = log.snap.runsOn(date);
  const run = runs[0] ?? null;
  const morning = useMemo(() => {
    if (date !== log.today || !log.boot) return null;
    const st2 = log.boot.morningSettings ?? MORNING_DEFAULTS;
    const T = buildMorning(morningDayFor(sessions, log.snap.morningOverride(date), st2), st2);
    const out = T.blocks.find((b) => b.key === 'run' || b.key === 'gym');
    return out ? { start: out.start, back: T.back, mode: T.day.mode } : null;
  }, [date, log.today, log.boot, sessions, log.snap]);
  const short = (m: number) => clockOfDay(m).replace(' AM', '').replace(' PM', '');
  const path = useMemo(() => (run?.polyline ? routePath(decodePolyline(run.polyline), 358, 200, 12) : ''), [run?.polyline]);

  let eyebrow: string;
  let title: string;
  let verdict: string;
  let stats: Array<[string, string, string?]>;
  if (!main && !run) {
    eyebrow = date < log.today ? 'That day' : 'Today';
    title = sessions.some((s) => s.kind === 'rest') ? 'Rest' : 'Open';
    verdict = sessions.some((s) => s.kind === 'rest') ? 'A rest day on the plan.' : 'Nothing on the plan. Add a session or let the day breathe.';
    stats = [];
  } else if (run) {
    eyebrow = main ? (date === log.today ? 'Today’s run' : 'The run') : 'Unplanned run';
    title = main ? label(main) : run.name;
    const total = runs.reduce((t, a) => t + a.miles, 0);
    verdict = st === 'floor' ? 'Floor held.' : main ? `Done. ${run.name}.` : `${mi(total)} mi logged from Strava.`;
    stats = [
      ['Distance', mi(total), 'mi'],
      ['Pace', paceOf(run), '/mi'],
      ['Time', fmtClock(run.movingSec)],
      ['Elev', String(run.elevFt), 'ft'],
    ];
  } else {
    const m = main!;
    eyebrow = date === log.today ? 'Today’s training' : 'Training';
    title = label(m);
    const rest = sessions.filter((s) => s !== m && s.kind !== 'rest');
    const coming = rest.filter((s) => ['open', 'upcoming'].includes(sessionStatus(log.snap, date, s))).map(label);
    const extra = coming.length ? ` Then ${coming.join(' and ')}.` : '';
    if (st === 'floor') verdict = `Floor held.${extra}`;
    else if (st === 'missed') verdict = `Missed.${extra}`;
    else if (st === 'done') verdict = `Done.${extra}`;
    else if (morning) verdict = `${morning.mode === 'run' ? 'Out' : 'Gym'} at ${short(morning.start)}, back by ${short(morning.back)}.${extra}`;
    else verdict = `${sessionMeta(m, st) || STATUS_WORD[st]}.${extra}`;
    stats = [
      m.kind === 'run' && m.miles ? ['Plan', num(m.miles), 'mi'] : ['Plan', m.type ?? STATUS_WORD[st] ?? ''],
      (() => {
        const f = floorFor(m);
        const mm = /(\d+)\s*min/.exec(f);
        return mm ? (['Floor', mm[1]!, 'min'] as [string, string, string]) : (['Floor', f ? f.split(/[,\s]/)[0]! : '—'] as [string, string]);
      })(),
      ...(morning ? ([['Out', short(morning.start)], ['Back', short(morning.back)]] as Array<[string, string]>) : ([['Status', STATUS_WORD[st] ?? '']] as Array<[string, string]>)),
    ];
  }
  const target = main ?? null;
  return (
    <motion.div
      className={`aura ${target ? `t-${tone(target)}` : ''} ${path ? 'has-route' : ''}`}
      onClick={target ? () => open(date, target) : undefined}
      onKeyDown={target ? (e) => (e.key === 'Enter' || e.key === ' ' ? (e.preventDefault(), open(date, target)) : undefined) : undefined}
      role={target ? 'button' : undefined}
      tabIndex={target ? 0 : undefined}
      aria-label={target ? `${title}. Open session` : undefined}
      whileTap={target ? { scale: 0.985 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      <span className="aura-glow" aria-hidden="true" />
      <div className="aura-top">
        <span className="caps">{eyebrow}</span>
        <Chip kind={st === 'bonus' ? 'done' : st}>{STATUS_WORD[st] || 'Open'}</Chip>
      </div>
      {path ? (
        <svg className="aura-route" viewBox="0 0 358 200" aria-hidden="true">
          <motion.path d={path} fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: 'easeOut' }} />
        </svg>
      ) : null}
      <h2 className={`aura-title ${path ? 'display' : 'stamp'}`}>{title}</h2>
      <p className="aura-verdict">{verdict}</p>
      {stats.length ? (
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
      ) : null}
      {target ? <ChevronRight className="aura-chev" size={20} aria-hidden="true" /> : null}
    </motion.div>
  );
};


// ---------- habit orbs: a row of lights, each one you can switch on ----------
const Orbs = ({ date, log, list, toggle, noteFor, setNoteFor, timers, save }: { date: string; log: L; list: Habit[]; toggle: (h: Habit) => void; noteFor: string | null; setNoteFor: (id: string | null) => void; timers: React.MutableRefObject<Record<string, ReturnType<typeof setTimeout>>>; save: (id: string, v: string) => void }) => {
  const reduce = useReducedMotion();
  const noted = noteFor ? list.find((h) => h.id === noteFor) : null;
  const done = list.filter((h) => log.snap.isHabitDone(date, h.id)).length;
  return (
    <div className="orbs-wrap">
      <div className="orbs" role="group" aria-label="Habits">
        {list.map((h, i) => {
          const isDone = log.snap.isHabitDone(date, h.id);
          const note = log.snap.checkOf(date, h.id)?.note ?? '';
          return (
            <motion.button
              key={h.id}
              type="button"
              className={`orb ${isDone ? 'on' : ''}`}
              role="checkbox"
              aria-checked={isDone}
              aria-label={h.name}
              title={i < 9 ? `Press ${i + 1}` : undefined}
              whileTap={reduce ? undefined : { scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 500, damping: 28 }}
              onClick={() => toggle(h)}
              onPointerDown={() => {
                clearTimeout(timers.current[`lp-${h.id}`]);
                timers.current[`lp-${h.id}`] = setTimeout(() => {
                  haptic();
                  setNoteFor(h.id);
                  setTimeout(() => document.getElementById(`note-${h.id}`)?.focus());
                }, 450);
              }}
              onPointerUp={() => clearTimeout(timers.current[`lp-${h.id}`])}
              onPointerLeave={() => clearTimeout(timers.current[`lp-${h.id}`])}
              onContextMenu={(e) => e.preventDefault()}
            >
              <motion.span className="orb-ring" initial={false} animate={isDone ? { scale: [1, 1.12, 1] } : { scale: 1 }} transition={{ duration: 0.36, ease: 'easeOut' }}>
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <motion.path d="M20 6 9 17l-5-5" initial={false} animate={{ pathLength: isDone ? 1 : 0, opacity: isDone ? 1 : 0 }} transition={reduce ? { duration: 0 } : isDone ? { pathLength: { duration: 0.18, delay: 0.12, ease: 'easeOut' }, opacity: { duration: 0.01, delay: 0.12 } } : { duration: 0.1 }} />
                </svg>
                {!isDone ? <span className="orb-initial">{h.name.slice(0, 1)}</span> : null}
                {note ? <i className="orb-note" aria-hidden="true" /> : null}
              </motion.span>
              <span className="orb-name">{h.name}</span>
            </motion.button>
          );
        })}
      </div>
      <div className="orbs-meter" aria-hidden="true">
        <motion.i initial={false} animate={{ width: `${list.length ? (done / list.length) * 100 : 0}%` }} transition={{ type: 'spring', stiffness: 120, damping: 22 }} />
      </div>
      {noted ? (
        <div className="orbs-note">
          <input
            className="note-in"
            id={`note-${noted.id}`}
            defaultValue={log.snap.checkOf(date, noted.id)?.note ?? ''}
            placeholder={`A note on ${noted.name}`}
            maxLength={280}
            aria-label={`Note for ${noted.name}`}
            onChange={(e) => {
              clearTimeout(timers.current[noted.id]);
              const v = e.target.value;
              timers.current[noted.id] = setTimeout(() => save(noted.id, v), 600);
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            onBlur={() => setNoteFor(null)}
          />
        </div>
      ) : null}
    </div>
  );
};

// ---------- habits ----------
const HabitsSection = ({ date, log }: { date: string; log: L }) => {
  const { add, patch, reorder, check } = useHabitMutations();
  const [editing, setEditing] = useState(false);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const list = log.habits.filter((h) => h.createdOn <= date);
  const done = list.filter((h) => log.snap.isHabitDone(date, h.id)).length;
  const streakOf = (h: Habit) => habitStreak((d) => log.snap.isHabitDone(d, h.id), log.today);
  const toggle = (h: Habit) => check.mutate({ habitId: h.id, date, done: !log.snap.isHabitDone(date, h.id) });
  const addIt = () => {
    const v = draft.trim();
    if (!v) return;
    add.mutate(v);
    setDraft('');
  };
  const swap = (i: number, j: number) => {
    const ids = log.habits.map((h) => h.id);
    const a = ids[i];
    const b = ids[j];
    if (a === undefined || b === undefined) return;
    ids[i] = b;
    ids[j] = a;
    reorder.mutate(ids);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || editing) return;
      const tg = e.target as HTMLElement | null;
      if (tg && (tg.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName))) return;
      if (document.querySelector('.sheet-wrap')) return;
      const n = Number(e.key);
      const h = list[n - 1];
      if (n >= 1 && n <= 9 && h) {
        e.preventDefault();
        toggle(h);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [list, date, editing]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <SectionHead
        title="Habits"
        meta={list.length ? `${done} of ${list.length}` : undefined}
        action={
          list.length ? (
            <button type="button" className="link" onClick={() => setEditing((e) => !e)}>
              {editing ? 'Done' : 'Edit'}
            </button>
          ) : undefined
        }
      />
      <Group>
        {editing
          ? log.habits.map((h, i) => (
              <div key={h.id} className="lrow">
                <input className="in bare" defaultValue={h.name} aria-label="Habit name" maxLength={80} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== h.name && patch.mutate({ id: h.id, name: e.target.value.trim() })} />
                <IconButton label="Move up" size="sm" disabled={i === 0} onClick={() => swap(i, i - 1)}>
                  <ArrowUp size={16} />
                </IconButton>
                <IconButton label="Move down" size="sm" disabled={i === log.habits.length - 1} onClick={() => swap(i, i + 1)}>
                  <ArrowDown size={16} />
                </IconButton>
                <IconButton label={`Remove ${h.name}`} size="sm" onClick={() => patch.mutate({ id: h.id, archived: true })}>
                  <X size={16} />
                </IconButton>
              </div>
            ))
          : null}
        {!editing && list.length ? <Orbs date={date} log={log} list={list} toggle={toggle} noteFor={noteFor} setNoteFor={setNoteFor} timers={timers} save={(id, v) => check.mutate({ habitId: id, date, note: v })} /> : null}
        {!list.length ? <EmptyState>{date < log.today ? 'No habits yet on this day.' : 'Add the things you want to do every day. Each one becomes a box to tick.'}</EmptyState> : null}
        <div className="lrow-add">
          <input className="in" placeholder="Add a habit" maxLength={80} aria-label="New habit" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addIt())} />
          {draft.trim() ? (
            <Button size="sm" variant="soft" onClick={addIt}>
              Add
            </Button>
          ) : null}
        </div>
      </Group>
    </>
  );
};

// ---------- to-dos: swipe right to complete, left to delete ----------
const TodoRow = ({ x, date, done, carried, onToggle, onDelete, onEdit }: { x: { id: string; text: string; createdOn: string }; date: string; done: boolean; carried: boolean; onToggle: () => void; onDelete: () => void; onEdit: () => void }) => {
  const reduce = useReducedMotion();
  const [gone, setGone] = useState<'left' | 'right' | null>(null);
  const armed = useRef<'left' | 'right' | null>(null);
  const mx = useMotionValue(0);
  // the row has to travel the width of the sign (56px): one tick the moment it would count
  const THRESHOLD = 56;
  const onDrag = () => {
    const v = mx.get();
    const next = v >= THRESHOLD ? 'right' : v <= -THRESHOLD ? 'left' : null;
    if (next && next !== armed.current) haptic('tick');
    armed.current = next;
  };
  const onDragEnd = () => {
    const v = mx.get();
    armed.current = null;
    if (v >= THRESHOLD) {
      haptic('success');
      setGone('right');
      setTimeout(onToggle, 120);
    } else if (v <= -THRESHOLD) {
      haptic('warn');
      setGone('left');
      setTimeout(onDelete, 120);
    }
  };
  return (
    <motion.div className="todo-wrap" layout initial={false} animate={gone ? { height: 0, opacity: 0 } : { height: 'auto', opacity: 1 }} transition={{ duration: 0.18 }}>
      <div className="todo-under" aria-hidden="true">
        <span className="todo-under-left">
          <Check size={20} strokeWidth={2.5} />
        </span>
        <span className="todo-under-right">
          <X size={20} strokeWidth={2.5} />
        </span>
      </div>
      <motion.div className={`lrow trow ${done ? 'is-done' : ''}`} style={{ x: mx }} drag={reduce || done ? false : 'x'} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.7} onDrag={onDrag} onDragEnd={onDragEnd} animate={gone === 'right' ? { x: 120 } : gone === 'left' ? { x: -120 } : { x: 0 }}>
        <Mark status={done ? 'done' : 'open'} square label={x.text} onClick={onToggle} />
        <div className="lrow-main">
          <button type="button" className="hrow-name" onClick={onEdit}>
            {x.text}
          </button>
        </div>
        <div className="lrow-right">
          {carried ? <span className="carried">{fmtDate('md', x.createdOn)}</span> : null}
          {void date}
        </div>
      </motion.div>
    </motion.div>
  );
};

const TodosSection = ({ date }: { date: string }) => {
  const todos = useTodos();
  const { add, patch } = useTodoMutations();
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const all = useMemo(() => (todos.data ?? []).filter((x) => x.createdOn <= date && (!x.doneOn || x.doneOn >= date) && (!x.deletedOn || x.deletedOn > date)).sort((a, b) => (a.createdOn === b.createdOn ? (a.createdAt < b.createdAt ? -1 : 1) : a.createdOn < b.createdOn ? -1 : 1)), [todos.data, date]);
  const open = all.filter((x) => x.doneOn !== date);
  const done = all.filter((x) => x.doneOn === date);
  const addIt = () => {
    const v = draft.trim();
    if (!v) return;
    add.mutate({ text: v, date });
    setDraft('');
  };
  const item = (x: (typeof all)[number], isDone: boolean) =>
    editing === x.id ? (
      <div key={x.id} className="lrow">
        <input
          className="in bare"
          defaultValue={x.text}
          autoFocus
          maxLength={200}
          aria-label="Edit to-do"
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') setEditing(null);
          }}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== x.text) patch.mutate({ id: x.id, text: v });
            setEditing(null);
          }}
        />
      </div>
    ) : (
      <TodoRow key={x.id} x={x} date={date} done={isDone} carried={x.createdOn < date && !isDone} onToggle={() => patch.mutate({ id: x.id, doneOn: isDone ? null : date })} onDelete={() => patch.mutate({ id: x.id, deletedOn: date })} onEdit={() => setEditing(x.id)} />
    );
  return (
    <>
      <SectionHead title="To-dos" meta={open.length ? `${open.length} open` : undefined} />
      <Group>
        {todos.isPending && !todos.data ? <Loading text="Loading to-dos…" /> : null}
        <AnimatePresence initial={false}>{open.map((x) => item(x, false))}</AnimatePresence>
        {!open.length && todos.data ? <EmptyState>{done.length ? 'All clear for today.' : 'Nothing on the list. What you don’t finish rolls to tomorrow.'}</EmptyState> : null}
        <div className="lrow-add">
          <input className="in" placeholder="Add a to-do" maxLength={200} aria-label="New to-do" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addIt())} />
          {draft.trim() ? (
            <Button size="sm" variant="soft" onClick={addIt}>
              Add
            </Button>
          ) : null}
        </div>
        {done.length ? (
          <button type="button" className="lrow done-foot" onClick={() => setShowDone((s) => !s)}>
            <span className="t-sub muted done-foot-label">
              Completed ({done.length})
              <ChevronDown size={16} className={`done-chev ${showDone ? 'open' : ''}`} aria-hidden="true" />
            </span>
          </button>
        ) : null}
        {showDone ? done.map((x) => item(x, true)) : null}
      </Group>
    </>
  );
};

// ---------- the view ----------
export default function DayView() {
  const params = useParams();
  const nav = useNavigate();
  const base = useLog([]);
  const t = base.today;
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : t;
  const months = useMemo(() => [monthOf(shiftDays(date, -7)), monthOf(date), monthOf(shiftDays(date, 7)), monthOf(mondayOf(date))], [date]);
  const log = useLog(months);
  const go = (d: string) => nav(d === t ? '/today' : `/today/${d}`);
  const loaded = log.loaded(date);
  const sessions = log.snap.sessionsOn(date);
  const acts = log.snap.activitiesOn(date);
  const hasRun = sessions.some((s) => s.kind === 'run');
  const hasOther = sessions.some((s) => s.kind === 'lift' || s.kind === 'cross');
  const unplannedRuns = hasRun ? [] : acts.filter((a) => a.kind === 'run');
  const unmatched = hasOther ? [] : acts.filter((a) => a.kind !== 'run');
  const streak = trainingStreak(log.snap);
  const week = weekTotals(log.snap, mondayOf(date));
  const todos = useTodos();
  const openTodos = (todos.data ?? []).filter((x) => x.createdOn <= date && (!x.doneOn || x.doneOn > date) && (!x.deletedOn || x.deletedOn > date)).length;
  const showList = (s: Session) => s.kind !== 'rest' || sessions.length === 1;
  return (
    <div className="page">
      <PageHeader
        title={date === t ? 'Today' : relativeDay(date, t)}
        sub={
          date === t ? (
            fmtDate('long', date)
          ) : (
            <span className="ph-sub-row">
              {date === shiftDays(t, -1) || date === shiftDays(t, 1) ? fmtDate('long', date) : MONTH_DAY.format(parseISO(date))}
              <button type="button" className="link sm" onClick={() => go(t)}>
                Today
              </button>
            </span>
          )
        }
        actions={
          <>
            <DateNav onPrev={() => go(shiftDays(date, -1))} onNext={() => go(shiftDays(date, 1))} prevLabel="Previous day" nextLabel="Next day" />
            <IconButton label="Settings" onClick={() => nav('/settings')}>
              <Settings size={20} />
            </IconButton>
          </>
        }
      />
      <div className="section" style={{ marginTop: 16 }}>
        {loaded ? <Hero date={date} log={log} /> : <div className="skeleton" style={{ height: 128 }} />}
        <StatStrip>
          <Stat label="Week" value={<AnimatedNumber value={week.ran} format={mi} />} unit={week.planned ? `of ${num(week.planned)} mi` : 'mi run'} />
          <Stat label="Streak" value={<AnimatedNumber value={streak} />} unit={streak === 1 ? 'day' : 'days'} />
          <Stat label="To-dos" value={todos.data ? <AnimatedNumber value={openTodos} /> : '…'} unit="open" />
        </StatStrip>
        <StravaLine strava={log.strava} />
      </div>

      <SectionHead title="Training" action={<AddSessionButton date={date}>Add</AddSessionButton>} />
      <Group>
        {!loaded ? <Loading text={`Loading ${fmtDate('month', date)}…`} /> : null}
        {loaded && sessions.filter(showList).length ? (
          <ul>
            {sessions.filter(showList).map((s) => (
              <SessionRow key={s.id} date={date} s={s} log={log} />
            ))}
            {unplannedRuns.length ? <UnplannedRow date={date} runs={unplannedRuns} log={log} /> : null}
          </ul>
        ) : loaded && unplannedRuns.length ? (
          <ul>
            <UnplannedRow date={date} runs={unplannedRuns} log={log} />
          </ul>
        ) : loaded ? (
          <EmptyState action={<AddSessionButton date={date} variant="soft" />}>{date < t ? 'Nothing was planned this day.' : 'Nothing planned. Add a session, or build a plan.'}</EmptyState>
        ) : null}
        {unmatched.map((a) => (
          <div key={a.id} className="lrow">
            <div className="lrow-main">
              <div className="lrow-title">{a.name}</div>
              <div className="lrow-sub">From Strava · {Math.round(a.movingSec / 60)} min</div>
            </div>
          </div>
        ))}
      </Group>
      {!log.strava?.connected && log.features.strava ? (
        <p className="fine" style={{ marginTop: 8 }}>
          <Link to="/settings">Connect Strava</Link> and runs mark themselves done.
        </p>
      ) : null}

      <TodosSection date={date} />
      <HabitsSection date={date} log={log} />
      <JournalDaySection date={date} log={log} />
    </div>
  );
}
