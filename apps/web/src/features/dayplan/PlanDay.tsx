import { DAY_BANDS, todoRef, type DayBand, type ISODate } from '@logbook/shared';
import { ArrowRight, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { animate, motion, useMotionValue, useSpring, type MotionValue } from 'motion/react';
import type * as React from 'react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDayPlan, useDayPlanSave, useGoals, useTodoGroups, useTodos } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { springs, useReduced } from '@/lib/motion';
import { useHoldDrag, type DragPoint } from '@/lib/useDrag';
import { useContextMenu, type ContextMenuItem } from '@/ui/ContextMenu';
import { Group, Mark, Row, Section } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { useNowMinutes } from '../day/useNow';
import { useOpenGoal } from '../goals/GoalSheets';
import { goalOf } from '../goals/model';
import { useSaveSteps } from '../goals/Steps';
import { groupOf } from '../todos/colors';
import { PriorityFlag } from '../todos/PriorityDots';
import { QuickAddField, TodoListSheet, useTodoActions } from '../todos/TodoList';
import { TodoSheet } from '../todos/TodoSheet';
import { groupsOn } from '../todos/groups';
import { BAND, bandsOf, bandTime, cardsFor, lay, moveCard, placeOf, type Card, type Laid, type Place } from './model';
import './dayplan.css';

/** Where a dragged row is over: a place and an index in it, or a dock. */
type Over = { kind: 'place'; place: Place; index: number } | { kind: 'tomorrow' } | { kind: 'bin' } | null;

interface Drag {
  ref: string;
  card: Card;
  laid: Laid;
  over: Over;
  w: number;
  h: number;
  /** where it was lifted from: held open (a spacer) while it is over another place, so nothing above the finger moves */
  from: { place: Place; index: number } | null;
  /** the finger's offset inside the row when it lifted */
  ox: number;
  oy: number;
}

const inside = (r: DOMRect, x: number, y: number, pad = 0) => x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
const PLACES: readonly Place[] = ['tray', ...DAY_BANDS];

/**
 * The schedule (docs/system.md §2, §5): `Schedule` over the day's bands, Anytime always and Morning, Afternoon and Evening
 * when they hold something or it is that part of the day. Every to-do and every step of the day's goal is a 44 or 60 row
 * with a square Mark: hold one and it lifts off the page and follows the finger between the bands (or onto Tomorrow and
 * Delete, docked over the bar); let go without moving for its menu. Checked rows stay where they are, struck. One Add row
 * ends each band; `All to-dos ›` opens the full list.
 */
export const PlanDay = memo(function PlanDay({ date, today }: { date: ISODate; today: ISODate }) {
  const todos = useTodos();
  const goals = useGoals();
  const plan = useDayPlan(date);
  const save = useDayPlanSave(date);
  const reduce = useReduced();
  const editable = date >= today;
  const goal = goalOf(goals.data, 'day', date);
  const minutes = useNowMinutes();
  const hour = Math.floor(minutes / 60);

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
  const act = useTodoActions(date);
  const toast = useToast();

  /** What is under the finger. The docks sit over the page (fixed), so they come first. */
  const hit = (x: number, y: number, d: Drag): Over => {
    for (const el of document.querySelectorAll<HTMLElement>('[data-pd-dock]')) if (inside(el.getBoundingClientRect(), x, y, 6)) return { kind: el.dataset.pdDock as 'tomorrow' | 'bin' };
    const board = boardRef.current;
    if (!board) return null;
    const boxes = [...board.querySelectorAll<HTMLElement>('[data-pd-box]')];
    if (!boxes.length) return null;
    const br = board.getBoundingClientRect();
    if (x < br.left - 40 || x > br.right + 40) return null;
    // the band the finger is in, its head included; between two, the nearer
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
    const place = box.dataset.pdBox as Place;
    // the index: how many of the band's other rows sit above the finger (their layout boxes, not mid-animation)
    const zr = box.getBoundingClientRect();
    let index = 0;
    for (const el of box.querySelectorAll<HTMLElement>('[data-pd-card]')) {
      if (el.dataset.pdCard === d.ref) continue;
      const top = zr.top + el.offsetTop;
      if (top + el.offsetHeight / 2 < y) index++;
    }
    return { kind: 'place', place, index };
  };

  const same = (a: Over, b: Over) => (a?.kind === 'place' && b?.kind === 'place' ? a.place === b.place && a.index === b.index : a?.kind === b?.kind);

  const api = useRef(null as unknown as ApiFns);
  api.current = {
    lift: () => haptics.lift(),
    start: (card: Card, el: HTMLElement, p: DragPoint) => {
      const r = el.getBoundingClientRect();
      const ox = p.x - r.left;
      const oy = p.y - r.top;
      gx.set(r.left);
      gy.set(r.top);
      ghostScale.set(1);
      ghostFade.set(1);
      animate(ghostScale, 1.03, springs.lift);
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
      // the row leans into the way it is moving, a few degrees at most
      const now = performance.now();
      const v = (p.x - lastX.current.x) / Math.max(1, now - lastX.current.t);
      lastX.current = { x: p.x, t: now };
      if (!reduce) tilt.set(Math.max(-4, Math.min(4, v * 8)));
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
        // the row settles into its slot
        const hole = boardRef.current?.querySelector<HTMLElement>(`[data-pd-card="${CSS.escape(d.ref)}"]`);
        const r = hole?.getBoundingClientRect();
        if (r && !reduce) {
          animate(ghostScale, 1, springs.settle);
          void Promise.all([animate(gx, r.left, springs.settle), animate(gy, r.top, springs.settle)]).then(end);
        } else end();
        return;
      }
      if (!over) return snapBack(d, end);
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
   * From the lift on, the board follows the finger itself: the row it started on is remounted as it crosses into another
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
  /** Move a row to a band from its menu (the gesture's visible fallback). */
  const moveTo = (card: Card, to: Place) => {
    const list = to === 'tray' ? shown.tray : shown.bands[to];
    const next = moveCard(shown, card.ref, to, list.length);
    setHeld(next);
    save.mutate(bandsOf(next));
  };

  const spot = drag?.from && !(drag.over?.kind === 'place' && drag.over.place === drag.from.place) && placeOf(drag.laid, drag.ref)?.place !== drag.from.place ? drag.from : null;
  const spacer = (p: Place): Spacer | null => (spot && drag && spot.place === p ? { index: spot.index, w: drag.w, h: drag.h } : null);
  const total = cards.length;
  const done = cards.filter((c) => c.done).length;
  const loaded = !!todos.data && !!goals.data;
  if (!loaded) return <section className="pd is-skel" aria-hidden="true" />;
  /** Anytime always; a timed band when it holds something, when it is that part of today, or while a row is in the air. */
  const visible = (b: DayBand) => !!drag || shown.bands[b].length > 0 || (date === today && bandTime(b, hour) === 'now');

  return (
    <Section title="Schedule" meta={total ? `${done} of ${total} done` : null} className={`pd ${drag ? 'is-dragging' : ''}`}>
      <div ref={boardRef} className="pd-board">
        <Band place="tray" cards={shown.tray} drag={drag} api={api} date={date} today={today} editable={editable} spacer={spacer('tray')} moveTo={moveTo} />
        {DAY_BANDS.filter(visible).map((b) => (
          <Band key={b} place={b} cards={shown.bands[b]} spacer={spacer(b)} drag={drag} api={api} date={date} today={today} editable={editable} moveTo={moveTo} onAdd={(id) => save.mutate({ ...bandsOf(shown), [b]: [...shown.bands[b].map((c) => c.ref), todoRef(id)] })} />
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
    </Section>
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
type MoveTo = (card: Card, to: Place) => void;

interface Spacer {
  index: number;
  w: number;
  h: number;
}

/**
 * One band of the day: a `Group` whose first row is its caps label, then its rows, then the Add row. A band a row is
 * dragged over opens for it.
 */
const Band = ({ place, cards, spacer, drag, api, date, today, editable, moveTo, onAdd }: { place: Place; cards: Card[]; spacer: Spacer | null; drag: Drag | null; api: Api; date: ISODate; today: ISODate; editable: boolean; moveTo: MoveTo; onAdd?: (id: string) => void }) => {
  const [adding, setAdding] = useState(false);
  const meta = BAND[place];
  const over = drag?.over?.kind === 'place' && drag.over.place === place;
  const nodes = cards.map((c) => <CardRow key={c.ref} card={c} drag={drag} api={api} date={date} today={today} editable={editable} moveTo={moveTo} />);
  if (spacer) nodes.splice(Math.min(spacer.index, nodes.length), 0, <span key="pd-spacer" className="pd-spacer" style={{ height: spacer.h }} aria-hidden="true" />);
  return (
    <Group className={`pd-band ${over ? 'is-over' : ''}`}>
      <div data-pd-box={place} className="pd-zone" role="group" aria-label={meta.label}>
        <span className="caps pd-band-head" aria-hidden="true">
          {meta.label}
        </span>
        {nodes}
        {!cards.length && !spacer && drag ? <span className="pd-slot">Drop into {meta.label.toLowerCase()}</span> : null}
      </div>
      {editable && !drag ? (
        adding ? (
          <QuickAddField date={today} due={date !== today ? date : undefined} placeholder={place === 'tray' ? 'Add a to-do' : `Add to the ${meta.label.toLowerCase()}`} autoFocus onClose={() => setAdding(false)} onAdd={onAdd} />
        ) : (
          <Row className="pd-add" left={<Plus size={16} aria-hidden="true" className="pd-add-ic" />} title={place === 'tray' ? 'Add a to-do' : `Add to the ${meta.label.toLowerCase()}`} onClick={() => setAdding(true)} />
        )
      ) : null}
    </Group>
  );
};

/** The words of a row: the square Mark, the text with its priority dot, the list or the goal as its caption. */
const RowFace = ({ card, date, today, editable, onOpen }: { card: Card; date: ISODate; today: ISODate; editable: boolean; onOpen?: () => void }) => {
  const groups = useTodoGroups();
  const act = useTodoActions(date);
  const saveSteps = useSaveSteps();
  if (card.kind === 'step') {
    const { goal, step } = card;
    return <Row className={`pd-row is-step ${card.done ? 'is-done' : ''}`} left={<Mark square status={step.done ? 'done' : 'open'} label={step.text} disabled={!editable} haptic="toggle" onClick={() => saveSteps(goal, goal.steps.map((s) => (s.id === step.id ? { ...s, done: !s.done } : s)))} />} title={step.text} sub="Step of today’s goal" onClick={onOpen} />;
  }
  const x = card.todo;
  const list = groupOf(x, groups.data);
  const meta = [list?.name, x.note].filter(Boolean).join(' · ');
  return (
    <Row
      className={`pd-row ${card.done ? 'is-done' : ''}`}
      left={<Mark square status={card.done ? 'done' : 'open'} label={x.text} disabled={!editable && date !== today} haptic="toggle" onClick={() => (card.done ? act.reopen(x) : act.done(x, date <= today ? date : today))} />}
      title={
        <>
          {x.text}
          <PriorityFlag level={x.priority} />
        </>
      }
      sub={meta || undefined}
      onClick={onOpen}
    />
  );
};

/** The band a row's menu offers it: the next part of the day, or back to Anytime from the evening. */
const nextPlace = (from: Place | null, hour: number): Place => {
  if (from === 'afternoon') return 'evening';
  if (from === 'evening') return 'tray';
  return hour >= 17 ? 'evening' : 'afternoon';
};

/**
 * A row on the board. A hold lifts it (the one hold clock, `useHoldDrag`); moving takes it into the air (the page's copy
 * becomes the slot it would land in); letting go without moving opens its menu. `layout` lets the others part for it.
 */
const CardRow = ({ card, drag, api, date, today, editable, moveTo }: { card: Card; drag: Drag | null; api: Api; date: ISODate; today: ISODate; editable: boolean; moveTo: MoveTo }) => {
  const cm = useContextMenu();
  const sheet = useSheet();
  const open = useOpenGoal();
  const act = useTodoActions(date);
  const saveSteps = useSaveSteps();
  const reduce = useReduced();
  const minutes = useNowMinutes();
  const [armed, setArmed] = useState(false);
  // a hold that came to a menu (or a drag) owns its release: the click after it opens nothing
  const held = useRef(false);
  const isHole = drag?.ref === card.ref;
  const onOpen = () => {
    if (d.consumeClick()) return;
    if (card.kind === 'todo') sheet.open({ eyebrow: 'To-do', title: card.todo.text, body: <TodoSheet x={card.todo} date={date} /> });
    else open('day', card.goal.period);
  };
  const menu = (): ContextMenuItem[] => {
    if (card.kind === 'step') {
      const g = card.goal;
      return [
        { label: 'Edit', onSelect: () => open('day', g.period) },
        { label: card.done ? 'Not done' : 'Done', onSelect: () => saveSteps(g, g.steps.map((s) => (s.id === card.step.id ? { ...s, done: !card.done } : s))) },
        { label: 'Remove step', icon: <Trash2 size={18} />, destructive: true, onSelect: () => saveSteps(g, g.steps.filter((s) => s.id !== card.step.id)) },
      ];
    }
    const x = card.todo;
    const edit: ContextMenuItem = { label: 'Edit', onSelect: () => sheet.open({ eyebrow: 'To-do', title: x.text, body: <TodoSheet x={x} date={date} /> }) };
    const del: ContextMenuItem = { label: 'Delete', icon: <Trash2 size={18} />, destructive: true, onSelect: () => act.remove(x) };
    if (card.done) return [edit, { label: 'Not done', onSelect: () => act.reopen(x) }, del];
    const to = nextPlace(placeOf(drag?.laid ?? { tray: [], bands: { morning: [], afternoon: [], evening: [] } }, card.ref)?.place ?? fromAttr(d.ref.current), Math.floor(minutes / 60));
    return [edit, { label: 'Move to tomorrow', icon: <ArrowRight size={18} />, onSelect: () => act.later(x) }, { label: `Move to ${BAND[to].label.toLowerCase()}`, onSelect: () => moveTo(card, to) }, del];
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
  return (
    <motion.div
      ref={d.ref}
      layout={reduce ? false : 'position'}
      transition={springs.settle}
      className={`pd-card ${isHole ? 'is-hole' : ''} ${armed ? 'is-armed' : ''}`}
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
      <RowFace card={card} date={date} today={today} editable={editable} onOpen={onOpen} />
    </motion.div>
  );
};

/** The band a row's element sits in (its `data-pd-box` ancestor), for the menu's Move. */
const fromAttr = (el: HTMLElement | null): Place | null => {
  const p = el?.closest<HTMLElement>('[data-pd-box]')?.dataset.pdBox;
  return p && (PLACES as readonly string[]).includes(p) ? (p as Place) : null;
};

/** The row in the air: over everything, leaning into its motion. */
const Ghost = ({ drag, x, y, tilt, scale, fade, date }: { drag: Drag; x: MotionValue<number>; y: MotionValue<number>; tilt: MotionValue<number>; scale: MotionValue<number>; fade: MotionValue<number>; date: ISODate }) => (
  <motion.div className={`pd-ghost ${drag.over?.kind === 'bin' ? 'is-bin' : ''}`} style={{ x, y, rotate: tilt, scale, opacity: fade, width: drag.w }} aria-hidden="true">
    <RowFace card={drag.card} date={date} today={date} editable={false} />
  </motion.div>
);

/** While a row is in the air: Tomorrow (to-dos) and Delete, over the bar. */
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

/** The rest of the to-dos (Later, Someday, every list) in the sheet. */
const AllTodos = ({ date }: { date: ISODate }) => {
  const sheet = useSheet();
  const todos = useTodos();
  const g = groupsOn(todos.data, date);
  const later = g[1]!.items.length;
  const someday = g[2]!.items.length;
  const words = [later ? `Later ${later}` : null, someday ? `Someday ${someday}` : null].filter(Boolean).join(' · ');
  return (
    <Group className="pd-all">
      <Row title="All to-dos" sub={words || undefined} right={<ChevronRight size={16} className="lrow-chev" aria-hidden="true" />} onClick={() => sheet.open({ title: 'To-dos', detent: 'medium', detents: ['medium', 'large'], body: <TodoListSheet date={date} /> })} label={`All to-dos${words ? `, ${words}` : ''}. Open`} />
    </Group>
  );
};
