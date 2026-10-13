import { parseISO, buildMorning, clockOfDay, dayStatus, decodePolyline, floorFor, fmtDate, habitStreak, label, mi, mondayOf, MORNING_DEFAULTS, morningDayFor, monthOf, num, pad, relativeDay, routePath, sessionStatus, shiftDays, STATUS_WORD, tone, trainingStreak, weekTotals, type Habit, type Session } from '@logbook/shared';
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, GripVertical, Pencil, Settings, Share, X } from 'lucide-react';
import { AnimatePresence, motion, Reorder, useDragControls, useMotionValue, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useHabitMutations, useTodoMutations, useTodos } from '@/api/queries';
import { haptic } from '@/lib/haptics';
import { DROP_SPRING, INSTANT, liftFx, useHoldDrag } from '@/lib/useDrag';
import { useMedia } from '@/lib/useToday';
import { AnimatedNumber } from '@/ui/AnimatedNumber';
import { Button, Chip, DateNav, EmptyState, Group, IconButton, Loading, Mark, PageHeader, Ring, SectionHead, Stat, StatStrip } from '@/ui/primitives';
import { JournalDaySection } from '../journal/JournalDaySection';
import { useLog } from '../log/useLog';
import { AddSessionButton, DropWeekStrip, sessionMeta, SessionRow, shareDataFor, UnplannedRow, UnplannedSheet, useOpenSession } from '../sessions/SessionCard';
import { ShareSheet } from '../share/ShareSheet';
import { useSheet } from '@/ui/Sheet';
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

const Hero = ({ date, log }: { date: string; log: L }) => {
  const sessions = log.snap.sessionsOn(date);
  const st = dayStatus(log.snap, date);
  const open = useOpenSession(log);
  const sheet = useSheet();
  const main = sessions.find((s) => s.kind === 'run') ?? sessions.find((s) => s.kind !== 'rest') ?? sessions[0] ?? null;
  const runs = log.snap.runsOn(date);
  const run = runs[0] ?? null;
  const morning = useMemo(() => {
    if (date !== log.today || !log.boot) return null;
    const st2 = log.boot.morningSettings ?? MORNING_DEFAULTS;
    const T = buildMorning(morningDayFor(sessions, log.snap.morningOverride(date), st2), st2);
    const out = T.blocks.find((b) => b.key === 'run' || b.key === 'gym');
    // a rest morning has no out block: only the door matters
    return out ? { start: out.start, back: T.back, mode: T.day.mode, leave: T.leave } : T.day.mode === 'rest' ? { start: null, back: T.back, mode: T.day.mode, leave: T.leave } : null;
  }, [date, log.today, log.boot, sessions, log.snap]);
  const short = (m: number) => clockOfDay(m).replace(' AM', '').replace(' PM', '');
  // at 320 the eyebrow shares its line with Share and the status chip, so the plan's label stands alone
  const narrow = useMedia('(max-width: 359px)');
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
    // the run that happened leads: its name in the serif, the plan as the eyebrow, the actual against the plan in the verdict and the strip
    const plan = main?.kind === 'run' ? main : null;
    const planned = plan ? Number(plan.miles) || 0 : 0;
    const total = runs.reduce((t, a) => t + a.miles, 0);
    const sec = runs.reduce((t, a) => t + a.movingSec, 0);
    const pace = total > 0 ? fmtClock(Math.round(sec / total)) : '—';
    eyebrow = plan ? (narrow ? label(plan) : `${label(plan)} · Plan`) : main ? (date === log.today ? 'Today’s run' : 'The run') : 'Unplanned';
    title = runs.length === 1 ? run.name : `${runs.length} runs`;
    const word = st === 'floor' ? 'Floor held.' : 'Done.';
    verdict = plan ? (planned ? `${mi(total)} of ${num(planned)} mi. ${word}` : `${mi(total)} mi. ${word}`) : `${mi(total)} mi, off the plan.`;
    stats = plan
      ? [
          ['Distance', mi(total), 'mi'],
          planned ? ['Plan', num(planned), 'mi'] : ['Plan', plan.type ?? 'Run'],
          ['Pace', pace, '/mi'],
          ['Time', fmtClock(sec)],
        ]
      : [
          ['Distance', mi(total), 'mi'],
          ['Pace', pace, '/mi'],
          ['Time', fmtClock(sec)],
          ['Elev', String(runs.reduce((t, a) => t + a.elevFt, 0)), 'ft'],
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
    else if (morning?.start != null) verdict = `${morning.mode === 'run' ? 'Out' : 'Gym'} at ${short(morning.start)}, back by ${short(morning.back)}.${extra}`;
    else if (morning) verdict = `${m.kind === 'rest' ? 'Rest' : 'Rest morning'}. Leave at ${short(morning.leave)}.${extra}`;
    else verdict = `${sessionMeta(m, st) || STATUS_WORD[st]}.${extra}`;
    stats = [
      m.kind === 'run' && m.miles ? ['Plan', num(m.miles), 'mi'] : ['Plan', m.type ?? STATUS_WORD[st] ?? ''],
      (() => {
        const f = floorFor(m);
        const mm = /(\d+)\s*min/.exec(f);
        return mm ? (['Floor', mm[1]!, 'min'] as [string, string, string]) : (['Floor', f ? f.split(/[,\s]/)[0]! : '—'] as [string, string]);
      })(),
      ...(morning?.start != null ? ([['Out', short(morning.start)], ['Back', short(morning.back)]] as Array<[string, string]>) : []),
    ];
  }
  const target = main ?? null;
  // the card is the day: it opens the session, and on a run day it is also the share
  const pressable = !!target || runs.length > 0;
  const openIt = () => {
    if (target) open(date, target, { fromHero: true });
    else if (runs.length) sheet.open({ title: <span className="caps">{fmtDate('long', date)}</span>, body: <UnplannedSheet date={date} runs={runs} log={log} fromHero />, wide: true });
  };
  const shareIt = (e: React.MouseEvent) => {
    e.stopPropagation();
    sheet.open({ title: <span className="display sheet-title">Share</span>, body: <ShareSheet data={shareDataFor(date, target, runs, log)} /> });
  };
  return (
    <motion.div
      className={`aura ${target ? `t-${tone(target)}` : ''} ${path ? 'has-route' : ''}`}
      onClick={pressable ? openIt : undefined}
      onKeyDown={pressable ? (e) => (e.key === 'Enter' || e.key === ' ' ? (e.preventDefault(), openIt()) : undefined) : undefined}
      role={pressable ? 'button' : undefined}
      tabIndex={pressable ? 0 : undefined}
      aria-label={pressable ? `${title}. Open session` : undefined}
      whileTap={pressable ? { scale: 0.985 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      <span className="aura-glow" aria-hidden="true" />
      <div className="aura-top">
        <span className="caps">{eyebrow}</span>
        <span className="aura-tools">
          {runs.length ? (
            <button type="button" className="aura-share" onClick={shareIt} aria-label="Share this run">
              <Share size={14} strokeWidth={2.25} /> Share
            </button>
          ) : null}
          <Chip kind={st === 'bonus' ? 'done' : st}>{STATUS_WORD[st] || 'Open'}</Chip>
        </span>
      </div>
      {path ? (
        <svg className="aura-route" viewBox="0 0 358 200" aria-hidden="true">
          <motion.path d={path} fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: 'easeOut' }} />
        </svg>
      ) : null}
      <h2 className={`aura-title ${run ? 'display' : 'stamp'}`}>{title}</h2>
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
      {pressable ? <ChevronRight className="aura-chev" size={20} aria-hidden="true" /> : null}
    </motion.div>
  );
};


// ---------- habit orbs: a row of lights, each one you can switch on; hold one and it lifts, then slide it along the row ----------

/**
 * One orb, one honest gesture. A tap (under 300ms) switches it. A hold lifts it (300ms, one haptic): let go without moving and
 * its note opens, never a toggle; move and it slides along the row, and the order is written when it lands. A cancelled drag
 * puts the row back as it was.
 */
const Orb = ({ h, i, isDone, note, toggle, openNote, onLifted, onSettled, onCancelled, reduce }: { h: Habit; i: number; isDone: boolean; note: string; toggle: () => void; openNote: () => void; onLifted: () => void; onSettled: () => void; onCancelled: () => void; reduce: boolean | null }) => {
  const controls = useDragControls();
  const [lifted, setLifted] = useState(false);
  const [pressed, setPressed] = useState(false);
  /** the click after a lifted release is not a tap */
  const swallow = useRef(false);
  const rest = () => {
    setLifted(false);
    setPressed(false);
  };
  const drag = useHoldDrag<HTMLButtonElement>({
    onArm: (e) => {
      haptic();
      setLifted(true);
      onLifted();
      controls.start(e);
    },
    onDrop: () => {
      rest();
      onSettled();
    },
    onCancel: (phase, reason) => {
      rest();
      onCancelled();
      if (phase === 'dragging') {
        controls.cancel();
        return;
      }
      // the pointer taken away mid-hold (a palm, a call) is nobody's intent: no note, no toggle
      if (reason !== 'up') {
        controls.cancel();
        swallow.current = true;
        return;
      }
      // lifted and let go where it was: the note, not a toggle
      swallow.current = true;
      openNote();
    },
  });
  const scale = reduce ? 1 : lifted ? 1.03 : pressed ? 0.92 : 1;
  return (
    <Reorder.Item
      as="button"
      value={h.id}
      ref={drag.ref}
      dragListener={false}
      dragControls={controls}
      type="button"
      className={`orb ${isDone ? 'on' : ''} ${lifted ? 'is-lifted' : ''}`}
      role="checkbox"
      aria-checked={isDone}
      aria-label={h.name}
      title={i < 9 ? `Press ${i + 1}` : undefined}
      animate={{ scale }}
      transition={reduce ? INSTANT : DROP_SPRING}
      onClick={() => {
        if (drag.consumeClick() || swallow.current) {
          swallow.current = false;
          // the click is the user's gesture: the note takes focus here, where the browser allows it
          document.getElementById(`note-${h.id}`)?.focus();
          return;
        }
        toggle();
      }}
      onPointerDown={(e) => {
        drag.bind.onPointerDown(e);
        if (e.button === 0) setPressed(true);
      }}
      // the orb never takes focus from a press, so the note it opens keeps it (keyboard focus still arrives by Tab)
      onMouseDown={(e) => e.preventDefault()}
      onPointerMove={drag.bind.onPointerMove}
      onPointerUp={() => {
        drag.bind.onPointerUp();
        setPressed(false);
      }}
      onPointerLeave={() => {
        drag.bind.onPointerLeave();
        setPressed(false);
      }}
      onPointerCancel={() => {
        drag.bind.onPointerCancel();
        setPressed(false);
      }}
      onContextMenu={drag.bind.onContextMenu}
    >
      <motion.span className="orb-ring" initial={false} animate={isDone ? { scale: [1, 1.08, 1] } : { scale: 1 }} transition={{ duration: 0.32, delay: 0.32, ease: 'easeOut' }}>
        <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <motion.path d="M20 6 9 17l-5-5" initial={false} animate={{ pathLength: isDone ? 1 : 0, opacity: isDone ? 1 : 0 }} transition={reduce ? { duration: 0 } : isDone ? { pathLength: { duration: 0.16, delay: 0.16, ease: 'easeOut' }, opacity: { duration: 0.01, delay: 0.16 } } : { duration: 0.1 }} />
        </svg>
        {!isDone ? <span className="orb-initial">{h.name.slice(0, 1)}</span> : null}
        {note ? <i className="orb-note" aria-hidden="true" /> : null}
      </motion.span>
      <span className="orb-name">{h.name}</span>
    </Reorder.Item>
  );
};

/** The visible habits in a local order while one is in the air; the full order is written once it lands, and put back if the drag is cancelled. */
const useLiveOrder = (ids: string[], commit: (order: string[]) => void) => {
  const [order, setOrderState] = useState(ids);
  const latest = useRef(order);
  const before = useRef(order);
  const busy = useRef(false);
  const key = ids.join(',');
  const setOrder = (next: string[]) => {
    latest.current = next;
    setOrderState(next);
  };
  useEffect(() => {
    if (!busy.current) setOrder(ids);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const known = new Set(ids);
  const shown = order.filter((id) => known.has(id)).concat(ids.filter((id) => !order.includes(id)));
  return {
    order: shown,
    setOrder,
    lift: () => {
      busy.current = true;
      before.current = latest.current;
    },
    settle: () => {
      busy.current = false;
      commit(latest.current);
    },
    cancel: () => {
      busy.current = false;
      setOrder(before.current);
    },
  };
};

const Orbs = ({ date, log, list, toggle, noteFor, setNoteFor, timers, save, commit }: { date: string; log: L; list: Habit[]; toggle: (h: Habit) => void; noteFor: string | null; setNoteFor: (id: string | null) => void; timers: React.MutableRefObject<Record<string, ReturnType<typeof setTimeout>>>; save: (id: string, v: string) => void; commit: (order: string[]) => void }) => {
  const reduce = useReducedMotion();
  const noted = noteFor ? list.find((h) => h.id === noteFor) : null;
  const done = list.filter((h) => log.snap.isHabitDone(date, h.id)).length;
  const byId = new Map(list.map((h) => [h.id, h]));
  const live = useLiveOrder(
    list.map((h) => h.id),
    (order) => commit(order),
  );
  return (
    <div className="orbs-wrap">
      <Reorder.Group as="div" axis="x" values={live.order} onReorder={live.setOrder} className="orbs" role="group" aria-label="Habits">
        {live.order.map((id, i) => {
          const h = byId.get(id);
          if (!h) return null;
          return (
            <Orb
              key={h.id}
              h={h}
              i={i}
              isDone={log.snap.isHabitDone(date, h.id)}
              note={log.snap.checkOf(date, h.id)?.note ?? ''}
              toggle={() => toggle(h)}
              openNote={() => {
                setNoteFor(h.id);
                requestAnimationFrame(() => document.getElementById(`note-${h.id}`)?.focus());
              }}
              onLifted={live.lift}
              onSettled={live.settle}
              onCancelled={live.cancel}
              reduce={reduce}
            />
          );
        })}
      </Reorder.Group>
      <div className="orbs-meter" aria-hidden="true">
        <motion.i initial={false} animate={{ width: `${list.length ? (done / list.length) * 100 : 0}%` }} transition={{ type: 'spring', stiffness: 120, damping: 22 }} />
      </div>
      {noted ? (
        <div className="orbs-note">
          <input
            className="note-in"
            id={`note-${noted.id}`}
            autoFocus
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
/** An Edit-mode row: the grip drags it up or down the list; the arrows do the same for a keyboard or VoiceOver. */
const HabitEditRow = ({ h, i, n, patch, swap, onLifted, onSettled, onCancelled, reduce }: { h: Habit; i: number; n: number; patch: (p: { id: string; name?: string; archived?: boolean }) => void; swap: (i: number, j: number) => void; onLifted: () => void; onSettled: () => void; onCancelled: () => void; reduce: boolean | null }) => {
  const controls = useDragControls();
  const [lifted, setLifted] = useState(false);
  return (
    <Reorder.Item
      as="div"
      value={h.id}
      dragListener={false}
      dragControls={controls}
      className={`lrow hrow-edit ${lifted ? 'is-lifted' : ''}`}
      animate={liftFx(lifted, reduce)}
      onDragStart={() => {
        haptic();
        setLifted(true);
        onLifted();
      }}
      onDragEnd={(e) => {
        setLifted(false);
        // a cancelled touch puts the list back; a release writes it
        if ((e as Event).type === 'pointercancel') onCancelled();
        else onSettled();
      }}
    >
      <span className="hgrip" aria-hidden="true" onPointerDown={(e) => controls.start(e)} onContextMenu={(e) => e.preventDefault()}>
        <GripVertical size={18} />
      </span>
      <input className="in bare" defaultValue={h.name} aria-label="Habit name" maxLength={80} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== h.name && patch({ id: h.id, name: e.target.value.trim() })} />
      <IconButton label="Move up" size="sm" disabled={i === 0} onClick={() => swap(i, i - 1)}>
        <ArrowUp size={16} />
      </IconButton>
      <IconButton label="Move down" size="sm" disabled={i === n - 1} onClick={() => swap(i, i + 1)}>
        <ArrowDown size={16} />
      </IconButton>
      <IconButton label={`Remove ${h.name}`} size="sm" onClick={() => patch({ id: h.id, archived: true })}>
        <X size={16} />
      </IconButton>
    </Reorder.Item>
  );
};

const HabitEditList = ({ habits, patch, swap, commit }: { habits: Habit[]; patch: (p: { id: string; name?: string; archived?: boolean }) => void; swap: (i: number, j: number) => void; commit: (order: string[]) => void }) => {
  const reduce = useReducedMotion();
  const byId = new Map(habits.map((h) => [h.id, h]));
  const live = useLiveOrder(
    habits.map((h) => h.id),
    (order) => commit(order),
  );
  // the wrap is the list's nearest scroll box, so the drag never tries to scroll the page from under the row
  return (
    <div className="hlist-wrap">
      <Reorder.Group as="div" axis="y" values={live.order} onReorder={live.setOrder} className="hlist">
        {live.order.map((id, i) => {
          const h = byId.get(id);
          return h ? <HabitEditRow key={h.id} h={h} i={i} n={live.order.length} patch={patch} swap={swap} onLifted={live.lift} onSettled={live.settle} onCancelled={live.cancel} reduce={reduce} /> : null;
        })}
      </Reorder.Group>
    </div>
  );
};

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
  /** A new order for some of the habits (the ones shown on this day) slots into the full order; nothing is written when nothing moved. */
  const commit = (visible: string[]) => {
    const all = log.habits.map((h) => h.id);
    const shown = new Set(visible);
    let k = 0;
    const next = all.map((id) => (shown.has(id) ? visible[k++]! : id));
    if (next.some((id, i) => id !== all[i])) reorder.mutate(next);
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
      <Group className={editing ? 'hgroup-edit' : ''}>
        {editing ? <HabitEditList habits={log.habits} patch={(p) => patch.mutate(p)} swap={swap} commit={commit} /> : null}
        {!editing && list.length ? <Orbs date={date} log={log} list={list} toggle={toggle} noteFor={noteFor} setNoteFor={setNoteFor} timers={timers} save={(id, v) => check.mutate({ habitId: id, date, note: v })} commit={commit} /> : null}
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

// ---------- to-dos: swipe right to complete, left to delete; tap the name for the sheet ----------
type TodoLite = { id: string; text: string; note: string | null; createdOn: string };

/** The editor behind a tap on a to-do: the name, a small note under it, Delete and Save. Save is the sheet's one blue. */
const TodoSheet = ({ x, date }: { x: TodoLite; date: string }) => {
  const { patch } = useTodoMutations();
  const sheet = useSheet();
  const [text, setText] = useState(x.text);
  const [note, setNote] = useState(x.note ?? '');
  const nextText = text.trim();
  const nextNote = note.trim();
  const changed = !!nextText && (nextText !== x.text || nextNote !== (x.note ?? ''));
  const save = () => {
    if (!changed) return;
    const p: { text?: string; note?: string | null } = {};
    if (nextText !== x.text) p.text = nextText;
    if (nextNote !== (x.note ?? '')) p.note = nextNote || null;
    patch.mutate({ id: x.id, ...p });
    sheet.close();
  };
  const onKey = (ev: React.KeyboardEvent<HTMLElement>) => {
    if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey || ev.currentTarget.tagName === 'INPUT')) {
      ev.preventDefault();
      save();
    }
  };
  return (
    <>
      <input className="tsheet-name" value={text} maxLength={200} aria-label="To-do" onChange={(ev) => setText(ev.target.value)} onKeyDown={onKey} />
      <label className="tsheet-field">
        <span className="caps">Note</span>
        <textarea className="jtext serif tsheet-note" rows={3} maxLength={500} placeholder="Add a note" value={note} autoFocus={!x.note} onChange={(ev) => setNote(ev.target.value)} onKeyDown={onKey} />
      </label>
      <div className="sheet-foot">
        <Button
          variant="danger"
          onClick={() => {
            haptic('warn');
            patch.mutate({ id: x.id, deletedOn: date });
            sheet.close();
          }}
        >
          Delete
        </Button>
        <div className="foot-right">
          <Button variant="ghost" onClick={() => sheet.close()}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!changed}>
            Save
          </Button>
        </div>
      </div>
    </>
  );
};

const TodoRow = ({ x, date, done, carried, onToggle, onDelete, onEdit }: { x: TodoLite; date: string; done: boolean; carried: boolean; onToggle: () => void; onDelete: () => void; onEdit: () => void }) => {
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
          <button type="button" className={`hrow-name trow-name ${x.note ? 'has-note' : ''}`} onClick={onEdit}>
            <span>{x.text}</span>
            {x.note ? <span className="trow-note">{x.note}</span> : null}
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
  const sheet = useSheet();
  const [draft, setDraft] = useState('');
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
  const item = (x: (typeof all)[number], isDone: boolean) => (
    <TodoRow
      key={x.id}
      x={x}
      date={date}
      done={isDone}
      carried={x.createdOn < date && !isDone}
      onToggle={() => patch.mutate({ id: x.id, doneOn: isDone ? null : date })}
      onDelete={() => patch.mutate({ id: x.id, deletedOn: date })}
      onEdit={() => sheet.open({ title: <span className="caps tsheet-kicker">To-do</span>, body: <TodoSheet x={x} date={date} /> })}
    />
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
              <button type="button" className="link sm quiet" onClick={() => go(t)}>
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

      <SectionHead title="Training" action={<AddSessionButton date={date} variant="quiet">Add</AddSessionButton>} />
      <DropWeekStrip date={date} log={log} />
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
              <div className="lrow-sub">Recorded · {Math.round(a.movingSec / 60)} min</div>
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
