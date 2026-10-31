import { fmtDate, shiftDays, type ISODate, type Todo } from '@logbook/shared';
import { Check, ChevronDown, ChevronRight, Clock, Plus, RotateCcw, Sun, Trash2 } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { clientKey, newTodoId, useTodoGroups, useTodoMutations, useTodos } from '@/api/queries';
import { FOLD_MS } from '@/lib/gesture';
import { haptics } from '@/lib/haptics';
import { revealField } from '@/lib/keyboard';
import { SkeletonRows } from '@/ui/Skeleton';
import { Segmented } from '@/ui/primitives';
import { Pressable } from '@/ui/Pressable';
import { useSheet } from '@/ui/Sheet';
import { SwipeRow } from '@/ui/SwipeRow';
import { useToast } from '@/ui/Toast';
import { useFlip } from './flip';
import { byPriority, groupsOn, inToday, liveOn, stepWithin, todayOpenOn, type TodoGroupSpec } from './groups';
import { colorOf, colorStyle, groupOf, ListChip } from './colors';
import { ListSheet } from './ListSheet';
import { PRIORITY_SHORT, PriorityFlag } from './PriorityDots';
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
 * `date` is the day it is written on (today); `due`, the day a to-do added on a future day's page is for. `onAdd` gets the
 * new to-do's id (the schedule files it in a band).
 */
export const QuickAddField = ({ date, due, groupId, placeholder = 'Add a to-do', autoFocus, onClose, onAdded, onAdd }: { date: ISODate; due?: ISODate; groupId?: string | null; placeholder?: string; autoFocus?: boolean; onClose?: () => void; onAdded?: () => void; onAdd?: (id: string) => void }) => {
  const { add } = useTodoMutations();
  const hintId = useId();
  const [draft, setDraft] = useState('');
  const groups = useTodoGroups();
  const parsed = parseQuickAdd(draft, date, groups.data);
  const listName = parsed.groupId ? groups.data?.find((g) => g.id === parsed.groupId)?.name : null;
  const understood = [parsed.priority ? PRIORITY_SHORT[parsed.priority] : null, parsed.bucket === 'later' ? (parsed.due ? fmtDate('md', parsed.due) : 'Later') : parsed.bucket === 'someday' ? 'Someday' : null, listName].filter(Boolean).join(' · ');
  const addIt = () => {
    if (!parsed.text) return onClose?.();
    const forDay = due && parsed.bucket === 'today' ? { bucket: 'later' as const, due } : { bucket: parsed.bucket, due: parsed.due };
    onAdded?.();
    const id = newTodoId();
    add.mutate({ id, text: parsed.text, date, priority: parsed.priority, groupId: parsed.groupId ?? groupId ?? null, ...forDay });
    onAdd?.(id);
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
const SheetRow = ({ x, date, done, onEdit, onStep, fold, hideList }: { x: Todo; date: ISODate; done: boolean; onEdit: () => void; onStep: (dir: -1 | 1) => void; fold: (x: Todo) => void; hideList?: boolean }) => {
  const act = useTodoActions(date);
  const [checked, setChecked] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // checked, its fold not run yet: the write goes if the row goes first (the sheet closed; code review 1 #8)
  const pending = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      pending.current?.();
    },
    [],
  );
  const isToday = !done && inToday(x, date);
  const dueLabel = dueLabelOf(x, date);
  const carried = x.bucket === 'today' && x.createdOn < date && !done;
  const on = done || checked;
  const groups = useTodoGroups();
  const tint = colorOf(x, groups.data);
  const list = groupOf(x, groups.data);
  const right = done
    ? { label: 'Reopen', icon: <RotateCcw size={20} />, tone: 'neutral' as const, onCommit: () => act.reopen(x) }
    : { label: 'Done', icon: <Check size={20} />, tone: 'ok' as const, onCommit: () => act.done(x) };
  const left = done ? undefined : isToday ? { label: 'Later', icon: <Clock size={20} />, tone: 'warn' as const, onCommit: () => act.later(x) } : { label: 'Today', icon: <Sun size={20} />, tone: 'neutral' as const, onCommit: () => act.today(x) };
  const extra = done ? [] : isToday ? [{ label: 'Someday', onSelect: () => act.someday(x) }] : [];
  return (
    <SwipeRow right={right} left={left} menuItems={[...extra, { label: 'Delete', icon: <Trash2 size={18} />, destructive: true, onSelect: () => act.remove(x) }]} label={x.text} className="tl-swipe">
      <div className={`tl-row ${on ? 'is-done' : ''} ${tint ? 'has-tc' : ''}`} style={colorStyle(tint)}>
        <TodoMark
          on={on}
          label={dueLabel ? `${x.text}, ${dueLabel}` : x.text}
          onToggle={(next) => {
            if (done) return act.reopen(x);
            clearTimeout(timer.current);
            pending.current = null;
            setChecked(next);
            // the check is the answer; the row folds into Completed after the beat (still undoable with a tap)
            if (next) {
              pending.current = () => act.done(x);
              timer.current = setTimeout(() => {
                pending.current = null;
                fold(x);
              }, FOLD_MS);
            }
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
            <span>{x.text}</span>
            <PriorityFlag level={x.priority} />
          </span>
          {x.note ? <span className="trow-note">{x.note}</span> : null}
        </button>
        {dueLabel ? <span className="tdue caps">{dueLabel}</span> : carried ? <span className="carried">{fmtDate('md', x.createdOn)}</span> : list && !hideList ? <ListChip group={list} /> : null}
      </div>
    </SwipeRow>
  );
};

/** One group of the sheet: its rows FLIP when a checked row folds out of it. */
const SheetGroup = ({ g, date, done, onEdit, hideList }: { g: TodoGroupSpec; date: ISODate; done?: boolean; onEdit: (x: Todo) => void; hideList?: boolean }) => {
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
          <SheetRow x={x} date={date} done={!!done} onEdit={() => onEdit(x)} onStep={(d) => step(x, d)} fold={fold} hideList={hideList} />
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
const VIEW_KEY = 'logbook.todos.view';
const readView = (): 'day' | 'list' => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'day';
  } catch {
    return 'day';
  }
};

/** By list: each list (in its colour) with its open to-dos, P1 first, then the to-dos in no list. The list's head opens its editor. */
const ByList = ({ date }: { date: ISODate }) => {
  const todos = useTodos();
  const groups = useTodoGroups();
  const sheet = useSheet();
  const edit = (x: Todo) => sheet.push({ eyebrow: 'To-do', title: x.text, body: <TodoSheet x={x} date={date} /> });
  const open = liveOn(todos.data, date).filter((x) => !x.doneOn);
  const lists = [...(groups.data ?? []).map((g) => ({ g, items: open.filter((x) => x.groupId === g.id).sort(byPriority) })), { g: null, items: open.filter((x) => !x.groupId || !groups.data?.some((g) => g.id === x.groupId)).sort(byPriority) }];
  return (
    <>
      {lists.map(({ g, items }) => (
        <section key={g?.id ?? 'none'} className="tlist-list" aria-label={g?.name ?? 'No list'}>
          {g ? (
            <Pressable className="tlist-head" press="dim" onPress={() => sheet.push({ title: g.name, eyebrow: 'List', body: <ListSheet group={g} /> })} label={`${g.name}, ${items.length} open. Edit the list`}>
              <span className="tlist-dot" style={colorStyle(g.color)} aria-hidden="true" />
              <span className="tlist-name">{g.name}</span>
              <span className="tlist-count tnum">{items.length || ''}</span>
              <ChevronRight size={14} aria-hidden="true" className="tlist-chev" />
            </Pressable>
          ) : items.length ? (
            <div className="tlist-head is-none">
              <span className="tlist-name">No list</span>
              <span className="tlist-count tnum">{items.length}</span>
            </div>
          ) : null}
          {items.length ? <SheetGroup g={{ key: 'today', items, sort: byPriority, tier: 'priority' }} date={date} onEdit={edit} hideList /> : g ? <p className="tlist-clear">Nothing open in {g.name}.</p> : null}
          {g ? (
            <div className="tlist-add">
              <QuickAddField date={date} groupId={g.id} placeholder={`Add to ${g.name}`} />
            </div>
          ) : null}
        </section>
      ))}
      <Pressable className="tlist-new" press="surface" onPress={() => sheet.push({ title: 'New list', body: <ListSheet /> })} label="New list">
        <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
        New list
      </Pressable>
    </>
  );
};

export const TodoListSheet = ({ date, open: initial }: { date: ISODate; open?: 'later' | 'someday' }) => {
  const todos = useTodos();
  const sheet = useSheet();
  const [view, setView] = useState<'day' | 'list'>(readView);
  const pick = (v: 'day' | 'list') => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* the choice just isn't remembered */
    }
  };
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
  const seg = (
    <Segmented<'day' | 'list'>
      label="Show"
      className="tlist-seg"
      value={view}
      onChange={pick}
      options={[
        ['day', 'By day'],
        ['list', 'By list'],
      ]}
    />
  );
  if (view === 'list')
    return (
      <div className="tlist">
        {seg}
        <ByList date={date} />
      </div>
    );
  return (
    <div className="tlist">
      {seg}
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
