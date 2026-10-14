import type { Habit, ISODate } from '@logbook/shared';
import { ArrowLeft, ArrowRight, Archive, Info, PenLine, Plus } from 'lucide-react';
import { animate, AnimatePresence, motion, Reorder, useDragControls, useMotionValue, useReducedMotion } from 'motion/react';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useHabitMutations } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { rowPresence, springs } from '@/lib/motion';
import { DROP_SPRING, HOLD_MS, INSTANT, useHoldDrag } from '@/lib/useDrag';
import { ChipButton, dateLine, LONG_PRESS_MS, shared, useContextMenu, useSheet, type ContextMenuItem } from '@/ui';
import type { Log } from '../log/useLog';
import { HabitNoteSheet, useArchiveHabit, useOpenHabit } from './HabitSheet';
import './habits.css';

export const HABIT_STARTERS = ['Sleep 7 h', 'Stretch', 'Read', 'Protein', 'No phone in bed'];
/** The velocity that makes `springs.complete` overshoot to about 1.12 from rest: the orb's pop, with no keyframes. */
const POP_V = 5.2;
const PULSE_V = 2.6;

type OrbHandle = { pop: (v?: number, delay?: number) => void };

/**
 * One orb, one honest gesture each. A tap lights it (or puts it out). A hold lifts it (300ms, `haptics.lift()`): slide and it
 * moves along the row, written when it lands; keep still and its menu opens at 450ms like every long-press (Note, Details,
 * Move, Archive), the fallback for every gesture; moving on from the menu closes it and drags. A cancelled drag puts the
 * row back as it was.
 */
const Orb = forwardRef<OrbHandle, { h: Habit; i: number; n: number; isDone: boolean; note: string; onToggle: () => void; menuItems: () => ContextMenuItem[]; onLifted: () => void; onSettled: () => void; onCancelled: () => void; onStep: (dir: -1 | 1) => void }>(function Orb({ h, i, n, isDone, note, onToggle, menuItems, onLifted, onSettled, onCancelled, onStep }, ref) {
  const reduce = useReducedMotion();
  const controls = useDragControls();
  const menu = useContextMenu();
  const [lifted, setLifted] = useState(false);
  const [pressed, setPressed] = useState(false);
  const swallow = useRef(false);
  const el = useRef<HTMLButtonElement | null>(null);
  const pop = useMotionValue(1);
  useImperativeHandle(ref, () => ({
    pop: (v = POP_V, delay = 0) => {
      if (reduce) return;
      animate(pop, 1, { ...springs.complete, velocity: v, delay: delay / 1000 });
    },
  }));
  /** the menu came up while the finger was still down (at 450ms, like every long-press in the app) */
  const menuUp = useRef(false);
  const menuTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(menuTimer.current), []);
  const openMenu = () => {
    const node = el.current;
    if (!node) return;
    menu.open({ items: menuItems(), anchor: node, label: `${h.name} actions`, haptic: false });
  };
  const rest = () => {
    setLifted(false);
    setPressed(false);
  };
  const drag = useHoldDrag<HTMLButtonElement>({
    onArm: (e) => {
      haptics.lift();
      setLifted(true);
      onLifted();
      controls.start(e);
      // still held, unmoved, at the app's long-press mark: the menu opens under the finger (the lift already played).
      // Moving on from there closes it and carries on as a drag, as on iOS.
      menuUp.current = false;
      clearTimeout(menuTimer.current);
      menuTimer.current = setTimeout(() => {
        menuUp.current = true;
        openMenu();
      }, LONG_PRESS_MS - HOLD_MS);
    },
    onStart: () => {
      clearTimeout(menuTimer.current);
      if (menuUp.current) {
        menuUp.current = false;
        menu.close();
      }
    },
    onDrop: () => {
      clearTimeout(menuTimer.current);
      rest();
      onSettled();
    },
    onCancel: (phase, reason) => {
      clearTimeout(menuTimer.current);
      rest();
      onCancelled();
      if (phase === 'dragging') {
        controls.cancel();
        return;
      }
      controls.cancel();
      swallow.current = true;
      // lifted and let go where it was: the menu (if it is not up already), never a toggle. A pointer taken away
      // mid-hold is nobody's intent.
      if (reason === 'up' && !menuUp.current) openMenu();
      menuUp.current = false;
    },
  });
  const scale = reduce ? 1 : lifted ? 1.03 : pressed ? 0.92 : 1;
  return (
    <Reorder.Item
      as="button"
      value={h.id}
      ref={(node: HTMLButtonElement | null) => {
        el.current = node;
        drag.ref.current = node;
      }}
      dragListener={false}
      dragControls={controls}
      type="button"
      className={`orb ${isDone ? 'on' : ''} ${lifted ? 'is-lifted' : ''}`}
      role="checkbox"
      aria-checked={isDone}
      aria-label={`${h.name}${note ? `. Note: ${note}` : ''}`}
      aria-keyshortcuts={i < 9 ? String(i + 1) : undefined}
      animate={{ scale }}
      transition={reduce ? INSTANT : DROP_SPRING}
      onClick={() => {
        if (drag.consumeClick() || swallow.current) {
          swallow.current = false;
          return;
        }
        onToggle();
      }}
      onKeyDown={(e) => {
        if ((e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu') {
          e.preventDefault();
          openMenu();
        } else if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
          e.preventDefault();
          onStep(e.key === 'ArrowLeft' ? -1 : 1);
        }
      }}
      onPointerDown={(e) => {
        swallow.current = false;
        drag.bind.onPointerDown(e);
        if (e.button === 0) setPressed(true);
      }}
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
      onContextMenu={(e) => {
        drag.bind.onContextMenu(e);
        // a right-click on a desktop is the menu
        if ((e.nativeEvent as PointerEvent).pointerType !== 'touch' && !e.defaultPrevented) {
          e.preventDefault();
          openMenu();
        }
      }}
      data-n={n}
    >
      <motion.span className="orb-ring" style={{ scale: pop }}>
        <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <motion.path d="M20 6 9 17l-5-5" initial={false} animate={{ pathLength: isDone ? 1 : 0, opacity: isDone ? 1 : 0 }} transition={reduce ? { duration: 0 } : isDone ? { pathLength: { duration: 0.16, ease: 'easeOut' }, opacity: { duration: 0.01 } } : { duration: 0.1 }} />
        </svg>
        {!isDone ? <span className="orb-initial">{h.name.slice(0, 1)}</span> : null}
        {note ? <i className="orb-note" aria-hidden="true" /> : null}
      </motion.span>
      <span className="orb-name" {...shared(`habit-${h.id}`)}>
        {h.name}
      </span>
    </Reorder.Item>
  );
});

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

/** The trailing "+" orb's field: type a name, or tap a starter. */
const AddHabit = ({ existing, onDone }: { existing: string[]; onDone: () => void }) => {
  const { add } = useHabitMutations();
  const [draft, setDraft] = useState('');
  const have = new Set(existing.map((s) => s.toLowerCase()));
  const starters = HABIT_STARTERS.filter((s) => !have.has(s.toLowerCase()));
  const addIt = (name: string) => {
    const v = name.trim();
    if (!v) return;
    add.mutate(v);
    haptics.toggle();
    setDraft('');
  };
  return (
    <motion.div className="orb-add" {...rowPresence}>
      <div className="orb-add-in">
        <input
          className="in"
          autoFocus
          placeholder="Name a habit"
          maxLength={80}
          aria-label="New habit"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addIt(draft);
            } else if (e.key === 'Escape') onDone();
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
    </motion.div>
  );
};

/**
 * The habits as a row of lights directly under the hero. The orbs are the meter: lit ones glow, and the caption counts them.
 * Tap lights one (a pop on `springs.complete`, the glow blooms, `haptics.orb()`); the last one lit sends a pulse along the
 * row, 40ms apart, the caption reads "All lit." and `haptics.success()` plays instead. Hold to reorder or for the menu.
 * A trailing "+" adds a habit, with starter chips.
 */
export const OrbRow = ({ date, log, editable = true }: { date: ISODate; log: Log; editable?: boolean }) => {
  const { reorder, check } = useHabitMutations();
  const sheet = useSheet();
  const openHabit = useOpenHabit();
  const archive = useArchiveHabit();
  const [adding, setAdding] = useState(false);
  const orbs = useRef(new Map<string, OrbHandle>());
  const list = log.habits.filter((h) => h.createdOn <= date);
  const done = list.filter((h) => log.snap.isHabitDone(date, h.id)).length;
  const all = list.length > 0 && done === list.length;
  /** A new order for the habits shown on this day slots into the full order; nothing is written when nothing moved. */
  const commit = (visible: string[]) => {
    const ids = log.habits.map((h) => h.id);
    const shown = new Set(visible);
    let k = 0;
    const next = ids.map((id) => (shown.has(id) ? visible[k++]! : id));
    if (next.some((id, i) => id !== ids[i])) {
      reorder.mutate(next);
      haptics.drop();
    }
  };
  const live = useLiveOrder(
    list.map((h) => h.id),
    commit,
  );
  const step = (id: string, dir: -1 | 1) => {
    const o = [...live.order];
    const i = o.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j]!, o[i]!];
    live.setOrder(o);
    commit(o);
  };
  const toggle = (h: Habit) => {
    const on = !log.snap.isHabitDone(date, h.id);
    check.mutate({ habitId: h.id, date, done: on });
    if (!on) return haptics.toggle();
    const last = done + 1 === list.length;
    if (last) {
      // the row answers once: a pulse left to right, 40ms apart, and one Success
      live.order.forEach((id, i) => orbs.current.get(id)?.pop(id === h.id ? POP_V : PULSE_V, id === h.id ? 0 : Math.min(i, 6) * 40));
      haptics.success();
    } else {
      orbs.current.get(h.id)?.pop();
      haptics.orb();
    }
  };
  // number keys 1–9 light the habits, as before
  useEffect(() => {
    if (!editable) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tg = e.target as HTMLElement | null;
      if (tg && (tg.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName))) return;
      if (document.querySelector('.sheet-wrap, .cm-layer')) return;
      const n = Number(e.key);
      const id = live.order[n - 1];
      const h = id ? list.find((x) => x.id === id) : undefined;
      if (n >= 1 && n <= 9 && h) {
        e.preventDefault();
        toggle(h);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });
  const byId = new Map(list.map((h) => [h.id, h]));
  const itemsFor = (h: Habit): ContextMenuItem[] => {
    const i = live.order.indexOf(h.id);
    return [
      { label: 'Note', icon: <PenLine size={18} />, onSelect: () => sheet.open({ eyebrow: date === log.today ? 'Today' : dateLine(date), title: h.name, body: <HabitNoteSheet habit={h} date={date} /> }) },
      { label: 'Details', icon: <Info size={18} />, onSelect: () => openHabit(h) },
      { label: 'Move left', icon: <ArrowLeft size={18} />, disabled: i <= 0, onSelect: () => step(h.id, -1) },
      { label: 'Move right', icon: <ArrowRight size={18} />, disabled: i < 0 || i >= live.order.length - 1, onSelect: () => step(h.id, 1) },
      { label: 'Archive', icon: <Archive size={18} />, destructive: true, onSelect: () => archive(h) },
    ];
  };
  const many = list.length + 1 > 6;
  return (
    <section className="orbs-wrap" aria-label="Habits">
      <div className={`orbs-scroll ${many ? 'many' : ''}`} style={{ ['--n' as string]: list.length + (editable ? 1 : 0) }}>
        <Reorder.Group as="div" axis="x" values={live.order} onReorder={live.setOrder} className="orbs" role="group" aria-label={`Habits, ${done} of ${list.length} lit`}>
          {live.order.map((id, i) => {
            const h = byId.get(id);
            if (!h) return null;
            return (
              <Orb
                key={h.id}
                ref={(r) => {
                  if (r) orbs.current.set(h.id, r);
                  else orbs.current.delete(h.id);
                }}
                h={h}
                i={i}
                n={live.order.length}
                isDone={log.snap.isHabitDone(date, h.id)}
                note={log.snap.checkOf(date, h.id)?.note ?? ''}
                onToggle={() => toggle(h)}
                menuItems={() => itemsFor(h)}
                onLifted={live.lift}
                onSettled={live.settle}
                onCancelled={live.cancel}
                onStep={(d) => step(h.id, d)}
              />
            );
          })}
        </Reorder.Group>
        {editable ? (
          <button type="button" className={`orb orb-plus ${adding ? 'on-add' : ''}`} aria-expanded={adding} aria-label="Add a habit" onClick={() => setAdding((a) => !a)}>
            <span className="orb-ring">
              <Plus size={22} strokeWidth={2.25} aria-hidden="true" />
            </span>
            <span className="orb-name">{list.length ? 'Add' : 'Add a habit'}</span>
          </button>
        ) : null}
      </div>
      <p className={`orbs-cap ${all ? 'all' : ''}`} aria-live="polite">
        {!list.length ? 'Habits light up here as you do them.' : all ? 'All lit.' : done ? `${done} of ${list.length} lit` : `${list.length} to light`}
      </p>
      <AnimatePresence initial={false}>{adding ? <AddHabit key="add" existing={log.habits.map((h) => h.name)} onDone={() => setAdding(false)} /> : null}</AnimatePresence>
    </section>
  );
};
