import { fmtDate, shiftDays, type ISODate, type Todo } from '@logbook/shared';
import { Check, ChevronDown, X } from 'lucide-react';
import { motion, useDragControls, useMotionValue, useReducedMotion, type Box } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

type Span = { min: number; max: number };
import { useTodoMutations, useTodos } from '@/api/queries';
import { haptic } from '@/lib/haptics';
import { Button, EmptyState, Group, Loading, Mark, SectionHead } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { PriorityDots } from './PriorityDots';
import { parseQuickAdd } from './quickAdd';
import { TodoSheet } from './TodoSheet';
import './todos.css';

// ---------- which list a to-do belongs to on a given day ----------

/** Everything that existed on `date` and was still open, or got done that day. */
export const liveOn = (todos: Todo[] | undefined, date: ISODate) => (todos ?? []).filter((x) => x.createdOn <= date && (!x.doneOn || x.doneOn >= date) && (!x.deletedOn || x.deletedOn > date));

/** Today's working list: Today items, plus any Later item whose day has come. */
export const inToday = (x: Todo, date: ISODate) => x.bucket === 'today' || (x.bucket === 'later' && !!x.due && x.due <= date);

/** What is open in Today's list on `date`: the number on the stat strip. */
export const todayOpenOn = (todos: Todo[] | undefined, date: ISODate) => liveOn(todos, date).filter((x) => (!x.doneOn || x.doneOn > date) && inToday(x, date));

const cmpStr = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
/** High first, then the hand-set order, then age. */
const byPriority = (a: Todo, b: Todo) => b.priority - a.priority || a.position - b.position || cmpStr(a.createdAt, b.createdAt);
/** Dated items by date, then the undated ones in their hand-set order. */
const byDue = (a: Todo, b: Todo) => (a.due && b.due ? cmpStr(a.due, b.due) : a.due ? -1 : b.due ? 1 : 0) || byPriority(a, b);
const byPosition = (a: Todo, b: Todo) => a.position - b.position || cmpStr(a.createdAt, b.createdAt);

const HOLD_MS = 300;
const HOLD_SLOP = 6;

// ---------- one row: swipe right to complete, left to delete; hold to lift and reorder; tap the name for the sheet ----------
const TodoRow = ({ x, date, done, carried, canDrag, onToggle, onDelete, onEdit, onLift, onMove, onMeasure, onDrop }: { x: Todo; date: ISODate; done: boolean; carried: boolean; canDrag: boolean; onToggle: () => void; onDelete: () => void; onEdit: () => void; onLift: () => void; onMove: (offset: number, velocity: number) => void; onMeasure: (span: Span) => void; onDrop: () => void }) => {
  const reduce = useReducedMotion();
  const controls = useDragControls();
  const [gone, setGone] = useState<'left' | 'right' | null>(null);
  const [checked, setChecked] = useState(false);
  const [lifted, setLifted] = useState(false);
  const liftedRef = useRef(false);
  const liftEndAt = useRef(0);
  const hold = useRef<{ t: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const armed = useRef<'left' | 'right' | null>(null);
  const el = useRef<HTMLDivElement>(null);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;
  const mx = useMotionValue(0);
  const my = useMotionValue(0);

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
  const onPointerDown = (e: React.PointerEvent) => {
    if (!canDrag || reduce || done || gone || (e.target as HTMLElement).closest('.mark-hit')) return;
    cancelHold();
    const ev = e.nativeEvent;
    hold.current = {
      x: e.clientX,
      y: e.clientY,
      t: setTimeout(() => {
        hold.current = null;
        liftedRef.current = true;
        setLifted(true);
        haptic();
        onLift();
        controls.start(ev);
        // a lift with no move never reaches onDragEnd, so the release settles it
        const settle = () => {
          window.removeEventListener('pointerup', settle);
          window.removeEventListener('pointercancel', settle);
          setTimeout(endLift, 0);
        };
        window.addEventListener('pointerup', settle);
        window.addEventListener('pointercancel', settle);
      }, HOLD_MS),
    };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (hold.current && Math.hypot(e.clientX - hold.current.x, e.clientY - hold.current.y) > HOLD_SLOP) cancelHold();
  };

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
      setTimeout(onToggle, 180);
    } else if (v <= -THRESHOLD) {
      haptic('warn');
      setGone('left');
      setTimeout(onDelete, 180);
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
  const isDone = done || checked;
  const dueLabel = x.bucket === 'later' && x.due ? (x.due === date ? null : x.due < date ? `Due ${fmtDate('md', x.due)}` : x.due === shiftDays(date, 1) ? 'Tomorrow' : fmtDate('md', x.due)) : null;
  return (
    <motion.div
      ref={el}
      layout
      drag="y"
      dragListener={false}
      dragControls={controls}
      dragSnapToOrigin
      dragMomentum={false}
      style={{ y: my }}
      onLayoutMeasure={(box: Box) => onMeasure(box.y)}
      onDrag={(_, info) => onMove(my.get(), info.velocity.y)}
      className={`todo-wrap ${lifted ? 'is-lifted' : ''}`}
      initial={false}
      animate={gone ? { height: 0, opacity: 0 } : { height: 'auto', opacity: 1 }}
      transition={{ duration: 0.18 }}
      onDragEnd={endLift}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={cancelHold}
      onPointerCancel={cancelHold}
      onPointerLeave={cancelHold}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="todo-under" aria-hidden="true">
        <span className="todo-under-left">
          <Check size={20} strokeWidth={2.5} />
        </span>
        <span className="todo-under-right">
          <X size={20} strokeWidth={2.5} />
        </span>
      </div>
      <motion.div className={`lrow trow ${isDone ? 'is-done' : ''}`} style={{ x: mx }} drag={reduce || isDone || lifted ? false : 'x'} dragDirectionLock dragConstraints={{ left: 0, right: 0 }} dragElastic={0.7} onDrag={onDrag} onDragEnd={onDragEnd} animate={gone === 'right' ? { x: 120 } : gone === 'left' ? { x: -120 } : { x: 0 }}>
        <Mark status={isDone ? 'done' : 'open'} square label={x.text} onClick={tapMark} />
        <div className="lrow-main">
          <button type="button" className={`trow-name ${x.note ? 'has-note' : ''}`} onClick={() => Date.now() - liftEndAt.current > 400 && onEdit()}>
            <span className="trow-title">
              <PriorityDots level={x.priority} />
              <span>{x.text}</span>
            </span>
            {x.note ? <span className="trow-note">{x.note}</span> : null}
          </button>
        </div>
        <div className="lrow-right">{dueLabel ? <span className="tdue caps">{dueLabel}</span> : carried ? <span className="carried">{fmtDate('md', x.createdOn)}</span> : null}</div>
      </motion.div>
    </motion.div>
  );
};

// ---------- a group of rows you can drag into order ----------
/**
 * The reorder is done by hand rather than with motion's Reorder: that component auto-scrolls the page when the
 * finger nears the bottom of `body`, and with `body { height: 100% }` that edge is always one viewport away,
 * which sent the page running. The rule is the same one Reorder uses: the lifted row swaps with its neighbour
 * once its edge passes the neighbour's centre.
 */
const TodoGroup = ({ items, sort, date, done, canDrag = true, row }: { items: Todo[]; sort: (a: Todo, b: Todo) => number; date: ISODate; done?: boolean; canDrag?: boolean; row: (x: Todo, isDone: boolean) => Omit<React.ComponentProps<typeof TodoRow>, 'x' | 'date' | 'done' | 'canDrag' | 'onLift' | 'onMove' | 'onMeasure' | 'onDrop'> }) => {
  const { reorder } = useTodoMutations();
  const sortedIds = useMemo(() => items.map((x) => x.id), [items]);
  const [order, setOrder] = useState(sortedIds);
  const orderRef = useRef(order);
  orderRef.current = order;
  const dragging = useRef(false);
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
  const byId = useMemo(() => new Map(items.map((x) => [x.id, x])), [items]);
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
  const onDrop = () => {
    dragging.current = false;
    if (order.join('|') === sig) return;
    // the dragged order becomes the hand-set order; the group's own sort (priority, dates) still has the last word
    const pos = new Map(order.map((id, i) => [id, i]));
    setOrder(
      list
        .map((x) => ({ ...x, position: pos.get(x.id) ?? x.position }))
        .sort(sort)
        .map((x) => x.id),
    );
    reorder.mutate(order);
  };
  return (
    <div className="tgroup">
      {list.map((x) => (
        <TodoRow key={x.id} x={x} date={date} done={!!done} canDrag={canDrag && list.length > 1} onLift={() => (dragging.current = true)} onMove={(offset, velocity) => move(x.id, offset, velocity)} onMeasure={(s) => spans.current.set(x.id, s)} onDrop={onDrop} {...row(x, !!done)} />
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

// ---------- the section ----------
export const TodosSection = ({ date }: { date: ISODate }) => {
  const todos = useTodos();
  const { add, patch } = useTodoMutations();
  const sheet = useSheet();
  const [draft, setDraft] = useState('');
  const [showLater, setShowLater] = useState(false);
  const [showSomeday, setShowSomeday] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const all = useMemo(() => liveOn(todos.data, date), [todos.data, date]);
  const open = useMemo(() => all.filter((x) => x.doneOn !== date), [all, date]);
  const today = useMemo(() => open.filter((x) => inToday(x, date)).sort(byPriority), [open, date]);
  const later = useMemo(() => open.filter((x) => x.bucket === 'later' && !inToday(x, date)).sort(byDue), [open, date]);
  const someday = useMemo(() => open.filter((x) => x.bucket === 'someday').sort(byPriority), [open]);
  const done = useMemo(() => all.filter((x) => x.doneOn === date).sort(byPosition), [all, date]);
  const parsed = parseQuickAdd(draft, date);
  const hint = [parsed.priority ? (parsed.priority === 2 ? 'High' : 'Medium') : null, parsed.bucket === 'later' ? (parsed.due ? fmtDate('md', parsed.due) : 'Later') : parsed.bucket === 'someday' ? 'Someday' : null].filter(Boolean).join(' · ');
  const addIt = () => {
    if (!parsed.text) return;
    add.mutate({ text: parsed.text, date, priority: parsed.priority, bucket: parsed.bucket, due: parsed.due });
    setDraft('');
  };
  const row = (x: Todo, isDone: boolean) => ({
    carried: x.createdOn < date && !isDone,
    onToggle: () => patch.mutate({ id: x.id, doneOn: isDone ? null : date }),
    onDelete: () => patch.mutate({ id: x.id, deletedOn: date }),
    onEdit: () => sheet.open({ title: <span className="caps tsheet-kicker">To-do</span>, body: <TodoSheet x={x} date={date} /> }),
  });
  const nextDues = later
    .filter((x) => x.due)
    .slice(0, 2)
    .map((x) => fmtDate('md', x.due!))
    .join(' · ');
  return (
    <>
      <SectionHead title="To-dos" meta={today.length ? `${today.length} open` : undefined} />
      <Group>
        {todos.isPending && !todos.data ? <Loading text="Loading to-dos…" /> : null}
        {today.length ? <TodoGroup items={today} sort={byPriority} date={date} row={row} /> : null}
        {!today.length && todos.data ? <EmptyState>{done.length ? 'All clear for today.' : later.length || someday.length ? 'Nothing for today. Pull something up from Later.' : 'Nothing on the list. What you don’t finish rolls to tomorrow.'}</EmptyState> : null}
        <div className="lrow-add">
          <input className="in" placeholder="Add a to-do" maxLength={200} aria-label="New to-do" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addIt())} />
          {hint && parsed.text ? <span className="tadd-hint caps">{hint}</span> : null}
          {parsed.text ? (
            <Button size="sm" variant="soft" onClick={addIt}>
              Add
            </Button>
          ) : null}
        </div>
        {later.length ? <Fold label="Later" count={later.length} meta={nextDues || undefined} open={showLater} onToggle={() => setShowLater((s) => !s)} /> : null}
        {showLater && later.length ? <TodoGroup items={later} sort={byDue} date={date} row={row} /> : null}
        {someday.length ? <Fold label="Someday" count={someday.length} open={showSomeday} onToggle={() => setShowSomeday((s) => !s)} /> : null}
        {showSomeday && someday.length ? <TodoGroup items={someday} sort={byPriority} date={date} row={row} /> : null}
        {done.length ? <Fold label="Completed" count={done.length} open={showDone} onToggle={() => setShowDone((s) => !s)} /> : null}
        {showDone && done.length ? <TodoGroup items={done} sort={byPosition} date={date} done canDrag={false} row={row} /> : null}
      </Group>
    </>
  );
};
