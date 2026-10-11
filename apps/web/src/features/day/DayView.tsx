import { parseISO, buildMorning, clockOfDay, dayStatus, fmtDate, habitStreak, label, mi, mondayOf, MORNING_DEFAULTS, morningDayFor, monthOf, num, relativeDay, shiftDays, STATUS_WORD, tone, trainingStreak, weekTotals, type Habit, type Session } from '@logbook/shared';
import { ArrowDown, ArrowUp, Flame, Pencil, Settings, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'motion/react';
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

// ---------- hero: the day's training, in one glance ----------
const Hero = ({ date, log }: { date: string; log: L }) => {
  const sessions = log.snap.sessionsOn(date);
  const st = dayStatus(log.snap, date);
  const hl = log.habits.filter((h) => h.createdOn <= date);
  const hd = hl.filter((h) => log.snap.isHabitDone(date, h.id)).length;
  const open = useOpenSession(log);
  const main = sessions.find((s) => s.kind === 'run') ?? sessions.find((s) => s.kind !== 'rest') ?? sessions[0] ?? null;
  const runs = log.snap.runsOn(date);
  const morning = useMemo(() => {
    if (date !== log.today || !log.boot) return null;
    const st2 = log.boot.morningSettings ?? MORNING_DEFAULTS;
    const T = buildMorning(morningDayFor(sessions, log.snap.morningOverride(date), st2), st2);
    const out = T.blocks.find((b) => b.key === 'run' || b.key === 'gym');
    return out ? { start: out.start, back: T.back, mode: T.day.mode } : null;
  }, [date, log.today, log.boot, sessions, log.snap]);
  const ringColor = st === 'done' || st === 'bonus' ? 'var(--ok)' : st === 'floor' ? 'var(--ok)' : st === 'missed' ? 'var(--bad)' : 'var(--accent)';
  let title: React.ReactNode;
  let verdict: string;
  if (!main) {
    title = runs.length ? 'Unplanned run' : date < log.today ? 'Nothing planned' : 'Rest';
    verdict = runs.length ? `${mi(runs.reduce((t, a) => t + a.miles, 0))} mi logged from Strava.` : sessions.some((s) => s.kind === 'rest') ? 'A rest day on the plan.' : 'No session on the plan. Add one or let the day breathe.';
  } else {
    title = <span style={{ color: `var(--t-${tone(main)})` }}>{label(main)}</span>;
    const rest = sessions.filter((s) => s !== main && s.kind !== 'rest');
    const meta = sessionMeta(main, st);
    const extra = rest.length ? ` Then ${rest.map(label).join(' and ')}.` : '';
    const short = (m: number) => clockOfDay(m).replace(' AM', '').replace(' PM', '');
    if (st === 'done' || st === 'bonus') verdict = runs.length ? `Done, ${mi(runs.reduce((t, a) => t + a.miles, 0))} mi logged.${extra}` : `Done.${extra}`;
    else if (st === 'floor') verdict = `Floor hit. Enough to keep the streak.${extra}`;
    else if (st === 'missed') verdict = `Missed.${extra}`;
    else if (morning) verdict = `${morning.mode === 'run' ? 'Out' : 'Gym'} at ${short(morning.start)}, back by ${short(morning.back)}.${extra}`;
    else verdict = `${meta || STATUS_WORD[st]}.${extra}`;
  }
  return (
    <div className="hero" onClick={main ? () => open(date, main) : undefined} role={main ? 'button' : undefined} tabIndex={main ? 0 : undefined}>
      <Ring value={hl.length ? hd / hl.length : 0} size={96} stroke={7} color={ringColor} label={`${hd} of ${hl.length} habits`}>
        <span className="t-stat">{hl.length ? hd : '—'}</span>
        <span className="t-cap muted">{hl.length ? `of ${hl.length}` : 'habits'}</span>
      </Ring>
      <div className="hero-main">
        <span className="t-label muted">{date === log.today ? 'Today’s training' : 'Training'}</span>
        <h2 className="hero-title">{title}</h2>
        <p className="hero-verdict">{verdict}</p>
        <div className="hero-foot">
          <Chip kind={st === 'bonus' ? 'done' : st}>{STATUS_WORD[st] || 'Nothing planned'}</Chip>
          {sessions.length > 1 ? <Chip>{sessions.length} sessions</Chip> : null}
        </div>
      </div>
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
        {(editing ? log.habits : list).map((h, i) => {
          if (editing)
            return (
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
            );
          const isDone = log.snap.isHabitDone(date, h.id);
          const note = log.snap.checkOf(date, h.id)?.note ?? '';
          const n = streakOf(h);
          const noteOpen = !!note || noteFor === h.id;
          return (
            <div key={h.id} className={`lrow hrow ${isDone ? 'is-done' : ''}`}>
              <Mark status={isDone ? 'done' : 'open'} label={h.name} title={i < 9 ? `Press ${i + 1}` : undefined} onClick={() => toggle(h)} />
              <div className="lrow-main">
                <button
                  type="button"
                  className="hrow-name"
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
                  {h.name}
                </button>
                {noteOpen ? (
                  <input
                    className="note-in"
                    id={`note-${h.id}`}
                    defaultValue={note}
                    placeholder="Add a note"
                    maxLength={280}
                    aria-label={`Note for ${h.name}`}
                    onChange={(e) => {
                      clearTimeout(timers.current[h.id]);
                      const v = e.target.value;
                      timers.current[h.id] = setTimeout(() => check.mutate({ habitId: h.id, date, note: v }), 600);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    onBlur={(e) => !e.target.value && setNoteFor(null)}
                  />
                ) : null}
              </div>
              <div className="lrow-right">
                {n >= 2 ? (
                  <span className="streak" title={`${n}-day streak`}>
                    <Flame size={13} /> {n}
                  </span>
                ) : null}
                {!noteOpen ? (
                  <IconButton
                    label="Add a note"
                    size="sm"
                    className="hover-only"
                    onClick={() => {
                      setNoteFor(h.id);
                      setTimeout(() => document.getElementById(`note-${h.id}`)?.focus());
                    }}
                  >
                    <Pencil size={14} />
                  </IconButton>
                ) : null}
              </div>
            </div>
          );
        })}
        {!list.length ? <EmptyState>Add the things you want to do every day. Each one becomes a box to tick.</EmptyState> : null}
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
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > 80) {
      haptic('success');
      setGone('right');
      setTimeout(onToggle, 120);
    } else if (info.offset.x < -80) {
      haptic('warn');
      setGone('left');
      setTimeout(onDelete, 120);
    }
  };
  return (
    <motion.div className="todo-wrap" layout initial={false} animate={gone ? { height: 0, opacity: 0 } : { height: 'auto', opacity: 1 }} transition={{ duration: 0.18 }}>
      <div className="todo-under">
        <span className="todo-under-left">Done</span>
        <span className="todo-under-right">Delete</span>
      </div>
      <motion.div className={`lrow trow ${done ? 'is-done' : ''}`} drag={reduce || done ? false : 'x'} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.5} onDragEnd={onDragEnd} animate={gone === 'right' ? { x: 120 } : gone === 'left' ? { x: -120 } : { x: 0 }}>
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
            <span className="t-sub muted">
              Completed ({done.length}) {showDone ? '▾' : '▸'}
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
        sub={date === t || date === shiftDays(t, -1) || date === shiftDays(t, 1) ? fmtDate('long', date) : MONTH_DAY.format(parseISO(date))}
        actions={
          <>
            {date !== t ? (
              <Button size="sm" variant="ghost" onClick={() => go(t)}>
                Today
              </Button>
            ) : null}
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
