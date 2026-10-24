import { fmtDate, shiftDays, type ISODate, type Todo } from '@logbook/shared';
import { Check, ChevronDown, Clock, RotateCcw, Sun, Trash2 } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { clientKey, useTodoMutations, useTodos } from '@/api/queries';
import { FOLD_MS } from '@/lib/gesture';
import { haptics } from '@/lib/haptics';
import { revealField } from '@/lib/keyboard';
import { SkeletonRows } from '@/ui/Skeleton';
import { useSheet } from '@/ui/Sheet';
import { SwipeRow } from '@/ui/SwipeRow';
import { useToast } from '@/ui/Toast';
import { useFlip } from './flip';
import { groupsOn, inToday, liveOn, stepWithin, todayOpenOn, type TodoGroupSpec } from './groups';
import { PriorityDots } from './PriorityDots';
import { parseQuickAdd } from './quickAdd';
import { TodoMark } from './TodoMark';
import { TodoSheet } from './TodoSheet';
import './todos.css';

export { inToday, liveOn, todayOpenOn };

/** The words at the right of a row: the day a Later item is for. Nothing on its own day. */
const dueLabelOf = (x: Todo, date: ISODate) => (x.bucket === 'later' && x.due ? (x.due === date ? null : x.due < date ? `Due ${fmtDate('md', x.due)}` : x.due === shiftDays(date, 1) ? 'Tomorrow' : fmtDate('md', x.due)) : null);

// ---------- the quick-add field, shared by Today and the full list ----------
/**
 * "Call the bank fri !!": the field reads its marks and says what it understood, in caps, as you type (inside the same 44
 * px row, so nothing below moves). Return adds the to-do and keeps the field for the next one; Return on an empty field, or
 * leaving it empty, closes it. On focus it is scrolled above the keyboard after the keyboard's 250 ms (`revealField`).
 * `date` is the day it is written on (today); `due`, the day a to-do added on a future day's page is for.
 */
export const QuickAddField = ({ date, due, placeholder = 'Add a to-do', autoFocus, onClose, onAdded }: { date: ISODate; due?: ISODate; placeholder?: string; autoFocus?: boolean; onClose?: () => void; onAdded?: () => void }) => {
  const { add } = useTodoMutations();
  const hintId = useId();
  const [draft, setDraft] = useState('');
  const parsed = parseQuickAdd(draft, date);
  const understood = [parsed.priority ? (parsed.priority === 2 ? 'High' : 'Medium') : null, parsed.bucket === 'later' ? (parsed.due ? fmtDate('md', parsed.due) : 'Later') : parsed.bucket === 'someday' ? 'Someday' : null].filter(Boolean).join(' · ');
  const addIt = () => {
    if (!parsed.text) return onClose?.();
    const forDay = due && parsed.bucket === 'today' ? { bucket: 'later' as const, due } : { bucket: parsed.bucket, due: parsed.due };
    onAdded?.();
    add.mutate({ text: parsed.text, date, priority: parsed.priority, ...forDay });
    setDraft('');
  };
  return (
    <div className="tt-field" data-flip="">
      <input
        className="tt-input"
        placeholder={placeholder}
        maxLength={200}
        aria-label="New to-do"
        aria-describedby={understood ? hintId : undefined}
        enterKeyHint="done"
        autoFocus={autoFocus}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => revealField(e.currentTarget)}
        onBlur={() => {
          if (!draft.trim()) onClose?.();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addIt();
          } else if (e.key === 'Escape') {
            setDraft('');
            onClose?.();
          }
        }}
      />
      {understood ? (
        <span id={hintId} className="tt-hint caps" role="status">
          {understood}
        </span>
      ) : null}
    </div>
  );
};

/** Later means a day: tomorrow, unless the item already had one ahead. */
export const laterPatch = (x: Todo, date: ISODate) => ({ bucket: 'later' as const, due: x.due && x.due > date ? x.due : shiftDays(date, 1) });

/** Every to-do action with its Undo, from any surface (the Today rows, the full list). Only Undo raises a toast. */
export const useTodoActions = (date: ISODate) => {
  const { patch } = useTodoMutations();
  const toast = useToast();
  return {
    done: (x: Todo, on: ISODate = date) => patch.mutate({ id: x.id, doneOn: on }),
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
    priority: (x: Todo, p: Todo['priority']) => patch.mutate({ id: x.id, priority: p }),
    remove: (x: Todo) => {
      haptics.delete();
      patch.mutate({ id: x.id, deletedOn: date });
      toast('Deleted', { label: 'Undo', fn: () => patch.mutate({ id: x.id, deletedOn: null }) });
    },
  };
};

// ---------- the sheet's rows: SwipeRow v2 (sheets may swipe; Today may not, M9) ----------
const SheetRow = ({ x, date, done, onEdit, onStep, fold }: { x: Todo; date: ISODate; done: boolean; onEdit: () => void; onStep: (dir: -1 | 1) => void; fold: (x: Todo) => void }) => {
  const act = useTodoActions(date);
  const [checked, setChecked] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const isToday = !done && inToday(x, date);
  const dueLabel = dueLabelOf(x, date);
  const carried = x.bucket === 'today' && x.createdOn < date && !done;
  const on = done || checked;
  const right = done
    ? { label: 'Reopen', icon: <RotateCcw size={20} />, tone: 'neutral' as const, onCommit: () => act.reopen(x) }
    : { label: 'Done', icon: <Check size={20} />, tone: 'ok' as const, onCommit: () => act.done(x) };
  const left = done ? undefined : isToday ? { label: 'Later', icon: <Clock size={20} />, tone: 'warn' as const, onCommit: () => act.later(x) } : { label: 'Today', icon: <Sun size={20} />, tone: 'neutral' as const, onCommit: () => act.today(x) };
  const extra = done ? [] : isToday ? [{ label: 'Someday', onSelect: () => act.someday(x) }] : [];
  return (
    <SwipeRow right={right} left={left} menuItems={[...extra, { label: 'Delete', icon: <Trash2 size={18} />, destructive: true, onSelect: () => act.remove(x) }]} label={x.text} className="tl-swipe">
      <div className={`tl-row ${on ? 'is-done' : ''}`}>
        <TodoMark
          on={on}
          label={dueLabel ? `${x.text}, ${dueLabel}` : x.text}
          onToggle={(next) => {
            if (done) return act.reopen(x);
            clearTimeout(timer.current);
            setChecked(next);
            // the check is the answer; the row folds into Completed after the beat (still undoable with a tap)
            if (next) timer.current = setTimeout(() => fold(x), FOLD_MS);
          }}
        />
        <button
          type="button"
          className={`tl-name ${x.note ? 'has-note' : ''}`}
          onClick={onEdit}
          onKeyDown={(e) => {
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
        {dueLabel ? <span className="tdue caps">{dueLabel}</span> : carried ? <span className="carried">{fmtDate('md', x.createdOn)}</span> : null}
      </div>
    </SwipeRow>
  );
};

/** One group of the sheet: its rows FLIP when a checked row folds out of it. */
const SheetGroup = ({ g, date, done, onEdit }: { g: TodoGroupSpec; date: ISODate; done?: boolean; onEdit: (x: Todo) => void }) => {
  const act = useTodoActions(date);
  const { reorder, patch } = useTodoMutations();
  const ref = useRef<HTMLDivElement>(null);
  const sig = g.items.map((x) => clientKey(x.id)).join('|');
  // a checked row folding out of the group moves the rows below it by FLIP (a swipe's commit has SwipeRow's own)
  const flip = useFlip(ref, sig);
  const fold = (x: Todo) => {
    flip.first();
    act.done(x);
  };
  const step = (x: Todo, dir: -1 | 1) => {
    const r = stepWithin(g.items, x.id, dir, g.tier);
    if (!r) return;
    reorder.mutate(r.order);
    if (r.fix) patch.mutate({ id: x.id, ...r.fix });
  };
  return (
    <div ref={ref} className="tgroup">
      {g.items.map((x) => (
        <div key={clientKey(x.id)} data-flip="">
          <SheetRow x={x} date={date} done={!!done} onEdit={() => onEdit(x)} onStep={(d) => step(x, d)} fold={fold} />
        </div>
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

/**
 * The full to-do list, in a sheet (`+N more ›` on Today opens it): Today's rows (swipe right for Done, left for Later; hold
 * for the menu), the quick-add field, then the Later, Someday and Completed folds. The rows are SwipeRow v2: the sheet may
 * swipe, Today's page may not (M9). A row's words push its editor inside the same sheet (where its order is changed too).
 */
export const TodoListSheet = ({ date, open: initial }: { date: ISODate; open?: 'later' | 'someday' }) => {
  const todos = useTodos();
  const sheet = useSheet();
  const [showLater, setShowLater] = useState(initial === 'later');
  const [showSomeday, setShowSomeday] = useState(initial === 'someday');
  const [showDone, setShowDone] = useState(false);
  const groups = useMemo(() => groupsOn(todos.data, date), [todos.data, date]);
  const [today, later, someday, done] = groups as [TodoGroupSpec, TodoGroupSpec, TodoGroupSpec, TodoGroupSpec];
  const edit = (x: Todo) => sheet.push({ eyebrow: 'To-do', title: x.text, body: <TodoSheet x={x} date={date} /> });
  const nextDues = [...new Set(later.items.map((x) => x.due).filter((d): d is string => !!d))]
    .slice(0, 2)
    .map((d) => fmtDate('md', d))
    .join(' · ');
  return (
    <div className="tlist">
      {todos.isPending && !todos.data ? <SkeletonRows rows={3} label="Loading to-dos" /> : null}
      {today.items.length ? <SheetGroup g={today} date={date} onEdit={edit} /> : todos.data ? <p className="tlist-clear">{done.items.length ? 'All clear for today.' : 'Nothing for today yet.'}</p> : null}
      <div className="tlist-add">
        <QuickAddField date={date} />
      </div>
      {later.items.length ? <Fold label="Later" count={later.items.length} meta={nextDues || undefined} open={showLater} onToggle={() => setShowLater((s) => !s)} /> : null}
      {showLater && later.items.length ? <SheetGroup g={later} date={date} onEdit={edit} /> : null}
      {someday.items.length ? <Fold label="Someday" count={someday.items.length} open={showSomeday} onToggle={() => setShowSomeday((s) => !s)} /> : null}
      {showSomeday && someday.items.length ? <SheetGroup g={someday} date={date} onEdit={edit} /> : null}
      {done.items.length ? <Fold label="Completed" count={done.items.length} open={showDone} onToggle={() => setShowDone((s) => !s)} /> : null}
      {showDone && done.items.length ? <SheetGroup g={done} date={date} done onEdit={edit} /> : null}
    </div>
  );
};
