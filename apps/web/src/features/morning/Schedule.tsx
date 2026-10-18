import { clock, clockOfDay, durationWords, num, routineOf, type MorningTimeline, type RoutineKey, type RoutineStep, type TimelineBlock } from '@logbook/shared';
import { AlarmClock, ArrowDown, ArrowUp, Backpack, BookOpen, CircleDot, Coffee, Dog, DoorOpen, Dumbbell, Flower2, Footprints, GripVertical, Moon, Pencil, PersonStanding, Plus, Sandwich, ShowerHead, Shirt, SkipForward, Trash2, Undo2, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import { animate, motion, useMotionValue, useReducedMotion, type MotionValue } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { haptics } from '@/lib/haptics';
import { springs } from '@/lib/motion';
import { DROP_SPRING, useHoldDrag } from '@/lib/useDrag';
import { ContextMenu, useContextMenu, type ContextMenuItem } from '@/ui';
import { blockLabel, markTaught, short, wasTaught } from './model';

/** What the schedule's rows open and change. MorningView builds it; it owns the sheets, the writes and the toasts. */
export interface ScheduleActions {
  editWake: () => void;
  /** This morning: run, gym or rest, the kind, the miles or minutes. */
  editDay: () => void;
  /** The stretch each side of the workout. */
  editGap: () => void;
  /** When the back-home routine starts. */
  editStart: () => void;
  editStep: (k: RoutineKey) => void;
  addStep: () => void;
  removeStep: (k: RoutineKey) => void;
  /** The routine's new order, the steps on the schedule only. One write. */
  saveOrder: (visible: RoutineKey[]) => void;
  skipLabel: string | null;
  skip: () => void;
  rest: () => void;
  backLabel: string | null;
  backToPlan: () => void;
}

/** The hold before a step lifts: past iOS's own long press, the same as the to-do rows. */
const HOLD_MS = 380;

const ICON: Partial<Record<TimelineBlock['key'], LucideIcon>> = { wake: AlarmClock, run: Footprints, gym: Dumbbell, shower: ShowerHead, ready: Shirt, smoothie: Coffee, prep: Backpack };
/** A step of your own wears the icon its name suggests. */
const GUESS: Array<[RegExp, LucideIcon]> = [
  [/dog|pet/i, Dog],
  [/coffee|tea|smoothie|shake/i, Coffee],
  [/breakfast|eat|oats|egg/i, UtensilsCrossed],
  [/lunch|sandwich|meal/i, Sandwich],
  [/meditat|breath|yoga|pray/i, Flower2],
  [/stretch|mobility|foam|roll/i, PersonStanding],
  [/read|book|journal|write/i, BookOpen],
  [/walk|stroll/i, Footprints],
  [/shower|bath/i, ShowerHead],
  [/dress|clothes|outfit/i, Shirt],
  [/pack|bag/i, Backpack],
];
const iconOf = (b: { key: TimelineBlock['key']; label: string }): LucideIcon => (b.key === 'buffer' ? (b.label.startsWith('Walk') ? Footprints : DoorOpen) : (ICON[b.key] ?? GUESS.find(([re]) => re.test(b.label))?.[1] ?? CircleDot));

/** Where a row sits against the clock on today: done, under way (with how far along), or still to come. */
const timeState = (isToday: boolean, now: number, start: number, end: number) => {
  if (!isToday) return { cls: '', p: 0 };
  if (end <= now) return { cls: 'past', p: 1 };
  if (start <= now) return { cls: 'is-now', p: Math.max(0, Math.min(1, (now - start) / Math.max(1, end - start))) };
  return { cls: '', p: 0 };
};

const Progress = ({ p }: { p: number }) => (
  <span className="sch-progress" aria-hidden="true">
    <i style={{ transform: `scaleX(${p})` }} />
  </span>
);

// ---------- the fixed part: the alarm, the way out, the workout, the way back ----------
const FixedRow = ({ T, b, isToday, now, interactive, actions }: { T: MorningTimeline; b: TimelineBlock; isToday: boolean; now: number; interactive: boolean; actions?: ScheduleActions }) => {
  const st = timeState(isToday, now, b.start, b.end);
  if (b.key === 'free') {
    const rest = T.day.mode === 'rest';
    return (
      <li className={`sch-row sch-free ${st.cls}`}>
        <button type="button" className="sch-hit" onClick={actions?.editStart} disabled={!interactive} aria-label={`${durationWords(b.mins)} free until the routine at ${clockOfDay(b.end)}. Change when the routine starts`}>
          <span className="sch-time stamp">{short(b.start)}</span>
          <span className="sch-ico" aria-hidden="true">
            <Moon size={16} />
          </span>
          <span className="sch-main">
            <span className="sch-name">{rest ? `${durationWords(b.mins)} to yourself` : `${durationWords(b.mins)} free`}</span>
            <span className="sch-sub">Routine at {short(b.end)}</span>
          </span>
        </button>
        {st.cls === 'is-now' ? <Progress p={st.p} /> : null}
      </li>
    );
  }
  const main = b.key === 'run' || b.key === 'gym';
  const wake = b.key === 'wake';
  const Icon = iconOf(b);
  const name = b.key === 'run' ? `${T.day.type} run` : b.key === 'gym' ? T.day.type : wake ? 'Wake up' : blockLabel(T, b);
  const sub = b.key === 'run' ? `${num(T.day.miles)} mi · ${clock(T.settings.run.pace)}/mi` : wake && T.day.mode === 'rest' ? 'Rest morning' : wake && T.day.own && T.day.wake !== T.settings.wake ? `Usual ${short(T.settings.wake)}` : '';
  const open = !actions ? undefined : wake ? actions.editWake : main ? actions.editDay : actions.editGap;
  const items: ContextMenuItem[] = !actions
    ? []
    : [
        ...(wake ? [{ label: 'Change alarm', icon: <AlarmClock size={18} />, onSelect: actions.editWake }] : []),
        { label: main ? 'Edit' : 'Edit this morning', icon: <Pencil size={18} />, onSelect: actions.editDay },
        ...(actions.skipLabel ? [{ label: `Skip ${actions.skipLabel}`, icon: <SkipForward size={18} />, onSelect: actions.skip }] : []),
        ...(T.day.mode !== 'rest' ? [{ label: 'Make this a rest day', icon: <Moon size={18} />, onSelect: actions.rest }] : actions.backLabel ? [{ label: `Back to ${actions.backLabel}`, icon: <Undo2 size={18} />, onSelect: actions.backToPlan }] : []),
      ];
  const cls = `sch-row k-${b.key} ${main ? 'lit' : ''} ${b.tone ? `t-${b.tone}` : ''} ${st.cls}`;
  const inner = (
    <>
      <button type="button" className="sch-hit" onClick={open} disabled={!interactive} aria-label={`${name}, ${clockOfDay(b.start)}, ${durationWords(b.mins)}${sub ? `, ${sub}` : ''}. Edit`}>
        <span className="sch-time stamp">{short(b.start)}</span>
        <span className="sch-ico" aria-hidden="true">
          <Icon size={main ? 18 : 16} />
        </span>
        <span className="sch-main">
          <span className="sch-name">{name}</span>
          {sub ? <span className="sch-sub">{sub}</span> : null}
        </span>
        <span className="sch-len">{durationWords(b.mins)}</span>
      </button>
      {st.cls === 'is-now' ? <Progress p={st.p} /> : null}
    </>
  );
  // the workout and the alarm carry the day's menu (skip, rest); the short stretches between are a tap and nothing more
  return interactive && (main || wake) && items.length ? (
    <ContextMenu items={items} label={name} as="li">
      <div className={cls}>{inner}</div>
    </ContextMenu>
  ) : (
    <li className={cls}>{inner}</li>
  );
};

// ---------- the routine: steps you can hold and drag into order ----------
interface RowProps {
  s: RoutineStep;
  start: number;
  index: number;
  count: number;
  lifted: boolean;
  dimmed: boolean;
  isToday: boolean;
  now: number;
  interactive: boolean;
  dragY: MotionValue<number>;
  onLift: (key: RoutineKey, clientY: number, el: HTMLElement) => void;
  onMove: (clientY: number) => void;
  onDrop: () => void;
  onMenu: (key: RoutineKey, el: HTMLElement) => void;
  onTap: (key: RoutineKey) => void;
  onStep: (key: RoutineKey, dir: -1 | 1) => void;
}

const StepRow = ({ s, start, index, count, lifted, dimmed, isToday, now, interactive, dragY, onLift, onMove, onDrop, onMenu, onTap, onStep }: RowProps) => {
  const reduce = useReducedMotion();
  const el = useRef<HTMLLIElement | null>(null);
  // a hold that lifted the row swallows the click its release may send (a touch drag sends none, so it is a window, not a flag)
  const armed = useRef(false);
  const endedAt = useRef(0);
  const settle = () => {
    if (armed.current) endedAt.current = Date.now();
    armed.current = false;
  };
  const end = start + s.mins;
  const st = timeState(isToday && !lifted, now, start, end);
  const Icon = iconOf({ key: s.builtin ? (s.key as TimelineBlock['key']) : 'step', label: s.name });

  const hold = useHoldDrag<HTMLLIElement>({
    holdMs: HOLD_MS,
    disabled: !interactive,
    autoScroll: true,
    onArm: (e) => {
      armed.current = true;
      if (el.current) onLift(s.key, e.clientY, el.current);
    },
    onMove: (p) => onMove(p.y),
    onDrop: () => (settle(), onDrop()),
    // held and let go where it was: a long press, so the step's menu
    onCancel: (phase, reason) => {
      settle();
      onDrop();
      if (reason === 'up' && phase === 'armed' && el.current) onMenu(s.key, el.current);
    },
  });
  const grip = useHoldDrag<HTMLButtonElement>({
    holdMs: 0,
    disabled: !interactive || count < 2,
    autoScroll: true,
    onArm: (e) => {
      armed.current = true;
      if (el.current) onLift(s.key, e.clientY, el.current);
    },
    onMove: (p) => onMove(p.y),
    onDrop: () => (settle(), onDrop()),
    onCancel: () => (settle(), onDrop()),
  });

  return (
    <motion.li
      ref={(n: HTMLLIElement | null) => {
        el.current = n;
        hold.ref.current = n;
      }}
      data-step={s.key}
      className={`sch-row sch-step k-${s.builtin ? s.key : 'step'} ${st.cls} ${lifted ? 'is-lifted' : ''} ${dimmed ? 'is-settling' : ''}`}
      layout={lifted || reduce ? false : 'position'}
      transition={{ layout: springs.settle }}
      style={lifted ? { y: dragY, zIndex: 3 } : undefined}
      animate={{ scale: lifted && !reduce ? 1.03 : 1 }}
      {...hold.bind}
      onPointerMove={(e) => {
        hold.bind.onPointerMove(e);
        // the finger is moving a step, not the day: the pager underneath must not see it
        if (lifted) e.stopPropagation();
      }}
    >
      <button
        type="button"
        className="sch-hit"
        disabled={!interactive}
        onClick={() => {
          if (hold.consumeClick() || armed.current || Date.now() - endedAt.current < 400) return;
          onTap(s.key);
        }}
        aria-label={`${s.name}, ${clockOfDay(start)}, ${durationWords(s.mins)}. Edit`}
      >
        <span className="sch-time stamp">{short(start)}</span>
        <span className="sch-ico" aria-hidden="true">
          <Icon size={16} />
        </span>
        <span className="sch-main">
          <span className="sch-name">{s.name}</span>
        </span>
        <span className="sch-len">{durationWords(s.mins)}</span>
      </button>
      {interactive && count > 1 ? (
        <button
          ref={grip.ref}
          type="button"
          className="sch-grip"
          aria-label={`Move ${s.name}, step ${index + 1} of ${count}. Arrow keys move it up or down`}
          {...grip.bind}
          onPointerDown={(e) => {
            // the grip lifts at once; the row's own hold and the day pager stay out of it
            e.stopPropagation();
            grip.bind.onPointerDown(e);
          }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
            e.preventDefault();
            onStep(s.key, e.key === 'ArrowUp' ? -1 : 1);
          }}
        >
          <GripVertical size={18} aria-hidden="true" />
        </button>
      ) : null}
      {interactive ? (
        <button type="button" className="cm-sr" aria-haspopup="menu" onClick={(e) => onMenu(s.key, e.currentTarget)}>
          {s.name} actions
        </button>
      ) : null}
      {st.cls === 'is-now' ? <Progress p={st.p} /> : null}
    </motion.li>
  );
};

/**
 * The back-home routine as a list you can rearrange. Hold a step (or touch its grip) and it lifts; drag it and the others
 * slide out of its way, one `haptics.select()` a slot, every time on the list moving with it; let go and it lands with
 * `haptics.drop()` and the order is written once. A hold let go in place opens the step's menu (Edit, Move up, Move down,
 * Remove). A tap opens the step's sheet. On the keyboard the grip's arrow keys move it a slot at a time.
 *
 * The reorder is done by hand, as the to-do list does it: motion's Reorder scrolls the page away when the finger nears the
 * bottom of `body`. A step swaps in once its middle passes a neighbour's.
 */
const RoutineList = ({ steps, base, isToday, now, interactive, actions, onMoved }: { steps: RoutineStep[]; base: number; isToday: boolean; now: number; interactive: boolean; actions?: ScheduleActions; onMoved: () => void }) => {
  const menu = useContextMenu();
  const keysIn = steps.map((s) => s.key);
  const sig = keysIn.join('|');
  const [order, setOrder] = useState<RoutineKey[]>(keysIn);
  const orderRef = useRef(order);
  orderRef.current = order;
  const [lifted, setLifted] = useState<RoutineKey | null>(null);
  const [settling, setSettling] = useState<RoutineKey | null>(null);
  const drag = useRef<{ key: RoutineKey; grab: number; y: number } | null>(null);
  const list = useRef<HTMLOListElement>(null);
  const dragY = useMotionValue(0);
  const [said, setSaid] = useState('');

  // the server's order wins, except under a finger
  useEffect(() => {
    if (!drag.current) setOrder(keysIn);
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  const byKey = new Map(steps.map((s) => [s.key, s]));
  const rows = order.map((k) => byKey.get(k)).filter((s): s is RoutineStep => !!s);
  let t = base;
  const starts = rows.map((s) => {
    const at = t;
    t += s.mins;
    return at;
  });

  const rowEl = (key: RoutineKey) => list.current?.querySelector<HTMLElement>(`:scope > [data-step="${key}"]`) ?? null;
  /** Keep the lifted step under the finger: its slot's top on the page, against where the finger says it should be. */
  const place = () => {
    const d = drag.current;
    const ol = list.current;
    const me = d ? rowEl(d.key) : null;
    if (!d || !ol || !me) return;
    dragY.set(d.y - d.grab - (ol.getBoundingClientRect().top + me.offsetTop));
  };
  useLayoutEffect(place, [order]); // eslint-disable-line react-hooks/exhaustive-deps

  const lift = (key: RoutineKey, clientY: number, node: HTMLElement) => {
    drag.current = { key, grab: clientY - node.getBoundingClientRect().top, y: clientY };
    dragY.set(0);
    setLifted(key);
    haptics.lift();
  };
  const move = (clientY: number) => {
    const d = drag.current;
    const ol = list.current;
    if (!d || !ol) return;
    d.y = clientY;
    const me = rowEl(d.key);
    if (!me) return;
    const top = ol.getBoundingClientRect().top;
    const mid = clientY - d.grab + me.offsetHeight / 2;
    const others = orderRef.current.filter((k) => k !== d.key);
    let at = 0;
    for (const k of others) {
      const r = rowEl(k);
      if (r && top + r.offsetTop + r.offsetHeight / 2 < mid) at++;
    }
    const next = [...others.slice(0, at), d.key, ...others.slice(at)];
    if (next.join('|') !== orderRef.current.join('|')) {
      haptics.select();
      setOrder(next);
    } else place();
  };
  const drop = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    const changed = orderRef.current.join('|') !== sig;
    setSettling(d.key);
    void animate(dragY, 0, DROP_SPRING).then(() => {
      setLifted((k) => (k === d.key ? null : k));
      setSettling((k) => (k === d.key ? null : k));
    });
    if (changed) {
      haptics.drop();
      onMoved();
      actions?.saveOrder(orderRef.current);
      const i = orderRef.current.indexOf(d.key);
      setSaid(`${byKey.get(d.key)?.name ?? 'Step'} moved to ${i + 1} of ${orderRef.current.length}`);
    }
  };
  const step = (key: RoutineKey, dir: -1 | 1) => {
    const o = [...orderRef.current];
    const i = o.indexOf(key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j]!, o[i]!];
    haptics.select();
    setOrder(o);
    onMoved();
    actions?.saveOrder(o);
    setSaid(`${byKey.get(key)?.name ?? 'Step'} moved to ${j + 1} of ${o.length}`);
    // the row moved in the DOM; keep the keyboard on its grip
    requestAnimationFrame(() => rowEl(key)?.querySelector<HTMLButtonElement>('.sch-grip')?.focus());
  };
  const openMenu = (key: RoutineKey, el: HTMLElement) => {
    if (!actions) return;
    const s = byKey.get(key);
    if (!s) return;
    const i = orderRef.current.indexOf(key);
    const n = orderRef.current.length;
    const items: ContextMenuItem[] = [
      { label: 'Edit', icon: <Pencil size={18} />, onSelect: () => actions.editStep(key) },
      ...(i > 0 ? [{ label: 'Move up', icon: <ArrowUp size={18} />, onSelect: () => step(key, -1) }] : []),
      ...(i < n - 1 ? [{ label: 'Move down', icon: <ArrowDown size={18} />, onSelect: () => step(key, 1) }] : []),
      { label: 'Remove', icon: <Trash2 size={18} />, onSelect: () => actions.removeStep(key), destructive: true },
    ];
    // the hold already played the lift haptic
    menu.open({ items, anchor: el, label: `${s.name} actions`, haptic: false });
  };

  return (
    <>
      <ol ref={list} className={`sch-list sch-routine ${lifted ? 'is-dragging' : ''}`} aria-label="Your routine">
        {rows.map((s, i) => (
          <StepRow
            key={s.key}
            s={s}
            start={starts[i]!}
            index={i}
            count={rows.length}
            lifted={lifted === s.key}
            dimmed={settling === s.key}
            isToday={isToday}
            now={now}
            interactive={interactive}
            dragY={dragY}
            onLift={lift}
            onMove={move}
            onDrop={drop}
            onMenu={openMenu}
            onTap={(k) => actions?.editStep(k)}
            onStep={step}
          />
        ))}
      </ol>
      <span className="sr-only" aria-live="polite">
        {said}
      </span>
    </>
  );
};

/**
 * The morning as a list, top to bottom: the alarm, the way out, the workout and the way back (fixed in that order), then
 * the routine you arrange yourself, then a line to add a step. Each row shows when it starts and how long it runs; on
 * today the one under way fills as it goes and the ones behind you step back.
 */
export const Schedule = ({ T, isToday, now, interactive, actions }: { T: MorningTimeline; isToday: boolean; now: number; interactive: boolean; actions?: ScheduleActions }) => {
  const steps = routineOf(T.settings);
  const fixed = T.blocks.filter((b) => b.id == null);
  const first = T.blocks.find((b) => b.id != null);
  const base = first?.start ?? T.leave;
  const A = T.settings.after;
  const [taught, setTaught] = useState(wasTaught);
  const moved = () => {
    if (taught) return;
    markTaught();
    setTaught(true);
  };
  return (
    <div className="sch">
      <ol className="sch-list" aria-label="Getting out">
        {fixed.map((b, i) => (
          <FixedRow key={`${b.key}-${i}`} T={T} b={b} isToday={isToday} now={now} interactive={interactive} actions={actions} />
        ))}
      </ol>
      <div className="section-head sch-head">
        <h2 className="section-title">Your routine</h2>
        {interactive ? (
          <button type="button" className="sch-start" onClick={actions?.editStart} aria-label={`Routine starts ${A.showerMode === 'fixed' ? `at ${clockOfDay(A.showerAt)}` : 'when you are back'}. Change`}>
            {A.showerMode === 'fixed' ? `Starts ${short(A.showerAt)}` : 'Starts when back'}
          </button>
        ) : null}
      </div>
      {steps.length ? <RoutineList steps={steps} base={base} isToday={isToday} now={now} interactive={interactive} actions={actions} onMoved={moved} /> : <p className="sch-empty">Nothing yet between home and the door.</p>}
      {interactive ? (
        <button type="button" className="sch-add" onClick={actions?.addStep}>
          <span className="sch-add-ico" aria-hidden="true">
            <Plus size={16} />
          </span>
          Add a step
        </button>
      ) : null}
      {interactive && steps.length > 1 && !taught ? <p className="sch-hint">Hold a step and drag it to move it. Tap to change it.</p> : null}
    </div>
  );
};
