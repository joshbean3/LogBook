import { awaitingReview, fmtDate, GOAL_STEPS_MAX, label as sessionLabel, shiftDays, type Aim, type ISODate, type Todo } from '@logbook/shared';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, ArrowUp, Check, ChevronRight, CloudOff, Moon, RotateCcw, Target, Trash2 } from 'lucide-react';
import { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import { isWriteRejected } from '@/api/outbox';
import { newTodoId, useGoalMutations, useGoals, useTodoGroups, useTodoMutations, useTodos } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { revealField, useKeyboardOpen } from '@/lib/keyboard';
import { useReduced } from '@/lib/motion';
import { useContextMenu, type ContextMenuItem } from '@/ui/ContextMenu';
import { SectionHeader } from '@/ui/layout';
import { PathCheck, PathLine, PathStop, Poster, PosterScene, type PosterBand } from '@/ui/poster';
import { Button, SectionEmpty } from '@/ui/primitives';
import { Pressable } from '@/ui/Pressable';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { useHold } from '@/ui/useHold';
import { useIsLive } from '../day/live';
import { useFaceMinutes } from '../day/useDeferred';
import { useCelebrate } from '../goals/Celebrate';
import { celebrateOnce } from '../goals/game';
import { goalIdea, ideaGoal, type GoalIdea } from '../goals/goalIdea';
import { useOpenGoal } from '../goals/GoalSheets';
import { goalOf, STATUS_WORD } from '../goals/model';
import { ReviewRow } from '../goals/ReviewRow';
import { newStepId, useSaveSteps } from '../goals/Steps';
import type { Log } from '../log/useLog';
import { groupOf } from '../todos/colors';
import { groupsOn } from '../todos/groups';
import { PriorityFlag } from '../todos/PriorityDots';
import { parseQuickAdd } from '../todos/quickAdd';
import { goneOn, TodoListSheet, understoodOf, useTodoActions } from '../todos/TodoList';
import { TodoSheet } from '../todos/TodoSheet';
import { cardsFor, countWords, focusOf, isEcho, leftWords, pathOf, type PathChange } from './model';
import './dayplan.css';

/** The day after the page's day is "Tomorrow" only on today's page; on a day ahead it is that day's next day. */
const nextDayWord = (date: ISODate, today: ISODate) => (date === today ? 'Tomorrow' : 'Next day');

/** How long a ticked to-do shows its filled check where it is before the light moves on. */
const CHECK_BEAT_MS = 320;
/** From here on the poster offers tomorrow's goal (the evening). */
const EVENING = 17 * 60;

/** Today's session in a few words, for the idea: "Bike 40 min", "Easy 3". None, rest, or already marked: null. */
const sessionWords = (log: Log, date: ISODate): string | null => {
  if (!log.fitness) return null;
  const s = log.snap.sessionsOn(date).find((x) => x.kind !== 'rest' && !x.mark);
  if (!s) return null;
  const base = sessionLabel(s);
  return s.kind !== 'run' && s.minutes ? `${base} ${s.minutes} min` : base;
};

/** A stop's id on the path: the to-do's own, marked so the hold knows which stops are to-dos. */
const stopId = (x: Todo) => `t:${x.id}`;

/**
 * Plan your day (Today): the day's poster. With nothing set the title asks "What would make today count?", the band holds
 * one suggested goal and where it came from (`goalIdea`), and the line under it starts at the lit stop: "Set this goal"
 * (one tap, with Undo) and "Something else" (the goal editor). With a goal set the goal is the title (a tap opens its
 * sheet: why, steps, done or not), the band counts the to-dos, and the to-dos are stops on the line: what is done solid
 * behind, the next one lit and tagged "Next" with its check, the rest ahead, ending at "Add a to-do" and "All to-dos".
 *
 * The first three open to-dos are on the surface; the rest wait behind "All to-dos". A tap on a to-do opens its editor
 * (name, note, flag, list, when, its place in the order); a hold opens its menu (Done, Make it next, Tomorrow, Someday,
 * Make it a step, Delete). `slim`: the poster sits under the training card (Fitness on), so it draws no second sun.
 */
export const PlanDay = memo(function PlanDay({ date, today, log, slim, yesterday }: { date: ISODate; today: ISODate; log: Log; slim: boolean; yesterday?: React.ReactNode }) {
  const todos = useTodos();
  const goals = useGoals();
  const groups = useTodoGroups();
  const reduce = useReduced();
  const live = useIsLive(date);
  // the clock of the day on the page: while the tab holds yesterday past midnight (a draft, an open sheet), that day is at
  // its last minute, never "24 h left" of a day that is over
  const minutes = useFaceMinutes();
  const open = useOpenGoal();
  const sheet = useSheet();
  const toast = useToast();
  const cm = useContextMenu();
  const qc = useQueryClient();
  const act = useTodoActions(date);
  const saveSteps = useSaveSteps();
  const celebrate = useCelebrate();
  const { set, clear } = useGoalMutations();
  const { patch, reorder } = useTodoMutations();

  const isToday = date === today;
  const editable = date >= today;
  const goal = goalOf(goals.data, 'day', date);
  const loaded = !!todos.data && !!goals.data;
  // the to-dos only (the goal's steps live in the goal's sheet): open ones in the order they matter, then what got done
  const cards = useMemo(() => focusOf(cardsFor(todos.data, null, date, today)), [todos.data, date, today]);
  const path = useMemo(() => pathOf(cards), [cards]);
  const [adding, setAdding] = useState(false);
  // a to-do the server refused for good: its words go back into the field, as typed, so nothing written is lost
  const [refused, setRefused] = useState<string | null>(null);
  const onRefused = (typed: string) => {
    setRefused(typed);
    setAdding(true);
  };

  // the goal turned done (its sheet, the Goals tab): the moment plays once
  const wasStatus = useRef(goal?.status);
  useEffect(() => {
    const before = wasStatus.current;
    wasStatus.current = goal?.status;
    if (!goal || before !== 'open' || goal.status !== 'done') return;
    celebrateOnce(`${goal.id}:${goal.updatedAt}`, false);
    celebrate(goal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal?.status, goal]);

  // the goal was just set on this screen: its words rise into the title once (never on a load)
  const hadGoal = useRef<boolean | null>(null);
  const [rise, setRise] = useState(0);
  useEffect(() => {
    if (!loaded) return;
    if (hadGoal.current === false && goal) setRise((n) => n + 1);
    hadGoal.current = !!goal;
  }, [loaded, goal]);

  // a ticked to-do: its check fills where it is for a beat, then it is done and the light moves on
  const [checking, setChecking] = useState<string | null>(null);
  const beat = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flush = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      clearTimeout(beat.current);
      flush.current?.();
    },
    [],
  );
  // what a tap here last changed under the finger, so its echo (a double tap) is dropped (`isEcho`)
  const changed = useRef<PathChange | null>(null);
  const moved = (id: string) => {
    changed.current = { id, at: performance.now() };
  };
  const tick = (x: Todo) => {
    if (checking) return;
    // the key moment's one haptic
    haptics.toggle();
    setChecking(x.id);
    flush.current = () => {
      flush.current = null;
      // the stop turns into a done stop where it stood: a second tap there is not "Mark not done"
      moved(stopId(x));
      act.done(x, date <= today ? date : today);
      setChecking(null);
    };
    beat.current = setTimeout(() => flush.current?.(), reduce ? 0 : CHECK_BEAT_MS);
  };

  const idea = useMemo<GoalIdea | null>(() => {
    if (!isToday || goal || !loaded) return null;
    const y = goalOf(goals.data, 'day', shiftDays(today, -1));
    return goalIdea({ yesterday: y, todos: path.open.flatMap((c) => (c.kind === 'todo' ? [c.todo] : [])), fitness: log.fitness, session: sessionWords(log, date), habits: log.habits.length, minutes });
  }, [isToday, goal, loaded, goals.data, today, path.open, log, date, minutes]);

  /** "Set this goal": the idea becomes the day's goal in one tap (yesterday's comes with its why and its steps), with Undo. */
  const setIdea = (it: GoalIdea) => {
    haptics.toggle();
    // the buttons give way to the to-dos: a second tap would land on one of them
    moved('*');
    set.mutate({ level: 'day', period: date, ...ideaGoal(it) });
    toast('Goal set', {
      label: 'Undo',
      fn: () => {
        // the new goal may still carry its provisional id; whichever it has now is the one to take away
        const now = goalOf(qc.getQueryData<Aim[]>(['goals']), 'day', date);
        if (now) clear.mutate(now.id);
      },
    });
  };

  const allTodos = () => sheet.open({ title: 'To-dos', detent: 'medium', detents: ['medium', 'large'], body: <TodoListSheet date={date} /> });
  const editTodo = (x: Todo) => sheet.open({ eyebrow: 'To-do', title: x.text, body: <TodoSheet x={x} date={date} /> });
  /** Move a to-do to the top of the open ones: it becomes the next stop. */
  const makeNext = (x: Todo) => {
    const openOnes = cards.flatMap((c) => (c.kind === 'todo' && !c.done ? [c.todo] : []));
    haptics.drop();
    reorder.mutate([x.id, ...openOnes.filter((t) => t.id !== x.id).map((t) => t.id)]);
  };
  /** A to-do becomes a step of the day's goal (it leaves the list), with Undo. */
  const makeStep = (x: Todo, g: Aim) => {
    const prev = g.steps;
    haptics.drop();
    saveSteps(g, [...g.steps, { id: newStepId(), text: x.text.slice(0, 120), done: !!x.doneOn }]);
    patch.mutate({ id: x.id, deletedOn: goneOn(date, today) });
    toast(isToday ? 'Now a step of today’s goal' : 'Now a step of that day’s goal', {
      label: 'Undo',
      fn: () => {
        saveSteps(g, prev);
        patch.mutate({ id: x.id, deletedOn: null });
      },
    });
  };
  /** A to-do's menu, a hold away: at most four, the destructive one last. */
  const menuOf = (x: Todo, next: boolean): ContextMenuItem[] => {
    if (x.doneOn)
      return [
        { label: 'Not done', icon: <RotateCcw size={18} />, onSelect: () => act.reopen(x) },
        { label: 'Delete', icon: <Trash2 size={18} />, destructive: true, onSelect: () => act.remove(x) },
      ];
    const canStep = !!goal && goal.status === 'open' && goal.steps.length < GOAL_STEPS_MAX;
    return [
      ...(next ? [] : [{ label: 'Done', icon: <Check size={18} />, onSelect: () => act.done(x, date <= today ? date : today) }, { label: 'Make it next', icon: <ArrowUp size={18} />, onSelect: () => makeNext(x) }]),
      { label: nextDayWord(date, today), icon: <ArrowRight size={18} />, onSelect: () => act.later(x) },
      ...(next ? [canStep ? { label: 'Make it a step', icon: <Target size={18} />, onSelect: () => makeStep(x, goal) } : { label: 'Someday', icon: <Moon size={18} />, onSelect: () => act.someday(x) }] : []),
      { label: 'Delete', icon: <Trash2 size={18} />, destructive: true, onSelect: () => act.remove(x) },
    ];
  };

  // the hold: one clock for the whole line (the kit's stops take no hold of their own). The stop under the finger lifts
  // and its menu opens; the click that follows a hold is swallowed.
  const held = useRef<{ el: HTMLElement; id: string } | null>(null);
  const hold = useHold({
    disabled: !editable && !isToday,
    ignore: '.pth-stop:not([data-stop^="t:"]), .pth-end, input',
    target: () => held.current?.el ?? null,
    onHold: () => {
      const h = held.current;
      const card = h ? cards.find((c) => c.kind === 'todo' && stopId(c.todo) === h.id) : null;
      if (!h || !card || card.kind !== 'todo') return;
      const x = card.todo;
      const next = !!goal && path.open[0] === card;
      cm.open({ items: menuOf(x, next), anchor: h.el, lift: h.el, label: `${x.text} actions`, haptic: false });
    },
    onHoldMoved: () => cm.isOpen() && cm.close(),
  });

  /** Which stop the finger (or the keyboard's focus) is on: the one a hold lifts. */
  const aim = (e: { target: EventTarget }) => {
    const stop = e.target instanceof Element ? e.target.closest<HTMLElement>('.pth-stop[data-stop^="t:"]') : null;
    const el = stop?.querySelector<HTMLElement>('.pth-main') ?? null;
    held.current = stop && el ? { el, id: stop.dataset.stop! } : null;
  };

  const title = isToday ? 'Plan your day' : date > today ? 'Plan the day' : 'The plan';
  // the goals or the to-dos could not be read: say so in one row with a way to try again, never a skeleton that never fills
  if (!loaded && (todos.isError || goals.isError))
    return (
      <section className="pd" aria-label={title}>
        <SectionHeader className="pd-head" title={title} />
        <SectionEmpty
          icon={<CloudOff size={18} aria-hidden="true" />}
          title="Not loaded"
          line="Check your connection."
          action={{
            label: 'Try again',
            onPress: () => {
              void todos.refetch();
              void goals.refetch();
            },
          }}
        />
      </section>
    );
  if (!loaded) return <section className="pd is-skel" aria-hidden="true" />;

  const { total, doneCount } = path;
  const size = slim ? 'slim' : 'full';
  const setGoal = !goal && editable;
  const whose = isToday ? 'Today’s goal' : `Goal for ${fmtDate('short', date)}`;
  const n = goal?.steps.length ?? 0;
  const k = goal?.steps.filter((s) => s.done).length ?? 0;
  const steps = n ? `${k} of ${n} steps` : '';
  const count = countWords(doneCount, total);

  // ---------- the words on the sky ----------
  const ask = isToday ? 'What would make today count?' : date > today ? 'What would make this day count?' : 'No goal was set';
  const heading = goal ? (
    <Pressable key={rise} className={`pd-title${rise ? ' is-rising' : ''}`} press="dim" onPress={() => open('day', date)} label={`${whose}: ${goal.text}. ${[goal.status === 'open' ? '' : STATUS_WORD[goal.status], steps].filter(Boolean).join('. ')}${goal.status !== 'open' || steps ? '. ' : ''}Open`}>
      {goal.text}
    </Pressable>
  ) : (
    ask
  );
  const now = isToday ? (goal ? 'Today’s goal' : 'Today') : fmtDate('short', date);
  const state = goal && goal.status !== 'open' ? STATUS_WORD[goal.status] : isToday ? leftWords(minutes) : '';
  const meta = [state, steps].filter(Boolean).join(' · ') || undefined;

  // ---------- the band ----------
  const todosLabel = isToday ? 'To-dos today' : 'To-dos';
  const band: PosterBand = setGoal
    ? idea
      ? { label: idea.label, words: idea.text }
      : { label: isToday ? 'Today’s goal' : 'The day’s goal', words: 'One thing, in your own words' }
    : count
      ? { label: todosLabel, words: count }
      : editable
        ? { label: todosLabel, words: 'Add the first to-do', onPress: () => setAdding(true), pressLabel: 'To-dos. Add the first to-do' }
        : { label: todosLabel, words: 'Nothing was planned' };

  // ---------- the line of stops ----------
  // the light sits on the page in view only (a neighbour in the pager holds none of the screen's three now marks)
  const lit = live && editable;
  const later = isToday ? groupsOn(todos.data, date) : null;
  const more = later ? [later[1]!.items.length ? `Later ${later[1]!.items.length}` : null, later[2]!.items.length ? `Someday ${later[2]!.items.length}` : null].filter(Boolean).join(', ') : '';
  const showAll = isToday && (!!goal || total > 0 || !!more);
  const todoWords = (x: Todo) =>
    x.priority ? (
      <>
        {x.text} <PriorityFlag level={x.priority} />
      </>
    ) : (
      x.text
    );
  const subOf = (x: Todo) => [groupOf(x, groups.data)?.name, x.note].filter(Boolean).join(' · ') || undefined;
  const stops: React.ReactElement[] = [];
  if (setGoal)
    stops.push(
      <PathStop key="goal" id="goal" state={lit ? 'next' : 'ahead'}>
        <div className="po-actions">
          {idea ? (
            <>
              <Button variant="primary" onClick={() => setIdea(idea)} aria-label={`Set this goal: ${idea.text}`}>
                <Check size={18} aria-hidden="true" /> Set this goal
              </Button>
              <Button variant="quiet" onClick={() => open('day', date)} aria-label="Something else. Write your own goal">
                Something else
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={() => open('day', date)}>
              {isToday ? 'Set today’s goal' : 'Set the goal'}
            </Button>
          )}
        </div>
      </PathStop>,
    );
  if (path.doneFolded) stops.push(<PathStop key="done" id="done" state="done" struck={false} title={`${path.doneFolded} done`} chevron onPress={allTodos} label={`${path.doneFolded} to-dos done. Open all to-dos`} />);
  for (const c of path.done) {
    if (c.kind !== 'todo') continue;
    const x = c.todo;
    stops.push(<PathStop key={x.id} id={stopId(x)} state="done" title={x.text} onPress={() => (moved('*'), act.reopen(x))} label={`Done: ${x.text}. Mark not done`} />);
  }
  path.open.forEach((c, i) => {
    if (c.kind !== 'todo') return;
    const x = c.todo;
    const ticked = checking === x.id;
    // the first open to-do is the next move once the day has its goal; until then the light is on "Set this goal"
    const next = i === 0 && !setGoal && lit;
    stops.push(
      <PathStop
        key={x.id}
        id={stopId(x)}
        state={next ? 'next' : 'ahead'}
        tag={next ? 'Next' : undefined}
        title={todoWords(x)}
        subtitle={subOf(x)}
        struck={ticked}
        onPress={() => editTodo(x)}
        label={`${next ? 'Next: ' : ''}${x.text}${x.priority ? `, priority ${4 - x.priority}` : ''}. Edit`}
        trailing={next ? <PathCheck checked={ticked} label={`${x.text}, done`} onPress={() => tick(x)} /> : undefined}
      />,
    );
  });
  if (editable) {
    const end = showAll ? (
      <Button variant="quiet" onClick={allTodos} aria-label={`${path.rest ? `${path.rest} more. ` : ''}Open all to-dos${more ? `: ${more}` : ''}`}>
        {path.rest ? `${path.rest} more` : 'All to-dos'} <ChevronRight size={16} aria-hidden="true" />
      </Button>
    ) : undefined;
    // the day has its goal and no to-do yet: adding the first one is the next move, so the light waits there
    const first = !setGoal && total === 0 && lit;
    stops.push(
      adding ? (
        <PathStop key="add" id="add" state="add">
          <AddField date={date} today={today} onClose={() => setAdding(false)} refused={refused} onTaken={() => setRefused(null)} onRefused={onRefused} />
        </PathStop>
      ) : (
        <PathStop key="add" id="add" state={first ? 'next' : 'add'} title="Add a to-do" onPress={() => setAdding(true)} trailing={end} />
      ),
    );
  }

  const owed = isToday && awaitingReview(goals.data ?? [], today).length > 0;
  const tomorrow = shiftDays(today, 1);
  const tGoal = isToday && minutes >= EVENING ? goalOf(goals.data, 'day', tomorrow) : null;
  const evening = isToday && minutes >= EVENING;

  return (
    <section className={`pd${slim ? ' is-slim' : ''}`} aria-label={title}>
      {/* under the training card the section says its name; leading the page (Fitness off, today) the poster is the head */}
      {slim || !isToday ? <SectionHeader className="pd-head" title={title} /> : null}
      <Poster
        size={size}
        className="pd-poster"
        title={heading}
        titleAs={slim || !isToday ? 'h3' : 'h2'}
        titleSize={goal ? 'goal' : 'lead'}
        now={now}
        meta={meta}
        scene={<PosterScene size={size} lit={!!goal && goal.status !== 'missed' && lit && isToday} total={goal ? total : 0} done={goal ? doneCount : 0} />}
        band={band}
        path={
          stops.length ? (
            <div
              className="pd-path"
              {...hold.handlers}
              onPointerDownCapture={aim}
              onFocusCapture={aim}
              onClickCapture={(e) => {
                // the click that follows a hold is the hold's to swallow; then a tap's echo is ours
                hold.handlers.onClickCapture(e);
                if (e.isPropagationStopped()) return;
                const stop = e.target instanceof Element ? e.target.closest<HTMLElement>('.pth-stop') : null;
                if (!isEcho(changed.current, stop?.dataset.stop, performance.now())) return;
                e.stopPropagation();
                e.preventDefault();
              }}
            >
              <PathLine label={setGoal ? title : 'To-dos'}>{stops}</PathLine>
            </div>
          ) : undefined
        }
      >
        {/* yesterday's business (a review owed, Close yesterday) and, in the evening, tomorrow's goal: quiet rows under the line */}
        {owed || yesterday || evening ? (
          <div className="pd-more">
            {isToday ? <ReviewRow today={today} /> : null}
            {yesterday}
            {evening ? (
              <Pressable className="pd-yrow" press="surface" onPress={() => open('day', tomorrow)} label={tGoal ? `Tomorrow’s goal: ${tGoal.text}. Open` : 'Set tomorrow’s goal'}>
                <span className="pd-yrow-text">{tGoal ? `Tomorrow: ${tGoal.text}` : 'Set tomorrow’s goal'}</span>
                <ChevronRight size={18} aria-hidden="true" />
              </Pressable>
            ) : null}
          </div>
        ) : null}
      </Poster>
    </section>
  );
});

/**
 * The field "Add a to-do" turns into, at the end of the line (the quick-add words work: `!!`, `#list`, `tomorrow`, `fri`).
 * What the field read from the marks shows as it is typed, and a to-do that lands on another day says where it went, with
 * a way to see it. Return adds and keeps the field for the next one; leaving the field adds what is there and closes it.
 */
const AddField = ({ date, today, onClose, refused, onTaken, onRefused }: { date: ISODate; today: ISODate; onClose: () => void; /** Words the server refused: the field takes them back. */ refused: string | null; onTaken: () => void; onRefused: (typed: string) => void }) => {
  const { add } = useTodoMutations();
  const groups = useTodoGroups();
  const sheet = useSheet();
  const toast = useToast();
  const hintId = useId();
  const [draft, setDraftState] = useState('');
  // what is in the field right now, for the moments no render sits between (a blur and the unmount it causes)
  const typed = useRef('');
  const setDraft = (v: string) => {
    typed.current = v;
    setDraftState(v);
  };
  // the refused words come back as soon as the field is empty (never over something being typed)
  useEffect(() => {
    if (refused === null || typed.current) return;
    setDraft(refused);
    onTaken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refused, draft]);
  // nothing moves for the keyboard by itself: the field's row is scrolled clear of it when it opens, again when the
  // keyboard has come up, on a later focus, and after each Return (the new to-do pushes the field down a row)
  const field = useRef<HTMLDivElement>(null);
  const reveal = () => {
    if (field.current) revealField(field.current);
  };
  const kb = useKeyboardOpen();
  useEffect(() => {
    reveal();
  }, [kb]);
  const parsed = parseQuickAdd(draft, today, groups.data);
  const understood = understoodOf(parsed, groups.data);
  const commit = (close: boolean) => {
    if (parsed.text) {
      const forDay = date !== today && parsed.bucket === 'today' ? { bucket: 'later' as const, due: date } : { bucket: parsed.bucket, due: parsed.due };
      const asTyped = draft.trim();
      // a server that is slow, down or out of reach keeps the to-do and sends it later (the outbox); only a refusal for
      // good comes back here, and then the words return to the field
      add.mutateAsync({ id: newTodoId(), text: parsed.text, date: today, priority: parsed.priority, groupId: parsed.groupId ?? null, ...forDay }).catch((e: unknown) => {
        if (isWriteRejected(e)) onRefused(asTyped);
      });
      // it did not land on this page (a day or Someday was named): say where it went
      const elsewhere = forDay.bucket === 'someday' || (forDay.bucket === 'later' && forDay.due !== date);
      if (elsewhere) {
        const fold = forDay.bucket === 'someday' ? ('someday' as const) : ('later' as const);
        toast(forDay.bucket === 'someday' ? 'Added to Someday' : !forDay.due ? 'Added to Later' : forDay.due === shiftDays(today, 1) ? 'Added for tomorrow' : `Added for ${fmtDate('short', forDay.due)}`, {
          label: 'View',
          fn: () => sheet.open({ title: 'To-dos', detent: 'medium', detents: ['medium', 'large'], body: <TodoListSheet date={today} open={fold} /> }),
        });
      }
    }
    setDraft('');
    if (close || !parsed.text) onClose();
    else reveal();
  };
  // the field went away with words still in it and no blur to add them (its page was taken off screen): they are added,
  // as leaving the field always does. The check waits a task, so a field that is only being drawn again adds nothing.
  const leave = useRef(commit);
  leave.current = commit;
  useEffect(() => {
    const el = field.current;
    return () => {
      setTimeout(() => {
        if (typed.current.trim() && el && !el.isConnected) leave.current(true);
      }, 0);
    };
  }, []);
  return (
    <div ref={field} className="pd-add">
      <input
        autoFocus
        className="pd-add-input"
        placeholder="Add a to-do"
        maxLength={200}
        aria-label="New to-do"
        aria-describedby={understood ? hintId : undefined}
        enterKeyHint="done"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={reveal}
        onBlur={() => commit(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit(false);
          } else if (e.key === 'Escape') {
            // Escape leaves without adding
            typed.current = '';
            onClose();
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
