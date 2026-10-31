import { fmtDate, POINTS, shiftDays, type ISODate, type Todo } from '@logbook/shared';
import { ChevronRight, Clock, Flag, FlagOff, Moon, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { animate } from 'motion/react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { clientKey, useTodoGroups, useTodos } from '@/api/queries';
import { FOLD_MS } from '@/lib/gesture';
import { useReduced } from '@/lib/motion';
import { useToday } from '@/lib/useToday';
import { useContextMenu, type ContextMenuItem } from '@/ui/ContextMenu';
import { Pressable } from '@/ui/Pressable';
import { Section } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { useHold } from '@/ui/useHold';
import { usePress } from '@/ui/usePress';
import { useFlip } from './flip';
import { byPosition, groupsOn, liveOn } from './groups';
import { colorOf, colorStyle, groupOf, ListChip } from './colors';
import { PriorityFlag } from './PriorityDots';
import { QuickAddField, TodoListSheet, useTodoActions } from './TodoList';
import { TodoMark } from './TodoMark';
import { TodoSheet } from './TodoSheet';
import './todos.css';

export const TOP = 3;
const MARK = '.tmark-hit';

const asideOf = (x: Todo, date: ISODate) => {
  if (x.bucket === 'later' && x.due && x.due < date) return `Due ${fmtDate('md', x.due)}`;
  if (x.bucket === 'today' && x.createdOn < date && !x.doneOn) return x.createdOn === shiftDays(date, -1) ? 'Yesterday' : fmtDate('md', x.createdOn);
  return null;
};

/**
 * The rows a day's page lists (§3.3): today, the open ones (Today items and any Later item whose day has come, high first);
 * a past day, any open item that was due that day, then what was done that day (struck); a future day, the items due that day.
 */
const rowsFor = (todos: Todo[] | undefined, date: ISODate, today: ISODate): Todo[] => {
  if (date === today) return groupsOn(todos, date)[0]!.items;
  if (date < today) {
    const live = liveOn(todos, date);
    return [...live.filter((x) => x.due === date && x.doneOn !== date && (!x.doneOn || x.doneOn > date)).sort(byPosition), ...live.filter((x) => x.doneOn === date).sort(byPosition)];
  }
  return (todos ?? []).filter((x) => !x.deletedOn && !x.doneOn && x.due === date).sort(byPosition);
};

interface RowProps {
  x: Todo;
  date: ISODate;
  on: boolean;
  onMark: (x: Todo, next: boolean) => void;
  onEdit: (x: Todo) => void;
  menu: (x: Todo) => ContextMenuItem[];
}

/**
 * One row of the inset group (44, or 60 with a note): the mark, the words, an aside. No swipe on Today (M9: the day pager
 * is the page's one horizontal gesture): the mark is Done, the words open the to-do, and a hold anywhere but on the mark
 * lifts the row in place with `Later · Someday · Priority 1 · Delete`. The row shows `--surface-2` while pressed.
 */
const TodoRow = memo(function TodoRow({ x, date, on, onMark, onEdit, menu }: RowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const cm = useContextMenu();
  const press = usePress({ ignore: MARK });
  const hold = useHold({
    ignore: MARK,
    onHold: () => {
      const el = ref.current;
      if (el) cm.open({ items: menu(x), anchor: el, lift: el, label: `${x.text} actions`, haptic: false });
    },
  });
  const aside = asideOf(x, date);
  const groups = useTodoGroups();
  const tint = colorOf(x, groups.data);
  const list = groupOf(x, groups.data);
  return (
    <div
      ref={ref}
      className={`tt-row ${on ? 'is-done' : ''} ${x.note ? 'two' : ''} ${tint ? 'has-tc' : ''}`}
      style={colorStyle(tint)}
      data-press="surface"
      data-flip=""
      data-key={clientKey(x.id)}
      onPointerDown={(e) => {
        press.handlers.onPointerDown?.(e);
        hold.handlers.onPointerDown(e);
      }}
      onPointerUp={(e) => {
        press.handlers.onPointerUp?.(e);
        hold.handlers.onPointerUp(e);
      }}
      onPointerCancel={(e) => {
        press.handlers.onPointerCancel?.(e);
        hold.handlers.onPointerCancel(e);
      }}
      onPointerMove={hold.handlers.onPointerMove}
      onPointerLeave={press.handlers.onPointerLeave}
      onContextMenu={hold.handlers.onContextMenu}
      onKeyDown={hold.handlers.onKeyDown}
      onClickCapture={hold.handlers.onClickCapture}
    >
      <div className="tt-row-in">
        <TodoMark on={on} label={aside ? `${x.text}, ${aside}` : x.text} onToggle={(next) => onMark(x, next)} points={POINTS.todo[x.priority]} />
        <button type="button" className="tt-name" onClick={() => onEdit(x)}>
          <span className="trow-title">
            <span className="tt-text">{x.text}</span>
            <PriorityFlag level={x.priority} />
          </span>
          {x.note ? <span className="trow-note">{x.note}</span> : null}
        </button>
        {aside ? <span className="tt-aside caps">{aside}</span> : list ? <ListChip group={list} /> : null}
      </div>
    </div>
  );
});

/** `+ Add a to-do`, a 44 row that becomes the field in the same box (the keyboard rises under `--kb`; nothing else moves). */
const AddRow = ({ date, due, onAdded }: { date: ISODate; due?: ISODate; onAdded: () => void }) => {
  const [open, setOpen] = useState(false);
  if (open) return <QuickAddField date={date} due={due} autoFocus onClose={() => setOpen(false)} onAdded={onAdded} />;
  return (
    <Pressable className="tt-add" press="surface" data-flip="" onPress={() => setOpen(true)}>
      <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
      Add a to-do
    </Pressable>
  );
};

/**
 * To-dos on a day's page (§3.1 row 5, §3.3, M9): an inset group of up to three rows (high first, then your order), `+N more ›`
 * when there are more (the To-dos sheet), and `+ Add a to-do`. The mark fills on the tap and pops (`toggle` on the pop's
 * peak frame); the row dims and, after `FOLD_MS`, folds: its content fades (100 ms), it leaves, and the rows below it (and
 * the sections after the list) move up by FLIP on `settle`. While the finger is still on the list the fold waits for it to
 * lift. A tap on the mark before the fold takes it back.
 */
export const TodayTodos = ({ date }: { date: ISODate }) => {
  const today = useToday();
  const todos = useTodos();
  const sheet = useSheet();
  const reduce = useReduced();
  const act = useTodoActions(date);
  const isToday = date === today;
  const past = date < today;
  const rows = useMemo(() => rowsFor(todos.data, date, today), [todos.data, date, today]);
  const groups = useMemo(() => (isToday ? groupsOn(todos.data, date) : null), [todos.data, date, isToday]);
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set());
  const [gone, setGone] = useState<ReadonlySet<string>>(() => new Set());
  const visible = rows.filter((x) => !gone.has(clientKey(x.id)));
  const top = visible.slice(0, TOP);
  const more = visible.length - top.length;
  const later = groups ? groups[1]!.items.length : 0;
  const someday = groups ? groups[2]!.items.length : 0;

  // a folded row stays hidden until the cache agrees it is done (or gone)
  useEffect(() => {
    setGone((g) => {
      if (!g.size) return g;
      const open = new Set(rows.filter((x) => !x.doneOn || past).map((x) => clientKey(x.id)));
      const next = new Set([...g].filter((k) => open.has(k)));
      return next.size === g.size ? g : next;
    });
  }, [rows, past]);

  // the FLIP (§10.1): a user's change to the list (a fold, an add, a menu action) moves what follows on `settle`
  const groupRef = useRef<HTMLDivElement>(null);
  const sig = `${top.map((x) => `${clientKey(x.id)}:${x.text}:${x.note ?? ''}`).join('|')}|${more}|${later}|${someday}`;
  const flip = useFlip(groupRef, sig, { below: true });

  // the finger on the list holds a fold back until it lifts (then the fold runs)
  const down = useRef(0);
  const waiting = useRef(new Map<string, Todo>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  // a checked row whose fold has not run yet: its write is sent if the page goes first (a day swipe, a tab change, a jump;
  // code review 1 #8), as the orb row flushes its pending write
  const pend = useRef(new Map<string, Todo>());
  const sendDone = useRef((x: Todo) => act.done(x, isToday ? date : today));
  sendDone.current = (x: Todo) => act.done(x, isToday ? date : today);
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      for (const x of pend.current.values()) sendDone.current(x);
      pend.current.clear();
    },
    [],
  );
  const foldNow = (x: Todo) => {
    const key = clientKey(x.id);
    if (!pend.current.has(key)) return;
    const content = groupRef.current?.querySelector<HTMLElement>(`[data-key="${key}"] .tt-row-in`);
    const finish = () => {
      // the promoted row (the next one into the top three) fades in where the folded one leaves room
      flip.first(true);
      flushSync(() => {
        setGone((g) => new Set(g).add(key));
        setChecked((c) => {
          const n = new Set(c);
          n.delete(key);
          return n;
        });
      });
      pend.current.delete(key);
      act.done(x, isToday ? date : today);
    };
    if (content && !reduce) void animate(content, { opacity: 0 }, { duration: 0.1, ease: 'easeOut' }).then(finish);
    else finish();
  };
  const fold = (x: Todo) => {
    if (down.current > 0) waiting.current.set(clientKey(x.id), x);
    else foldNow(x);
  };
  const onListDown = () => {
    down.current++;
    const up = () => {
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
      down.current = Math.max(0, down.current - 1);
      if (down.current) return;
      const list = [...waiting.current.values()];
      waiting.current.clear();
      // after the release's own click (a tap on another mark checks that one first)
      setTimeout(() => list.forEach(foldNow), 0);
    };
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
  };

  const onMark = (x: Todo, next: boolean) => {
    const key = clientKey(x.id);
    clearTimeout(timers.current.get(key));
    timers.current.delete(key);
    waiting.current.delete(key);
    pend.current.delete(key);
    if (past) return next ? act.done(x) : act.reopen(x);
    if (next) pend.current.set(key, x);
    setChecked((c) => {
      const n = new Set(c);
      if (next) n.add(key);
      else n.delete(key);
      return n;
    });
    if (next) timers.current.set(key, setTimeout(() => (timers.current.delete(key), fold(x)), FOLD_MS));
  };
  const onEdit = (x: Todo) => sheet.open({ eyebrow: 'To-do', title: x.text, body: <TodoSheet x={x} date={date} /> });
  const viaMenu = (fn: () => void) => () => {
    flip.first(true);
    fn();
  };
  const menu = (x: Todo): ContextMenuItem[] =>
    x.doneOn
      ? [
          { label: 'Not done', icon: <RotateCcw size={18} />, onSelect: viaMenu(() => act.reopen(x)) },
          { label: 'Delete', icon: <Trash2 size={18} />, destructive: true, onSelect: viaMenu(() => act.remove(x)) },
        ]
      : [
          { label: 'Later', icon: <Clock size={18} />, onSelect: viaMenu(() => act.later(x)) },
          { label: 'Someday', icon: <Moon size={18} />, onSelect: viaMenu(() => act.someday(x)) },
          x.priority < 3 ? { label: 'Priority 1', icon: <Flag size={18} />, onSelect: viaMenu(() => act.priority(x, 3)) } : { label: 'No priority', icon: <FlagOff size={18} />, onSelect: viaMenu(() => act.priority(x, 0)) },
          { label: 'Delete', icon: <Trash2 size={18} />, destructive: true, onSelect: viaMenu(() => act.remove(x)) },
        ];
  // memoised rows get stable callbacks
  const fns = useRef({ onMark, onEdit, menu });
  fns.current = { onMark, onEdit, menu };
  const stable = useMemo(() => ({ onMark: (x: Todo, n: boolean) => fns.current.onMark(x, n), onEdit: (x: Todo) => fns.current.onEdit(x), menu: (x: Todo) => fns.current.menu(x) }), []);

  // medium first (a short list does not open over a screen of black; feel review 1 #13), large a drag or the grabber away
  const openList = (open?: 'later' | 'someday') => sheet.open({ title: 'To-dos', detent: 'medium', detents: ['medium', 'large'], body: <TodoListSheet date={date} open={open} /> });
  const moreText = more > 0 ? `+${more} more` : [later ? `Later ${later}` : null, someday ? `Someday ${someday}` : null].filter(Boolean).join(' · ');
  const count = past ? rows.filter((x) => x.doneOn === date).length : visible.filter((x) => !checked.has(clientKey(x.id))).length;
  const canAdd = !past;
  // a past day with nothing on it says so in one quiet row of the group: the section is quiet, never a bare heading over
  // empty space (§3: "quiet when there is nothing to say, never absent"; feel review 1 #6)
  const empty = !top.length && !moreText && !canAdd;
  return (
    <Section title="To-dos" meta={count ? (past ? `${count} done` : count) : undefined} level="primary" className="tt">
      {empty ? (
        <div className="tt-group">
          <p className="tt-none">Nothing done</p>
        </div>
      ) : (
        <div ref={groupRef} className="tt-group" onPointerDown={onListDown}>
          {top.map((x) => (
            <TodoRow key={clientKey(x.id)} x={x} date={date} on={!!x.doneOn || checked.has(clientKey(x.id))} {...stable} />
          ))}
          {isToday && moreText ? (
            <Pressable className="tt-more" press="surface" data-flip="" label={`Open all to-dos: ${moreText}`} onPress={() => openList(more > 0 ? undefined : later ? 'later' : 'someday')}>
              <span className="tt-more-text">{moreText}</span>
              <ChevronRight size={16} aria-hidden="true" />
            </Pressable>
          ) : null}
          {canAdd ? <AddRow date={today} due={isToday ? undefined : date} onAdded={() => flip.first(false)} /> : null}
        </div>
      )}
    </Section>
  );
};
