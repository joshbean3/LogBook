import { fmtDate, shiftDays, type ISODate, type Todo } from '@logbook/shared';
import { Check, Clock, Flag, FlagOff, Moon, Trash2 } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';
import { clientKey, useTodos } from '@/api/queries';
import { rowPresence } from '@/lib/motion';
import { Mark, Pressable, Section, SkeletonRows, useSheet, type ContextMenuItem } from '@/ui';
import { groupsOn, type TodoGroupSpec } from './groups';
import { PriorityDots } from './PriorityDots';
import { QuickAddField, TodoListSheet, useTodoActions } from './TodoList';
import { TodoSheet } from './TodoSheet';
import './todos.css';

export const TOP = 3;
/** The beat a checked row waits, still undoable with a tap, before it folds away (consumer research §5). */
const FOLD_MS = 700;

const asideOf = (x: Todo, date: ISODate) => {
  if (x.bucket === 'later' && x.due && x.due < date) return `Due ${fmtDate('md', x.due)}`;
  if (x.bucket === 'today' && x.createdOn < date) return x.createdOn === shiftDays(date, -1) ? 'Yesterday' : fmtDate('md', x.createdOn);
  return null;
};

/** One of the top three: the square, the words, how much it matters. Tap the words for the editor. */
const TopRow = ({ x, date, onDone, onEdit, menu }: { x: Todo; date: ISODate; onDone: () => void; onEdit: () => void; menu: ContextMenuItem[] }) => {
  const reduce = useReducedMotion();
  const [checked, setChecked] = useState(false);
  const aside = asideOf(x, date);
  return (
    <div className={`tt-row ${checked ? 'is-done' : ''}`}>
      <Mark
        status={checked ? 'done' : 'open'}
        square
        label={aside ? `${x.text}, ${aside}` : x.text}
        onClick={() => {
          if (checked) return setChecked(false);
          setChecked(true);
          setTimeout(onDone, reduce ? 120 : FOLD_MS);
        }}
      />
      <Pressable className="tt-name" press="dim" onPress={onEdit} holdMenu={menu} menuLabel={`${x.text} actions`}>
        <span className="trow-title">
          <PriorityDots level={x.priority} />
          <span className="tt-text">{x.text}</span>
        </span>
        {x.note ? <span className="trow-note">{x.note}</span> : null}
      </Pressable>
      {aside ? <span className="tt-aside caps">{aside}</span> : null}
    </div>
  );
};

/**
 * To-dos on Today: the three that matter most (high first, then your order) as an edge-to-edge list. No swipe rows on Today
 * (M9: the day pager is the page's one horizontal gesture): the mark is Done, the words open the to-do, and a hold on the
 * words opens Later · Someday · Priority · Delete. The quick-add line under them, and
 * one quiet row for everything else ("+2 more · Later 3 · Someday 1") that opens the full list in a sheet.
 */
export const TodayTodos = ({ date }: { date: ISODate }) => {
  const todos = useTodos();
  const sheet = useSheet();
  const act = useTodoActions(date);
  const groups = useMemo(() => groupsOn(todos.data, date), [todos.data, date]);
  const [today, later, someday, done] = groups as [TodoGroupSpec, TodoGroupSpec, TodoGroupSpec, TodoGroupSpec];
  // a row that is folding away keeps its place until it has gone
  const top = today.items.slice(0, TOP);
  const more = today.items.length - top.length;
  const openList = (open?: 'later' | 'someday') => sheet.open({ title: 'To-dos', detent: 'large', body: <TodoListSheet date={date} open={open} /> });
  const edit = (x: Todo) => sheet.open({ eyebrow: 'To-do', title: x.text, body: <TodoSheet x={x} date={date} /> });
  const restBits = [more > 0 ? `${more} more` : null, later.items.length ? `Later ${later.items.length}` : null, someday.items.length ? `Someday ${someday.items.length}` : null].filter(Boolean) as string[];
  return (
    <Section title="To-dos" meta={today.items.length || undefined} level="primary" className="tt">
      {todos.isPending && !todos.data ? <SkeletonRows rows={2} label="Loading to-dos" /> : null}
      <div className="list-edge tt-list">
        <AnimatePresence initial={false}>
          {top.map((x) => (
            <motion.div key={clientKey(x.id)} className="tt-item" {...rowPresence} layout="position">
              <TopRow
                x={x}
                date={date}
                onDone={() => act.done(x, false)}
                onEdit={() => edit(x)}
                menu={[
                  { label: 'Later', icon: <Clock size={18} />, onSelect: () => act.later(x) },
                  { label: 'Someday', icon: <Moon size={18} />, onSelect: () => act.someday(x) },
                  x.priority < 2 ? { label: 'High priority', icon: <Flag size={18} />, onSelect: () => act.priority(x, 2) } : { label: 'Clear priority', icon: <FlagOff size={18} />, onSelect: () => act.priority(x, 0) },
                  { label: 'Delete', icon: <Trash2 size={18} />, destructive: true, onSelect: () => act.remove(x) },
                ]}
              />
            </motion.div>
          ))}
        </AnimatePresence>
        {restBits.length ? (
          <Pressable className="tt-more" pressScale={1} onPress={() => openList(more > 0 ? undefined : later.items.length ? 'later' : 'someday')} label={`Open all to-dos: ${restBits.join(', ')}`}>
            <span className="tt-more-text">{restBits.join(' · ')}</span>
          </Pressable>
        ) : null}
      </div>
      {!top.length && done.items.length ? (
        <p className="tt-clear">
          <Check size={16} strokeWidth={2.5} aria-hidden="true" /> All clear for today.
        </p>
      ) : null}
      <QuickAddField date={date} placeholder="Add a to-do" />
    </Section>
  );
};
