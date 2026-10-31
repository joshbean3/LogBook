import { heroSession, isSkipMark, morningDayFor, todoRef, type ISODate, type Todo } from '@logbook/shared';
import { ArrowRight, Sparkles, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import type * as React from 'react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDayPlan, useDayPlanSave, useGoals, useMorningMutations, useTodos } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { useReduced } from '@/lib/motion';
import { useContextMenu, type ContextMenuItem } from '@/ui/ContextMenu';
import { Button, Card, Section } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { useOpenAssistant } from '../assistant/AskBar';
import { useNowMinutes } from '../day/useNow';
import { useOpenGoal } from '../goals/GoalSheets';
import { goalOf } from '../goals/model';
import { newStepId, useSaveSteps } from '../goals/Steps';
import type { Log } from '../log/useLog';
import { doorOf, morningOf } from '../morning/model';
import { useSessionActions } from '../sessions/actions';
import { useOpenSession } from '../sessions/SessionCard';
import { useTodoActions } from '../todos/TodoList';
import { TodoSheet } from '../todos/TodoSheet';
import type { BlockHost } from './Block';
import { inside, startAtPoint, startAutoScroll, timeAtPoint, useGhostValues, type BlockMode, type GhostValues, type Point } from './gestures';
import { clampMinutes, clampStart, clockShort, DEFAULT_MINUTES, metaWords, minutesAtY, nextFree, placedOf, placeSlot, snap15, trayOf, unscheduleSlot, windowOf } from './layout';
import { itemsFor, sessionItemsOf, type DayItem } from './model';
import { ChipFace, Tray, type TrayHost } from './Tray';
import { Timeline, type MorningGhost, type Placed } from './Timeline';
import { DEFAULT_DAY_SETTINGS, sessionRef, type DayPlanBody, type DaySettings, type DaySlot } from './types';
import './dayplan.css';

/** What is in the air. */
type Drag =
  | { kind: 'place'; item: DayItem; w: number; ox: number; oy: number; target: number | null; overGoal: boolean }
  | { kind: 'move' | 'resize'; ref: string; start: number; minutes: number; from: number; fromMinutes: number; session: boolean; grab: number };

const defaultMinutes = (it: DayItem) => (it.kind === 'session' ? DEFAULT_MINUTES.session : DEFAULT_MINUTES[it.kind]);
/** The four the session's hold menu holds, in the order they are reached for. */
const SESSION_MENU = ['Done', 'Not done', 'Floor', 'Clear floor', 'Skip', 'Put it back', 'Edit', 'Move'];

/**
 * The day (docs/today-v6.md): one Card. The head (a 17/600 "The day", "3 of 7 done · 3 h 45 planned", `Plan my day`),
 * the tray of chips still to place, and the timeline. Every write is optimistic through `useDayPlanSave`, one PUT per
 * gesture end; the morning (the session block, the ghost) writes the day's alarm through the morning mutations with Undo.
 */
export const TheDay = memo(function TheDay({ date, today, log }: { date: ISODate; today: ISODate; log: Log }) {
  const todos = useTodos();
  const goals = useGoals();
  const plan = useDayPlan(date);
  const save = useDayPlanSave(date);
  const reduce = useReduced();
  const editable = date >= today;
  const goal = goalOf(goals.data, 'day', date);
  const nowMin = useNowMinutes();
  const now = date === today ? nowMin : null;
  const sessions = useMemo(() => log.snap.sessionsOn(date), [log, date]);
  const override = log.snap.morningOverride(date);
  const settings = log.boot?.morningSettings ?? null;
  const daySettings = (log.boot as { daySettings?: DaySettings } | null)?.daySettings ?? DEFAULT_DAY_SETTINGS;

  // the drop's plan stays on screen until the cache has it (the save writes it there a tick later)
  const [pending, setPending] = useState<DayPlanBody | null>(null);
  useEffect(() => setPending(null), [plan.data]);
  const shownPlan = pending ?? plan.data ?? null;
  const [drag, setDrag] = useState<Drag | null>(null);
  const live = useRef<Drag | null>(null);
  live.current = drag;
  // a dragged alarm stays where it was dropped until the month has it
  const [wakePending, setWakePending] = useState<number | null>(null);
  const baseWake = settings ? morningDayFor(sessions, override, settings).wake : null;
  useEffect(() => {
    if (wakePending != null && baseWake === wakePending) setWakePending(null);
  }, [wakePending, baseWake]);

  const sessionOffset = drag?.kind === 'move' && drag.session ? drag.start - drag.from : 0;
  const morning = useMemo(() => (settings ? morningOf(sessions, override, settings, sessionOffset && baseWake != null ? { wake: baseWake + sessionOffset } : wakePending != null ? { wake: wakePending } : null) : null), [settings, sessions, override, sessionOffset, baseWake, wakePending]);
  const morningRest = useMemo(() => (settings ? morningOf(sessions, override, settings) : null), [settings, sessions, override]);

  const items = useMemo(() => itemsFor(todos.data, goal, date, today), [todos.data, goal, date, today]);
  const sessionItems = useMemo(() => sessionItemsOf(sessions, log.snap, date), [sessions, log.snap, date]);
  const all = useMemo(() => [...items, ...sessionItems], [items, sessionItems]);
  const tray = useMemo(() => trayOf(shownPlan, items), [shownPlan, items]);
  const placed = useMemo(() => placedOf(shownPlan, all), [shownPlan, all]);
  // the lead session, laid out from the morning (door → back) unless the plan holds a slot for it
  const derived = useMemo((): Placed | null => {
    if (!morning || morning.day.mode === 'rest') return null;
    const lead = heroSession(sessions);
    const it = lead ? sessionItems.find((i) => i.ref === sessionRef(lead.id)) : null;
    if (!it || placed.some((p) => p.item === it)) return null;
    const door = doorOf(morning);
    if (door == null) return null;
    return { slot: { ref: it.ref as DaySlot['ref'], start: door, minutes: Math.max(15, morning.back - door) }, item: it, derived: true };
  }, [morning, sessions, sessionItems, placed]);
  const blocksAll = useMemo((): Placed[] => (derived ? [...placed, derived] : placed), [placed, derived]);
  // the window is laid from what is committed, so nothing shifts under a finger
  const win = useMemo(() => windowOf(daySettings, morningRest ? { wake: morningRest.day.wake, leave: morningRest.leave } : null, plan.data?.slots ?? []), [daySettings, morningRest, plan.data]);
  const blocks = useMemo(() => blocksAll.map((b) => (drag && drag.kind !== 'place' && drag.ref === b.item.ref ? { ...b, slot: { ...b.slot, start: drag.start, minutes: drag.minutes } } : b)), [blocksAll, drag]);
  const ghostMorning = useMemo((): MorningGhost | null => (morning ? { wake: morning.day.wake, door: doorOf(morning), leave: morning.leave } : null), [morning]);

  const everything = useMemo(() => [...items, ...blocksAll.filter((b) => b.item.kind === 'session').map((b) => b.item)], [items, blocksAll]);
  const done = everything.filter((i) => i.done).length;
  const planned = blocksAll.reduce((t, b) => t + b.slot.minutes, 0);
  const openBlocks = blocksAll.filter((b) => !b.item.done);
  const lastOpen = openBlocks.length === 1 ? openBlocks[0]!.item.ref : null;

  const sheet = useSheet();
  const openGoal = useOpenGoal();
  const openSession = useOpenSession(log);
  const sessionAct = useSessionActions(log);
  const act = useTodoActions(date);
  const saveSteps = useSaveSteps();
  const toast = useToast();
  const cm = useContextMenu();
  const { setDay } = useMorningMutations();
  const ask = useOpenAssistant();
  const tlRef = useRef<HTMLDivElement | null>(null);
  const trayRef = useRef<HTMLDivElement | null>(null);
  const [adding, setAdding] = useState<number | null>(null);

  const commit = (body: DayPlanBody) => {
    setPending(body);
    save.mutate(body);
  };
  const itemOf = (ref: string) => all.find((i) => i.ref === ref) ?? null;
  const blockOf = (ref: string) => blocksAll.find((b) => b.item.ref === ref) ?? null;
  const goalEl = () => document.querySelector<HTMLElement>(`.day-page[data-day="${date}"] .day-goal`);

  // ---------- the item's verbs ----------
  const open = (it: DayItem) => {
    if (it.kind === 'todo') sheet.open({ eyebrow: 'To-do', title: it.todo.text, body: <TodoSheet x={it.todo} date={date} /> });
    else if (it.kind === 'step') openGoal('day', it.goal.period);
    else openSession(date, it.session);
  };
  const toggle = (it: DayItem) => {
    if (it.kind === 'todo') return it.done ? act.reopen(it.todo) : act.done(it.todo, date <= today ? date : today);
    if (it.kind === 'step') return saveSteps(it.goal, it.goal.steps.map((s) => (s.id === it.step.id ? { ...s, done: !s.done } : s)));
    const s = it.session;
    if (it.done) sessionAct.clear(s);
    else if (isSkipMark(s.mark)) sessionAct.skip(s);
    else sessionAct.done(s);
  };
  const removeStep = (it: Extract<DayItem, { kind: 'step' }>) => {
    const g = it.goal;
    const prev = g.steps;
    haptics.delete();
    saveSteps(g, g.steps.filter((s) => s.id !== it.step.id));
    toast('Step removed', { label: 'Undo', fn: () => saveSteps(g, prev) });
  };
  const unschedule = (ref: string) => {
    commit(unscheduleSlot(shownPlan, ref));
    toast('Back to the tray', { label: 'Undo', fn: () => (blockOf(ref) ? commit(placeSlot(shownPlan, blockOf(ref)!.slot)) : undefined) });
  };
  /** A to-do dropped on the goal row becomes one of its steps. */
  const convert = (x: Todo) => {
    if (!goal) return;
    const prev = goal.steps;
    const step = { id: newStepId(), text: x.text.slice(0, 120), done: false };
    saveSteps(goal, [...prev, step]);
    act.remove(x);
    toast('Now a step of today’s goal', { label: 'Undo', fn: () => saveSteps(goal, prev) });
  };
  const edit = (it: DayItem): ContextMenuItem => ({ label: 'Edit', onSelect: () => open(it) });
  const menuFor = (it: DayItem, placedBlock: boolean): ContextMenuItem[] => {
    const un: ContextMenuItem = { label: 'Unschedule', onSelect: () => unschedule(it.ref) };
    if (it.kind === 'session') {
      const picked = SESSION_MENU.map((l) => sessionAct.menuItems(date, it.session).find((i) => i.label === l)).filter((i): i is ContextMenuItem => !!i);
      return placedBlock ? [un, ...picked.slice(0, 3)] : picked.slice(0, 4);
    }
    const at = placedBlock ? null : nextFree(blocksAll.map((b) => b.slot), now != null ? now : win.start, defaultMinutes(it), win);
    const place: ContextMenuItem | null = at != null && editable ? { label: `Place at ${clockShort(at)}`, onSelect: () => commit(placeSlot(shownPlan, { ref: it.ref as DaySlot['ref'], start: at, minutes: defaultMinutes(it) })) } : null;
    const first = placedBlock ? un : place;
    if (it.kind === 'step') return [...(first ? [first] : []), { label: it.done ? 'Not done' : 'Done', onSelect: () => toggle(it) }, edit(it), { label: 'Remove step', icon: <Trash2 size={18} />, destructive: true, onSelect: () => removeStep(it) }];
    const x = it.todo;
    return [...(first ? [first] : []), it.done ? { label: 'Not done', onSelect: () => act.reopen(x) } : { label: 'Move to tomorrow', icon: <ArrowRight size={18} />, onSelect: () => act.later(x) }, edit(it), { label: 'Delete', icon: <Trash2 size={18} />, destructive: true, onSelect: () => act.remove(x) }];
  };

  // ---------- the page scroll under a drag ----------
  const last = useRef<Point>({ x: 0, y: 0 });
  const scroll = useRef<(() => void) | null>(null);
  const stopScroll = () => {
    scroll.current?.();
    scroll.current = null;
  };
  useEffect(() => stopScroll, []);

  // ---------- place: a chip into the timeline ----------
  const ghost = useGhostValues(reduce);
  const trayHost = useRef(null as unknown as TrayHost);
  trayHost.current = {
    lift: (item, el) => {
      const r = el.getBoundingClientRect();
      ghost.lift(r);
      // the rect is read while the chip is pressed (0.97) or pre-grown (1.02): the ghost takes its layout width, with a px of slack
      setDrag({ kind: 'place', item, w: el.offsetWidth + 2, ox: 0, oy: 0, target: null, overGoal: false });
    },
    start: (item, p) => {
      const d = live.current;
      if (!d || d.kind !== 'place' || d.item.ref !== item.ref) return;
      // the finger's offset inside the chip when it lifted
      const ox = p.x - p.dx - ghost.values.x.get();
      const oy = p.y - p.dy - ghost.values.y.get();
      live.current = { ...d, ox, oy };
      setDrag(live.current);
      last.current = { x: p.x, y: p.y };
      stopScroll();
      scroll.current = startAutoScroll(() => last.current, () => trayHost.current.move(item, { ...last.current, dx: 0, dy: 0 }));
      trayHost.current.move(item, p);
    },
    move: (item, p) => {
      const d = live.current;
      if (!d || d.kind !== 'place' || d.item.ref !== item.ref) return;
      last.current = { x: p.x, y: p.y };
      ghost.follow(p.x - d.ox, p.y - d.oy);
      const g = goalEl();
      const overGoal = !!goal && item.kind === 'todo' && inside(g?.getBoundingClientRect(), p, 4);
      const target = overGoal ? null : startAtPoint(tlRef.current, p, win, defaultMinutes(item));
      if (target === d.target && overGoal === d.overGoal) return;
      if (target != null && target !== d.target) haptics.select();
      if (overGoal !== d.overGoal) {
        g?.classList.toggle('is-drop', overGoal);
        if (overGoal) haptics.select();
      }
      live.current = { ...d, target, overGoal };
      setDrag(live.current);
    },
    end: (item, cancelled) => {
      const d = live.current;
      stopScroll();
      goalEl()?.classList.remove('is-drop');
      if (!d || d.kind !== 'place' || d.item.ref !== item.ref) return;
      const finish = () => setDrag(null);
      if (!cancelled && d.overGoal && item.kind === 'todo') {
        haptics.drop();
        convert(item.todo);
        return ghost.vanish(finish);
      }
      if (!cancelled && d.target != null) {
        haptics.drop();
        const slot: DaySlot = { ref: item.ref as DaySlot['ref'], start: d.target, minutes: defaultMinutes(item) };
        commit(placeSlot(shownPlan, slot));
        // the ghost settles onto the block it became, fading as it lands
        requestAnimationFrame(() => {
          const el = tlRef.current?.querySelector<HTMLElement>(`[data-dy-block="${CSS.escape(item.ref)}"]`);
          ghost.land(el?.getBoundingClientRect() ?? null, finish);
        });
        return;
      }
      // home to the chip
      const chip = trayRef.current?.querySelector<HTMLElement>(`[data-dy-chip="${CSS.escape(item.ref)}"]`);
      ghost.settle(chip?.getBoundingClientRect() ?? null, finish);
    },
    open,
    menu: (item) => menuFor(item, false),
  };

  // ---------- move and resize: a block ----------
  const blockHost = useRef(null as unknown as BlockHost);
  blockHost.current = {
    arm: () => undefined,
    start: (mode, ref, p) => {
      const b = blockOf(ref);
      const tl = tlRef.current;
      if (!b || !tl) return;
      const t = minutesAtY(p.y - tl.getBoundingClientRect().top, win);
      live.current = { kind: mode, ref, start: b.slot.start, minutes: b.slot.minutes, from: b.slot.start, fromMinutes: b.slot.minutes, session: !!b.derived, grab: t - b.slot.start };
      setDrag(live.current);
      last.current = { x: p.x, y: p.y };
      stopScroll();
      scroll.current = startAutoScroll(() => last.current, () => blockHost.current.move(mode, ref, { ...last.current, dx: 0, dy: 0 }));
    },
    move: (mode, ref, p) => {
      const d = live.current;
      if (!d || d.kind !== mode || d.ref !== ref) return;
      last.current = { x: p.x, y: p.y };
      const t = timeAtPoint(tlRef.current, p, win, 10_000);
      if (t == null) return;
      if (mode === 'move') {
        const start = clampStart(snap15(t - d.grab), d.minutes, win);
        if (start === d.start) return;
        haptics.select();
        live.current = { ...d, start };
      } else {
        const minutes = clampMinutes(t - d.start, d.start, win);
        if (minutes === d.minutes) return;
        haptics.select();
        live.current = { ...d, minutes };
      }
      setDrag(live.current);
    },
    drop: (mode, ref) => {
      const d = live.current;
      stopScroll();
      if (!d || d.kind !== mode || d.ref !== ref) return;
      const changed = d.start !== d.from || d.minutes !== d.fromMinutes;
      if (!changed) return setDrag(null);
      haptics.drop();
      if (d.session && settings && baseWake != null) {
        // the session block moves the alarm by the same offset; back on the routine's alarm, the day keeps no override
        const wake = baseWake + (d.start - d.from);
        const was = override ? { wake: override.wake } : null;
        setWakePending(wake);
        setDay.mutate({ date, day: wake === settings.wake ? null : { wake } });
        toast(`Alarm ${clockShort(wake)}`, {
          label: 'Undo',
          fn: () => {
            setWakePending(baseWake);
            setDay.mutate({ date, day: was });
          },
        });
        setDrag(null);
        return;
      }
      commit(placeSlot(shownPlan, { ref: ref as DaySlot['ref'], start: d.start, minutes: d.minutes }));
      setDrag(null);
    },
    cancel: (_mode, ref, menu, el) => {
      stopScroll();
      setDrag(null);
      const b = blockOf(ref);
      if (menu && el && b) cm.open({ items: menuFor(b.item, !b.derived), anchor: el, lift: el, label: `${b.item.title} actions`, haptic: false });
    },
    toggle: (ref) => {
      const it = itemOf(ref);
      if (!it) return;
      if (!it.done && lastOpen === ref) haptics.success();
      toggle(it);
    },
    open: (ref) => {
      const it = itemOf(ref);
      if (it) open(it);
    },
    unschedule,
  };

  const onAdded = (id: string, at: number) => {
    commit(placeSlot(shownPlan, { ref: todoRef(id) as DaySlot['ref'], start: at, minutes: DEFAULT_MINUTES.todo }));
    const next = at + DEFAULT_MINUTES.todo;
    setAdding(next + DEFAULT_MINUTES.todo <= win.end ? next : null);
  };

  const loaded = !!todos.data && !!goals.data && !!log.boot;
  if (!loaded) return <section className="card dy is-skel" aria-hidden="true" />;
  const meta = metaWords(done, everything.length, planned);
  const target = drag?.kind === 'place' && drag.target != null ? { start: drag.target, minutes: defaultMinutes(drag.item) } : null;
  const liveBlock = drag && drag.kind !== 'place' ? { ref: drag.ref, mode: drag.kind as BlockMode } : null;
  return (
    <Card className={`dy ${drag ? 'is-dragging' : ''}`} aria-label="The day">
      <Section
        level="none"
        title="The day"
        action={
          editable ? (
            <Button variant="soft" size="sm" className="dy-plan" onClick={() => ask(date, 'Plan my day', { tab: 'today', date })}>
              <Sparkles size={15} aria-hidden="true" />
              Plan my day
            </Button>
          ) : undefined
        }
        className="dy-sec"
      >
        {meta ? <p className="dy-meta">{meta}</p> : null}
        <div ref={trayRef}>
          <Tray items={tray} editable={editable} hole={drag?.kind === 'place' ? drag.item.ref : null} host={trayHost} />
        </div>
        <Timeline date={date} today={today} window={win} now={now} editable={editable} blocks={blocks} morning={ghostMorning} live={liveBlock} target={target} adding={adding} onAddAt={setAdding} onAdded={onAdded} lastOpen={lastOpen} host={blockHost} tlRef={tlRef} />
      </Section>
      {drag?.kind === 'place' ? createPortal(<Ghost item={drag.item} w={drag.w} v={ghost.values} overGoal={drag.overGoal} />, document.body) : null}
    </Card>
  );
});

/** The chip in the air: over everything, following the finger. */
const Ghost = ({ item, w, v, overGoal }: { item: DayItem; w: number; v: GhostValues; overGoal: boolean }) => (
  <motion.div className={`chip-btn dy-chip dy-ghost ${overGoal ? 'is-over-goal' : ''}`} style={{ x: v.x, y: v.y, scale: v.scale, opacity: v.fade, width: w }} aria-hidden="true">
    <ChipFace item={item} />
  </motion.div>
);
