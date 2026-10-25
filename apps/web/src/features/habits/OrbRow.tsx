import type { Habit, ISODate } from '@logbook/shared';
import { Archive, Info, PenLine, Plus } from 'lucide-react';
import { animate, motion, motionValue, useMotionValue, type MotionValue } from 'motion/react';
import type * as React from 'react';
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { useHabitMutations } from '@/api/queries';
import { HOLD_SLOP_PX } from '@/lib/gesture';
import { haptics, hapticAtPeak } from '@/lib/haptics';
import { springs, useReduced } from '@/lib/motion';
import type { ContextMenuItem } from '@/ui/ContextMenu';
import { dayTitle } from '@/ui/NavBar';
import { Pressable } from '@/ui/Pressable';
import { ChipButton } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import type { DragPoint } from '@/ui/useHold';
import { isPagerMoving } from '../day/live';
import type { Log } from '../log/useLog';
import { HabitNoteSheet, useArchiveHabit, useOpenHabit } from './HabitSheet';
import './habits.css';

export const HABIT_STARTERS = ['Sleep 7 h', 'Stretch', 'Read', 'Protein', 'No phone in bed'];
/**
 * The pop (§3.1 row 4, §10 `springs.complete`): the ring leaves 1 with this velocity and the spring's one overshoot carries it
 * to ≈ 1.12 and back, in one motion (a damped spring from rest: peak = v · e^(−ζω·t*) · sin(ω_d·t*) / ω_d ≈ 0.0219 v).
 */
const POP_V = 5.5;
/** The check's write, after the pop has settled (`springs.complete` rests in ≈ 300 ms). */
const WRITE_AFTER_MS = 350;
/**
 * The row's writes wait for the finger to rest (feel review 1 #4): a month write re-renders every mounted tab that reads the
 * month (at 4× a 130–200 ms task), and the next orb tapped in the same motion must not queue behind it. A write is sent once
 * no orb has been touched for `QUIET_MS` (and at once when the page goes, or the app is hidden).
 */
const QUIET_MS = 700;
let lastOrbTouch = 0;
/**
 * …and for the hand to be off the glass (feel review 2 #1): the write re-renders every mounted page, so it must not land under
 * the next gesture (a day swipe started 400 ms after the orb froze for 133–167 ms at 4×). It waits while a pointer is down,
 * the day pager moves or anything scrolls, until `RESTED_MS` after the last of them, then goes at the first idle moment (at
 * most `MAX_WAIT_MS` after the tap; at once when the page goes or the app is hidden).
 */
const RESTED_MS = 250;
const MAX_WAIT_MS = 8000;
let pointersDown = 0;
let lastGesture = 0;
let watching = false;
const watchGestures = () => {
  if (watching || typeof window === 'undefined') return;
  watching = true;
  const opts = { capture: true, passive: true } as const;
  const mark = () => (lastGesture = performance.now());
  window.addEventListener('pointerdown', () => (pointersDown++, mark()), opts);
  const up = () => ((pointersDown = Math.max(0, pointersDown - 1)), mark());
  window.addEventListener('pointerup', up, opts);
  window.addEventListener('pointercancel', up, opts);
  window.addEventListener('scroll', mark, opts);
};
const busyHand = () => pointersDown > 0 || isPagerMoving();
/**
 * Every orb's held write, sent together: the first one due sends them all in one task, so a row of orbs tapped in a row
 * costs one round of page renders at rest, not one per orb on its own idle callback (feel review 3 #4: three 107–147 ms
 * frames at 4×). Also sent when the page is going (`pagehide`, a reload or a relaunch, as well as a hidden app), so a tap
 * just before it is not lost (feel review 3 #3).
 */
const heldWrites = new Set<() => void>();
const sendHeld = () => {
  for (const f of [...heldWrites]) f();
};
let pageHideOn = false;
const watchPageHide = () => {
  if (pageHideOn || typeof window === 'undefined') return;
  pageHideOn = true;
  window.addEventListener('pagehide', sendHeld);
};
type IdleWin = { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (h: number) => void };
const onIdle = (f: () => void): (() => void) => {
  const w = window as unknown as IdleWin;
  if (w.requestIdleCallback) {
    const h = w.requestIdleCallback(f, { timeout: 300 });
    return () => w.cancelIdleCallback?.(h);
  }
  const t = setTimeout(f, 0);
  return () => clearTimeout(t);
};

/**
 * The orbs' shown state ahead of the month (a tap answers on its own frame; the write follows later), per day, so the head's
 * count and the Close card's stamp change with the orb, never by themselves a second later (code review 2 #6, feel review 2
 * #2, day review 2 #6). An entry goes when the month agrees.
 */
const EMPTY: ReadonlyMap<string, boolean> = new Map();
const shown = new Map<string, ReadonlyMap<string, boolean>>();
const shownSubs = new Set<() => void>();
const setShown = (date: string, id: string, v: boolean | null) => {
  const cur = shown.get(date) ?? EMPTY;
  if (v === null ? !cur.has(id) : cur.get(id) === v) return;
  const next = new Map(cur);
  if (v === null) next.delete(id);
  else next.set(id, v);
  if (next.size) shown.set(date, next);
  else shown.delete(date);
  for (const f of shownSubs) f();
};
const subShown = (f: () => void) => {
  shownSubs.add(f);
  return () => void shownSubs.delete(f);
};
/** How many of the day's habits are lit as the orbs show them (the month's checks, with the taps not yet written). */
export const useHabitsLit = (date: string, log: Log): { lit: number; total: number } => {
  const ahead = useSyncExternalStore(subShown, () => shown.get(date) ?? EMPTY, () => EMPTY);
  const list = log.habits.filter((h) => h.createdOn <= date);
  return { lit: list.filter((h) => ahead.get(h.id) ?? log.snap.isHabitDone(date, h.id)).length, total: list.length };
};
/** The habits head's meta (§3.1 row 4, §3.3): `2 of 5` only when > 0; a future day counts its ghosts, `5 habits`. */
export const HabitsMeta = ({ date, log }: { date: string; log: Log }): React.JSX.Element | null => {
  const { lit, total } = useHabitsLit(date, log);
  const text = date > log.today ? (log.habits.length ? `${log.habits.length} ${log.habits.length === 1 ? 'habit' : 'habits'}` : null) : lit > 0 ? `${lit} of ${total}` : null;
  return text ? <span className="sec-meta tnum">{text}</span> : null;
};
/** The orb's cell (64 hit, 56 ring) plus the 4 px between cells: the 12 px between rings. */
const PITCH = 68;

type Drag = { id: string; from: number; to: number; pitch: number; scroll0: number; dx: number };

interface OrbProps {
  h: Habit;
  date: string;
  on: boolean;
  note: string;
  index: number;
  onLight: (h: Habit, on: boolean) => void;
  menu: (h: Habit) => ContextMenuItem[];
  onDragStart: (id: string) => void;
  onDragMove: (id: string, p: DragPoint) => void;
  onDragEnd: (id: string, cancelled: boolean) => void;
  onStep: (id: string, dir: -1 | 1) => void;
  bind: (id: string, el: HTMLElement | null) => void;
}

/**
 * One orb (§3.1 row 4, §11.2, §11.4). A tap (any press released before the 450 ms hold, a slow one too) lights it: the fill
 * and the check land on the tap's own frame, the ring pops 1 → 1.12 → 1 on `springs.complete`, and `orb` fires on the pop's
 * peak frame (`hapticAtPeak`, never in the handler). Putting one out is silent. The hold (450 ms, the one clock) lifts it in
 * place with the menu `Note · Details · Archive`; a move after the hold closes the menu and the orb follows the finger along
 * the row (the row's other orbs make room on `settle`, `select` per slot crossed, `drop` on release).
 */
const Orb = memo(function Orb({ h, date, on: lit, note, index, onLight, menu, onDragStart, onDragMove, onDragEnd, onStep, bind }: OrbProps) {
  const reduce = useReduced();
  const pop = useMotionValue(1);
  // the tap's answer lands on its own frame: the shown state runs ahead of the cache until the cache agrees
  const [ahead, setAheadSelf] = useState<boolean | null>(null);
  const on = ahead ?? lit;
  const setAhead = (v: boolean | null) => {
    setAheadSelf(v);
    setShown(date, h.id, v);
  };
  useEffect(() => {
    if (ahead !== null && ahead === lit) setAhead(null);
  }, [lit, ahead]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => setShown(date, h.id, null), [date, h.id]);
  const unpeak = useRef<() => void>(() => {});
  useEffect(() => () => unpeak.current(), []);
  /*
   * The tap is the release (§0.2: the first visible change ≤ 16 ms): a pointer that comes up before the hold, without having
   * travelled past the hold's slop, lights the orb in its pointerup, so the fill is on the release's own frame (on touch the
   * click can come a frame later). That click is then swallowed; a click with no pointer before it (Enter, Space, VoiceOver,
   * the 1–9 keys) lights it from the click. A press that travelled was a scroll: not a tap (§14 32).
   */
  const travel = useRef<{ x: number; y: number; moved: boolean; held: boolean; lit: boolean } | null>(null);
  // the write waits for the pop: a month write re-renders every mounted day page, which must not land in the release's frame
  // or under the pop's peak (4×: 65 ms). A second tap before it is sent takes the change back and sends nothing.
  const write = useRef<{ on: boolean; at: number; t: ReturnType<typeof setTimeout>; idle?: () => void } | null>(null);
  const send = useRef(() => {});
  send.current = () => {
    const w = write.current;
    heldWrites.delete(sendMine);
    if (!w) return;
    clearTimeout(w.t);
    w.idle?.();
    write.current = null;
    onLight(h, w.on);
  };
  const [sendMine] = useState(() => () => send.current());
  /**
   * The write's timer: sent once the row has been still for QUIET_MS (another orb tapped meanwhile moves it on) and the hand
   * has rested (RESTED_MS after the last pointer, scroll or page move), at the next idle moment.
   */
  const due = () => {
    const w = write.current;
    if (!w) return;
    const n = performance.now();
    const wait = Math.max(lastOrbTouch + QUIET_MS - n, lastGesture + RESTED_MS - n);
    if (n - w.at < MAX_WAIT_MS && (wait > 0 || busyHand())) {
      w.t = setTimeout(due, Math.max(50, wait));
      return;
    }
    w.idle = onIdle(() => {
      const cur = write.current;
      if (!cur) return;
      cur.idle = undefined;
      // a gesture that began meanwhile: wait for it to rest too
      if (performance.now() - cur.at < MAX_WAIT_MS && (busyHand() || performance.now() - lastGesture < RESTED_MS)) due();
      else sendHeld();
    });
  };
  useEffect(() => {
    const hide = () => document.visibilityState === 'hidden' && send.current();
    document.addEventListener('visibilitychange', hide);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      send.current();
    };
  }, []);
  const light = () => {
    const next = !on;
    setAhead(next);
    const pending = write.current;
    if (pending) {
      clearTimeout(pending.t);
      pending.idle?.();
      write.current = null;
      heldWrites.delete(sendMine);
    } else {
      watchGestures();
      watchPageHide();
      write.current = { on: next, at: performance.now(), t: setTimeout(due, WRITE_AFTER_MS) };
      heldWrites.add(sendMine);
    }
    if (next) {
      unpeak.current();
      if (reduce) {
        // no pop: the haptic lands on the frame the fill completes (the ring's 160 ms colour change)
        const fill = motionValue(0);
        unpeak.current = hapticAtPeak(fill, 'orb');
        animate(fill, 1, { duration: 0.16, ease: 'linear' });
      } else {
        unpeak.current = hapticAtPeak(pop, 'orb');
        animate(pop, 1, { ...springs.complete, velocity: POP_V });
      }
    }
  };
  return (
    <Pressable
      ref={useMemo(() => (el: HTMLElement | null) => bind(h.id, el), [bind, h.id])}
      className={`orb ${on ? 'on' : ''}`}
      aria-pressed={on}
      label={`${h.name}${note ? `. Note: ${note}` : ''}`}
      aria-keyshortcuts={index < 9 ? String(index + 1) : undefined}
      onPress={() => {
        const p = travel.current;
        travel.current = null;
        if (p && (p.lit || p.moved || p.held)) return;
        light();
      }}
      onHold={() => {
        if (travel.current) travel.current.held = true;
      }}
      holdMenu={() => menu(h)}
      menuLabel={`${h.name} actions`}
      onDragStart={() => onDragStart(h.id)}
      onDragMove={(p) => onDragMove(h.id, p)}
      onDragEnd={(_p, _e, cancelled) => onDragEnd(h.id, cancelled)}
      onPointerDown={(e: React.PointerEvent<HTMLElement>) => {
        lastOrbTouch = performance.now();
        travel.current = e.isPrimary && (e.pointerType !== 'mouse' || e.button === 0) ? { x: e.clientX, y: e.clientY, moved: false, held: false, lit: false } : null;
      }}
      onPointerMove={(e: React.PointerEvent<HTMLElement>) => {
        const p = travel.current;
        if (p && !p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) > HOLD_SLOP_PX) p.moved = true;
      }}
      onPointerUp={() => {
        const p = travel.current;
        if (!p || p.moved || p.held || p.lit) return;
        p.lit = true;
        light();
      }}
      onPointerCancel={() => {
        travel.current = null;
      }}
      onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
        if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
          e.preventDefault();
          onStep(h.id, e.key === 'ArrowLeft' ? -1 : 1);
        }
      }}
      data-habit={h.id}
    >
      <motion.span className="orb-ring" style={{ scale: pop }}>
        <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <motion.path d="M20 6 9 17l-5-5" initial={false} animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }} transition={reduce ? { duration: 0 } : on ? { pathLength: { duration: 0.16, ease: 'easeOut' }, opacity: { duration: 0.01 } } : { duration: 0.1 }} />
        </svg>
        {!on ? <span className="orb-initial">{h.name.slice(0, 1)}</span> : null}
        {note ? <i className="orb-note" aria-hidden="true" /> : null}
      </motion.span>
      <span className="orb-name">{h.name}</span>
    </Pressable>
  );
});

/** A future day's orb (§3.3): an outline at 40 %, the name, nothing to press. */
const GhostOrb = ({ h }: { h: Habit }) => (
  <span className="orb ghost" aria-hidden="true">
    <span className="orb-ring" />
    <span className="orb-name">{h.name}</span>
  </span>
);

/** The "+" orb's sheet: type a name (Return adds and keeps the field), or tap a starter. */
const AddHabitSheet = ({ existing }: { existing: string[] }) => {
  const { add } = useHabitMutations();
  const [draft, setDraft] = useState('');
  const [added, setAdded] = useState<string[]>([]);
  const have = new Set([...existing, ...added].map((s) => s.toLowerCase()));
  const starters = HABIT_STARTERS.filter((s) => !have.has(s.toLowerCase()));
  const addIt = (name: string) => {
    const v = name.trim();
    if (!v || have.has(v.toLowerCase())) return;
    add.mutate(v);
    setAdded((a) => [...a, v]);
    setDraft('');
  };
  return (
    <div className="orb-add">
      <div className="orb-add-in">
        <input
          className="in"
          autoFocus
          placeholder="Name a habit"
          maxLength={80}
          aria-label="New habit"
          enterKeyHint="done"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addIt(draft);
            }
          }}
        />
        {draft.trim() ? (
          <ChipButton on onClick={() => addIt(draft)}>
            Add
          </ChipButton>
        ) : null}
      </div>
      {starters.length ? (
        <div className="orb-add-chips" role="group" aria-label="Starters">
          {starters.map((s) => (
            <ChipButton key={s} onClick={() => addIt(s)} aria-label={`Add ${s}`}>
              <Plus size={14} strokeWidth={2.6} aria-hidden="true" />
              {s}
            </ChipButton>
          ))}
        </div>
      ) : null}
    </div>
  );
};

/** `ids` moved: the one at `from` now sits at `to`. */
const moved = (ids: string[], from: number, to: number) => {
  const o = [...ids];
  const [x] = o.splice(from, 1);
  o.splice(to, 0, x!);
  return o;
};

/**
 * The habits (§3.1 row 4): a row of 56 px orbs, 12 between them, the names 12/16 under them; past the screen's width the
 * row scrolls itself (native, `touch-action: pan-x pan-y`) and never pages (`data-no-page`). A tap lights an orb (yesterday
 * is fixable too); a hold opens `Note · Details · Archive`; a move after the hold reorders, the order written once on
 * release. A future day shows ghost orbs. Keyboard: 1–9 light the habits, Alt+←/→ moves the focused orb.
 */
export const OrbRow = ({ date, log, editable = true }: { date: ISODate; log: Log; editable?: boolean }) => {
  const { reorder, check } = useHabitMutations();
  const sheet = useSheet();
  const openHabit = useOpenHabit();
  const archive = useArchiveHabit();
  const ghost = date > log.today;
  const list = log.habits.filter((h) => h.createdOn <= date || ghost);
  const ids = list.map((h) => h.id);
  const key = ids.join(',');

  // while an orb is in the air and settling, the row keeps the order it had when the drag began
  const [held, setHeld] = useState<string[] | null>(null);
  const busy = useRef(false);
  useEffect(() => {
    if (!busy.current) setHeld(null);
  }, [key]);
  const known = new Set(ids);
  const order = held ? held.filter((id) => known.has(id)).concat(ids.filter((id) => !held.includes(id))) : ids;
  const orderRef = useRef(order);
  orderRef.current = order;

  const els = useRef(new Map<string, HTMLElement>());
  const shifts = useRef(new Map<string, { mv: MotionValue<number>; off: () => void }>());
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const bind = useRef((id: string, el: HTMLElement | null) => {
    if (el) els.current.set(id, el);
    else els.current.delete(id);
  }).current;
  /** The orb's own `translate` (it composes with the press's transform and the lift's `scale`). */
  const shiftOf = (id: string) => {
    let s = shifts.current.get(id);
    if (!s) {
      const mv = motionValue(0);
      const off = mv.on('change', (v) => {
        const el = els.current.get(id);
        if (el) el.style.translate = v ? `${v}px 0` : '';
      });
      s = { mv, off };
      shifts.current.set(id, s);
    }
    return s.mv;
  };
  useEffect(
    () => () => {
      for (const s of shifts.current.values()) s.off();
    },
    [],
  );
  const clearShifts = () => {
    for (const [id, s] of shifts.current) {
      s.mv.stop();
      s.mv.jump(0);
      const el = els.current.get(id);
      if (el) el.style.translate = '';
    }
  };

  /** A new order for the habits shown on this day slots into the full order; nothing is written when nothing moved. */
  const commit = (visible: string[]) => {
    const all = log.habits.map((h) => h.id);
    const shown = new Set(visible);
    let k = 0;
    const next = all.map((id) => (shown.has(id) ? visible[k++]! : id));
    if (next.some((id, i) => id !== all[i])) reorder.mutate(next);
  };

  const onDragStart = (id: string) => {
    const o = orderRef.current;
    const from = o.indexOf(id);
    if (from < 0) return;
    const a = els.current.get(o[0]!)?.getBoundingClientRect();
    const b = o[1] ? els.current.get(o[1])?.getBoundingClientRect() : undefined;
    const pitch = a && b ? b.left - a.left : PITCH;
    busy.current = true;
    drag.current = { id, from, to: from, pitch: pitch || PITCH, scroll0: scroller.current?.scrollLeft ?? 0, dx: 0 };
    flushSync(() => setHeld(o));
  };
  const onDragMove = (id: string, p: DragPoint) => {
    const d = drag.current;
    if (!d || d.id !== id) return;
    const o = orderRef.current;
    d.dx = p.dx + ((scroller.current?.scrollLeft ?? 0) - d.scroll0);
    shiftOf(id).jump(d.dx);
    const to = Math.max(0, Math.min(o.length - 1, d.from + Math.round(d.dx / d.pitch)));
    if (to === d.to) return;
    // a reorder crossing a slot: one `select` per slot (throttled by haptics.select itself)
    for (let i = 0; i < Math.abs(to - d.to); i++) haptics.select();
    d.to = to;
    o.forEach((other, i) => {
      if (other === id) return;
      const target = d.from < to && i > d.from && i <= to ? -d.pitch : to < d.from && i >= to && i < d.from ? d.pitch : 0;
      const mv = shiftOf(other);
      if (mv.get() !== target || mv.isAnimating()) animate(mv, target, springs.settle);
    });
  };
  const onDragEnd = (id: string, cancelled: boolean) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== id) return;
    const o = orderRef.current;
    const to = cancelled ? d.from : d.to;
    const next = moved(o, d.from, to);
    const changed = to !== d.from;
    if (!cancelled) haptics.drop();
    if (changed) commit(next);
    if (cancelled) for (const other of o) if (other !== id) animate(shiftOf(other), 0, springs.settle);
    // the orb settles into its slot on `settle`; on that spring's completion the new order commits and the shifts clear in
    // the same frame (FLIP: nothing on screen moves on the commit)
    animate(shiftOf(id), (to - d.from) * d.pitch, {
      ...springs.settle,
      onComplete: () => {
        flushSync(() => setHeld(changed ? next : null));
        clearShifts();
        busy.current = false;
      },
    });
  };
  const step = (id: string, dir: -1 | 1) => {
    const o = orderRef.current;
    const i = o.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= o.length) return;
    commit(moved(o, i, j));
    requestAnimationFrame(() => els.current.get(id)?.focus());
  };

  const onLight = (h: Habit, on: boolean) => check.mutate({ habitId: h.id, date, done: on });
  const menu = (h: Habit): ContextMenuItem[] => [
    { label: 'Note', icon: <PenLine size={18} />, onSelect: () => sheet.open({ eyebrow: dayTitle(date, log.today), title: h.name, body: <HabitNoteSheet habit={h} date={date} /> }) },
    { label: 'Details', icon: <Info size={18} />, onSelect: () => openHabit(h) },
    { label: 'Archive', icon: <Archive size={18} />, destructive: true, onSelect: () => archive(h) },
  ];

  // the orbs are memoised: they get stable callbacks that read this render's handlers
  const fns = useRef({ onLight, menu, onDragStart, onDragMove, onDragEnd, step });
  fns.current = { onLight, menu, onDragStart, onDragMove, onDragEnd, step };
  const stable = useMemo(
    () => ({
      onLight: (h: Habit, on: boolean) => fns.current.onLight(h, on),
      menu: (h: Habit) => fns.current.menu(h),
      onDragStart: (id: string) => fns.current.onDragStart(id),
      onDragMove: (id: string, p: DragPoint) => fns.current.onDragMove(id, p),
      onDragEnd: (id: string, c: boolean) => fns.current.onDragEnd(id, c),
      onStep: (id: string, d: -1 | 1) => fns.current.step(id, d),
    }),
    [],
  );

  // number keys 1–9 light the habits (the keyboard path for the tap)
  const byId = new Map(list.map((h) => [h.id, h]));
  const keyRef = useRef<(n: number) => void>(() => {});
  keyRef.current = (n) => {
    const id = orderRef.current[n - 1];
    const el = id ? els.current.get(id) : undefined;
    el?.click();
  };
  useLayoutEffect(() => {
    if (!editable || ghost) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tg = e.target as HTMLElement | null;
      if (tg && (tg.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName))) return;
      if (document.querySelector('.sheet-wrap, .cm-layer')) return;
      // only the page the owner is looking at: the pager's live page on the active tab
      if (!scroller.current?.closest('.tab[data-active] .dp-page[data-role=cur]')) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 9) {
        e.preventDefault();
        keyRef.current(n);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [editable, ghost]);

  const { lit } = useHabitsLit(date, log);
  return (
    <div className={`orbs-wrap ${ghost ? 'is-ghost' : ''}`}>
      <div ref={scroller} className="orbs-scroll" data-no-page="">
        <div className="orbs" role="group" aria-label={ghost ? `Habits, ${list.length}` : `Habits, ${lit} of ${list.length} lit`}>
          {order.map((id, i) => {
            const h = byId.get(id);
            if (!h) return null;
            if (ghost) return <GhostOrb key={h.id} h={h} />;
            return (
              <Orb
                key={h.id}
                h={h}
                date={date}
                index={i}
                on={log.snap.isHabitDone(date, h.id)}
                note={log.snap.checkOf(date, h.id)?.note ?? ''}
                {...stable}
                bind={bind}
              />
            );
          })}
          {editable && !ghost ? (
            <Pressable className="orb orb-plus" label="Add a habit" onPress={() => sheet.open({ title: 'Add a habit', body: <AddHabitSheet existing={log.habits.map((h) => h.name)} /> })}>
              <span className="orb-ring">
                <Plus size={22} strokeWidth={2.25} aria-hidden="true" />
              </span>
              <span className="orb-name">{list.length ? 'Add' : 'Add a habit'}</span>
            </Pressable>
          ) : null}
        </div>
      </div>
    </div>
  );
};
