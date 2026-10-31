import { awaitingReview, DAY_BANDS, GOAL_STEPS_MAX, goalProgress, periodOf, stepRef, todoRef, type Aim, type DayBand, type ISODate, type Todo } from '@logbook/shared';
import { ArrowRight, ChevronRight, Moon, Plus, RotateCcw, Sun, Sunrise, Target, Trash2 } from 'lucide-react';
import { animate, AnimatePresence, motion, useMotionValue, useSpring, type MotionValue } from 'motion/react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { newTodoId, useDayPlan, useDayPlanSave, useGoals, useTodoGroups, useTodoMutations, useTodos } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { springs, useReduced } from '@/lib/motion';
import { useHoldDrag, type DragPoint } from '@/lib/useDrag';
import { useNowMinutes } from '../day/useNow';
import { useContextMenu, type ContextMenuItem } from '@/ui/ContextMenu';
import { Pressable } from '@/ui/Pressable';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { useOpenGoal } from '../goals/GoalSheets';
import { goalOf, periodCaps } from '../goals/model';
import { GoalRing, newStepId, useSaveSteps } from '../goals/Steps';
import { Burst, celebrateOnce } from '../goals/game';
import { colorOf, colorStyle, groupOf, ListChip } from '../todos/colors';
import { PriorityFlag } from '../todos/PriorityDots';
import { parseQuickAdd } from '../todos/quickAdd';
import { TodoListSheet, useTodoActions } from '../todos/TodoList';
import { TodoMark } from '../todos/TodoMark';
import { TodoSheet } from '../todos/TodoSheet';
import { groupsOn } from '../todos/groups';
import { BAND, bandsOf, bandTime, cardsFor, lay, moveCard, placeOf, swapRef, type Card, type Laid, type Place } from './model';
import './dayplan.css';

const BAND_ICON = { morning: Sunrise, afternoon: Sun, evening: Moon } as const;

/** Where a dragged card is over: a place and an index in it, the goal (a to-do becomes a step), or a dock. */
type Over = { kind: 'place'; place: Place; index: number } | { kind: 'goal' } | { kind: 'tomorrow' } | { kind: 'bin' } | null;

interface Drag {
  ref: string;
  card: Card;
  laid: Laid;
  over: Over;
  w: number;
  h: number;
  chip: boolean;
  /** where it was lifted from: held open (a spacer) while it is over another place, so nothing above the finger moves */
  from: { place: Place; index: number } | null;
  /** the finger's offset inside the card when it lifted */
  ox: number;
  oy: number;
}

const inside = (r: DOMRect, x: number, y: number, pad = 0) => x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;

/**
 * Plan your day (Today, under the hero): the day's goal, then the day itself in three bands (Morning, Afternoon, Evening) with
 * a tray above them of what has no time yet. Every to-do and every step of the goal is a card: hold one and it lifts off
 * the page and follows the finger; the cards it passes part for it; it drops into place. Drop a to-do on the goal and it
 * becomes one of the goal's steps; drop it on Tomorrow or the bin and it goes. A hold let go without moving opens the
 * card's menu. Checking a card leaves it where it is, struck, so the day fills up as it goes: the goal's wash, and each
 * band's rail, grow with every check.
 */
export const PlanDay = memo(function PlanDay({ date, today }: { date: ISODate; today: ISODate }) {
  const todos = useTodos();
  const goals = useGoals();
  const plan = useDayPlan(date);
  const save = useDayPlanSave(date);
  const reduce = useReduced();
  const editable = date >= today;
  const goal = goalOf(goals.data, 'day', date);
  const week = goalOf(goals.data, 'week', periodOf('week', date));
  const owed = date === today ? awaitingReview(goals.data ?? [], today)[0] : undefined;

  const cards = useMemo(() => cardsFor(todos.data, goal, date, today), [todos.data, goal, date, today]);
  const stored = plan.data?.bands;
  const laid = useMemo(() => lay(cards, stored ?? { morning: [], afternoon: [], evening: [] }), [cards, stored]);

  // the drop's layout stays on screen until the cache has it (the save writes it there a tick later)
  const [held, setHeld] = useState<Laid | null>(null);
  useEffect(() => setHeld(null), [stored, cards]);
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
  const { patch } = useTodoMutations();
  const act = useTodoActions(date);
  const toast = useToast();

  /** What is under the finger. The docks sit over the page (fixed), so they come first. */
  const hit = (x: number, y: number, d: Drag): Over => {
    for (const el of document.querySelectorAll<HTMLElement>('[data-pd-dock]')) if (inside(el.getBoundingClientRect(), x, y, 6)) return { kind: el.dataset.pdDock as 'tomorrow' | 'bin' };
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
    const wrap = place === 'tray';
    let index = 0;
    for (const el of best.querySelectorAll<HTMLElement>('[data-pd-card]')) {
      if (el.dataset.pdCard === d.ref) continue;
      const top = zr.top + el.offsetTop;
      if (!wrap) {
        if (top + el.offsetHeight / 2 < y) index++;
      } else if (top + el.offsetHeight < y || (top <= y && zr.left + el.offsetLeft + el.offsetWidth / 2 < x)) index++;
    }
    return { kind: 'place', place, index };
  };

  const same = (a: Over, b: Over) => (a?.kind === 'place' && b?.kind === 'place' ? a.place === b.place && a.index === b.index : a?.kind === b?.kind);

  const api = useRef(null as unknown as ApiFns);
  api.current = {
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
      setDrag({ ref: card.ref, card, laid: held ?? laid, over: at ? { kind: 'place', ...at } : null, from: at, w: r.width, h: r.height, ox, oy, chip: el.classList.contains('is-chip') });
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
        save.mutate(bandsOf(d.laid));
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
        const before = stored ?? bandsOf(laid);
        haptics.drop();
        saveSteps(goal, [...goal.steps, step]);
        patch.mutate({ id: x.id, deletedOn: date });
        save.mutate(swapRef(before, d.ref, stepRef(goal.id, step.id)));
        toast('Now a step of today’s goal', {
          label: 'Undo',
          fn: () => {
            saveSteps(goal, prevSteps);
            patch.mutate({ id: x.id, deletedOn: null });
            save.mutate(before);
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

  const spot = drag?.from && !(drag.over?.kind === 'place' && drag.over.place === drag.from.place) && placeOf(drag.laid, drag.ref)?.place !== drag.from.place ? drag.from : null;
  const spacer = (p: Place): Spacer | null => (spot && drag && spot.place === p ? { index: spot.index, w: drag.w, h: drag.h } : null);
  const total = cards.length;
  const done = cards.filter((c) => c.done).length;
  const loaded = !!todos.data && !!goals.data;
  if (!loaded) return <section className="pd is-skel" aria-hidden="true" />;

  return (
    <section className={`pd ${drag ? 'is-dragging' : ''}`} aria-label="Plan your day">
      <div className="pd-head">
        <h2 className="section-title">{date === today ? 'Plan your day' : date > today ? 'Plan the day' : 'The day'}</h2>
        {total ? (
          <span className="pd-head-meta tnum">
            {done} of {total}
          </span>
        ) : null}
      </div>
      <div ref={boardRef} className="pd-board">
        {owed ? <OwedRow goal={owed} today={today} /> : null}
        <GoalCard date={date} today={today} goal={goal} week={week} target={drag?.over?.kind === 'goal'} dragging={drag?.card.kind === 'todo'} />
        <Tray cards={shown.tray} drag={drag} api={api} date={date} today={today} editable={editable} empty={!total} spacer={spacer('tray')} />
        {DAY_BANDS.map((b) => (
          <Band key={b} band={b} cards={shown.bands[b]} spacer={spacer(b)} drag={drag} api={api} date={date} today={today} editable={editable} onAdd={(id) => save.mutate({ ...bandsOf(shown), [b]: [...shown.bands[b].map((c) => c.ref), todoRef(id)] })} />
        ))}
        {date === today ? <AllTodos date={date} /> : null}
      </div>
      {drag
        ? createPortal(
            <>
              <Ghost drag={drag} x={gx} y={gy} tilt={tilt} scale={ghostScale} fade={ghostFade} date={date} />
              <Docks over={drag.over} todo={drag.card.kind === 'todo'} />
            </>,
            document.body,
          )
        : null}
    </section>
  );
});

interface ApiFns {
  lift: (ref: string) => void;
  start: (card: Card, el: HTMLElement, p: DragPoint) => void;
  move: (p: DragPoint) => void;
  drop: () => void;
  cancel: () => void;
}
type Api = React.RefObject<ApiFns>;

interface Spacer {
  index: number;
  w: number;
  h: number;
}

/** A zone's cards, with the lifted card's old room kept open where it was (see `Drag.from`). */
const ZoneCards = ({ cards, spacer, drag, api, date, today, editable, chip }: { cards: Card[]; spacer: Spacer | null; drag: Drag | null; api: Api; date: ISODate; today: ISODate; editable: boolean; chip?: boolean }) => {
  const nodes = cards.map((c) => <CardRow key={c.ref} card={c} drag={drag} api={api} date={date} today={today} editable={editable} chip={chip} />);
  if (spacer) nodes.splice(Math.min(spacer.index, nodes.length), 0, <span key="pd-spacer" className="pd-spacer" style={{ width: chip ? spacer.w : undefined, height: spacer.h }} aria-hidden="true" />);
  return <>{nodes}</>;
};

/** A review owed (a past goal still open): one quiet row above the goal. */
const OwedRow = ({ goal, today }: { goal: Aim; today: ISODate }) => {
  const open = useOpenGoal();
  const caps = periodCaps(goal.level, goal.period, today);
  return (
    <Pressable className="pd-owed" press="surface" onPress={() => open(goal.level, goal.period)} label={`${caps}: ${goal.text}. Did you hit it?`}>
      <span className="pd-owed-dot" aria-hidden="true" />
      <span className="pd-owed-text">
        <span className="caps">{caps}</span>
        <span>Did you hit it?</span>
      </span>
      <ChevronRight size={16} aria-hidden="true" />
    </Pressable>
  );
};

/**
 * The day's goal, as the headline of the plan: its words in the serif, the ring to finish it, and a wash of light that
 * fills the card from the left as its steps are checked. When it is done the card glows and the burst plays. While a to-do
 * is dragged, the card opens to take it as a step.
 */
const GoalCard = ({ date, today, goal, week, target, dragging }: { date: ISODate; today: ISODate; goal: Aim | null; week: Aim | null; target: boolean; dragging: boolean }) => {
  const open = useOpenGoal();
  const reduce = useReduced();
  const was = useRef(goal?.status);
  const [hit, setHit] = useState(0);
  useEffect(() => {
    const before = was.current;
    was.current = goal?.status;
    if (!goal || before !== 'open' || goal.status !== 'done') return;
    celebrateOnce(`${goal.id}:${goal.updatedAt}`, false);
    setHit(Date.now());
  }, [goal?.status, goal]);
  if (!goal)
    return (
      <Pressable className="pd-goal is-empty" data-pd-goal="" press="surface" onPress={() => open('day', date)} label={date === today ? 'Set today’s goal' : 'Set this day’s goal'}>
        <span className="pd-goal-plus" aria-hidden="true">
          <Target size={18} strokeWidth={2.2} />
        </span>
        <span className="pd-goal-main">
          <span className="pd-goal-set">{date === today ? 'Set today’s goal' : 'Set this day’s goal'}</span>
          <span className="pd-goal-sub">The one thing that would make the day count</span>
        </span>
      </Pressable>
    );
  const p = goalProgress(goal);
  const n = goal.steps.length;
  const k = goal.steps.filter((s) => s.done).length;
  const isDone = goal.status === 'done';
  const ended = goal.status === 'partly' || goal.status === 'missed';
  const full = n < GOAL_STEPS_MAX;
  return (
    <div className={`pd-goal is-${goal.status} ${target ? 'is-target' : ''} ${dragging && full ? 'is-open' : ''}`} data-pd-goal="">
      <motion.span className="pd-goal-wash" aria-hidden="true" initial={false} animate={{ scaleX: isDone ? 1 : Math.max(0, p) }} transition={reduce ? { duration: 0 } : { type: 'spring', duration: 0.7, bounce: 0.1 }} />
      <span className="pd-goal-edge" aria-hidden="true" style={{ left: `${(isDone ? 1 : p) * 100}%`, opacity: p > 0 && !isDone ? 1 : 0 }} />
      <div className="pd-goal-in">
        {ended ? null : (
          <span className="pd-goal-ring">
            <GoalRing goal={goal} label={`Today’s goal: ${goal.text}. ${isDone ? 'Done' : 'Mark done'}`} />
            <Burst go={hit} big />
          </span>
        )}
        <Pressable className="pd-goal-main" press="dim" onPress={() => open('day', date)} label={`${goal.text}. Open`}>
          <span className="caps pd-goal-caps">
            {date === today ? 'Today’s goal' : periodCaps('day', date, today)}
            {n ? <span className="tnum"> · {k} of {n} steps</span> : null}
          </span>
          <span className="pd-goal-text">{goal.text}</span>
        </Pressable>
      </div>
      <AnimatePresence>
        {target || (dragging && full) ? (
          <motion.span className="pd-goal-drop" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <Plus size={14} strokeWidth={2.6} aria-hidden="true" /> {target ? 'Let go to make it a step' : 'Drop here to make it a step'}
          </motion.span>
        ) : null}
      </AnimatePresence>
      {week ? (
        <Pressable className="pd-week" press="dim" onPress={() => open('week', week.period)} label={`This week: ${week.text}`}>
          <span className={`pd-week-dot is-${week.status}`} aria-hidden="true" />
          <span className="pd-week-text">
            <span className="caps">This week</span> {week.text}
          </span>
        </Pressable>
      ) : null}
    </div>
  );
};

/** What has no time yet. It hides when empty, except while a card is in the air (then it is a place to put one back). */
const Tray = ({ cards, drag, api, date, today, editable, empty, spacer }: { cards: Card[]; drag: Drag | null; api: Api; date: ISODate; today: ISODate; editable: boolean; empty: boolean; spacer: Spacer | null }) => {
  const [adding, setAdding] = useState(false);
  const show = cards.length > 0 || !!drag || adding || empty;
  if (!show && !editable) return null;
  return (
    <div data-pd-box="" className={`pd-tray ${drag?.over?.kind === 'place' && drag.over.place === 'tray' ? 'is-over' : ''} ${!cards.length && !drag ? 'is-empty' : ''}`}>
      {show ? (
        <div className="pd-tray-head">
          <span className="caps">{cards.length ? 'To place' : drag ? 'No time yet' : ''}</span>
          {cards.length && !drag ? <span className="pd-hint">Hold a card, then drag it into the day</span> : null}
        </div>
      ) : null}
      <div className="pd-zone" data-pd-zone="tray">
        <ZoneCards cards={cards} spacer={spacer} drag={drag} api={api} date={date} today={today} editable={editable} chip />
        {!cards.length && !spacer && drag ? <span className="pd-slot" aria-hidden="true" /> : null}
      </div>
      {/* hidden, never removed, while a card is in the air: the page below must not move under the finger */}
      {editable ? (
        <div className={drag ? 'pd-hide' : undefined}>
          <AddInline date={date} today={today} placeholder={empty ? 'What needs doing?' : 'Add a to-do'} open={adding} setOpen={setAdding} />
        </div>
      ) : null}
    </div>
  );
};

/** One band of the day: its rail (the hue of its hour, filling as its cards are checked), its head, its cards, its slot. */
const Band = ({ band, cards, spacer, drag, api, date, today, editable, onAdd }: { band: DayBand; cards: Card[]; spacer: Spacer | null; drag: Drag | null; api: Api; date: ISODate; today: ISODate; editable: boolean; onAdd: (id: string) => void }) => {
  const minutes = useNowMinutes();
  const [adding, setAdding] = useState(false);
  const reduce = useReduced();
  const time = date === today ? bandTime(band, Math.floor(minutes / 60)) : date < today ? 'past' : 'ahead';
  const Icon = BAND_ICON[band];
  const done = cards.filter((c) => c.done).length;
  const fill = cards.length ? done / cards.length : 0;
  const over = drag?.over?.kind === 'place' && drag.over.place === band;
  const allDone = cards.length > 0 && done === cards.length;
  return (
    <div data-pd-box="" className={`pd-band is-${time} ${over ? 'is-over' : ''} ${allDone ? 'is-done' : ''}`} style={{ '--bh': BAND[band].hue } as React.CSSProperties}>
      <span className="pd-rail" aria-hidden="true">
        <motion.i initial={false} animate={{ scaleY: fill }} transition={reduce ? { duration: 0 } : { type: 'spring', duration: 0.6, bounce: 0 }} />
      </span>
      <div className="pd-band-head">
        <span className="pd-band-ic" aria-hidden="true">
          <Icon size={15} strokeWidth={2.2} />
        </span>
        <span className="pd-band-name">{BAND[band].label}</span>
        {time === 'now' ? <span className="pd-now">Now</span> : <span className="pd-band-span">{BAND[band].span}</span>}
        {cards.length ? (
          <span className="pd-band-count tnum">
            {done}/{cards.length}
          </span>
        ) : null}
        {editable ? (
          <button type="button" className={`pd-band-add ${drag ? 'pd-hide' : ''}`} aria-label={`Add a to-do to the ${BAND[band].label.toLowerCase()}`} onClick={() => setAdding(true)}>
            <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <div className="pd-zone" data-pd-zone={band}>
        <ZoneCards cards={cards} spacer={spacer} drag={drag} api={api} date={date} today={today} editable={editable} />
        {!cards.length && !spacer ? <span className={`pd-slot ${drag ? 'is-live' : ''}`}>{drag ? `Drop into the ${BAND[band].label.toLowerCase()}` : time === 'past' ? 'Nothing here' : 'Nothing yet'}</span> : null}
      </div>
      {adding ? <AddInline date={date} today={today} placeholder={`Add to the ${BAND[band].label.toLowerCase()}`} open setOpen={setAdding} onAdd={onAdd} /> : null}
    </div>
  );
};

/** The words of a card: the same face on the page and in the air. */
const CardFace = ({ card, date, today, editable, onOpen, chip }: { card: Card; date: ISODate; today: ISODate; editable: boolean; onOpen?: () => void; chip?: boolean }) => {
  const groups = useTodoGroups();
  const act = useTodoActions(date);
  const saveSteps = useSaveSteps();
  if (card.kind === 'step') {
    const { goal, step } = card;
    return (
      <>
        <TodoMark on={step.done} label={step.text} disabled={!editable} onToggle={(next) => saveSteps(goal, goal.steps.map((s) => (s.id === step.id ? { ...s, done: next } : s)))} />
        <button type="button" className="pd-card-name" onClick={onOpen}>
          <span className="pd-card-text">{step.text}</span>
        </button>
        <span className="pd-tag is-goal" aria-label="A step of the day’s goal">
          <Target size={12} strokeWidth={2.4} aria-hidden="true" />
          {chip ? null : 'Goal'}
        </span>
      </>
    );
  }
  const x = card.todo;
  const list = groupOf(x, groups.data);
  return (
    <>
      <TodoMark on={card.done} label={x.text} disabled={!editable && date !== today} onToggle={(next) => (next ? act.done(x, date <= today ? date : today) : act.reopen(x))} />
      <button type="button" className="pd-card-name" onClick={onOpen}>
        <span className="pd-card-text">
          {x.text}
          <PriorityFlag level={x.priority} />
        </span>
        {x.note && !chip ? <span className="pd-card-note">{x.note}</span> : null}
      </button>
      {list && !chip ? <ListChip group={list} /> : null}
    </>
  );
};

/**
 * A card on the board. A hold lifts it (the one hold clock, `useHoldDrag`); moving takes it into the air (the page's copy
 * becomes the slot it would land in); letting go without moving opens its menu. `layout` lets the others part for it.
 */
const CardRow = ({ card, drag, api, date, today, editable, chip }: { card: Card; drag: Drag | null; api: Api; date: ISODate; today: ISODate; editable: boolean; chip?: boolean }) => {
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
          { label: 'Tomorrow', icon: <ArrowRight size={18} />, onSelect: () => act.later(x) },
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
      className={`pd-card ${chip ? 'is-chip' : ''} ${card.done ? 'is-done' : ''} ${card.kind === 'step' ? 'is-step' : ''} ${tint ? 'has-tc' : ''} ${isHole ? 'is-hole' : ''} ${armed ? 'is-armed' : ''}`}
      style={colorStyle(tint)}
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
        <CardFace card={card} date={date} today={today} editable={editable} onOpen={onOpen} chip={chip} />
      </div>
    </motion.div>
  );
};

/** The card in the air: over everything, leaning into its motion, with the shadow of something lifted. */
const Ghost = ({ drag, x, y, tilt, scale, fade, date }: { drag: Drag; x: MotionValue<number>; y: MotionValue<number>; tilt: MotionValue<number>; scale: MotionValue<number>; fade: MotionValue<number>; date: ISODate }) => {
  const groups = useTodoGroups();
  const tint = drag.card.kind === 'todo' ? colorOf(drag.card.todo, groups.data) : null;
  return (
    <motion.div className={`pd-ghost pd-card ${drag.chip ? 'is-chip' : ''} ${drag.card.kind === 'step' ? 'is-step' : ''} ${drag.card.done ? 'is-done' : ''} ${tint ? 'has-tc' : ''} ${drag.over?.kind === 'bin' ? 'is-bin' : ''}`} style={{ x, y, rotate: tilt, scale, opacity: fade, width: drag.w, ...colorStyle(tint) }} aria-hidden="true">
      <div className="pd-card-in">
        <CardFace card={drag.card} date={date} today={date} editable={false} chip={drag.chip} />
      </div>
    </motion.div>
  );
};

/** While a card is in the air: Tomorrow (to-dos) and the bin, over the header. */
const Docks = ({ over, todo }: { over: Over; todo: boolean }) => (
  <motion.div className="pd-docks" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', duration: 0.3, bounce: 0.15 }}>
    {todo ? (
      <span className={`pd-dock ${over?.kind === 'tomorrow' ? 'is-over' : ''}`} data-pd-dock="tomorrow">
        <ArrowRight size={17} strokeWidth={2.4} aria-hidden="true" /> Tomorrow
      </span>
    ) : null}
    <span className={`pd-dock is-bin ${over?.kind === 'bin' ? 'is-over' : ''}`} data-pd-dock="bin">
      <Trash2 size={17} strokeWidth={2.4} aria-hidden="true" /> {todo ? 'Delete' : 'Remove'}
    </span>
  </motion.div>
);

/** Add a to-do where it is asked for (the quick-add words work: `!!`, `#list`, `tomorrow`). */
const AddInline = ({ date, today, placeholder, open, setOpen, onAdd }: { date: ISODate; today: ISODate; placeholder: string; open: boolean; setOpen: (o: boolean) => void; onAdd?: (id: string) => void }) => {
  const { add } = useTodoMutations();
  const groups = useTodoGroups();
  const [draft, setDraft] = useState('');
  const commit = (close: boolean) => {
    const parsed = parseQuickAdd(draft, today, groups.data);
    if (parsed.text) {
      const id = newTodoId();
      const forDay = date !== today && parsed.bucket === 'today' ? { bucket: 'later' as const, due: date } : { bucket: parsed.bucket, due: parsed.due };
      add.mutate({ id, text: parsed.text, date: today, priority: parsed.priority, groupId: parsed.groupId ?? null, ...forDay });
      onAdd?.(id);
    }
    setDraft('');
    if (close || !parsed.text) setOpen(false);
  };
  if (!open)
    return (
      <Pressable className="pd-add" press="surface" onPress={() => setOpen(true)}>
        <Plus size={17} strokeWidth={2.4} aria-hidden="true" />
        {placeholder}
      </Pressable>
    );
  return (
    <div className="pd-add is-field">
      <Plus size={17} strokeWidth={2.4} aria-hidden="true" />
      <input
        autoFocus
        className="pd-add-input"
        placeholder={placeholder}
        maxLength={200}
        enterKeyHint="done"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit(false);
          } else if (e.key === 'Escape') setOpen(false);
        }}
      />
    </div>
  );
};

/** The rest of the to-dos (Later, Someday, every list) in the sheet. */
const AllTodos = ({ date }: { date: ISODate }) => {
  const sheet = useSheet();
  const todos = useTodos();
  const g = groupsOn(todos.data, date);
  const later = g[1]!.items.length;
  const someday = g[2]!.items.length;
  const words = ['All to-dos', later ? `Later ${later}` : null, someday ? `Someday ${someday}` : null].filter(Boolean).join(' · ');
  return (
    <Pressable className="pd-all" press="dim" onPress={() => sheet.open({ title: 'To-dos', detent: 'medium', detents: ['medium', 'large'], body: <TodoListSheet date={date} /> })} label={`Open ${words}`}>
      {words}
      <ChevronRight size={15} aria-hidden="true" />
    </Pressable>
  );
};

