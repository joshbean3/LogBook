import { GOAL_STEPS_MAX, goalProgress, type Aim, type GoalStep } from '@logbook/shared';
import { Plus, X } from 'lucide-react';
import { animate, motion, useMotionValue } from 'motion/react';
import { useState } from 'react';
import { useGoalMutations } from '@/api/queries';
import { revealField } from '@/lib/keyboard';
import { springs, useReduced } from '@/lib/motion';
import { useToast } from '@/ui/Toast';
import { usePress } from '@/ui/usePress';
import { TodoMark } from '../todos/TodoMark';
import './goals.css';

const newId = () => `s${Math.random().toString(36).slice(2, 9)}`;
export const stepsOf = (texts: readonly string[]): GoalStep[] => texts.map((text) => ({ id: newId(), text, done: false }));

const R = 12;
const C = 2 * Math.PI * R;
/** The pop's start velocity, as the to-do mark's. */
const POP_V = 5.5;

/**
 * Mark a goal done from a single tap (the ring, Mark done): its steps stay as they are (nothing is checked for the owner),
 * and the toast's Undo puts back the status and the steps it had.
 */
export const useMarkDone = () => {
  const { review } = useGoalMutations();
  const toast = useToast();
  return (goal: Aim) => {
    const was = { status: goal.status, steps: goal.steps };
    review.mutate({ id: goal.id, status: 'done' });
    const undo = () => review.mutate({ id: goal.id, status: was.status, steps: was.steps });
    toast('Goal marked done', { label: 'Undo', fn: undo });
    return undo;
  };
};

/**
 * The goal's ring: how far through its steps it is (an arc that fills as steps are checked), a check inside once it is
 * done. A tap marks the goal done (the ring fills, pops on `springs.complete`, `toggle` on the peak frame; a toast offers
 * Undo) or opens it again. 28 px drawn, a 44 px target.
 */
export const GoalRing = ({ goal, label }: { goal: Aim; label: string }) => {
  const { review } = useGoalMutations();
  const markDone = useMarkDone();
  const reduce = useReduced();
  const pop = useMotionValue(1);
  const press = usePress();
  const done = goal.status === 'done';
  const p = goalProgress(goal);
  const toggle = () => {
    if (done) return review.mutate({ id: goal.id, status: 'open' });
    // the pop is the ring's; the haptic and the burst are the row's, once the goal turns done (wherever it was done from)
    if (!reduce) animate(pop, 1, { ...springs.complete, velocity: POP_V });
    markDone(goal);
  };
  return (
    <button type="button" className={`g-ring-hit ${done ? 'is-done' : ''}`} role="checkbox" aria-checked={done} aria-label={label} data-press="scale" {...press.handlers} onClick={toggle}>
      <motion.svg className="g-ring" width={28} height={28} viewBox="0 0 28 28" style={{ scale: pop }} aria-hidden="true">
        <circle cx={14} cy={14} r={R} className="g-ring-track" />
        <motion.circle cx={14} cy={14} r={R} className="g-ring-arc" strokeDasharray={C} initial={false} animate={{ strokeDashoffset: C * (1 - p) }} transition={reduce ? { duration: 0 } : springs.settle} transform="rotate(-90 14 14)" />
        <motion.path d="M9 14.5l3.2 3.2L19.5 10.5" className="g-ring-check" initial={false} animate={{ pathLength: done ? 1 : 0, opacity: done ? 1 : 0 }} transition={reduce ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }} />
      </motion.svg>
    </button>
  );
};

/** Why the steps are being saved: a check or uncheck, a step added, a step removed. */
export type StepChange = 'toggle' | 'add' | 'remove';

/** What changed between two lists of steps: one step checked (true) or unchecked (false), an add, a remove, or neither. */
export const stepChange = (before: readonly GoalStep[], after: readonly GoalStep[]): { why: StepChange | null; toggled?: boolean } => {
  if (after.length > before.length) return { why: 'add' };
  if (after.length < before.length) return { why: 'remove' };
  const was = new Map(before.map((x) => [x.id, x.done]));
  const flipped = after.filter((x) => was.has(x.id) && was.get(x.id) !== x.done);
  return flipped.length === 1 ? { why: 'toggle', toggled: flipped[0]!.done } : { why: null };
};

/**
 * The status a steps save leads to, or undefined to leave it. Only a check or uncheck moves it: the last step checked on an
 * open goal finishes it, a step unchecked on a done goal opens it again. Adding or removing a step never changes it, and
 * neither does checking a step of a goal already done.
 */
export const statusAfterSteps = (goal: Pick<Aim, 'status' | 'steps'>, steps: readonly GoalStep[]): 'done' | 'open' | undefined => {
  const { why, toggled } = stepChange(goal.steps, steps);
  if (why !== 'toggle') return undefined;
  if (toggled && goal.status === 'open' && steps.every((x) => x.done)) return 'done';
  if (!toggled && goal.status === 'done') return 'open';
  return undefined;
};

/** A partly or missed goal has its answer: its steps are kept as they were, not checked. */
export const stepsLocked = (goal: Pick<Aim, 'status'>) => goal.status === 'partly' || goal.status === 'missed';

/** Save a goal's steps; the status moves only on a check or an uncheck (see `statusAfterSteps`). */
export const useSaveSteps = () => {
  const { review } = useGoalMutations();
  return (goal: Aim, steps: GoalStep[]) => {
    const status = statusAfterSteps(goal, steps);
    review.mutate({ id: goal.id, steps, ...(status ? { status } : {}) });
  };
};

/** A tap anywhere on a step's row (not its mark, its remove or a field) toggles it, as the mark does. */
export const rowToggle = (on: () => void) => (e: React.MouseEvent) => {
  if (e.target instanceof Element && e.target.closest('button, input, textarea, a')) return;
  on();
};
export const newStepId = newId;

/**
 * A goal's steps, checked off where they stand (the goal's sheet). Checking the last one finishes the goal; unchecking one
 * of a done goal opens it again; a partly or missed goal's steps are locked (dimmed). `editable` adds the remove marks and
 * the add row.
 */
export const GoalSteps = ({ goal, editable, compact }: { goal: Aim; editable?: boolean; compact?: boolean }) => {
  const saveSteps = useSaveSteps();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const locked = stepsLocked(goal);
  const toggle = (id: string, next: boolean) => saveSteps(goal, goal.steps.map((x) => (x.id === id ? { ...x, done: next } : x)));
  const add = () => {
    const t = draft.trim();
    if (!t) return setAdding(false);
    saveSteps(goal, [...goal.steps, { id: newId(), text: t.slice(0, 120), done: false }]);
    setDraft('');
  };
  if (!goal.steps.length && !editable) return null;
  return (
    <ul className={`g-steps ${compact ? 'compact' : 'k-rows'} ${editable ? 'is-edit' : ''}`} aria-label="Steps">
      {goal.steps.map((s) => (
        <li key={s.id} className={`g-step ${s.done ? 'is-done' : ''} ${locked ? 'is-locked' : ''}`} onClick={locked ? undefined : rowToggle(() => toggle(s.id, !s.done))}>
          <TodoMark round on={s.done} label={s.text} disabled={locked} onToggle={(next) => toggle(s.id, next)} />
          <span className="g-step-text">{s.text}</span>
          {editable ? (
            <button type="button" className="g-step-x" aria-label={`Remove ${s.text}`} onClick={() => saveSteps(goal, goal.steps.filter((x) => x.id !== s.id))}>
              <X size={15} aria-hidden="true" />
            </button>
          ) : null}
        </li>
      ))}
      {editable && goal.steps.length < GOAL_STEPS_MAX ? (
        <li className="g-step g-step-add">
          {adding ? (
            <input
              className="g-step-input"
              autoFocus
              maxLength={120}
              placeholder="A step, verb first"
              enterKeyHint="done"
              value={draft}
              onFocus={(e) => revealField(e.currentTarget)}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={add}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  add();
                } else if (e.key === 'Escape') setAdding(false);
              }}
            />
          ) : (
            <button type="button" className="g-step-addbtn" onClick={() => setAdding(true)}>
              <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
              {goal.steps.length ? 'Add a step' : 'Break it into steps'}
            </button>
          )}
        </li>
      ) : null}
    </ul>
  );
};

/** Suggested steps before the goal exists: keep, drop or add, then they go in with it. */
export const DraftSteps = ({ steps, onChange }: { steps: string[]; onChange: (s: string[]) => void }) => {
  const [draft, setDraft] = useState('');
  const add = () => {
    const t = draft.trim();
    if (t && steps.length < GOAL_STEPS_MAX) onChange([...steps, t.slice(0, 120)]);
    setDraft('');
  };
  return (
    <ul className="g-steps is-draft k-rows" aria-label="Steps">
      {steps.map((s, i) => (
        <li key={`${i}-${s}`} className="g-step">
          <span className="g-step-num tnum" aria-hidden="true">
            {i + 1}
          </span>
          <span className="g-step-text">{s}</span>
          <button type="button" className="g-step-x" aria-label={`Drop ${s}`} onClick={() => onChange(steps.filter((_, j) => j !== i))}>
            <X size={15} aria-hidden="true" />
          </button>
        </li>
      ))}
      {steps.length < GOAL_STEPS_MAX ? (
        <li className="g-step g-step-add">
          <input className="g-step-input" maxLength={120} placeholder={steps.length ? 'Add a step' : 'Add a step, verb first'} enterKeyHint="done" value={draft} onFocus={(e) => revealField(e.currentTarget)} onChange={(e) => setDraft(e.target.value)} onBlur={add} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} />
        </li>
      ) : null}
    </ul>
  );
};
