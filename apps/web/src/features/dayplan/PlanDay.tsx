import { fmtDate, GOAL_STEPS_MAX, periodOf, shiftDays, type Aim, type ISODate } from '@logbook/shared';
import { ArrowRight, ChevronDown, CloudOff, ChevronRight, ListTodo, Moon, Plus, RotateCcw, Target, Trash2 } from 'lucide-react';
import { animate, AnimatePresence, motion, useMotionValue, useSpring, type MotionValue } from 'motion/react';
import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { newTodoId, useGoalMutations, useGoals, useTodoGroups, useTodoMutations, useTodos } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { revealField, useKeyboardOpen } from '@/lib/keyboard';
import { springs, useReduced } from '@/lib/motion';
import { useHoldDrag, type DragPoint } from '@/lib/useDrag';
import { useContextMenu, type ContextMenuItem } from '@/ui/ContextMenu';
import { SectionHeader } from '@/ui/layout';
import { SectionEmpty } from '@/ui/primitives';
import { Pressable } from '@/ui/Pressable';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { useOpenGoal } from '../goals/GoalSheets';
import { goalOf } from '../goals/model';
import { GoalRing, newStepId, useSaveSteps } from '../goals/Steps';
import { Burst, celebrateOnce } from '../goals/game';
import { useCelebrate } from '../goals/Celebrate';
import { CarryOver } from '../goals/CarryOver';
import { ReviewRow } from '../goals/ReviewRow';
import { colorOf, colorStyle, groupOf } from '../todos/colors';
import { PriorityFlag } from '../todos/PriorityDots';
import { parseQuickAdd } from '../todos/quickAdd';
import { goneOn, TodoListSheet, understoodOf, useTodoActions } from '../todos/TodoList';
import { TodoMark } from '../todos/TodoMark';
import { TodoSheet } from '../todos/TodoSheet';
import { groupsOn } from '../todos/groups';
import { BAND, cardsFor, focusGrid, focusOf, moveCard, placeOf, TOP, type Card, type FocusSlot, type Laid, type Place } from './model';
import './dayplan.css';


/** Where a dragged card is over: a place and an index in it, the goal (a to-do becomes a step), or a dock. */
type Over = { kind: 'place'; place: Place; index: number } | { kind: 'goal' } | { kind: 'tomorrow' } | { kind: 'bin' } | null;

/** The day after the page's day is "Tomorrow" only on today's page; on a day ahead it is that day's next day. */
const nextDayWord = (date: ISODate, today: ISODate) => (date === today ? 'Tomorrow' : 'Next day');

interface Drag {
  ref: string;
  card: Card;
  laid: Laid;
  over: Over;
  w: number;
  h: number;
  /** where it was lifted from: held open (a spacer) while it is over another place, so nothing above the finger moves */
  from: { place: Place; index: number } | null;
  /** the finger's offset inside the card when it lifted */
  ox: number;
  oy: number;
}

const inside = (r: DOMRect, x: number, y: number, pad = 0) => x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;

/**
 * Plan your day (Today, under the hero): the day's goal with its steps, then the day's to-dos as one list in the order they
 * matter. The first three open ones sit in a highlighted box: your three priorities. Check one off and it greys, then
 * steps out of the box, and the next one moves up into it; the rest wait below, quiet and folded, so what is in front of
 * you is all you see. Hold a row and drag it to change the order (the order is the hand's alone: a row's priority flag
 * stays as it was set). Drop a to-do on the goal (or on its dock) and it becomes a step; drop it on Tomorrow or the bin
 * and it goes. A hold let go without moving opens the row's menu.
 */
export const PlanDay = memo(function PlanDay({ date, today, yesterday }: { date: ISODate; today: ISODate; yesterday?: React.ReactNode }) {
  const todos = useTodos();
  const goals = useGoals();
  const reduce = useReduced();
  const editable = date >= today;
  const goal = goalOf(goals.data, 'day', date);
  const week = goalOf(goals.data, 'week', periodOf('week', date));

  // the to-dos only (the goal's steps live in the goal's card): open ones in priority order, then what got done
  const cards = useMemo(() => focusOf(cardsFor(todos.data, null, date, today)), [todos.data, date, today]);
  const laid = useMemo<Laid>(() => ({ tray: cards, bands: { morning: [], afternoon: [], evening: [] } }), [cards]);

  // the drop's order stays on screen until the cache has it (the reorder writes it there a tick later)
  const [held, setHeld] = useState<Laid | null>(null);
  useEffect(() => setHeld(null), [cards]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const shown = drag?.laid ?? held ?? laid;

  const gx = useMotionValue(0);
  const gy = useMotionValue(0);
  const tilt = useSpring(0, { stiffness: 300, damping: 24 });
  const ghostScale = useMotionValue(1);
  const ghostFade = useMotionValue(1);
  const boardRef = useRef<HTMLDivElement>(null);
  const live = useRef<Drag | null>(null);
  live.current = drag;
  const lastX = useRef({ x: 0, t: 0 });

  const saveSteps = useSaveSteps();
  const { patch, reorder } = useTodoMutations();
  const act = useTodoActions(date);
  const toast = useToast();

  /** What is under the finger. The docks sit over the page (fixed), so they come first. */
  const hit = (x: number, y: number, d: Drag): Over => {
    for (const el of document.querySelectorAll<HTMLElement>('[data-pd-dock]')) if (inside(el.getBoundingClientRect(), x, y, 6)) return { kind: el.dataset.pdDock as 'tomorrow' | 'bin' | 'goal' };
    const board = boardRef.current;
    if (!board) return null;
    const g = board.querySelector<HTMLElement>('[data-pd-goal]');
    if (g && d.card.kind === 'todo' && goal && goal.steps.length < GOAL_STEPS_MAX && inside(g.getBoundingClientRect(), x, y)) return { kind: 'goal' };
    const boxes = [...board.querySelectorAll<HTMLElement>('[data-pd-box]')];
    if (!boxes.length) return null;
    const br = board.getBoundingClientRect();
    if (x < br.left - 40 || x > br.right + 40) return null;
    // the band (or the tray) the finger is in, its head included; between two, the nearer
    let box = boxes[0]!;
    let bestD = Infinity;
    for (const z of boxes) {
      const r = z.getBoundingClientRect();
      const dd = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
      if (dd < bestD) {
        bestD = dd;
        box = z;
      }
    }
    if (bestD > 120) return null;
    const best = box.querySelector<HTMLElement>('[data-pd-zone]');
    if (!best) return null;
    const place = best.dataset.pdZone as Place;
    // the index: how many of the zone's other cards sit above the finger (their layout boxes, not mid-animation)
    const zr = best.getBoundingClientRect();
    let index = 0;
    for (const el of best.querySelectorAll<HTMLElement>('[data-pd-card]')) {
      if (el.dataset.pdCard === d.ref) continue;
      const top = zr.top + el.offsetTop;
      if (top + el.offsetHeight / 2 < y) index++;
    }
    return { kind: 'place', place, index };
  };

  const same = (a: Over, b: Over) => (a?.kind === 'place' && b?.kind === 'place' ? a.place === b.place && a.index === b.index : a?.kind === b?.kind);

  const api = useRef(null as unknown as ApiFns);
  api.current = {
    promote: (card: Card) => {
      if (card.kind !== 'todo') return;
      const next = moveCard(laid, card.ref, 'tray', 0);
      const open = next.tray.flatMap((c) => (c.kind === 'todo' && !c.done ? [c.todo] : []));
      haptics.drop();
      setHeld(next);
      reorder.mutate(open.map((t) => t.id));
    },
    lift: (_ref: string) => haptics.lift(),
    start: (card: Card, el: HTMLElement, p: DragPoint) => {
      const r = el.getBoundingClientRect();
      const ox = p.x - r.left;
      const oy = p.y - r.top;
      gx.set(r.left);
      gy.set(r.top);
      ghostScale.set(1);
      ghostFade.set(1);
      animate(ghostScale, 1.04, springs.lift);
      lastX.current = { x: p.x, t: performance.now() };
      const at = placeOf(laid, card.ref);
      follow(p);
      setDrag({ ref: card.ref, card, laid: held ?? laid, over: at ? { kind: 'place', ...at } : null, from: at, w: r.width, h: r.height, ox, oy });
    },
    move: (p: DragPoint) => {
      const d = live.current;
      if (!d) return;
      gx.set(p.x - d.ox);
      gy.set(p.y - d.oy);
      // the card leans into the way it is moving, a few degrees at most
      const now = performance.now();
      const v = (p.x - lastX.current.x) / Math.max(1, now - lastX.current.t);
      lastX.current = { x: p.x, t: now };
      if (!reduce) tilt.set(Math.max(-5, Math.min(5, v * 9)));
      const over = hit(p.x, p.y, d);
      if (same(over, d.over)) return;
      haptics.select();
      setDrag({ ...d, over, laid: over?.kind === 'place' ? moveCard(d.laid, d.ref, over.place, over.index) : d.laid });
    },
    drop: () => {
      const d = live.current;
      if (!d) return;
      tilt.set(0);
      const over = d.over;
      const end = () => {
        setDrag(null);
        ghostScale.set(1);
        ghostFade.set(1);
      };
      if (over?.kind === 'place') {
        haptics.drop();
        setHeld(d.laid);
        // the open to-dos in their new order take positions 0..n (the moved one keeps its own priority flag)
        const open = d.laid.tray.flatMap((c) => (c.kind === 'todo' && !c.done ? [c.todo] : []));
        reorder.mutate(open.map((t) => t.id));
        // the card settles into its slot
        const hole = boardRef.current?.querySelector<HTMLElement>(`[data-pd-card="${CSS.escape(d.ref)}"]`);
        const r = hole?.getBoundingClientRect();
        if (r && !reduce) {
          animate(ghostScale, 1, springs.settle);
          void Promise.all([animate(gx, r.left, springs.settle), animate(gy, r.top, springs.settle)]).then(end);
        } else end();
        return;
      }
      if (!over) return snapBack(d, end);
      if (d.card.kind === 'todo' && over.kind === 'goal' && goal) {
        const x = d.card.todo;
        const step = { id: newStepId(), text: x.text.slice(0, 120), done: !!x.doneOn };
        const prevSteps = goal.steps;
        haptics.drop();
        saveSteps(goal, [...goal.steps, step]);
        patch.mutate({ id: x.id, deletedOn: goneOn(date, today) });
        toast(date === today ? 'Now a step of today’s goal' : 'Now a step of that day’s goal', {
          label: 'Undo',
          fn: () => {
            saveSteps(goal, prevSteps);
            patch.mutate({ id: x.id, deletedOn: null });
          },
        });
        return fade(end);
      }
      if (over.kind === 'tomorrow' && d.card.kind === 'todo') {
        haptics.drop();
        act.later(d.card.todo);
        return fade(end);
      }
      if (over.kind === 'bin') {
        if (d.card.kind === 'todo') act.remove(d.card.todo);
        else {
          const g = d.card.goal;
          const prev = g.steps;
          haptics.delete();
          saveSteps(g, g.steps.filter((s) => s.id !== (d.card as Extract<Card, { kind: 'step' }>).step.id));
          toast('Step removed', { label: 'Undo', fn: () => saveSteps(g, prev) });
        }
        return fade(end);
      }
      snapBack(d, end);
    },
    cancel: () => {
      const d = live.current;
      tilt.set(0);
      if (d) snapBack(d, () => setDrag(null));
    },
  };
  /**
   * From the lift on, the board follows the finger itself: the card it started on is remounted as it crosses into another
   * band (a new parent), and its own hold would go with it. The page is held still (touch), and nudged near its edges.
   */
  const listen = useRef<(() => void) | null>(null);
  useEffect(() => () => listen.current?.(), []);
  const follow = (p0: DragPoint) => {
    listen.current?.();
    let x = p0.x;
    let y = p0.y;
    const scroller = boardRef.current?.closest<HTMLElement>('.tab-scroll, .pushed, .sheet-body, [data-scroller]') ?? null;
    const point = (): DragPoint => ({ x, y, dx: x - p0.x, dy: y - p0.y });
    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      api.current.move(point());
    };
    const onUp = () => {
      off();
      api.current.drop();
    };
    const onCancel = () => {
      off();
      api.current.cancel();
    };
    const hold = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
    };
    let raf = 0;
    const tick = () => {
      // the edges the page scrolls from: under the header, and above the tab bar (never while over a dock)
      const box = scroller?.getBoundingClientRect();
      const top = Math.max(box?.top ?? 0, 0) + 140;
      const bottom = Math.min(box?.bottom ?? window.innerHeight, window.innerHeight) - 80;
      const k = live.current?.over?.kind;
      const dy = k === 'tomorrow' || k === 'bin' ? 0 : y < top ? -Math.ceil(((top - y) / 80) * 14) : y > bottom ? Math.ceil(((y - bottom) / 80) * 14) : 0;
      if (dy && scroller) {
        const before = scroller.scrollTop;
        scroller.scrollTop += Math.max(-18, Math.min(18, dy));
        if (scroller.scrollTop !== before) api.current.move(point());
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const opt = { capture: true } as const;
    window.addEventListener('pointermove', onMove, opt);
    window.addEventListener('pointerup', onUp, opt);
    window.addEventListener('pointercancel', onCancel, opt);
    document.addEventListener('touchmove', hold, { capture: true, passive: false });
    const off = () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove, opt);
      window.removeEventListener('pointerup', onUp, opt);
      window.removeEventListener('pointercancel', onCancel, opt);
      document.removeEventListener('touchmove', hold, { capture: true });
      listen.current = null;
    };
    listen.current = off;
  };
  const fade = (end: () => void) => {
    if (reduce) return end();
    animate(ghostScale, 0.6, { duration: 0.22, ease: [0.22, 1, 0.36, 1] });
    void animate(ghostFade, 0, { duration: 0.22 }).then(end);
  };
  /** Back where it came from, as if nothing happened. */
  const snapBack = (d: Drag, end: () => void) => {
    const hole = boardRef.current?.querySelector<HTMLElement>(`[data-pd-card="${CSS.escape(d.ref)}"]`);
    setDrag({ ...d, laid: held ?? laid, over: null });
    requestAnimationFrame(() => {
      const r = hole?.isConnected ? hole.getBoundingClientRect() : boardRef.current?.querySelector<HTMLElement>(`[data-pd-card="${CSS.escape(d.ref)}"]`)?.getBoundingClientRect();
      if (!r || reduce) return end();
      animate(ghostScale, 1, springs.settle);
      void Promise.all([animate(gx, r.left, springs.settle), animate(gy, r.top, springs.settle)]).then(end);
    });
  };

  const total = cards.length;
  const done = cards.filter((c) => c.done).length;
  const loaded = !!todos.data && !!goals.data;
  const title = date === today ? 'Plan your day' : date > today ? 'Plan the day' : 'The plan';
  // the goals or the to-dos could not be read: say so in one row with a way to try again, never a skeleton that never fills
  if (!loaded && (todos.isError || goals.isError))
    return (
      <section className="pd" aria-label={title}>
        <SectionHeader className="pd-head" title={title} />
        <SectionEmpty
          icon={<CloudOff size={18} aria-hidden="true" />}
          title="Not loaded"
          line="Check your connection."
          action={{
            label: 'Try again',
            onPress: () => {
              void todos.refetch();
              void goals.refetch();
            },
          }}
        />
      </section>
    );
  if (!loaded) return <section className="pd is-skel" aria-hidden="true" />;

  return (
    <section className={`pd ${drag ? 'is-dragging' : ''}`} aria-label="Plan your day">
      <SectionHeader
        className="pd-head"
        title={title}
        meta={
          total ? (
            <span className={`pd-count ${done === total ? 'is-all' : ''}`} aria-label={`${done} of ${total} done`}>
              {done === total ? `All ${total} done` : `${done} of ${total} done`}
            </span>
          ) : null
        }
      />
      <div ref={boardRef} className="pd-board">
        {/* one card, one leading edge (layout plan 2.1 T3): the day's goal; yesterday's business (a review owed, Close
            yesterday), drawn only while there is some; the to-dos. A hairline between the groups, rows inside them */}
        <div className="pd-flow">
          <GoalCard date={date} today={today} goal={goal} week={week} editable={editable} target={drag?.over?.kind === 'goal'} dragging={drag?.card.kind === 'todo'} />
          {date === today ? (
            <div className="pd-yday">
              <ReviewRow today={today} />
              {yesterday}
            </div>
          ) : null}
          <Focus cards={shown.tray} drag={drag} api={api} date={date} today={today} editable={editable} />
        </div>
      </div>
      {drag
        ? createPortal(
            <>
              <Ghost drag={drag} x={gx} y={gy} tilt={tilt} scale={ghostScale} fade={ghostFade} date={date} />
              <Docks over={drag.over} todo={drag.card.kind === 'todo'} step={drag.card.kind === 'todo' && !!goal && goal.steps.length < GOAL_STEPS_MAX} next={nextDayWord(date, today)} />
            </>,
            document.body,
          )
        : null}
    </section>
  );
});

interface ApiFns {
  /** Move a row up into the priorities (to the top of the list). */
  promote: (card: Card) => void;
  lift: (ref: string) => void;
  start: (card: Card, el: HTMLElement, p: DragPoint) => void;
  move: (p: DragPoint) => void;
  drop: () => void;
  cancel: () => void;
}
type Api = React.RefObject<ApiFns>;

/**
 * The day's goal, the card's first group (layout plan 2.1 T3), as rows. Unset: a 32 px Haze tile, the prompt in the serif at
 * 17, Dusk, and "Set the goal" (the screen's one Sky button) 16 under it. Set: the goal as the row's title (one line; the
 * whole of it in the label and one tap away), the steps as its subtitle, the ring trailing; the steps under it, starting
 * where the title starts. Done: the ring fills, the tile becomes a lit Sky coin and the moment plays once, inside the row
 * (a gold card would recolor the to-dos sharing the card). While a to-do is dragged, the row takes it as a step.
 */
const GoalCard = ({ date, today, goal, week, editable, target, dragging }: { date: ISODate; today: ISODate; goal: Aim | null; week: Aim | null; editable: boolean; target: boolean; dragging: boolean }) => {
  const open = useOpenGoal();
  const goals = useGoals();
  const saveSteps = useSaveSteps();
  const reduce = useReduced();
  const celebrate = useCelebrate();
  const { review } = useGoalMutations();
  const toast = useToast();
  const ringPop = useMotionValue(1);
  const was = useRef(goal?.status);
  const [hit, setHit] = useState(0);
  useEffect(() => {
    const before = was.current;
    was.current = goal?.status;
    if (!goal || before !== 'open' || goal.status !== 'done') return;
    celebrateOnce(`${goal.id}:${goal.updatedAt}`, false);
    setHit(Date.now());
    celebrate(goal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal?.status, goal]);
  const tile = (
    <span className="pd-node is-goal" aria-hidden="true">
      <Target size={18} strokeWidth={2.2} />
    </span>
  );
  // a day that is over with no goal: said once, nothing to set
  if (!goal && date < today)
    return (
      <div className="pd-goal is-empty is-past" data-pd-goal="">
        {tile}
        <span className="pd-goal-none">No goal was set</span>
      </div>
    );
  if (!goal) {
    // yesterday's goal, already reviewed Partly or Missed, can be carried over in one tap. While it is still owed a review,
    // the review row names it and the carry is offered in the review sheet: never two rows for one goal (plan 2.1 T4)
    const y = date === today ? goalOf(goals.data, 'day', shiftDays(today, -1)) : null;
    const carry = !!y && (y.status === 'partly' || y.status === 'missed');
    return (
      <div className="pd-goalgrp">
        <Pressable className="pd-goal is-empty" data-pd-goal="" press="surface" onPress={() => open('day', date)} label={date === today ? 'Set today’s goal' : `Set the goal for ${fmtDate('short', date)}`}>
          {tile}
          <span className="pd-goal-main">
            <span className="pd-goal-set">{date === today ? 'What would make today count?' : 'What would make this day count?'}</span>
            <span className="pd-goal-cta">
              <Plus size={16} strokeWidth={2.6} aria-hidden="true" /> Set the goal
            </span>
          </span>
        </Pressable>
        {carry ? <CarryOver today={today} className="pd-carry" /> : null}
      </div>
    );
  }
  const n = goal.steps.length;
  const k = goal.steps.filter((s) => s.done).length;
  const isDone = goal.status === 'done';
  const ended = goal.status === 'partly' || goal.status === 'missed';
  const full = n < GOAL_STEPS_MAX;
  const whose = date === today ? 'Today’s goal' : `Goal for ${fmtDate('short', date)}`;
  const sub = n ? `${k} of ${n} steps` : isDone ? 'Done' : goal.status === 'partly' ? 'Partly' : goal.status === 'missed' ? 'Missed' : date === today ? 'Today’s goal' : 'The day’s goal';
  /**
   * The ring's tap, taken here before the ring's own handler: the goal is marked done (or opened again) and its steps are
   * left exactly as they are; nobody ticks them for the owner. Done comes with an Undo that puts the status and the steps
   * back as they were.
   */
  const onRing = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isDone) return review.mutate({ id: goal.id, status: 'open' });
    const steps = goal.steps;
    if (!reduce) animate(ringPop, 1, { ...springs.complete, velocity: 5.5 });
    review.mutate({ id: goal.id, status: 'done' });
    // the moment that plays over the page lasts up to four seconds: the Undo outlasts it by the usual six
    toast('Goal marked done', { label: 'Undo', duration: 10_000, fn: () => review.mutate({ id: goal.id, status: 'open', steps }) });
  };
  return (
    <div className={`pd-goal is-${goal.status} ${target ? 'is-target' : ''} ${dragging && full ? 'is-droppable' : ''}`} data-pd-goal="">
      <div className="pd-goal-in">
        {tile}
        <Pressable className="pd-goal-main" press="dim" onPress={() => open('day', date)} label={`${whose}: ${goal.text}. ${sub}. Open`}>
          <span className="pd-goal-text">{goal.text}</span>
          <span className="pd-goal-sub">{sub}</span>
        </Pressable>
        {ended ? null : (
          <motion.span className="pd-goal-ring" style={{ scale: ringPop }} onClickCapture={onRing}>
            <GoalRing goal={goal} label={`${whose}: ${goal.text}. ${isDone ? 'Done' : 'Mark done'}`} />
            <Burst go={hit} big />
          </motion.span>
        )}
      </div>
      {n ? (
        <ul className="pd-goal-list" aria-label="Steps">
          {goal.steps.map((s) => (
            <li key={s.id} className={`pd-goal-step${s.done ? ' is-done' : ''}`}>
              <TodoMark round on={s.done} label={s.text} disabled={!editable || ended} onToggle={(next) => saveSteps(goal, goal.steps.map((x) => (x.id === s.id ? { ...x, done: next } : x)))} />
              <span className="pd-goal-step-text">{s.text}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {week ? (
        <Pressable className="pd-week" press="dim" onPress={() => open('week', week.period)} label={`This week: ${week.text}`}>
          <span className={`pd-week-dot is-${week.status}`} aria-hidden="true" />
          <span className="pd-week-text">This week: {week.text}</span>
        </Pressable>
      ) : null}
    </div>
  );
};

const REST_KEY = 'logbook.plan.rest';
const readRest = () => {
  try {
    return localStorage.getItem(REST_KEY) === '1';
  } catch {
    return false;
  }
};

/**
 * The day's to-dos as one list (one zone the drag measures). The first three open ones sit in a highlighted box, numbered:
 * the priorities. A box behind the rows (in the same grid) stays put while the rows flow through it, so a checked row
 * slides out and the next slides up into its place. Everything after them folds behind one quiet row ("+5 Then Renew
 * passport, Pay rent · 2 done"): the rest of the list, faded when shown, and what got done today, greyed at the foot. One
 * tap unfolds or folds it, remembered on this device. While a row is in the air everything shows, so it can land anywhere.
 */
const Focus = ({ cards, drag, api, date, today, editable }: { cards: Card[]; drag: Drag | null; api: Api; date: ISODate; today: ISODate; editable: boolean }) => {
  const [showRest, setShowRest] = useState(readRest);
  const [adding, setAdding] = useState(false);
  const restOpen = showRest || !!drag;
  const toggleRest = () => {
    const next = !showRest;
    setShowRest(next);
    haptics.select();
    try {
      localStorage.setItem(REST_KEY, next ? '1' : '0');
    } catch {
      /* the fold lasts the session without storage */
    }
  };
  const over = drag?.over?.kind === 'place';
  // the grid: a row per card (rank 1.. in order); row 1 is left empty (the head the list no longer draws: the section's
  // meta says the count, layout plan 2.1 T3)
  const grid = focusGrid(cards, restOpen, !!drag);
  const { rest, done } = grid.counts;
  // "Add a to-do" sits right under the top three, before the fold (plan 2.1 T3): one grid row, every row after it one down
  const addRow = editable ? grid.boxEnd : 0;
  const shift = (r: number) => (addRow && r >= addRow ? r + 1 : r);
  // everything after the three folds behind one row: the rest of the list and what got done today
  const folded = rest + done;
  const rowOf = (s: FocusSlot) => <CardRow key={s.card.ref} card={s.card} drag={drag} api={api} date={date} today={today} editable={editable && !s.card.done} hue={BAND.tray.hue} fallback={BAND.tray.icon} row={shift(s.row)} rank={s.rank} kind={s.kind} first={s.first} />;
  const fold = !folded ? null : !restOpen ? (
    <button key="pd:fold" type="button" className={`pd-rest-toggle ${rest ? '' : 'is-done-only'}`} style={{ gridRow: shift(grid.foldRow) }} onClick={toggleRest} aria-expanded={false} aria-label={`Show ${[rest ? `${rest} more` : '', done ? `${done} done` : ''].filter(Boolean).join(' and ')}`}>
      <span className="pd-rest-words">{[rest ? `${rest} more` : '', done ? `${done} done` : ''].filter(Boolean).join(' · ')}</span>
      <ChevronDown size={18} strokeWidth={2.2} aria-hidden="true" />
    </button>
  ) : rest ? (
    <span key="pd:fold" className="pd-rest-label" style={{ gridRow: shift(grid.foldRow) }}>
      After these
    </span>
  ) : null;
  return (
    <div data-pd-box="" className={`pd-focus ${over ? 'is-over' : ''}`}>
      <div className="pd-zone pd-focus-zone" data-pd-zone="tray">
        {/* with everything done, the section's meta ("All 3 done") and the fold ("3 done") say it: no line of its own */}
        {grid.emptyRow && !done ? (
          <p className="pd-top-empty" style={{ gridRow: grid.emptyRow }}>
            {date < today ? 'Nothing was planned.' : `Add what matters ${date === today ? 'today' : 'that day'}. The first three become your priorities.`}
            {/* the field's marks, said once, where the list is still empty */}
            {date === today ? <span className="pd-top-tip">Tip: end with “tomorrow” or “fri” to pick the day, or “!” to flag it.</span> : null}
          </p>
        ) : null}
        {/* every row comes from this one keyed list, in the order it reads: a row that crosses from one part to another
            (a drag over "After these", a check) keeps its node, so the finger that holds it is never let go */}
        {[...grid.top.map(rowOf), fold, ...grid.rest.map(rowOf), ...grid.done.map(rowOf)]}
        {addRow ? <AddInline key="pd:add" date={date} today={today} label="Add a to-do" placeholder="Add a to-do" hidden={!!drag} open={adding} setOpen={setAdding} row={addRow} /> : null}
        {grid.hideRow ? (
          <button type="button" className="pd-rest-toggle is-open" style={{ gridRow: shift(grid.hideRow) }} onClick={toggleRest} aria-expanded={true}>
            <span className="pd-rest-words">{done && !rest ? 'Fold away what’s done' : 'Fold the rest away'}</span>
            <ChevronDown size={18} strokeWidth={2.2} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {date === today ? <AllTodos date={date} /> : null}
    </div>
  );
};

/** The words of a card: its icon in a circle of its section's colour, its name and what it belongs to, the round check. */
const CardFace = ({ card, date, today, editable, onOpen, hue, fallback, rank, on, onToggle, focus }: { card: Card; date: ISODate; today: ISODate; editable: boolean; onOpen?: () => void; hue: string; fallback: string; rank?: number; on?: boolean; onToggle?: (next: boolean) => void; focus?: boolean }) => {
  const groups = useTodoGroups();
  const act = useTodoActions(date);
  const saveSteps = useSaveSteps();
  // words cut at the third line would take the flag after them out of sight: for those words it moves to the line under
  // them. Measured once for each wording, with the flag in place.
  const words = useRef<HTMLSpanElement>(null);
  const flagKey = card.kind === 'todo' && card.todo.priority ? card.todo.text : null;
  const [cutKey, setCutKey] = useState<string | null>(null);
  useLayoutEffect(() => {
    const el = words.current;
    if (el && flagKey !== null && el.scrollHeight > el.clientHeight + 1) setCutKey(flagKey);
  }, [flagKey]);
  if (card.kind === 'step') {
    const { goal, step } = card;
    return (
      <>
        <span className="pd-ico is-goal" aria-hidden="true">
          <Target size={18} />
        </span>
        <button type="button" className="pd-card-name" onClick={onOpen}>
          <span className="pd-card-text">{step.text}</span>
          <span className="pd-card-meta is-goal">{date === today ? 'Step of today’s goal' : 'Step of that day’s goal'}</span>
        </button>
        <TodoMark round on={step.done} label={step.text} disabled={!editable} onToggle={(next) => saveSteps(goal, goal.steps.map((s) => (s.id === step.id ? { ...s, done: next } : s)))} />
      </>
    );
  }
  const x = card.todo;
  const list = groupOf(x, groups.data);
  const meta = [list?.name, x.note].filter(Boolean).join(' · ');
  const flagBelow = flagKey !== null && cutKey === flagKey;
  // the flag stays with the last word (a short one: a long last word must be free to break)
  const cutAt = x.text.lastIndexOf(' ') + 1;
  const [head, last] = x.text.length - cutAt <= 16 ? [x.text.slice(0, cutAt), x.text.slice(cutAt)] : [x.text, ''];
  return (
    <>
      {rank ? (
        <span className="pd-rank tnum" aria-hidden="true">
          {rank}
        </span>
      ) : card.done && focus ? (
        <span className="pd-rank is-blank" aria-hidden="true" />
      ) : (
        <span className="pd-ico" aria-hidden="true">
          <ListTodo size={18} />
        </span>
      )}
      <button type="button" className="pd-card-name" onClick={onOpen}>
        {/* the words run on as a block (three lines at most here; the editor has them whole), the flag after the last one */}
        <span ref={words} className="pd-card-text">
          {x.priority && !flagBelow ? (
            <>
              {head}
              <span className="pd-card-last">
                {last} <PriorityFlag level={x.priority} />
              </span>
            </>
          ) : (
            x.text
          )}
        </span>
        {meta || flagBelow ? (
          <span className="pd-card-meta">
            {flagBelow ? <PriorityFlag level={x.priority} /> : null}
            {meta}
          </span>
        ) : null}
      </button>
      <TodoMark round on={on ?? card.done} label={x.text} disabled={!editable && !card.done && date !== today} onToggle={onToggle ?? ((next) => (next ? act.done(x, date <= today ? date : today) : act.reopen(x)))} />
    </>
  );
};

/**
 * A card on the board. A hold lifts it (the one hold clock, `useHoldDrag`); moving takes it into the air (the page's copy
 * becomes the slot it would land in); letting go without moving opens its menu. `layout` lets the others part for it.
 */
const CHECK_BEAT_MS = 520;
const CardRow = ({ card, drag, api, date, today, editable, hue, fallback, row, rank, kind, first }: { card: Card; drag: Drag | null; api: Api; date: ISODate; today: ISODate; editable: boolean; hue: string; fallback: string; row?: number; rank?: number; kind?: 'top' | 'rest' | 'done'; first?: boolean }) => {
  const groups = useTodoGroups();
  const cm = useContextMenu();
  const sheet = useSheet();
  const open = useOpenGoal();
  const act = useTodoActions(date);
  const saveSteps = useSaveSteps();
  const reduce = useReduced();
  const [armed, setArmed] = useState(false);
  // a hold that came to a menu (or a drag) owns its release: the click after it opens nothing
  const held = useRef(false);
  const tint = card.kind === 'todo' ? colorOf(card.todo, groups.data) : null;
  const isHole = drag?.ref === card.ref;
  // checked: the row greys and strikes where it is for a beat, then leaves (the next one moves up into its place)
  const [checking, setChecking] = useState(false);
  const beat = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flush = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      clearTimeout(beat.current);
      flush.current?.();
    },
    [],
  );
  const toggle =
    card.kind === 'todo' && !card.done
      ? (next: boolean) => {
          clearTimeout(beat.current);
          setChecking(next);
          if (!next) return void (flush.current = null);
          const x = card.todo;
          flush.current = () => act.done(x, date <= today ? date : today);
          beat.current = setTimeout(
            () => {
              flush.current?.();
              flush.current = null;
            },
            reduce ? 0 : CHECK_BEAT_MS,
          );
        }
      : undefined;
  const menu = (): ContextMenuItem[] => {
    if (card.kind === 'step') {
      const g = card.goal;
      return [
        { label: card.done ? 'Not done' : 'Done', icon: <RotateCcw size={18} />, onSelect: () => saveSteps(g, g.steps.map((s) => (s.id === card.step.id ? { ...s, done: !card.done } : s))) },
        { label: 'Remove step', icon: <Trash2 size={18} />, destructive: true, onSelect: () => saveSteps(g, g.steps.filter((s) => s.id !== card.step.id)) },
      ];
    }
    const x = card.todo;
    return card.done
      ? [
          { label: 'Not done', icon: <RotateCcw size={18} />, onSelect: () => act.reopen(x) },
          { label: 'Delete', icon: <Trash2 size={18} />, destructive: true, onSelect: () => act.remove(x) },
        ]
      : [
          ...(kind === 'rest' ? [{ label: 'Make it a priority', icon: <ChevronRight size={18} style={{ transform: 'rotate(-90deg)' }} />, onSelect: () => api.current.promote(card) }] : []),
          { label: nextDayWord(date, today), icon: <ArrowRight size={18} />, onSelect: () => act.later(x) },
          { label: 'Someday', icon: <Moon size={18} />, onSelect: () => act.someday(x) },
          { label: 'Delete', icon: <Trash2 size={18} />, destructive: true, onSelect: () => act.remove(x) },
        ];
  };
  const d = useHoldDrag<HTMLDivElement>({
    disabled: !editable,
    onArm: () => {
      held.current = true;
      setArmed(true);
      api.current.lift(card.ref);
    },
    onStart: (p) => {
      setArmed(false);
      if (d.ref.current) api.current.start(card, d.ref.current, p);
    },
    // once in the air the board has the finger (see `follow`)
    onCancel: (phase, reason) => {
      setArmed(false);
      if (phase === 'armed' && reason === 'up' && d.ref.current) cm.open({ items: menu(), anchor: d.ref.current, lift: d.ref.current, label: `${card.kind === 'todo' ? card.todo.text : card.step.text} actions`, haptic: false });
    },
  });
  const onOpen = () => {
    if (d.consumeClick()) return;
    if (card.kind === 'todo') sheet.open({ eyebrow: 'To-do', title: card.todo.text, body: <TodoSheet x={card.todo} date={date} /> });
    else open('day', card.goal.period);
  };
  return (
    <motion.div
      ref={d.ref}
      layout={reduce ? false : 'position'}
      transition={springs.settle}
      className={`pd-card ${card.done || checking ? 'is-done' : ''} ${checking ? 'is-checking' : ''} ${kind ? `is-${kind}` : ''} ${first ? 'is-first' : ''} ${card.kind === 'step' ? 'is-step' : ''} ${tint ? 'has-tc' : ''} ${isHole ? 'is-hole' : ''} ${armed ? 'is-armed' : ''}`}
      style={{ ...colorStyle(tint), '--mk': card.kind === 'step' ? 'var(--sun)' : hue, ...(row ? { gridRow: row } : {}) } as React.CSSProperties}
      data-pd-card={card.ref}
      {...d.bind}
      onPointerDown={(e) => {
        held.current = false;
        d.bind.onPointerDown(e);
      }}
      onClickCapture={(e) => {
        if (!held.current) return;
        held.current = false;
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div className="pd-card-in">
        <CardFace card={card} date={date} today={today} editable={editable} onOpen={onOpen} hue={hue} fallback={fallback} rank={rank} on={card.done || checking} onToggle={toggle} focus={!!kind} />
      </div>
    </motion.div>
  );
};

/** The card in the air: over everything, leaning into its motion, in the colour of where it would land. */
const Ghost = ({ drag, x, y, tilt, scale, fade, date }: { drag: Drag; x: MotionValue<number>; y: MotionValue<number>; tilt: MotionValue<number>; scale: MotionValue<number>; fade: MotionValue<number>; date: ISODate }) => {
  const groups = useTodoGroups();
  const tint = drag.card.kind === 'todo' ? colorOf(drag.card.todo, groups.data) : null;
  const place = drag.over?.kind === 'place' ? drag.over.place : (drag.from?.place ?? 'tray');
  const meta = BAND[place];
  // its number goes with it: the place it would take in the list if let go now (where it was lifted from, off the list)
  const at = drag.laid.tray.filter((c) => !c.done).findIndex((c) => c.ref === drag.ref);
  const rank = drag.card.done || at < 0 ? undefined : at + 1;
  return (
    <motion.div className={`pd-ghost pd-card ${rank && rank > TOP ? 'is-rest' : ''} ${drag.card.kind === 'step' ? 'is-step' : ''} ${drag.card.done ? 'is-done' : ''} ${tint ? 'has-tc' : ''} ${drag.over?.kind === 'bin' ? 'is-bin' : ''}`} style={{ x, y, rotate: tilt, scale, opacity: fade, width: drag.w, ...colorStyle(tint), '--mk': meta.hue, '--gh': meta.hue } as React.CSSProperties} aria-hidden="true">
      <div className="pd-card-in">
        <CardFace card={drag.card} date={date} today={date} editable={false} hue={meta.hue} fallback={meta.icon} rank={rank} focus />
      </div>
    </motion.div>
  );
};

/**
 * While a card is in the air: the day after (to-dos), the goal when it can take a step (to-dos), and the bin, over the
 * header. The header's title is veiled behind them, so the words in the docks are the only ones there. `next` is the first
 * dock's word: "Tomorrow" on today's page, "Next day" on a day ahead.
 */
const Docks = ({ over, todo, step, next }: { over: Over; todo: boolean; step: boolean; next: string }) => (
  <motion.div className={`pd-docks ${todo && step ? 'is-three' : ''}`} initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', duration: 0.3, bounce: 0.15 }}>
    {todo ? (
      <span className={`pd-dock ${over?.kind === 'tomorrow' ? 'is-over' : ''}`} data-pd-dock="tomorrow">
        <ArrowRight size={17} strokeWidth={2.4} aria-hidden="true" /> {next}
      </span>
    ) : null}
    {step ? (
      <span className={`pd-dock is-goal ${over?.kind === 'goal' ? 'is-over' : ''}`} data-pd-dock="goal">
        <Target size={17} strokeWidth={2.4} aria-hidden="true" /> Make it a step
      </span>
    ) : null}
    <span className={`pd-dock is-bin ${over?.kind === 'bin' ? 'is-over' : ''}`} data-pd-dock="bin">
      <Trash2 size={17} strokeWidth={2.4} aria-hidden="true" /> {todo ? 'Delete' : 'Remove'}
    </span>
  </motion.div>
);

/**
 * Add a to-do where it is asked for (the quick-add words work: `!!`, `#list`, `tomorrow`). What the field read from the
 * marks shows as it is typed (beside the words, or under them in a narrow field), and a to-do that lands on another day
 * says where it went, with a way to see it.
 */
const AddInline = ({ date, today, label, placeholder, hidden, open, setOpen, onAdd, row }: { date: ISODate; today: ISODate; label: string; placeholder: string; hidden?: boolean; open: boolean; setOpen: (o: boolean) => void; onAdd?: (id: string) => void; row?: number }) => {
  const { add } = useTodoMutations();
  const groups = useTodoGroups();
  const sheet = useSheet();
  const toast = useToast();
  const hintId = useId();
  const [draft, setDraft] = useState('');
  // nothing moves for the keyboard by itself: the field's row is scrolled clear of it when it opens, again when the
  // keyboard has come up, on a later focus, and after each Return (the new to-do pushes the field down a row). The
  // opening is caught here, not by onFocus: React sends no onFocus for the focus that autoFocus gives on mount.
  const field = useRef<HTMLDivElement>(null);
  const reveal = () => {
    if (field.current) revealField(field.current);
  };
  const kb = useKeyboardOpen();
  useEffect(() => {
    if (open) reveal();
  }, [open, kb]);
  const parsed = parseQuickAdd(draft, today, groups.data);
  const understood = understoodOf(parsed, groups.data);
  const commit = (close: boolean) => {
    if (parsed.text) {
      const id = newTodoId();
      const forDay = date !== today && parsed.bucket === 'today' ? { bucket: 'later' as const, due: date } : { bucket: parsed.bucket, due: parsed.due };
      add.mutate({ id, text: parsed.text, date: today, priority: parsed.priority, groupId: parsed.groupId ?? null, ...forDay });
      onAdd?.(id);
      // it did not land on this page (a day or Someday was named): say where it went
      const elsewhere = forDay.bucket === 'someday' || (forDay.bucket === 'later' && forDay.due !== date);
      if (elsewhere) {
        const fold = forDay.bucket === 'someday' ? ('someday' as const) : ('later' as const);
        toast(forDay.bucket === 'someday' ? 'Added to Someday' : !forDay.due ? 'Added to Later' : forDay.due === shiftDays(today, 1) ? 'Added for tomorrow' : `Added for ${fmtDate('short', forDay.due)}`, {
          label: 'View',
          fn: () => sheet.open({ title: 'To-dos', detent: 'medium', detents: ['medium', 'large'], body: <TodoListSheet date={today} open={fold} /> }),
        });
      }
    }
    setDraft('');
    if (close || !parsed.text) setOpen(false);
    else reveal();
  };
  if (!open)
    return (
      <Pressable className={`pd-add ${hidden ? 'pd-hide' : ''}`} style={row ? { gridRow: row } : undefined} press="surface" onPress={() => setOpen(true)} label={placeholder}>
        <span className="pd-add-ic" aria-hidden="true">
          <Plus size={16} strokeWidth={2.4} />
        </span>
        <span className="pd-add-text">{label}</span>
      </Pressable>
    );
  return (
    <div ref={field} className="pd-add is-field" style={row ? { gridRow: row } : undefined}>
      <span className="pd-add-ic" aria-hidden="true">
        <Plus size={16} strokeWidth={2.4} />
      </span>
      <span className="pd-add-main">
        <input
          autoFocus
          className="pd-add-input"
          placeholder={placeholder}
          maxLength={200}
          aria-label="New to-do"
          aria-describedby={understood ? hintId : undefined}
          enterKeyHint="done"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={reveal}
          onBlur={() => commit(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit(false);
            } else if (e.key === 'Escape') setOpen(false);
          }}
        />
        {understood ? (
          <span id={hintId} className="tt-hint caps" role="status">
            {understood}
          </span>
        ) : null}
      </span>
    </div>
  );
};

/** The rest of the to-dos (Later, Someday, every list) in the sheet: the card's last row, a quiet Deep Sky action. */
const AllTodos = ({ date }: { date: ISODate }) => {
  const sheet = useSheet();
  const todos = useTodos();
  const g = groupsOn(todos.data, date);
  const later = g[1]!.items.length;
  const someday = g[2]!.items.length;
  const more = [later ? `Later ${later}` : null, someday ? `Someday ${someday}` : null].filter(Boolean).join(' · ');
  return (
    <Pressable className="pd-all" press="surface" onPress={() => sheet.open({ title: 'To-dos', detent: 'medium', detents: ['medium', 'large'], body: <TodoListSheet date={date} /> })} label={`Open all to-dos${more ? `: ${more}` : ''}`}>
      <span className="pd-all-text">All to-dos</span>
      {more ? <span className="pd-all-more">{more}</span> : null}
      <ChevronRight size={18} aria-hidden="true" />
    </Pressable>
  );
};
