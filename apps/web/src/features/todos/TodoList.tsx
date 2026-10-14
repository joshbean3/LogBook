import { fmtDate, shiftDays, type ISODate, type Todo } from '@logbook/shared';
import { Check, ChevronDown, Clock, X } from 'lucide-react';
import { motion, useDragControls, useMotionValue, useReducedMotion, type Box } from 'motion/react';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { clientKey, useTodoMutations, useTodos } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { Button, Mark, SkeletonRows } from '@/ui';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { groupsOn, inToday, liveOn, settleInto, stepWithin, todayOpenOn, type Tier, type TodoGroupSpec } from './groups';
import { PriorityDots } from './PriorityDots';
import { parseQuickAdd } from './quickAdd';
import { TodoSheet } from './TodoSheet';
import './todos.css';

export { inToday, liveOn, todayOpenOn };

type Span = { min: number; max: number };

/** The hold before a row lifts: the same as the habit orbs, and past iOS's own long press, so a slow swipe never lifts. */
const HOLD_MS = 450;
const HOLD_SLOP = 6;

/** The words at the right of a row: the day a Later item is for. Nothing on its own day. */
const dueLabelOf = (x: Todo, date: ISODate) => (x.bucket === 'later' && x.due ? (x.due === date ? null : x.due < date ? `Due ${fmtDate('md', x.due)}` : x.due === shiftDays(date, 1) ? 'Tomorrow' : fmtDate('md', x.due)) : null);

// ---------- one row: swipe right to complete, left for Later (or delete, outside Today); hold to lift and reorder; tap the name for the sheet ----------
const TodoRow = ({ x, date, done, carried, canDrag, leftKind, onToggle, onLeft, onEdit, onLift, onMove, onMeasure, onDrop, onStep }: { x: Todo; date: ISODate; done: boolean; carried: boolean; canDrag: boolean; leftKind: 'later' | 'delete'; onToggle: () => void; onLeft: () => void; onEdit: () => void; onLift: () => void; onMove: (offset: number, velocity: number) => void; onMeasure: (span: Span) => void; onDrop: () => void; onStep: (dir: -1 | 1) => void }) => {
  const reduce = useReducedMotion();
  const controls = useDragControls();
  const [gone, setGone] = useState<'left' | 'right' | null>(null);
  const [checked, setChecked] = useState(false);
  const [lifted, setLifted] = useState(false);
  const liftedRef = useRef(false);
  const liftEndAt = useRef(0);
  const pointerType = useRef('mouse');
  const moved = useRef(false);
  const hold = useRef<{ t: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const armed = useRef<'left' | 'right' | null>(null);
  const el = useRef<HTMLDivElement>(null);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const isDone = done || checked;

  // once lifted, the finger moves the row, not the page
  useEffect(() => {
    const n = el.current;
    if (!n) return;
    const block = (e: TouchEvent) => {
      if (liftedRef.current) e.preventDefault();
    };
    n.addEventListener('touchmove', block, { passive: false });
    return () => n.removeEventListener('touchmove', block);
  }, []);

  const cancelHold = () => {
    if (hold.current) clearTimeout(hold.current.t);
    hold.current = null;
  };
  const endLift = () => {
    if (!liftedRef.current) return;
    liftedRef.current = false;
    liftEndAt.current = Date.now();
    setLifted(false);
    onDropRef.current();
  };
  /**
   * One gesture session per touch, started here so the row owns it: it is a swipe (x) until a hold lifts the row,
   * when the same session carries on along y. The direction lock means a finger that moves sideways first swipes
   * and one that holds still and then moves up or down reorders; nothing wiggles on a scroll.
   */
  const onPointerDown = (e: React.PointerEvent) => {
    moved.current = false;
    if (reduce || isDone || gone) return;
    controls.start(e);
    if (!canDrag || (e.target as HTMLElement).closest('.mark-hit')) return;
    cancelHold();
    hold.current = {
      x: e.clientX,
      y: e.clientY,
      t: setTimeout(() => {
        hold.current = null;
        liftedRef.current = true;
        setLifted(true);
        haptics.lift();
        onLift();
        // a lift with no move never reaches onDragEnd, so the release settles it; the click that follows must see the lift
        const settle = () => {
          window.removeEventListener('pointerup', settle);
          window.removeEventListener('pointercancel', settle);
          liftEndAt.current = Date.now();
          setTimeout(endLift, 0);
        };
        window.addEventListener('pointerup', settle);
        window.addEventListener('pointercancel', settle);
      }, HOLD_MS),
    };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (hold.current && Math.hypot(e.clientX - hold.current.x, e.clientY - hold.current.y) > HOLD_SLOP) {
      cancelHold();
      moved.current = true;
    }
  };

  // the row has to travel the width of the sign (56px): one tick the moment it would count
  const THRESHOLD = 56;
  const onSwipe = () => {
    moved.current = true;
    const v = mx.get();
    const next = v >= THRESHOLD ? 'right' : v <= -THRESHOLD ? 'left' : null;
    if (next !== armed.current) haptics.threshold();
    armed.current = next;
  };
  const onSwipeEnd = () => {
    const v = mx.get();
    armed.current = null;
    if (v >= THRESHOLD) {
      haptics.toggle();
      setGone('right');
      setTimeout(onToggle, 180);
    } else if (v <= -THRESHOLD) {
      if (leftKind === 'delete') haptics.delete();
      setGone('left');
      setTimeout(onLeft, 180);
    }
  };
  // the mark is the celebration: fill, check, glow, then the row folds away
  const tapMark = () => {
    if (done) return onToggle();
    if (checked) return;
    setChecked(true);
    setTimeout(() => setGone('right'), reduce ? 0 : 420);
    setTimeout(onToggle, reduce ? 120 : 600);
  };
  const dueLabel = dueLabelOf(x, date);
  const aside = dueLabel ?? (carried ? `from ${fmtDate('md', x.createdOn)}` : null);
  return (
    <motion.div ref={el} className={`todo-wrap ${lifted ? 'is-lifted' : ''}`} initial={false} animate={gone ? { height: 0, opacity: 0 } : { height: 'auto', opacity: 1 }} transition={{ duration: 0.18 }} onPointerDownCapture={(e) => void (pointerType.current = e.pointerType)} onContextMenu={(e) => pointerType.current === 'touch' && e.preventDefault()}>
      <div className="todo-under" aria-hidden="true">
        <span className="todo-under-left">
          <Check size={20} strokeWidth={2.5} />
        </span>
        <span className={`todo-under-right ${leftKind === 'later' ? 'later' : ''}`}>
          {leftKind === 'later' ? <Clock size={20} strokeWidth={2.5} /> : <X size={20} strokeWidth={2.5} />}
        </span>
      </div>
      {/* the one moving element: it swipes along x, and once lifted it is the dragged row along y; `layout` slides the others out of its way */}
      <motion.div
        className={`lrow trow ${isDone ? 'is-done' : ''}`}
        layout
        style={{ x: mx, y: my }}
        drag={reduce || isDone ? false : lifted ? 'y' : 'x'}
        dragListener={false}
        dragControls={controls}
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.7}
        dragSnapToOrigin
        dragMomentum={false}
        transition={{ layout: { duration: 0.16 } }}
        animate={gone === 'right' ? { x: 120 } : gone === 'left' ? { x: -120 } : { x: 0 }}
        onLayoutMeasure={(box: Box) => onMeasure(box.y)}
        onDrag={(_, info) => (liftedRef.current ? onMove(my.get(), info.velocity.y) : onSwipe())}
        onDragEnd={() => (liftedRef.current ? endLift() : onSwipeEnd())}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={cancelHold}
        onPointerCancel={cancelHold}
        onPointerLeave={cancelHold}
      >
        <Mark status={isDone ? 'done' : 'open'} square label={aside ? `${x.text}, ${aside}` : x.text} onClick={tapMark} />
        <div className="lrow-main">
          <button
            type="button"
            className={`trow-name ${x.note ? 'has-note' : ''}`}
            onClick={() => !moved.current && !liftedRef.current && Date.now() - liftEndAt.current > 400 && onEdit()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') moved.current = false;
              if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && !done) {
                e.preventDefault();
                onStep(e.key === 'ArrowUp' ? -1 : 1);
              }
            }}
          >
            <span className="trow-title">
              <PriorityDots level={x.priority} />
              <span>{x.text}</span>
            </span>
            {x.note ? <span className="trow-note">{x.note}</span> : null}
          </button>
        </div>
        <div className="lrow-right" aria-hidden="true">
          {dueLabel ? <span className="tdue caps">{dueLabel}</span> : carried ? <span className="carried">{fmtDate('md', x.createdOn)}</span> : null}
        </div>
      </motion.div>
    </motion.div>
  );
};

// ---------- a group of rows you can drag into order ----------
/**
 * The reorder is done by hand rather than with motion's Reorder: that component auto-scrolls the page when the
 * finger nears the bottom of `body`, and with `body { height: 100% }` that edge is always one viewport away,
 * which sent the page running. The rule is the same one Reorder uses: the lifted row swaps with its neighbour
 * once its edge passes the neighbour's centre. On the drop the row adopts the tier it landed in (see `settleInto`).
 */
const TodoGroup = ({ items, sort, tier, date, done, canDrag = true, row }: { items: Todo[]; sort: (a: Todo, b: Todo) => number; tier: Tier; date: ISODate; done?: boolean; canDrag?: boolean; row: (x: Todo, isDone: boolean) => Omit<React.ComponentProps<typeof TodoRow>, 'x' | 'date' | 'done' | 'canDrag' | 'leftKind' | 'onLift' | 'onMove' | 'onMeasure' | 'onDrop' | 'onStep'> }) => {
  const { reorder, patch } = useTodoMutations();
  // rows are keyed by the id they were born with, so a provisional row the server names mid-drag stays mounted
  const keyOf = (x: Todo) => clientKey(x.id);
  const sortedIds = useMemo(() => items.map(keyOf), [items]);
  const [order, setOrder] = useState(sortedIds);
  const orderRef = useRef(order);
  orderRef.current = order;
  const [lifting, setLifting] = useState(false);
  const dragging = useRef<string | null>(null);
  const swapping = useRef(false);
  const spans = useRef(new Map<string, Span>());
  const sig = sortedIds.join('|');
  useEffect(() => {
    if (!dragging.current) setOrder(sortedIds);
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  // one swap per render: the rows re-measure before the next one is allowed
  useEffect(() => {
    swapping.current = false;
  });
  const byId = useMemo(() => new Map(items.map((x) => [keyOf(x), x])), [items]);
  const list = order.map((id) => byId.get(id)).filter((x): x is Todo => !!x);
  const move = (id: string, offset: number, velocity: number) => {
    if (!velocity || swapping.current) return;
    const laid = orderRef.current
      .map((v) => ({ v, s: spans.current.get(v) }))
      .filter((e): e is { v: string; s: Span } => !!e.s)
      .sort((a, b) => a.s.min - b.s.min);
    const i = laid.findIndex((e) => e.v === id);
    if (i < 0) return;
    const j = i + (velocity > 0 ? 1 : -1);
    const me = laid[i];
    const next = laid[j];
    if (!me || !next) return;
    const centre = (next.s.min + next.s.max) / 2;
    if ((j > i && me.s.max + offset > centre) || (j < i && me.s.min + offset < centre)) {
      const o = [...orderRef.current];
      const a = o.indexOf(me.v);
      const b = o.indexOf(next.v);
      if (a < 0 || b < 0) return;
      [o[a], o[b]] = [o[b]!, o[a]!];
      swapping.current = true;
      setOrder(o);
    }
  };
  /** A new order for the group, from a drop or a step: the moved row adopts its new tier, then the order is kept. */
  const commit = (keys: string[], movedKey: string | null) => {
    const merged = [...keys.filter((k) => byId.has(k)), ...sortedIds.filter((k) => !keys.includes(k))];
    const rows = merged.map((k) => byId.get(k)!);
    const movedRow = movedKey ? byId.get(movedKey) : undefined;
    const fix = movedRow ? settleInto(rows, movedRow.id, tier) : null;
    setOrder(
      rows
        .map((x, i) => ({ ...x, position: i, ...(movedRow && x.id === movedRow.id && fix ? fix : {}) }))
        .sort(sort)
        .map(keyOf),
    );
    if (merged.join('|') !== sig) reorder.mutate(rows.map((x) => x.id));
    if (movedRow && fix) patch.mutate({ id: movedRow.id, ...fix });
  };
  const onDrop = () => {
    const id = dragging.current;
    dragging.current = null;
    setLifting(false);
    commit(orderRef.current, id);
  };
  const step = (key: string, dir: -1 | 1) => {
    const row = byId.get(key);
    const r = row ? stepWithin(list, row.id, dir, tier) : null;
    if (!r) return;
    haptics.drop();
    commit(r.order.map(clientKey), key);
  };
  return (
    <div className={`tgroup ${lifting ? 'is-dragging' : ''}`}>
      {list.map((x) => (
        <TodoRow
          key={keyOf(x)}
          x={x}
          date={date}
          done={!!done}
          canDrag={canDrag && list.length > 1}
          leftKind={tier === 'priority' && !done && inToday(x, date) ? 'later' : 'delete'}
          onLift={() => {
            dragging.current = keyOf(x);
            setLifting(true);
          }}
          onMove={(offset, velocity) => move(keyOf(x), offset, velocity)}
          onMeasure={(s) => spans.current.set(keyOf(x), s)}
          onDrop={onDrop}
          onStep={(dir) => step(keyOf(x), dir)}
          {...row(x, !!done)}
        />
      ))}
    </div>
  );
};

/** A folded group's header row: the name and count, the next dates, a chevron. */
const Fold = ({ label, count, meta, open, onToggle }: { label: string; count: number; meta?: ReactNode; open: boolean; onToggle: () => void }) => (
  <button type="button" className="lrow tfold" onClick={onToggle} aria-expanded={open}>
    <span className="t-sub muted tfold-label">
      {label} ({count})
      <ChevronDown size={16} className={`tfold-chev ${open ? 'open' : ''}`} aria-hidden="true" />
    </span>
    {meta ? <span className="tfold-meta caps">{meta}</span> : null}
  </button>
);

// ---------- the quick-add line, shared by Today and the full list ----------
/** "Call the bank fri !!": the line reads its marks and says what it understood, in caps, as you type. */
export const QuickAddField = ({ date, placeholder = 'Add a to-do' }: { date: ISODate; placeholder?: string }) => {
  const { add } = useTodoMutations();
  const hintId = useId();
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const parsed = parseQuickAdd(draft, date);
  const understood = [parsed.priority ? (parsed.priority === 2 ? 'High' : 'Medium') : null, parsed.bucket === 'later' ? (parsed.due ? fmtDate('md', parsed.due) : 'Later') : parsed.bucket === 'someday' ? 'Someday' : null].filter(Boolean).join(' · ');
  // what the line understood, or, on an empty focused field, the marks it would understand
  const hint = parsed.text ? understood : typing ? '!! High · Fri · Someday' : '';
  const addIt = () => {
    if (!parsed.text) return;
    add.mutate({ text: parsed.text, date, priority: parsed.priority, bucket: parsed.bucket, due: parsed.due });
    haptics.toggle();
    setDraft('');
  };
  return (
    <div className="lrow-add tadd">
      <input className="in" placeholder={placeholder} maxLength={200} aria-label="New to-do" aria-describedby={hint ? hintId : undefined} value={draft} onChange={(e) => setDraft(e.target.value)} onFocus={() => setTyping(true)} onBlur={() => setTyping(false)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addIt())} />
      {hint ? (
        <span id={hintId} className="tadd-hint caps" role="status">
          {hint}
        </span>
      ) : null}
      {parsed.text ? (
        <Button variant="soft" className="tadd-btn" onClick={addIt}>
          Add
        </Button>
      ) : null}
    </div>
  );
};

/** Later means a day: tomorrow, unless the item already had one ahead. */
export const laterPatch = (x: Todo, date: ISODate) => ({ bucket: 'later' as const, due: x.due && x.due > date ? x.due : shiftDays(date, 1) });

/** Every to-do action with its Undo, from any surface (the Today rows, the full list). */
export const useTodoActions = (date: ISODate) => {
  const { patch } = useTodoMutations();
  const toast = useToast();
  return {
    done: (x: Todo, undoable = true) => {
      patch.mutate({ id: x.id, doneOn: date });
      if (undoable) toast('Done', { label: 'Undo', fn: () => patch.mutate({ id: x.id, doneOn: null }) });
    },
    reopen: (x: Todo) => patch.mutate({ id: x.id, doneOn: null }),
    later: (x: Todo) => {
      const was = { bucket: x.bucket, due: x.due };
      const next = laterPatch(x, date);
      patch.mutate({ id: x.id, ...next });
      toast(next.due === shiftDays(date, 1) ? 'Moved to tomorrow' : `Moved to ${fmtDate('md', next.due)}`, { label: 'Undo', fn: () => patch.mutate({ id: x.id, ...was }) });
    },
    someday: (x: Todo) => {
      const was = { bucket: x.bucket, due: x.due };
      patch.mutate({ id: x.id, bucket: 'someday' });
      toast('Moved to Someday', { label: 'Undo', fn: () => patch.mutate({ id: x.id, ...was }) });
    },
    today: (x: Todo) => patch.mutate({ id: x.id, bucket: 'today' }),
    priority: (x: Todo, p: Todo['priority']) => {
      haptics.toggle();
      patch.mutate({ id: x.id, priority: p });
    },
    remove: (x: Todo) => {
      haptics.delete();
      patch.mutate({ id: x.id, deletedOn: date });
      toast('Deleted', { label: 'Undo', fn: () => patch.mutate({ id: x.id, deletedOn: null }) });
    },
  };
};

/**
 * The full to-do list, in a sheet: Today's rows (hold to reorder, swipe right for Done, left for Later), the quick-add line,
 * then the Later, Someday and Completed folds. A row's name pushes its editor inside the same sheet.
 */
export const TodoListSheet = ({ date, open: initial }: { date: ISODate; open?: 'later' | 'someday' }) => {
  const todos = useTodos();
  const sheet = useSheet();
  const act = useTodoActions(date);
  const [showLater, setShowLater] = useState(initial === 'later');
  const [showSomeday, setShowSomeday] = useState(initial === 'someday');
  const [showDone, setShowDone] = useState(false);
  const groups = useMemo(() => groupsOn(todos.data, date), [todos.data, date]);
  const [today, later, someday, done] = groups as [TodoGroupSpec, TodoGroupSpec, TodoGroupSpec, TodoGroupSpec];
  const row = (x: Todo, isDone: boolean) => ({
    carried: x.bucket === 'today' && x.createdOn < date && !isDone,
    onToggle: () => (isDone ? act.reopen(x) : act.done(x, false)),
    onLeft: () => (inToday(x, date) && !isDone ? act.later(x) : act.remove(x)),
    onEdit: () => sheet.push({ eyebrow: 'To-do', title: x.text, body: <TodoSheet x={x} date={date} /> }),
  });
  const nextDues = [...new Set(later.items.map((x) => x.due).filter((d): d is string => !!d))]
    .slice(0, 2)
    .map((d) => fmtDate('md', d))
    .join(' · ');
  return (
    <div className="tlist">
      {todos.isPending && !todos.data ? <SkeletonRows rows={3} label="Loading to-dos" /> : null}
      {today.items.length ? <TodoGroup items={today.items} sort={today.sort} tier={today.tier} date={date} row={row} /> : todos.data ? <p className="tlist-clear">{done.items.length ? 'All clear for today.' : 'Nothing for today yet.'}</p> : null}
      <QuickAddField date={date} />
      {later.items.length ? <Fold label="Later" count={later.items.length} meta={nextDues || undefined} open={showLater} onToggle={() => setShowLater((s) => !s)} /> : null}
      {showLater && later.items.length ? <TodoGroup items={later.items} sort={later.sort} tier={later.tier} date={date} row={row} /> : null}
      {someday.items.length ? <Fold label="Someday" count={someday.items.length} open={showSomeday} onToggle={() => setShowSomeday((s) => !s)} /> : null}
      {showSomeday && someday.items.length ? <TodoGroup items={someday.items} sort={someday.sort} tier={someday.tier} date={date} row={row} /> : null}
      {done.items.length ? <Fold label="Completed" count={done.items.length} open={showDone} onToggle={() => setShowDone((s) => !s)} /> : null}
      {showDone && done.items.length ? <TodoGroup items={done.items} sort={done.sort} tier={done.tier} date={date} done canDrag={false} row={row} /> : null}
    </div>
  );
};
