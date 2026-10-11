import { dayStatus, fmtDate, habitStreak, monthOf, relativeDay, shiftDays, STATUS_WORD, trainingStreak, type Habit } from '@logbook/shared';
import { ArrowUp, ArrowDown, Pencil, X, Settings } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router';
import { useHabitMutations, useTodoMutations, useTodos } from '@/api/queries';
import { itemVariants, listVariants } from '@/lib/motion';
import { AnimatedNumber } from '@/ui/AnimatedNumber';
import { Button, Card, CardHead, DateNav, Empty, IconButton, Kpi, Loading, Mark, Note, PageHeader } from '@/ui/primitives';
import { JournalDaySection } from '../journal/JournalDaySection';
import { useLog } from '../log/useLog';
import { AddSessionButton, SessionCard, UnplannedCard } from '../sessions/SessionCard';
import { StravaLine } from '../settings/StravaLine';
import './day.css';

const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? 'Still up?' : h < 12 ? 'Good morning.' : h < 17 ? 'Good afternoon.' : 'Good evening.';
};

// ---------- habits ----------
const HabitsCard = ({ date, log }: { date: string; log: ReturnType<typeof useLog> }) => {
  const { add, patch, reorder, check } = useHabitMutations();
  const [editing, setEditing] = useState(false);
  const [openNotes, setOpenNotes] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState('');
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const list = log.habits.filter((h) => h.createdOn <= date);
  const done = list.filter((h) => log.snap.isHabitDone(date, h.id)).length;
  const streakOf = (h: Habit) => habitStreak((d) => log.snap.isHabitDone(d, h.id), log.today);
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
  // 1-9 ticks a habit when nothing is being typed
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
        check.mutate({ habitId: h.id, date, done: !log.snap.isHabitDone(date, h.id) });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [list, date, editing, check, log.snap]);
  return (
    <Card className="a-habits">
      <CardHead title="Habits" meta={list.length ? `${done} of ${list.length}` : undefined}>
        <button type="button" className="link" onClick={() => setEditing((e) => !e)}>
          {editing ? 'Done' : 'Edit'}
        </button>
      </CardHead>
      {list.length ? (
        <motion.ul className="habits" variants={listVariants} initial="hidden" animate="show">
          {(editing ? log.habits : list).map((h, i) => {
            if (editing)
              return (
                <li key={h.id} className="habit editing">
                  <input className="in bare" defaultValue={h.name} aria-label="Habit name" maxLength={80} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== h.name && patch.mutate({ id: h.id, name: e.target.value.trim() })} />
                  <div className="row" style={{ gap: 0 }}>
                    <IconButton label="Move up" size="sm" disabled={i === 0} onClick={() => swap(i, i - 1)}>
                      <ArrowUp size={15} />
                    </IconButton>
                    <IconButton label="Move down" size="sm" disabled={i === log.habits.length - 1} onClick={() => swap(i, i + 1)}>
                      <ArrowDown size={15} />
                    </IconButton>
                    <IconButton label={`Remove ${h.name}`} size="sm" onClick={() => patch.mutate({ id: h.id, archived: true })}>
                      <X size={15} />
                    </IconButton>
                  </div>
                </li>
              );
            const isDone = log.snap.isHabitDone(date, h.id);
            const note = log.snap.checkOf(date, h.id)?.note ?? '';
            const n = streakOf(h);
            const open = !!note || openNotes.has(h.id);
            return (
              <motion.li key={h.id} variants={itemVariants} className={`habit ${isDone ? 'is-done' : ''}`}>
                <Mark status={isDone ? 'done' : 'open'} small label={h.name} title={i < 9 ? `Press ${i + 1}` : undefined} onClick={() => check.mutate({ habitId: h.id, date, done: !isDone })} />
                <div className="habit-main">
                  <button type="button" className="habit-name" onClick={() => check.mutate({ habitId: h.id, date, done: !isDone })}>
                    {h.name}
                  </button>
                  {open ? (
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
                      onBlur={(e) => {
                        if (!e.target.value)
                          setOpenNotes((s) => {
                            const n2 = new Set(s);
                            n2.delete(h.id);
                            return n2;
                          });
                      }}
                    />
                  ) : null}
                </div>
                {n >= 2 ? (
                  <span className="streak" title={`${n}-day streak`}>
                    {n}d
                  </span>
                ) : null}
                {!open ? (
                  <IconButton
                    label="Add a note"
                    size="sm"
                    className="faint"
                    onClick={() => {
                      setOpenNotes((s) => new Set(s).add(h.id));
                      setTimeout(() => document.getElementById(`note-${h.id}`)?.focus());
                    }}
                  >
                    <Pencil size={14} />
                  </IconButton>
                ) : null}
              </motion.li>
            );
          })}
        </motion.ul>
      ) : (
        <Empty>Add the things you want to do every day. Each one becomes a box to tick.</Empty>
      )}
      <div className="row">
        <input className="in" placeholder="Add a habit" maxLength={80} aria-label="New habit" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addIt())} />
        <Button onClick={addIt}>Add</Button>
      </div>
    </Card>
  );
};

// ---------- to-dos ----------
const TodosCard = ({ date }: { date: string }) => {
  const todos = useTodos();
  const { add, patch } = useTodoMutations();
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const list = useMemo(
    () =>
      (todos.data ?? [])
        .filter((x) => x.createdOn <= date && (!x.doneOn || x.doneOn >= date) && (!x.deletedOn || x.deletedOn > date))
        .sort((a, b) => {
          const ad = a.doneOn === date ? 1 : 0;
          const bd = b.doneOn === date ? 1 : 0;
          if (ad !== bd) return ad - bd;
          return a.createdOn === b.createdOn ? (a.createdAt < b.createdAt ? -1 : 1) : a.createdOn < b.createdOn ? -1 : 1;
        }),
    [todos.data, date],
  );
  const open = list.filter((x) => x.doneOn !== date).length;
  const addIt = () => {
    const v = draft.trim();
    if (!v) return;
    add.mutate({ text: v, date });
    setDraft('');
  };
  return (
    <Card className="a-todos">
      <CardHead title="To-dos" meta={list.length ? `${open} open${list.length - open ? ` · ${list.length - open} done` : ''}` : undefined} />
      {todos.isPending && !todos.data ? (
        <Loading text="Loading to-dos…" />
      ) : list.length ? (
        <ul className="todos">
          {list.map((x) => {
            const done = x.doneOn === date;
            const carried = x.createdOn < date && !done;
            if (editing === x.id)
              return (
                <li key={x.id} className="todo editing">
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
                </li>
              );
            return (
              <motion.li key={x.id} layout className={`todo ${done ? 'is-done' : ''}`}>
                <Mark status={done ? 'done' : 'open'} small label={x.text} onClick={() => patch.mutate({ id: x.id, doneOn: done ? null : date })} />
                <button type="button" className="todo-text" title="Tap to edit" onClick={() => setEditing(x.id)}>
                  {x.text}
                </button>
                {carried ? (
                  <span className="carried" title={`Added ${fmtDate('short', x.createdOn)}`}>
                    from {fmtDate('md', x.createdOn)}
                  </span>
                ) : null}
                <IconButton label={`Delete ${x.text}`} size="sm" className="faint" onClick={() => patch.mutate({ id: x.id, deletedOn: date })}>
                  <X size={14} />
                </IconButton>
              </motion.li>
            );
          })}
        </ul>
      ) : (
        <Empty>Nothing on the list. Anything you don’t finish rolls over to the next day.</Empty>
      )}
      <div className="row">
        <input className="in" placeholder="Add a to-do" maxLength={200} aria-label="New to-do" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addIt())} />
        <Button onClick={addIt}>Add</Button>
      </div>
    </Card>
  );
};

// ---------- the view ----------
export default function DayView() {
  const params = useParams();
  const nav = useNavigate();
  const log = useLog([]);
  const t = log.today;
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : t;
  const months = useMemo(() => [monthOf(shiftDays(date, -7)), monthOf(date), monthOf(shiftDays(date, 7))], [date]);
  const full = useLog(months);
  const go = (d: string) => nav(d === t ? '/today' : `/today/${d}`);
  const loaded = full.loaded(date);
  const sessions = full.snap.sessionsOn(date);
  const acts = full.snap.activitiesOn(date);
  const st = dayStatus(full.snap, date);
  const hl = full.habits.filter((h) => h.createdOn <= date);
  const hd = hl.filter((h) => full.snap.isHabitDone(date, h.id)).length;
  const hasRun = sessions.some((s) => s.kind === 'run');
  const hasOther = sessions.some((s) => s.kind === 'lift' || s.kind === 'cross');
  const unplannedRuns = hasRun ? [] : acts.filter((a) => a.kind === 'run');
  const unmatched = hasOther ? [] : acts.filter((a) => a.kind !== 'run');
  const streak = trainingStreak(full.snap);
  const todos = useTodos();
  const openTodos = (todos.data ?? []).filter((x) => x.createdOn <= date && (!x.doneOn || x.doneOn > date) && (!x.deletedOn || x.deletedOn > date)).length;
  return (
    <div className="page">
      <PageHeader
        eyebrow={date === t ? greeting() : fmtDate('dowLong', date)}
        title={date === t ? 'Today' : relativeDay(date, t)}
        sub={fmtDate('long', date)}
        actions={
          <>
            <DateNav onPrev={() => go(shiftDays(date, -1))} onNext={() => go(shiftDays(date, 1))} prevLabel="Previous day" nextLabel="Next day" />
            {date !== t ? (
              <Button size="sm" variant="ghost" onClick={() => go(t)}>
                Today
              </Button>
            ) : null}
            <IconButton label="Settings" onClick={() => nav('/settings')}>
              <Settings size={18} />
            </IconButton>
          </>
        }
      >
        <StravaLine strava={full.strava} />
        <div className="kpis">
          <Kpi label="Training" value={loaded ? STATUS_WORD[st] || (sessions.length ? '' : 'Nothing planned') : '…'} tone={st === 'done' || st === 'floor' || st === 'bonus' ? 'done' : st === 'missed' ? 'missed' : st === 'open' ? 'open' : ''} />
          <Kpi label="Habits" value={hl.length ? <AnimatedNumber value={hd} /> : '—'} unit={hl.length ? `/ ${hl.length}` : undefined} />
          <Kpi label="To-dos open" value={todos.data ? <AnimatedNumber value={openTodos} /> : '…'} />
          <Kpi label="Training streak" value={<AnimatedNumber value={streak} />} unit={streak === 1 ? 'day' : 'days'} />
        </div>
      </PageHeader>

      <div className="day-grid">
        <Card className="a-train">
          <CardHead title="Training">
            <AddSessionButton date={date} />
          </CardHead>
          {!loaded ? (
            <Loading text={`Loading ${fmtDate('month', date)}…`} />
          ) : sessions.length ? (
            <motion.div className="scards" variants={listVariants} initial="hidden" animate="show">
              {sessions.map((s) => (
                <motion.div key={s.id} variants={itemVariants}>
                  <SessionCard date={date} s={s} log={full} />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <Empty>{date < t ? 'Nothing was planned this day.' : 'Nothing planned. Add a session, or build a plan from the Plan tab.'}</Empty>
          )}
          {unplannedRuns.length ? <UnplannedCard date={date} runs={unplannedRuns} log={full} /> : null}
          {unmatched.length ? (
            <div className="stack" style={{ gap: 6 }}>
              <span className="mini-label">From Strava</span>
              {unmatched.map((a) => (
                <div key={a.id} className="run-line">
                  <span style={{ fontWeight: 600 }}>{a.name}</span>
                  <span className="muted">{Math.round(a.movingSec / 60)} min</span>
                </div>
              ))}
            </div>
          ) : null}
          {full.strava?.error ? <Note kind="warn">{full.strava.error}</Note> : null}
          {!full.strava?.connected && full.features.strava ? (
            <p className="fine">
              <Link to="/settings">Connect Strava</Link> and runs mark themselves done.
            </p>
          ) : null}
        </Card>
        <TodosCard date={date} />
        <HabitsCard date={date} log={full} />
        <JournalDaySection date={date} log={full} />
      </div>
    </div>
  );
}
